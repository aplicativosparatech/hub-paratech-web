import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseAdmin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseKey)

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const cliente_id = searchParams.get('cliente_id')
    const modeloParam = searchParams.get('modelo') || 'todos' // '55', '65', ou 'todos'

    if (!cliente_id) {
      return NextResponse.json({ error: 'Parâmetro cliente_id é obrigatório.' }, { status: 400 })
    }

    // 1. Busca dados do cliente para conferência de certificado, CNPJ e Ponto de Partida Fiscal
    const { data: cliente, error: cliErr } = await supabaseAdmin
      .from('clientes')
      .select('id, razao_social, cnpj, uf, certificado_url, data_inicio_monitoramento, numero_inicial_nfe, numero_inicial_nfce, numero_inicial_nfse, numero_inicial_cte, numero_inicial_mdfe')
      .eq('id', cliente_id)
      .single()

    if (cliErr || !cliente) {
      return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 })
    }

    const numIniNfe = cliente.numero_inicial_nfe || 1
    const numIniNfce = cliente.numero_inicial_nfce || 1

    // 2. Limpa automaticamente rejeições obsoletas anteriores ao ponto de partida fiscal
    if (numIniNfce > 1) {
      await supabaseAdmin
        .from('inutilizacoes_saidas')
        .delete()
        .eq('cliente_id', cliente_id)
        .eq('modelo', '65')
        .lt('numero_final', numIniNfce)
        .not('status_sefaz', 'in', '(102,204,563)')
    }
    if (numIniNfe > 1) {
      await supabaseAdmin
        .from('inutilizacoes_saidas')
        .delete()
        .eq('cliente_id', cliente_id)
        .eq('modelo', '55')
        .lt('numero_final', numIniNfe)
        .not('status_sefaz', 'in', '(102,204,563)')
    }

    // 3. Busca histórico de inutilizações registradas para cruzar com os gaps
    let inutQuery = supabaseAdmin
      .from('inutilizacoes_saidas')
      .select('*')
      .eq('cliente_id', cliente_id)
      .order('created_at', { ascending: false })

    const { data: inutilizacoesExistentes } = await inutQuery
    const inutsBrutos = inutilizacoesExistentes || []

    // Identifica faixas que já foram homologadas (102, 204, 563)
    const faixasHomologadas = new Set(
      inutsBrutos
        .filter(i => ['102', '204', '563'].includes(i.status_sefaz))
        .map(i => `${i.modelo}_${i.serie}_${i.numero_inicial}_${i.numero_final}`)
    )

    // Filtra inuts para ignorar rejeições que são anteriores ao ponto de partida ou já foram homologadas
    const inuts = inutsBrutos.filter(inut => {
      const isHomologado = ['102', '204', '563'].includes(inut.status_sefaz)
      if (isHomologado) return true

      const minNum = inut.modelo === '55' ? numIniNfe : numIniNfce
      if (inut.numero_final < minNum) return false

      const chaveFaixa = `${inut.modelo}_${inut.serie}_${inut.numero_inicial}_${inut.numero_final}`
      if (faixasHomologadas.has(chaveFaixa)) return false

      return true
    })

    // 3. Busca as notas fiscais emitidas (respeitando data de início do monitoramento se configurada)
    const resultadosNotas: { modelo: string; data: any[] }[] = []

    if (modeloParam === '55' || modeloParam === 'todos') {
      let nfeQ = supabaseAdmin
        .from('nfe_saidas')
        .select('id, numero, chave, data_emissao')
        .eq('cliente_id', cliente_id)

      if (cliente.data_inicio_monitoramento) {
        nfeQ = nfeQ.gte('data_emissao', cliente.data_inicio_monitoramento)
      }

      const { data: nfeData } = await nfeQ
      resultadosNotas.push({ modelo: '55', data: nfeData || [] })
    }

    if (modeloParam === '65' || modeloParam === 'todos') {
      let nfceQ = supabaseAdmin
        .from('nfce_saidas')
        .select('id, numero, chave, data_emissao')
        .eq('cliente_id', cliente_id)

      if (cliente.data_inicio_monitoramento) {
        nfceQ = nfceQ.gte('data_emissao', cliente.data_inicio_monitoramento)
      }

      const { data: nfceData } = await nfceQ
      resultadosNotas.push({ modelo: '65', data: nfceData || [] })
    }

    // Estrutura para agrupar números: Map<"modelo_serie", { numbers: number[], emissaoMap: Map<number, string> }>
    const grupos = new Map<string, { modelo: string; serie: string; numbers: number[]; emissaoMap: Map<number, string> }>()

    for (const res of resultadosNotas) {
      const mod = res.modelo
      for (const nota of res.data) {
        let num: number | null = null
        let serieStr = '1'

        if (nota.chave && nota.chave.length === 44) {
          serieStr = String(parseInt(nota.chave.substring(22, 25), 10) || 1)
          num = parseInt(nota.chave.substring(25, 34), 10)
        } else if (nota.numero) {
          num = parseInt(String(nota.numero).replace(/\D/g, ''), 10)
        }

        if (num && !isNaN(num) && num > 0) {
          const key = `${mod}_${serieStr}`
          if (!grupos.has(key)) {
            grupos.set(key, {
              modelo: mod,
              serie: serieStr,
              numbers: [],
              emissaoMap: new Map()
            })
          }
          const grupo = grupos.get(key)!
          grupo.numbers.push(num)
          if (nota.data_emissao) {
            grupo.emissaoMap.set(num, nota.data_emissao)
          }
        }
      }
    }

    // 4. Identifica quebras na sequência numérica (GAPS)
    interface GapItem {
      id: string
      modelo: string
      serie: string
      nNFIni: number
      nNFFin: number
      quantidade: number
      ano: string
      status: 'PENDENTE' | 'HOMOLOGADO' | 'UTILIZADA_SEFAZ'
      motivo: string
      protocolo?: string
      data_registro?: string
      ultimaEmissaoProxima?: string
    }

    const gaps: GapItem[] = []

    grupos.forEach((grupo, key) => {
      let numInicialEsperado = 1
      if (grupo.modelo === '55') numInicialEsperado = cliente.numero_inicial_nfe || 1
      else if (grupo.modelo === '65') numInicialEsperado = cliente.numero_inicial_nfce || 1

      // Considera apenas números a partir do ponto de partida configurado
      const nums = Array.from(new Set(grupo.numbers))
        .filter(n => n >= numInicialEsperado)
        .sort((a, b) => a - b)

      if (nums.length === 0) return

      const testarEAdicionarGap = (nIni: number, nFin: number, dataReferencia?: string) => {
        if (nFin < nIni) return
        const qtd = nFin - nIni + 1
        const ano = dataReferencia ? new Date(dataReferencia).getFullYear().toString().slice(-2) : new Date().getFullYear().toString().slice(-2)

        const inutMatch = inuts.find(inut => 
          inut.modelo === grupo.modelo &&
          String(inut.serie) === grupo.serie &&
          inut.numero_inicial <= nIni &&
          inut.numero_final >= nFin
        )

        let status: 'PENDENTE' | 'HOMOLOGADO' | 'UTILIZADA_SEFAZ' = 'PENDENTE'
        let motivo = 'Numeração faltante identificada no fluxo de emissão'
        let protocolo: string | undefined = undefined
        let dataRegistro: string | undefined = undefined

        if (inutMatch) {
          dataRegistro = inutMatch.data_hora || inutMatch.created_at
          if (['102', '204', '563'].includes(inutMatch.status_sefaz)) {
            status = 'HOMOLOGADO'
            motivo = inutMatch.status_sefaz === '102'
              ? (inutMatch.motivo_sefaz || 'Inutilização homologada pela SEFAZ')
              : `Confirmado na SEFAZ: Já se encontrava inutilizado (Cód. ${inutMatch.status_sefaz})`
            protocolo = inutMatch.protocolo || undefined
          } else if (['206', '256', '241'].includes(inutMatch.status_sefaz)) {
            status = 'UTILIZADA_SEFAZ'
            motivo = `Consta como UTILIZADA na SEFAZ (${inutMatch.motivo_sefaz || 'Nota emitida'}). XML ausente no portal.`
          } else {
            motivo = inutMatch.motivo_sefaz || 'Tentativa anterior rejeitada'
          }
        }

        gaps.push({
          id: `${grupo.modelo}_${grupo.serie}_${nIni}_${nFin}`,
          modelo: grupo.modelo,
          serie: grupo.serie,
          nNFIni: nIni,
          nNFFin: nFin,
          quantidade: qtd,
          ano,
          status,
          motivo,
          protocolo,
          data_registro: dataRegistro,
          ultimaEmissaoProxima: dataReferencia || undefined
        })
      }

      // 1. GAP INICIAL: Se o primeiro número emitido encontrado for superior ao número inicial esperado
      if (nums[0] > numInicialEsperado) {
        const primDataRef = grupo.emissaoMap.get(nums[0])
        testarEAdicionarGap(numInicialEsperado, nums[0] - 1, primDataRef)
      }

      // 2. GAPS INTERMEDIÁRIOS: Entre números emitidos consecutivos
      for (let i = 0; i < nums.length - 1; i++) {
        const atual = nums[i]
        const proximo = nums[i + 1]
        const diff = proximo - atual

        if (diff > 1) {
          const nIni = atual + 1
          const nFin = proximo - 1
          const dataRef = grupo.emissaoMap.get(atual) || grupo.emissaoMap.get(proximo)
          testarEAdicionarGap(nIni, nFin, dataRef)
        }
      }
    })

    // Ordena os gaps do mais recente/maior numeração para o menor
    gaps.sort((a, b) => b.nNFIni - a.nNFIni)

    // 5. Calcula resumo
    const pendentes = gaps.filter(g => g.status === 'PENDENTE').reduce((acc, g) => acc + g.quantidade, 0)
    const homologadas = gaps.filter(g => g.status === 'HOMOLOGADO').reduce((acc, g) => acc + g.quantidade, 0)
    const utilizadasSefaz = gaps.filter(g => g.status === 'UTILIZADA_SEFAZ').reduce((acc, g) => acc + g.quantidade, 0)
    // Números que realmente estão com pendência ativa (pendentes de envio + ausentes no portal)
    const totalNumerosFaltantes = pendentes + utilizadasSefaz

    return NextResponse.json({
      success: true,
      cliente: {
        id: cliente.id,
        razao_social: cliente.razao_social,
        cnpj: cliente.cnpj,
        uf: cliente.uf,
        tem_certificado: Boolean(cliente.certificado_url),
        ponto_partida: {
          data_inicio_monitoramento: cliente.data_inicio_monitoramento || null,
          numero_inicial_nfe: cliente.numero_inicial_nfe || 1,
          numero_inicial_nfce: cliente.numero_inicial_nfce || 1,
          numero_inicial_nfse: cliente.numero_inicial_nfse || 1,
          numero_inicial_cte: cliente.numero_inicial_cte || 1,
          numero_inicial_mdfe: cliente.numero_inicial_mdfe || 1
        }
      },
      resumo: {
        totalGaps: gaps.length,
        totalNumerosFaltantes,
        pendentes,
        homologadas,
        utilizadasSefaz
      },
      gaps,
      historicoInutilizacoes: inuts
    })

  } catch (err: any) {
    console.error('Erro ao calcular gaps de numeração:', err)
    return NextResponse.json({
      success: false,
      error: 'Erro interno ao consultar quebras de sequência: ' + (err.message || '')
    }, { status: 500 })
  }
}
