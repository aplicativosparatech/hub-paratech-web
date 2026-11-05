import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'

export async function GET(request: Request) {
  try {
    const supabase = createAdminClient()
    const authHeader = request.headers.get('authorization')
    let userId: string | null = null

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '').trim()
      const { data: { user } } = await supabase.auth.getUser(token)
      if (user) userId = user.id
    }

    let role = 'admin'
    let contabilidadeId: string | null = null
    let clienteId: string | null = null

    if (userId) {
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role, cliente_id, contabilidade_id')
        .eq('user_id', userId)
        .maybeSingle()
      if (roleData) {
        role = roleData.role
        contabilidadeId = roleData.contabilidade_id
        clienteId = roleData.cliente_id
      }
    }

    let query = supabase
      .from('clientes')
      .select('id, razao_social, nome_fantasia, cnpj, politica_atualizacao')
      .order('razao_social', { ascending: true })

    if (role === 'contabilidade' && contabilidadeId) {
      query = query.eq('contabilidade_id', contabilidadeId)
    } else if (role === 'cliente' && clienteId) {
      query = query.eq('id', clienteId)
    }

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ clientes: data || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
