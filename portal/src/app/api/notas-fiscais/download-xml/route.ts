import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const tabela = searchParams.get('tabela')
    const id = searchParams.get('id')

    if (!tabela || !id) {
      return NextResponse.json({ error: 'Parâmetros tabela e id são obrigatórios.' }, { status: 400 })
    }

    if (!['nfce_saidas', 'nfe_saidas', 'nfe_entradas'].includes(tabela)) {
      return NextResponse.json({ error: 'Tabela inválida.' }, { status: 400 })
    }

    const supabaseAdmin = createAdminClient()

    // 1. Busca a nota fiscal
    const { data: nota, error: errNota } = await supabaseAdmin
      .from(tabela)
      .select('chave, numero, storage_path, cliente_id')
      .eq('id', id)
      .single()

    if (errNota || !nota) {
      return NextResponse.json({ error: 'Nota fiscal não encontrada.' }, { status: 404 })
    }

    if (!nota.storage_path) {
      return NextResponse.json({ error: 'Arquivo XML não localizado no armazenamento.' }, { status: 404 })
    }

    // 2. Baixa o XML do storage usando privilégios admin
    const { data: fileData, error: errStorage } = await supabaseAdmin.storage
      .from('xmls')
      .download(nota.storage_path)

    if (errStorage || !fileData) {
      return NextResponse.json({ error: 'Erro ao baixar arquivo do Storage: ' + (errStorage?.message || 'Arquivo indisponível') }, { status: 404 })
    }

    const arrayBuffer = await fileData.arrayBuffer()
    const fileName = `${nota.chave || nota.numero || 'nota_fiscal'}.xml`

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-cache'
      }
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro interno ao processar download.' }, { status: 500 })
  }
}
