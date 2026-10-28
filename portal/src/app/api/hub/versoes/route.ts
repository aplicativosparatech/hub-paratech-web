import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const sistemaId = searchParams.get('sistema_id')
    const supabase = createAdminClient()

    let query = supabase
      .from('versoes_sistemas')
      .select('*')
      .order('criado_em', { ascending: false })

    if (sistemaId) {
      query = query.eq('sistema_id', sistemaId.toLowerCase())
    }

    const { data: versoes, error: errVersoes } = await query
    if (errVersoes) throw errVersoes

    // Busca telemetria agrupada para saber quantos clientes estão ativos em cada versão
    const { data: telemetria, error: errTele } = await supabase
      .from('telemetria_versoes_clientes')
      .select('sistema_id, versao_atual, ultima_checagem, cliente_id, clientes(razao_social, nome_fantasia)')

    return NextResponse.json({
      versoes: versoes || [],
      telemetria: telemetria || []
    })
  } catch (error: any) {
    console.error('Erro ao listar versões:', error)
    return NextResponse.json({ error: error.message || 'Erro ao listar versões' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { sistema_id, versao, build_number, obrigatoria, url_download, changelog, sha256, tamanho_bytes, canal } = body

    if (!sistema_id || !versao || !url_download) {
      return NextResponse.json({ error: 'sistema_id, versao e url_download são obrigatórios' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('versoes_sistemas')
      .insert([
        {
          sistema_id: sistema_id.toLowerCase().trim(),
          versao: versao.trim(),
          build_number: parseInt(build_number || '1', 10),
          obrigatoria: !!obrigatoria,
          url_download: url_download.trim(),
          changelog: changelog || null,
          sha256: sha256 || null,
          tamanho_bytes: tamanho_bytes ? parseInt(tamanho_bytes, 10) : null,
          canal: canal || 'stable',
          ativo: true
        }
      ])
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ sucesso: true, versao: data })
  } catch (error: any) {
    console.error('Erro ao cadastrar versão:', error)
    return NextResponse.json({ error: error.message || 'Erro ao cadastrar versão' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { id, ativo, obrigatoria, changelog, url_download, versao, build_number } = body

    if (!id) {
      return NextResponse.json({ error: 'ID da versão é obrigatório' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const updates: any = { atualizado_em: new Date().toISOString() }

    if (ativo !== undefined) updates.ativo = ativo
    if (obrigatoria !== undefined) updates.obrigatoria = obrigatoria
    if (changelog !== undefined) updates.changelog = changelog
    if (url_download !== undefined) updates.url_download = url_download
    if (versao !== undefined) updates.versao = versao
    if (build_number !== undefined) updates.build_number = parseInt(build_number, 10)

    const { data, error } = await supabase
      .from('versoes_sistemas')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ sucesso: true, versao: data })
  } catch (error: any) {
    console.error('Erro ao atualizar versão:', error)
    return NextResponse.json({ error: error.message || 'Erro ao atualizar versão' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { error } = await supabase.from('versoes_sistemas').delete().eq('id', id)
    if (error) throw error

    return NextResponse.json({ sucesso: true })
  } catch (error: any) {
    console.error('Erro ao excluir versão:', error)
    return NextResponse.json({ error: error.message || 'Erro ao excluir versão' }, { status: 500 })
  }
}
