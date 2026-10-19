import { NextResponse } from 'next/server'
import { sendEmail } from '@/utils/email'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, apiKey, remetenteEmail, remetenteNome } = body

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Informe um endereço de e-mail de destino válido.' }, { status: 400 })
    }

    const agora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })

    const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8">
      <title>Teste de Conexão - Hub Paratech</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }
        .container { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
        .header { background: linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%); color: #ffffff; padding: 32px 24px; text-align: center; }
        .header h1 { margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
        .header p { margin: 8px 0 0; font-size: 13px; color: #c7d2fe; }
        .content { padding: 32px 24px; }
        .badge-success { display: inline-flex; align-items: center; background-color: #ecfdf5; border: 1px solid #a7f3d0; color: #047857; font-size: 13px; font-weight: 700; padding: 6px 14px; border-radius: 9999px; margin-bottom: 20px; }
        .info-box { background: #f1f5f9; border-radius: 12px; padding: 18px; margin: 20px 0; border: 1px solid #e2e8f0; }
        .info-box table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .info-box td { padding: 6px 0; }
        .info-box td.label { font-weight: 600; color: #64748b; width: 140px; }
        .info-box td.val { font-weight: 700; color: #0f172a; }
        .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 24px; text-align: center; font-size: 12px; color: #94a3b8; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>HUB PARATECH</h1>
          <p>Automação, Inteligência & Fechamento Fiscal</p>
        </div>
        <div class="content">
          <div class="badge-success">
            ✓ Integração com Resend Ativa & Operacional
          </div>
          <h2 style="font-size: 18px; color: #0f172a; margin: 0 0 12px 0;">Teste de Envio de E-mail Concluído com Sucesso!</h2>
          <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 16px 0;">
            Parabéns! Se você está lendo esta mensagem, significa que as credenciais da API do <strong>Resend</strong> estão configuradas perfeitamente no seu Hub Paratech.
          </p>
          <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 16px 0;">
            A partir de agora, os fechamentos fiscais mensais, relatórios contábeis e alertas aos escritórios contábeis podem ser transmitidos automaticamente para as contabilidades autorizadas.
          </p>

          <div class="info-box">
            <table>
              <tr>
                <td class="label">Provedor:</td>
                <td class="val">Resend API Oficial</td>
              </tr>
              <tr>
                <td class="label">Destinatário:</td>
                <td class="val">${email}</td>
              </tr>
              <tr>
                <td class="label">Data & Hora:</td>
                <td class="val">${agora}</td>
              </tr>
              <tr>
                <td class="label">Remetente:</td>
                <td class="val">${remetenteNome || 'Hub Paratech Fiscal'} (${remetenteEmail || 'onboarding@resend.dev'})</td>
              </tr>
            </table>
          </div>
        </div>
        <div class="footer">
          Mensagem de teste gerada pelo <strong>Hub Paratech</strong> • Paratech Sistemas
        </div>
      </div>
    </body>
    </html>
    `

    const text = `Hub Paratech - Teste de Envio via Resend realizado com sucesso para ${email} em ${agora}.`

    const result = await sendEmail({
      to: email,
      subject: '🚀 Teste de Integração: Resend API Ativa no Hub Paratech',
      html,
      text,
      apiKeyOverride: apiKey,
      fromEmailOverride: remetenteEmail,
      fromNomeOverride: remetenteNome
    })

    return NextResponse.json({
      success: true,
      id: result.id,
      message: `E-mail de teste enviado com sucesso para ${email}!`,
      detalhes: result
    })
  } catch (error: any) {
    console.error('Erro na rota /api/email/test:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Erro inesperado ao disparar teste de e-mail.'
    }, { status: 500 })
  }
}
