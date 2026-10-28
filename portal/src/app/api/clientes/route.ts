import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'

export async function GET() {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('clientes')
      .select('id, razao_social, nome_fantasia, cnpj, politica_atualizacao')
      .order('razao_social', { ascending: true })

    if (error) throw error
    return NextResponse.json({ clientes: data || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
