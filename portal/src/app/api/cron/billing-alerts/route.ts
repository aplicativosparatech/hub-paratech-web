import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { sendWhatsAppMessage } from '@/utils/whatsapp'
import { calculateEffectiveDates } from '@/utils/businessDays'
import { gerarFaturasMensalistas } from '@/utils/billing'

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
    // 0. Se for dia 01, garante a geração automática das faturas dos clientes ativos mensalistas
    if (hoje.getDate() === 1) {
      try {
        await gerarFaturasMensalistas(hoje)
      } catch (err) {
        console.error('Erro ao gerar faturas automaticamente no dia 01:', err)
      }
    }

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

    // Modo de contagem configurável na tela de WhatsApp: 'bloqueio_real' (considera próximo dia útil) ou 'bloqueio_nominal' (5 dias corridos da data do vencimento)
    const modoContagem = wppApis?.credenciais?.modo_contagem_bloqueio || 'bloqueio_real'

    // 3. Processa cada fatura de acordo com a Régua de Cobrança
    for (const fatura of faturas || []) {
      const cliente: any = Array.isArray(fatura.clientes) ? fatura.clientes[0] : fatura.clientes
      if (!cliente || !cliente.whatsapp) continue // Se o cliente não tem whatsapp cadastrado, ignora.

      // Cálculo de datas: data do vencimento NUNCA muda!
      const { rawDueDate, targetCountdownDate } = calculateEffectiveDates(fatura.data_vencimento, modoContagem)

      const diferencaDias = Math.floor((rawDueDate.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
      const diasParaBloqueio = Math.floor((targetCountdownDate.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))

      const dataVencimentoFormatada = rawDueDate.toLocaleDateString('pt-BR')
      const dataBloqueioFormatada = targetCountdownDate.toLocaleDateString('pt-BR')
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

    // 4. ALERTA DE VENCIMENTO DO CERTIFICADO DIGITAL A1 (A partir de 45 dias antes)
    // Respeita as permissões definidas pelo Admin em configuracoes_hub (padrão: desativado)
    const { data: clientesComCert } = await supabase
      .from('clientes')
      .select('id, razao_social, nome_fantasia, whatsapp, certificado_validade, contabilidade_id')
      .not('certificado_validade', 'is', null)

    // Busca configurações de todos os clientes
    const { data: todasConfigs } = await supabase
      .from('configuracoes_hub')
      .select('cliente_id, exibir_certificados_contabilidade, exibir_certificados_cliente')

    const configMap = new Map((todasConfigs || []).map(cfg => [cfg.cliente_id, cfg]))

    // Se houver contabilidades com whatsapp, busca dados das contabilidades
    const { data: todasContabs } = await supabase
      .from('contabilidades')
      .select('id, razao_social, whatsapp')
    const contabMap = new Map((todasContabs || []).map(c => [c.id, c]))

    for (const cli of clientesComCert || []) {
      if (!cli.certificado_validade) continue
      const dataValidade = new Date(cli.certificado_validade)
      dataValidade.setHours(0, 0, 0, 0)

      const diasParaVencerCert = Math.floor((dataValidade.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))

      // Se estiver a 45 dias ou menos do vencimento, processa os alertas
      if (diasParaVencerCert <= 45 && diasParaVencerCert >= 0) {
        const dataValidadeFormatada = dataValidade.toLocaleDateString('pt-BR')
        const cliConfig = configMap.get(cli.id)
        
        // 4.1 Envio para o Cliente (Somente se Admin autorizou exibir_certificados_cliente)
        if (cliConfig?.exibir_certificados_cliente && cli.whatsapp) {
          let msgCert = ''
          if (diasParaVencerCert === 0) {
            msgCert = `🚨 ATENÇÃO URGENTE: O Certificado Digital A1 da empresa ${cli.nome_fantasia || cli.razao_social} VENCE HOJE (${dataValidadeFormatada}). A emissão de notas fiscais (NF-e/NFC-e) será interrompida se não for renovado imediatamente.`
          } else {
            msgCert = `🔔 AVISO FISCAL: O Certificado Digital A1 da empresa ${cli.nome_fantasia || cli.razao_social} expira em ${diasParaVencerCert} dias (${dataValidadeFormatada}).\nPor favor, providencie a renovação junto à sua Autoridade Certificadora para evitar paralisações na emissão de notas fiscais.`
          }

          try {
            await sendWhatsAppMessage({
              to: cli.whatsapp,
              message: msgCert
            })
            disparosRealizados.push({
              cliente: cli.nome_fantasia || cli.razao_social,
              destinatario: 'cliente',
              whatsapp: cli.whatsapp,
              tipo: 'certificado_digital',
              diasRestantes: diasParaVencerCert,
              status: 'enviado'
            })
          } catch (err: any) {
            disparosRealizados.push({
              cliente: cli.nome_fantasia || cli.razao_social,
              destinatario: 'cliente',
              whatsapp: cli.whatsapp,
              tipo: 'certificado_digital',
              diasRestantes: diasParaVencerCert,
              status: 'falha',
              erro: err.message
            })
          }
        }

        // 4.2 Envio para a Contabilidade (Somente se Admin autorizou exibir_certificados_contabilidade)
        if (cliConfig?.exibir_certificados_contabilidade && cli.contabilidade_id) {
          const contab = contabMap.get(cli.contabilidade_id)
          if (contab?.whatsapp) {
            const msgContab = `🔔 AVISO PARA CONTABILIDADE: O Certificado Digital A1 do seu cliente ${cli.razao_social} expira em ${diasParaVencerCert} dias (${dataValidadeFormatada}).`
            try {
              await sendWhatsAppMessage({
                to: contab.whatsapp,
                message: msgContab
              })
              disparosRealizados.push({
                cliente: cli.razao_social,
                destinatario: 'contabilidade',
                whatsapp: contab.whatsapp,
                tipo: 'certificado_digital',
                diasRestantes: diasParaVencerCert,
                status: 'enviado'
              })
            } catch (err: any) {
              disparosRealizados.push({
                cliente: cli.razao_social,
                destinatario: 'contabilidade',
                whatsapp: contab.whatsapp,
                tipo: 'certificado_digital',
                diasRestantes: diasParaVencerCert,
                status: 'falha',
                erro: err.message
              })
            }
          }
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
