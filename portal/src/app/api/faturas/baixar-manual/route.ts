import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { gerarProximaFaturaAposPagamento } from '@/utils/billingCharges'

export async function POST(request: Request) {
  try {
    const { fatura_id } = await request.json()
    if (!fatura_id) {
      return NextResponse.json({ error: 'ID da fatura não informado' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // 1. Atualiza a fatura para "pago"
    const { data: fatura, error: updError } = await supabase
      .from('faturas')
      .update({
        status: 'pago',
        data_pagamento: new Date().toISOString(),
        provedor_pagamento: 'manual'
      })
      .eq('id', fatura_id)
      .select('id, cliente_id, competencia')
      .single()

    if (updError) throw updError

    // 2. Aciona regra de antecipação: Gera a próxima fatura no momento do pagamento
    let proximaFatura = null
    try {
      proximaFatura = await gerarProximaFaturaAposPagamento(fatura_id)
    } catch (errAnt: any) {
      console.error('Erro ao gerar próxima fatura após baixa manual:', errAnt.message)
    }

    return NextResponse.json({
      success: true,
      mensagem: 'Pagamento registrado com sucesso!',
      proximaFatura
    })

  } catch (error: any) {
    console.error('Erro ao baixar fatura:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
