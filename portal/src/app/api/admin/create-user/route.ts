import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'

export async function POST(request: Request) {
  try {
    const { email, password, role, entity_id } = await request.json()
    if (!email || !password || !role || !entity_id) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 })
    }

    const supabaseAdmin = createAdminClient()

    // 1. Verificar se usuário já existe pelo e-mail
    const { data: existingList } = await supabaseAdmin.auth.admin.listUsers()
    const existing = existingList?.users?.find(u => u.email === email)

    let userId: string

    if (existing) {
      // Usuário já existe -> apenas atualiza a senha
      userId = existing.id
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, { password })
      if (updateError) return NextResponse.json({ error: 'Erro ao atualizar senha: ' + updateError.message }, { status: 400 })
    } else {
      // Criar novo usuário
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true
      })
      if (authError) return NextResponse.json({ error: 'Erro ao criar usuário: ' + authError.message }, { status: 400 })
      userId = authData.user.id
    }

    // 2. Upsert do role (garante que não cria duplicado)
    const rolePayload: any = { user_id: userId, role }
    if (role === 'cliente') rolePayload.cliente_id = entity_id
    else if (role === 'contabilidade') rolePayload.contabilidade_id = entity_id

    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .upsert([rolePayload], { onConflict: 'user_id' })

    if (roleError) {
      return NextResponse.json({ error: 'Erro no role: ' + roleError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, userId })

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 })
  }
}
