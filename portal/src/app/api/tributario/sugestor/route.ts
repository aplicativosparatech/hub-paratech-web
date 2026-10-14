import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { 
  tributarProdutoIndividual, 
  tributarLoteProdutos, 
  extrairProdutosDeFotoOcr,
  ProdutoInputSugestor 
} from '@/utils/tributario/sugestorEngine';
import { IaProviderConfig } from '@/utils/tributario/multiIaEngine';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      acao, 
      produto, 
      produtos, 
      crt = 1, 
      uf_origem = 'MG', 
      uf_destino = 'MG',
      usar_ia = true,
      image_base64,
      mime_type = 'image/jpeg'
    } = body;

    const supabase = createAdminClient();

    // 1. Carrega integrações ativas de IA cadastradas no sistema
    let configsIa: IaProviderConfig[] = [];
    try {
      const { data: integracoes } = await supabase
        .from('integracoes')
        .select('*')
        .eq('is_ativo', true);

      if (integracoes && integracoes.length > 0) {
        configsIa = integracoes.map(i => ({
          provedor: i.provedor,
          tipo: i.tipo,
          is_ativo: i.is_ativo,
          credenciais: i.credenciais || {}
        }));
      }
    } catch (err: any) {
      console.warn('Aviso: Não foi possível carregar integrações do banco:', err.message);
    }

    // AÇÃO 1: OCR EM FOTO / IMAGEM
    if (acao === 'ocr_foto') {
      if (!image_base64) {
        return NextResponse.json({ error: 'Nenhuma imagem fornecida para o OCR.' }, { status: 400 });
      }

      const resOcr = await extrairProdutosDeFotoOcr(image_base64, mime_type, configsIa);
      return NextResponse.json({
        success: true,
        itens: resOcr.itens,
        provedor: resOcr.provedor,
        totalItens: resOcr.itens.length
      });
    }

    // AÇÃO 2: TRIBUTAR PRODUTO INDIVIDUAL
    if (acao === 'buscar_unitario') {
      if (!produto || !produto.descricao || !produto.descricao.trim()) {
        return NextResponse.json({ error: 'Descrição do produto é obrigatória.' }, { status: 400 });
      }

      const resultado = await tributarProdutoIndividual(
        produto,
        Number(crt) || 1,
        uf_origem,
        uf_destino,
        configsIa,
        usar_ia !== false
      );

      return NextResponse.json({
        success: true,
        resultado
      });
    }

    // AÇÃO 3: TRIBUTAR LOTE DE PRODUTOS (Planilha, TXT ou itens do OCR)
    if (acao === 'buscar_lote') {
      const lista: ProdutoInputSugestor[] = Array.isArray(produtos) ? produtos : [];
      if (lista.length === 0) {
        return NextResponse.json({ error: 'Nenhum produto fornecido na lista.' }, { status: 400 });
      }

      // Limita a 500 itens por lote para evitar timeouts
      const listaLimitada = lista.slice(0, 500);

      const resultados = await tributarLoteProdutos(
        listaLimitada,
        Number(crt) || 1,
        uf_origem,
        uf_destino,
        configsIa,
        usar_ia !== false
      );

      return NextResponse.json({
        success: true,
        totalProcessado: resultados.length,
        resultados
      });
    }

    return NextResponse.json({ error: 'Ação não reconhecida.' }, { status: 400 });
  } catch (error: any) {
    console.error('Erro na rota /api/tributario/sugestor:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro interno ao processar sugestão tributária.' },
      { status: 500 }
    );
  }
}
