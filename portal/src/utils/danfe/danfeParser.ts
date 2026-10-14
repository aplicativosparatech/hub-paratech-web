import QRCode from 'qrcode';
import { limparChaveAcesso } from '../cnpjAlfanumerico';

export interface DanfeItem {
  nItem: number;
  codigo: string;
  descricao: string;
  ncm: string;
  cstCsosn: string;
  cfop: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  baseIcms: number;
  valorIcms: number;
  aliqIcms: number;
  valorIpi: number;
  aliqIpi: number;
}

export interface DanfePagamento {
  forma: string;
  descricaoForma: string;
  valor: number;
}

export interface DanfeData {
  chave: string;
  modelo: '55' | '65';
  numero: string;
  serie: string;
  tipoOperacao: '0' | '1'; // 0 = Entrada, 1 = Saída
  dataEmissao: string;
  dataSaidaEntrada?: string;
  naturezaOperacao: string;
  protocolo?: string;
  dataProtocolo?: string;
  
  emitente: {
    razaoSocial: string;
    nomeFantasia?: string;
    cnpjCpf: string;
    inscricaoEstadual: string;
    inscricaoMunicipal?: string;
    logradouro: string;
    numero: string;
    complemento?: string;
    bairro: string;
    municipio: string;
    uf: string;
    cep: string;
    telefone?: string;
    logoUrl?: string;
  };

  destinatario?: {
    razaoSocial: string;
    cnpjCpf: string;
    inscricaoEstadual?: string;
    logradouro?: string;
    numero?: string;
    bairro?: string;
    municipio?: string;
    uf?: string;
    cep?: string;
    telefone?: string;
  };

  totais: {
    baseIcms: number;
    valorIcms: number;
    baseIcmsSt: number;
    valorIcmsSt: number;
    valorProdutos: number;
    valorFrete: number;
    valorSeguro: number;
    desconto: number;
    outrasDespesas: number;
    valorIpi: number;
    valorPis: number;
    valorCofins: number;
    valorTotalNota: number;
  };

  transporte?: {
    modalidadeFrete: string;
    descricaoModalidade: string;
    razaoSocial?: string;
    cnpjCpf?: string;
    inscricaoEstadual?: string;
    endereco?: string;
    municipio?: string;
    uf?: string;
    placa?: string;
    ufVeiculo?: string;
    quantidadeVolumes?: number;
    especie?: string;
    pesoBruto?: number;
    pesoLiquido?: number;
  };

  itens: DanfeItem[];
  pagamentos: DanfePagamento[];
  dadosAdicionais?: string;
  qrCodeUrl?: string;
  qrCodeBase64?: string;
  barcodeSvg?: string;
}

function extractTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return match ? match[1].trim() : '';
}

function extractNumber(xml: string, tag: string): number {
  const val = extractTag(xml, tag);
  return parseFloat(val) || 0;
}

// Mapeia códigos de pagamento da SEFAZ para texto
const FORMAS_PAGAMENTO_MAP: Record<string, string> = {
  '01': 'Dinheiro',
  '02': 'Cheque',
  '03': 'Cartão de Crédito',
  '04': 'Cartão de Débito',
  '05': 'Crédito Loja',
  '10': 'Vale Alimentação',
  '11': 'Vale Refeição',
  '12': 'Vale Presente',
  '13': 'Vale Combustível',
  '15': 'Boleto Bancário',
  '16': 'Depósito Bancário',
  '17': 'Pagamento Instantâneo (PIX)',
  '18': 'Transferência Bancária / Carteira Digital',
  '19': 'Programa de Fidelidade / Cashback',
  '90': 'Sem Pagamento',
  '99': 'Outros'
};

// Gerador de Código de Barras Code 128 SVG para a Chave de Acesso (44 caracteres - numérico ou alfanumérico)
export function gerarBarcode128CSvg(chaveInput: string): string {
  // Limpa caracteres especiais mantendo caracteres alfanuméricos
  const chave = limparChaveAcesso(chaveInput).padEnd(44, '0').substring(0, 44);
  
  // Tabela simplificada de barras Code 128 (padrão ISO/IEC 15417)
  const CODE128_PATTERNS = [
    "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
    "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
    "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
    "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
    "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
    "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
    "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
    "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
    "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
    "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
    "114131", "311141", "411131", "211412", "211214", "211232", "2331112"
  ];

  const ehPuroNumerico = /^\d{44}$/.test(chave);
  let checkSum = 0;
  const seq: number[] = [];

  if (ehPuroNumerico) {
    // Início Code C (105) para pares de dígitos numéricos
    checkSum = 105;
    seq.push(105);
    for (let i = 0; i < chave.length; i += 2) {
      const pair = parseInt(chave.substr(i, 2), 10);
      seq.push(pair);
      checkSum += pair * (seq.length - 1);
    }
  } else {
    // Início Code B (104) para chaves contendo caracteres alfanuméricos (IN RFB 2.229/2024)
    checkSum = 104;
    seq.push(104);
    for (let i = 0; i < chave.length; i++) {
      const code = chave.charCodeAt(i) - 32;
      seq.push(code);
      checkSum += code * (seq.length - 1);
    }
  }

  const checkDigit = checkSum % 103;
  seq.push(checkDigit);
  seq.push(106); // Stop

  let patternStr = "";
  for (const code of seq) {
    patternStr += CODE128_PATTERNS[code] || "";
  }

  // Gera elementos <rect> SVG
  let x = 10;
  const barHeight = 50;
  let rects = "";

  for (let i = 0; i < patternStr.length; i++) {
    const width = parseInt(patternStr[i], 10);
    if (i % 2 === 0) {
      rects += `<rect x="${x}" y="0" width="${width}" height="${barHeight}" fill="#000" />`;
    }
    x += width;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${x + 10} ${barHeight}" preserveAspectRatio="none" style="width:100%; height:100%;">${rects}</svg>`;
}

// Parser completo de XML da NF-e / NFC-e para objeto estruturado da DANFE
export async function parseXmlParaDanfe(xmlString: string, logoUrl?: string): Promise<DanfeData> {
  // Limpeza de tags
  const cleanXml = xmlString.replace(/[\r\n]+/g, ' ');

  // Chave
  const infNFeMatch = cleanXml.match(/<infNFe[^>]*Id="NFe([^"]+)"/i);
  let chave = infNFeMatch ? infNFeMatch[1] : '';
  if (!chave) {
    chave = extractTag(cleanXml, 'chNFe');
  }
  chave = limparChaveAcesso(chave);

  // Modelo (posições 20 e 21 da chave ou tag <mod>)
  let modelo: '55' | '65' = '55';
  const tagMod = extractTag(cleanXml, 'mod');
  if (tagMod === '65' || (chave.length === 44 && chave.substring(20, 22) === '65')) {
    modelo = '65';
  }

  const numero = extractTag(cleanXml, 'nNF');
  const serie = extractTag(cleanXml, 'serie') || '1';
  const tipoOperacao = (extractTag(cleanXml, 'tpNF') || '1') as '0' | '1';
  const dataEmissao = extractTag(cleanXml, 'dhEmi') || extractTag(cleanXml, 'dEmi');
  const dataSaidaEntrada = extractTag(cleanXml, 'dhSaiEnt') || extractTag(cleanXml, 'dSaiEnt');
  const naturezaOperacao = extractTag(cleanXml, 'natOp') || 'VENDA DE MERCADORIA';

  // Protocolo
  const nProt = extractTag(cleanXml, 'nProt');
  const dhRecbto = extractTag(cleanXml, 'dhRecbto');

  // Emitente
  const emitXml = cleanXml.match(/<emit>([\s\S]*?)<\/emit>/i)?.[1] || '';
  const emitente = {
    razaoSocial: extractTag(emitXml, 'xNome') || 'EMPRESA EMITENTE',
    nomeFantasia: extractTag(emitXml, 'xFant'),
    cnpjCpf: extractTag(emitXml, 'CNPJ') || extractTag(emitXml, 'CPF'),
    inscricaoEstadual: extractTag(emitXml, 'IE') || 'ISENTO',
    inscricaoMunicipal: extractTag(emitXml, 'IM'),
    logradouro: extractTag(emitXml, 'xLgr'),
    numero: extractTag(emitXml, 'nro'),
    complemento: extractTag(emitXml, 'xCpl'),
    bairro: extractTag(emitXml, 'xBairro'),
    municipio: extractTag(emitXml, 'xMun'),
    uf: extractTag(emitXml, 'UF'),
    cep: extractTag(emitXml, 'CEP'),
    telefone: extractTag(emitXml, 'fone'),
    logoUrl: logoUrl || undefined
  };

  // Destinatário
  const destXml = cleanXml.match(/<dest>([\s\S]*?)<\/dest>/i)?.[1] || '';
  let destinatario: DanfeData['destinatario'] = undefined;
  if (destXml) {
    destinatario = {
      razaoSocial: extractTag(destXml, 'xNome') || 'CONSUMIDOR NÃO IDENTIFICADO',
      cnpjCpf: extractTag(destXml, 'CNPJ') || extractTag(destXml, 'CPF') || extractTag(destXml, 'idEstrangeiro'),
      inscricaoEstadual: extractTag(destXml, 'IE'),
      logradouro: extractTag(destXml, 'xLgr'),
      numero: extractTag(destXml, 'nro'),
      bairro: extractTag(destXml, 'xBairro'),
      municipio: extractTag(destXml, 'xMun'),
      uf: extractTag(destXml, 'UF'),
      cep: extractTag(destXml, 'CEP'),
      telefone: extractTag(destXml, 'fone')
    };
  }

  // Totais
  const totalXml = cleanXml.match(/<total>([\s\S]*?)<\/total>/i)?.[1] || '';
  const totais = {
    baseIcms: extractNumber(totalXml, 'vBC'),
    valorIcms: extractNumber(totalXml, 'vICMS'),
    baseIcmsSt: extractNumber(totalXml, 'vBCST'),
    valorIcmsSt: extractNumber(totalXml, 'vST'),
    valorProdutos: extractNumber(totalXml, 'vProd'),
    valorFrete: extractNumber(totalXml, 'vFrete'),
    valorSeguro: extractNumber(totalXml, 'vSeg'),
    desconto: extractNumber(totalXml, 'vDesc'),
    outrasDespesas: extractNumber(totalXml, 'vOutro'),
    valorIpi: extractNumber(totalXml, 'vIPI'),
    valorPis: extractNumber(totalXml, 'vPIS'),
    valorCofins: extractNumber(totalXml, 'vCOFINS'),
    valorTotalNota: extractNumber(totalXml, 'vNF')
  };

  // Itens (<det>)
  const itens: DanfeItem[] = [];
  const detMatches = cleanXml.match(/<det\b[^>]*>([\s\S]*?)<\/det>/gi) || [];

  detMatches.forEach((det, idx) => {
    const prodXml = det.match(/<prod>([\s\S]*?)<\/prod>/i)?.[1] || '';
    const impostoXml = det.match(/<imposto>([\s\S]*?)<\/imposto>/i)?.[1] || '';

    // ICMS / CSOSN
    const cst = extractTag(impostoXml, 'CST') || extractTag(impostoXml, 'CSOSN');
    const baseIcms = extractNumber(impostoXml, 'vBC');
    const valorIcms = extractNumber(impostoXml, 'vICMS');
    const aliqIcms = extractNumber(impostoXml, 'pICMS');
    const valorIpi = extractNumber(impostoXml, 'vIPI');
    const aliqIpi = extractNumber(impostoXml, 'pIPI');

    itens.push({
      nItem: idx + 1,
      codigo: extractTag(prodXml, 'cProd'),
      descricao: extractTag(prodXml, 'xProd'),
      ncm: extractTag(prodXml, 'NCM'),
      cstCsosn: cst,
      cfop: extractTag(prodXml, 'CFOP'),
      unidade: extractTag(prodXml, 'uCom') || 'UN',
      quantidade: extractNumber(prodXml, 'qCom'),
      valorUnitario: extractNumber(prodXml, 'vUnCom'),
      valorTotal: extractNumber(prodXml, 'vProd'),
      baseIcms,
      valorIcms,
      aliqIcms,
      valorIpi,
      aliqIpi
    });
  });

  // Pagamentos (<detPag>)
  const pagamentos: DanfePagamento[] = [];
  const pagMatches = cleanXml.match(/<detPag>([\s\S]*?)<\/detPag>/gi) || cleanXml.match(/<pag>([\s\S]*?)<\/pag>/gi) || [];

  pagMatches.forEach(pag => {
    const tPag = extractTag(pag, 'tPag') || '01';
    const vPag = extractNumber(pag, 'vPag');
    if (vPag > 0 || pagamentos.length === 0) {
      pagamentos.push({
        forma: tPag,
        descricaoForma: FORMAS_PAGAMENTO_MAP[tPag] || 'Outros',
        valor: vPag || totais.valorTotalNota
      });
    }
  });

  if (pagamentos.length === 0) {
    pagamentos.push({
      forma: '01',
      descricaoForma: 'Dinheiro / À Vista',
      valor: totais.valorTotalNota
    });
  }

  // Transporte
  const transpXml = cleanXml.match(/<transp>([\s\S]*?)<\/transp>/i)?.[1] || '';
  const modFrete = extractTag(transpXml, 'modFrete') || '9';
  const modFreteMap: Record<string, string> = {
    '0': '0 - Contratação por conta do Remetente (CIF)',
    '1': '1 - Contratação por conta do Destinatário (FOB)',
    '2': '2 - Contratação por conta de Terceiros',
    '3': '3 - Transporte Próprio por conta do Remetente',
    '4': '4 - Transporte Próprio por conta do Destinatário',
    '9': '9 - Sem Ocorrência de Transporte'
  };

  const transpData: DanfeData['transporte'] = {
    modalidadeFrete: modFrete,
    descricaoModalidade: modFreteMap[modFrete] || '9 - Sem Frete',
    razaoSocial: extractTag(transpXml, 'xNome'),
    cnpjCpf: extractTag(transpXml, 'CNPJ') || extractTag(transpXml, 'CPF'),
    inscricaoEstadual: extractTag(transpXml, 'IE'),
    endereco: extractTag(transpXml, 'xEnder'),
    municipio: extractTag(transpXml, 'xMun'),
    uf: extractTag(transpXml, 'UF'),
    placa: extractTag(transpXml, 'placa'),
    ufVeiculo: extractTag(transpXml, 'UF'),
    quantidadeVolumes: extractNumber(transpXml, 'qVol'),
    especie: extractTag(transpXml, 'esp'),
    pesoBruto: extractNumber(transpXml, 'pesoB'),
    pesoLiquido: extractNumber(transpXml, 'pesoL')
  };

  // Informações Adicionais
  const infAdicXml = cleanXml.match(/<infAdic>([\s\S]*?)<\/infAdic>/i)?.[1] || '';
  const infCpl = extractTag(infAdicXml, 'infCpl');
  const infAdFisco = extractTag(infAdicXml, 'infAdFisco');
  const dadosAdicionais = [infCpl, infAdFisco].filter(Boolean).join(' | ');

  // QR Code (NFC-e)
  let qrCodeUrl = extractTag(cleanXml, 'qrCode');
  let qrCodeBase64: string | undefined = undefined;

  if (qrCodeUrl) {
    try {
      qrCodeBase64 = await QRCode.toDataURL(qrCodeUrl, { width: 180, margin: 1 });
    } catch (e) {
      console.warn('Erro ao gerar QRCode da NFC-e:', e);
    }
  }

  // Código de barras da chave de 44 dígitos
  const barcodeSvg = chave.length === 44 ? gerarBarcode128CSvg(chave) : undefined;

  return {
    chave,
    modelo,
    numero,
    serie,
    tipoOperacao,
    dataEmissao,
    dataSaidaEntrada,
    naturezaOperacao,
    protocolo: nProt,
    dataProtocolo: dhRecbto,
    emitente,
    destinatario,
    totais,
    transporte: transpData,
    itens,
    pagamentos,
    dadosAdicionais,
    qrCodeUrl,
    qrCodeBase64,
    barcodeSvg
  };
}
