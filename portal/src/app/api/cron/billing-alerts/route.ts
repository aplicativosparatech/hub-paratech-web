import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { sendWhatsAppMessage, extrairTelefonesWhatsapp } from '@/utils/whatsapp'
import { calculateEffectiveDates } from '@/utils/businessDays'
import { gerarFaturasMensalistas, executarRotinaPrimeiroDiaDoMes } from '@/utils/billing'
import { calcularEncargosFatura } from '@/utils/billingCharges'
import { obterOuGerarPixFatura } from '@/utils/pix'
import { gerarMensagemCobranca, SituacaoCobranca, DadosParaMensagem } from '@/utils/cobrancaTemplates'

export async function GET(request: Request) {
  const supabase = createAdminClient()
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  try {
    const url = new URL(request.url)
    const tipoFiltro = url.searchParams.get('tipo') // 'inadimplentes' | 'ativos' | null (ambos)
    const slotParam = url.searchParams.get('slot') // '09h' | '14h' | '17h' | '21h' | null
    const forcar = url.searchParams.get('forcar') === 'true'

    // Horário oficial de Brasília (America/Sao_Paulo)
    const agoraSpStr = new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })
    const agoraSp = new Date(agoraSpStr)
    const horaSp = agoraSp.getHours()
    const dataHojeSp = agoraSp.toISOString().split('T')[0]

    // Determina o slot de horário atual para clientes desativados (09:00, 14:00, 17:00, 21:00)
    let slotAtual: '09h' | '14h' | '17h' | '21h' | null = null
    if (slotParam && ['09h', '14h', '17h', '21h'].includes(slotParam)) {
      slotAtual = slotParam as any
    } else {
      if (horaSp >= 21) {
        slotAtual = '21h'
      } else if (horaSp >= 17) {
        slotAtual = '17h'
      } else if (horaSp >= 14) {
        slotAtual = '14h'
      } else if (horaSp >= 9) {
        slotAtual = '09h'
      }
    }

    // 1. Busca configurações globais e estado do Cron PRIMEIRO (Trava Absoluta)
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

    // TRAVA ABSOLUTA: Verifica se os Crons estão ativados pelo Administrador
    const isCronAtivo = configGeral?.cron_whatsapp_ativo ?? (wppApis?.credenciais?.cron_ativo !== false)
    if (!isCronAtivo) {
      return NextResponse.json({
        success: true,
        cron_ativo: false,
        message: 'Crons de faturas e WhatsApp estão temporariamente desativados pelo Administrador nas configurações de integrações.',
        disparos: []
      })
    }

    if (!wppApis) {
      return NextResponse.json({ message: 'Nenhuma API de WhatsApp ativa encontrada. Abortando alertas.' })
    }

    // 3. Se for dia 01 e o Cron estiver ATIVO (e não for filtro exclusivo de inadimplentes), executa rotina do 1º dia
    if (hoje.getDate() === 1 && tipoFiltro !== 'inadimplentes') {
      try {
        await executarRotinaPrimeiroDiaDoMes({ dataReferencia: hoje })
      } catch (err) {
        console.error('Erro ao executar rotina do 1º dia do mês no Cron:', err)
      }
    }

    // 3. Busca todas as Faturas Pendentes (que não estão Pagas nem Canceladas)
    const { data: faturas, error: faturaError } = await supabase
      .from('faturas')
      .select(`
        id, valor, valor_original, data_vencimento, status, qr_code_payload, competencia,
        ultimo_disparo_inativo_slot, ultimo_disparo_inativo_em,
        clientes ( 
          id, razao_social, nome_fantasia, nome_contato, whatsapp, whatsapp_cobranca,
          multa_atraso_percentual, juros_mora_mensal_percentual, dias_carencia, is_ativo
        )
      `)
      .eq('status', 'pendente')

    if (faturaError) throw faturaError

    const disparosRealizados = []
    const modoContagem = wppApis?.credenciais?.modo_contagem_bloqueio || 'bloqueio_real'

    // 4. Processa cada fatura de acordo com a Régua de Cobrança e Carência
    for (const fatura of faturas || []) {
      const cliente: any = Array.isArray(fatura.clientes) ? fatura.clientes[0] : fatura.clientes
      if (!cliente) continue

      const telefonesCliente = extrairTelefonesWhatsapp(cliente.whatsapp_cobranca || cliente.whatsapp)
      if (telefonesCliente.length === 0) continue

      const isClienteDesativado = cliente.is_ativo === false

      // =========================================================================
      // REGRA ESPECIAL: CLIENTE DESATIVADO COM FATURA EM ABERTO
      // Crons regulares NÃO rodam para clientes desativados.
      // SALVO SE ele tiver faturas em aberto: cobrança automática 4x ao dia (09h, 14h, 17h, 21h)
      // até a quitação, sempre avisando que é uma mensagem automática.
      // =========================================================================
      if (isClienteDesativado) {
        if (tipoFiltro === 'ativos') continue

        // Para clientes desativados, os disparos ocorrem nos slots 09h, 14h, 17h ou 21h
        if (!slotAtual && !forcar) {
          // Fora das 4 janelas do dia e não forçado
          continue
        }

        const slotEfetivo = slotAtual || '09h'
        const chaveSlotHoje = `${dataHojeSp}_${slotEfetivo}`

        // Evita duplicidade no mesmo slot de horário do mesmo dia
        if (fatura.ultimo_disparo_inativo_slot === chaveSlotHoje && !forcar) {
          continue
        }

        // Garante Pix Bacen
        let pixPayload = fatura.qr_code_payload
        if (!pixPayload || pixPayload.includes('mock-hubparatech')) {
          try {
            const pixRes = await obterOuGerarPixFatura(fatura.id)
            if (pixRes.qr_code_payload) {
              pixPayload = pixRes.qr_code_payload
              fatura.qr_code_payload = pixPayload
            }
          } catch (errPix) {
            console.warn('Erro ao atualizar pix no cron para cliente inativo:', errPix)
          }
        }

        // Calcula encargos
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

        const msgObj = gerarMensagemCobranca('desativado_pendente', {
          cliente,
          fatura: { ...fatura, qr_code_payload: pixPayload },
          encargos
        })

        let algumEnviado = false
        for (const telDestino of telefonesCliente) {
          try {
            await sendWhatsAppMessage({
              to: telDestino,
              message: msgObj.mensagem,
              remetente: `Robô Automático (${slotEfetivo})`,
              destinatarioTipo: 'cliente',
              destinatarioNome: msgObj.clienteNome || msgObj.empresaNome,
              motivo: `Cobrança Intensiva - Cliente Inativo (${slotEfetivo})`,
              modelo: msgObj.modelo,
              clienteId: cliente.id,
              faturaId: fatura.id,
            })
            algumEnviado = true
            disparosRealizados.push({
              cliente: cliente.nome_fantasia || cliente.razao_social,
              whatsapp: telDestino,
              motivo: `Cliente Desativado (${slotEfetivo})`,
              tipo: 'desativado_inadimplente',
              slot: slotEfetivo,
              status: 'enviado'
            })
          } catch (err: any) {
            disparosRealizados.push({
              cliente: cliente.nome_fantasia || cliente.razao_social,
              whatsapp: telDestino,
              motivo: `Cliente Desativado (${slotEfetivo})`,
              tipo: 'desativado_inadimplente',
              slot: slotEfetivo,
              status: 'falha',
              erro: err.message
            })
          }
        }

        if (algumEnviado) {
          await supabase
            .from('faturas')
            .update({
              ultimo_disparo_inativo_slot: chaveSlotHoje,
              ultimo_disparo_inativo_em: new Date().toISOString()
            })
            .eq('id', fatura.id)
        }

        continue // Finaliza esta fatura de cliente inativo e não prossegue para a régua regular
      }

      // =========================================================================
      // REGRA REGULAR: CLIENTE ATIVO (Régua Padrão de Cobrança)
      // =========================================================================
      if (tipoFiltro === 'inadimplentes') continue

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

      let situacao: SituacaoCobranca | null = null

      // REGRA 1: 5 dias antes (Fatura disponível)
      if (diferencaDias === 5) {
        situacao = 'pre_vencimento'
      }
      // REGRA 2: No dia do Vencimento Efetivo
      else if (diferencaDias === 0) {
        situacao = 'no_vencimento'
      }
      // REGRA 3: Atrasado, mas antes do bloqueio efetivo
      else if (diferencaDias < 0 && diasParaBloqueio >= 0) {
        situacao = 'atrasado_tolerancia'
      }
      // REGRA 4: Já passou da data de bloqueio efetiva
      else if (diasParaBloqueio < 0) {
        situacao = 'bloqueado'
      }

      if (situacao) {
        // Garante Pix oficial Bacen se necessário
        let pixPayload = fatura.qr_code_payload
        if (!pixPayload || pixPayload.includes('mock-hubparatech')) {
          try {
            const pixRes = await obterOuGerarPixFatura(fatura.id)
            if (pixRes.qr_code_payload) {
              pixPayload = pixRes.qr_code_payload
              fatura.qr_code_payload = pixPayload
            }
          } catch (errPix) {
            console.warn('Erro ao atualizar pix no cron:', errPix)
          }
        }

        const msgObj = gerarMensagemCobranca(situacao, {
          cliente,
          fatura: { ...fatura, qr_code_payload: pixPayload },
          encargos,
          diasParaBloqueio,
          diasCarenciaEfetivos,
          dataVencimentoFormatada,
          dataBloqueioFormatada
        })

        // Dispara para cada um dos WhatsApps cadastrados no cliente
        for (const telDestino of telefonesCliente) {
          try {
            await sendWhatsAppMessage({
              to: telDestino,
              message: msgObj.mensagem,
              remetente: 'Robô Automático (Cron)',
              destinatarioTipo: 'cliente',
              destinatarioNome: msgObj.clienteNome || msgObj.empresaNome,
              motivo: msgObj.motivo,
              modelo: msgObj.modelo,
              clienteId: cliente.id,
              faturaId: fatura.id,
            })

            disparosRealizados.push({
              cliente: cliente.nome_fantasia || cliente.razao_social,
              whatsapp: telDestino,
              motivo: msgObj.motivo,
              regra: diferencaDias,
              status: 'enviado'
            })
          } catch (err: any) {
            disparosRealizados.push({
              cliente: cliente.nome_fantasia || cliente.razao_social,
              whatsapp: telDestino,
              motivo: msgObj.motivo,
              regra: diferencaDias,
              status: 'falha',
              erro: err.message
            })
          }
        }
      }
    }

    // 5. ALERTA DE VENCIMENTO DO CERTIFICADO DIGITAL A1 (Apenas clientes ATIVOS, 45 dias antes)
    const { data: clientesComCert } = await supabase
      .from('clientes')
      .select('id, razao_social, nome_fantasia, whatsapp, certificado_validade, contabilidade_id')
      .eq('is_ativo', true)
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
