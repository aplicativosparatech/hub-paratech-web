import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const clienteId = searchParams.get('cliente_id')

    if (!clienteId) {
      return NextResponse.json({ error: 'cliente_id é obrigatório.' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('integracoes')
      .select('*')
      .eq('tipo', 'fechamento_agendamento')
      .eq('provedor', clienteId)
      .maybeSingle()

    if (error) {
      console.error('Erro ao buscar configuração de fechamento:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ config: null })
    }

    return NextResponse.json({
      config: {
        is_ativo: Boolean(data.is_ativo),
        dia_mes: data.credenciais?.dia_mes || '5',
        whatsapp: data.credenciais?.whatsapp || '',
        email: data.credenciais?.email || '',
        relatorios: data.credenciais?.relatorios || {}
      }
    })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { cliente_id, is_ativo, dia_mes, whatsapp, email, relatorios } = body

    if (!cliente_id) {
      return NextResponse.json({ error: 'cliente_id é obrigatório.' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Busca se já existe registro de fechamento_agendamento para este cliente
    const { data: existente } = await supabase
      .from('integracoes')
      .select('id')
      .eq('tipo', 'fechamento_agendamento')
      .eq('provedor', cliente_id)
      .maybeSingle()

    const payload = {
      tipo: 'fechamento_agendamento',
      provedor: cliente_id,
      is_ativo: Boolean(is_ativo),
      credenciais: {
        cliente_id,
        dia_mes: String(dia_mes || '5'),
        whatsapp: String(whatsapp || '').replace(/\D/g, ''),
        email: String(email || '').trim(),
        relatorios: relatorios || {},
        updated_at: new Date().toISOString()
      },
      updated_at: new Date().toISOString()
    }

    if (existente?.id) {
      const { error: errUpdate } = await supabase
        .from('integracoes')
        .update(payload)
        .eq('id', existente.id)

      if (errUpdate) throw errUpdate
    } else {
      const { error: errInsert } = await supabase
        .from('integracoes')
        .insert(payload)

      if (errInsert) throw errInsert
    }

    return NextResponse.json({
      success: true,
      message: is_ativo
        ? `Agendamento automático ativado com sucesso para todo dia ${dia_mes} do mês!`
        : 'Agendamento automático desativado com sucesso.'
    })

  } catch (err: any) {
    console.error('Erro ao salvar agendamento de fechamento:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
