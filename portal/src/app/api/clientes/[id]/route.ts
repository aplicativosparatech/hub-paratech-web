import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const body = await request.json()
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('clientes')
      .update(body)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ sucesso: true, cliente: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
