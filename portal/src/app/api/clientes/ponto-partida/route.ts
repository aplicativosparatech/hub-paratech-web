import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseAdmin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseKey)

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      cliente_id,
      data_inicio_monitoramento,
      numero_inicial_nfe,
      numero_inicial_nfce,
      numero_inicial_nfse,
      numero_inicial_cte,
      numero_inicial_mdfe
    } = body

    if (!cliente_id) {
      return NextResponse.json({ error: 'ID do cliente é obrigatório.' }, { status: 400 })
    }

    const payload = {
      data_inicio_monitoramento: data_inicio_monitoramento || null,
      numero_inicial_nfe: Math.max(1, parseInt(String(numero_inicial_nfe || 1), 10)),
      numero_inicial_nfce: Math.max(1, parseInt(String(numero_inicial_nfce || 1), 10)),
      numero_inicial_nfse: Math.max(1, parseInt(String(numero_inicial_nfse || 1), 10)),
      numero_inicial_cte: Math.max(1, parseInt(String(numero_inicial_cte || 1), 10)),
      numero_inicial_mdfe: Math.max(1, parseInt(String(numero_inicial_mdfe || 1), 10))
    }

    const { data, error } = await supabaseAdmin
      .from('clientes')
      .update(payload)
      .eq('id', cliente_id)
      .select('id, razao_social, data_inicio_monitoramento, numero_inicial_nfe, numero_inicial_nfce, numero_inicial_nfse, numero_inicial_cte, numero_inicial_mdfe')
      .single()

    if (error) {
      return NextResponse.json({ error: 'Erro ao atualizar ponto de partida fiscal: ' + error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Ponto de partida fiscal atualizado com sucesso!',
      cliente: data
    })
  } catch (err: any) {
    return NextResponse.json({ error: 'Erro interno: ' + (err.message || '') }, { status: 500 })
  }
}
