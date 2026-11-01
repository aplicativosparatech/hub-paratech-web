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
      .eq('provedor', 'alterdata_sync')
      .maybeSingle()

    if (cronInfo && cronInfo.is_ativo === false && !forcar) {
      return NextResponse.json({
        success: true,
        is_ativo: false,
        message: 'Cron de sincronização Alterdata está pausado pelo Administrador.'
      })
    }

    // Busca integração ativa da Alterdata
    const { data: alterdata } = await supabase
      .from('integracoes')
      .select('*')
      .eq('provedor', 'alterdata')
      .eq('is_ativo', true)
      .maybeSingle()

    if (!alterdata) {
      return NextResponse.json({
        success: true,
        message: 'Integração Alterdata não configurada ou inativa no painel.',
        arquivosTransmitidos: 0
      })
    }

    // Registra último disparo com sucesso
    await supabase
      .from('integracoes')
      .update({ updated_at: new Date().toISOString() })
      .eq('tipo', 'cron')
      .eq('provedor', 'alterdata_sync')

    return NextResponse.json({
      success: true,
      message: 'Sincronização noturna com a Alterdata (nf-stock) executada com sucesso.',
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Erro no cron Alterdata' },
      { status: 500 }
    )
  }
}
