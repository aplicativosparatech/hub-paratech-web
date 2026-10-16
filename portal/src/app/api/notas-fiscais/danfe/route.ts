import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { parseXmlParaDanfe } from '@/utils/danfe/danfeParser';
import { renderDanfeNfeHtml, renderDanfeNfceHtml } from '@/utils/danfe/danfeHtmlRenderer';
import { gerarXmlResumoDfe } from '@/utils/sefazDfeService';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const tabela = searchParams.get('tabela') || 'nfce_saidas';

    if (!id) {
      return new NextResponse('ID da nota não fornecido.', { status: 400 });
    }

    if (!['nfce_saidas', 'nfe_saidas', 'nfe_entradas', 'dfe_notas_destinadas'].includes(tabela)) {
      return new NextResponse('Tabela inválida.', { status: 400 });
    }

    const supabaseAdmin = createAdminClient();

    // 1. Busca a nota fiscal completa
    const { data: notaData, error: errNota } = await supabaseAdmin
      .from(tabela)
      .select('*')
      .eq('id', id)
      .single();

    if (errNota || !notaData) {
      return new NextResponse('Nota fiscal não encontrada.', { status: 404 });
    }

    const nota = notaData as Record<string, any>;

    // 2. Busca o cadastro do cliente para obter a logomarca oficial (logo_url)
    let logoUrl: string | undefined = undefined;
    if (nota.cliente_id) {
      const { data: cliente } = await supabaseAdmin
        .from('clientes')
        .select('logo_url, razao_social')
        .eq('id', nota.cliente_id)
        .single();

      if (cliente && (cliente as any).logo_url) {
        logoUrl = (cliente as any).logo_url;
      }
    }

    // 3. Obtém o XML original da nota
    let xmlString: string | null = nota.xml_completo || null;

    if (!xmlString && nota.storage_path) {
      const { data: fileData, error: errStorage } = await supabaseAdmin.storage
        .from('xmls')
        .download(nota.storage_path);

      if (!errStorage && fileData) {
        const arrayBuffer = await fileData.arrayBuffer();
        xmlString = Buffer.from(arrayBuffer).toString('utf-8');
      }
    }

    // 4. Se ainda não tiver o XML completo gravado, gera o XML estruturado oficial
    // garantindo visualização imediata do DANFE sem retornar erro
    if (!xmlString) {
      xmlString = gerarXmlResumoDfe({
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
      });

      // Salva de forma resiliente
      if (tabela === 'dfe_notas_destinadas') {
        try {
          await supabaseAdmin
            .from('dfe_notas_destinadas')
            .update({ xml_completo: xmlString, updated_at: new Date().toISOString() })
            .eq('id', id);
        } catch (e: any) {
          console.warn('Erro ao atualizar xml_completo no DANFE:', e?.message || e);
        }
      }
    }

    // 5. Parse dos dados da DANFE
    const danfeData = await parseXmlParaDanfe(xmlString, logoUrl);

    // 6. Renderiza de acordo com o modelo (55 = NF-e A4, 65 = NFC-e Bobina/Cupom)
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
