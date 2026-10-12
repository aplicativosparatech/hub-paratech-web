import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { isNcmMonofasico } from '@/utils/ncmMonofasicos'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const clienteId = searchParams.get('cliente_id')
    const mesAno = searchParams.get('mes') // Ex: "2026-10"

    if (!clienteId) {
      return NextResponse.json({ error: 'cliente_id é obrigatório' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // 1. Monta o filtro de data (por mês ou geral)
    let startDate: string | null = null
    let endDate: string | null = null

    if (mesAno) {
      const [ano, mes] = mesAno.split('-').map(Number)
      startDate = new Date(Date.UTC(ano, mes - 1, 1, 0, 0, 0)).toISOString()
      endDate = new Date(Date.UTC(ano, mes, 0, 23, 59, 59, 999)).toISOString()
    }

    // 2. Busca NF-e de Saídas (Modelo 55)
    let queryNfe = supabase.from('nfe_saidas').select('*').eq('cliente_id', clienteId)
    if (startDate && endDate) {
      queryNfe = queryNfe.gte('data_emissao', startDate).lte('data_emissao', endDate)
    }
    const { data: nfeSaidas, error: errNfe } = await queryNfe
    if (errNfe) throw errNfe

    // 3. Busca NFC-e de Saídas (Modelo 65)
    let queryNfce = supabase.from('nfce_saidas').select('*').eq('cliente_id', clienteId)
    if (startDate && endDate) {
      queryNfce = queryNfce.gte('data_emissao', startDate).lte('data_emissao', endDate)
    }
    const { data: nfceSaidas, error: errNfce } = await queryNfce
    if (errNfce) throw errNfce

    // 4. Totais e Consolidação de Faturamento (exclui notas divergentes de outras empresas)
    const nfeValidas = (nfeSaidas || []).filter(n => !n.cnpj_divergente && n.tem_assinatura && (n.cstat === '100' || n.is_autorizada || !n.cstat))
    const nfceValidas = (nfceSaidas || []).filter(n => !n.cnpj_divergente && n.tem_assinatura && (n.cstat === '100' || n.is_autorizada || !n.cstat))

    const somaNfe = nfeValidas.reduce((acc, n) => acc + (Number(n.valor) || 0), 0)
    const somaNfce = nfceValidas.reduce((acc, n) => acc + (Number(n.valor) || 0), 0)
    const somaGeral = somaNfe + somaNfce

    const monofasicosNfe = nfeValidas.reduce((acc, n) => acc + (Number(n.valor_monofasico) || 0), 0)
    const monofasicosNfce = nfceValidas.reduce((acc, n) => acc + (Number(n.valor_monofasico) || 0), 0)
    const somaMonofasicos = monofasicosNfe + monofasicosNfce

    // 5. Relatório de Quebra de Sequência de Numeração
    function detectarQuebras(notas: any[], modelo: string) {
      const quebras: any[] = []
      // Agrupa por série
      const seriesMap = new Map<string, number[]>()

      for (const nota of notas) {
        const serie = nota.serie || '1'
        const num = parseInt(nota.numero, 10)
        if (!isNaN(num)) {
          if (!seriesMap.has(serie)) seriesMap.set(serie, [])
          seriesMap.get(serie)!.push(num)
        }
      }

      seriesMap.forEach((numeros, serie) => {
        numeros.sort((a, b) => a - b)
        for (let i = 0; i < numeros.length - 1; i++) {
          const atual = numeros[i]
          const proximo = numeros[i + 1]
          if (proximo > atual + 1) {
            quebras.push({
              modelo,
              serie,
              esperado_de: atual + 1,
              esperado_ate: proximo - 1,
              quantidade_faltante: (proximo - 1) - (atual + 1) + 1,
              anterior_emitido: atual,
              posterior_emitido: proximo
            })
          }
        }
      })

      return quebras
    }

    const quebrasNfe = detectarQuebras(nfeValidas, 'NF-e (55)')
    const quebrasNfce = detectarQuebras(nfceValidas, 'NFC-e (65)')
    const quebrasSequencia = [...quebrasNfe, ...quebrasNfce]

    // 6. Relatório de Notas Não Assinadas / Sem Protocolo SEFAZ
    const nfeNaoAssinadas = (nfeSaidas || []).filter(n => !n.tem_assinatura || (n.cstat && n.cstat !== '100' && !n.is_autorizada))
    const nfceNaoAssinadas = (nfceSaidas || []).filter(n => !n.tem_assinatura || (n.cstat && n.cstat !== '100' && !n.is_autorizada))

    // 7. Relatório de Inutilizados
    const nfeInutilizadas = (nfeSaidas || []).filter(n => n.cstat === '102' || (n.motivo_sefaz && n.motivo_sefaz.toLowerCase().includes('inutilizad')))
    const nfceInutilizadas = (nfceSaidas || []).filter(n => n.cstat === '102' || (n.motivo_sefaz && n.motivo_sefaz.toLowerCase().includes('inutilizad')))

    return NextResponse.json({
      consolidado: {
        nfe: {
          quantidade: nfeValidas.length,
          total: Math.round(somaNfe * 100) / 100,
          monofasico: Math.round(monofasicosNfe * 100) / 100
        },
        nfce: {
          quantidade: nfceValidas.length,
          total: Math.round(somaNfce * 100) / 100,
          monofasico: Math.round(monofasicosNfce * 100) / 100
        },
        geral: {
          quantidade_total: nfeValidas.length + nfceValidas.length,
          total_faturado: Math.round(somaGeral * 100) / 100,
          total_monofasico: Math.round(somaMonofasicos * 100) / 100,
          total_tributavel_restante: Math.round((somaGeral - somaMonofasicos) * 100) / 100
        }
      },
      quebras_sequencia: quebrasSequencia,
      nao_assinadas: {
        total: nfeNaoAssinadas.length + nfceNaoAssinadas.length,
        nfe: nfeNaoAssinadas,
        nfce: nfceNaoAssinadas
      },
      inutilizadas: {
        total: nfeInutilizadas.length + nfceInutilizadas.length,
        nfe: nfeInutilizadas,
        nfce: nfceInutilizadas
      }
    })

  } catch (error: any) {
    console.error('Erro na auditoria fiscal:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
