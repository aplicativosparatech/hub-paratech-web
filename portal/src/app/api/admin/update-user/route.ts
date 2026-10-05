import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'

export async function POST(request: Request) {
  try {
    const { email, password, role, entity_id } = await request.json()
    const supabaseAdmin = createAdminClient()

    // Encontrar o user_id deste cliente/contabilidade
    let query = supabaseAdmin.from('user_roles').select('user_id').eq('role', role)
    if (role === 'cliente') query = query.eq('cliente_id', entity_id)
    if (role === 'contabilidade') query = query.eq('contabilidade_id', entity_id)

    const { data: roleData, error: roleError } = await query.single()

    if (roleError || !roleData) {
      // Usuário não existia. Vamos criar agora.
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email, password, email_confirm: true
      })
      if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

      const rolePayload: any = { user_id: authData.user.id, role }
      if (role === 'cliente') rolePayload.cliente_id = entity_id
      else if (role === 'contabilidade') rolePayload.contabilidade_id = entity_id

      await supabaseAdmin.from('user_roles').insert([rolePayload])
      return NextResponse.json({ success: true, user: authData.user })
    }

    // Se já existia, vamos atualizar
    const userId = roleData.user_id
    const updateData: any = {}
    if (email) updateData.email = email
    if (password) updateData.password = password

    const { data: updatedAuth, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, updateData)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, user: updatedAuth.user })

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro interno no servidor' }, { status: 500 })
  }
}
