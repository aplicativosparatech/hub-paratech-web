import { NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { createAdminClient } from '@/utils/supabase/admin'
import { obterOuGerarPixFatura } from '@/utils/pix'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
      return new NextResponse('ID da fatura não fornecido', { status: 400 })
    }

    const supabase = createAdminClient()

    const { data: fatura, error } = await supabase
      .from('faturas')
      .select('id, qr_code_payload, status')
      .eq('id', id)
      .single()

    if (error || !fatura) {
      return new NextResponse('Fatura não encontrada', { status: 404 })
    }

    let payload = fatura.qr_code_payload

    // Se pendente e sem pix válido, gera na hora
    if (!payload || payload.includes('mock-hubparatech')) {
      try {
        const pixRes = await obterOuGerarPixFatura(fatura.id)
        if (pixRes.qr_code_payload) {
          payload = pixRes.qr_code_payload
        }
      } catch (errPix) {
        console.error('Falha ao gerar Pix para QR Code PNG:', errPix)
      }
    }

    if (!payload) {
      return new NextResponse('Payload Pix não disponível', { status: 400 })
    }

    // Gera buffer de imagem PNG de alta resolução
    const pngBuffer = await QRCode.toBuffer(payload, {
      width: 512,
      margin: 2,
      color: {
        dark: '#0f172a', // slate-900 elegante
        light: '#ffffff'
      },
      errorCorrectionLevel: 'M'
    })

    return new NextResponse(new Uint8Array(pngBuffer), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
        'Content-Disposition': `inline; filename="qrcode-pix-${id.split('-')[0]}.png"`
      }
    })
  } catch (err: any) {
    console.error('Erro ao gerar imagem QR Code da fatura:', err)
    return new NextResponse('Erro interno ao gerar QR Code', { status: 500 })
  }
}
