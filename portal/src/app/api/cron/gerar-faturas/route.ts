import { NextResponse } from 'next/server'
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
    const dispararWhatsapp = url.searchParams.get('disparar_whatsapp') === 'true'
    const rotinaDia01 = url.searchParams.get('rotina_dia_01') === 'true'
    const baseUrl = extrairBaseUrl(request)

    if (rotinaDia01) {
      const resp = await executarRotinaPrimeiroDiaDoMes({ forcar: true, baseUrl })
      return NextResponse.json({
        success: true,
        message: resp.motivo,
        result: resp.resultado
      })
    }

    const result = await gerarFaturasMensalistas({
      competencia,
      dispararWhatsapp,
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

export async function POST(request: Request) {
  try {
    let body: any = {}
    try {
      body = await request.json()
    } catch {
      // body vazio permitido
    }

    const { competencia, disparar_whatsapp, rotina_dia_01 } = body
    const baseUrl = extrairBaseUrl(request)

    if (rotina_dia_01) {
      const resp = await executarRotinaPrimeiroDiaDoMes({ forcar: true, baseUrl })
      return NextResponse.json({
        success: true,
        message: resp.motivo,
        result: resp.resultado
      })
    }

    const result = await gerarFaturasMensalistas({
      competencia,
      dispararWhatsapp: Boolean(disparar_whatsapp),
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
