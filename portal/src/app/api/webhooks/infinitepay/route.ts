import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { sendWhatsAppMessage } from '@/utils/whatsapp'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const supabase = createAdminClient()

    // Estrutura de dados comumente enviada por webhooks da InfinitePay
    const event = body.event || body.type || 'transaction.paid'
    const invoiceId = body.metadata?.invoice_id || body.data?.metadata?.invoice_id || body.invoice_id
    const amount = (body.amount || body.data?.amount || 0) / (body.amount > 1000 ? 100 : 1)

    if (!invoiceId) {
      return NextResponse.json({ message: 'Webhook recebido, mas sem invoice_id associado.' }, { status: 200 })
    }

    // Busca os dados da fatura e do cliente
    const { data: fatura } = await supabase
      .from('faturas')
      .select('*, clientes ( id, razao_social, nome_fantasia, whatsapp )')
      .eq('id', invoiceId)
      .single()

    if (!fatura) {
      return NextResponse.json({ error: 'Fatura não encontrada.' }, { status: 404 })
    }

    const cliente: any = Array.isArray(fatura.clientes) ? fatura.clientes[0] : fatura.clientes
    const valorFormatado = Number(fatura.valor || amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    const refMes = new Date(fatura.data_vencimento).toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' })

    // Busca o WhatsApp do Administrador configurado no Hub
    const { data: configHub } = await supabase
      .from('configuracoes_hub')
      .select('pix_payload')
      .single()

    // 1. EVENTO: PAGAMENTO CONFIRMADO
    if (event === 'transaction.paid' || event === 'payment.succeeded' || event === 'paid') {
      // Atualiza o status da fatura para "paga"
      await supabase
        .from('faturas')
        .update({ status: 'paga' })
        .eq('id', fatura.id)

      // Mensagem para o CLIENTE
      if (cliente?.whatsapp) {
        try {
          await sendWhatsAppMessage({
            to: cliente.whatsapp,
            message: `✅ *Pagamento Confirmado!*\n\nOlá, ${cliente.nome_fantasia || cliente.razao_social}! Confirmamos o recebimento da sua fatura no valor de ${valorFormatado} referente a ${refMes}.\n\nSeu sistema está liberado para uso. Muito obrigado pela parceria!`
          })
        } catch (e: any) {
          console.error('Erro ao notificar cliente via WhatsApp:', e.message)
        }
      }

      // Mensagem para o ADMIN
      const adminPhone = process.env.ADMIN_WHATSAPP_NUMBER
      if (adminPhone) {
        try {
          await sendWhatsAppMessage({
            to: adminPhone,
            message: `💰 *Novo Pagamento Recebido!*\n\n• *Cliente:* ${cliente?.nome_fantasia || cliente?.razao_social}\n• *Valor:* ${valorFormatado}\n• *Referência:* ${refMes}\n• *Fatura ID:* ${fatura.id.split('-')[0]}\n\nStatus do Hub: Liberado no sistema.`
          })
        } catch (e: any) {
          console.error('Erro ao notificar admin via WhatsApp:', e.message)
        }
      }

      return NextResponse.json({ success: true, status: 'paga_processada' })
    }

    // 2. EVENTO: CHECKOUT ABANDONADO / PAGAMENTO NÃO FINALIZADO
    if (event === 'transaction.failed' || event === 'checkout.abandoned' || event === 'payment.canceled') {
      if (cliente?.whatsapp) {
        try {
          await sendWhatsAppMessage({
            to: cliente.whatsapp,
            message: `Olá, ${cliente.nome_fantasia || cliente.razao_social}. Notamos que você iniciou o pagamento da sua fatura de ${valorFormatado}, mas a operação não foi concluída.\n\nPrecisa de ajuda com o Pix ou deseja um novo link? Estamos à disposição para ajudar!`
          })
        } catch (e: any) {
          console.error('Erro ao enviar aviso de abandono via WhatsApp:', e.message)
        }
      }

      return NextResponse.json({ success: true, status: 'abandono_processado' })
    }

    return NextResponse.json({ success: true, message: 'Evento ignorado' })
  } catch (error: any) {
    console.error('Erro no processamento do webhook InfinitePay:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
