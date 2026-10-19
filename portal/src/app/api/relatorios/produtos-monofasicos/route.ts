import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { 
  isNcmMonofasico, 
  formatarNcm, 
  identificarDescricaoNcm, 
  analisarConformidadeItem 
} from '@/utils/ncmMonofasicos'
import { obterIntervaloMesBrasil } from '@/utils/dateBrasil'

function extractTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`))
  return match ? match[1].trim() : ''
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const clienteId = searchParams.get('cliente_id')
    const mesAno = searchParams.get('mes') // Ex: "2026-10"

    if (!clienteId) {
      return NextResponse.json({ error: 'cliente_id é obrigatório' }, { status: 400 })
    }

    const supabase = createAdminClient()

    let startDate: string | null = null
    let endDate: string | null = null

    if (mesAno) {
      const intervalo = obterIntervaloMesBrasil(mesAno)
      startDate = intervalo.startDate
      endDate = intervalo.endDate
    }

    // 1. Busca todas as notas de NFC-e (65) e NF-e (55) autorizadas no período
    // Não limitamos a valor_monofasico > 0 para capturar itens onde o cliente preencheu
    // CST 01/49/99 ou esqueceu a alíquota, mas o produto tem NCM monofásico legalmente!
    let qNfce = supabase
      .from('nfce_saidas')
      .select('id, numero, serie, chave, valor, valor_monofasico, storage_path, data_emissao, protocolo, cstat, is_autorizada, cnpj_divergente')
      .eq('cliente_id', clienteId)

    let qNfe = supabase
      .from('nfe_saidas')
      .select('id, numero, serie, chave, valor, valor_monofasico, storage_path, data_emissao, protocolo, cstat, is_autorizada, cnpj_divergente')
      .eq('cliente_id', clienteId)

    if (startDate && endDate) {
      qNfce = qNfce.gte('data_emissao', startDate).lte('data_emissao', endDate)
      qNfe = qNfe.gte('data_emissao', startDate).lte('data_emissao', endDate)
    }

    // Ordena decrescente por data para pegar os mais recentes primeiro caso haja muitas notas
    qNfce = qNfce.order('data_emissao', { ascending: false }).limit(600)
    qNfe = qNfe.order('data_emissao', { ascending: false }).limit(600)

    const [resNfce, resNfe] = await Promise.all([qNfce, qNfe])

    const notasNfce = (resNfce.data || [])
      .filter(n => !n.cnpj_divergente && (n.is_autorizada || n.cstat === '100' || !n.cstat))
      .map(n => ({ ...n, modelo: '65' as const, modelo_nome: 'NFC-e (Mod 65)' }))

    const notasNfe = (resNfe.data || [])
      .filter(n => !n.cnpj_divergente && (n.is_autorizada || n.cstat === '100' || !n.cstat))
      .map(n => ({ ...n, modelo: '55' as const, modelo_nome: 'NF-e (Mod 55)' }))

    const todasNotas = [...notasNfce, ...notasNfe]

    const itensMonofasicos: any[] = []

    // 2. Processa cada XML com concorrência em lote (evita gargalo sequencial e timeouts)
    const BATCH_SIZE = 15
    for (let i = 0; i < todasNotas.length; i += BATCH_SIZE) {
      const lote = todasNotas.slice(i, i + BATCH_SIZE)
      await Promise.all(
        lote.map(async (nota) => {
          if (!nota.storage_path) return

          try {
            const { data: blob, error: errDownload } = await supabase.storage.from('xmls').download(nota.storage_path)
            if (errDownload || !blob) {
              return
            }

            const xmlText = await blob.text()
            const dets = xmlText.match(/<det[^>]*>[\s\S]*?<\/det>/g) || []

            let itemSeq = 1
            for (const detXml of dets) {
              const ncm = extractTag(detXml, 'NCM')
              const cstPis = extractTag(detXml, 'CST') || ''
              const pPis = parseFloat(extractTag(detXml, 'pPIS') || '0')
              const vPis = parseFloat(extractTag(detXml, 'vPIS') || '0')
              const pCofins = parseFloat(extractTag(detXml, 'pCOFINS') || '0')
              const vCofins = parseFloat(extractTag(detXml, 'vCOFINS') || '0')

              // Executa a auditoria inteligente cruzando NCM x CST x Alíquota
              const analise = analisarConformidadeItem(ncm, cstPis, pPis)

              // Inclui no relatório se:
              // 1. O NCM oficial for monofásico (mesmo que emitido com CST 01/49/99 ou alíquota 0 incorreta)
              // 2. OU se foi expressamente emitido como CST 04 ou 06
              if (analise.isMonofasicoNcm || analise.isCstMonofasico) {
                const cProd = extractTag(detXml, 'cProd') || '—'
                const cEAN = extractTag(detXml, 'cEAN') || 'SEM GTIN'
                const xProd = extractTag(detXml, 'xProd') || 'Produto sem descrição'
                const cest = extractTag(detXml, 'CEST') || '—'
                const cfop = extractTag(detXml, 'CFOP') || '5405'
                const uCom = extractTag(detXml, 'uCom') || 'UN'
                const qCom = parseFloat(extractTag(detXml, 'qCom') || '0')
                const vUnCom = parseFloat(extractTag(detXml, 'vUnCom') || '0')
                const vProd = parseFloat(extractTag(detXml, 'vProd') || '0')

                let horaStr = ''
                try {
                  if (nota.data_emissao) {
                    const d = new Date(nota.data_emissao)
                    horaStr = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                  }
                } catch {
                  horaStr = ''
                }

                itensMonofasicos.push({
                  id: `${nota.chave || nota.id}_${itemSeq}`,
                  item_num: itemSeq,
                  nota_id: nota.id,
                  cupom_numero: nota.numero || 'S/N',
                  serie: nota.serie || '1',
                  modelo: nota.modelo,
                  modelo_nome: nota.modelo_nome,
                  chave: nota.chave,
                  data_emissao: nota.data_emissao,
                  hora_emissao: horaStr,
                  protocolo: nota.protocolo || 'Autorizado',
                  cProd,
                  cEAN,
                  xProd,
                  ncm,
                  ncm_formatado: formatarNcm(ncm),
                  categoria: analise.categoria,
                  descricao_ncm: analise.descricaoNcm,
                  cest,
                  cfop,
                  uCom,
                  qCom,
                  vUnCom,
                  vProd,
                  cst: analise.cstFormatado,
                  cst_original: cstPis,
                  pPis,
                  vPis,
                  pCofins,
                  vCofins,
                  // Metadados da Auditoria por NCM
                  status_conformidade: analise.statusConformidade, // 'regular' | 'divergente_cst' | 'sem_cst'
                  status_titulo: analise.statusTitulo,
                  status_descricao: analise.statusDescricao,
                  is_monofasico_ncm: analise.isMonofasicoNcm,
                  is_cst_monofasico: analise.isCstMonofasico,
                  tem_oportunidade_recuperacao: analise.temOportunidadeRecuperacao,
                  valor_recuperavel: analise.temOportunidadeRecuperacao ? vProd : 0
                })
              }
              itemSeq++
            }
          } catch (err: any) {
            console.warn(`Erro ao extrair produtos do XML da nota ${nota.numero}:`, err?.message)
          }
        })
      )
    }

    // 3. Monta os filtros dinâmicos de Produtos / NCMs contidos no período com contagem de divergências
    const ncmMap = new Map<string, {
      ncm: string
      ncm_formatado: string
      categoria: string
      descricao: string
      total_itens: number
      valor_total: number
      valor_regular: number
      valor_divergente: number
      qtd_divergente: number
      produtos_exemplo: Set<string>
    }>()

    for (const item of itensMonofasicos) {
      const key = item.ncm || 'OUTROS'
      if (!ncmMap.has(key)) {
        ncmMap.set(key, {
          ncm: key,
          ncm_formatado: item.ncm_formatado,
          categoria: item.categoria,
          descricao: item.descricao_ncm,
          total_itens: 0,
          valor_total: 0,
          valor_regular: 0,
          valor_divergente: 0,
          qtd_divergente: 0,
          produtos_exemplo: new Set<string>()
        })
      }
      const reg = ncmMap.get(key)!
      reg.total_itens += 1
      reg.valor_total += item.vProd
      if (item.status_conformidade === 'regular') {
        reg.valor_regular += item.vProd
      } else {
        reg.valor_divergente += item.vProd
        reg.qtd_divergente += 1
      }
      if (reg.produtos_exemplo.size < 4) {
        reg.produtos_exemplo.add(item.xProd)
      }
    }

    const filtrosDisponiveis = Array.from(ncmMap.values())
      .map(entry => ({
        ncm: entry.ncm,
        ncm_formatado: entry.ncm_formatado,
        categoria: entry.categoria,
        descricao: entry.descricao,
        total_itens: entry.total_itens,
        valor_total: Math.round(entry.valor_total * 100) / 100,
        valor_regular: Math.round(entry.valor_regular * 100) / 100,
        valor_divergente: Math.round(entry.valor_divergente * 100) / 100,
        qtd_divergente: entry.qtd_divergente,
        produtos_exemplo: Array.from(entry.produtos_exemplo),
        label: `${entry.ncm_formatado} - ${entry.descricao} (${entry.categoria})${entry.qtd_divergente > 0 ? ` [⚠️ ${entry.qtd_divergente} divergente(s)]` : ''}`
      }))
      .sort((a, b) => b.valor_total - a.valor_total)

    // 4. Totais consolidados da Auditoria por NCM
    const totalItens = itensMonofasicos.length
    const valorTotalGeral = itensMonofasicos.reduce((acc, i) => acc + i.vProd, 0)
    const valorRegular = itensMonofasicos.filter(i => i.status_conformidade === 'regular').reduce((acc, i) => acc + i.vProd, 0)
    const valorDivergente = itensMonofasicos.filter(i => i.status_conformidade !== 'regular').reduce((acc, i) => acc + i.vProd, 0)
    const qtdRegular = itensMonofasicos.filter(i => i.status_conformidade === 'regular').length
    const qtdDivergente = itensMonofasicos.filter(i => i.status_conformidade !== 'regular').length
    const cuponsDistintos = new Set(itensMonofasicos.map(i => i.chave || i.cupom_numero)).size

    // Estimativa de economia fiscal no DAS Simples Nacional (média de 3.0% de PIS/COFINS a deduzir da alíquota efetiva)
    const estimativaEconomiaSimples = Math.round(valorDivergente * 0.03 * 100) / 100

    return NextResponse.json({
      produtos: itensMonofasicos,
      filtros_disponiveis: filtrosDisponiveis,
      totais: {
        total_itens: totalItens,
        valor_total: Math.round(valorTotalGeral * 100) / 100,
        valor_regular: Math.round(valorRegular * 100) / 100,
        valor_divergente: Math.round(valorDivergente * 100) / 100,
        qtd_regular: qtdRegular,
        qtd_divergente: qtdDivergente,
        cupons_distintos: cuponsDistintos,
        estimativa_economia_simples: estimativaEconomiaSimples
      }
    })

  } catch (error: any) {
    console.error('Erro na rota /api/relatorios/produtos-monofasicos:', error)
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 })
  }
}
