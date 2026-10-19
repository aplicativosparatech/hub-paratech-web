import { createAdminClient } from '@/utils/supabase/admin'

export interface EmailAttachment {
  filename: string;
  content: string; // Base64 encoded string
}

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
  apiKeyOverride?: string;
  fromEmailOverride?: string;
  fromNomeOverride?: string;
}

export interface EmailIntegrationConfig {
  apiKey: string;
  remetenteEmail: string;
  remetenteNome: string;
  isAtivo: boolean;
}

/**
 * Obtém a configuração ativa de envio de e-mails (Resend)
 * Primeiro verifica o banco de dados (tabela integracoes), com fallback para variáveis de ambiente.
 */
export async function getEmailConfig(): Promise<EmailIntegrationConfig> {
  const supabase = createAdminClient()

  const { data: integracao } = await supabase
    .from('integracoes')
    .select('*')
    .eq('provedor', 'resend')
    .maybeSingle()

  const creds = integracao?.credenciais || {}

  const apiKey = (creds.api_key || process.env.RESEND_API_KEY || '').trim()
  const remetenteEmail = (creds.remetente_email || process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev').trim()
  const remetenteNome = (creds.remetente_nome || process.env.RESEND_FROM_NAME || 'Hub Paratech Fiscal').trim()
  const isAtivo = Boolean(integracao?.is_ativo || (apiKey && process.env.RESEND_API_KEY))

  return {
    apiKey,
    remetenteEmail,
    remetenteNome,
    isAtivo
  }
}

/**
 * Dispara e-mail transacional via API oficial do Resend
 */
export async function sendEmail({
  to,
  subject,
  html,
  text,
  attachments,
  apiKeyOverride,
  fromEmailOverride,
  fromNomeOverride
}: SendEmailOptions) {
  const config = await getEmailConfig()

  const apiKey = (apiKeyOverride || config.apiKey || '').trim()
  const fromEmail = (fromEmailOverride || config.remetenteEmail || 'onboarding@resend.dev').trim()
  const fromNome = (fromNomeOverride || config.remetenteNome || 'Hub Paratech Fiscal').trim()

  if (!apiKey) {
    throw new Error('Nenhuma chave de API do Resend configurada. Acesse o menu "Integrações & APIs" > aba "E-mails (Resend)" e salve sua chave.')
  }

  // Prepara lista de destinatários (garante array de strings válidas)
  const toList = (Array.isArray(to) ? to : [to])
    .map(email => email.trim())
    .filter(email => email.includes('@'))

  if (toList.length === 0) {
    throw new Error('Nenhum endereço de e-mail de destinatário válido foi informado.')
  }

  const fromFormatted = fromNome ? `${fromNome} <${fromEmail}>` : fromEmail

  // Payload da API Resend
  const payload: any = {
    from: fromFormatted,
    to: toList,
    subject,
    html
  }

  if (text) {
    payload.text = text
  }

  if (attachments && attachments.length > 0) {
    payload.attachments = attachments.map(att => ({
      filename: att.filename,
      content: att.content
    }))
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })

  const resData = await response.json().catch(() => ({}))

  if (!response.ok) {
    const errorMsg = resData?.message || resData?.error?.message || response.statusText || 'Falha ao enviar e-mail via Resend.'
    throw new Error(`Erro na API do Resend (${response.status}): ${errorMsg}`)
  }

  return {
    success: true,
    id: resData.id,
    from: fromFormatted,
    to: toList
  }
}
