import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { sendWhatsAppMessage } from '@/utils/whatsapp'
import { calculateEffectiveDates } from '@/utils/businessDays'
import { calcularEncargosFatura } from '@/utils/billingCharges'
import { obterOuGerarPixFatura } from '@/utils/pix'
import {
  gerarMensagemCobranca,
  SituacaoCobranca,
  DadosParaMensagem
} from '@/utils/cobrancaTemplates'

interface ClienteFaturaElegivel {
  cliente: any
  fatura: any
  encargos: any
  diasParaBloqueio: number
  diferencaDias: number
  diasCarenciaEfetivos: number
  dataVencimentoFormatada: string
  dataBloqueioFormatada: string
}

async function coletarFaturasPorSituacao(situacao: SituacaoCobranca): Promise<ClienteFaturaElegivel[]> {
  const supabase = createAdminClient()
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  // 1. Busca configurações gerais
  const { data: configGeral } = await supabase
    .from('configuracoes_portal_geral')
    .select('global_multa_atraso_percentual, global_juros_mora_mensal_percentual, global_dias_carencia')
    .eq('id', 1)
    .maybeSingle()

  // 2. Busca todas as faturas pendentes com dados do cliente
  const { data: faturas, error: faturaError } = await supabase
    .from('faturas')
    .select(`
      id, valor, valor_original, data_vencimento, status, qr_code_payload, competencia,
      clientes (
        id, razao_social, nome_fantasia, nome_contato, whatsapp, whatsapp_cobranca,
        multa_atraso_percentual, juros_mora_mensal_percentual, dias_carencia, is_ativo
      )
    `)
    .eq('status', 'pendente')
    .order('data_vencimento', { ascending: true })

  if (faturaError) throw faturaError

  const elegiveis: ClienteFaturaElegivel[] = []

  for (const fatura of faturas || []) {
    const cliente: any = Array.isArray(fatura.clientes) ? fatura.clientes[0] : fatura.clientes
    if (!cliente || cliente.is_ativo === false) continue

    const telefone = (cliente.whatsapp_cobranca || cliente.whatsapp || '').replace(/\D/g, '')
    if (telefone.length < 10) continue

    const diasCarenciaEfetivos = (cliente.dias_carencia !== null && cliente.dias_carencia !== undefined)
      ? Number(cliente.dias_carencia)
      : Number(configGeral?.global_dias_carencia ?? 3)

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

    const { rawDueDate, targetCountdownDate } = calculateEffectiveDates(
      fatura.data_vencimento,
      'bloqueio_real',
      diasCarenciaEfetivos
    )

    const diferencaDias = Math.floor((rawDueDate.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
    const diasParaBloqueio = Math.floor((targetCountdownDate.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))

    const dataVencimentoFormatada = rawDueDate.toLocaleDateString('pt-BR')
    const dataBloqueioFormatada = targetCountdownDate.toLocaleDateString('pt-BR')

    let seEnquadra = false

    switch (situacao) {
      case 'pre_vencimento':
        // Faturas que vencem entre hoje+1 até hoje+5 (ou exatamente em 5 dias)
        seEnquadra = diferencaDias > 0 && diferencaDias <= 5
        break

      case 'no_vencimento':
        // Vencem hoje (diferença de 0 dias)
        seEnquadra = diferencaDias === 0
        break

      case 'atrasado_tolerancia':
        // Vencidas, mas ainda dentro do período de tolerância
        seEnquadra = diferencaDias < 0 && diasParaBloqueio >= 0
        break

      case 'bloqueado':
        // Prazo de tolerância esgotado
        seEnquadra = diasParaBloqueio < 0
        break

      default:
        seEnquadra = false
        break
    }

    if (seEnquadra) {
      elegiveis.push({
        cliente,
        fatura,
        encargos,
        diasParaBloqueio,
        diferencaDias,
        diasCarenciaEfetivos,
        dataVencimentoFormatada,
        dataBloqueioFormatada
      })
    }
  }

  return elegiveis
}

// GET: Consulta os clientes que se enquadram na condição solicitada
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const situacao = (searchParams.get('situacao') || 'pre_vencimento') as SituacaoCobranca

    const elegiveis = await coletarFaturasPorSituacao(situacao)

    const clientesResumo = elegiveis.map(e => ({
      clienteId: e.cliente.id,
      razao_social: e.cliente.razao_social,
      nome_fantasia: e.cliente.nome_fantasia,
      nome_contato: e.cliente.nome_contato,
      whatsapp: e.cliente.whatsapp_cobranca || e.cliente.whatsapp,
      faturaId: e.fatura.id,
      faturaCodigo: `FAT-${e.fatura.id.split('-')[0].toUpperCase()}`,
      competencia: e.fatura.competencia,
      valor: e.encargos.valorTotal,
      valorFormatado: e.encargos.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      dataVencimento: e.dataVencimentoFormatada,
      dataBloqueio: e.dataBloqueioFormatada,
      diferencaDias: e.diferencaDias,
      diasParaBloqueio: e.diasParaBloqueio
    }))

    return NextResponse.json({
      success: true,
      situacao,
      total: clientesResumo.length,
      clientes: clientesResumo
    })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 })
  }
}

// POST: Executa o disparo manual em lote para todos os clientes daquela situação
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const situacao = (body.situacao || 'pre_vencimento') as SituacaoCobranca

    const elegiveis = await coletarFaturasPorSituacao(situacao)

    if (elegiveis.length === 0) {
      return NextResponse.json({
        success: true,
        situacao,
        totalElegiveis: 0,
        enviados: 0,
        falhas: 0,
        message: 'Nenhum cliente se enquadra nesta condição no momento.'
      })
    }

    const disparos = []
    let totalEnviados = 0
    let totalFalhas = 0

    for (const item of elegiveis) {
      const { cliente, fatura, encargos, diasParaBloqueio, diasCarenciaEfetivos, dataVencimentoFormatada, dataBloqueioFormatada } = item
      const telefone = (cliente.whatsapp_cobranca || cliente.whatsapp || '').replace(/\D/g, '')

      // Garante QR Code Pix Oficial Bacen (com chave Pix do Hub)
      let pixPayload = fatura.qr_code_payload
      if (!pixPayload || pixPayload.includes('mock-hubparatech')) {
        try {
          const pixRes = await obterOuGerarPixFatura(fatura.id)
          if (pixRes.qr_code_payload) {
            pixPayload = pixRes.qr_code_payload
            fatura.qr_code_payload = pixPayload
          }
        } catch (errPix) {
          console.warn('Erro ao gerar Pix oficial em lote:', errPix)
        }
      }

      const dadosParaMsg: DadosParaMensagem = {
        cliente,
        fatura: {
          ...fatura,
          qr_code_payload: pixPayload
        },
        encargos,
        diasParaBloqueio,
        diasCarenciaEfetivos,
        dataVencimentoFormatada,
        dataBloqueioFormatada
      }

      const msgObj = gerarMensagemCobranca(situacao, dadosParaMsg)

      try {
        await sendWhatsAppMessage({
          to: telefone,
          message: msgObj.mensagem,
          mediaUrl: msgObj.linkQrCode,
          remetente: 'Administrador (Disparo Manual em Massa)',
          destinatarioTipo: 'cliente',
          destinatarioNome: msgObj.clienteNome || msgObj.empresaNome,
          motivo: msgObj.motivo,
          modelo: msgObj.modelo,
          clienteId: cliente.id,
          faturaId: fatura.id
        })

        totalEnviados++
        disparos.push({
          clienteId: cliente.id,
          empresa: msgObj.empresaNome,
          contato: msgObj.clienteNome,
          telefone,
          faturaCodigo: msgObj.faturaCodigo,
          valor: msgObj.valorFormatado,
          status: 'sucesso'
        })
      } catch (errDisparo: any) {
        totalFalhas++
        disparos.push({
          clienteId: cliente.id,
          empresa: msgObj.empresaNome,
          contato: msgObj.clienteNome,
          telefone,
          faturaCodigo: msgObj.faturaCodigo,
          status: 'falha',
          erro: errDisparo.message
        })
      }
    }

    return NextResponse.json({
      success: true,
      situacao,
      totalElegiveis: elegiveis.length,
      enviados: totalEnviados,
      falhas: totalFalhas,
      disparos
    })
  } catch (err: any) {
    console.error('Erro ao disparar mensagens em massa:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
