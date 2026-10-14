import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { 
  inspecionarArquivo, 
  extrairItensParaAuditoria, 
  gerarPlanilhaSaneada, 
  gerarScriptSqlUpdate, 
  gerarJsonSaneado, 
  gerarSqliteSaneado,
  MapeamentoColunas, 
  ItemSaneadoRetorno 
} from '@/utils/tributario/fileParsers';
import { auditarItemComMultiIa, IaProviderConfig } from '@/utils/tributario/multiIaEngine';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const acao = (formData.get('acao') as string) || 'inspecionar';
    const file = formData.get('arquivo') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const nomeArquivo = file.name;

    // 1. AÇÃO: INSPEÇÃO DO ARQUIVO (Retorna tabelas e colunas para mapeamento)
    if (acao === 'inspecionar') {
      const inspecao = await inspecionarArquivo(buffer, nomeArquivo);
      return NextResponse.json({ success: true, inspecao });
    }

    // 2. AÇÃO: AUDITAR E SANEAR ARQUIVO
    if (acao === 'auditar') {
      const clienteId = formData.get('cliente_id') as string;
      const tabelaEscolhida = formData.get('tabela_escolhida') as string;
      const mapeamentoRaw = formData.get('mapeamento') as string;
      const formatoDownload = (formData.get('formato_download') as string) || 'xlsx';

      if (!clienteId) {
        return NextResponse.json({ error: 'Selecione um cliente para vincular o CRT e regime fiscal.' }, { status: 400 });
      }

      let mapeamento: MapeamentoColunas = {};
      try {
        mapeamento = JSON.parse(mapeamentoRaw || '{}');
      } catch {
        return NextResponse.json({ error: 'Mapeamento de colunas inválido.' }, { status: 400 });
      }

      const supabase = createAdminClient();

      // Busca dados do cliente (Regime Tributário e UF)
      const { data: cliente, error: errCli } = await supabase
        .from('clientes')
        .select('id, razao_social, nome_fantasia, cnpj, regime_tributario, uf')
        .eq('id', clienteId)
        .single();

      if (errCli || !cliente) {
        return NextResponse.json({ error: 'Cliente não encontrado no sistema.' }, { status: 404 });
      }

      const crtCliente = (cliente.regime_tributario === 'simples' || cliente.regime_tributario === 'simples_nacional') ? 1 : 3;
      const ufCliente = cliente.uf || 'MG';

      // Busca integrações de IA ativas
      const { data: integracoes } = await supabase
        .from('integracoes')
        .select('*')
        .in('tipo', ['ia', 'mcp', 'ia_config']);

      const configsIa: IaProviderConfig[] = (integracoes || []).map(i => ({
        provedor: i.provedor,
        tipo: i.tipo,
        is_ativo: i.is_ativo,
        credenciais: i.credenciais || {}
      }));

      const configGeral = configsIa.find(c => c.provedor === 'ia_geral');
      const modoConsenso = configGeral ? configGeral.credenciais.modo_consenso !== false : true;

      // Extrai os itens do arquivo com base no mapeamento
      const itensExtraidos = await extrairItensParaAuditoria(buffer, nomeArquivo, tabelaEscolhida, mapeamento);

      if (itensExtraidos.length === 0) {
        return NextResponse.json({ error: 'Nenhum item encontrado no arquivo com o mapeamento fornecido.' }, { status: 400 });
      }

      // Processa a auditoria de cada item com Multi-IA
      const itensSaneados: ItemSaneadoRetorno[] = [];
      let totalInconsistencias = 0;
      let totalMonofasicos = 0;

      // Limitador de processamento para evitar estouro de timeout HTTP (processa até 200 itens por lote na tela)
      const LIMITE_ITENS = 250;
      const itensProcessar = itensExtraidos.slice(0, LIMITE_ITENS);

      for (const item of itensProcessar) {
        const resultadoIa = await auditarItemComMultiIa(
          {
            codigo: item.codigoOriginal,
            descricao: item.descricaoOriginal,
            ncmAtual: item.ncmOriginal,
            cestAtual: item.cestOriginal,
            cfopAtual: item.cfopOriginal,
            csosnAtual: item.csosnCstOriginal,
            valor: item.valorOriginal,
            crt: crtCliente,
            uf: ufCliente
          },
          configsIa,
          modoConsenso
        );

        const v = resultadoIa.vencedor;

        // Compara se houve inconsistência ou necessidade de ajuste
        const ncmMudou = Boolean(item.ncmOriginal && item.ncmOriginal.replace(/\D/g, '') !== v.ncmSugerido.replace(/\D/g, ''));
        const ncmEstavaVazio = !item.ncmOriginal;
        const cestMudou = Boolean(v.cestSugerido && (!item.cestOriginal || item.cestOriginal.replace(/\D/g, '') !== v.cestSugerido.replace(/\D/g, '')));
        const cfopMudou = Boolean(item.cfopOriginal && item.cfopOriginal.replace(/\D/g, '') !== v.cfopSugerido);
        const csosnMudou = Boolean(item.csosnCstOriginal && item.csosnCstOriginal.replace(/\D/g, '') !== v.csosnSugerido);

        const houveInconsistencia = Boolean(ncmMudou || ncmEstavaVazio || cestMudou || cfopMudou || csosnMudou);

        if (houveInconsistencia) totalInconsistencias++;
        if (v.isMonofasico) totalMonofasicos++;

        itensSaneados.push({
          ...item,
          ncmSugerido: v.ncmSugerido,
          cestSugerido: v.cestSugerido,
          cfopSugerido: v.cfopSugerido,
          csosnSugerido: v.csosnSugerido,
          cstPisSugerido: v.cstPisSugerido,
          cstCofinsSugerido: v.cstCofinsSugerido,
          ibsAliq: v.ibsAliqEstimada,
          cbsAliq: v.cbsAliqEstimada,
          ivaDual: v.ivaDualTotal,
          classificacaoReforma: v.classificacaoReforma,
          isMonofasico: v.isMonofasico,
          scoreConfianca: v.scoreConfianca,
          provedorIa: v.nomeProvedor,
          justificativa: v.justificativa,
          houveInconsistencia
        });
      }

      // Gera arquivos de retorno conforme solicitado
      let arquivoDownloadBase64 = '';
      let nomeArquivoDownload = '';

      if (formatoDownload === 'xlsx') {
        const bufXlsx = gerarPlanilhaSaneada(itensSaneados);
        arquivoDownloadBase64 = bufXlsx.toString('base64');
        nomeArquivoDownload = `${nomeArquivo.replace(/\.[^/.]+$/, '')}_SANEADO_HUB.xlsx`;
      } else if (formatoDownload === 'sql') {
        const sqlScript = gerarScriptSqlUpdate(tabelaEscolhida || 'produtos', itensSaneados, mapeamento);
        arquivoDownloadBase64 = Buffer.from(sqlScript, 'utf-8').toString('base64');
        nomeArquivoDownload = `${nomeArquivo.replace(/\.[^/.]+$/, '')}_UPDATE_SEGURO.sql`;
      } else if (formatoDownload === 'json') {
        const jsonStr = gerarJsonSaneado(itensSaneados);
        arquivoDownloadBase64 = Buffer.from(jsonStr, 'utf-8').toString('base64');
        nomeArquivoDownload = `${nomeArquivo.replace(/\.[^/.]+$/, '')}_SANEADO.json`;
      } else if (formatoDownload === 'sqlite') {
        const bufSqlite = await gerarSqliteSaneado(buffer, tabelaEscolhida || 'produtos', itensSaneados, mapeamento);
        arquivoDownloadBase64 = bufSqlite.toString('base64');
        nomeArquivoDownload = `${nomeArquivo.replace(/\.[^/.]+$/, '')}_CORRIGIDO.db`;
      }

      return NextResponse.json({
        success: true,
        cliente: {
          id: cliente.id,
          nome: cliente.razao_social || cliente.nome_fantasia || 'Cliente',
          cnpj: cliente.cnpj,
          crt: crtCliente,
          regime: crtCliente === 1 ? 'Simples Nacional' : 'Regime Normal',
          uf: ufCliente
        },
        estatisticas: {
          totalItensArquivo: itensExtraidos.length,
          itensAuditadosNesteLote: itensSaneados.length,
          inconsistenciasEncontradas: totalInconsistencias,
          itensEmConformidade: itensSaneados.length - totalInconsistencias,
          produtosMonofasicos: totalMonofasicos,
          percentualConformidade: Math.round(((itensSaneados.length - totalInconsistencias) / itensSaneados.length) * 100)
        },
        itens: itensSaneados,
        download: {
          nomeArquivo: nomeArquivoDownload,
          formato: formatoDownload,
          base64: arquivoDownloadBase64
        }
      });
    }

    return NextResponse.json({ error: 'Ação não reconhecida.' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro ao processar arquivo.' }, { status: 500 });
  }
}
