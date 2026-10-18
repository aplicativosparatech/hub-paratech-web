import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { api_key, modelo } = body

    if (!api_key || typeof api_key !== 'string' || api_key.trim().length < 10) {
      return NextResponse.json({ 
        success: false, 
        error: 'Chave de API do Google Gemini não informada ou formato inválido.' 
      }, { status: 400 })
    }

    const cleanKey = api_key.trim()
    const modelosParaTestar = [
      modelo || 'gemini-1.5-flash',
      'gemini-2.0-flash',
      'gemini-flash-latest'
    ]

    let ultimoErro = ''
    for (const m of modelosParaTestar) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${cleanKey}`
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Validação de conexão Paratech. Responda apenas "OK".' }] }],
            generationConfig: { maxOutputTokens: 10 }
          })
        })

        if (res.ok) {
          const data = await res.json()
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
          return NextResponse.json({
            success: true,
            modelo: m,
            mensagem: `Token do Google Gemini validado com sucesso no modelo ${m}! Comunicação com a IA da Google funcionando perfeitamente.`,
            resposta: text.trim()
          })
        } else {
          const errData = await res.json().catch(() => ({}))
          ultimoErro = errData?.error?.message || `HTTP ${res.status}`
        }
      } catch (err: any) {
        ultimoErro = err?.message || 'Falha de conexão com a API do Google'
      }
    }

    return NextResponse.json({
      success: false,
      error: `Não foi possível validar o token no Google AI Studio: ${ultimoErro}`
    }, { status: 400 })

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: 'Erro interno ao validar token: ' + (error.message || '')
    }, { status: 500 })
  }
}
