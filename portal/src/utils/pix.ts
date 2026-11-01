import { createAdminClient } from '@/utils/supabase/admin'
import { calcularEncargosFatura } from '@/utils/billingCharges'
import { limparDocumento } from '@/utils/cnpjAlfanumerico'

export interface GerarPixResult {
  qr_code_payload: string
  qr_code_base64?: string | null
  valor: number
  provedor: string
  modo_simulacao: boolean
  mensagem?: string
}

/**
 * Calcula o CRC16-CCITT (polinômio 0x1021, valor inicial 0xFFFF)
 * exigido pela especificação oficial do Banco Central do Brasil para BR Code.
 */
export function calcularCrc16Bacen(payload: string): string {
  let crc = 0xFFFF
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xFFFF
      } else {
        crc = (crc << 1) & 0xFFFF
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

/**
 * Monta um campo no formato TLV (Tag, Length 2 dígitos, Value).
 */
function formatarCampoEmv(id: string, valor: string): string {
  const len = String(valor.length).padStart(2, '0')
  return `${id}${len}${valor}`
}

/**
 * Remove acentos e caracteres especiais para compatibilidade com o padrão EMV do Bacen.
 */
function sanitizarTextoBacen(texto: string, maxLen: number): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .trim()
    .toUpperCase()
    .substring(0, maxLen)
}

/**
 * Gera payload Pix oficial padrão EMV (BR Code) aceito por todos os bancos brasileiros.
 */
export function gerarPixOficialBacen({
  chavePix,
  beneficiarioNome,
  beneficiarioCidade = 'FOZ DO IGUACU',
  valor,
  txid = '***'
}: {
  chavePix: string
  beneficiarioNome: string
  beneficiarioCidade?: string
  valor: number
  txid?: string
}): string {
  const chaveLimpa = chavePix.trim()
  const sub00 = formatarCampoEmv('00', 'br.gov.bcb.pix')
  const sub01 = formatarCampoEmv('01', chaveLimpa)
  const tag26 = formatarCampoEmv('26', `${sub00}${sub01}`)

  const tag52 = formatarCampoEmv('52', '0000') // Merchant Category Code
  const tag53 = formatarCampoEmv('53', '986')  // Moeda BRL
  const tag54 = formatarCampoEmv('54', valor.toFixed(2)) // Valor com duas casas decimais
  const tag58 = formatarCampoEmv('58', 'BR')   // País

  const nomeSanitizado = sanitizarTextoBacen(beneficiarioNome, 25) || 'PARATECH SISTEMAS'
  const tag59 = formatarCampoEmv('59', nomeSanitizado)

  const cidadeSanitizada = sanitizarTextoBacen(beneficiarioCidade, 15) || 'FOZ DO IGUACU'
  const tag60 = formatarCampoEmv('60', cidadeSanitizada)

  const cleanTxid = (txid || '***').replace(/[^a-zA-Z0-9]/g, '').substring(0, 25) || '***'
  const sub62_05 = formatarCampoEmv('05', cleanTxid)
  const tag62 = formatarCampoEmv('62', sub62_05)

  const payloadSemCrc = `000201${tag26}${tag52}${tag53}${tag54}${tag58}${tag59}${tag60}${tag62}6304`
  const crc16 = calcularCrc16Bacen(payloadSemCrc)

  return `${payloadSemCrc}${crc16}`
}

/**
 * Garante que a fatura possua um QR Code Pix válido e registrado no banco.
 * Reutiliza gateway ativo (Mercado Pago ou InfinitePay com BR Code real) ou gera payload seguro.
 */
export async function obterOuGerarPixFatura(
  faturaId: string, 
  options?: { forcarRegeneracao?: boolean }
): Promise<GerarPixResult> {
  const supabase = createAdminClient()

  // 1. Buscar a Fatura e o Cliente vinculado
  const { data: fatura, error: fatError } = await supabase
    .from('faturas')
    .select(`
      *,
      clientes (
        id, razao_social, nome_fantasia, cnpj, is_ativo, hub_token, 
        email_fiscal, login_email, whatsapp,
        multa_atraso_percentual, juros_mora_mensal_percentual, dias_carencia
      )
    `)
    .eq('id', faturaId)
    .single()

  if (fatError || !fatura) {
    throw new Error(`Fatura ${faturaId} não encontrada.`)
  }

  const cliente: any = Array.isArray(fatura.clientes) ? fatura.clientes[0] : fatura.clientes

  // 2. Buscar Configurações Globais de Juros, Multa e Carência
  const { data: configGeral } = await supabase
    .from('configuracoes_portal_geral')
    .select('global_multa_atraso_percentual, global_juros_mora_mensal_percentual, global_dias_carencia')
    .eq('id', 1)
    .maybeSingle()

  // 3. Calcular encargos por atraso
  const valorBase = Number(fatura.valor_original ?? fatura.valor)
  const encargos = calcularEncargosFatura({
    valorBase,
    dataVencimento: fatura.data_vencimento,
    clienteMulta: cliente?.multa_atraso_percentual,
    clienteJuros: cliente?.juros_mora_mensal_percentual,
    clienteCarencia: cliente?.dias_carencia,
    globalMulta: configGeral?.global_multa_atraso_percentual,
    globalJuros: configGeral?.global_juros_mora_mensal_percentual,
    globalCarencia: configGeral?.global_dias_carencia
  })

  const valorCobrar = encargos.valorTotal

  // Se já possui QR Code gerado, NÃO forçar regeração e NÃO for mock antigo, reutiliza
  const isMockAntigo = !fatura.qr_code_payload || 
    fatura.qr_code_payload.includes('mock-hubparatech') || 
    fatura.provedor_pagamento === 'mock'

  const valorFormatadoEsperado = valorCobrar.toFixed(2)
  const tag54Esperada = `54${String(valorFormatadoEsperado.length).padStart(2, '0')}${valorFormatadoEsperado}`
  const valorMudouNoPayload = fatura.qr_code_payload ? !fatura.qr_code_payload.includes(tag54Esperada) : true

  if (fatura.qr_code_payload && !encargos.emAtraso && !options?.forcarRegeneracao && !isMockAntigo && !valorMudouNoPayload) {
    return {
      qr_code_payload: fatura.qr_code_payload,
      valor: valorCobrar,
      provedor: fatura.provedor_pagamento || 'salvo',
      modo_simulacao: false
    }
  }

  // Se o valor mudou por encargos, atualiza na fatura
  if (encargos.emAtraso && (encargos.valorMulta > 0 || encargos.valorJuros > 0)) {
    await supabase
      .from('faturas')
      .update({
        valor: valorCobrar,
        valor_original: valorBase,
        valor_multa: encargos.valorMulta,
        valor_juros: encargos.valorJuros
      })
      .eq('id', fatura.id)
  }

  // 4. Buscar Gateways Ativos e Integrações unificadas
  const { data: gateways } = await supabase.from('gateways').select('*')
  const { data: integracoes } = await supabase.from('integracoes').select('*').eq('tipo', 'gateway')

  // Identifica configurações ativas tanto de gateways quanto de integracoes
  const mpGw = gateways?.find(g => g.provedor === 'mercadopago' && g.is_ativo && g.api_key)
  const mpInt = integracoes?.find(i => i.provedor === 'mercadopago' && i.is_ativo && i.credenciais?.api_key)
  const mpAccessToken = (mpGw?.api_key || mpInt?.credenciais?.api_key || '').trim()

  const infGw = gateways?.find(g => g.provedor === 'infinitepay')
  const infInt = integracoes?.find(i => i.provedor === 'infinitepay')
  const infAtivo = infGw?.is_ativo || infInt?.is_ativo || false
  const infApiKey = (infGw?.api_key || infInt?.credenciais?.api_key || infGw?.client_secret || infInt?.credenciais?.secret_key || '').trim()
  const infChavePix = (
    infGw?.wallet_id || 
    infInt?.credenciais?.wallet_id || 
    infInt?.credenciais?.chave_pix || 
    infInt?.credenciais?.infinite_tag || 
    ''
  ).trim()

  const cleanDoc = limparDocumento(cliente?.cnpj || '')
  const payerEmail = cliente?.email_fiscal || cliente?.login_email || 'financeiro@hubparatech.com.br'
  const payerName = (cliente?.nome_fantasia || cliente?.razao_social || 'Cliente').substring(0, 40)

  // 5. Integração: MERCADO PAGO (se ativo com Access Token)
  if (mpAccessToken) {
    try {
      const idempotencyKey = `fat_${fatura.id}_v${Math.round(valorCobrar * 100)}_${Math.floor(Date.now() / (1000 * 60 * 10))}`

      const mpBody = {
        transaction_amount: Number(valorCobrar.toFixed(2)),
        description: `Fatura ${fatura.competencia} - ${payerName}`.substring(0, 100),
        payment_method_id: 'pix',
        payer: {
          email: payerEmail.includes('@') ? payerEmail : 'financeiro@hubparatech.com.br',
          first_name: payerName,
          identification: {
            type: cleanDoc.length === 11 ? 'CPF' : 'CNPJ',
            number: cleanDoc.length >= 11 ? cleanDoc : '00000000000'
          }
        },
        external_reference: fatura.id,
        metadata: {
          fatura_id: fatura.id,
          cliente_id: cliente?.id,
          competencia: fatura.competencia
        }
      }

      const mpRes = await fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${mpAccessToken}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': idempotencyKey
        },
        body: JSON.stringify(mpBody)
      })

      const mpData = await mpRes.json()

      if (mpRes.ok && mpData.point_of_interaction?.transaction_data) {
        const qrCode = mpData.point_of_interaction.transaction_data.qr_code
        const qrCodeBase64 = mpData.point_of_interaction.transaction_data.qr_code_base64
        const paymentId = String(mpData.id)

        await supabase
          .from('faturas')
          .update({
            qr_code_payload: qrCode,
            mercadopago_payment_id: paymentId,
            provedor_pagamento: 'mercadopago'
          })
          .eq('id', fatura.id)

        return {
          qr_code_payload: qrCode,
          qr_code_base64: qrCodeBase64 ? `data:image/png;base64,${qrCodeBase64}` : null,
          valor: valorCobrar,
          provedor: 'mercadopago',
          modo_simulacao: false
        }
      }
    } catch (errMp: any) {
      console.error('Exceção ao comunicar com Mercado Pago:', errMp.message)
    }
  }

  // 6. Integração: INFINITEPAY / CHAVE PIX OFICIAL (com BR Code padrão Bacen EMV e CRC16)
  if (infChavePix) {
    const txid = `FAT${fatura.id.replace(/-/g, '').substring(0, 15).toUpperCase()}`
    const qrCodeOficial = gerarPixOficialBacen({
      chavePix: infChavePix,
      beneficiarioNome: 'PARATECH SISTEMAS',
      beneficiarioCidade: 'FOZ DO IGUACU',
      valor: valorCobrar,
      txid
    })

    await supabase
      .from('faturas')
      .update({
        qr_code_payload: qrCodeOficial,
        provedor_pagamento: 'infinitepay'
      })
      .eq('id', fatura.id)

    return {
      qr_code_payload: qrCodeOficial,
      valor: valorCobrar,
      provedor: 'infinitepay',
      modo_simulacao: false
    }
  }

  // 7. MODO SIMULAÇÃO (Fallback caso nenhum gateway ou chave Pix esteja configurada)
  const mockPayload = `00020126580014br.gov.bcb.pix0136mock-hubparatech-${fatura.id}5204000053039865405${valorCobrar.toFixed(2)}5802BR5912HUB PARATECH6009SAO PAULO62070503***6304ABCD`
  await supabase
    .from('faturas')
    .update({ 
      qr_code_payload: mockPayload, 
      provedor_pagamento: 'mock' 
    })
    .eq('id', fatura.id)

  return {
    qr_code_payload: mockPayload,
    valor: valorCobrar,
    provedor: 'mock',
    modo_simulacao: true,
    mensagem: 'Chave Pix não configurada no Hub Paratech. Acesse Configurações > Integrações no Hub e informe sua Chave Pix ou credenciais da InfinitePay.'
  }
}
