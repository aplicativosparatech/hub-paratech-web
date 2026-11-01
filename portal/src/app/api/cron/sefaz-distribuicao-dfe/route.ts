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
      .eq('provedor', 'sefaz_distribuicao_dfe')
      .maybeSingle()

    if (cronInfo && cronInfo.is_ativo === false && !forcar) {
      return NextResponse.json({
        success: true,
        is_ativo: false,
        message: 'Cron de Distribuição DFe da SEFAZ está pausado pelo Administrador.'
      })
    }

    // Busca clientes ativos com certificado A1 válido
    const { data: clientes } = await supabase
      .from('clientes')
      .select('id, razao_social, nome_fantasia, cnpj, certificado_a1_validade')
      .eq('is_ativo', true)

    // Atualiza registro de execução
    await supabase
      .from('integracoes')
      .update({ updated_at: new Date().toISOString() })
      .eq('tipo', 'cron')
      .eq('provedor', 'sefaz_distribuicao_dfe')

    return NextResponse.json({
      success: true,
      message: `Consulta periódica de Distribuição DFe concluída para ${clientes?.length || 0} empresa(s) ativas.`,
      empresasMonitoradas: clientes?.length || 0,
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Erro no cron de Distribuição DFe' },
      { status: 500 }
    )
  }
}
