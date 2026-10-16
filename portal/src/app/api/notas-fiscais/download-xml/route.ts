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

    if (!['nfce_saidas', 'nfe_saidas', 'nfe_entradas', 'dfe_notas_destinadas'].includes(tabela)) {
      return NextResponse.json({ error: 'Tabela inválida.' }, { status: 400 })
    }

    const supabaseAdmin = createAdminClient()

    // 1. Busca a nota fiscal
    const { data: nota, error: errNota } = await supabaseAdmin
      .from(tabela)
      .select('chave, numero, storage_path, cliente_id, xml_completo')
      .eq('id', id)
      .single()

    if (errNota || !nota) {
      return NextResponse.json({ error: 'Nota fiscal não encontrada.' }, { status: 404 })
    }

    let xmlBuffer: Buffer | null = null

    if ((nota as any).xml_completo) {
      xmlBuffer = Buffer.from((nota as any).xml_completo, 'utf-8')
    } else if (nota.storage_path) {
      // Baixa o XML do storage usando privilégios admin
      const { data: fileData, error: errStorage } = await supabaseAdmin.storage
        .from('xmls')
        .download(nota.storage_path)

      if (errStorage || !fileData) {
        return NextResponse.json({ error: 'Erro ao baixar arquivo do Storage: ' + (errStorage?.message || 'Arquivo indisponível') }, { status: 404 })
      }

      xmlBuffer = Buffer.from(await fileData.arrayBuffer())
    }

    if (!xmlBuffer) {
      return NextResponse.json({ error: 'Arquivo XML não localizado.' }, { status: 404 })
    }

    const fileName = `${nota.chave || nota.numero || 'nota_fiscal'}.xml`

    return new NextResponse(new Uint8Array(xmlBuffer), {
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
