import { ITENS_CEST_142, ItemCest } from './cestData';
import { avaliarReformaTributaria } from './tabelasReferencia';

export interface IaProviderConfig {
  provedor: string;
  tipo: string;
  is_ativo: boolean;
  credenciais: {
    api_key?: string;
    model?: string;
    endpoint?: string;
    token?: string;
    nome?: string;
    modo_consenso?: boolean;
    habilitar_ia_xmls?: boolean;
    habilitar_reforma_xmls?: boolean;
    temperatura?: number;
  };
}

export interface ItemAuditoriaInput {
  codigo?: string;
  descricao: string;
  ncmAtual?: string;
  cestAtual?: string;
  cfopAtual?: string;
  csosnAtual?: string;
  cstPisAtual?: string;
  cstCofinsAtual?: string;
  valor?: number;
  crt: number; // 1 = Simples, 3 = Regime Normal
  uf?: string;
}

export interface RespostaIaItem {
  provedor: string;
  nomeProvedor: string;
  ncmSugerido: string;
  cestSugerido: string;
  cfopSugerido: string;
  csosnSugerido: string;
  cstPisSugerido: string;
  cstCofinsSugerido: string;
  ibsAliqEstimada: number;
  cbsAliqEstimada: number;
  ivaDualTotal: number;
  cstIbsCbs: string;
  classificacaoReforma: string;
  isMonofasico: boolean;
  scoreConfianca: number; // 0 a 100
  justificativa: string;
}

export interface ResultadoConsenso {
  vencedor: RespostaIaItem;
  respostasDetalhadas: RespostaIaItem[];
  modoConsensoUtilizado: boolean;
  totalIasConsultadas: number;
  concordanciaPercentual: number;
}

// Prompt especializado em tributação brasileira, Convênio ICMS 142/2018 e Reforma Tributária (IBS/CBS - LC 214/2024)
function buildSystemPrompt(crt: number, uf: string = 'MG'): string {
  const regimeStr = crt === 1 ? 'Simples Nacional (usa CSOSN 101, 102, 500, etc.)' : 'Regime Normal / Lucro Real / Presumido (usa CST 00, 10, 60, etc.)';
  return `Você é um Auditor Tributário e Fiscal Sênior especialista na Legislação Brasileira, tributação do estado de ${uf}, tabela NCM/TIPI, Convênio ICMS 142/2018 (CEST e Substituição Tributária), regime ${regimeStr} e no novo Sistema Tributário Nacional da Reforma Tributária (Emenda Constitucional 132/2023 e Lei Complementar 214/2024 - IBS, CBS e IVA Dual).

Analise o item de mercadoria fornecido e responda ESTRITAMENTE em formato JSON com as seguintes chaves num objeto único:
{
  "ncm": "8 dígitos numéricos válidos",
  "cest": "7 dígitos numéricos válidos ou vazio se não tiver ST",
  "cfop": "CFOP padrão para saída interna no estado (ex: 5102 para tributado integralmente, 5405 para ICMS ST)",
  "csosn_cst": "Código de situação tributária adequado ao regime ${crt === 1 ? 'CSOSN do Simples' : 'CST Normal'}",
  "cst_pis": "CST PIS (ex: 01, 04 para monofásico, 06 para alíquota zero, 49, 99)",
  "cst_cofins": "CST COFINS (ex: 01, 04 para monofásico, 06 para alíquota zero, 49, 99)",
  "is_monofasico": true ou false,
  "ibs_aliq": número percentual da alíquota estimada de IBS para este produto no novo IVA (ex: 0 para cesta básica, 8.8 para reduzida, 17.7 para padrão),
  "cbs_aliq": número percentual da alíquota estimada de CBS para este produto (ex: 0 para cesta básica, 4.4 para reduzida, 8.8 para padrão),
  "cst_ibs_cbs": "CST sugerido no novo modelo IBS/CBS (ex: 01 Tributada Padrão, 02 Alíquota Reduzida, 03 Imune/Isenta)",
  "classificacao_reforma": "Cesta Básica Nacional (Alíquota Zero)" ou "Alíquota Reduzida 60%" ou "Alíquota Padrão (26.5% IVA Dual)" ou "Regime Específico",
  "justificativa": "Breve justificativa técnica do enquadramento"
}

Não inclua formatação markdown, blocos de código ou texto fora do JSON.`;
}

// 1. Google Gemini (Grátis via Google AI Studio)
async function chamarGemini(apiKey: string, model: string, item: ItemAuditoriaInput): Promise<RespostaIaItem | null> {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-2.5-flash'}:generateContent?key=${apiKey}`;
    const prompt = `${buildSystemPrompt(item.crt, item.uf)}\n\nITEM PARA ANÁLISE:\nDescrição: "${item.descricao}"\nNCM Informado no Arquivo: "${item.ncmAtual || 'Não informado'}"\nCEST Atual: "${item.cestAtual || 'Vazio'}"\nCFOP Atual: "${item.cfopAtual || 'Vazio'}"\nCSOSN/CST Atual: "${item.csosnAtual || 'Vazio'}"\nValor Unitário: R$ ${item.valor || 0}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, responseMimeType: 'application/json' }
      }),
      signal: AbortSignal.timeout(12000)
    });

    if (!res.ok) return null;
    const data = await res.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return null;

    const parsed = JSON.parse(rawText.replace(/```json/g, '').replace(/```/g, '').trim());
    return normalizarRespostaIa('gemini', 'Google Gemini', parsed, item);
  } catch {
    return null;
  }
}

// 2. Groq Cloud - Llama 3.3 (Grátis via Groq API)
async function chamarGroq(apiKey: string, model: string, item: ItemAuditoriaInput): Promise<RespostaIaItem | null> {
  try {
    const url = 'https://api.groq.com/openai/v1/chat/completions';
    const systemPrompt = buildSystemPrompt(item.crt, item.uf);
    const userPrompt = `ITEM PARA ANÁLISE:\nDescrição: "${item.descricao}"\nNCM Informado: "${item.ncmAtual || ''}"\nCEST Atual: "${item.cestAtual || ''}"\nCFOP Atual: "${item.cfopAtual || ''}"\nCSOSN/CST Atual: "${item.csosnAtual || ''}"\nValor: R$ ${item.valor || 0}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model || 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      }),
      signal: AbortSignal.timeout(12000)
    });

    if (!res.ok) return null;
    const data = await res.json();
    const rawText = data.choices?.[0]?.message?.content;
    if (!rawText) return null;

    const parsed = JSON.parse(rawText);
    return normalizarRespostaIa('groq', 'Groq (Llama 3.3)', parsed, item);
  } catch {
    return null;
  }
}

// 3. OpenAI (GPT-4o / GPT-4o-mini)
async function chamarOpenAi(apiKey: string, model: string, item: ItemAuditoriaInput): Promise<RespostaIaItem | null> {
  try {
    const url = 'https://api.openai.com/v1/chat/completions';
    const systemPrompt = buildSystemPrompt(item.crt, item.uf);
    const userPrompt = `ITEM PARA ANÁLISE:\nDescrição: "${item.descricao}"\nNCM: "${item.ncmAtual || ''}"\nCEST: "${item.cestAtual || ''}"\nCFOP: "${item.cfopAtual || ''}"\nCSOSN/CST: "${item.csosnAtual || ''}"\nValor: R$ ${item.valor || 0}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      }),
      signal: AbortSignal.timeout(12000)
    });

    if (!res.ok) return null;
    const data = await res.json();
    const rawText = data.choices?.[0]?.message?.content;
    if (!rawText) return null;

    const parsed = JSON.parse(rawText);
    return normalizarRespostaIa('openai', 'OpenAI ChatGPT', parsed, item);
  } catch {
    return null;
  }
}

// 4. Anthropic Claude (Claude 3.5 Sonnet / Haiku)
async function chamarClaude(apiKey: string, model: string, item: ItemAuditoriaInput): Promise<RespostaIaItem | null> {
  try {
    const url = 'https://api.anthropic.com/v1/messages';
    const systemPrompt = buildSystemPrompt(item.crt, item.uf);
    const userPrompt = `ITEM PARA ANÁLISE:\nDescrição: "${item.descricao}"\nNCM: "${item.ncmAtual || ''}"\nCEST: "${item.cestAtual || ''}"\nCFOP: "${item.cfopAtual || ''}"\nCSOSN/CST: "${item.csosnAtual || ''}"\nValor: R$ ${item.valor || 0}\n\nResponda APENAS o JSON.`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: model || 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        temperature: 0.1,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      }),
      signal: AbortSignal.timeout(12000)
    });

    if (!res.ok) return null;
    const data = await res.json();
    const rawText = data.content?.[0]?.text;
    if (!rawText) return null;

    const parsed = JSON.parse(rawText.replace(/```json/g, '').replace(/```/g, '').trim());
    return normalizarRespostaIa('claude', 'Anthropic Claude', parsed, item);
  } catch {
    return null;
  }
}

// 5. Ollama (Servidor Local Gratuito)
async function chamarOllama(endpoint: string, model: string, item: ItemAuditoriaInput): Promise<RespostaIaItem | null> {
  try {
    const base = endpoint ? endpoint.replace(/\/$/, '') : 'http://localhost:11434';
    const url = `${base}/api/generate`;
    const prompt = `${buildSystemPrompt(item.crt, item.uf)}\n\nITEM PARA ANÁLISE:\nDescrição: "${item.descricao}"\nNCM: "${item.ncmAtual || ''}"\nCEST: "${item.cestAtual || ''}"\nCFOP: "${item.cfopAtual || ''}"\nCSOSN/CST: "${item.csosnAtual || ''}"\nValor: R$ ${item.valor || 0}\n\nResponda APENAS o JSON válido.`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || 'llama3',
        prompt: prompt,
        stream: false,
        format: 'json'
      }),
      signal: AbortSignal.timeout(15000)
    });

    if (!res.ok) return null;
    const data = await res.json();
    const parsed = typeof data.response === 'string' ? JSON.parse(data.response) : data.response;
    return normalizarRespostaIa('ollama', 'Ollama (Local)', parsed, item);
  } catch {
    return null;
  }
}

// 6. MCP Fiscal Brasil / Fiscal.ai (Protocolo Model Context Protocol / REST)
async function chamarMcpFiscal(endpoint: string, token: string, nomeMcp: string, item: ItemAuditoriaInput): Promise<RespostaIaItem | null> {
  try {
    if (!endpoint) return null;
    const cleanEndpoint = endpoint.replace(/\/$/, '');
    
    // Tenta chamada REST ou endpoint de tools do MCP
    const res = await fetch(`${cleanEndpoint}/query-ncm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        descricao: item.descricao,
        ncm: item.ncmAtual,
        uf: item.uf || 'MG'
      }),
      signal: AbortSignal.timeout(10000)
    });

    if (!res.ok) return null;
    const data = await res.json();
    return normalizarRespostaIa('mcp', nomeMcp, data, item);
  } catch {
    return null;
  }
}

// Normalização padronizada de qualquer IA ou MCP
function normalizarRespostaIa(provedor: string, nomeProvedor: string, raw: any, item: ItemAuditoriaInput): RespostaIaItem {
  const ncm = String(raw.ncm || item.ncmAtual || '').replace(/\D/g, '').padEnd(8, '0').slice(0, 8);
  const cest = String(raw.cest || item.cestAtual || '').replace(/\D/g, '').slice(0, 7);
  const cfop = String(raw.cfop || item.cfopAtual || (item.crt === 1 ? '5102' : '5102')).replace(/\D/g, '').slice(0, 4);
  const csosn_cst = String(raw.csosn_cst || raw.csosn || raw.cst || item.csosnAtual || (item.crt === 1 ? '102' : '00')).replace(/\D/g, '');
  const cstPis = String(raw.cst_pis || raw.cstPis || '01').replace(/\D/g, '').padStart(2, '0');
  const cstCofins = String(raw.cst_cofins || raw.cstCofins || '01').replace(/\D/g, '').padStart(2, '0');
  const isMonofasico = raw.is_monofasico === true || cstPis === '04' || ['04', '05', '06'].includes(cstPis);

  const reformaOficial = avaliarReformaTributaria(ncm, item.descricao);
  const ibsAliq = Number(raw.ibs_aliq ?? reformaOficial.aliquotaIbsEst);
  const cbsAliq = Number(raw.cbs_aliq ?? reformaOficial.aliquotaCbsEst);
  const ivaDual = Number((ibsAliq + cbsAliq).toFixed(2));

  // Validação contra a base legal do Convênio ICMS 142/2018
  let score = 50;
  const cestInfo = ITENS_CEST_142.find((c: ItemCest) => c.ncm.replace(/\D/g, '') === ncm || ncm.startsWith(c.ncm.replace(/\D/g, '')));
  if (cestInfo) {
    score += 25;
    if (cest && cestInfo.cest.replace(/\D/g, '') === cest) {
      score += 20;
    }
  }

  return {
    provedor,
    nomeProvedor,
    ncmSugerido: ncm,
    cestSugerido: cest || (cestInfo ? cestInfo.cest.replace(/\D/g, '') : ''),
    cfopSugerido: cfop,
    csosnSugerido: csosn_cst,
    cstPisSugerido: cstPis,
    cstCofinsSugerido: cstCofins,
    ibsAliqEstimada: ibsAliq,
    cbsAliqEstimada: cbsAliq,
    ivaDualTotal: ivaDual,
    cstIbsCbs: raw.cst_ibs_cbs || (reformaOficial.regime === 'zero' ? '03' : reformaOficial.regime === 'reduzido' ? '02' : '01'),
    classificacaoReforma: raw.classificacao_reforma || reformaOficial.nomeRegime,
    isMonofasico,
    scoreConfianca: Math.min(score, 100),
    justificativa: raw.justificativa || `Saneamento e classificação automática via ${nomeProvedor}.`
  };
}

// Fallback nativo: quando nenhuma IA externa estiver cadastrada ou todas falharem
function gerarFallbackNativo(item: ItemAuditoriaInput): RespostaIaItem {
  const ncmLimpo = (item.ncmAtual || '').replace(/\D/g, '').padEnd(8, '0').slice(0, 8);
  const cestMatch = ITENS_CEST_142.find((c: ItemCest) => c.ncm.replace(/\D/g, '') === ncmLimpo || ncmLimpo.startsWith(c.ncm.replace(/\D/g, '')));
  const reformaOficial = avaliarReformaTributaria(ncmLimpo, item.descricao);

  const isSimples = item.crt === 1;
  const cfop = cestMatch ? '5405' : '5102';
  const csosn = isSimples ? (cestMatch ? '500' : '102') : (cestMatch ? '60' : '00');
  const cest = cestMatch ? cestMatch.cest.replace(/\D/g, '') : (item.cestAtual || '');

  return {
    provedor: 'nativo',
    nomeProvedor: 'Hub Engine (Convênio 142/2018 & LC 214/2024)',
    ncmSugerido: ncmLimpo || '00000000',
    cestSugerido: cest,
    cfopSugerido: cfop,
    csosnSugerido: csosn,
    cstPisSugerido: '01',
    cstCofinsSugerido: '01',
    ibsAliqEstimada: reformaOficial.aliquotaIbsEst,
    cbsAliqEstimada: reformaOficial.aliquotaCbsEst,
    ivaDualTotal: reformaOficial.aliquotaIvaDualEst,
    cstIbsCbs: reformaOficial.regime === 'zero' ? '03' : reformaOficial.regime === 'reduzido' ? '02' : '01',
    classificacaoReforma: reformaOficial.nomeRegime,
    isMonofasico: false,
    scoreConfianca: cestMatch ? 85 : 70,
    justificativa: cestMatch 
      ? `Identificado enquadramento no Convênio ICMS 142/2018 para o segmento ST.`
      : 'Classificação padrão conforme regras gerais de circulação de mercadorias.'
  };
}

// ==========================================
// MOTOR DE EXECUÇÃO MULTI-IA COM CONSENSO
// ==========================================
export async function auditarItemComMultiIa(
  item: ItemAuditoriaInput,
  configs: IaProviderConfig[],
  modoConsenso: boolean = true
): Promise<ResultadoConsenso> {
  const promessas: Promise<RespostaIaItem | null>[] = [];

  for (const c of configs) {
    if (!c.is_ativo) continue;

    if (c.provedor === 'gemini' && c.credenciais.api_key) {
      promessas.push(chamarGemini(c.credenciais.api_key, c.credenciais.model || 'gemini-2.5-flash', item));
    } else if (c.provedor === 'groq' && c.credenciais.api_key) {
      promessas.push(chamarGroq(c.credenciais.api_key, c.credenciais.model || 'llama-3.3-70b-versatile', item));
    } else if (c.provedor === 'openai' && c.credenciais.api_key) {
      promessas.push(chamarOpenAi(c.credenciais.api_key, c.credenciais.model || 'gpt-4o-mini', item));
    } else if (c.provedor === 'claude' && c.credenciais.api_key) {
      promessas.push(chamarClaude(c.credenciais.api_key, c.credenciais.model || 'claude-3-5-sonnet-20241022', item));
    } else if (c.provedor === 'ollama' && c.credenciais.endpoint) {
      promessas.push(chamarOllama(c.credenciais.endpoint, c.credenciais.model || 'llama3', item));
    } else if (c.provedor === 'mcp_fiscal_brasil' && c.credenciais.endpoint) {
      promessas.push(chamarMcpFiscal(c.credenciais.endpoint, c.credenciais.token || '', 'MCP Fiscal Brasil', item));
    } else if (c.provedor === 'fiscal_ai' && c.credenciais.endpoint) {
      promessas.push(chamarMcpFiscal(c.credenciais.endpoint, c.credenciais.token || c.credenciais.api_key || '', 'Fiscal.ai MCP', item));
    }
  }

  // Executa todas as IAs ativas em paralelo
  const resultadosSettled = await Promise.allSettled(promessas);
  const respostasValidas: RespostaIaItem[] = [];

  for (const r of resultadosSettled) {
    if (r.status === 'fulfilled' && r.value) {
      respostasValidas.push(r.value);
    }
  }

  // Se nenhuma respondeu ou nenhuma ativa, usa fallback nativo
  if (respostasValidas.length === 0) {
    const fallback = gerarFallbackNativo(item);
    return {
      vencedor: fallback,
      respostasDetalhadas: [fallback],
      modoConsensoUtilizado: false,
      totalIasConsultadas: 0,
      concordanciaPercentual: 100
    };
  }

  // Se apenas uma respondeu, ela é a vencedora
  if (respostasValidas.length === 1) {
    return {
      vencedor: respostasValidas[0],
      respostasDetalhadas: respostasValidas,
      modoConsensoUtilizado: false,
      totalIasConsultadas: 1,
      concordanciaPercentual: 100
    };
  }

  // Se múltiplas responderam e modo consenso está ativo: Eleição por Consenso
  // Agrupa votos por NCM
  const contagemNcm: Record<string, { count: number, itens: RespostaIaItem[] }> = {};
  for (const resp of respostasValidas) {
    if (!contagemNcm[resp.ncmSugerido]) {
      contagemNcm[resp.ncmSugerido] = { count: 0, itens: [] };
    }
    contagemNcm[resp.ncmSugerido].count++;
    contagemNcm[resp.ncmSugerido].itens.push(resp);
  }

  // Encontra o NCM com mais votos
  let melhorNcm = '';
  let maiorVotos = -1;
  for (const [ncm, dados] of Object.entries(contagemNcm)) {
    if (dados.count > maiorVotos) {
      maiorVotos = dados.count;
      melhorNcm = ncm;
    }
  }

  const concordancia = Math.round((maiorVotos / respostasValidas.length) * 100);
  const candidatos = contagemNcm[melhorNcm].itens;

  // Entre os que concordaram com o NCM vencedor, escolhe o de maior score de confiança
  candidatos.sort((a, b) => b.scoreConfianca - a.scoreConfianca);
  const campeao = { ...candidatos[0] };

  // Personaliza o título de consenso
  const nomesIas = respostasValidas.map(i => i.nomeProvedor).join(', ');
  campeao.nomeProvedor = `Consenso Multi-IA (${maiorVotos}/${respostasValidas.length} votos: ${nomesIas})`;
  campeao.scoreConfianca = Math.min(100, campeao.scoreConfianca + (concordancia >= 70 ? 15 : 5));

  return {
    vencedor: campeao,
    respostasDetalhadas: respostasValidas,
    modoConsensoUtilizado: true,
    totalIasConsultadas: respostasValidas.length,
    concordanciaPercentual: concordancia
  };
}
