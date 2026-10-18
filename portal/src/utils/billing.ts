import { createAdminClient } from '@/utils/supabase/admin'

export interface GerarFaturasResult {
  totalClientesAtivos: number
  faturasCriadas: number
  faturasAtualizadas: number
  faturasIgnoradas: number
  competencia: string
  detalhes: { 
    cliente: string
    valor: number
    vencimento: string
    status: 'criada' | 'atualizada' | 'ja_existia' | 'paga_antecipada' | 'sem_mensalidade' 
  }[]
}

/**
 * Gera automaticamente as faturas do mês para todos os clientes ativos mensalistas.
 * - Se a fatura ainda não existir, cria com status 'pendente'.
 * - Se a fatura já existir previamente (ex: gerada por antecipação após pagamento anterior),
 *   verifica se o valor base da mensalidade ou a data de vencimento foi alterado no cadastro do cliente,
 *   atualizando-a automaticamente.
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
    return { totalClientesAtivos: 0, faturasCriadas: 0, faturasAtualizadas: 0, faturasIgnoradas: 0, competencia, detalhes: [] }
  }

  // 2. Buscar faturas já existentes nesta competência
  const { data: faturasExistentes, error: fatError } = await supabase
    .from('faturas')
    .select('id, cliente_id, competencia, valor, valor_original, data_vencimento, status')
    .eq('competencia', competencia)

  if (fatError) throw fatError

  const faturasMap = new Map((faturasExistentes || []).map(f => [f.cliente_id, f]))

  const novasFaturas: any[] = []
  const detalhes: GerarFaturasResult['detalhes'] = []
  let faturasAtualizadas = 0

  // Último dia do mês para evitar datas inválidas (ex: 31 de fevereiro)
  const ultimoDiaDoMes = new Date(ano, mesNum, 0).getDate()

  for (const c of clientes) {
    const nome = c.nome_fantasia || c.razao_social
    const valorCadastrado = Number(c.valor_mensalidade || 0)

    if (valorCadastrado <= 0) {
      detalhes.push({
        cliente: nome,
        valor: 0,
        vencimento: '-',
        status: 'sem_mensalidade'
      })
      continue
    }

    const diaVenc = Math.min(Math.max(c.dia_vencimento || 10, 1), ultimoDiaDoMes)
    const dataVencimentoEsperada = `${ano}-${String(mesNum).padStart(2, '0')}-${String(diaVenc).padStart(2, '0')}`

    const faturaExistente = faturasMap.get(c.id)

    if (faturaExistente) {
      // Se a fatura já foi quitada antecipadamente pelo cliente
      if (faturaExistente.status === 'pago' || faturaExistente.status === 'paga') {
        detalhes.push({
          cliente: nome,
          valor: Number(faturaExistente.valor),
          vencimento: faturaExistente.data_vencimento,
          status: 'paga_antecipada'
        })
        continue
      }

      // Se a fatura existe e está pendente: verificar se o valor base ou a data mudou no cadastro do cliente!
      const valorBaseAtual = Number(faturaExistente.valor_original ?? faturaExistente.valor)
      const mudouValor = Math.abs(valorBaseAtual - valorCadastrado) > 0.009
      const mudouVencimento = faturaExistente.data_vencimento !== dataVencimentoEsperada

      if (mudouValor || mudouVencimento) {
        await supabase
          .from('faturas')
          .update({
            valor: valorCadastrado,
            valor_original: valorCadastrado,
            data_vencimento: dataVencimentoEsperada,
            qr_code_payload: null // reseta o Pix antigo para regenerar com novo valor/vencimento
          })
          .eq('id', faturaExistente.id)

        faturasAtualizadas++
        detalhes.push({
          cliente: nome,
          valor: valorCadastrado,
          vencimento: dataVencimentoEsperada,
          status: 'atualizada'
        })
      } else {
        detalhes.push({
          cliente: nome,
          valor: Number(faturaExistente.valor),
          vencimento: faturaExistente.data_vencimento,
          status: 'ja_existia'
        })
      }
      continue
    }

    // Fatura ainda não existe para este mês: cria nova
    novasFaturas.push({
      cliente_id: c.id,
      competencia,
      data_vencimento: dataVencimentoEsperada,
      valor: valorCadastrado,
      valor_original: valorCadastrado,
      status: 'pendente'
    })

    detalhes.push({
      cliente: nome,
      valor: valorCadastrado,
      vencimento: dataVencimentoEsperada,
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
    faturasAtualizadas,
    faturasIgnoradas: clientes.length - novasFaturas.length - faturasAtualizadas,
    competencia,
    detalhes
  }
}
