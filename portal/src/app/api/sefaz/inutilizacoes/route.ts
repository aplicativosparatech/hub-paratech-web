import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseAdmin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseKey)

// Exclusão / Descarte de ocorrências e erros de inutilização
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const cliente_id = searchParams.get('cliente_id')
    const limpar_erros = searchParams.get('limpar_erros') === 'true'
    const modelo = searchParams.get('modelo')
    const serie = searchParams.get('serie')
    const numero_inicial = searchParams.get('numero_inicial')

    // 1. Excluir por ID específico
    if (id) {
      const { error } = await supabaseAdmin
        .from('inutilizacoes_saidas')
        .delete()
        .eq('id', id)

      if (error) {
        throw new Error(error.message)
      }

      return NextResponse.json({ success: true, message: 'Registro de inutilização removido com sucesso.' })
    }

    // 2. Limpar todos os erros/rejeições de um cliente
    if (cliente_id && limpar_erros) {
      const { error } = await supabaseAdmin
        .from('inutilizacoes_saidas')
        .delete()
        .eq('cliente_id', cliente_id)
        .not('status_sefaz', 'in', '(102,204,563)')

      if (error) {
        throw new Error(error.message)
      }

      return NextResponse.json({ success: true, message: 'Todas as ocorrências e erros rejeitados foram descartados.' })
    }

    // 3. Excluir por faixa específica rejeitada
    if (cliente_id && modelo && serie && numero_inicial) {
      const { error } = await supabaseAdmin
        .from('inutilizacoes_saidas')
        .delete()
        .eq('cliente_id', cliente_id)
        .eq('modelo', modelo)
        .eq('serie', serie)
        .eq('numero_inicial', parseInt(numero_inicial, 10))
        .not('status_sefaz', 'in', '(102,204,563)')

      if (error) {
        throw new Error(error.message)
      }

      return NextResponse.json({ success: true, message: 'Ocorrência descartada com sucesso.' })
    }

    return NextResponse.json({ error: 'Parâmetros insuficientes para exclusão.' }, { status: 400 })
  } catch (err: any) {
    console.error('Erro ao excluir inutilização:', err)
    return NextResponse.json({
      success: false,
      error: 'Falha ao remover registro: ' + (err.message || '')
    }, { status: 500 })
  }
}
