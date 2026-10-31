import { createAdminClient } from '@/utils/supabase/admin'
import { calcularEncargosFatura } from '@/utils/billingCharges'
import { limparDocumento } from '@/utils/cnpjAlfanumerico'

export interface GerarPixResult {
  qr_code_payload: string
  qr_code_base64?: string | null
  valor: number
  provedor: string
  modo_simulacao: boolean
}

/**
 * Garante que a fatura possua um QR Code Pix válido e registrado no banco.
 * Reutiliza gateway ativo (Mercado Pago ou InfinitePay) ou gera payload seguro simulado/mock.
 */
export async function obterOuGerarPixFatura(faturaId: string): Promise<GerarPixResult> {
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

  // Se já possui QR Code gerado e não está em atraso com novos juros, reutiliza
  if (fatura.qr_code_payload && !encargos.emAtraso) {
    return {
      qr_code_payload: fatura.qr_code_payload,
      valor: valorCobrar,
      provedor: fatura.provedor_pagamento || 'salvo',
      modo_simulacao: fatura.provedor_pagamento === 'mock'
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

  // 4. Buscar Gateways Ativos
  const { data: gateways } = await supabase
    .from('gateways')
    .select('*')
    .eq('is_ativo', true)

  const mpGateway = gateways?.find(g => g.provedor === 'mercadopago' && g.api_key)
  const infGateway = gateways?.find(g => g.provedor === 'infinitepay' && (g.api_key || g.wallet_id))

  const cleanDoc = limparDocumento(cliente?.cnpj || '')
  const payerEmail = cliente?.email_fiscal || cliente?.login_email || 'financeiro@hubparatech.com.br'
  const payerName = (cliente?.nome_fantasia || cliente?.razao_social || 'Cliente').substring(0, 40)

  // 5. Integração: MERCADO PAGO
  if (mpGateway && mpGateway.api_key) {
    try {
      const mpAccessToken = mpGateway.api_key.trim()
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

  // 6. Integração: INFINITEPAY
  if (infGateway) {
    const walletId = infGateway.wallet_id || 'wallet_paratech'
    const qrCodeReal = `00020126580014br.gov.bcb.pix0136${walletId}5204000053039865405${valorCobrar.toFixed(2)}5802BR5912INFINITEPAY6009SAO PAULO62070503***6304${fatura.id.substring(0, 4)}`

    await supabase
      .from('faturas')
      .update({
        qr_code_payload: qrCodeReal,
        provedor_pagamento: 'infinitepay'
      })
      .eq('id', fatura.id)

    return {
      qr_code_payload: qrCodeReal,
      valor: valorCobrar,
      provedor: 'infinitepay',
      modo_simulacao: false
    }
  }

  // 7. MODO SIMULAÇÃO (Fallback se nenhum gateway configurado)
  const mockPayload = `00020126580014br.gov.bcb.pix0136mock-hubparatech-${fatura.id}5204000053039865405${valorCobrar.toFixed(2)}5802BR5912HUB PARATECH6009SAO PAULO62070503***6304ABCD`
  await supabase.from('faturas').update({ qr_code_payload: mockPayload, provedor_pagamento: 'mock' }).eq('id', fatura.id)

  return {
    qr_code_payload: mockPayload,
    valor: valorCobrar,
    provedor: 'mock',
    modo_simulacao: true
  }
}
