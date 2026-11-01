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
      .eq('provedor', 'cleanup_logs')
      .maybeSingle()

    if (cronInfo && cronInfo.is_ativo === false && !forcar) {
      return NextResponse.json({
        success: true,
        is_ativo: false,
        message: 'Cron de limpeza de logs está pausado pelo Administrador.'
      })
    }

    // Limpa logs com mais de 90 dias
    const limiteData = new Date()
    limiteData.setDate(limiteData.getDate() - 90)

    try {
      await supabase
        .from('whatsapp_logs')
        .delete()
        .lt('created_at', limiteData.toISOString())
    } catch (_) {}

    try {
      await supabase
        .from('alterdata_sync_logs')
        .delete()
        .lt('created_at', limiteData.toISOString())
    } catch (_) {}

    // Atualiza registro de execução
    await supabase
      .from('integracoes')
      .update({ updated_at: new Date().toISOString() })
      .eq('tipo', 'cron')
      .eq('provedor', 'cleanup_logs')

    return NextResponse.json({
      success: true,
      message: 'Limpeza mensal de logs e otimização de storage executadas com sucesso.',
      limiteData: limiteData.toISOString(),
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Erro no cron de limpeza' },
      { status: 500 }
    )
  }
}
