import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'

// Função auxiliar para comparar versões SemVer simples (ex: "1.2.3" vs "1.2.4")
function compararVersoes(vAtual: string, vNova: string): number {
  const partesAtual = vAtual.replace(/[^0-9.]/g, '').split('.').map(n => parseInt(n, 10) || 0)
  const partesNova = vNova.replace(/[^0-9.]/g, '').split('.').map(n => parseInt(n, 10) || 0)

  const maxLen = Math.max(partesAtual.length, partesNova.length)
  for (let i = 0; i < maxLen; i++) {
    const a = partesAtual[i] || 0
    const b = partesNova[i] || 0
    if (b > a) return 1 // Nova é maior -> tem atualização
    if (b < a) return -1 // Atual é maior
  }
  return 0 // Iguais
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const sistemaId = searchParams.get('sistema_id') || searchParams.get('sistema') || searchParams.get('app')
    const versaoAtual = searchParams.get('versao_atual') || searchParams.get('versao') || '0.0.0'
    const buildNumberAtual = parseInt(searchParams.get('build_number') || searchParams.get('build') || '0', 10)
    const clienteId = searchParams.get('cliente_id')
    const cnpj = searchParams.get('cnpj')
    const token = searchParams.get('token') || searchParams.get('hub_token')
    const nomeComputador = searchParams.get('nome_computador') || searchParams.get('pc_name') || 'Estação Principal'
    const sistemaOperacional = searchParams.get('so') || searchParams.get('os') || 'Windows'
    const politicaLocal = (searchParams.get('politica') || searchParams.get('modo') || 'informativa').toLowerCase()

    if (!sistemaId) {
      return NextResponse.json(
        { error: 'Parâmetro sistema_id é obrigatório (ex: mei_simples, hub_desktop, tech_slim, tech_pro, gastro, pes_ai)' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // 1. Busca a versão mais recente ATIVA para o sistema solicitado
    const { data: versoes, error: errVersoes } = await supabase
      .from('versoes_sistemas')
      .select('*')
      .eq('sistema_id', sistemaId.toLowerCase())
      .eq('ativo', true)
      .order('build_number', { ascending: false })
      .order('criado_em', { ascending: false })
      .limit(1)

    if (errVersoes) {
      console.error('Erro ao buscar versão do sistema:', errVersoes)
      return NextResponse.json({ error: 'Erro ao buscar versões' }, { status: 500 })
    }

    // 2. Identifica o cliente se foi informado Token, CNPJ ou ID para checar política personalizada
    let clienteEncontrado: any = null
    if (token) {
      const { data: c } = await supabase
        .from('clientes')
        .select('id, razao_social, politica_atualizacao')
        .eq('hub_token', token)
        .maybeSingle()
      if (c) clienteEncontrado = c
    }

    if (!clienteEncontrado && clienteId) {
      const { data: c } = await supabase.from('clientes').select('id, razao_social, politica_atualizacao').eq('id', clienteId).single()
      clienteEncontrado = c
    } else if (!clienteEncontrado && cnpj) {
      const cnpjLimpo = cnpj.replace(/\D/g, '')
      const { data: c } = await supabase.from('clientes').select('id, razao_social, politica_atualizacao').ilike('cnpj', `%${cnpjLimpo}%`).limit(1).maybeSingle()
      clienteEncontrado = c
    }

    // Política efetiva: 'automatica' ou 'informativa'
    let politicaEfetiva = politicaLocal === 'automatica' ? 'automatica' : 'informativa'
    if (clienteEncontrado?.politica_atualizacao && clienteEncontrado.politica_atualizacao !== 'padrao') {
      politicaEfetiva = clienteEncontrado.politica_atualizacao === 'automatica' ? 'automatica' : 'informativa'
    }

    // 3. Registra telemetria de forma assíncrona/não-bloqueante
    const ipOrigem = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const targetClienteId = clienteEncontrado?.id || (clienteId || null)

    const payloadTelemetria = {
      cliente_id: targetClienteId,
      sistema_id: sistemaId.toLowerCase(),
      versao_atual: versaoAtual,
      build_number_atual: buildNumberAtual,
      politica_configurada: politicaEfetiva,
      nome_computador: nomeComputador,
      sistema_operacional: sistemaOperacional,
      ip_origem: ipOrigem,
      ultima_checagem: new Date().toISOString()
    }

    // Se houver cliente_id, usa o onConflict oficial, senão busca e atualiza
    if (targetClienteId) {
      supabase
        .from('telemetria_versoes_clientes')
        .upsert(payloadTelemetria, { onConflict: 'cliente_id, sistema_id, nome_computador' })
        .then(({ error: errTele }) => {
          if (errTele) console.warn('Aviso telemetria:', errTele.message)
        })
    } else {
      supabase
        .from('telemetria_versoes_clientes')
        .select('id')
        .eq('sistema_id', sistemaId.toLowerCase())
        .eq('nome_computador', nomeComputador)
        .is('cliente_id', null)
        .limit(1)
        .maybeSingle()
        .then(({ data: existing }) => {
          if (existing?.id) {
            supabase.from('telemetria_versoes_clientes').update(payloadTelemetria).eq('id', existing.id).then(() => {})
          } else {
            supabase.from('telemetria_versoes_clientes').insert([payloadTelemetria]).then(() => {})
          }
        })
    }

    // 4. Se não há nenhuma versão cadastrada ainda para o sistema
    if (!versoes || versoes.length === 0) {
      return NextResponse.json({
        sucesso: true,
        sistema_id: sistemaId.toLowerCase(),
        tem_atualizacao: false,
        versao_atual: versaoAtual,
        build_number_atual: buildNumberAtual,
        mensagem: 'Nenhuma versão ativa cadastrada para este sistema.'
      })
    }

    const versaoMaisRecente = versoes[0]

    // Compara se há atualização necessária
    let temAtualizacao = false
    if (versaoMaisRecente.build_number > buildNumberAtual) {
      temAtualizacao = true
    } else if (compararVersoes(versaoAtual, versaoMaisRecente.versao) > 0) {
      temAtualizacao = true
    }

    return NextResponse.json({
      sucesso: true,
      sistema_id: sistemaId.toLowerCase(),
      tem_atualizacao: temAtualizacao,
      versao_atual: versaoAtual,
      build_number_atual: buildNumberAtual,
      versao_mais_recente: versaoMaisRecente.versao,
      build_number_mais_recente: versaoMaisRecente.build_number,
      obrigatoria: !!versaoMaisRecente.obrigatoria,
      politica_efetiva: versaoMaisRecente.obrigatoria ? 'automatica' : politicaEfetiva,
      changelog: versaoMaisRecente.changelog || 'Melhorias de desempenho e correções gerais.',
      url_download: versaoMaisRecente.url_download,
      sha256: versaoMaisRecente.sha256 || null,
      tamanho_bytes: versaoMaisRecente.tamanho_bytes || null,
      publicado_em: versaoMaisRecente.criado_em
    })

  } catch (error: any) {
    console.error('Erro na rota /api/hub/versoes/check:', error)
    return NextResponse.json({ error: error.message || 'Erro interno no servidor' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  // Suporte a POST enviando JSON com os mesmos parâmetros
  try {
    const body = await request.json()
    const url = new URL(request.url)
    Object.entries(body).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v))
    })
    const reqSimulada = new Request(url.toString(), {
      method: 'GET',
      headers: request.headers
    })
    return GET(reqSimulada)
  } catch (err: any) {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }
}
