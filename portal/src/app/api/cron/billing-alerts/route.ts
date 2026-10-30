import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { sendWhatsAppMessage } from '@/utils/whatsapp'
import { calculateEffectiveDates } from '@/utils/businessDays'
import { gerarFaturasMensalistas } from '@/utils/billing'
import { calcularEncargosFatura } from '@/utils/billingCharges'

export async function GET(request: Request) {
  const supabase = createAdminClient()
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  try {
    // 0. Se for dia 01, garante a geração/atualização automática das faturas dos clientes ativos mensalistas
    if (hoje.getDate() === 1) {
      try {
        await gerarFaturasMensalistas(hoje)
      } catch (err) {
        console.error('Erro ao gerar faturas automaticamente no dia 01:', err)
      }
    }

    // 1. Busca configurações globais de juros, multa, carência e estado do Cron
    const { data: configGeral } = await supabase
      .from('configuracoes_portal_geral')
      .select('global_multa_atraso_percentual, global_juros_mora_mensal_percentual, global_dias_carencia, cron_whatsapp_ativo')
      .eq('id', 1)
      .maybeSingle()

    // 2. Busca a API de WhatsApp Ativa
    const { data: wppApis } = await supabase
      .from('integracoes')
      .select('*')
      .eq('tipo', 'whatsapp')
      .eq('is_ativo', true)
      .maybeSingle()
    
    if (!wppApis) {
      return NextResponse.json({ message: 'Nenhuma API de WhatsApp ativa encontrada. Abortando alertas.' })
    }

    // Verifica se os Crons de WhatsApp estão ativados pelo Administrador
    const isCronAtivo = configGeral?.cron_whatsapp_ativo ?? (wppApis?.credenciais?.cron_ativo !== false)
    if (!isCronAtivo) {
      return NextResponse.json({
        success: true,
        cron_ativo: false,
        message: 'Crons de WhatsApp estão temporariamente desativados pelo Administrador nas configurações de integrações.',
        disparos: []
      })
    }

    // 3. Busca todas as Faturas Pendentes (que não estão Pagas nem Canceladas)
    const { data: faturas, error: faturaError } = await supabase
      .from('faturas')
      .select(`
        id, valor, valor_original, data_vencimento, status, qr_code_payload, competencia,
        clientes ( 
          id, razao_social, nome_fantasia, whatsapp,
          multa_atraso_percentual, juros_mora_mensal_percentual, dias_carencia
        )
      `)
      .eq('status', 'pendente')

    if (faturaError) throw faturaError

    const disparosRealizados = []
    const modoContagem = wppApis?.credenciais?.modo_contagem_bloqueio || 'bloqueio_real'

    // 4. Processa cada fatura de acordo com a Régua de Cobrança e Carência
    for (const fatura of faturas || []) {
      const cliente: any = Array.isArray(fatura.clientes) ? fatura.clientes[0] : fatura.clientes
      if (!cliente || !cliente.whatsapp) continue

      // Prioridade da Carência / Tolerância: Cliente individual > Global
      const diasCarenciaEfetivos = (cliente.dias_carencia !== null && cliente.dias_carencia !== undefined)
        ? Number(cliente.dias_carencia)
        : Number(configGeral?.global_dias_carencia ?? 3)

      // Cálculo de encargos (multa e juros)
      const valorBase = Number(fatura.valor_original ?? fatura.valor)
      const encargos = calcularEncargosFatura({
        valorBase,
        dataVencimento: fatura.data_vencimento,
        clienteMulta: cliente?.multa_atraso_percentual,
        clienteJuros: cliente?.juros_mora_mensal_percentual,
        clienteCarencia: cliente?.dias_carencia,
        globalMulta: configGeral?.global_multa_atraso_percentual,
        globalJuros: configGeral?.global_juros_mora_mensal_percentual,
        globalCarencia: configGeral?.global_dias_carencia
      })

      // Cálculo de datas considerando a carência/tolerância
      const { rawDueDate, targetCountdownDate } = calculateEffectiveDates(
        fatura.data_vencimento, 
        modoContagem, 
        diasCarenciaEfetivos
      )

      const diferencaDias = Math.floor((rawDueDate.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
      const diasParaBloqueio = Math.floor((targetCountdownDate.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))

      const dataVencimentoFormatada = rawDueDate.toLocaleDateString('pt-BR')
      const dataBloqueioFormatada = targetCountdownDate.toLocaleDateString('pt-BR')
      const valorCobrar = encargos.valorTotal
      const valorFormatado = valorCobrar.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

      const pixBloco = fatura.qr_code_payload 
        ? `\n\n🔑 *Pix Copia e Cola:*\n\`\`\`${fatura.qr_code_payload}\`\`\`` 
        : ''

      let textoEncargos = ''
      if (encargos.emAtraso && (encargos.valorMulta > 0 || encargos.valorJuros > 0)) {
        textoEncargos = ` (inclui R$ ${encargos.valorMulta.toFixed(2)} de multa e R$ ${encargos.valorJuros.toFixed(2)} de juros)`
      }

      let mensagem = null
      let motivo = 'Cobrança'
      let modelo = 'Régua de Cobrança'

      // REGRA 1: 5 dias antes (Fatura disponível)
      if (diferencaDias === 5) {
        motivo = 'Pré-Vencimento (5 dias antes)'
        modelo = '1. Fatura Disponível'
        mensagem = `Olá! A fatura ${fatura.id.split('-')[0]} — Sistema Comercial, referente a ${fatura.competencia || 'este mês'}, da empresa ${cliente.nome_fantasia || cliente.razao_social}, já está disponível.\n• *Valor:* ${valorFormatado}\n• *Vencimento:* ${dataVencimentoFormatada}${pixBloco}\n\nPague via Pix para confirmação imediata!`
      }
      
      // REGRA 2: No dia do Vencimento Efetivo
      else if (diferencaDias === 0) {
        motivo = 'No Vencimento'
        modelo = '2. Lembrete de Vencimento'
        mensagem = `Olá! Sua fatura do Sistema Comercial vence hoje, ${dataVencimentoFormatada}.\n• *Valor:* ${valorFormatado}\n\nPara evitar o bloqueio previsto para ${dataBloqueioFormatada}, regularize o pagamento. Faltam ${diasParaBloqueio} dia(s) de tolerância.${pixBloco}`
      }
      
      // REGRA 3: Atrasado, mas antes do bloqueio efetivo
      else if (diferencaDias < 0 && diasParaBloqueio >= 0) {
        motivo = 'Cobrança em Atraso (Regressiva)'
        modelo = '3. Atraso & Regressiva'
        if (diasParaBloqueio === 0) {
           mensagem = `Olá. Ainda não identificamos o pagamento da fatura ${fatura.id.split('-')[0]} da empresa ${cliente.nome_fantasia || cliente.razao_social}. Vencimento: ${dataVencimentoFormatada}.\n\n⚠️ O prazo de tolerância para regularizar o pagamento antes do bloqueio TERMINA HOJE.\n• *Valor:* ${valorFormatado}${textoEncargos}${pixBloco}\n\nSe já pagou, favor desconsiderar.`
        } else {
           mensagem = `Olá. Ainda não identificamos o pagamento da fatura ${fatura.id.split('-')[0]} da empresa ${cliente.nome_fantasia || cliente.razao_social}. Vencimento original: ${dataVencimentoFormatada}.\n\nPara evitar o bloqueio previsto para ${dataBloqueioFormatada}, regularize o pagamento. Restam ${diasParaBloqueio} dia(s) de tolerância.\n• *Valor Atual:* ${valorFormatado}${textoEncargos}${pixBloco}\n\nSe já pagou, favor desconsiderar.`
        }
      }
      
      // REGRA 4: Já passou da data de bloqueio efetiva
      else if (diasParaBloqueio < 0) {
        motivo = 'Aviso de Bloqueio por Inadimplência'
        modelo = 'Aviso de Bloqueio'
        mensagem = `⚠️ *AVISO DE BLOQUEIO* ⚠️\nO prazo de tolerância previsto terminou em ${dataBloqueioFormatada}. Seu sistema pode ter sido bloqueado por pendência financeira.\n\n• *Valor Atualizado:* ${valorFormatado}${textoEncargos}${pixBloco}\n\nO desbloqueio ocorre de forma 100% automática em segundos após a confirmação do Pix.`
      }

      if (mensagem) {
        try {
          await sendWhatsAppMessage({
            to: cliente.whatsapp,
            message: mensagem,
            remetente: 'Robô Automático (Cron)',
            destinatarioTipo: 'cliente',
            destinatarioNome: cliente.nome_fantasia || cliente.razao_social,
            motivo,
            modelo,
            clienteId: cliente.id,
            faturaId: fatura.id,
          })

          disparosRealizados.push({
            cliente: cliente.nome_fantasia || cliente.razao_social,
            whatsapp: cliente.whatsapp,
            motivo,
            regra: diferencaDias,
            status: 'enviado'
          })
        } catch (err: any) {
          disparosRealizados.push({
            cliente: cliente.nome_fantasia || cliente.razao_social,
            whatsapp: cliente.whatsapp,
            motivo,
            regra: diferencaDias,
            status: 'falha',
            erro: err.message
          })
        }
      }
    }

    // 5. ALERTA DE VENCIMENTO DO CERTIFICADO DIGITAL A1 (A partir de 45 dias antes)
    const { data: clientesComCert } = await supabase
      .from('clientes')
      .select('id, razao_social, nome_fantasia, whatsapp, certificado_validade, contabilidade_id')
      .not('certificado_validade', 'is', null)

    const { data: todasConfigs } = await supabase
      .from('configuracoes_hub')
      .select('cliente_id, exibir_certificados_contabilidade, exibir_certificados_cliente, avisar_whatsapp_certificado')

    const configMap = new Map((todasConfigs || []).map(cfg => [cfg.cliente_id, cfg]))

    const { data: todasContabs } = await supabase
      .from('contabilidades')
      .select('id, razao_social, whatsapp')
    const contabMap = new Map((todasContabs || []).map(c => [c.id, c]))

    for (const cli of clientesComCert || []) {
      if (!cli.certificado_validade) continue
      const cliConfig = configMap.get(cli.id)

      if (cliConfig?.avisar_whatsapp_certificado === false) continue

      const dataValidade = new Date(cli.certificado_validade)
      dataValidade.setHours(0, 0, 0, 0)

      const diasParaVencerCert = Math.floor((dataValidade.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))

      if (diasParaVencerCert <= 45 && diasParaVencerCert >= 0) {
        const dataValidadeFormatada = dataValidade.toLocaleDateString('pt-BR')
        
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
              message: msgCert,
              remetente: 'Robô Automático (Cron)',
              destinatarioTipo: 'cliente',
              destinatarioNome: cli.nome_fantasia || cli.razao_social,
              motivo: `Vencimento de Certificado Digital (${diasParaVencerCert} dias)`,
              modelo: 'Alerta Certificado Digital A1',
              clienteId: cli.id,
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

        if (cliConfig?.exibir_certificados_contabilidade && cli.contabilidade_id) {
          const contab = contabMap.get(cli.contabilidade_id)
          if (contab?.whatsapp) {
            const msgContab = `🔔 AVISO PARA CONTABILIDADE: O Certificado Digital A1 do seu cliente ${cli.razao_social} expira em ${diasParaVencerCert} dias (${dataValidadeFormatada}).`
            try {
              await sendWhatsAppMessage({
                to: contab.whatsapp,
                message: msgContab,
                remetente: 'Robô Automático (Cron)',
                destinatarioTipo: 'contabilidade',
                destinatarioNome: contab.razao_social,
                motivo: `Alerta Fiscal de Certificado (${cli.razao_social})`,
                modelo: 'Aviso para Contabilidade (Certificado A1)',
                contabilidadeId: contab.id,
                clienteId: cli.id,
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
