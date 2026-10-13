import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { isNcmMonofasico, formatarNcm, identificarDescricaoNcm } from '@/utils/ncmMonofasicos'
import { obterIntervaloMesBrasil } from '@/utils/dateBrasil'

function extractTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`))
  return match ? match[1].trim() : ''
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const clienteId = searchParams.get('cliente_id')
    const mesAno = searchParams.get('mes') // Ex: "2026-09"

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

    // 1. Busca notas de NFC-e (65) e NF-e (55) com monofásico > 0 no período
    let qNfce = supabase
      .from('nfce_saidas')
      .select('id, numero, serie, chave, valor, valor_monofasico, storage_path, data_emissao, protocolo, cstat, is_autorizada, cnpj_divergente')
      .eq('cliente_id', clienteId)
      .gt('valor_monofasico', 0)

    let qNfe = supabase
      .from('nfe_saidas')
      .select('id, numero, serie, chave, valor, valor_monofasico, storage_path, data_emissao, protocolo, cstat, is_autorizada, cnpj_divergente')
      .eq('cliente_id', clienteId)
      .gt('valor_monofasico', 0)

    if (startDate && endDate) {
      qNfce = qNfce.gte('data_emissao', startDate).lte('data_emissao', endDate)
      qNfe = qNfe.gte('data_emissao', startDate).lte('data_emissao', endDate)
    }

    const [resNfce, resNfe] = await Promise.all([qNfce, qNfe])
    const notasNfce = (resNfce.data || [])
      .filter(n => !n.cnpj_divergente)
      .map(n => ({ ...n, modelo: '65' as const, modelo_nome: 'NFC-e (Mod 65)' }))

    const notasNfe = (resNfe.data || [])
      .filter(n => !n.cnpj_divergente)
      .map(n => ({ ...n, modelo: '55' as const, modelo_nome: 'NF-e (Mod 55)' }))

    const todasNotas = [...notasNfce, ...notasNfe]

    const itensMonofasicos: any[] = []

    // 2. Processa cada XML com monofásicos
    for (const nota of todasNotas) {
      if (!nota.storage_path) continue

      try {
        const { data: blob, error: errDownload } = await supabase.storage.from('xmls').download(nota.storage_path)
        if (errDownload || !blob) {
          console.warn(`Aviso: Não foi possível baixar XML de ${nota.storage_path}:`, errDownload?.message)
          continue
        }

        const xmlText = await blob.text()
        const dets = xmlText.match(/<det[^>]*>[\s\S]*?<\/det>/g) || []

        let itemSeq = 1
        for (const detXml of dets) {
          const cstPis = extractTag(detXml, 'CST') || ''
          const hasMonofasicoCst = /<CST>(04|06)<\/CST>/.test(detXml)

          const ncm = extractTag(detXml, 'NCM')
          const ncmCheck = isNcmMonofasico(ncm)

          // Considera se tiver CST monofásico oficial (04 ou 06) OU se o NCM for de produto monofásico
          if (hasMonofasicoCst || ncmCheck.isMonofasico) {
            const cProd = extractTag(detXml, 'cProd') || '—'
            const cEAN = extractTag(detXml, 'cEAN') || 'SEM GTIN'
            const xProd = extractTag(detXml, 'xProd') || 'Produto sem descrição'
            const cest = extractTag(detXml, 'CEST') || '—'
            const cfop = extractTag(detXml, 'CFOP') || '5405'
            const uCom = extractTag(detXml, 'uCom') || 'UN'
            const qCom = parseFloat(extractTag(detXml, 'qCom') || '0')
            const vUnCom = parseFloat(extractTag(detXml, 'vUnCom') || '0')
            const vProd = parseFloat(extractTag(detXml, 'vProd') || '0')
            const infoNcm = identificarDescricaoNcm(ncm)

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
              categoria: infoNcm.categoria,
              descricao_ncm: infoNcm.descricao,
              cest,
              cfop,
              uCom,
              qCom,
              vUnCom,
              vProd,
              cst: cstPis || '04'
            })
          }
          itemSeq++
        }
      } catch (err: any) {
        console.warn(`Erro ao extrair produtos do XML da nota ${nota.numero}:`, err?.message)
      }
    }

    // 3. Monta os filtros dinâmicos de Produtos / NCMs contidos no período
    const ncmMap = new Map<string, {
      ncm: string
      ncm_formatado: string
      categoria: string
      descricao: string
      total_itens: number
      valor_total: number
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
          produtos_exemplo: new Set<string>()
        })
      }
      const reg = ncmMap.get(key)!
      reg.total_itens += 1
      reg.valor_total += item.vProd
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
        produtos_exemplo: Array.from(entry.produtos_exemplo),
        label: `${entry.ncm_formatado} - ${entry.descricao} (${entry.categoria})`
      }))
      .sort((a, b) => b.valor_total - a.valor_total)

    // 4. Totais consolidados
    const totalItens = itensMonofasicos.length
    const valorTotalGeral = itensMonofasicos.reduce((acc, i) => acc + i.vProd, 0)
    const cuponsDistintos = new Set(itensMonofasicos.map(i => i.chave || i.cupom_numero)).size

    return NextResponse.json({
      produtos: itensMonofasicos,
      filtros_disponiveis: filtrosDisponiveis,
      totais: {
        total_itens: totalItens,
        valor_total: Math.round(valorTotalGeral * 100) / 100,
        cupons_distintos: cuponsDistintos
      }
    })

  } catch (error: any) {
    console.error('Erro na rota /api/relatorios/produtos-monofasicos:', error)
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 })
  }
}
