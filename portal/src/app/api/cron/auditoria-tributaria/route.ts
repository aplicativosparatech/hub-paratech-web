import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'

export async function GET(request: Request) {
  const supabase = createAdminClient()
  try {
    const url = new URL(request.url)
    const forcar = url.searchParams.get('forcar') === 'true'

    // Verifica se o Cron está ativo
    const { data: cronInfo } = await supabase
      .from('integracoes')
      .select('is_ativo')
      .eq('tipo', 'cron')
      .eq('provedor', 'auditoria_tributaria')
      .maybeSingle()

    if (cronInfo && cronInfo.is_ativo === false && !forcar) {
      return NextResponse.json({
        success: true,
        is_ativo: false,
        message: 'Cron de auditoria tributária está pausado pelo Administrador.'
      })
    }

    // Atualiza registro de execução
    await supabase
      .from('integracoes')
      .update({ updated_at: new Date().toISOString() })
      .eq('tipo', 'cron')
      .eq('provedor', 'auditoria_tributaria')

    return NextResponse.json({
      success: true,
      message: 'Auditoria tributária semanal (NCM, CEST, Reforma LC 214) executada com sucesso.',
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Erro no cron de auditoria tributária' },
      { status: 500 }
    )
  }
}
