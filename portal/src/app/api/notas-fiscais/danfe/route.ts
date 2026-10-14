import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { parseXmlParaDanfe } from '@/utils/danfe/danfeParser';
import { renderDanfeNfeHtml, renderDanfeNfceHtml } from '@/utils/danfe/danfeHtmlRenderer';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const tabela = searchParams.get('tabela') || 'nfce_saidas';

    if (!id) {
      return new NextResponse('ID da nota não fornecido.', { status: 400 });
    }

    if (!['nfce_saidas', 'nfe_saidas', 'nfe_entradas'].includes(tabela)) {
      return new NextResponse('Tabela inválida.', { status: 400 });
    }

    const supabaseAdmin = createAdminClient();

    // 1. Busca a nota fiscal
    const { data: nota, error: errNota } = await supabaseAdmin
      .from(tabela)
      .select('id, chave, numero, storage_path, cliente_id')
      .eq('id', id)
      .single();

    if (errNota || !nota) {
      return new NextResponse('Nota fiscal não encontrada.', { status: 404 });
    }

    if (!nota.storage_path) {
      return new NextResponse('Arquivo XML da nota fiscal não localizado no armazenamento.', { status: 404 });
    }

    // 2. Busca o cadastro do cliente para obter a logomarca oficial (logo_url)
    let logoUrl: string | undefined = undefined;
    if (nota.cliente_id) {
      const { data: cliente } = await supabaseAdmin
        .from('clientes')
        .select('logo_url, razao_social')
        .eq('id', nota.cliente_id)
        .single();

      if (cliente && cliente.logo_url) {
        logoUrl = cliente.logo_url;
      }
    }

    // 3. Baixa o XML original do Storage do Supabase
    const { data: fileData, error: errStorage } = await supabaseAdmin.storage
      .from('xmls')
      .download(nota.storage_path);

    if (errStorage || !fileData) {
      return new NextResponse('Arquivo XML não pôde ser baixado do Storage: ' + (errStorage?.message || ''), { status: 500 });
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const xmlString = Buffer.from(arrayBuffer).toString('utf-8');

    // 4. Parse dos dados da DANFE
    const danfeData = await parseXmlParaDanfe(xmlString, logoUrl);

    // 5. Renderiza de acordo com o modelo (55 = NF-e A4, 65 = NFC-e Bobina/Cupom)
    const html = danfeData.modelo === '65' 
      ? renderDanfeNfceHtml(danfeData) 
      : renderDanfeNfeHtml(danfeData);

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });

  } catch (error: any) {
    console.error('Erro ao gerar DANFE:', error);
    return new NextResponse(`Erro ao gerar DANFE: ${error.message}`, { status: 500 });
  }
}
