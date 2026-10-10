import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'

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
      const cliente = fatura.clientes
      if (!cliente || !cliente.whatsapp) continue // Se o cliente não tem whatsapp cadastrado, ignora.

      const vencimento = new Date(fatura.data_vencimento)
      vencimento.setHours(0, 0, 0, 0) // Zera as horas

      const diferencaDias = Math.floor((vencimento.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
      const dataVencimentoFormatada = vencimento.toLocaleDateString('pt-BR')
      const valorFormatado = Number(fatura.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      
      // Data de bloqueio (ex: 5 dias após o vencimento)
      const dataBloqueio = new Date(vencimento)
      dataBloqueio.setDate(dataBloqueio.getDate() + 5)
      const dataBloqueioFormatada = dataBloqueio.toLocaleDateString('pt-BR')

      let mensagem = null

      // REGRA 1: 5 dias antes (Fatura disponível)
      if (diferencaDias === 5) {
        mensagem = `Olá! A fatura ${fatura.id.split('-')[0]} — Sistema Comercial, referente a este mês, da empresa ${cliente.nome_fantasia || cliente.razao_social}, já está disponível.\nValor: ${valorFormatado}\nVencimento: ${dataVencimentoFormatada}\n\nToque no link abaixo para pagar via Pix.\n💳 [LINK AQUI]`
      }
      
      // REGRA 2: No dia do Vencimento
      else if (diferencaDias === 0) {
        const diasFaltantesBloqueio = 5
        mensagem = `Olá! Sua fatura do Sistema Comercial vence hoje, ${dataVencimentoFormatada}. Valor: ${valorFormatado}.\n\nPara evitar o bloqueio previsto para ${dataBloqueioFormatada}, regularize o pagamento. Faltam ${diasFaltantesBloqueio} dias.\n💳 [LINK AQUI]`
      }
      
      // REGRA 3: Atrasado (1 a 5 dias após vencimento)
      else if (diferencaDias < 0 && diferencaDias >= -5) {
        const diasAtraso = Math.abs(diferencaDias)
        const faltamParaBloqueio = 5 - diasAtraso
        
        if (faltamParaBloqueio === 0) {
           // Dia do Bloqueio
           mensagem = `Olá. Ainda não identificamos o pagamento da fatura ${fatura.id.split('-')[0]} da empresa ${cliente.nome_fantasia}. Vencimento original: ${dataVencimentoFormatada}.\n\n⚠️ O prazo para regularizar o pagamento antes do bloqueio TERMINA HOJE.\nValor: ${valorFormatado}\n\nSe já pagou, entre em contato conosco.\n💳 [LINK AQUI]`
        } else {
           mensagem = `Olá. Ainda não identificamos o pagamento da fatura ${fatura.id.split('-')[0]} da empresa ${cliente.nome_fantasia}. Vencimento original: ${dataVencimentoFormatada}.\n\nPara evitar o bloqueio previsto para ${dataBloqueioFormatada}, regularize o pagamento. Faltam ${faltamParaBloqueio} dias.\nValor: ${valorFormatado}\n\nSe já pagou, entre em contato conosco.\n💳 [LINK AQUI]`
        }
      }
      
      // REGRA 4: Já bloqueado (> 5 dias de atraso)
      else if (diferencaDias < -5) {
        mensagem = `⚠️ AVISO DE BLOQUEIO ⚠️\nO prazo previsto para bloqueio terminou em ${dataBloqueioFormatada}. Seu sistema pode estar inativo.\n\nRegularize o pagamento de ${valorFormatado} ou entre em contato conosco imediatamente.\n💳 [LINK AQUI]`
      }

      // Se gerou alguma mensagem para as condições acima, envia para a API!
      if (mensagem) {
        // [FUTURO]: Aqui injetaremos a chamada real Axios/Fetch para a Uazapi ou Evolution API.
        // await enviarWhatsapp(wppApis, cliente.whatsapp, mensagem)
        
        disparosRealizados.push({
          cliente: cliente.nome_fantasia,
          whatsapp: cliente.whatsapp,
          regra: diferencaDias,
          mensagem
        })
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
