import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { confirmarPagamentoFatura } from '@/utils/paymentConfirmation'
import { sendWhatsAppMessage } from '@/utils/whatsapp'

export async function POST(request: Request) {
  try {
    // 0. Validação de autenticidade (se token secreto configurado)
    const webhookSecret = process.env.INFINITEPAY_WEBHOOK_SECRET
    if (webhookSecret) {
      const headerSecret = request.headers.get('x-webhook-secret') || request.headers.get('authorization')
      if (!headerSecret || (headerSecret !== webhookSecret && headerSecret !== `Bearer ${webhookSecret}`)) {
        console.warn('Webhook InfinitePay: Requisição bloqueada por token/segredo inválido.')
        return NextResponse.json({ error: 'Assinatura/token de webhook inválido.' }, { status: 401 })
      }
    }

    const body = await request.json()
    console.log('Webhook InfinitePay recebido:', JSON.stringify(body))

    const supabase = createAdminClient()

    // Estrutura de dados comumente enviada por webhooks da InfinitePay / CloudWalk
    const event = body.event || body.type || body.status || 'transaction.paid'
    
    // Extrai o valor pago
    let rawAmount = body.amount ?? body.data?.amount ?? body.value ?? body.data?.value ?? 0
    if (typeof rawAmount === 'string') rawAmount = parseFloat(rawAmount.replace(',', '.'))
    const amount = rawAmount > 500 ? rawAmount / 100 : rawAmount // se vier em centavos

    // 1. Identificação da Fatura por múltiplos identificadores
    let invoiceId: string | null = 
      body.metadata?.invoice_id || 
      body.data?.metadata?.invoice_id || 
      body.invoice_id || 
      body.order_id || 
      body.data?.order_id || 
      body.reference_id || 
      body.data?.reference_id || 
      null

    const txid = body.txid || body.transaction?.txid || body.data?.txid || body.end_to_end_id || ''

    let fatura: any = null

    // Busca direta por ID se vier formatado como UUID
    if (invoiceId && invoiceId.includes('-')) {
      const { data } = await supabase
        .from('faturas')
        .select('*, clientes ( id, razao_social, nome_fantasia, whatsapp )')
        .eq('id', invoiceId)
        .maybeSingle()
      fatura = data
    }

    // Busca por TXID Bacen (Tag 62.05: ex FAT890CE1B8FA2B44F)
    if (!fatura && txid && txid.startsWith('FAT')) {
      const cleanPrefix = txid.replace(/^FAT/, '').toLowerCase()
      // O ID original do Supabase é xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
      // O prefixo retirou os hífens
      const { data: faturasPendentes } = await supabase
        .from('faturas')
        .select('*, clientes ( id, razao_social, nome_fantasia, whatsapp )')
        .eq('status', 'pendente')
      
      fatura = faturasPendentes?.find(f => {
        const idSemTraco = f.id.replace(/-/g, '').toLowerCase()
        return idSemTraco.startsWith(cleanPrefix) || cleanPrefix.startsWith(idSemTraco.substring(0, 10))
      })
    }

    // Busca por fatura pendente com o mesmo valor se ainda não encontrada
    if (!fatura && amount > 0) {
      const { data: faturasPorValor } = await supabase
        .from('faturas')
        .select('*, clientes ( id, razao_social, nome_fantasia, whatsapp )')
        .eq('status', 'pendente')
        .order('data_vencimento', { ascending: true })

      fatura = faturasPorValor?.find(f => Math.abs(Number(f.valor) - amount) < 0.05)
    }

    if (!fatura) {
      console.warn('Webhook InfinitePay: Fatura não localizada para o payload recebido.', { invoiceId, txid, amount })
      return NextResponse.json({ message: 'Webhook recebido, mas nenhuma fatura compatível foi encontrada.' }, { status: 200 })
    }

    // 2. EVENTO: PAGAMENTO CONFIRMADO
    const isPaidEvent = 
      event === 'transaction.paid' || 
      event === 'payment.succeeded' || 
      event === 'paid' || 
      event === 'CONFIRMED' || 
      event === 'RECEIVED' || 
      event === 'approved' ||
      event === 'success'

    if (isPaidEvent) {
      const resultado = await confirmarPagamentoFatura(fatura.id, {
        provedor: 'infinitepay',
        amountPago: amount > 0 ? amount : Number(fatura.valor),
        txid: txid || undefined,
        notificarCliente: true,
        notificarAdmin: true
      })

      return NextResponse.json({
        success: true,
        status: 'pago_processado',
        resultado
      })
    }

    // 3. EVENTO: CHECKOUT ABANDONADO / PAGAMENTO NÃO FINALIZADO
    if (event === 'transaction.failed' || event === 'checkout.abandoned' || event === 'payment.canceled') {
      const cliente: any = Array.isArray(fatura.clientes) ? fatura.clientes[0] : fatura.clientes
      const valorFormatado = Number(fatura.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      if (cliente?.whatsapp) {
        try {
          await sendWhatsAppMessage({
            to: cliente.whatsapp,
            message: `Olá, ${cliente.nome_fantasia || cliente.razao_social}. Notamos que você iniciou o pagamento da sua fatura de ${valorFormatado}, mas a operação não foi concluída.\n\nPrecisa de ajuda com o Pix ou deseja um novo link? Estamos à disposição para ajudar!`,
            remetente: 'Sistema (Webhook InfinitePay)',
            destinatarioTipo: 'cliente',
            destinatarioNome: cliente.nome_fantasia || cliente.razao_social,
            motivo: 'Abandono de Checkout Pix',
            modelo: '6. Abandono de Pix',
            clienteId: cliente?.id,
            faturaId: fatura.id,
          })
        } catch (e: any) {
          console.error('Erro ao enviar aviso de abandono via WhatsApp:', e.message)
        }
      }

      return NextResponse.json({ success: true, status: 'abandono_processado' })
    }

    return NextResponse.json({ success: true, message: `Evento ${event} registrado.` })
  } catch (error: any) {
    console.error('Erro no processamento do webhook InfinitePay:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
