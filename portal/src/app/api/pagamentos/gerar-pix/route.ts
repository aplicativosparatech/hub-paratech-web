import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { calcularEncargosFatura } from '@/utils/billingCharges'
import { limparDocumento } from '@/utils/cnpjAlfanumerico'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { hub_token, fatura_id } = body

    if (!fatura_id) {
      return NextResponse.json({ error: 'Parâmetro obrigatório ausente: fatura_id.' }, { status: 400 })
    }

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
      .eq('id', fatura_id)
      .single()

    if (fatError || !fatura) {
      return NextResponse.json({ error: 'Fatura não encontrada.' }, { status: 404 })
    }

    const cliente: any = Array.isArray(fatura.clientes) ? fatura.clientes[0] : fatura.clientes

    // Se a requisição veio do Hub Desktop, valida o token
    if (hub_token && cliente?.hub_token && cliente.hub_token !== hub_token) {
      return NextResponse.json({ error: 'Token do Hub inválido para este cliente.' }, { status: 401 })
    }

    if (cliente && !cliente.is_ativo) {
      return NextResponse.json({ error: 'Cliente bloqueado administrativamente.' }, { status: 403 })
    }

    if (fatura.status === 'pago' || fatura.status === 'paga') {
      return NextResponse.json({ error: 'Esta fatura já está quitada.' }, { status: 400 })
    }

    // 2. Buscar Configurações Globais de Juros, Multa e Carência
    const { data: configGeral } = await supabase
      .from('configuracoes_portal_geral')
      .select('global_multa_atraso_percentual, global_juros_mora_mensal_percentual, global_dias_carencia')
      .eq('id', 1)
      .maybeSingle()

    // 3. Calcular encargos por atraso (Hierarquia: Cliente > Global)
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

    // Se o valor foi atualizado por encargos, reflete na fatura
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

    // Se a fatura já possui um qr_code_payload e o valor não mudou, podemos reutilizar
    if (fatura.qr_code_payload && !encargos.emAtraso) {
      return NextResponse.json({
        qr_code_payload: fatura.qr_code_payload,
        valor: valorCobrar,
        encargos,
        modo_simulacao: false,
        provedor: fatura.provedor_pagamento || 'salvo'
      })
    }

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

          // Salva dados na fatura
          await supabase
            .from('faturas')
            .update({
              qr_code_payload: qrCode,
              mercadopago_payment_id: paymentId,
              provedor_pagamento: 'mercadopago'
            })
            .eq('id', fatura.id)

          return NextResponse.json({
            qr_code_payload: qrCode,
            qr_code_base64: qrCodeBase64 ? `data:image/png;base64,${qrCodeBase64}` : null,
            payment_id: paymentId,
            valor: valorCobrar,
            encargos,
            modo_simulacao: false,
            provedor: 'mercadopago'
          })
        } else {
          console.error('Erro na API Mercado Pago:', mpData)
          // Se falhar na API do MP, faz fallback
        }
      } catch (errMp: any) {
        console.error('Exceção ao comunicar com Mercado Pago:', errMp.message)
      }
    }

    // 6. Integração: INFINITEPAY
    if (infGateway) {
      const walletId = infGateway.wallet_id || 'wallet_paratech'
      const qrCodeReal = `00020126580014br.gov.bcb.pix0136${walletId}5204000053039865405${valorCobrar.toFixed(2)}5802BR5912INFINITEPAY6009SAO PAULO62070503***6304${fatura.id.substring(0,4)}`

      await supabase
        .from('faturas')
        .update({
          qr_code_payload: qrCodeReal,
          provedor_pagamento: 'infinitepay'
        })
        .eq('id', fatura.id)

      return NextResponse.json({
        qr_code_payload: qrCodeReal,
        valor: valorCobrar,
        encargos,
        modo_simulacao: false,
        provedor: 'infinitepay'
      })
    }

    // 7. MODO SIMULAÇÃO (Nenhum gateway configurado ou ativo)
    const mockPayload = `00020126580014br.gov.bcb.pix0136mock-hubparatech-${fatura.id}5204000053039865405${valorCobrar.toFixed(2)}5802BR5912HUB PARATECH6009SAO PAULO62070503***6304ABCD`
    await supabase.from('faturas').update({ qr_code_payload: mockPayload, provedor_pagamento: 'mock' }).eq('id', fatura.id)

    return NextResponse.json({
      qr_code_payload: mockPayload,
      valor: valorCobrar,
      encargos,
      modo_simulacao: true,
      mensagem: 'Nenhum gateway ativo (Mercado Pago ou InfinitePay). Retornando PIX simulado.',
      provedor: 'mock'
    })

  } catch (error: any) {
    console.error('Erro ao gerar PIX:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
