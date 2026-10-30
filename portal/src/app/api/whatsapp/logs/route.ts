import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'

export async function GET(request: Request) {
  try {
    const supabase = createAdminClient()
    const { searchParams } = new URL(request.url)
    const limit = Math.min(Number(searchParams.get('limit') || 100), 500)
    const tipo = searchParams.get('tipo')
    const status = searchParams.get('status')
    const q = searchParams.get('q')

    let query = supabase
      .from('whatsapp_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (tipo && tipo !== 'todos') {
      query = query.eq('destinatario_tipo', tipo)
    }

    if (status && status !== 'todos') {
      query = query.eq('status', status)
    }

    if (q && q.trim()) {
      const term = `%${q.trim()}%`
      query = query.or(`destinatario_nome.ilike.${term},destinatario_numero.ilike.${term},motivo.ilike.${term},modelo.ilike.${term}`)
    }

    const { data: logs, error } = await query

    if (error) {
      throw error
    }

    // Busca estatísticas rápidas
    const { count: totalGeral } = await supabase
      .from('whatsapp_logs')
      .select('*', { count: 'exact', head: true })

    const { count: totalSucesso } = await supabase
      .from('whatsapp_logs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'sucesso')

    const { count: totalFalha } = await supabase
      .from('whatsapp_logs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'falha')

    // Disparos hoje
    const inicioHoje = new Date()
    inicioHoje.setHours(0, 0, 0, 0)
    const { count: totalHoje } = await supabase
      .from('whatsapp_logs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', inicioHoje.toISOString())

    // Estado do Cron
    const { data: configGeral } = await supabase
      .from('configuracoes_portal_geral')
      .select('cron_whatsapp_ativo')
      .eq('id', 1)
      .maybeSingle()

    return NextResponse.json({
      success: true,
      logs: logs || [],
      stats: {
        total: totalGeral || 0,
        sucesso: totalSucesso || 0,
        falha: totalFalha || 0,
        hoje: totalHoje || 0,
      },
      cron_ativo: configGeral?.cron_whatsapp_ativo ?? true
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = createAdminClient()
    const { cron_ativo } = await request.json()

    if (typeof cron_ativo !== 'boolean') {
      return NextResponse.json({ error: 'Parâmetro cron_ativo inválido.' }, { status: 400 })
    }

    // 1. Atualiza na tabela configuracoes_portal_geral
    await supabase
      .from('configuracoes_portal_geral')
      .update({ cron_whatsapp_ativo: cron_ativo })
      .eq('id', 1)

    // 2. Atualiza também nas credenciais da integração de WhatsApp ativa
    const { data: integracoesWpp } = await supabase
      .from('integracoes')
      .select('id, credenciais')
      .eq('tipo', 'whatsapp')

    for (const item of integracoesWpp || []) {
      const updatedCreds = { ...(item.credenciais || {}), cron_ativo }
      await supabase
        .from('integracoes')
        .update({ credenciais: updatedCreds })
        .eq('id', item.id)
    }

    return NextResponse.json({
      success: true,
      cron_ativo,
      message: cron_ativo
        ? 'Crons e disparos automáticos de WhatsApp ATIVADOS com sucesso.'
        : 'Crons e disparos automáticos de WhatsApp DESATIVADOS com sucesso.'
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
