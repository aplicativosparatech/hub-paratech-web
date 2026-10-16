import { NextResponse } from 'next/server'
import { executarConsultaDfeCompleta } from '@/utils/sefazDfeService'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { cliente_id, competencia, ao_vivo } = body

    if (!cliente_id) {
      return NextResponse.json({ error: 'Parâmetro cliente_id é obrigatório.' }, { status: 400 })
    }

    const comp = competencia || new Date().toISOString().substring(0, 7) // 'YYYY-MM'

    const resultado = await executarConsultaDfeCompleta({
      cliente_id,
      competencia: comp,
      consultarSefazAoVivo: Boolean(ao_vivo)
    })

    return NextResponse.json(resultado)
  } catch (err: any) {
    console.error('Erro na rota de consulta DF-e:', err)
    return NextResponse.json({
      success: false,
      error: 'Falha ao processar consulta de Distribuição de DF-e: ' + (err.message || '')
    }, { status: 500 })
  }
}
