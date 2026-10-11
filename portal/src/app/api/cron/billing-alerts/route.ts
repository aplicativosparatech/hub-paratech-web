import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { sendWhatsAppMessage } from '@/utils/whatsapp'
import { calculateEffectiveDates } from '@/utils/businessDays'

export async function GET(request: Request) {
  // Segurança Básica: Em produção, checar cabeçalhos de autenticação do Vercel Cron.
  /*
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }
  */

  const supabase = createAdminClient()
  const hoje = new Date()
  // Zera a hora para fazer comparação apenas por dia
  hoje.setHours(0, 0, 0, 0)

  try {
    // 1. Busca todas as Faturas que não estão Pagas
    const { data: faturas, error: faturaError } = await supabase
      .from('faturas')
      .select(`
        id, valor, data_vencimento, status,
        clientes ( id, razao_social, nome_fantasia, whatsapp )
      `)
      .neq('status', 'paga')

    if (faturaError) throw faturaError

    // 2. Busca a API de WhatsApp Ativa
    const { data: wppApis } = await supabase
      .from('integracoes')
      .select('*')
      .eq('tipo', 'whatsapp')
      .eq('is_ativo', true)
      .single()
    
    if (!wppApis) {
      return NextResponse.json({ message: 'Nenhuma API de WhatsApp ativa encontrada. Abortando alertas.' })
    }

    const disparosRealizados = []

    // 3. Processa cada fatura de acordo com a Régua de Cobrança
    for (const fatura of faturas || []) {
      const cliente: any = Array.isArray(fatura.clientes) ? fatura.clientes[0] : fatura.clientes
      if (!cliente || !cliente.whatsapp) continue // Se o cliente não tem whatsapp cadastrado, ignora.

      // Cálculo de datas considerando Fins de Semana e Feriados Nacionais (Legislação BR)
      const { effectiveDueDate, effectiveBlockDate } = calculateEffectiveDates(fatura.data_vencimento)

      const diferencaDias = Math.floor((effectiveDueDate.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
      const diasParaBloqueio = Math.floor((effectiveBlockDate.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))

      const dataVencimentoFormatada = effectiveDueDate.toLocaleDateString('pt-BR')
      const dataBloqueioFormatada = effectiveBlockDate.toLocaleDateString('pt-BR')
      const valorFormatado = Number(fatura.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

      let mensagem = null

      // REGRA 1: 5 dias antes (Fatura disponível)
      if (diferencaDias === 5) {
        mensagem = `Olá! A fatura ${fatura.id.split('-')[0]} — Sistema Comercial, referente a este mês, da empresa ${cliente.nome_fantasia || cliente.razao_social}, já está disponível.\nValor: ${valorFormatado}\nVencimento: ${dataVencimentoFormatada}\n\nToque no link abaixo para pagar via Pix.\n💳 [LINK AQUI]`
      }
      
      // REGRA 2: No dia do Vencimento Efetivo
      else if (diferencaDias === 0) {
        mensagem = `Olá! Sua fatura do Sistema Comercial vence hoje, ${dataVencimentoFormatada}. Valor: ${valorFormatado}.\n\nPara evitar o bloqueio previsto para ${dataBloqueioFormatada}, regularize o pagamento. Faltam ${diasParaBloqueio} dias.\n💳 [LINK AQUI]`
      }
      
      // REGRA 3: Atrasado, mas antes do bloqueio efetivo
      else if (diferencaDias < 0 && diasParaBloqueio >= 0) {
        if (diasParaBloqueio === 0) {
           // Dia do Bloqueio Efetivo (Próximo dia útil se caiu no fim de semana/feriado)
           mensagem = `Olá. Ainda não identificamos o pagamento da fatura ${fatura.id.split('-')[0]} da empresa ${cliente.nome_fantasia || cliente.razao_social}. Vencimento: ${dataVencimentoFormatada}.\n\n⚠️ O prazo para regularizar o pagamento antes do bloqueio TERMINA HOJE.\nValor: ${valorFormatado}\n\nSe já pagou, entre em contato conosco.\n💳 [LINK AQUI]`
        } else {
           mensagem = `Olá. Ainda não identificamos o pagamento da fatura ${fatura.id.split('-')[0]} da empresa ${cliente.nome_fantasia || cliente.razao_social}. Vencimento: ${dataVencimentoFormatada}.\n\nPara evitar o bloqueio previsto para ${dataBloqueioFormatada}, regularize o pagamento. Faltam ${diasParaBloqueio} dias.\nValor: ${valorFormatado}\n\nSe já pagou, entre em contato conosco.\n💳 [LINK AQUI]`
        }
      }
      
      // REGRA 4: Já passou da data de bloqueio efetiva
      else if (diasParaBloqueio < 0) {
        mensagem = `⚠️ AVISO DE BLOQUEIO ⚠️\nO prazo previsto para bloqueio terminou em ${dataBloqueioFormatada}. Seu sistema pode estar inativo.\n\nRegularize o pagamento de ${valorFormatado} ou entre em contato conosco imediatamente.\n💳 [LINK AQUI]`
      }

      // Se gerou alguma mensagem para as condições acima, envia para a API!
      if (mensagem) {
        try {
          await sendWhatsAppMessage({
            to: cliente.whatsapp,
            message: mensagem
          })

          disparosRealizados.push({
            cliente: cliente.nome_fantasia || cliente.razao_social,
            whatsapp: cliente.whatsapp,
            regra: diferencaDias,
            status: 'enviado'
          })
        } catch (err: any) {
          disparosRealizados.push({
            cliente: cliente.nome_fantasia || cliente.razao_social,
            whatsapp: cliente.whatsapp,
            regra: diferencaDias,
            status: 'falha',
            erro: err.message
          })
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      processadas: faturas?.length || 0,
      disparos: disparosRealizados 
    })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
