import { createAdminClient } from '@/utils/supabase/admin'

export interface GerarFaturasResult {
  totalClientesAtivos: number
  faturasCriadas: number
  faturasIgnoradas: number
  competencia: string
  detalhes: { cliente: string; valor: number; vencimento: string; status: 'criada' | 'ja_existia' | 'sem_mensalidade' }[]
}

/**
 * Gera automaticamente as faturas do mês para todos os clientes ativos mensalistas.
 * Verifica se a fatura da competência atual já foi criada (idempotência), evitando duplicidades.
 */
export async function gerarFaturasMensalistas(dataReferencia: Date = new Date()): Promise<GerarFaturasResult> {
  const supabase = createAdminClient()

  // Mês e ano de referência da competência
  const ano = dataReferencia.getFullYear()
  const mesNum = dataReferencia.getMonth() + 1
  const competencia = `${String(mesNum).padStart(2, '0')}/${ano}`

  // 1. Buscar todos os clientes ATIVOS
  const { data: clientes, error: cliError } = await supabase
    .from('clientes')
    .select('id, razao_social, nome_fantasia, valor_mensalidade, dia_vencimento, is_ativo')
    .eq('is_ativo', true)

  if (cliError) throw cliError
  if (!clientes || clientes.length === 0) {
    return { totalClientesAtivos: 0, faturasCriadas: 0, faturasIgnoradas: 0, competencia, detalhes: [] }
  }

  // 2. Buscar faturas já existentes nesta competência
  const { data: faturasExistentes, error: fatError } = await supabase
    .from('faturas')
    .select('cliente_id, competencia')
    .eq('competencia', competencia)

  if (fatError) throw fatError

  const clientesComFatura = new Set((faturasExistentes || []).map(f => f.cliente_id))

  const novasFaturas: any[] = []
  const detalhes: GerarFaturasResult['detalhes'] = []

  // Último dia do mês para evitar datas inválidas (ex: 31 de fevereiro)
  const ultimoDiaDoMes = new Date(ano, mesNum, 0).getDate()

  for (const c of clientes) {
    const nome = c.nome_fantasia || c.razao_social
    const valor = Number(c.valor_mensalidade || 0)

    if (valor <= 0) {
      detalhes.push({
        cliente: nome,
        valor: 0,
        vencimento: '-',
        status: 'sem_mensalidade'
      })
      continue
    }

    if (clientesComFatura.has(c.id)) {
      detalhes.push({
        cliente: nome,
        valor,
        vencimento: '-',
        status: 'ja_existia'
      })
      continue
    }

    const diaVenc = Math.min(Math.max(c.dia_vencimento || 10, 1), ultimoDiaDoMes)
    const dataVencimento = `${ano}-${String(mesNum).padStart(2, '0')}-${String(diaVenc).padStart(2, '0')}`

    novasFaturas.push({
      cliente_id: c.id,
      competencia,
      data_vencimento: dataVencimento,
      valor,
      status: 'pendente'
    })

    detalhes.push({
      cliente: nome,
      valor,
      vencimento: dataVencimento,
      status: 'criada'
    })
  }

  if (novasFaturas.length > 0) {
    const { error: insertError } = await supabase.from('faturas').insert(novasFaturas)
    if (insertError) throw insertError
  }

  return {
    totalClientesAtivos: clientes.length,
    faturasCriadas: novasFaturas.length,
    faturasIgnoradas: clientes.length - novasFaturas.length,
    competencia,
    detalhes
  }
}
