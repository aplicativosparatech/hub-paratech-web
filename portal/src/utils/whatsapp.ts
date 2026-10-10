import { createAdminClient } from '@/utils/supabase/admin'

interface SendMessageOptions {
  to: string; // Número com DDD, ex: 5511999999999
  message: string;
}

export async function sendWhatsAppMessage({ to, message }: SendMessageOptions) {
  const supabase = createAdminClient()

  // 1. Busca a integração ativa do WhatsApp
  const { data: integracao, error } = await supabase
    .from('integracoes')
    .select('*')
    .eq('tipo', 'whatsapp')
    .eq('is_ativo', true)
    .single()

  if (error || !integracao) {
    throw new Error('Nenhuma API de WhatsApp está ativa no sistema.')
  }

  const { provedor, credenciais } = integracao

  // Formata o número: remove caracteres não numéricos
  const cleanNumber = to.replace(/\D/g, '')

  // 2. Disparo conforme o provedor ativo
  if (provedor === 'uazapi') {
    const endpoint = credenciais?.endpoint?.replace(/\/+$/, '')
    const token = credenciais?.token

    if (!endpoint || !token) {
      throw new Error('Uazapi configurada sem URL base ou Token de acesso.')
    }

    // Uazapi padrão (Baileys/Wuzapi) aceita POST /chat/send/text ou /message/sendText
    // Adaptamos para cobrir os padrões mais comuns da Uazapi
    const url = `${endpoint}/chat/send/text`
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'token': token,
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        Phone: cleanNumber,
        Body: message
      })
    })

    if (!response.ok) {
      // Fallback para rota alternativa de Wuzapi se a primeira falhar
      const fallbackUrl = `${endpoint}/message/sendText`
      const fallbackResponse = await fetch(fallbackUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': token,
          'token': token,
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          number: cleanNumber,
          text: message
        })
      })

      if (!fallbackResponse.ok) {
        const errorText = await fallbackResponse.text()
        throw new Error(`Erro ao enviar mensagem via Uazapi: ${errorText}`)
      }
      return await fallbackResponse.json()
    }

    return await response.json()
  } 
  
  else if (provedor === 'evolution') {
    const endpoint = credenciais?.endpoint?.replace(/\/+$/, '')
    const apiKey = credenciais?.api_key
    const instance = credenciais?.instance

    if (!endpoint || !apiKey || !instance) {
      throw new Error('Evolution API configurada sem Endpoint, API Key ou Nome da Instância.')
    }

    const url = `${endpoint}/message/sendText/${instance}`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey
      },
      body: JSON.stringify({
        number: cleanNumber,
        text: message
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Erro ao enviar mensagem via Evolution API: ${errorText}`)
    }

    return await response.json()
  }

  throw new Error(`Provedor desconhecido: ${provedor}`)
}
