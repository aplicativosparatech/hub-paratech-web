import { NextResponse } from 'next/server'
import { parsePfxBuffer } from '@/utils/certParser'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const senha = (formData.get('senha') as string) || ''

    if (!file) {
      return NextResponse.json({ success: false, error: 'Arquivo do certificado não enviado.' }, { status: 400 })
    }

    if (!senha) {
      return NextResponse.json({ success: false, error: 'Senha do certificado não informada.' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const dados = parsePfxBuffer(buffer, senha)

    return NextResponse.json({
      success: true,
      ...dados
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Erro ao processar certificado digital.' },
      { status: 400 }
    )
  }
}
