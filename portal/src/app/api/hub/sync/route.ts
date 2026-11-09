import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { calculateEffectiveDates } from '@/utils/businessDays'
import { obterOuGerarPixFatura } from '@/utils/pix'
import { replicateDualWrite } from '@/utils/dualWrite'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseKey)

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const token = body.token
    const versaoHub = body.versao || body.versao_hub || null
    const buildNumber = body.build_number ? Number(body.build_number) : null

    if (!token) return NextResponse.json({ error: 'Token inválido' }, { status: 400 })

    // 1. Busca o cliente com campos de tolerância e encargos
    const { data: cliente } = await supabase
      .from('clientes')
      .select('id, razao_social, nome_fantasia, nome_sistema_utilizado, is_ativo, data_inicio_monitoramento, numero_inicial_nfe, numero_inicial_nfce, numero_inicial_nfse, numero_inicial_cte, numero_inicial_mdfe, dias_carencia, valor_mensalidade, dia_vencimento')
      .eq('hub_token', token)
      .single()
    if (!cliente) return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })

    // 2. Busca configuração do Hub (pastas, exes, tolerância, banner, whatsapp, features, aviso prévio, comandos e versão)
    const { data: config } = await supabase
      .from('configuracoes_hub')
      .select('offline_secret, exes_monitorados, pastas_vendas, pastas_compras, modo_processamento_xml, dias_tolerancia_bloqueio, mensagem_bloqueio, dias_aviso_previo, intervalo_aviso_horas, mensagem_aviso_previo, banner_url, support_whatsapp, feature_sugestao_tributaria, feature_nuvem_produtos, feature_loja_virtual, feature_nfce, feature_nfe, feature_contas_pagar, feature_estoque_avancado, comando_remoto, comando_remoto_em, versao_hub_instalada')
      .eq('cliente_id', cliente.id)
      .maybeSingle()

    // 3. Busca configurações globais do Portal (carência e parâmetros de desbloqueio em confiança)
    const { data: configGeral } = await supabase
      .from('configuracoes_portal_geral')
      .select('global_dias_carencia, limite_desbloqueios_confianca, horas_desbloqueio_confianca')
      .eq('id', 1)
      .maybeSingle()

    // Prioridade da carência / tolerância: Cliente individual > Hub do cliente > Global
    const diasCarenciaEfetivos = (cliente.dias_carencia !== null && cliente.dias_carencia !== undefined)
      ? Number(cliente.dias_carencia)
      : (config?.dias_tolerancia_bloqueio !== null && config?.dias_tolerancia_bloqueio !== undefined)
        ? Number(config.dias_tolerancia_bloqueio)
        : Number(configGeral?.global_dias_carencia ?? 3)

    // 4. Verifica faturas pendentes (Vencidas ou Próximas)
    const hoje = new Date().toISOString().split('T')[0]
    const { data: faturasPendentes } = await supabase
      .from('faturas')
      .select('id, valor, valor_original, qr_code_payload, status, desbloqueio_confianca_em, confianca_qtd, data_vencimento')
      .eq('cliente_id', cliente.id)
      .eq('status', 'pendente')
      .order('data_vencimento', { ascending: true })

    // Fatura vencida mais antiga
    const faturaVencida = faturasPendentes?.find(f => f.data_vencimento < hoje) || null

    // Fatura pendente principal (se tiver vencida usa ela; senão usa a próxima pendente)
    const faturaPrincipal = faturaVencida || faturasPendentes?.[0] || null

    // Garante que o QR Code Pix oficial Bacen esteja gerado e com o valor exato da fatura
    let finalPix = faturaPrincipal?.qr_code_payload
    if (faturaPrincipal) {
      try {
        const pixData = await obterOuGerarPixFatura(faturaPrincipal.id)
        if (pixData.qr_code_payload) finalPix = pixData.qr_code_payload
      } catch (errPix) {
        console.error('Erro ao acionar obterOuGerarPixFatura no sync:', errPix)
      }
    }

    let isBloqueado = !cliente.is_ativo;

    // Regra de Bloqueio: respeita os dias de carência (Cliente > Global) e fins de semana/feriados
    if (faturaVencida) {
      const { effectiveBlockDate } = calculateEffectiveDates(faturaVencida.data_vencimento, 'bloqueio_real', diasCarenciaEfetivos)
      const dataHoje = new Date()
      dataHoje.setHours(0, 0, 0, 0)

      if (dataHoje.getTime() >= effectiveBlockDate.getTime()) {
        isBloqueado = true
      }
    }

    // Configuração de Aviso Prévio na Tela e a Cada X Horas
    const diasAvisoConfig = Math.max(1, Number(config?.dias_aviso_previo ?? 2))
    const intervaloAvisoHoras = Math.max(1, Number(config?.intervalo_aviso_horas ?? 4))
    let avisoPrevioAtivo = false
    let faturaAviso = null

    // O aviso na tela só atua quando NÃO está em bloqueio total
    if (!isBloqueado) {
      if (faturaVencida) {
        // Cenário 1: Vencida, mas ainda em carência/tolerância
        avisoPrevioAtivo = true
        faturaAviso = {
          id: faturaVencida.id,
          valor: Number(faturaVencida.valor),
          pix_payload: finalPix || '',
          data_vencimento: faturaVencida.data_vencimento,
          dias_restantes: 0,
          is_tolerancia: true,
          dias_tolerancia_restantes: diasCarenciaEfetivos,
          mensagem: config?.mensagem_aviso_previo || `FATURA VENCIDA: Sua mensalidade venceu em ${faturaVencida.data_vencimento}. Você está no período de tolerância. Pague via Pix para evitar o bloqueio.`
        }
      } else {
        // Cenário 2: Próxima de vencer (dentro de dias_aviso_previo)
        const faturaProx = faturasPendentes?.find(f => f.data_vencimento >= hoje) || null
        if (faturaProx) {
          const dtVenc = new Date(faturaProx.data_vencimento + 'T12:00:00Z')
          const dtHoje = new Date()
          const diasRestantes = Math.max(0, Math.ceil((dtVenc.getTime() - dtHoje.getTime()) / (1000 * 60 * 60 * 24)))

          if (diasRestantes <= diasAvisoConfig) {
            avisoPrevioAtivo = true
            let pixProx = faturaProx.qr_code_payload
            if (!pixProx || pixProx.includes('mock-hubparatech')) {
              try {
                const pixData = await obterOuGerarPixFatura(faturaProx.id)
                if (pixData.qr_code_payload) pixProx = pixData.qr_code_payload
              } catch (_) {}
            }

            const diasTxt = diasRestantes === 0 ? 'HOJE' : (diasRestantes === 1 ? 'amanhã' : `em ${diasRestantes} dias`)
            faturaAviso = {
              id: faturaProx.id,
              valor: Number(faturaProx.valor),
              pix_payload: pixProx || finalPix || '',
              data_vencimento: faturaProx.data_vencimento,
              dias_restantes: diasRestantes,
              is_tolerancia: false,
              dias_tolerancia_restantes: 0,
              mensagem: config?.mensagem_aviso_previo || `AVISO DE VENCIMENTO: Sua mensalidade vence ${diasTxt} (${faturaProx.data_vencimento}). Pague via Pix no Hub para evitar bloqueio.`
            }
          }
        }
      }
    }
    
    // Regra de Desbloqueio em Confiança Parametrizável
    let confiancaInfo: {
      ativo: boolean
      fatura_id: string
      desbloqueio_em: string
      expira_em: string
      horas_totais: number
      segundos_restantes: number
    } | null = null

    // Procura fatura com desbloqueio em confiança ativo (seja a vencida principal ou outra pendente)
    let faturaParaConfianca = faturaVencida
    if (!faturaParaConfianca?.desbloqueio_confianca_em) {
      const { data: fConf } = await supabase
        .from('faturas')
        .select('id, valor, valor_original, qr_code_payload, status, desbloqueio_confianca_em, confianca_qtd, data_vencimento')
        .eq('cliente_id', cliente.id)
        .eq('status', 'pendente')
        .not('desbloqueio_confianca_em', 'is', null)
        .order('desbloqueio_confianca_em', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (fConf?.desbloqueio_confianca_em) {
        faturaParaConfianca = fConf
      }
    }

    if (faturaParaConfianca && faturaParaConfianca.desbloqueio_confianca_em) {
      const horasPermitidas = Number(configGeral?.horas_desbloqueio_confianca ?? 24)
      const dataDesbloqueio = new Date(faturaParaConfianca.desbloqueio_confianca_em).getTime()
      const agora = new Date().getTime()
      const horasPassadas = (agora - dataDesbloqueio) / (1000 * 60 * 60)
      
      if (horasPassadas <= horasPermitidas) {
        isBloqueado = false // Está dentro do período de tolerância em confiança concedido!
        const expiraMs = dataDesbloqueio + horasPermitidas * 3600 * 1000
        confiancaInfo = {
          ativo: true,
          fatura_id: faturaParaConfianca.id,
          desbloqueio_em: faturaParaConfianca.desbloqueio_confianca_em,
          expira_em: new Date(expiraMs).toISOString(),
          horas_totais: horasPermitidas,
          segundos_restantes: Math.max(0, Math.floor((expiraMs - agora) / 1000))
        }
      }
    }

    // 4. Busca as últimas faturas quitadas reais do cliente
    const { data: faturasPagas } = await supabase
      .from('faturas')
      .select('id, competencia, valor, data_vencimento, data_pagamento, status')
      .eq('cliente_id', cliente.id)
      .eq('status', 'pago')
      .order('data_pagamento', { ascending: false })
      .limit(3)

    const nomeEmpresa = cliente.nome_fantasia || cliente.razao_social || cliente.nome_sistema_utilizado || 'Cliente Paratech'

    // Detecta se o Hub precisa atualizar para a versão mais recente oficial (v2.8.8 / build 288)
    const versaoDesatualizada = !versaoHub || versaoHub < '2.8.8' || (buildNumber !== null && buildNumber < 288)
    const deveForcarAtualizacao = config?.comando_remoto === 'atualizar_hub' || versaoDesatualizada

    const responseData = {
      ...body,
      bloqueado: isBloqueado,
      aviso_previo_ativo: avisoPrevioAtivo,
      intervalo_aviso_horas: intervaloAvisoHoras,
      mensagem_aviso_previo: config?.mensagem_aviso_previo || 'AVISO: Sua mensalidade vence em breve. Regularize via Pix no Hub para evitar bloqueio.',
      desbloqueio_confianca: confiancaInfo,
      motivo: !cliente.is_ativo ? 'administrativo' : (faturaVencida ? 'inadimplencia' : null),
      mensagem_bloqueio: config?.mensagem_bloqueio || 'SISTEMA BLOQUEADO. Por favor, regularize sua mensalidade.',
      cliente_nome: nomeEmpresa,
      executavel: cliente.nome_sistema_utilizado,
      executaveis: config?.exes_monitorados || [],
      pastas_vendas: config?.pastas_vendas || [],
      pastas_compras: config?.pastas_compras || [],
      offline_secret: config?.offline_secret || '123456',
      modo_processamento: config?.modo_processamento_xml || 'hub',
      valor_mensalidade: Number(cliente.valor_mensalidade || 0),
      dia_vencimento: Number(cliente.dia_vencimento || 10),
      data_inicio_monitoramento: cliente.data_inicio_monitoramento || null,
      numero_inicial_nfe: cliente.numero_inicial_nfe || 1,
      numero_inicial_nfce: cliente.numero_inicial_nfce || 1,
      numero_inicial_nfse: cliente.numero_inicial_nfse || 1,
      numero_inicial_cte: cliente.numero_inicial_cte || 1,
      numero_inicial_mdfe: cliente.numero_inicial_mdfe || 1,
      banner_url: config?.banner_url || null,
      support_whatsapp: config?.support_whatsapp || null,
      ultimas_faturas_pagas: (faturasPagas || []).map(f => ({
        id: f.id,
        competencia: f.competencia,
        valor: Number(f.valor),
        data_vencimento: f.data_vencimento,
        data_pagamento: f.data_pagamento
      })),
      features: {
        sugestao_tributaria: config?.feature_sugestao_tributaria ?? true,
        nuvem_produtos: config?.feature_nuvem_produtos ?? true,
        loja_virtual: config?.feature_loja_virtual ?? false,
        nfce: config?.feature_nfce ?? true,
        nfe: config?.feature_nfe ?? true,
        contas_pagar: config?.feature_contas_pagar ?? true,
        estoque_avancado: config?.feature_estoque_avancado ?? true,
      },
      fatura: faturaPrincipal ? {
        id: faturaPrincipal.id,
        valor: faturaPrincipal.valor,
        pix_payload: finalPix || 'ERRO_PIX',
        data_vencimento: faturaPrincipal.data_vencimento,
        cliente_nome: nomeEmpresa,
        desbloqueio_confianca_em: faturaPrincipal.desbloqueio_confianca_em,
        confianca_qtd: faturaPrincipal.confianca_qtd
      } : null,
      fatura_aviso: faturaAviso,
      comando_remoto: config?.comando_remoto || (deveForcarAtualizacao ? 'atualizar_hub' : null),
      forcar_atualizacao: deveForcarAtualizacao
    }

    // Registra heartbeat do Hub (Online) e atualiza versão, uptime e identificação da máquina
    const updateHubData: any = { ultima_sincronizacao: new Date().toISOString() }
    if (versaoHub) {
      updateHubData.versao_hub_instalada = versaoHub
    }
    if (body.uptime_segundos !== undefined && body.uptime_segundos !== null) {
      updateHubData.uptime_segundos = Number(body.uptime_segundos)
    }
    if (body.computador_nome) {
      updateHubData.computador_nome = String(body.computador_nome)
    }
    if (body.ip_local) {
      updateHubData.ip_local = String(body.ip_local)
    }
    if (body.mac_address) {
      updateHubData.mac_address = String(body.mac_address)
    }

    // Se havia um comando pendente que foi entregue nesta resposta, consome o comando
    if (config?.comando_remoto) {
      updateHubData.comando_remoto = null
    }

    let { error: syncError } = await supabase
      .from('configuracoes_hub')
      .update(updateHubData)
      .eq('cliente_id', cliente.id)

    // Fallback gracioso se as colunas de uptime/hardware ainda não tiverem sido adicionadas no banco
    if (syncError && syncError.message?.includes('column')) {
      const basicData: any = { ultima_sincronizacao: updateHubData.ultima_sincronizacao }
      if (updateHubData.versao_hub_instalada) basicData.versao_hub_instalada = updateHubData.versao_hub_instalada
      if (updateHubData.comando_remoto === null) basicData.comando_remoto = null
      
      const { error: fallbackError } = await supabase
        .from('configuracoes_hub')
        .update(basicData)
        .eq('cliente_id', cliente.id)
      syncError = fallbackError
    }

    if (syncError) {
      console.error('Erro ao atualizar sincronizacao:', syncError)
    }

    // DUAL-WRITE: Replica o heartbeat e status simultaneamente no banco espelho (Cloud se VPS / VPS se Cloud)
    replicateDualWrite('configuracoes_hub', 'update', updateHubData, { column: 'cliente_id', value: cliente.id })

    return NextResponse.json(responseData)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
