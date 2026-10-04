import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

// Rota POST que a InfinitePay vai chamar
export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    // Na InfinitePay, o Webhook de PIX pago geralmente envia algo assim:
    // { "type": "payment.pix.paid", "data": { "reference_id": "ID_DA_Nossa_Fatura", "status": "approved" } }
    
    // Como depende da versão da API deles, vamos pegar o reference_id genérico:
    const reference_id = body?.data?.reference_id || body?.reference_id
    const status = body?.data?.status || body?.status

    if (!reference_id) {
      return NextResponse.json({ error: 'Nenhum reference_id encontrado no webhook.' }, { status: 400 })
    }

    if (status === 'approved' || status === 'paid') {
      // Atualiza a fatura no banco para PAGO
      const { error } = await supabase
        .from('faturas')
        .update({ 
          status: 'pago', 
          data_pagamento: new Date().toISOString() 
        })
        .eq('id', reference_id)

      if (error) {
        console.error('Erro ao atualizar fatura pelo Webhook:', error.message)
        return NextResponse.json({ error: 'Erro interno no banco.' }, { status: 500 })
      }

      return NextResponse.json({ message: 'Pagamento processado e fatura baixada com sucesso!' })
    }

    return NextResponse.json({ message: 'Evento recebido, mas status não é de pagamento aprovado.' })

  } catch (error: any) {
    console.error('Erro no Webhook da InfinitePay:', error.message)
    return NextResponse.json({ error: 'Falha no processamento do webhook.' }, { status: 500 })
  }
}
