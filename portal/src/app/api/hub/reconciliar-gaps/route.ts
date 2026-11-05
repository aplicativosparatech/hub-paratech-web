import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseAdmin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseKey)

// Carrega todas as notas fiscais emitidas com paginação completa
async function carregarTodasNotas(tabela: 'nfe_saidas' | 'nfce_saidas', cliId: string, dataInicio?: string | null) {
  const allNotas: { id: string; numero: string | null; chave: string | null; data_emissao: string | null }[] = []
  const pageSize = 1000
  let from = 0
  let hasMore = true

  while (hasMore) {
    let q = supabaseAdmin
      .from(tabela)
      .select('id, numero, chave, data_emissao')
      .eq('cliente_id', cliId)
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1)

    if (dataInicio) {
      q = q.gte('data_emissao', dataInicio)
    }

    const { data, error } = await q
    if (error || !data || data.length === 0) {
      hasMore = false
      break
    }

    allNotas.push(...data)
    from += pageSize
    if (data.length < pageSize) {
      hasMore = false
    }
  }

  return allNotas
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const token = body.hub_token || new URL(request.url).searchParams.get('hub_token')

    if (!token) {
      return NextResponse.json({ error: 'Parâmetro hub_token é obrigatório.' }, { status: 400 })
    }

    // 1. Busca dados do cliente
    const { data: cliente, error: cliErr } = await supabaseAdmin
      .from('clientes')
      .select('id, razao_social, cnpj, uf, data_inicio_monitoramento, numero_inicial_nfe, numero_inicial_nfce')
      .eq('hub_token', token)
      .single()

    if (cliErr || !cliente) {
      return NextResponse.json({ error: 'Cliente não encontrado para o token fornecido.' }, { status: 404 })
    }

    const numIniNfe = cliente.numero_inicial_nfe || 1
    const numIniNfce = cliente.numero_inicial_nfce || 1

    // 2. Carrega notas cadastradas
    const [nfeData, nfceData] = await Promise.all([
      carregarTodasNotas('nfe_saidas', cliente.id, cliente.data_inicio_monitoramento),
      carregarTodasNotas('nfce_saidas', cliente.id, cliente.data_inicio_monitoramento)
    ])

    // Agrupa e detecta gaps
    const gapsEncontrados: {
      modelo: string
      serie: string
      numero_inicial: number
      numero_final: number
      quantidade: number
    }[] = []

    const maioresNumeros: Record<string, number> = { '55': 0, '65': 0 }

    const processarModelo = (modelo: '55' | '65', notas: typeof nfeData, minNum: number) => {
      const gruposSerie = new Map<string, number[]>()

      for (const n of notas) {
        let num: number | null = null
        let serie = '1'

        if (n.chave && n.chave.length === 44) {
          serie = String(parseInt(n.chave.substring(22, 25), 10) || 1)
          num = parseInt(n.chave.substring(25, 34), 10)
        } else if (n.numero) {
          num = parseInt(String(n.numero).replace(/\D/g, ''), 10)
        }

        if (num && !isNaN(num) && num >= minNum) {
          if (!gruposSerie.has(serie)) gruposSerie.set(serie, [])
          gruposSerie.get(serie)!.push(num)
        }
      }

      gruposSerie.forEach((numsRaw, serie) => {
        const nums = Array.from(new Set(numsRaw)).sort((a, b) => a - b)
        if (nums.length === 0) return

        const max = nums[nums.length - 1]
        if (max > (maioresNumeros[modelo] || 0)) {
          maioresNumeros[modelo] = max
        }

        // Gap inicial
        if (nums[0] > minNum) {
          gapsEncontrados.push({
            modelo,
            serie,
            numero_inicial: minNum,
            numero_final: nums[0] - 1,
            quantidade: nums[0] - minNum
          })
        }

        // Gaps intermediários
        for (let i = 0; i < nums.length - 1; i++) {
          const atual = nums[i]
          const prox = nums[i + 1]
          if (prox - atual > 1) {
            gapsEncontrados.push({
              modelo,
              serie,
              numero_inicial: atual + 1,
              numero_final: prox - 1,
              quantidade: prox - atual - 1
            })
          }
        }
      })
    }

    processarModelo('55', nfeData, numIniNfe)
    processarModelo('65', nfceData, numIniNfce)

    // Se o Hub enviou relatório de auditoria local
    if (body.auditoria_local) {
      console.log(`[Hub Reconciliação] Auditoria local recebida do cliente ${cliente.razao_social}:`, body.auditoria_local)
    }

    return NextResponse.json({
      success: true,
      cliente: {
        id: cliente.id,
        razao_social: cliente.razao_social,
        cnpj: cliente.cnpj
      },
      ponto_partida: {
        data_inicio: cliente.data_inicio_monitoramento,
        numero_inicial_nfe: numIniNfe,
        numero_inicial_nfce: numIniNfce
      },
      total_notas_portal: {
        nfe: nfeData.length,
        nfce: nfceData.length
      },
      maiores_numeros: maioresNumeros,
      total_gaps: gapsEncontrados.length,
      gaps: gapsEncontrados
    })

  } catch (err: any) {
    console.error('Erro ao reconciliar gaps:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

export async function GET(request: Request) {
  return POST(request)
}
