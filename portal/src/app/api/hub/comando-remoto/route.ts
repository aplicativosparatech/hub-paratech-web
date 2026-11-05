import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseKey)

export async function POST(request: Request) {
  try {
    const { cliente_id, comando } = await request.json()

    if (!cliente_id || !comando) {
      return NextResponse.json({ error: 'cliente_id e comando são obrigatórios.' }, { status: 400 })
    }

    const comandosValidos = ['atualizar_hub', 'reconciliar_gaps', 'cancelar']
    if (!comandosValidos.includes(comando)) {
      return NextResponse.json({ error: `Comando inválido. Permitidos: ${comandosValidos.join(', ')}` }, { status: 400 })
    }

    const comandoFinal = comando === 'cancelar' ? null : comando

    const { data, error } = await supabase
      .from('configuracoes_hub')
      .update({
        comando_remoto: comandoFinal,
        comando_remoto_em: comandoFinal ? new Date().toISOString() : null
      })
      .eq('cliente_id', cliente_id)
      .select('cliente_id, comando_remoto, comando_remoto_em')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const msg = comandoFinal === 'atualizar_hub'
      ? 'Comando de atualização enviado! O Hub do cliente iniciará o download e atualização no próximo pulso.'
      : comandoFinal === 'reconciliar_gaps'
        ? 'Comando de reconciliação de gaps enviado! O Hub fará a varredura no próximo pulso.'
        : 'Comando remoto cancelado com sucesso.'

    return NextResponse.json({
      success: true,
      message: msg,
      comando: comandoFinal,
      data
    })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
