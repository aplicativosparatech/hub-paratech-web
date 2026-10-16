import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseAdmin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseKey)

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { cliente_id, competencia, total_notas, valor_total, dados_notas, observacoes, usuario_responsavel } = body

    if (!cliente_id || !competencia) {
      return NextResponse.json({ error: 'Parâmetros cliente_id e competencia são obrigatórios.' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('dfe_consultas_salvas')
      .insert({
        cliente_id,
        competencia,
        total_notas: total_notas || 0,
        valor_total: valor_total || 0,
        dados_notas: dados_notas || [],
        observacoes: observacoes || null,
        usuario_responsavel: usuario_responsavel || 'Usuário do Portal',
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: 'Erro ao salvar consulta: ' + error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Consulta salva com sucesso no histórico!',
      consulta: data
    })
  } catch (err: any) {
    return NextResponse.json({ error: 'Erro interno ao salvar consulta: ' + (err.message || '') }, { status: 500 })
  }
}
