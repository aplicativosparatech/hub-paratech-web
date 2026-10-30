import { createAdminClient } from '@/utils/supabase/admin'

export interface SendWhatsAppMessageOptions {
  to: string; // Número com DDD, ex: 5511999999999
  message: string;
  remetente?: string; // ex: 'Robô Automático (Cron)', 'Sistema (Webhook)', 'Administrador (Manual)'
  destinatarioTipo?: 'cliente' | 'contabilidade' | 'admin' | 'outro';
  destinatarioNome?: string;
  motivo?: string;
  modelo?: string;
  clienteId?: string;
  contabilidadeId?: string;
  faturaId?: string;
}

async function saveWhatsAppLog(supabase: any, logData: {
  remetente?: string;
  destinatarioTipo?: string;
  destinatarioNome?: string;
  destinatarioNumero: string;
  motivo?: string;
  modelo?: string;
  mensagem: string;
  provedor?: string;
  status: 'sucesso' | 'falha';
  erro?: string;
  respostaApi?: any;
  clienteId?: string;
  contabilidadeId?: string;
  faturaId?: string;
}) {
  try {
    await supabase.from('whatsapp_logs').insert({
      remetente: logData.remetente || 'Robô Automático (Cron)',
      destinatario_tipo: logData.destinatarioTipo || 'cliente',
      destinatario_nome: logData.destinatarioNome || null,
      destinatario_numero: logData.destinatarioNumero,
      motivo: logData.motivo || 'Disparo Avulso',
      modelo: logData.modelo || 'Mensagem Direta',
      mensagem: logData.mensagem,
      provedor: logData.provedor || null,
      status: logData.status,
      erro: logData.erro || null,
      resposta_api: logData.respostaApi || null,
      cliente_id: logData.clienteId || null,
      contabilidade_id: logData.contabilidadeId || null,
      fatura_id: logData.faturaId || null,
    })
  } catch (logErr) {
    console.error('Aviso: Falha ao salvar log de WhatsApp no banco:', logErr)
  }
}

export async function sendWhatsAppMessage({
  to,
  message,
  remetente,
  destinatarioTipo = 'cliente',
  destinatarioNome,
  motivo,
  modelo,
  clienteId,
  contabilidadeId,
  faturaId,
}: SendWhatsAppMessageOptions) {
  const supabase = createAdminClient()
  const cleanNumber = to.replace(/\D/g, '')

  // 1. Busca a integração ativa do WhatsApp
  const { data: integracao, error } = await supabase
    .from('integracoes')
    .select('*')
    .eq('tipo', 'whatsapp')
    .eq('is_ativo', true)
    .single()

  if (error || !integracao) {
    const errMsg = 'Nenhuma API de WhatsApp está ativa no sistema.'
    await saveWhatsAppLog(supabase, {
      remetente,
      destinatarioTipo,
      destinatarioNome,
      destinatarioNumero: cleanNumber || to,
      motivo,
      modelo,
      mensagem: message,
      status: 'falha',
      erro: errMsg,
      clienteId,
      contabilidadeId,
      faturaId,
    })
    throw new Error(errMsg)
  }

  const { provedor, credenciais } = integracao

  // 2. Disparo conforme o provedor ativo
  if (provedor === 'uazapi') {
    const endpoint = credenciais?.endpoint?.replace(/\/+$/, '')
    const token = credenciais?.token

    if (!endpoint || !token) {
      const errMsg = 'Uazapi configurada sem URL base ou Token de acesso.'
      await saveWhatsAppLog(supabase, {
        remetente,
        destinatarioTipo,
        destinatarioNome,
        destinatarioNumero: cleanNumber,
        motivo,
        modelo,
        mensagem: message,
        provedor,
        status: 'falha',
        erro: errMsg,
        clienteId,
        contabilidadeId,
        faturaId,
      })
      throw new Error(errMsg)
    }

    const primaryUrl = `${endpoint}/send/text`
    
    try {
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
        const responseData = await response.json()
        await saveWhatsAppLog(supabase, {
          remetente,
          destinatarioTipo,
          destinatarioNome,
          destinatarioNumero: cleanNumber,
          motivo,
          modelo,
          mensagem: message,
          provedor,
          status: 'sucesso',
          respostaApi: responseData,
          clienteId,
          contabilidadeId,
          faturaId,
        })
        return responseData
      }

      // Se 404 ou 405 na rota principal, tenta fallbacks legados
      if (response.status === 404 || response.status === 405) {
        // Fallback 1: Wuzapi original /chat/send/text
        try {
          const fallbackResp1 = await fetch(`${endpoint}/chat/send/text`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'token': token,
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ Phone: cleanNumber, Body: message })
          })
          if (fallbackResp1.ok) {
            const data1 = await fallbackResp1.json()
            await saveWhatsAppLog(supabase, {
              remetente,
              destinatarioTipo,
              destinatarioNome,
              destinatarioNumero: cleanNumber,
              motivo,
              modelo,
              mensagem: message,
              provedor,
              status: 'sucesso',
              respostaApi: data1,
              clienteId,
              contabilidadeId,
              faturaId,
            })
            return data1
          }
        } catch (_) {}

        // Fallback 2: /message/send-text
        try {
          const fallbackResp2 = await fetch(`${endpoint}/message/send-text`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'token': token,
              'apikey': token,
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ number: cleanNumber, text: message })
          })
          if (fallbackResp2.ok) {
            const data2 = await fallbackResp2.json()
            await saveWhatsAppLog(supabase, {
              remetente,
              destinatarioTipo,
              destinatarioNome,
              destinatarioNumero: cleanNumber,
              motivo,
              modelo,
              mensagem: message,
              provedor,
              status: 'sucesso',
              respostaApi: data2,
              clienteId,
              contabilidadeId,
              faturaId,
            })
            return data2
          }
        } catch (_) {}
      }

      const errorText = await response.text()
      const fullError = `Erro ao enviar mensagem via Uazapi: ${errorText}`
      await saveWhatsAppLog(supabase, {
        remetente,
        destinatarioTipo,
        destinatarioNome,
        destinatarioNumero: cleanNumber,
        motivo,
        modelo,
        mensagem: message,
        provedor,
        status: 'falha',
        erro: fullError,
        clienteId,
        contabilidadeId,
        faturaId,
      })
      throw new Error(fullError)
    } catch (err: any) {
      if (!err.message?.startsWith('Erro ao enviar')) {
        await saveWhatsAppLog(supabase, {
          remetente,
          destinatarioTipo,
          destinatarioNome,
          destinatarioNumero: cleanNumber,
          motivo,
          modelo,
          mensagem: message,
          provedor,
          status: 'falha',
          erro: err.message,
          clienteId,
          contabilidadeId,
          faturaId,
        })
      }
      throw err
    }
  } 
  
  else if (provedor === 'evolution') {
    const endpoint = credenciais?.endpoint?.replace(/\/+$/, '')
    const apiKey = credenciais?.api_key
    const instance = credenciais?.instance

    if (!endpoint || !apiKey || !instance) {
      const errMsg = 'Evolution API configurada sem Endpoint, API Key ou Nome da Instância.'
      await saveWhatsAppLog(supabase, {
        remetente,
        destinatarioTipo,
        destinatarioNome,
        destinatarioNumero: cleanNumber,
        motivo,
        modelo,
        mensagem: message,
        provedor,
        status: 'falha',
        erro: errMsg,
        clienteId,
        contabilidadeId,
        faturaId,
      })
      throw new Error(errMsg)
    }

    const url = `${endpoint}/message/sendText/${instance}`

    try {
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
        const fullError = `Erro ao enviar mensagem via Evolution API: ${errorText}`
        await saveWhatsAppLog(supabase, {
          remetente,
          destinatarioTipo,
          destinatarioNome,
          destinatarioNumero: cleanNumber,
          motivo,
          modelo,
          mensagem: message,
          provedor,
          status: 'falha',
          erro: fullError,
          clienteId,
          contabilidadeId,
          faturaId,
        })
        throw new Error(fullError)
      }

      const responseData = await response.json()
      await saveWhatsAppLog(supabase, {
        remetente,
        destinatarioTipo,
        destinatarioNome,
        destinatarioNumero: cleanNumber,
        motivo,
        modelo,
        mensagem: message,
        provedor,
        status: 'sucesso',
        respostaApi: responseData,
        clienteId,
        contabilidadeId,
        faturaId,
      })
      return responseData
    } catch (err: any) {
      if (!err.message?.startsWith('Erro ao enviar')) {
        await saveWhatsAppLog(supabase, {
          remetente,
          destinatarioTipo,
          destinatarioNome,
          destinatarioNumero: cleanNumber,
          motivo,
          modelo,
          mensagem: message,
          provedor,
          status: 'falha',
          erro: err.message,
          clienteId,
          contabilidadeId,
          faturaId,
        })
      }
      throw err
    }
  }

  throw new Error(`Provedor desconhecido: ${provedor}`)
}
