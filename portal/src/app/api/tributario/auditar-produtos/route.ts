import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { obterIntervaloMesBrasil } from '@/utils/dateBrasil'
import { ItemProdutoXml, auditarLoteProdutos } from '@/utils/tributario/auditorEngine'
import { auditarItemComMultiIa, IaProviderConfig } from '@/utils/tributario/multiIaEngine'

function extractTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`))
  return match ? match[1].trim() : ''
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { 
      cliente_id, 
      tipo_filtro, 
      mes, 
      data_inicio, 
      data_fim, 
      numero_inicio, 
      numero_fim, 
      modelo,
      usar_ia 
    } = body

    if (!cliente_id) {
      return NextResponse.json({ error: 'cliente_id é obrigatório' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // 1. Montar consultas para NF-e (55) e NFC-e (65)
    let qNfe = supabase.from('nfe_saidas').select('*').eq('cliente_id', cliente_id)
    let qNfce = supabase.from('nfce_saidas').select('*').eq('cliente_id', cliente_id)

    if (tipo_filtro === 'mes' && mes) {
      const { startDate, endDate } = obterIntervaloMesBrasil(mes)
      qNfe = qNfe.gte('data_emissao', startDate).lte('data_emissao', endDate)
      qNfce = qNfce.gte('data_emissao', startDate).lte('data_emissao', endDate)
    } else if (tipo_filtro === 'periodo' && data_inicio && data_fim) {
      const inicio = `${data_inicio}T00:00:00-03:00`
      const fim = `${data_fim}T23:59:59.999-03:00`
      const startDate = new Date(inicio).toISOString()
      const endDate = new Date(fim).toISOString()
      qNfe = qNfe.gte('data_emissao', startDate).lte('data_emissao', endDate)
      qNfce = qNfce.gte('data_emissao', startDate).lte('data_emissao', endDate)
    } else if (tipo_filtro === 'numeracao') {
      const numIni = parseInt(numero_inicio || '0', 10)
      const numFim = parseInt(numero_fim || '999999999', 10)
      if (numIni > 0) {
        qNfe = qNfe.gte('numero', String(numIni))
        qNfce = qNfce.gte('numero', String(numIni))
      }
      if (numFim > 0) {
        qNfe = qNfe.lte('numero', String(numFim))
        qNfce = qNfce.lte('numero', String(numFim))
      }
    }

    // Filtro por Modelo se especificado
    let notasNfe: any[] = []
    let notasNfce: any[] = []

    if (!modelo || modelo === 'todos' || modelo === '55') {
      const { data, error } = await qNfe
      if (!error && data) notasNfe = data
    }

    if (!modelo || modelo === 'todos' || modelo === '65') {
      const { data, error } = await qNfce
      if (!error && data) notasNfce = data
    }

    // Filtra notas válidas (exclui divergentes)
    const todasNotas = [
      ...notasNfe.filter(n => !n.cnpj_divergente).map(n => ({ ...n, _modelo: '55' as const })),
      ...notasNfce.filter(n => !n.cnpj_divergente).map(n => ({ ...n, _modelo: '65' as const }))
    ]

    if (todasNotas.length === 0) {
      return NextResponse.json({
        total_xmls: 0,
        diagnosticos: [],
        metricas: {
          totalItens: 0,
          itensConformes: 0,
          itensInconsistentes: 0,
          totalRiscoFiscal: 0,
          totalPagamentoIndevido: 0,
          economiaEstimadaTotal: 0,
          reformaCestaBasica: 0,
          reformaReduzido: 0,
          reformaSeletivo: 0,
          reformaPadrao: 0
        }
      })
    }

    // 2. Ler os XMLs do Storage e extrair os produtos (<det><prod>...</det>)
    const itensExtraidos: ItemProdutoXml[] = []

    // Limite prudente por lote para evitar estourar limites de memória (até 50 notas por execução)
    const notasParaProcessar = todasNotas.slice(0, 50)

    for (const nota of notasParaProcessar) {
      const path = nota.storage_path || nota.xml_url
      if (!path) continue

      try {
        const { data: blob, error: dlErr } = await supabase.storage.from('xmls').download(path)
        if (dlErr || !blob) continue

        const xmlString = await blob.text()
        const detRegex = /<det[^>]*>([\s\S]*?)<\/det>/g
        let match: RegExpExecArray | null

        while ((match = detRegex.exec(xmlString)) !== null) {
          const itemXml = match[1]
          const cProd = extractTag(itemXml, 'cProd') || 'S/C'
          const xProd = extractTag(itemXml, 'xProd') || 'Produto sem descrição'
          const ncm = extractTag(itemXml, 'NCM') || ''
          const cest = extractTag(itemXml, 'CEST') || ''
          const cfop = extractTag(itemXml, 'CFOP') || ''
          const uCom = extractTag(itemXml, 'uCom') || 'UN'
          const vProd = parseFloat(extractTag(itemXml, 'vProd') || '0')
          const qCom = parseFloat(extractTag(itemXml, 'qCom') || '1')
          const vUnCom = parseFloat(extractTag(itemXml, 'vUnCom') || '0')

          // Tags de Impostos
          const icmsXml = extractTag(itemXml, 'ICMS')
          const csosn = extractTag(icmsXml, 'CSOSN')
          const cstIcms = extractTag(icmsXml, 'CST')
          const orig = extractTag(icmsXml, 'orig') || '0'

          const pisXml = extractTag(itemXml, 'PIS')
          const cstPis = extractTag(pisXml, 'CST')

          const cofinsXml = extractTag(itemXml, 'COFINS')
          const cstCofins = extractTag(cofinsXml, 'CST')

          itensExtraidos.push({
            idItem: `${nota.id}_${cProd}_${itensExtraidos.length}`,
            cProd,
            xProd,
            ncm,
            cest,
            cfop,
            csosn: csosn || undefined,
            cstIcms: cstIcms || undefined,
            cstPis: cstPis || undefined,
            cstCofins: cstCofins || undefined,
            orig,
            vProd: isNaN(vProd) ? 0 : vProd,
            qCom: isNaN(qCom) ? 1 : qCom,
            vUnCom: isNaN(vUnCom) ? 0 : vUnCom,
            uCom,
            chaveNota: nota.chave,
            numeroNota: nota.numero,
            modeloNota: nota._modelo,
            dataEmissao: nota.data_emissao
          })
        }
      } catch (err) {
        console.warn(`Erro ao baixar ou processar XML ${path}:`, err)
      }
    }

    // 3. Executar o Motor de Auditoria Fiscal sobre os itens
    const resultado = auditarLoteProdutos(itensExtraidos)

    // 4. Se solicitado enriquecimento com IA para os itens inconsistentes
    if (usar_ia === true) {
      // Verifica se a chave do cliente permite análise com IA
      const { data: configHub } = await supabase
        .from('configuracoes_hub')
        .select('analise_ia_xmls_ativa')
        .eq('cliente_id', cliente_id)
        .maybeSingle()

      const chaveAtiva = configHub?.analise_ia_xmls_ativa !== false

      if (chaveAtiva) {
        // Busca Regime Tributário e UF do cliente
        const { data: cliente } = await supabase
          .from('clientes')
          .select('id, razao_social, cnpj, regime_tributario, uf')
          .eq('id', cliente_id)
          .single()

        const crtCliente = (cliente?.regime_tributario === 'simples' || cliente?.regime_tributario === 'simples_nacional') ? 1 : 3
        const ufCliente = cliente?.uf || 'MG'

        // Busca integrações de IA ativas
        const { data: integracoes } = await supabase
          .from('integracoes')
          .select('*')
          .in('tipo', ['ia', 'mcp', 'ia_config'])

        const configsIa: IaProviderConfig[] = (integracoes || []).map(i => ({
          provedor: i.provedor,
          tipo: i.tipo,
          is_ativo: i.is_ativo,
          credenciais: i.credenciais || {}
        }))

        // Se o cliente tiver token próprio do Google Gemini cadastrado em seu perfil, utiliza como prioridade
        const { data: iaCliente } = await supabase
          .from('integracoes')
          .select('*')
          .eq('provedor', `gemini_${cliente_id}`)
          .eq('is_ativo', true)
          .maybeSingle()

        if (iaCliente?.credenciais?.api_key) {
          // Remove gemini global e insere a chave do cliente no topo
          const configsSemGemini = configsIa.filter(c => c.provedor !== 'gemini')
          configsIa.length = 0
          configsIa.push(
            {
              provedor: 'gemini',
              tipo: 'ia',
              is_ativo: true,
              credenciais: {
                api_key: iaCliente.credenciais.api_key,
                model: iaCliente.credenciais.modelo || 'gemini-1.5-flash',
                nome: `Google Gemini (Token do Cliente)`
              }
            },
            ...configsSemGemini
          )
        }

        const configGeral = configsIa.find(c => c.provedor === 'ia_geral')
        const modoConsenso = configGeral ? configGeral.credenciais.modo_consenso !== false : true
        const habilitarIaXmlsGeral = configGeral ? configGeral.credenciais.habilitar_ia_xmls !== false : true

        if (habilitarIaXmlsGeral) {
          const itensComProblema = resultado.diagnosticos
            .filter(d => d.status === 'inconsistente')
            .slice(0, 30) // Envia até 30 itens para otimizar tempo de resposta

        for (const diag of itensComProblema) {
          try {
            const resIa = await auditarItemComMultiIa(
              {
                codigo: diag.item.cProd,
                descricao: diag.item.xProd,
                ncmAtual: diag.item.ncm,
                cestAtual: diag.item.cest,
                cfopAtual: diag.item.cfop,
                csosnAtual: diag.item.csosn || diag.item.cstIcms,
                valor: diag.item.vProd,
                crt: crtCliente,
                uf: ufCliente
              },
              configsIa,
              modoConsenso
            )

            const v = resIa.vencedor
            if (v.ncmSugerido && v.ncmSugerido !== diag.item.ncm) {
              diag.sugestao.ncmSugerido = v.ncmSugerido
            }
            if (v.cestSugerido) {
              diag.sugestao.cestSugerido = v.cestSugerido
            }
            if (v.cfopSugerido) {
              diag.sugestao.cfopSugerido = v.cfopSugerido
            }
            if (v.csosnSugerido) {
              diag.sugestao.csosnSugerido = v.csosnSugerido
            }
            if (v.cstPisSugerido) {
              diag.sugestao.cstPisSugerido = v.cstPisSugerido
            }
            if (v.cstCofinsSugerido) {
              diag.sugestao.cstCofinsSugerido = v.cstCofinsSugerido
            }
            // Atualiza enquadramento da Reforma Tributária com alíquotas reais de IBS, CBS e IVA Dual
            diag.reformaTributaria.aliquotaIbsEst = v.ibsAliqEstimada
            diag.reformaTributaria.aliquotaCbsEst = v.cbsAliqEstimada
            diag.reformaTributaria.aliquotaIvaDualEst = v.ivaDualTotal
            diag.reformaTributaria.nomeRegime = v.classificacaoReforma
            diag.sugestao.motivo = `${v.justificativa} [${v.nomeProvedor} - Certeza: ${v.scoreConfianca}%]`.trim()
          } catch (e) {
            console.warn('Erro ao consultar Multi-IA para item:', diag.item.cProd, e)
          }
        }
        }
      }
    }

    return NextResponse.json({
      total_xmls: notasParaProcessar.length,
      total_xmls_disponiveis: todasNotas.length,
      diagnosticos: resultado.diagnosticos,
      metricas: resultado.metricas
    })
  } catch (err: any) {
    console.error('Erro na auditoria de produtos:', err)
    return NextResponse.json({ error: err.message || 'Erro interno na auditoria' }, { status: 500 })
  }
}
