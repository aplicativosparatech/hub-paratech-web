import { NextResponse } from 'next/server'
import { sendWhatsAppMessage } from '@/utils/whatsapp'

export async function POST(request: Request) {
  try {
    const { phone, message } = await request.json()

    if (!phone) {
      return NextResponse.json({ error: 'Número de telefone é obrigatório.' }, { status: 400 })
    }

    const testMessage = message || '🚀 *Hub Paratech:* Este é um teste oficial de conexão com o WhatsApp. A integração está funcionando perfeitamente!'

    const result = await sendWhatsAppMessage({
      to: phone,
      message: testMessage
    })

    return NextResponse.json({ success: true, result })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
