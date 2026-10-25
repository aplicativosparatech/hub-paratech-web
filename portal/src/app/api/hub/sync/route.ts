import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { calculateEffectiveDates } from '@/utils/businessDays'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseKey)

export async function POST(request: Request) {
  try {
    const { token } = await request.json()
    if (!token) return NextResponse.json({ error: 'Token inválido' }, { status: 400 })

    // 1. Busca o cliente com campos de tolerância e encargos
    const { data: cliente } = await supabase
      .from('clientes')
      .select('id, razao_social, nome_fantasia, nome_sistema_utilizado, is_ativo, data_inicio_monitoramento, numero_inicial_nfe, numero_inicial_nfce, numero_inicial_nfse, numero_inicial_cte, numero_inicial_mdfe, dias_carencia')
      .eq('hub_token', token)
      .single()
    if (!cliente) return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })

    // 2. Busca configuração do Hub (pastas, exes, tolerância)
    const { data: config } = await supabase
      .from('configuracoes_hub')
      .select('offline_secret, exes_monitorados, pastas_vendas, pastas_compras, modo_processamento_xml, dias_tolerancia_bloqueio, mensagem_bloqueio, dias_aviso_previo')
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
    const { data: faturaVencida } = await supabase
      .from('faturas')
      .select('id, valor, valor_original, qr_code_payload, status, desbloqueio_confianca_em, confianca_qtd, data_vencimento')
      .eq('cliente_id', cliente.id)
      .eq('status', 'pendente')
      .lt('data_vencimento', hoje)
      .order('data_vencimento', { ascending: true })
      .limit(1)
      .maybeSingle()

    // Se houver fatura vencida, gera ou atualiza o QR Code via rota interna de pagamentos
    let finalPix = faturaVencida?.qr_code_payload
    if (faturaVencida && !finalPix) {
       const host = request.headers.get('host')
       const protocol = host?.includes('localhost') ? 'http' : 'https'
       try {
         const resPix = await fetch(`${protocol}://${host}/api/pagamentos/gerar-pix`, {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ hub_token: token, fatura_id: faturaVencida.id })
         })
         const pixData = await resPix.json()
         if (pixData.qr_code_payload) finalPix = pixData.qr_code_payload
       } catch (errPix) {
         console.error('Erro ao acionar gerar-pix no sync:', errPix)
       }
    }

    // Se não tiver vencida, busca a próxima fatura a vencer para avisos preventivos
    let faturaAviso = null
    if (!faturaVencida) {
      const diasAviso = Number(config?.dias_aviso_previo ?? 7)
      const dataLimiteAviso = new Date()
      dataLimiteAviso.setDate(dataLimiteAviso.getDate() + diasAviso)
      const dataLimiteIso = dataLimiteAviso.toISOString().split('T')[0]

      const { data: faturaProx } = await supabase
        .from('faturas')
        .select('id, valor, qr_code_payload, data_vencimento')
        .eq('cliente_id', cliente.id)
        .eq('status', 'pendente')
        .gte('data_vencimento', hoje)
        .lte('data_vencimento', dataLimiteIso)
        .order('data_vencimento', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (faturaProx) {
        let pixProx = faturaProx.qr_code_payload
        if (!pixProx) {
          const host = request.headers.get('host')
          const protocol = host?.includes('localhost') ? 'http' : 'https'
          try {
            const resPix = await fetch(`${protocol}://${host}/api/pagamentos/gerar-pix`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ hub_token: token, fatura_id: faturaProx.id })
            })
            const pixData = await resPix.json()
            if (pixData.qr_code_payload) pixProx = pixData.qr_code_payload
          } catch (_) {}
        }

        const dtVenc = new Date(faturaProx.data_vencimento + 'T12:00:00Z')
        const dtHoje = new Date()
        const diasRestantes = Math.max(0, Math.ceil((dtVenc.getTime() - dtHoje.getTime()) / (1000 * 60 * 60 * 24)))

        faturaAviso = {
          id: faturaProx.id,
          valor: faturaProx.valor,
          pix_payload: pixProx || '',
          data_vencimento: faturaProx.data_vencimento,
          dias_restantes: diasRestantes
        }
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
    
    // Regra de Desbloqueio em Confiança Parametrizável
    if (faturaVencida && faturaVencida.desbloqueio_confianca_em) {
      const horasPermitidas = Number(configGeral?.horas_desbloqueio_confianca ?? 24)
      const dataDesbloqueio = new Date(faturaVencida.desbloqueio_confianca_em).getTime()
      const agora = new Date().getTime()
      const horasPassadas = (agora - dataDesbloqueio) / (1000 * 60 * 60)
      
      if (horasPassadas <= horasPermitidas) {
        isBloqueado = false // Está dentro do período de tolerância em confiança concedido!
      }
    }

    const nomeEmpresa = cliente.nome_fantasia || cliente.razao_social || cliente.nome_sistema_utilizado || 'Cliente Paratech'

    const responseData = {
      bloqueado: isBloqueado,
      motivo: !cliente.is_ativo ? 'administrativo' : (faturaVencida ? 'inadimplencia' : null),
      mensagem_bloqueio: config?.mensagem_bloqueio || 'SISTEMA BLOQUEADO. Por favor, regularize sua mensalidade.',
      cliente_nome: nomeEmpresa,
      executavel: cliente.nome_sistema_utilizado,
      executaveis: config?.exes_monitorados || [],
      pastas_vendas: config?.pastas_vendas || [],
      pastas_compras: config?.pastas_compras || [],
      offline_secret: config?.offline_secret || '123456',
      modo_processamento: config?.modo_processamento_xml || 'hub',
      data_inicio_monitoramento: cliente.data_inicio_monitoramento || null,
      numero_inicial_nfe: cliente.numero_inicial_nfe || 1,
      numero_inicial_nfce: cliente.numero_inicial_nfce || 1,
      numero_inicial_nfse: cliente.numero_inicial_nfse || 1,
      numero_inicial_cte: cliente.numero_inicial_cte || 1,
      numero_inicial_mdfe: cliente.numero_inicial_mdfe || 1,
      fatura: faturaVencida ? {
        id: faturaVencida.id,
        valor: faturaVencida.valor,
        pix_payload: finalPix || 'ERRO_PIX',
        data_vencimento: faturaVencida.data_vencimento,
        cliente_nome: nomeEmpresa
      } : null,
      fatura_aviso: faturaAviso
    }

    // Registra heartbeat do Hub (Online)
    const { error: syncError } = await supabase
      .from('configuracoes_hub')
      .update({ ultima_sincronizacao: new Date().toISOString() })
      .eq('cliente_id', cliente.id)

    if (syncError) {
      console.error('Erro ao atualizar sincronizacao:', syncError)
    }

    return NextResponse.json(responseData)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
