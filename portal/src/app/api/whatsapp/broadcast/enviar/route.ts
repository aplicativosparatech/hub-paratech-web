import { NextResponse } from 'next/server'
import { sendWhatsAppMessage } from '@/utils/whatsapp'

export async function POST(request: Request) {
  try {
    const { to, message, mediaUrl, destinatarioNome, clienteId } = await request.json()

    if (!to) {
      return NextResponse.json({ error: 'Número de WhatsApp é obrigatório.' }, { status: 400 })
    }

    if (!message && !mediaUrl) {
      return NextResponse.json({ error: 'Informe ao menos o texto ou uma imagem para envio.' }, { status: 400 })
    }

    const cleanNumber = to.replace(/\D/g, '')
    if (cleanNumber.length < 10) {
      return NextResponse.json({ error: 'Número de telefone inválido.' }, { status: 400 })
    }

    const result = await sendWhatsAppMessage({
      to: cleanNumber,
      message: message || '',
      mediaUrl: mediaUrl || undefined,
      remetente: 'Administrador (Disparo em Massa)',
      destinatarioTipo: 'cliente',
      destinatarioNome: destinatarioNome || 'Cliente',
      motivo: 'Comunicado / Envio em Massa',
      modelo: 'Disparo Manual em Massa',
      clienteId: clienteId || undefined,
    })

    return NextResponse.json({ success: true, result })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Falha ao enviar mensagem.' },
      { status: 500 }
    )
  }
}
