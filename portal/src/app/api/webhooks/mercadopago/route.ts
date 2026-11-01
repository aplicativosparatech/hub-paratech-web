import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { confirmarPagamentoFatura } from '@/utils/paymentConfirmation'

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

      // 5. Confirma pagamento de forma centralizada (Gera próxima fatura em dia útil e notifica cliente e admin)
      const valorPago = Number(payment.transaction_amount || fatura.valor)
      
      // Atualiza também o ID do pagamento MP
      await supabase
        .from('faturas')
        .update({ mercadopago_payment_id: String(paymentId) })
        .eq('id', fatura.id)

      const resultado = await confirmarPagamentoFatura(fatura.id, {
        provedor: 'mercadopago',
        amountPago: valorPago,
        notificarCliente: true,
        notificarAdmin: true
      })

      return NextResponse.json({ success: true, status: 'pago_processado', paymentId, resultado })
    }

    return NextResponse.json({ received: true, status: payment.status })

  } catch (error: any) {
    console.error('Erro interno no webhook Mercado Pago:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
