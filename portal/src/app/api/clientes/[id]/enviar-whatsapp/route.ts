import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { sendWhatsAppMessage } from '@/utils/whatsapp'
import { calculateEffectiveDates } from '@/utils/businessDays'
import { calcularEncargosFatura } from '@/utils/billingCharges'
import { obterOuGerarPixFatura } from '@/utils/pix'

interface FaturaContexto {
  condicao: 'bloqueado' | 'atrasado_tolerancia' | 'vence_hoje' | 'a_vencer' | 'pago' | 'sem_faturas'
  tituloCondicao: string
  modelo: string
  motivo: string
  mensagem: string
  telefone: string
  valor: number
  valorFormatado: string
  pixPayload: string
  faturaId?: string
  competencia?: string
  dataVencimento?: string
  dataBloqueio?: string
  diferencaDias?: number
  diasParaBloqueio?: number
}

async function prepararMensagemCliente(clienteId: string): Promise<FaturaContexto> {
  const supabase = createAdminClient()
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  // 1. Busca dados do Cliente
  const { data: cliente, error: cliError } = await supabase
    .from('clientes')
    .select(`
      id, razao_social, nome_fantasia, whatsapp, whatsapp_cobranca,
      dias_carencia, multa_atraso_percentual, juros_mora_mensal_percentual,
      valor_mensalidade, dia_vencimento
    `)
    .eq('id', clienteId)
    .single()

  if (cliError || !cliente) {
    throw new Error('Cliente não encontrado.')
  }

  const telefoneDestino = (cliente.whatsapp_cobranca || cliente.whatsapp || '').trim()

  // 2. Busca parâmetros globais
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

  // Caso: Nenhuma fatura encontrada
  if (!fatura) {
    const valorMensal = Number(cliente.valor_mensalidade || 0)
    const valorFormatado = valorMensal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    return {
      condicao: 'sem_faturas',
      tituloCondicao: 'Sem Faturas Cadastradas',
      modelo: 'Aviso Geral',
      motivo: 'Aviso de Regularidade',
      mensagem: `Olá, ${nomeEmpresa}! Confirmamos que seu cadastro na Paratech está regular e não há faturas pendentes de pagamento no momento. Qualquer dúvida estamos à disposição!`,
      telefone: telefoneDestino,
      valor: valorMensal,
      valorFormatado,
      pixPayload: ''
    }
  }

  // Se for uma fatura já PAGA
  if (isPago) {
    const valorPago = Number(fatura.valor || cliente.valor_mensalidade || 0)
    const valorFormatado = valorPago.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    const refCompetencia = fatura.competencia || 'este mês'
    return {
      condicao: 'pago',
      tituloCondicao: 'Fatura Quitada (Em Dia)',
      modelo: '4. Ao Pagar (Cliente)',
      motivo: 'Confirmação de Quitação / Em Dia',
      mensagem: `✅ *PAGAMENTO EM DIA*\n\nOlá, *${nomeEmpresa}*!\nConfirmamos que sua fatura referente a *${refCompetencia}* no valor de *${valorFormatado}* está devidamente quitada.\n\nSeu sistema está operando normalmente. Agradecemos pela pontualidade e parceria!`,
      telefone: telefoneDestino,
      valor: valorPago,
      valorFormatado,
      pixPayload: fatura.qr_code_payload || '',
      faturaId: fatura.id,
      competencia: refCompetencia,
      dataVencimento: fatura.data_vencimento
    }
  }

  // Fatura PENDENTE: Garante QR Code Pix Oficial atualizado
  let pixPayload = fatura.qr_code_payload
  if (!pixPayload || pixPayload.includes('mock-hubparatech')) {
    try {
      const pixRes = await obterOuGerarPixFatura(fatura.id)
      if (pixRes.qr_code_payload) {
        pixPayload = pixRes.qr_code_payload
      }
    } catch (errPix) {
      console.warn('Erro ao obter/gerar pix oficial:', errPix)
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

  const valorTotal = encargos.valorTotal
  const valorFormatado = valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

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
  const refCompetencia = fatura.competencia || 'este mês'

  const pixBloco = pixPayload 
    ? `\n\n🔑 *Pix Copia e Cola:*\n\`\`\`${pixPayload}\`\`\`` 
    : ''

  let textoEncargos = ''
  if (encargos.emAtraso && (encargos.valorMulta > 0 || encargos.valorJuros > 0)) {
    textoEncargos = ` (inclui R$ ${encargos.valorMulta.toFixed(2)} de multa e R$ ${encargos.valorJuros.toFixed(2)} de juros)`
  }

  // Identifica a Condição da Fatura
  if (diasParaBloqueio < 0) {
    // CONDIÇÃO 1: Bloqueado por Inadimplência
    return {
      condicao: 'bloqueado',
      tituloCondicao: 'Bloqueado por Inadimplência',
      modelo: 'Aviso de Bloqueio',
      motivo: 'Aviso de Bloqueio por Inadimplência',
      mensagem: `🚨 *AVISO DE BLOQUEIO POR PENDÊNCIA FINANCEIRA* 🚨\n\nOlá, *${nomeEmpresa}*!\nO prazo de tolerância para a fatura referente a *${refCompetencia}* encerrou em *${dataBloqueioFormatada}* e seu sistema pode ter sido bloqueado.\n\n• *Fatura:* ${fatura.id.split('-')[0]}\n• *Vencimento Original:* ${dataVencimentoFormatada}\n• *Valor Atualizado:* ${valorFormatado}${textoEncargos}${pixBloco}\n\n⚡ *Liberação Instantânea:* O sistema desbloqueia de forma 100% automática em segundos após a confirmação do Pix!`,
      telefone: telefoneDestino,
      valor: valorTotal,
      valorFormatado,
      pixPayload: pixPayload || '',
      faturaId: fatura.id,
      competencia: refCompetencia,
      dataVencimento: dataVencimentoFormatada,
      dataBloqueio: dataBloqueioFormatada,
      diferencaDias,
      diasParaBloqueio
    }
  }

  if (diferencaDias < 0 && diasParaBloqueio >= 0) {
    // CONDIÇÃO 2: Em Atraso, dentro do período de tolerância
    const avisoTolerancia = diasParaBloqueio === 0
      ? '⚠️ *O prazo de tolerância para regularizar TERMINA HOJE!*'
      : `⏳ *Faltam apenas ${diasParaBloqueio} dia(s) de tolerância antes do bloqueio previsto para ${dataBloqueioFormatada}.*`

    return {
      condicao: 'atrasado_tolerancia',
      tituloCondicao: `Em Atraso (${diasParaBloqueio}d de tolerância)`,
      modelo: '3. Atraso & Regressiva',
      motivo: 'Cobrança em Atraso (Regressiva)',
      mensagem: `⚠️ *AVISO DE FATURA EM ATRASO*\n\nOlá, *${nomeEmpresa}*!\nAinda não identificamos o pagamento da sua fatura referente a *${refCompetencia}*, que venceu em *${dataVencimentoFormatada}*.\n\n${avisoTolerancia}\n\n• *Valor Atual:* ${valorFormatado}${textoEncargos}${pixBloco}\n\nRegularize agora via Pix para evitar o bloqueio do sistema. (Se já pagou, favor desconsiderar).`,
      telefone: telefoneDestino,
      valor: valorTotal,
      valorFormatado,
      pixPayload: pixPayload || '',
      faturaId: fatura.id,
      competencia: refCompetencia,
      dataVencimento: dataVencimentoFormatada,
      dataBloqueio: dataBloqueioFormatada,
      diferencaDias,
      diasParaBloqueio
    }
  }

  if (diferencaDias === 0) {
    // CONDIÇÃO 3: No dia do Vencimento
    return {
      condicao: 'vence_hoje',
      tituloCondicao: 'Vence Hoje',
      modelo: '2. Lembrete de Vencimento',
      motivo: 'Lembrete de Vencimento (Hoje)',
      mensagem: `🔔 *LEMBRETE DE VENCIMENTO*\n\nOlá, *${nomeEmpresa}*!\nLembramos que a sua fatura do Sistema Comercial referente a *${refCompetencia}* vence *HOJE* (*${dataVencimentoFormatada}*).\n\n• *Valor:* ${valorFormatado}\n• *Data Limite de Tolerância:* ${dataBloqueioFormatada}${pixBloco}\n\nPara evitar encargos e bloqueios futuros, realize o pagamento via Pix até o final do dia!`,
      telefone: telefoneDestino,
      valor: valorTotal,
      valorFormatado,
      pixPayload: pixPayload || '',
      faturaId: fatura.id,
      competencia: refCompetencia,
      dataVencimento: dataVencimentoFormatada,
      dataBloqueio: dataBloqueioFormatada,
      diferencaDias: 0,
      diasParaBloqueio
    }
  }

  // CONDIÇÃO 4: A Vencer / Pré-Vencimento (faltam X dias)
  return {
    condicao: 'a_vencer',
    tituloCondicao: `A Vencer (em ${diferencaDias} dias)`,
    modelo: '1. Fatura Disponível',
    motivo: `Pré-Vencimento (${diferencaDias} dias antes)`,
    mensagem: `📄 *FATURA DISPONÍVEL*\n\nOlá, *${nomeEmpresa}*!\nA sua fatura referente a *${refCompetencia}* já está disponível para pagamento.\n\n• *Vencimento:* ${dataVencimentoFormatada} (em ${diferencaDias} dias)\n• *Valor:* ${valorFormatado}${pixBloco}\n\nPague antecipadamente com tranquilidade via Pix com baixa instantânea!`,
    telefone: telefoneDestino,
    valor: valorTotal,
    valorFormatado,
    pixPayload: pixPayload || '',
    faturaId: fatura.id,
    competencia: refCompetencia,
    dataVencimento: dataVencimentoFormatada,
    dataBloqueio: dataBloqueioFormatada,
    diferencaDias,
    diasParaBloqueio
  }
}

// GET: Retorna os dados da condição atual e a prévia da mensagem sem enviar
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const dados = await prepararMensagemCliente(id)
    return NextResponse.json({ success: true, ...dados })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 })
  }
}

// POST: Realiza o envio imediato da mensagem pelo WhatsApp
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const body = await request.json().catch(() => ({}))
    const dados = await prepararMensagemCliente(id)

    const telefoneFinal = (body.telefone || dados.telefone || '').replace(/\D/g, '')

    if (!telefoneFinal || telefoneFinal.length < 10) {
      return NextResponse.json({
        success: false,
        error: 'Cliente não possui um número de WhatsApp cadastrado. Preencha o campo WhatsApp no card de Contatos & Responsável antes de enviar.'
      }, { status: 400 })
    }

    const mensagemFinal = body.mensagem || dados.mensagem

    // Envia a mensagem via integração ativa de WhatsApp
    await sendWhatsAppMessage({
      to: telefoneFinal,
      message: mensagemFinal,
      remetente: 'Administrador (Manual - Enviar Agora)',
      destinatarioTipo: 'cliente',
      destinatarioNome: body.destinatarioNome,
      motivo: dados.motivo,
      modelo: dados.modelo,
      clienteId: id,
      faturaId: dados.faturaId
    })

    return NextResponse.json({
      success: true,
      mensagemEnviada: mensagemFinal,
      telefone: telefoneFinal,
      condicao: dados.condicao,
      tituloCondicao: dados.tituloCondicao,
      motivo: dados.motivo,
      modelo: dados.modelo
    })
  } catch (err: any) {
    console.error('Erro ao enviar cobrança manual via WhatsApp:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
