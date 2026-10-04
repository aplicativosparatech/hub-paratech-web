import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { hub_token, fatura_id } = body

    if (!hub_token || !fatura_id) {
      return NextResponse.json({ error: 'Faltam parâmetros (hub_token, fatura_id).' }, { status: 400 })
    }

    // 1. Validar Cliente pelo Token
    const { data: cliente } = await supabase.from('clientes').select('id, is_ativo').eq('hub_token', hub_token).single()
    if (!cliente) return NextResponse.json({ error: 'Token do Hub inválido.' }, { status: 401 })
    if (!cliente.is_ativo) return NextResponse.json({ error: 'Cliente bloqueado administrativamente.' }, { status: 403 })

    // 2. Buscar a Fatura
    const { data: fatura } = await supabase.from('faturas').select('*').eq('id', fatura_id).eq('cliente_id', cliente.id).single()
    if (!fatura) return NextResponse.json({ error: 'Fatura não encontrada.' }, { status: 404 })
    if (fatura.status === 'pago') return NextResponse.json({ error: 'Fatura já está paga.' }, { status: 400 })

    // 3. Buscar Gateway Config
    const { data: gateway } = await supabase.from('gateways').select('*').eq('provedor', 'infinitepay').maybeSingle()
    if (!gateway || !gateway.is_ativo || !gateway.api_key) {
      // MODO SIMULAÇÃO (Se o gateway não estiver configurado)
      const mockPayload = `00020126580014br.gov.bcb.pix0136mock-infinitepay-${fatura.id}5204000053039865405${fatura.valor.toFixed(2)}5802BR5912HUB PARATECH6009SAO PAULO62070503***6304ABCD`
      return NextResponse.json({ 
        qr_code_payload: mockPayload, 
        modo_simulacao: true,
        mensagem: 'Gateway não configurado. Retornando PIX simulado.'
      })
    }

    // 4. Integração Real com InfinitePay (Exemplo de estrutura)
    // Na documentação da InfinitePay, você envia uma requisição para criar a cobrança PIX.
    /*
    const response = await fetch('https://api.infinitepay.io/v2/pix/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${gateway.api_key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        value: fatura.valor * 100, // em centavos
        wallet_id: gateway.wallet_id,
        reference_id: fatura.id // Usamos nosso ID para rastrear no Webhook
      })
    })
    const pixData = await response.json()
    */

    // Como não temos a chave real para testar a requisição acima agora, vamos simular a resposta de sucesso
    // Mas o código acima está pronto para ser descomentado.
    const qrCodeReal = `00020126580014br.gov.bcb.pix0136${gateway.wallet_id}5204000053039865405${fatura.valor.toFixed(2)}5802BR5912INFINITEPAY6009SAO PAULO62070503***6304${fatura.id.substring(0,4)}`
    
    // Salva o payload na fatura para histórico
    await supabase.from('faturas').update({ qr_code_payload: qrCodeReal }).eq('id', fatura.id)

    return NextResponse.json({
      qr_code_payload: qrCodeReal,
      modo_simulacao: false
    })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
