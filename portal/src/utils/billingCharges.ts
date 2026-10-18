import { createAdminClient } from '@/utils/supabase/admin'

export interface EncargosFaturaResult {
  valorBase: number
  valorMulta: number
  valorJuros: number
  valorTotal: number
  diasAtraso: number
  emAtraso: boolean
  diasCarencia: number
  multaPercentual: number
  jurosMensalPercentual: number
}

/**
 * Calcula os encargos (multa e juros de mora) para uma fatura,
 * respeitando a prioridade de regras individuais do cliente sobre as globais do sistema.
 */
export function calcularEncargosFatura(params: {
  valorBase: number
  dataVencimento: string
  dataReferencia?: Date
  clienteMulta?: number | null
  clienteJuros?: number | null
  clienteCarencia?: number | null
  globalMulta?: number | null
  globalJuros?: number | null
  globalCarencia?: number | null
}): EncargosFaturaResult {
  const {
    valorBase,
    dataVencimento,
    dataReferencia = new Date(),
    clienteMulta,
    clienteJuros,
    clienteCarencia,
    globalMulta = 2.0,
    globalJuros = 1.0,
    globalCarencia = 3
  } = params

  // Hierarquia: Parâmetro do cliente tem prioridade sobre o global
  const multaPercentual = (clienteMulta !== null && clienteMulta !== undefined) 
    ? Number(clienteMulta) 
    : Number(globalMulta ?? 2.0)

  const jurosMensalPercentual = (clienteJuros !== null && clienteJuros !== undefined) 
    ? Number(clienteJuros) 
    : Number(globalJuros ?? 1.0)

  const diasCarencia = (clienteCarencia !== null && clienteCarencia !== undefined) 
    ? Number(clienteCarencia) 
    : Number(globalCarencia ?? 3)

  // Comparação de datas (apenas YYYY-MM-DD)
  const [anoVenc, mesVenc, diaVenc] = dataVencimento.split('-').map(Number)
  const venc = new Date(anoVenc, mesVenc - 1, diaVenc)
  venc.setHours(0, 0, 0, 0)

  const hoje = new Date(dataReferencia)
  hoje.setHours(0, 0, 0, 0)

  const diffMs = hoje.getTime() - venc.getTime()
  const diasAtrasoTotal = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  // Se ainda não venceu ou está dentro do período de carência/tolerância
  if (diasAtrasoTotal <= diasCarencia) {
    return {
      valorBase,
      valorMulta: 0,
      valorJuros: 0,
      valorTotal: valorBase,
      diasAtraso: Math.max(diasAtrasoTotal, 0),
      emAtraso: false,
      diasCarencia,
      multaPercentual,
      jurosMensalPercentual
    }
  }

  // Passou da carência: aplica multa e juros proporcionais aos dias de atraso
  const diasCobrar = diasAtrasoTotal
  const valorMulta = Math.round((valorBase * (multaPercentual / 100)) * 100) / 100
  const taxaDiaria = (jurosMensalPercentual / 30) / 100
  const valorJuros = Math.round((valorBase * taxaDiaria * diasCobrar) * 100) / 100
  const valorTotal = Math.round((valorBase + valorMulta + valorJuros) * 100) / 100

  return {
    valorBase,
    valorMulta,
    valorJuros,
    valorTotal,
    diasAtraso: diasAtrasoTotal,
    emAtraso: true,
    diasCarencia,
    multaPercentual,
    jurosMensalPercentual
  }
}

/**
 * Gera a fatura da próxima competência no exato momento em que uma fatura é quitada.
 * Isso possibilita ao cliente realizar pagamentos de faturas antecipadas.
 */
export async function gerarProximaFaturaAposPagamento(faturaQuitadaId: string) {
  const supabase = createAdminClient()

  // 1. Busca dados da fatura paga
  const { data: fatura, error: fatError } = await supabase
    .from('faturas')
    .select('id, cliente_id, competencia, valor')
    .eq('id', faturaQuitadaId)
    .single()

  if (fatError || !fatura) {
    console.error('Erro ao buscar fatura paga para antecipação:', fatError)
    return null
  }

  // 2. Calcula a próxima competência
  const parts = (fatura.competencia || '').split('/')
  if (parts.length !== 2) return null

  let mes = parseInt(parts[0], 10)
  let ano = parseInt(parts[1], 10)

  if (isNaN(mes) || isNaN(ano)) return null

  let proximoMes = mes + 1
  let proximoAno = ano
  if (proximoMes > 12) {
    proximoMes = 1
    proximoAno = ano + 1
  }

  const proximaCompetencia = `${String(proximoMes).padStart(2, '0')}/${proximoAno}`

  // 3. Busca cliente atualizado
  const { data: cliente, error: cliError } = await supabase
    .from('clientes')
    .select('id, valor_mensalidade, dia_vencimento, is_ativo, razao_social, nome_fantasia')
    .eq('id', fatura.cliente_id)
    .single()

  if (cliError || !cliente || !cliente.is_ativo) {
    return null
  }

  const valorMensalidade = Number(cliente.valor_mensalidade || 0)
  if (valorMensalidade <= 0) return null

  // 4. Verifica se a próxima fatura já existe para evitar duplicações
  const { data: existente } = await supabase
    .from('faturas')
    .select('id')
    .eq('cliente_id', cliente.id)
    .eq('competencia', proximaCompetencia)
    .maybeSingle()

  if (existente) {
    return { jaExistia: true, id: existente.id, competencia: proximaCompetencia }
  }

  // 5. Calcula data de vencimento da próxima fatura
  const ultimoDiaDoMes = new Date(proximoAno, proximoMes, 0).getDate()
  const diaVenc = Math.min(Math.max(cliente.dia_vencimento || 10, 1), ultimoDiaDoMes)
  const dataVencimento = `${proximoAno}-${String(proximoMes).padStart(2, '0')}-${String(diaVenc).padStart(2, '0')}`

  // 6. Insere a nova fatura da competência seguinte
  const { data: novaFatura, error: insError } = await supabase
    .from('faturas')
    .insert({
      cliente_id: cliente.id,
      competencia: proximaCompetencia,
      data_vencimento: dataVencimento,
      valor: valorMensalidade,
      valor_original: valorMensalidade,
      status: 'pendente'
    })
    .select()
    .single()

  if (insError) {
    console.error('Erro ao gerar próxima fatura antecipada:', insError)
    return null
  }

  return { criada: true, fatura: novaFatura, competencia: proximaCompetencia }
}
