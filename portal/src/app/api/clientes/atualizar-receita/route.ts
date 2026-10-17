import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { limparDocumento, formatarCnpjCpf } from '@/utils/cnpjAlfanumerico'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function consultarCnpjPublico(cnpjLimpo: string) {
  // 1. Tenta CNPJ.ws
  try {
    const res = await fetch(`https://publica.cnpj.ws/cnpj/${cnpjLimpo}`, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'HubParatech/2.5' },
      signal: AbortSignal.timeout(6000)
    })
    if (res.ok) {
      const d = await res.json()
      const est = d.estabelecimento
      let ie = ''
      if (Array.isArray(est?.inscricoes_estaduais) && est.inscricoes_estaduais.length > 0) {
        const ativa = est.inscricoes_estaduais.find((i: any) => i.ativo)
        ie = (ativa || est.inscricoes_estaduais[0])?.inscricao_estadual || ''
      }
      return {
        razao_social: d.razao_social || '',
        nome_fantasia: est?.nome_fantasia || d.razao_social || '',
        cidade: est?.cidade?.nome || '',
        uf: est?.estado?.sigla || '',
        cep: est?.cep || '',
        logradouro: `${est?.tipo_logradouro || ''} ${est?.logradouro || ''}`.trim(),
        numero: est?.numero || '',
        bairro: est?.bairro || '',
        inscricao_estadual: ie,
        ramo_atividade: est?.atividade_principal?.descricao || '',
        telefone: est?.ddd1 && est?.telefone1 ? `(${est.ddd1}) ${est.telefone1}` : '',
        whatsapp: est?.ddd1 && est?.telefone1 ? `55${est.ddd1}${est.telefone1.replace(/\D/g, '')}` : '',
        email_fiscal: est?.email || ''
      }
    }
  } catch {}

  // 2. Fallback BrasilAPI
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'HubParatech/2.5' },
      signal: AbortSignal.timeout(5000)
    })
    if (res.ok) {
      const d = await res.json()
      return {
        razao_social: d.razao_social || '',
        nome_fantasia: d.nome_fantasia || d.razao_social || '',
        cidade: d.municipio || '',
        uf: d.uf || '',
        cep: d.cep || '',
        logradouro: `${d.descricao_tipo_de_logradouro || ''} ${d.logradouro || ''}`.trim(),
        numero: d.numero || '',
        bairro: d.bairro || '',
        ramo_atividade: d.cnae_fiscal_descricao || '',
        telefone: d.ddd_telefone_1 ? `(${d.ddd_telefone_1.slice(0, 2)}) ${d.ddd_telefone_1.slice(2)}` : '',
        whatsapp: d.ddd_telefone_1 ? `55${d.ddd_telefone_1.replace(/\D/g, '')}` : '',
        email_fiscal: d.email || ''
      }
    }
  } catch {}

  // 3. Fallback ReceitaWS
  try {
    const res = await fetch(`https://receitaws.com.br/v1/cnpj/${cnpjLimpo}`, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'HubParatech/2.5' },
      signal: AbortSignal.timeout(5000)
    })
    if (res.ok) {
      const d = await res.json()
      if (d.status !== 'ERROR') {
        return {
          razao_social: d.nome || '',
          nome_fantasia: d.fantasia || d.nome || '',
          cidade: d.municipio || '',
          uf: d.uf || '',
          cep: d.cep || '',
          logradouro: d.logradouro || '',
          numero: d.numero || '',
          bairro: d.bairro || '',
          ramo_atividade: d.atividade_principal?.[0]?.text || '',
          telefone: d.telefone || '',
          whatsapp: (d.telefone || '').replace(/\D/g, ''),
          email_fiscal: d.email || ''
        }
      }
    }
  } catch {}

  return null
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { clienteId, atualizarTodos } = body

    if (clienteId) {
      // Atualiza 1 cliente específico
      const { data: cliente, error: cliErr } = await supabaseAdmin
        .from('clientes')
        .select('*')
        .eq('id', clienteId)
        .single()

      if (cliErr || !cliente) {
        return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
      }

      const docLimpo = limparDocumento(cliente.cnpj)
      if (!docLimpo || docLimpo.length !== 14) {
        return NextResponse.json({ error: 'CNPJ inválido para consulta' }, { status: 400 })
      }

      const dadosReais = await consultarCnpjPublico(docLimpo)
      if (!dadosReais || !dadosReais.razao_social) {
        return NextResponse.json({ error: 'Não foi possível obter dados na Receita Federal para este CNPJ' }, { status: 502 })
      }

      const payload: any = {
        razao_social: dadosReais.razao_social,
        nome_fantasia: dadosReais.nome_fantasia || dadosReais.razao_social,
        cidade: dadosReais.cidade || cliente.cidade,
        uf: dadosReais.uf || cliente.uf,
        cep: dadosReais.cep || cliente.cep,
        logradouro: dadosReais.logradouro || cliente.logradouro,
        numero: dadosReais.numero || cliente.numero,
        bairro: dadosReais.bairro || cliente.bairro,
        ramo_atividade: dadosReais.ramo_atividade || cliente.ramo_atividade
      }
      if (dadosReais.inscricao_estadual) payload.inscricao_estadual = dadosReais.inscricao_estadual
      if (dadosReais.telefone) payload.whatsapp = dadosReais.whatsapp || dadosReais.telefone
      if (dadosReais.email_fiscal) payload.email_fiscal = dadosReais.email_fiscal

      const { error: updErr } = await supabaseAdmin.from('clientes').update(payload).eq('id', clienteId)
      if (updErr) throw updErr

      return NextResponse.json({
        success: true,
        message: `Dados da Receita Federal atualizados para "${dadosReais.razao_social}"!`,
        dados: payload
      })

    } else if (atualizarTodos) {
      // Atualiza todos os clientes
      const { data: clientes, error: listErr } = await supabaseAdmin.from('clientes').select('id, cnpj, razao_social, nome_fantasia')
      if (listErr) throw listErr

      let atualizados = 0
      for (const c of clientes || []) {
        const docLimpo = limparDocumento(c.cnpj)
        if (!docLimpo || docLimpo.length !== 14) continue

        const dadosReais = await consultarCnpjPublico(docLimpo)
        if (dadosReais && dadosReais.razao_social) {
          const payload: any = {
            razao_social: dadosReais.razao_social,
            nome_fantasia: dadosReais.nome_fantasia || dadosReais.razao_social
          }
          if (dadosReais.cidade) payload.cidade = dadosReais.cidade
          if (dadosReais.uf) payload.uf = dadosReais.uf
          if (dadosReais.cep) payload.cep = dadosReais.cep
          if (dadosReais.logradouro) payload.logradouro = dadosReais.logradouro
          if (dadosReais.numero) payload.numero = dadosReais.numero
          if (dadosReais.bairro) payload.bairro = dadosReais.bairro
          if (dadosReais.inscricao_estadual) payload.inscricao_estadual = dadosReais.inscricao_estadual
          if (dadosReais.ramo_atividade) payload.ramo_atividade = dadosReais.ramo_atividade
          if (dadosReais.telefone) payload.whatsapp = dadosReais.whatsapp || dadosReais.telefone
          if (dadosReais.email_fiscal) payload.email_fiscal = dadosReais.email_fiscal

          await supabaseAdmin.from('clientes').update(payload).eq('id', c.id)
          atualizados++
        }
        await new Promise(r => setTimeout(r, 400))
      }

      return NextResponse.json({
        success: true,
        message: `${atualizados} clientes atualizados com dados oficiais da Receita Federal!`,
        total: clientes?.length || 0,
        atualizados
      })

    } else {
      return NextResponse.json({ error: 'Informe clienteId ou atualizarTodos' }, { status: 400 })
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 })
  }
}
