import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { confirmarPagamentoFatura } from '@/utils/paymentConfirmation'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { fatura_id, force_confirm, hub_token } = body

    if (!fatura_id && !hub_token) {
      return NextResponse.json({ error: 'Identificador não fornecido' }, { status: 400 })
    }

    const supabase = createAdminClient()

    let targetInvoiceId = fatura_id

    // Se veio apenas o hub_token, descobre a fatura pendente mais recente do cliente
    if (!targetInvoiceId && hub_token) {
      const { data: cliente } = await supabase
        .from('clientes')
        .select('id')
        .eq('hub_token', hub_token)
        .maybeSingle()

      if (cliente) {
        const { data: faturaPendente } = await supabase
          .from('faturas')
          .select('id, status')
          .eq('cliente_id', cliente.id)
          .eq('status', 'pendente')
          .order('data_vencimento', { ascending: true })
          .limit(1)
          .maybeSingle()

        targetInvoiceId = faturaPendente?.id
      }
    }

    if (!targetInvoiceId) {
      return NextResponse.json({ success: true, pago: true, message: 'Nenhuma fatura pendente encontrada.' })
    }

    // Busca o status atual da fatura
    const { data: fatura, error } = await supabase
      .from('faturas')
      .select('id, status, valor, data_vencimento, data_pagamento')
      .eq('id', targetInvoiceId)
      .maybeSingle()

    if (error || !fatura) {
      return NextResponse.json({ error: 'Fatura não encontrada' }, { status: 404 })
    }

    // Se já está pago
    if (fatura.status === 'pago' || fatura.status === 'paga') {
      return NextResponse.json({
        success: true,
        pago: true,
        faturaId: fatura.id,
        dataPagamento: fatura.data_pagamento
      })
    }

    // Se o cliente solicitou confirmação direta ("Já realizei o pagamento")
    if (force_confirm) {
      const resultado = await confirmarPagamentoFatura(fatura.id, {
        provedor: 'pix_app',
        notificarCliente: true,
        notificarAdmin: true
      })

      return NextResponse.json({
        success: true,
        pago: true,
        faturaId: fatura.id,
        proximaFatura: resultado.proximaFatura,
        mensagem: 'Pagamento confirmado e processado com sucesso!'
      })
    }

    // Caso apenas polling normal de checagem
    return NextResponse.json({
      success: true,
      pago: false,
      status: fatura.status,
      faturaId: fatura.id
    })

  } catch (error: any) {
    console.error('Erro em confirmar-status:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
