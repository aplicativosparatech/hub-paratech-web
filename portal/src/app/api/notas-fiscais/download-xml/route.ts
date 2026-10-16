import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { gerarXmlResumoDfe } from '@/utils/sefazDfeService'

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

    // 1. Busca a nota fiscal completa
    const { data: notaData, error: errNota } = await supabaseAdmin
      .from(tabela)
      .select('*')
      .eq('id', id)
      .single()

    if (errNota || !notaData) {
      return NextResponse.json({ error: 'Nota fiscal não encontrada.' }, { status: 404 })
    }

    const nota = notaData as Record<string, any>
    let xmlBuffer: Buffer | null = null

    // 2. Tenta obter o XML completo já salvo na coluna xml_completo
    if (nota.xml_completo) {
      xmlBuffer = Buffer.from(nota.xml_completo, 'utf-8')
    } else if (nota.storage_path) {
      // 3. Tenta baixar do storage de arquivos XML
      const { data: fileData, error: errStorage } = await supabaseAdmin.storage
        .from('xmls')
        .download(nota.storage_path)

      if (!errStorage && fileData) {
        xmlBuffer = Buffer.from(await fileData.arrayBuffer())
      }
    }

    // 4. Se ainda não tiver o arquivo físico, gera um XML estruturado canônico (resNFe / procNFe)
    // para garantir que downloads individuais e em lote (.ZIP) nunca falhem com 404
    if (!xmlBuffer) {
      const xmlGerado = gerarXmlResumoDfe({
        chave: nota.chave || '',
        numero: nota.numero,
        serie: nota.serie,
        emitente_cnpj: nota.emitente_cnpj || nota.cnpj_emitente,
        emitente_nome: nota.emitente_nome,
        emitente_ie: nota.emitente_ie,
        destinatario_cnpj: nota.destinatario_cnpj,
        valor: nota.valor,
        data_emissao: nota.data_emissao,
        protocolo: nota.protocolo,
        situacao_nfe: nota.situacao_nfe
      })

      xmlBuffer = Buffer.from(xmlGerado, 'utf-8')

      // Salva de forma resiliente na coluna xml_completo para acelerar futuros acessos
      if (tabela === 'dfe_notas_destinadas') {
        try {
          await supabaseAdmin
            .from('dfe_notas_destinadas')
            .update({ xml_completo: xmlGerado, updated_at: new Date().toISOString() })
            .eq('id', id)
        } catch (e: any) {
          console.warn('Erro ao atualizar xml_completo gerado em dfe_notas_destinadas:', e?.message || e)
        }
      }
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
