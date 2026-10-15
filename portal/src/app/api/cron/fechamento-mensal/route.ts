import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { sendWhatsAppMessage } from '@/utils/whatsapp'

function formatCurrency(val: number) {
  return Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export async function GET(request: Request) {
  const supabase = createAdminClient()
  const hoje = new Date()
  const diaHoje = hoje.getDate()

  // Determina a competência a ser fechada (Mês anterior)
  // Ex: se hoje é dia 05/11/2026, a competência de fechamento é 2026-10
  const anoAtual = hoje.getFullYear()
  const mesAtual = hoje.getMonth() // 0-indexed (0 = Jan, 10 = Nov)

  let anoComp = anoAtual
  let mesComp = mesAtual // mês anterior em 1-based (ex: Nov=10, então anterior é 10)
  if (mesComp === 0) {
    mesComp = 12
    anoComp = anoAtual - 1
  }
  const competenciaStr = `${anoComp}-${String(mesComp).padStart(2, '0')}`

  const nomesMeses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ]
  const nomeCompetencia = `${nomesMeses[mesComp - 1]} de ${anoComp} (${String(mesComp).padStart(2, '0')}/${anoComp})`

  try {
    // 1. Busca todos os agendamentos ativos na tabela 'integracoes'
    const { data: agendamentos, error: errAgendamentos } = await supabase
      .from('integracoes')
      .select('*')
      .eq('tipo', 'fechamento_agendamento')
      .eq('is_ativo', true)

    if (errAgendamentos) {
      throw errAgendamentos
    }

    if (!agendamentos || agendamentos.length === 0) {
      return NextResponse.json({
        message: 'Nenhum agendamento de fechamento automático ativo no sistema.',
        dia: diaHoje,
        competencia: competenciaStr
      })
    }

    const disparosRealizados: any[] = []

    // Intervalo de datas da competência
    const inicioMes = new Date(Date.UTC(anoComp, mesComp - 1, 1, 0, 0, 0)).toISOString()
    const fimMes = new Date(Date.UTC(anoComp, mesComp, 0, 23, 59, 59, 999)).toISOString()

    for (const ag of agendamentos) {
      const cred = ag.credenciais || {}
      const diaAgendado = Number(cred.dia_mes || 5)

      // Se o dia agendado não for o dia de hoje, ignora
      if (diaAgendado !== diaHoje) continue

      const clienteId = ag.provedor || cred.cliente_id
      if (!clienteId) continue

      // Busca dados cadastrais do cliente
      const { data: cliente } = await supabase
        .from('clientes')
        .select('id, razao_social, nome_fantasia, cnpj, whatsapp, email_fiscal')
        .eq('id', clienteId)
        .single()

      if (!cliente) continue

      const nomeEmpresa = cliente.nome_fantasia || cliente.razao_social
      const whatsappDestino = (cred.whatsapp || cliente.whatsapp || '').replace(/\D/g, '')

      if (!whatsappDestino) {
        disparosRealizados.push({
          cliente: nomeEmpresa,
          status: 'ignorado',
          motivo: 'Nenhum número de WhatsApp configurado para envio.'
        })
        continue
      }

      let phoneWithDdi = whatsappDestino
      if (!phoneWithDdi.startsWith('55') && (phoneWithDdi.length === 10 || phoneWithDdi.length === 11)) {
        phoneWithDdi = '55' + phoneWithDdi
      }

      // Busca dados das notas fiscais da competência
      const [resNfce, resNfeSaidas, resNfeEntradas] = await Promise.all([
        supabase.from('nfce_saidas').select('id, valor').eq('cliente_id', clienteId).gte('data_emissao', inicioMes).lte('data_emissao', fimMes),
        supabase.from('nfe_saidas').select('id, valor').eq('cliente_id', clienteId).gte('data_emissao', inicioMes).lte('data_emissao', fimMes),
        supabase.from('nfe_entradas').select('id, valor').eq('cliente_id', clienteId).gte('data_emissao', inicioMes).lte('data_emissao', fimMes)
      ])

      const totalNfce = resNfce.data?.length || 0
      const valorNfce = (resNfce.data || []).reduce((acc: number, n: any) => acc + Number(n.valor || 0), 0)

      const totalNfeSaidas = resNfeSaidas.data?.length || 0
      const valorNfeSaidas = (resNfeSaidas.data || []).reduce((acc: number, n: any) => acc + Number(n.valor || 0), 0)

      const totalNfeEntradas = resNfeEntradas.data?.length || 0
      const valorNfeEntradas = (resNfeEntradas.data || []).reduce((acc: number, n: any) => acc + Number(n.valor || 0), 0)

      const totalGeralXmls = totalNfce + totalNfeSaidas + totalNfeEntradas
      const valorTotalMov = valorNfce + valorNfeSaidas + valorNfeEntradas

      // Monta linhas de resumo
      const linhas: string[] = []
      if (totalNfeEntradas > 0) {
        linhas.push(`📥 *NF-e Compras (Entradas):* ${totalNfeEntradas} notas (${formatCurrency(valorNfeEntradas)})`)
      }
      if (totalNfeSaidas > 0) {
        linhas.push(`📤 *NF-e Vendas (Saídas Mod 55):* ${totalNfeSaidas} notas (${formatCurrency(valorNfeSaidas)})`)
      }
      if (totalNfce > 0) {
        linhas.push(`📤 *NFC-e Consumidor (Mod 65):* ${totalNfce} notas (${formatCurrency(valorNfce)})`)
      }

      const demonstrativo = linhas.length > 0 ? linhas.join('\n') : '• Nenhum documento movimentado nesta competência.'

      // Mensagem oficial de envio automático
      const msg = [
        `🤖 *FECHAMENTO FISCAL MENSAL AUTOMÁTICO*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━`,
        `🏢 *Empresa:* ${nomeEmpresa}`,
        cliente.cnpj ? `📄 *CNPJ:* ${cliente.cnpj}` : null,
        `📅 *Competência:* ${nomeCompetencia}`,
        `━━━━━━━━━━━━━━━━━━━━━━━━`,
        ``,
        `📊 *Apuração Consolidada da Competência:*`,
        demonstrativo,
        ``,
        `📁 *Pacote Fiscal do Mês:*`,
        `• *Total de XMLs Auditados:* ${totalGeralXmls}`,
        `• *Total Movimentado:* ${formatCurrency(valorTotalMov)}`,
        ``,
        `✅ *Automação Ativa:* Pacote fiscal consolidado automaticamente pelo HUB PARATECH todo dia ${diaAgendado}. Acesse o portal para baixar o pacote ZIP completo se desejar.`,
        ``,
        `━━━━━━━━━━━━━━━━━━━━━━━━`,
        `_HUB PARATECH - Automação & Inteligência Fiscal_`
      ].filter(Boolean).join('\n')

      try {
        await sendWhatsAppMessage({
          to: phoneWithDdi,
          message: msg
        })

        disparosRealizados.push({
          cliente: nomeEmpresa,
          whatsapp: phoneWithDdi,
          status: 'enviado',
          xmls: totalGeralXmls,
          valor: valorTotalMov
        })
      } catch (errDisparo: any) {
        disparosRealizados.push({
          cliente: nomeEmpresa,
          whatsapp: phoneWithDdi,
          status: 'falha',
          erro: errDisparo.message
        })
      }
    }

    return NextResponse.json({
      success: true,
      dia: diaHoje,
      competencia: competenciaStr,
      agendamentos_processados: disparosRealizados.length,
      disparos: disparosRealizados
    })

  } catch (error: any) {
    console.error('Erro no cron de fechamento mensal:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
