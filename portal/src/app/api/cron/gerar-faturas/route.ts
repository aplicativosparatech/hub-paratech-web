import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { gerarFaturasMensalistas, executarRotinaPrimeiroDiaDoMes } from '@/utils/billing'

function extrairBaseUrl(request: Request) {
  try {
    const url = new URL(request.url)
    return `${url.protocol}//${url.host}`
  } catch {
    return process.env.NEXT_PUBLIC_APP_URL || 'https://hub.paratechsolucoes.com.br'
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const competencia = url.searchParams.get('competencia') || undefined
    const dispararWhatsappParam = url.searchParams.get('disparar_whatsapp') === 'true'
    const rotinaDia01 = url.searchParams.get('rotina_dia_01') === 'true'
    const forcar = url.searchParams.get('forcar') === 'true'
    const baseUrl = extrairBaseUrl(request)

    const supabase = createAdminClient()

    // 1. Verifica se o Cron de Geração de Faturas está ativo no sistema
    const { data: cronGeraFatura } = await supabase
      .from('integracoes')
      .select('is_ativo')
      .eq('tipo', 'cron')
      .eq('provedor', 'gerar_faturas')
      .maybeSingle()

    const isCronFaturasAtivo = cronGeraFatura ? cronGeraFatura.is_ativo : true
    if (!isCronFaturasAtivo && !forcar) {
      return NextResponse.json({
        success: true,
        cron_ativo: false,
        message: 'Rotina de geração de faturas via Cron está pausada pelo Administrador.',
        result: {
          totalClientesAtivos: 0,
          faturasCriadas: 0,
          faturasAtualizadas: 0,
          faturasIgnoradas: 0,
          mensagensEnviadas: 0,
          competencia: '',
          mesAnteriorReferencia: '',
          detalhes: []
        }
      })
    }

    // 2. O toggle de WhatsApp bloqueia APENAS o disparo de mensagens, NUNCA a criação das faturas
    const { data: configGeral } = await supabase
      .from('configuracoes_portal_geral')
      .select('cron_whatsapp_ativo')
      .eq('id', 1)
      .maybeSingle()

    const isWhatsappAtivo = configGeral ? configGeral.cron_whatsapp_ativo !== false : true
    const deveDispararWpp = dispararWhatsappParam && isWhatsappAtivo

    if (rotinaDia01) {
      const resp = await executarRotinaPrimeiroDiaDoMes({ forcar, baseUrl })
      return NextResponse.json({
        success: true,
        message: resp.motivo,
        result: resp.resultado
      })
    }

    const result = await gerarFaturasMensalistas({
      competencia,
      dispararWhatsapp: deveDispararWpp,
      forcarWhatsapp: forcar,
      baseUrl
    })

    // Registra último disparo com sucesso no cron de gerar faturas
    try {
      await supabase
        .from('integracoes')
        .update({
          updated_at: new Date().toISOString()
        })
        .eq('tipo', 'cron')
        .eq('provedor', 'gerar_faturas')
    } catch (_) {}

    return NextResponse.json({
      success: true,
      message: `Processamento concluído para competência ${result.competencia}. ${result.faturasCriadas} nova(s) fatura(s) gerada(s). ${result.mensagensEnviadas} WhatsApp(s) disparado(s).`,
      result
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Erro ao gerar faturas' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    let body: any = {}
    try {
      body = await request.json()
    } catch {
      // body vazio permitido
    }

    const { competencia, disparar_whatsapp, rotina_dia_01, manual, forcar } = body
    const isManualOuForcado = manual === true || forcar === true
    const baseUrl = extrairBaseUrl(request)
    const supabase = createAdminClient()

    // Se for acionamento pelo cron e estiver desligado, bloqueia
    if (!isManualOuForcado) {
      const { data: cronGeraFatura } = await supabase
        .from('integracoes')
        .select('is_ativo')
        .eq('tipo', 'cron')
        .eq('provedor', 'gerar_faturas')
        .maybeSingle()

      if (cronGeraFatura && cronGeraFatura.is_ativo === false) {
        return NextResponse.json({
          success: true,
          cron_ativo: false,
          message: 'Rotina de geração de faturas via Cron está pausada pelo Administrador.',
          result: {
            totalClientesAtivos: 0,
            faturasCriadas: 0,
            faturasAtualizadas: 0,
            faturasIgnoradas: 0,
            mensagensEnviadas: 0,
            competencia: '',
            mesAnteriorReferencia: '',
            detalhes: []
          }
        })
      }
    }

    // Verifica estado do WhatsApp
    const { data: configGeral } = await supabase
      .from('configuracoes_portal_geral')
      .select('cron_whatsapp_ativo')
      .eq('id', 1)
      .maybeSingle()

    const isWhatsappAtivo = configGeral ? configGeral.cron_whatsapp_ativo !== false : true
    const deveDispararWpp = isManualOuForcado ? Boolean(disparar_whatsapp) : (Boolean(disparar_whatsapp) && isWhatsappAtivo)

    if (rotina_dia_01) {
      const resp = await executarRotinaPrimeiroDiaDoMes({ forcar: isManualOuForcado, baseUrl })
      return NextResponse.json({
        success: true,
        message: resp.motivo,
        result: resp.resultado
      })
    }

    const result = await gerarFaturasMensalistas({
      competencia,
      dispararWhatsapp: deveDispararWpp,
      forcarWhatsapp: isManualOuForcado,
      baseUrl
    })

    return NextResponse.json({
      success: true,
      message: `Processamento concluído para competência ${result.competencia}. ${result.faturasCriadas} nova(s) fatura(s) gerada(s). ${result.mensagensEnviadas} WhatsApp(s) disparado(s).`,
      result
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Erro ao gerar faturas' },
      { status: 500 }
    )
  }
}
