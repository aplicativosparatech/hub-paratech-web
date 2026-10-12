import { NextResponse } from 'next/server'
import { gerarFaturasMensalistas } from '@/utils/billing'

export async function GET(request: Request) {
  try {
    const result = await gerarFaturasMensalistas()
    return NextResponse.json({
      success: true,
      message: `Processamento concluído para competência ${result.competencia}. ${result.faturasCriadas} faturas geradas.`,
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
    const result = await gerarFaturasMensalistas()
    return NextResponse.json({
      success: true,
      message: `Processamento concluído para competência ${result.competencia}. ${result.faturasCriadas} faturas geradas.`,
      result
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Erro ao gerar faturas' },
      { status: 500 }
    )
  }
}
