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

    // 1ª Tentativa: Rota oficial e padrão da Uazapi (uazapiGO) é POST /send/text
    // Payload: { number: "5537999786187", text: "mensagem" }
    // Header: token: "<token>"
    const primaryUrl = `${endpoint}/send/text`
    
    const response = await fetch(primaryUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'token': token,
        'apikey': token,
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        number: cleanNumber,
        text: message
      })
    })

    if (response.ok) {
      return await response.json()
    }

    // Se o status for 404 ou 405 na rota padrão, tenta as alternativas legadas de Wuzapi/Baileys
    if (response.status === 404 || response.status === 405) {
      // Fallback 1: Wuzapi original /chat/send/text com Phone / Body
      try {
        const fallbackUrl1 = `${endpoint}/chat/send/text`
        const fallbackResp1 = await fetch(fallbackUrl1, {
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
        if (fallbackResp1.ok) {
          return await fallbackResp1.json()
        }
      } catch (_) {}

      // Fallback 2: /message/send-text ou /message/sendText
      try {
        const fallbackUrl2 = `${endpoint}/message/send-text`
        const fallbackResp2 = await fetch(fallbackUrl2, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'token': token,
            'apikey': token,
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            number: cleanNumber,
            text: message
          })
        })
        if (fallbackResp2.ok) {
          return await fallbackResp2.json()
        }
      } catch (_) {}
    }

    // Se todas falharem, reporta o erro detalhado da rota principal
    const errorText = await response.text()
    throw new Error(`Erro ao enviar mensagem via Uazapi: ${errorText}`)
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
