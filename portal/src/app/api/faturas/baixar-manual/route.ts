import { NextResponse } from 'next/server'
import { confirmarPagamentoFatura } from '@/utils/paymentConfirmation'

export async function POST(request: Request) {
  try {
    const { fatura_id } = await request.json()
    if (!fatura_id) {
      return NextResponse.json({ error: 'ID da fatura não informado' }, { status: 400 })
    }

    const resultado = await confirmarPagamentoFatura(fatura_id, {
      provedor: 'manual_simulacao',
      notificarCliente: true,
      notificarAdmin: true
    })

    return NextResponse.json({
      success: true,
      mensagem: 'Pagamento registrado com sucesso!',
      proximaFatura: resultado.proximaFatura
    })

  } catch (error: any) {
    console.error('Erro ao baixar fatura:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
