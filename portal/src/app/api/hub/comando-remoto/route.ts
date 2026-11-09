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

    const comandosValidos = [
      'atualizar_hub',
      'reconciliar_gaps',
      'cancelar',
      'desligar_pc',
      'reiniciar_pc',
      'hibernar_pc',
      'cancelar_desligamento',
      'acordar_pc'
    ]

    const isComandoValido = comandosValidos.includes(comando) || comando.startsWith('acordar_pc:')
    if (!isComandoValido) {
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

    let msg = 'Comando processado com sucesso.'
    if (comandoFinal === 'atualizar_hub') {
      msg = 'Comando de atualização enviado! O Hub do cliente atualizará no próximo pulso.'
    } else if (comandoFinal === 'reconciliar_gaps') {
      msg = 'Comando de reconciliação de gaps enviado! O Hub fará a varredura no próximo pulso.'
    } else if (comandoFinal === 'desligar_pc') {
      msg = 'Comando forçado enviado! O computador fechará as aplicações e será desligado com aviso prévio de 60s.'
    } else if (comandoFinal === 'reiniciar_pc') {
      msg = 'Comando forçado enviado! O computador fechará as aplicações e será reiniciado com aviso prévio de 60s.'
    } else if (comandoFinal === 'hibernar_pc') {
      msg = 'Comando enviado! O computador fechará as aplicações e entrará em hibernação profunda.'
    } else if (comandoFinal === 'cancelar_desligamento') {
      msg = 'Comando enviado! A contagem de desligamento/reinício foi cancelada.'
    } else if (comandoFinal?.startsWith('acordar_pc')) {
      msg = 'Comando Wake-on-LAN para acordar o PC enfileirado com sucesso.'
    } else if (comando === 'cancelar') {
      msg = 'Comando remoto pendente cancelado.'
    }

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
