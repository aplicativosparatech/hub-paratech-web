import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { calculateEffectiveDates } from '@/utils/businessDays'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

export async function POST(request: Request) {
  try {
    const { token } = await request.json()
    if (!token) return NextResponse.json({ error: 'Token inválido' }, { status: 400 })

    // 1. Busca o cliente
    const { data: cliente } = await supabase
      .from('clientes')
      .select('id, nome_sistema_utilizado, is_ativo, data_inicio_monitoramento, numero_inicial_nfe, numero_inicial_nfce, numero_inicial_nfse, numero_inicial_cte, numero_inicial_mdfe')
      .eq('hub_token', token)
      .single()
    if (!cliente) return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })

    // 2. Busca configuração (offline_secret, exes_monitorados, modo_processamento_xml)
    const { data: config } = await supabase.from('configuracoes_hub').select('offline_secret, exes_monitorados, pastas_vendas, pastas_compras, modo_processamento_xml').eq('cliente_id', cliente.id).maybeSingle()

    // 3. Verifica faturas vencidas
    const hoje = new Date().toISOString().split('T')[0]
    const { data: faturaVencida } = await supabase
      .from('faturas')
      .select('id, valor, qr_code_payload, status, desbloqueio_confianca_em, data_vencimento')
      .eq('cliente_id', cliente.id)
      .eq('status', 'pendente')
      .lt('data_vencimento', hoje)
      .order('data_vencimento', { ascending: true })
      .limit(1)
      .maybeSingle()

    // Se houver fatura vencida, gera o QR Code caso ainda não tenha (Mock via API)
    let finalPix = faturaVencida?.qr_code_payload
    if (faturaVencida && !finalPix) {
       // Se não tem payload salvo, chama a nossa própria rota interna para gerar
       const host = request.headers.get('host')
       const protocol = host?.includes('localhost') ? 'http' : 'https'
       const resPix = await fetch(`${protocol}://${host}/api/pagamentos/gerar-pix`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ hub_token: token, fatura_id: faturaVencida.id })
       })
       const pixData = await resPix.json()
       if (pixData.qr_code_payload) finalPix = pixData.qr_code_payload
    }

    let isBloqueado = !cliente.is_ativo;

    // Regra de Negócio: Se o vencimento ou a data de bloqueio cair em feriado/fim de semana, prorroga para o próximo dia útil
    if (faturaVencida) {
      const { effectiveBlockDate } = calculateEffectiveDates(faturaVencida.data_vencimento)
      const dataHoje = new Date()
      dataHoje.setHours(0, 0, 0, 0)

      // Só bloqueia se HOJE já atingiu ou passou a data de bloqueio efetiva (respeitando fins de semana e feriados)
      if (dataHoje.getTime() >= effectiveBlockDate.getTime()) {
        isBloqueado = true;
      }
    }
    
    // Lógica de liberação em confiança (24h)
    if (faturaVencida && faturaVencida.desbloqueio_confianca_em) {
        const dataDesbloqueio = new Date(faturaVencida.desbloqueio_confianca_em).getTime()
        const agora = new Date().getTime()
        const horasPassadas = (agora - dataDesbloqueio) / (1000 * 60 * 60)
        
        if (horasPassadas <= 24) {
            isBloqueado = false; // Está no período de confiança!
        }
    }

    const responseData = {
      bloqueado: isBloqueado,
      motivo: !cliente.is_ativo ? 'administrativo' : (faturaVencida ? 'inadimplencia' : null),
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
        valor: faturaVencida.valor,
        pix_payload: finalPix || 'ERRO_PIX',
        data_vencimento: faturaVencida.data_vencimento,
        cliente_nome: cliente.nome_sistema_utilizado || 'Cliente Paratech'
      } : null
    }

    // Registra que o Hub acabou de bater no servidor (Online!)
    const { error: syncError } = await supabase.from('configuracoes_hub').update({ ultima_sincronizacao: new Date().toISOString() }).eq('cliente_id', cliente.id)
    if (syncError) {
      console.error('Erro ao atualizar sincronizacao:', syncError)
    }

    return NextResponse.json(responseData)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
