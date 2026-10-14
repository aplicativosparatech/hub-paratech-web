import { ITENS_CEST_142, ItemCest } from './cestData';
import { avaliarReformaTributaria, TABELA_CSOSN } from './tabelasReferencia';
import { auditarItemComMultiIa, IaProviderConfig, ItemAuditoriaInput } from './multiIaEngine';

export interface ProdutoInputSugestor {
  id?: string;
  codigo?: string;
  descricao: string;
  valor?: number;
  ncmAtual?: string;
  cestAtual?: string;
  cfopAtual?: string;
  csosnAtual?: string;
  quantidade?: number;
}

export interface ProdutoTributadoOutput {
  id: string;
  codigo: string;
  descricao: string;
  valor: number;
  quantidade: number;
  ncm: string;
  cest: string;
  
  // CFOPs separados para Dentro e Fora do Estado
  cfopInterno: string;
  cfopInterestadual: string;
  descricaoCfopInterno: string;
  descricaoCfopInterestadual: string;
  
  // Enquadramento Estadual conforme CRT
  crtUtilizado: number; // 1 = Simples Nacional, 3 = Regime Normal
  csosn: string;
  descricaoCsosn: string;
  cstIcms: string;
  descricaoCstIcms: string;
  
  // Enquadramento Federal (PIS e COFINS)
  cstPis: string;
  aliqPis: number;
  cstCofins: string;
  aliqCofins: number;
  isMonofasico: boolean;
  tipoPisCofins: 'monofasico' | 'aliquota_zero' | 'tributado_integral' | 'simples_nacional';
  
  // Reforma Tributária (IBS, CBS e IVA Dual)
  ibsAliq: number;
  cbsAliq: number;
  ivaDual: number;
  cstIbsCbs: string;
  classificacaoReforma: string;
  temImpostoSeletivo: boolean;
  
  // Auditoria e Justificativa
  scoreConfianca: number;
  provedorIa: string;
  justificativa: string;
}

export interface ItemExtraidoOcr {
  id: string;
  codigo: string;
  descricao: string;
  valor: number;
  ncm: string;
  quantidade: number;
}

// Verifica se um NCM é reconhecidamente monofásico de PIS/COFINS
export function verificarMonofasico(ncm: string, descricao: string): boolean {
  const cleanNcm = (ncm || '').replace(/\D/g, '');
  const desc = (descricao || '').toUpperCase();

  // 1. Bebidas frias (Cervejas 2203, Refrigerantes 2202, Água mineral 2201, Energéticos 2202.99)
  if (cleanNcm.startsWith('2201') || cleanNcm.startsWith('2202') || cleanNcm.startsWith('2203')) {
    return true;
  }

  // 2. Medicamentos e Produtos Farmacêuticos (Capítulo 30)
  if (cleanNcm.startsWith('3001') || cleanNcm.startsWith('3002') || cleanNcm.startsWith('3003') || cleanNcm.startsWith('3004') || cleanNcm.startsWith('3005') || cleanNcm.startsWith('3006')) {
    return true;
  }

  // 3. Perfumaria, Cosméticos e Higiene Pessoal (Capítulo 33 e 3401)
  if (cleanNcm.startsWith('3303') || cleanNcm.startsWith('3304') || cleanNcm.startsWith('3305') || cleanNcm.startsWith('3307') || cleanNcm.startsWith('3401')) {
    return true;
  }

  // 4. Autopeças e Pneumáticos (Capítulo 87 e 4011)
  if (cleanNcm.startsWith('8708') || cleanNcm.startsWith('4011') || cleanNcm.startsWith('8409') || cleanNcm.startsWith('8507')) {
    return true;
  }

  // 5. Combustíveis e Lubrificantes (Capítulo 27)
  if (cleanNcm.startsWith('2710') || cleanNcm.startsWith('2711') || cleanNcm.startsWith('2207')) {
    return true;
  }

  return false;
}

// Classifica e tributa um produto único de acordo com o CRT
export async function tributarProdutoIndividual(
  prod: ProdutoInputSugestor,
  crt: number = 1,
  ufOrigem: string = 'MG',
  ufDestino: string = 'MG',
  configsIa: IaProviderConfig[] = [],
  usarIa: boolean = true
): Promise<ProdutoTributadoOutput> {
  const isSimples = crt === 1;
  const id = prod.id || `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const codigo = prod.codigo || '';
  const descricao = prod.descricao.trim();
  const valor = prod.valor || 0;
  const quantidade = prod.quantidade || 1;

  // 1. Invoca auditoria com Multi-IA ou fallback interno inteligente
  let respostaIa;
  if (usarIa && configsIa.some(c => c.is_ativo && (c.credenciais.api_key || c.credenciais.endpoint))) {
    const inputAuditoria: ItemAuditoriaInput = {
      codigo,
      descricao,
      ncmAtual: prod.ncmAtual,
      cestAtual: prod.cestAtual,
      cfopAtual: prod.cfopAtual,
      csosnAtual: prod.csosnAtual,
      valor,
      crt,
      uf: ufOrigem
    };
    const res = await auditarItemComMultiIa(inputAuditoria, configsIa, true);
    respostaIa = res.vencedor;
  }

  // 2. Determinação de NCM
  const ncm = respostaIa?.ncmSugerido || (prod.ncmAtual ? prod.ncmAtual.replace(/\D/g, '') : '22021000');
  const cleanNcm = ncm.replace(/\D/g, '');

  // 3. Verificação de Substituição Tributária (ST) e CEST pelo Convênio ICMS 142/2018
  const cestMatch = ITENS_CEST_142.find((c: ItemCest) => 
    c.ncm.replace(/\D/g, '') === cleanNcm || cleanNcm.startsWith(c.ncm.replace(/\D/g, ''))
  );
  const temSt = Boolean(cestMatch || respostaIa?.cestSugerido);
  const cest = respostaIa?.cestSugerido || (cestMatch ? cestMatch.cest.replace(/\D/g, '') : '');

  // 4. Determinação dos CFOPs Interno e Interestadual
  let cfopInterno = temSt ? '5405' : '5102';
  let descricaoCfopInterno = temSt 
    ? '5405 - Venda de mercadoria adquirida ou recebida de terceiros em operação com mercadoria sujeita ao regime de substituição tributária (substituído)'
    : '5102 - Venda de mercadoria adquirida ou recebida de terceiros';

  let cfopInterestadual = temSt ? '6404' : '6102';
  let descricaoCfopInterestadual = temSt
    ? '6404 - Venda de mercadoria sujeita ao regime de substituição tributária, cujo imposto já tenha sido retido anteriormente'
    : '6102 - Venda de mercadoria adquirida ou recebida de terceiros para fora do estado';

  // 5. Determinação de CSOSN (CRT 1) ou CST ICMS (CRT 3)
  let csosn = '';
  let descricaoCsosn = '';
  let cstIcms = '';
  let descricaoCstIcms = '';

  if (isSimples) {
    csosn = temSt ? '500' : '102';
    descricaoCsosn = temSt
      ? '500 - ICMS cobrado anteriormente por substituição tributária (substituído) ou por antecipação'
      : '102 - Tributada pelo Simples Nacional sem permissão de crédito';
    cstIcms = '';
    descricaoCstIcms = 'Não aplicável ao Simples Nacional (usa CSOSN)';
  } else {
    cstIcms = temSt ? '60' : '00';
    descricaoCstIcms = temSt
      ? '60 - ICMS cobrado anteriormente por substituição tributária'
      : '00 - Tributada integralmente';
    csosn = '';
    descricaoCsosn = 'Não aplicável ao Regime Normal (usa CST ICMS)';
  }

  // 6. Determinação de PIS e COFINS
  const isMonofasico = verificarMonofasico(cleanNcm, descricao);
  let cstPis = '01';
  let aliqPis = 1.65;
  let cstCofins = '01';
  let aliqCofins = 7.60;
  let tipoPisCofins: 'monofasico' | 'aliquota_zero' | 'tributado_integral' | 'simples_nacional' = 'tributado_integral';

  if (isMonofasico) {
    tipoPisCofins = 'monofasico';
    cstPis = '04'; // Operação Tributável Monofásica - Revenda a Alíquota Zero
    aliqPis = 0.0;
    cstCofins = '04';
    aliqCofins = 0.0;
  } else if (isSimples) {
    tipoPisCofins = 'simples_nacional';
    cstPis = '49'; // Outras Operações de Saída do Simples
    aliqPis = 0.0;
    cstCofins = '49';
    aliqCofins = 0.0;
  } else {
    // Alíquota zero de PIS/COFINS para Cesta Básica (Leis 10.925/2004 e 12.839/2013)
    const isAlqZero = cleanNcm.startsWith('1006') || cleanNcm.startsWith('0713') || cleanNcm.startsWith('0401') || cleanNcm.startsWith('1101') || cleanNcm.startsWith('1507');
    if (isAlqZero) {
      tipoPisCofins = 'aliquota_zero';
      cstPis = '06';
      aliqPis = 0.0;
      cstCofins = '06';
      aliqCofins = 0.0;
    } else {
      tipoPisCofins = 'tributado_integral';
      cstPis = '01';
      aliqPis = 1.65; // Padrão Lucro Real
      cstCofins = '01';
      aliqCofins = 7.60;
    }
  }

  // 7. Avaliação da Reforma Tributária (IBS e CBS - LC 214/2025)
  const reforma = avaliarReformaTributaria(cleanNcm, descricao);
  const ibsAliq = respostaIa?.ibsAliqEstimada ?? reforma.aliquotaIbsEst;
  const cbsAliq = respostaIa?.cbsAliqEstimada ?? reforma.aliquotaCbsEst;
  const ivaDual = respostaIa?.ivaDualTotal ?? reforma.aliquotaIvaDualEst;
  const cstIbsCbs = respostaIa?.cstIbsCbs || (reforma.regime === 'zero' ? '03' : reforma.regime === 'reduzido' ? '02' : '01');
  const classificacaoReforma = respostaIa?.classificacaoReforma || reforma.nomeRegime;
  const temImpostoSeletivo = reforma.temImpostoSeletivo;

  // 8. Justificativa e pontuação
  const scoreConfianca = respostaIa?.scoreConfianca || (cestMatch ? 90 : 80);
  const provedorIa = respostaIa?.nomeProvedor || 'Hub Paratech Fiscal Engine';
  const justificativa = respostaIa?.justificativa || (
    isMonofasico 
      ? `Produto com tributação concentrada/monofásica de PIS/COFINS (CST 04). ${temSt ? 'Enquadrado em Substituição Tributária (CEST ' + cest + ').' : 'Tributação de saída padrão.'} Enquadrado no regime de ${classificacaoReforma} da Reforma Tributária.`
      : `Classificação efetuada com base na NCM ${ncm}. ${temSt ? 'Sujeito ao regime de ST (Convênio ICMS 142/2018).' : 'Operação comum sem ICMS ST.'} Reforma Tributária: ${reforma.justificativa}`
  );

  return {
    id,
    codigo,
    descricao,
    valor,
    quantidade,
    ncm,
    cest,
    cfopInterno,
    cfopInterestadual,
    descricaoCfopInterno,
    descricaoCfopInterestadual,
    crtUtilizado: crt,
    csosn,
    descricaoCsosn,
    cstIcms,
    descricaoCstIcms,
    cstPis,
    aliqPis,
    cstCofins,
    aliqCofins,
    isMonofasico,
    tipoPisCofins,
    ibsAliq,
    cbsAliq,
    ivaDual,
    cstIbsCbs,
    classificacaoReforma,
    temImpostoSeletivo,
    scoreConfianca,
    provedorIa,
    justificativa
  };
}

// Processa lote de produtos
export async function tributarLoteProdutos(
  produtos: ProdutoInputSugestor[],
  crt: number = 1,
  ufOrigem: string = 'MG',
  ufDestino: string = 'MG',
  configsIa: IaProviderConfig[] = [],
  usarIa: boolean = true
): Promise<ProdutoTributadoOutput[]> {
  const resultados: ProdutoTributadoOutput[] = [];

  for (const prod of produtos) {
    if (!prod.descricao || !prod.descricao.trim()) continue;
    const tributado = await tributarProdutoIndividual(prod, crt, ufOrigem, ufDestino, configsIa, usarIa);
    resultados.push(tributado);
  }

  return resultados;
}

// ==========================================
// OCR MULTIMODAL COM IA (GEMINI OU OPENAI)
// ==========================================
export async function extrairProdutosDeFotoOcr(
  imageBase64: string,
  mimeType: string = 'image/jpeg',
  configsIa: IaProviderConfig[] = []
): Promise<{ itens: ItemExtraidoOcr[]; provedor: string; rawText?: string }> {
  // Limpa o prefixo data:image/...;base64, se houver
  const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');

  const promptOcr = `Você é um leitor de documentos fiscais e especialista em OCR para comércio e notas no Brasil.
Analise com atenção a imagem fornecida (foto de etiqueta de produto, cupom fiscal, nota fiscal impressa, folha com lista de produtos ou gôndola de supermercado).
Extraia todos os itens e produtos distintos identificáveis na imagem.

Retorne ESTRITAMENTE em formato JSON um array de objetos onde cada objeto possui:
[
  {
    "codigo": "código de barras, ref, sku ou vazio",
    "descricao": "nome ou descrição do produto limpo e legível",
    "valor": número do preço unitário se legível ou 0,
    "ncm": "NCM de 8 dígitos se visível ou vazio",
    "quantidade": número da quantidade se visível ou 1
  }
]

Não inclua formatação markdown, blocos de código nem explicações fora do array JSON.`;

  // 1. Tenta via Google Gemini Vision
  const geminiConfig = configsIa.find(c => c.is_ativo && c.provedor === 'gemini' && c.credenciais.api_key);
  if (geminiConfig && geminiConfig.credenciais.api_key) {
    try {
      const rawModel = geminiConfig.credenciais.model || 'gemini-flash-latest';
      const model = (rawModel.includes('2.0') || rawModel.includes('2.5') || rawModel.includes('1.5')) ? 'gemini-flash-latest' : rawModel;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiConfig.credenciais.api_key}`;

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: promptOcr },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: cleanBase64
                }
              }
            ]
          }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json'
          }
        }),
        signal: AbortSignal.timeout(20000)
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const parsed = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
          if (Array.isArray(parsed)) {
            const itens: ItemExtraidoOcr[] = parsed.map((item, idx) => ({
              id: `ocr_${Date.now()}_${idx + 1}`,
              codigo: String(item.codigo || ''),
              descricao: String(item.descricao || `Item ${idx + 1}`).trim(),
              valor: Number(item.valor) || 0,
              ncm: String(item.ncm || '').replace(/\D/g, ''),
              quantidade: Number(item.quantidade) || 1
            }));
            return { itens, provedor: `Google Gemini (${model})` };
          }
        }
      }
    } catch (err: any) {
      console.warn('Erro no OCR via Gemini:', err.message);
    }
  }

  // 2. Tenta via OpenAI Vision (GPT-4o ou GPT-4o-mini)
  const openAiConfig = configsIa.find(c => c.is_ativo && c.provedor === 'openai' && c.credenciais.api_key);
  if (openAiConfig && openAiConfig.credenciais.api_key) {
    try {
      const model = openAiConfig.credenciais.model || 'gpt-4o-mini';
      const url = 'https://api.openai.com/v1/chat/completions';

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openAiConfig.credenciais.api_key}`
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: promptOcr },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${mimeType};base64,${cleanBase64}`
                  }
                }
              ]
            }
          ],
          response_format: { type: 'json_object' }
        }),
        signal: AbortSignal.timeout(20000)
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content;
        if (text) {
          const parsed = JSON.parse(text);
          const lista = Array.isArray(parsed) ? parsed : (parsed.itens || parsed.produtos || Object.values(parsed)[0]);
          if (Array.isArray(lista)) {
            const itens: ItemExtraidoOcr[] = lista.map((item: any, idx: number) => ({
              id: `ocr_${Date.now()}_${idx + 1}`,
              codigo: String(item.codigo || ''),
              descricao: String(item.descricao || `Item ${idx + 1}`).trim(),
              valor: Number(item.valor) || 0,
              ncm: String(item.ncm || '').replace(/\D/g, ''),
              quantidade: Number(item.quantidade) || 1
            }));
            return { itens, provedor: `OpenAI Vision (${model})` };
          }
        }
      }
    } catch (err: any) {
      console.warn('Erro no OCR via OpenAI:', err.message);
    }
  }

  // 3. Fallback: Se nenhuma IA com visão estiver ativa
  throw new Error(
    'Para utilizar o OCR de foto de produtos, configure e ative uma chave de IA com suporte a visão (Google Gemini gratuito ou OpenAI) na aba Integrações (APIs).'
  );
}
