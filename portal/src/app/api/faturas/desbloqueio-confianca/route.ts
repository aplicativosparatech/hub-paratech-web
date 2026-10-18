import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'

export async function POST(request: Request) {
  try {
    const { fatura_id } = await request.json()
    if (!fatura_id) {
      return NextResponse.json({ error: 'ID da fatura não informado' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // 1. Busca configurações globais do portal
    const { data: configGeral } = await supabase
      .from('configuracoes_portal_geral')
      .select('limite_desbloqueios_confianca, horas_desbloqueio_confianca, intervalo_horas_entre_desbloqueios')
      .eq('id', 1)
      .maybeSingle()

    const limiteMaximo = Number(configGeral?.limite_desbloqueios_confianca ?? 1)
    const horasDuracao = Number(configGeral?.horas_desbloqueio_confianca ?? 24)
    const intervaloMinimo = Number(configGeral?.intervalo_horas_entre_desbloqueios ?? 24)

    // 2. Busca a fatura
    const { data: fatura, error: fatError } = await supabase
      .from('faturas')
      .select('id, confianca_qtd, desbloqueio_confianca_em, status, clientes(razao_social, nome_fantasia)')
      .eq('id', fatura_id)
      .single()

    if (fatError || !fatura) {
      return NextResponse.json({ error: 'Fatura não encontrada' }, { status: 404 })
    }

    if (fatura.status === 'pago' || fatura.status === 'paga') {
      return NextResponse.json({ error: 'Esta fatura já está quitada' }, { status: 400 })
    }

    const qtdAtual = Number(fatura.confianca_qtd || 0)

    // Verifica limite de vezes permitidas por fatura
    if (qtdAtual >= limiteMaximo) {
      return NextResponse.json({ 
        error: `Limite de desbloqueios em confiança excedido (${qtdAtual} de ${limiteMaximo} permitidos para esta fatura).` 
      }, { status: 400 })
    }

    // Verifica intervalo de tempo entre desbloqueios (se já teve algum anterior)
    if (fatura.desbloqueio_confianca_em && qtdAtual > 0) {
      const dataUltimo = new Date(fatura.desbloqueio_confianca_em).getTime()
      const agora = new Date().getTime()
      const horasDesdeUltimo = (agora - dataUltimo) / (1000 * 60 * 60)

      if (horasDesdeUltimo < horasDuracao) {
        const horasRestantes = Math.ceil(horasDuracao - horasDesdeUltimo)
        return NextResponse.json({ 
          error: `O Hub já está liberado em confiança. Faltam ${horasRestantes}h para expirar a liberação atual.` 
        }, { status: 400 })
      }

      if (horasDesdeUltimo < intervaloMinimo) {
        const horasEspera = Math.ceil(intervaloMinimo - horasDesdeUltimo)
        return NextResponse.json({ 
          error: `Intervalo mínimo entre desbloqueios não atingido. Aguarde ${horasEspera}h para conceder novo desbloqueio.` 
        }, { status: 400 })
      }
    }

    // 3. Aplica o novo desbloqueio em confiança
    const novaQtd = qtdAtual + 1
    const agoraIso = new Date().toISOString()

    const { error: updError } = await supabase
      .from('faturas')
      .update({
        desbloqueio_confianca_em: agoraIso,
        confianca_qtd: novaQtd
      })
      .eq('id', fatura.id)

    if (updError) throw updError

    return NextResponse.json({
      success: true,
      mensagem: `Hub liberado com sucesso por ${horasDuracao} horas! (${novaQtd} de ${limiteMaximo} permitidos)`,
      novaQtd,
      limiteMaximo,
      horasDuracao
    })

  } catch (error: any) {
    console.error('Erro no desbloqueio em confiança:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
