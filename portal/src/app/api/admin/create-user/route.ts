import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'

export async function POST(request: Request) {
  try {
    const { email, password, role, entity_id } = await request.json()
    const supabaseAdmin = createAdminClient()

    // 1. Criar o usuário no Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true // Não exigir confirmação de e-mail por enquanto
    })

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    const userId = authData.user.id

    // 2. Inserir o papel (role) e atrelar à empresa/contabilidade
    const rolePayload: any = {
      user_id: userId,
      role: role
    }

    if (role === 'cliente') {
      rolePayload.cliente_id = entity_id
    } else if (role === 'contabilidade') {
      rolePayload.contabilidade_id = entity_id
    }

    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert([rolePayload])

    if (roleError) {
      // Rollback opcional: deletar o usuário do Auth caso dê erro no role
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: roleError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, user: authData.user })

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro interno no servidor' }, { status: 500 })
  }
}
