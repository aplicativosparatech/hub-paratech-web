import { createAdminClient } from '@/utils/supabase/admin'
import { sendWhatsAppMessage } from '@/utils/whatsapp'
import { gerarProximaFaturaAposPagamento } from '@/utils/billingCharges'

/**
 * Obtém o número de WhatsApp do Administrador configurado no Hub.
 * Busca nas credenciais de WhatsApp no banco, na tabela geral ou nas variáveis de ambiente.
 */
export async function obterAdminWhatsAppNumber(supabaseClient?: any): Promise<string | null> {
  const supabase = supabaseClient || createAdminClient()

  // 1. Tenta buscar nas integracoes de WhatsApp
  try {
    const { data: integracoes } = await supabase
      .from('integracoes')
      .select('credenciais, is_ativo, provedor')
      .eq('tipo', 'whatsapp')

    if (integracoes && integracoes.length > 0) {
      // Prioriza a integração ativa
      const ativa = integracoes.find((i: any) => i.is_ativo) || integracoes[0]
      const num = ativa?.credenciais?.admin_whatsapp_number ||
                  ativa?.credenciais?.admin_phone ||
                  ativa?.credenciais?.admin_whatsapp
      if (num && String(num).replace(/\D/g, '').length >= 10) {
        return String(num).trim()
      }
    }
  } catch (err: any) {
    console.warn('Erro ao consultar WhatsApp do admin nas integrações:', err.message)
  }

  // 2. Tenta buscar na tabela de configurações gerais
  try {
    const { data: cfg } = await supabase
      .from('configuracoes_portal_geral')
      .select('*')
      .eq('id', 1)
      .maybeSingle()

    if (cfg?.admin_whatsapp_number || cfg?.admin_whatsapp) {
      const num = cfg.admin_whatsapp_number || cfg.admin_whatsapp
      if (num && String(num).replace(/\D/g, '').length >= 10) {
        return String(num).trim()
      }
    }
  } catch (_) {}

  // 3. Fallback: variável de ambiente
  if (process.env.ADMIN_WHATSAPP_NUMBER) {
    return process.env.ADMIN_WHATSAPP_NUMBER.trim()
  }

  return null
}

export interface ConfirmarPagamentoOptions {
  provedor?: string
  amountPago?: number
  txid?: string
  notificarCliente?: boolean
  notificarAdmin?: boolean
}

/**
 * Confirma o pagamento de uma fatura de forma centralizada:
 * 1. Atualiza status para 'pago' e data_pagamento.
 * 2. Gera a próxima fatura para o mês seguinte ajustada para o próximo dia útil.
 * 3. Envia mensagem no WhatsApp do CLIENTE com confirmação e agradecimento da parceria.
 * 4. Envia mensagem no WhatsApp do ADMINISTRADOR notificando o recebimento.
 */
export async function confirmarPagamentoFatura(
  faturaId: string,
  options?: ConfirmarPagamentoOptions
) {
  const supabase = createAdminClient()

  // 1. Busca os dados completos da fatura e do cliente vinculado
  const { data: fatura, error: fatError } = await supabase
    .from('faturas')
    .select(`
      *,
      clientes (
        id, razao_social, nome_fantasia, cnpj, whatsapp, valor_mensalidade, dia_vencimento
      )
    `)
    .eq('id', faturaId)
    .single()

  if (fatError || !fatura) {
    throw new Error(`Fatura ${faturaId} não encontrada.`)
  }

  const cliente: any = Array.isArray(fatura.clientes) ? fatura.clientes[0] : fatura.clientes
  const clienteNome = (cliente?.nome_fantasia || cliente?.razao_social || 'Cliente').trim()
  const empresaNome = (cliente?.razao_social || cliente?.nome_fantasia || 'Empresa').trim()
  const valorFinal = Number(options?.amountPago || fatura.valor || 0)
  const valorFormatado = valorFinal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const refMes = fatura.competencia || new Date(fatura.data_vencimento).toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' })
  const faturaCodigo = `FAT-${fatura.id.split('-')[0].toUpperCase()}`
  const provedor = options?.provedor || fatura.provedor_pagamento || 'pix'

  // Se já estiver quitada, não duplica ações
  if (fatura.status === 'pago' || fatura.status === 'paga') {
    return {
      success: true,
      jaPago: true,
      fatura,
      mensagem: 'Fatura já se encontrava com status de quitada.'
    }
  }

  // 2. Atualiza a fatura para "pago"
  const { error: updError } = await supabase
    .from('faturas')
    .update({
      status: 'pago',
      data_pagamento: new Date().toISOString(),
      provedor_pagamento: provedor
    })
    .eq('id', fatura.id)

  if (updError) {
    throw new Error(`Erro ao atualizar status da fatura: ${updError.message}`)
  }

  // 3. Regra de Antecipação: Gera a próxima fatura no próximo dia útil
  let proximaFatura: any = null
  try {
    proximaFatura = await gerarProximaFaturaAposPagamento(fatura.id)
  } catch (errAnt: any) {
    console.error('Erro ao gerar próxima fatura após quitação:', errAnt.message)
  }

  const bannerHeader = `🏢 *PARATECH TECNOLOGIA & SISTEMAS*\n\n`

  // 4. Notifica o CLIENTE via WhatsApp (agradecimento & liberação)
  if (options?.notificarCliente !== false && cliente?.whatsapp) {
    try {
      const msgCliente = `${bannerHeader}✅ *PAGAMENTO CONFIRMADO!*

Olá, *${clienteNome}*!
Confirmamos com sucesso o recebimento da sua fatura *[${faturaCodigo}]* no valor de *${valorFormatado}* referente a *${refMes}*.

✨ *Seu sistema está 100% liberado e em dia.*
Muito obrigado pela pontualidade, confiança e por essa valiosa parceria com a Paratech Sistemas! 🤝🚀`

      await sendWhatsAppMessage({
        to: cliente.whatsapp,
        message: msgCliente,
        remetente: 'Sistema (Confirmação Pix)',
        destinatarioTipo: 'cliente',
        destinatarioNome: clienteNome,
        motivo: 'Confirmação de Pagamento & Agradecimento',
        modelo: '4. Ao Pagar (Cliente)',
        clienteId: cliente?.id,
        faturaId: fatura.id,
      })
    } catch (e: any) {
      console.error('Erro ao notificar cliente via WhatsApp:', e.message)
    }
  }

  // 5. Notifica o ADMINISTRADOR via WhatsApp
  if (options?.notificarAdmin !== false) {
    try {
      const adminPhone = await obterAdminWhatsAppNumber(supabase)
      if (adminPhone) {
        const proxComp = proximaFatura?.competencia || 'Próximo mês'
        const msgAdmin = `${bannerHeader}💰 *NOVO PAGAMENTO RECEBIDO!*

• *Cliente:* ${clienteNome}
• *Empresa:* ${empresaNome}
• *Valor:* ${valorFormatado}
• *Referência:* ${refMes}
• *Código:* ${faturaCodigo}
• *Canal:* Pix (${provedor})

✨ O sistema do cliente foi liberado e a próxima fatura (${proxComp}) foi programada no Hub sem fins de semana ou feriados.`

        await sendWhatsAppMessage({
          to: adminPhone,
          message: msgAdmin,
          remetente: 'Sistema (Alerta Financeiro)',
          destinatarioTipo: 'admin',
          destinatarioNome: 'Administrador Paratech',
          motivo: `Novo Pagamento Recebido - ${clienteNome}`,
          modelo: '5. Ao Pagar (Admin)',
          clienteId: cliente?.id,
          faturaId: fatura.id,
        })
      }
    } catch (e: any) {
      console.error('Erro ao notificar admin via WhatsApp:', e.message)
    }
  }

  return {
    success: true,
    jaPago: false,
    faturaId: fatura.id,
    valorPago: valorFinal,
    proximaFatura
  }
}
