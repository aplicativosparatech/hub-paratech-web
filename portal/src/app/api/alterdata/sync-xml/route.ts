import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';

export async function POST(req: Request) {
  const inicio = Date.now();
  const supabase = createAdminClient();

  try {
    const body = await req.json();
    const { xml_content, filename, cliente_id, contabilidade_id } = body;

    if (!xml_content) {
      return NextResponse.json({ error: 'Conteúdo do XML não informado' }, { status: 400 });
    }

    // 1. Busca configurações ativas da Alterdata
    const { data: configRow } = await supabase
      .from('integracoes')
      .select('*')
      .eq('provedor', 'alterdata')
      .maybeSingle();

    if (!configRow || !configRow.is_ativo) {
      return NextResponse.json({
        skipped: true,
        message: 'Integração Alterdata não está ativa nas configurações.'
      });
    }

    const credenciais = configRow.credenciais || {};
    const nfstockToken = credenciais.nfstock_token?.trim();

    if (!nfstockToken) {
      return NextResponse.json({
        error: 'Token do nf-stock não configurado na integração Alterdata.'
      }, { status: 400 });
    }

    if (credenciais.sync_xml_vendas === false) {
      return NextResponse.json({
        skipped: true,
        message: 'Envio automático de XMLs de vendas desabilitado nas configurações da Alterdata.'
      });
    }

    const xmlBytes = Buffer.from(xml_content, 'utf-8');
    const fileSize = xmlBytes.length;

    // 2. Passo 1: Obter URL de Upload no nf-stock
    const storageResp = await fetch('https://ms-importacao-service-nfstock.alterdatasoftware.com.br/storage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${nfstockToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        size: fileSize,
        extension: '.xml'
      })
    });

    if (!storageResp.ok) {
      const errText = await storageResp.text();
      // Registra falha de log
      await supabase.from('alterdata_sync_logs').insert({
        cliente_id: cliente_id || null,
        contabilidade_id: contabilidade_id || null,
        tipo_operacao: 'XML_UPLOAD',
        status: 'ERRO',
        identificador_externo: filename,
        payload_resumo: { filename, size: fileSize },
        mensagem_retorno: `Erro no passo 1 do nf-stock (${storageResp.status}): ${errText}`,
        duracao_ms: Date.now() - inicio
      });

      return NextResponse.json({
        success: false,
        error: `Erro ao solicitar upload no nf-stock: ${errText}`
      }, { status: 502 });
    }

    const storageData = await storageResp.json();
    const s3Url = storageData.url;
    const docId = storageData.id;

    if (!s3Url) {
      throw new Error('URL de upload S3 não retornada pelo nf-stock');
    }

    // 3. Passo 2: Upload binário direto no S3 da Alterdata
    const s3Resp = await fetch(s3Url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/xml'
      },
      body: xmlBytes
    });

    if (!s3Resp.ok) {
      const s3Err = await s3Resp.text();
      await supabase.from('alterdata_sync_logs').insert({
        cliente_id: cliente_id || null,
        contabilidade_id: contabilidade_id || null,
        tipo_operacao: 'XML_UPLOAD',
        status: 'ERRO',
        identificador_externo: docId || filename,
        payload_resumo: { filename, size: fileSize, docId },
        mensagem_retorno: `Erro no upload S3 (${s3Resp.status}): ${s3Err}`,
        duracao_ms: Date.now() - inicio
      });

      return NextResponse.json({
        success: false,
        error: `Falha ao transmitir bytes do XML para o S3: ${s3Err}`
      }, { status: 502 });
    }

    const duracaoMs = Date.now() - inicio;

    // 4. Registra sucesso no log de auditoria
    await supabase.from('alterdata_sync_logs').insert({
      cliente_id: cliente_id || null,
      contabilidade_id: contabilidade_id || null,
      tipo_operacao: 'XML_UPLOAD',
      status: 'SUCESSO',
      identificador_externo: docId || filename,
      payload_resumo: { filename, size: fileSize, docId },
      mensagem_retorno: 'XML transmitido com sucesso à nuvem nf-stock da Alterdata.',
      duracao_ms: duracaoMs
    });

    return NextResponse.json({
      success: true,
      alterdata_id: docId,
      filename,
      duracao_ms: duracaoMs,
      message: 'XML transmitido com sucesso ao nf-stock.'
    });

  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message || 'Erro inesperado ao sincronizar com Alterdata'
    }, { status: 500 });
  }
}
