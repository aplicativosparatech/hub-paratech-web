import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { sendWhatsAppMessage } from '@/utils/whatsapp'
import { gerarProximaFaturaAposPagamento } from '@/utils/billingCharges'

export async function GET(request: Request) {
  // O Mercado Pago às vezes valida a URL com uma chamada GET
  return NextResponse.json({ status: 'ok', message: 'Webhook Mercado Pago ativo' })
}

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    let body: any = {}
    try {
      body = await request.json()
    } catch {
      // Body vazio ou texto
    }

    // 1. Identificar o ID do pagamento enviado pelo Mercado Pago
    // Pode vir em body.data.id, body.id, query "id", ou query "data.id"
    const paymentId = 
      body?.data?.id || 
      body?.id || 
      searchParams.get('id') || 
      searchParams.get('data.id')

    const topic = body?.type || body?.topic || searchParams.get('topic') || searchParams.get('type')

    if (!paymentId) {
      return NextResponse.json({ received: true, message: 'Nenhum payment_id identificado. Notificação ignorada.' }, { status: 200 })
    }

    // Se o evento não for de pagamento (ex: merchant_order), podemos responder 200
    if (topic && topic !== 'payment' && topic !== 'payment.created' && topic !== 'payment.updated') {
      return NextResponse.json({ received: true, message: `Tópico ${topic} ignorado.` }, { status: 200 })
    }

    const supabase = createAdminClient()

    // 2. Buscar o Access Token do Mercado Pago na tabela gateways
    const { data: gateway } = await supabase
      .from('gateways')
      .select('api_key')
      .eq('provedor', 'mercadopago')
      .maybeSingle()

    if (!gateway?.api_key) {
      console.warn('Webhook MP recebido, mas gateway mercadopago não possui API Key configurada.')
      return NextResponse.json({ received: true, warning: 'Gateway sem API key' }, { status: 200 })
    }

    // 3. Consultar os detalhes do pagamento diretamente na API do Mercado Pago (segurança)
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        'Authorization': `Bearer ${gateway.api_key.trim()}`
      }
    })

    if (!mpRes.ok) {
      const errText = await mpRes.text()
      console.error(`Falha ao consultar pagamento ${paymentId} no Mercado Pago:`, errText)
      return NextResponse.json({ received: true, error: 'Falha ao consultar MP' }, { status: 200 })
    }

    const payment = await mpRes.json()

    // 4. Se o pagamento foi aprovado (status: approved)
    if (payment.status === 'approved') {
      const invoiceId = payment.external_reference || payment.metadata?.fatura_id

      let fatura: any = null

      if (invoiceId) {
        const { data: fat } = await supabase
          .from('faturas')
          .select('*, clientes ( id, razao_social, nome_fantasia, whatsapp )')
          .eq('id', invoiceId)
          .maybeSingle()
        fatura = fat
      }

      // Fallback: se não achar por ID de fatura, busca por mercadopago_payment_id
      if (!fatura) {
        const { data: fat } = await supabase
          .from('faturas')
          .select('*, clientes ( id, razao_social, nome_fantasia, whatsapp )')
          .eq('mercadopago_payment_id', String(paymentId))
          .maybeSingle()
        fatura = fat
      }

      if (!fatura) {
        console.warn(`Fatura não encontrada para o pagamento MP ${paymentId}`)
        return NextResponse.json({ received: true, warning: 'Fatura não encontrada' }, { status: 200 })
      }

      // Se já estava pago, evita reprocessamento e mensagens duplicadas
      if (fatura.status === 'pago' || fatura.status === 'paga') {
        return NextResponse.json({ received: true, message: 'Fatura já estava quitada' }, { status: 200 })
      }

      // 5. Atualiza a fatura para "pago"
      await supabase
        .from('faturas')
        .update({
          status: 'pago',
          data_pagamento: new Date().toISOString(),
          provedor_pagamento: 'mercadopago',
          mercadopago_payment_id: String(paymentId)
        })
        .eq('id', fatura.id)

      const cliente: any = Array.isArray(fatura.clientes) ? fatura.clientes[0] : fatura.clientes
      const valorPago = Number(payment.transaction_amount || fatura.valor)
      const valorFormatado = valorPago.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      const refMes = fatura.competencia || new Date(fatura.data_vencimento).toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' })

      // 6. Notificação via WhatsApp para o CLIENTE
      if (cliente?.whatsapp) {
        try {
          await sendWhatsAppMessage({
            to: cliente.whatsapp,
            message: `✅ *Pagamento Confirmado!*\n\nOlá, ${cliente.nome_fantasia || cliente.razao_social}!\nConfirmamos o recebimento da sua fatura no valor de ${valorFormatado} referente a ${refMes} via Mercado Pago (Pix).\n\nSeu sistema está liberado para uso. Muito obrigado pela parceria!`
          })
        } catch (e: any) {
          console.error('Erro ao enviar WhatsApp de confirmação ao cliente:', e.message)
        }
      }

      // 7. Notificação via WhatsApp para o ADMINISTRADOR
      const adminPhone = process.env.ADMIN_WHATSAPP_NUMBER
      if (adminPhone) {
        try {
          await sendWhatsAppMessage({
            to: adminPhone,
            message: `💰 *Novo Pagamento Recebido (Mercado Pago)!*\n\n• *Cliente:* ${cliente?.nome_fantasia || cliente?.razao_social}\n• *Valor:* ${valorFormatado}\n• *Competência:* ${refMes}\n• *Fatura:* ${fatura.id.split('-')[0]}\n• *Status Hub:* Liberado no sistema.`
          })
        } catch (e: any) {
          console.error('Erro ao avisar admin via WhatsApp:', e.message)
        }
      }

      // 8. REGRA DE ANTECIPAÇÃO: Gera automaticamente a próxima fatura para pagamento antecipado
      try {
        await gerarProximaFaturaAposPagamento(fatura.id)
      } catch (errAnt: any) {
        console.error('Erro ao gerar próxima fatura após pagamento MP:', errAnt.message)
      }

      return NextResponse.json({ success: true, status: 'pago_processado', paymentId })
    }

    return NextResponse.json({ received: true, status: payment.status })

  } catch (error: any) {
    console.error('Erro interno no webhook Mercado Pago:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
