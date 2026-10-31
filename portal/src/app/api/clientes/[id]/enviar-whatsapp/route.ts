import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { sendWhatsAppMessage } from '@/utils/whatsapp'
import { calculateEffectiveDates } from '@/utils/businessDays'
import { calcularEncargosFatura } from '@/utils/billingCharges'
import { obterOuGerarPixFatura } from '@/utils/pix'
import {
  gerarMensagemCobranca,
  SituacaoCobranca,
  OPCOES_SITUACAO,
  DadosParaMensagem
} from '@/utils/cobrancaTemplates'

async function prepararContextoCliente(clienteId: string, situacaoForcada?: SituacaoCobranca | 'auto') {
  const supabase = createAdminClient()
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  // 1. Busca dados do Cliente (incluindo nome_contato para [Cliente] e nome_fantasia/razao_social para [Empresa])
  const { data: cliente, error: cliError } = await supabase
    .from('clientes')
    .select(`
      id, razao_social, nome_fantasia, nome_contato, whatsapp, whatsapp_cobranca,
      dias_carencia, multa_atraso_percentual, juros_mora_mensal_percentual,
      valor_mensalidade, dia_vencimento
    `)
    .eq('id', clienteId)
    .single()

  if (cliError || !cliente) {
    throw new Error('Cliente não encontrado.')
  }

  const telefoneDestino = (cliente.whatsapp_cobranca || cliente.whatsapp || '').trim()

  // 2. Busca parâmetros globais do portal
  const { data: configGeral } = await supabase
    .from('configuracoes_portal_geral')
    .select('global_multa_atraso_percentual, global_juros_mora_mensal_percentual, global_dias_carencia')
    .eq('id', 1)
    .maybeSingle()

  // 3. Busca a fatura mais relevante (prioriza pendentes mais antigas; se não tiver, busca última paga)
  const { data: faturasPendentes } = await supabase
    .from('faturas')
    .select('*')
    .eq('cliente_id', cliente.id)
    .eq('status', 'pendente')
    .order('data_vencimento', { ascending: true })

  let fatura = faturasPendentes?.[0]
  let isPago = false

  if (!fatura) {
    const { data: faturaPaga } = await supabase
      .from('faturas')
      .select('*')
      .eq('cliente_id', cliente.id)
      .eq('status', 'pago')
      .order('data_vencimento', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (faturaPaga) {
      fatura = faturaPaga
      isPago = true
    }
  }

  const nomeEmpresa = cliente.nome_fantasia || cliente.razao_social || 'Empresa'
  const nomeContato = cliente.nome_contato || nomeEmpresa

  // Caso: Nenhuma fatura encontrada no cadastro
  if (!fatura) {
    const valorMensal = Number(cliente.valor_mensalidade || 0)
    const valorFormatado = valorMensal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    return {
      condicaoReal: 'sem_faturas' as any,
      situacaoAtiva: 'sem_faturas' as any,
      tituloCondicao: 'Sem Faturas Cadastradas',
      modelo: 'Aviso Geral',
      motivo: 'Aviso de Regularidade',
      mensagem: `Olá, ${nomeContato}! Confirmamos que o cadastro da empresa ${nomeEmpresa} na Paratech está regular e não há faturas pendentes de pagamento no momento. Qualquer dúvida estamos à disposição!`,
      telefone: telefoneDestino,
      valor: valorMensal,
      valorFormatado,
      pixPayload: '',
      faturaId: undefined as string | undefined,
      opcoesSituacao: OPCOES_SITUACAO,
      clienteNome: nomeContato,
      empresaNome: nomeEmpresa
    }
  }

  // Fatura encontrada: Garante QR Code Pix Oficial Bacen (com chave Pix do Hub)
  let pixPayload = fatura.qr_code_payload
  if (!pixPayload || pixPayload.includes('mock-hubparatech')) {
    try {
      const pixRes = await obterOuGerarPixFatura(fatura.id)
      if (pixRes.qr_code_payload) {
        pixPayload = pixRes.qr_code_payload
        fatura.qr_code_payload = pixPayload
      }
    } catch (errPix) {
      console.warn('Erro ao obter/gerar Pix oficial Bacen:', errPix)
    }
  }

  // Carência / Tolerância
  const diasCarenciaEfetivos = (cliente.dias_carencia !== null && cliente.dias_carencia !== undefined)
    ? Number(cliente.dias_carencia)
    : Number(configGeral?.global_dias_carencia ?? 3)

  // Cálculo de encargos por atraso
  const valorBase = Number(fatura.valor_original ?? fatura.valor)
  const encargos = calcularEncargosFatura({
    valorBase,
    dataVencimento: fatura.data_vencimento,
    clienteMulta: cliente?.multa_atraso_percentual,
    clienteJuros: cliente?.juros_mora_mensal_percentual,
    clienteCarencia: cliente?.dias_carencia,
    globalMulta: configGeral?.global_multa_atraso_percentual,
    globalJuros: configGeral?.global_juros_mora_mensal_percentual,
    globalCarencia: configGeral?.global_dias_carencia
  })

  // Cálculo de datas
  const { rawDueDate, targetCountdownDate } = calculateEffectiveDates(
    fatura.data_vencimento,
    'bloqueio_real',
    diasCarenciaEfetivos
  )

  const diferencaDias = Math.floor((rawDueDate.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
  const diasParaBloqueio = Math.floor((targetCountdownDate.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))

  const dataVencimentoFormatada = rawDueDate.toLocaleDateString('pt-BR')
  const dataBloqueioFormatada = targetCountdownDate.toLocaleDateString('pt-BR')

  // Identificação da Condição Real Atual
  let condicaoReal: SituacaoCobranca = 'pre_vencimento'
  if (isPago) {
    condicaoReal = 'pago'
  } else if (diasParaBloqueio < 0) {
    condicaoReal = 'bloqueado'
  } else if (diferencaDias < 0 && diasParaBloqueio >= 0) {
    condicaoReal = 'atrasado_tolerancia'
  } else if (diferencaDias === 0) {
    condicaoReal = 'no_vencimento'
  } else {
    condicaoReal = 'pre_vencimento'
  }

  // Se o usuário selecionou uma situação específica para teste ou envio manual
  const situacaoEfetiva: SituacaoCobranca = (situacaoForcada && situacaoForcada !== 'auto')
    ? situacaoForcada
    : condicaoReal

  // Monta objeto com todos os parâmetros para o modelo oficial
  const dadosMensagem: DadosParaMensagem = {
    cliente,
    fatura: {
      ...fatura,
      qr_code_payload: pixPayload
    },
    encargos,
    diasParaBloqueio,
    diasCarenciaEfetivos,
    dataVencimentoFormatada,
    dataBloqueioFormatada
  }

  const resultadoMensagem = gerarMensagemCobranca(situacaoEfetiva, dadosMensagem)

  return {
    ...resultadoMensagem,
    condicaoReal,
    situacaoAtiva: situacaoEfetiva,
    telefone: telefoneDestino,
    valor: encargos.valorTotal,
    pixPayload: pixPayload || '',
    faturaId: fatura.id,
    diferencaDias,
    opcoesSituacao: OPCOES_SITUACAO
  }
}

// GET: Retorna os dados da condição atual e a prévia da mensagem (aceita ?situacao=...)
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const { searchParams } = new URL(request.url)
    const situacao = (searchParams.get('situacao') || 'auto') as SituacaoCobranca | 'auto'

    const dados = await prepararContextoCliente(id, situacao)
    return NextResponse.json({ success: true, ...dados })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 })
  }
}

// POST: Realiza o envio imediato da mensagem pelo WhatsApp (aceita texto customizado e situação)
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const body = await request.json().catch(() => ({}))
    const situacaoParam = (body.situacao || 'auto') as SituacaoCobranca | 'auto'

    const dados = await prepararContextoCliente(id, situacaoParam)

    const telefoneFinal = (body.telefone || dados.telefone || '').replace(/\D/g, '')

    if (!telefoneFinal || telefoneFinal.length < 10) {
      return NextResponse.json({
        success: false,
        error: 'Cliente não possui um número de WhatsApp cadastrado. Preencha o campo WhatsApp no card de Contatos & Responsável antes de enviar.'
      }, { status: 400 })
    }

    // Usa a mensagem enviada pelo usuário no editor da prévia, ou o template gerado
    const mensagemFinal = (body.mensagem && body.mensagem.trim().length > 0)
      ? body.mensagem.trim()
      : dados.mensagem

    // Envia a mensagem via integração ativa de WhatsApp
    await sendWhatsAppMessage({
      to: telefoneFinal,
      message: mensagemFinal,
      remetente: 'Administrador (Manual - Enviar Agora)',
      destinatarioTipo: 'cliente',
      destinatarioNome: body.destinatarioNome || dados.clienteNome || dados.empresaNome,
      motivo: dados.motivo,
      modelo: dados.modelo,
      clienteId: id,
      faturaId: dados.faturaId
    })

    return NextResponse.json({
      success: true,
      mensagemEnviada: mensagemFinal,
      telefone: telefoneFinal,
      condicaoReal: dados.condicaoReal,
      situacaoAtiva: dados.situacaoAtiva,
      tituloCondicao: dados.tituloCondicao,
      motivo: dados.motivo,
      modelo: dados.modelo
    })
  } catch (err: any) {
    console.error('Erro ao enviar cobrança manual via WhatsApp:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
