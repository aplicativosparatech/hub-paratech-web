import { createAdminClient } from '@/utils/supabase/admin'

export interface SendWhatsAppMessageOptions {
  to: string; // Número com DDD, ex: 5511999999999
  message: string;
  mediaUrl?: string; // URL pública da imagem (ex: QR Code ou logo)
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
  mediaUrl,
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

  // Obtém a logo oficial da Paratech (Imagem 2) como cabeçalho de todas as mensagens
  let effectiveMediaUrl = mediaUrl
  if (!effectiveMediaUrl) {
    try {
      const fsMod = require("fs")
      const pathMod = require("path")
      const logoPath = pathMod.join(process.cwd(), "public", "logo-paratech-whatsapp.png")
      if (fsMod.existsSync(logoPath)) {
        const logoBuffer = fsMod.readFileSync(logoPath)
        effectiveMediaUrl = "data:image/png;base64," + logoBuffer.toString("base64")
      } else {
        effectiveMediaUrl = "https://hub-paratech-web.vercel.app/logo-paratech-whatsapp.png"
      }
    } catch (_) {
      effectiveMediaUrl = "https://hub-paratech-web.vercel.app/logo-paratech-whatsapp.png"
    }
  }

  // Garante que o texto da mensagem tenha o cabeçalho oficial da Paratech
  let formattedMessage = message
  if (!formattedMessage.includes("PARATECH") && !formattedMessage.includes("🏢")) {
    formattedMessage = "🏢 *PARATECH SOLUÇÕES & SISTEMAS*\n━━━━━━━━━━━━━━━━━━━━━━━━━\n\n" + formattedMessage
  }

  // 2. Disparo conforme o provedor ativo
  if (provedor === "uazapi") {
    const endpoint = credenciais?.endpoint?.replace(/\/+$/, "")
    const token = credenciais?.token

    if (!endpoint || !token) {
      const errMsg = "Uazapi configurada sem URL base ou Token de acesso."
      await saveWhatsAppLog(supabase, {
        remetente,
        destinatarioTipo,
        destinatarioNome,
        destinatarioNumero: cleanNumber,
        motivo,
        modelo,
        mensagem: formattedMessage,
        provedor,
        status: "falha",
        erro: errMsg,
        clienteId,
        contabilidadeId,
        faturaId,
      })
      throw new Error(errMsg)
    }

    // Se tiver effectiveMediaUrl (Logo Paratech ou QR Code), envia com mídia primeiro
    if (effectiveMediaUrl) {
      try {
        const mediaResp = await fetch(`${endpoint}/send/media`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "token": token,
            "apikey": token,
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({
            number: cleanNumber,
            type: "image",
            url: effectiveMediaUrl,
            caption: formattedMessage
          })
        })
        if (mediaResp.ok) {
          const respData = await mediaResp.json()
          await saveWhatsAppLog(supabase, {
            remetente,
            destinatarioTipo,
            destinatarioNome,
            destinatarioNumero: cleanNumber,
            motivo,
            modelo,
            mensagem: formattedMessage,
            provedor,
            status: "sucesso",
            respostaApi: respData,
            clienteId,
            contabilidadeId,
            faturaId,
          })
          return respData
        }
      } catch (errMedia) {
        console.warn("Falha no envio de mídia Uazapi, caindo para texto:", errMedia)
      }
    }

    const primaryUrl = `${endpoint}/send/text`
    
    try {
      const response = await fetch(primaryUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "token": token,
          "apikey": token,
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          number: cleanNumber,
          text: formattedMessage
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
          mensagem: formattedMessage,
          provedor,
          status: "sucesso",
          respostaApi: responseData,
          clienteId,
          contabilidadeId,
          faturaId,
        })
        return responseData
      }

      // Se 404 ou 405 na rota principal, tenta fallbacks legados
      if (response.status === 404 || response.status === 405) {
        try {
          const fallbackResp1 = await fetch(`${endpoint}/chat/send/text`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "token": token,
              "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ Phone: cleanNumber, Body: formattedMessage })
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
              mensagem: formattedMessage,
              provedor,
              status: "sucesso",
              respostaApi: data1,
              clienteId,
              contabilidadeId,
              faturaId,
            })
            return data1
          }
        } catch (_) {}

        try {
          const fallbackResp2 = await fetch(`${endpoint}/message/send-text`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "token": token,
              "apikey": token,
              "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ number: cleanNumber, text: formattedMessage })
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
              mensagem: formattedMessage,
              provedor,
              status: "sucesso",
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
        mensagem: formattedMessage,
        provedor,
        status: "falha",
        erro: fullError,
        clienteId,
        contabilidadeId,
        faturaId,
      })
      throw new Error(fullError)
    } catch (err: any) {
      if (!err.message?.startsWith("Erro ao enviar")) {
        await saveWhatsAppLog(supabase, {
          remetente,
          destinatarioTipo,
          destinatarioNome,
          destinatarioNumero: cleanNumber,
          motivo,
          modelo,
          mensagem: formattedMessage,
          provedor,
          status: "falha",
          erro: err.message,
          clienteId,
          contabilidadeId,
          faturaId,
        })
      }
      throw err
    }
  } 
  
  else if (provedor === "evolution") {
    const endpoint = credenciais?.endpoint?.replace(/\/+$/, "")
    const apiKey = credenciais?.api_key
    const instance = credenciais?.instance

    if (!endpoint || !apiKey || !instance) {
      const errMsg = "Evolution API configurada sem Endpoint, API Key ou Nome da Instância."
      await saveWhatsAppLog(supabase, {
        remetente,
        destinatarioTipo,
        destinatarioNome,
        destinatarioNumero: cleanNumber,
        motivo,
        modelo,
        mensagem: formattedMessage,
        provedor,
        status: "falha",
        erro: errMsg,
        clienteId,
        contabilidadeId,
        faturaId,
      })
      throw new Error(errMsg)
    }

    // Se tiver effectiveMediaUrl (Logo Paratech ou QR Code), envia com mídia e legenda primeiro
    if (effectiveMediaUrl) {
      try {
        const mediaUrlEndpoint = `${endpoint}/message/sendMedia/${instance}`
        const mediaResp = await fetch(mediaUrlEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": apiKey
          },
          body: JSON.stringify({
            number: cleanNumber,
            mediaMessage: {
              mediatype: "image",
              caption: formattedMessage,
              media: effectiveMediaUrl
            }
          })
        })
        if (mediaResp.ok) {
          const respData = await mediaResp.json()
          await saveWhatsAppLog(supabase, {
            remetente,
            destinatarioTipo,
            destinatarioNome,
            destinatarioNumero: cleanNumber,
            motivo,
            modelo,
            mensagem: formattedMessage,
            provedor,
            status: "sucesso",
            respostaApi: respData,
            clienteId,
            contabilidadeId,
            faturaId,
          })
          return respData
        }
      } catch (errMedia) {
        console.warn("Falha no envio de mídia Evolution API, caindo para texto:", errMedia)
      }
    }

    const url = `${endpoint}/message/sendText/${instance}`

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": apiKey
        },
        body: JSON.stringify({
          number: cleanNumber,
          text: formattedMessage
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
          mensagem: formattedMessage,
          provedor,
          status: "falha",
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
        mensagem: formattedMessage,
        provedor,
        status: "sucesso",
        respostaApi: responseData,
        clienteId,
        contabilidadeId,
        faturaId,
      })
      return responseData
    } catch (err: any) {
      if (!err.message?.startsWith("Erro ao enviar")) {
        await saveWhatsAppLog(supabase, {
          remetente,
          destinatarioTipo,
          destinatarioNome,
          destinatarioNumero: cleanNumber,
          motivo,
          modelo,
          mensagem: formattedMessage,
          provedor,
          status: "falha",
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
