/**
 * Tabelas e Mapeamentos Fiscais de Referência para o Corretor Tributário
 * Abrange tributação atual (ICMS, CSOSN, PIS, COFINS, CEST, CFOP) 
 * e o novo sistema da Reforma Tributária (IBS, CBS e IVA Dual - LC 214/2025).
 */

export interface ItemCsosn {
  codigo: string
  descricao: string
  permiteCredito: boolean
  sujeitoST: boolean
}

export interface ItemOrigem {
  codigo: string
  descricao: string
}

export interface EnquadramentoReforma {
  regime: 'padrao' | 'reduzido' | 'zero' | 'seletivo' | 'combustiveis'
  nomeRegime: string
  aliquotaIbsEst: number // IBS estimado em %
  aliquotaCbsEst: number // CBS estimado em %
  aliquotaIvaDualEst: number // Junção IBS + CBS em %
  temImpostoSeletivo: boolean
  justificativa: string
}

// Tabela de Códigos CSOSN (Simples Nacional)
export const TABELA_CSOSN: Record<string, ItemCsosn> = {
  '101': { codigo: '101', descricao: 'Tributada pelo Simples Nacional com permissão de crédito', permiteCredito: true, sujeitoST: false },
  '102': { codigo: '102', descricao: 'Tributada pelo Simples Nacional sem permissão de crédito', permiteCredito: false, sujeitoST: false },
  '103': { codigo: '103', descricao: 'Isenção do ICMS no Simples Nacional para faixa de receita bruta', permiteCredito: false, sujeitoST: false },
  '201': { codigo: '201', descricao: 'Tributada pelo Simples Nacional com permissão de crédito e com cobrança do ICMS por ST', permiteCredito: true, sujeitoST: true },
  '202': { codigo: '202', descricao: 'Tributada pelo Simples Nacional sem permissão de crédito e com cobrança do ICMS por ST', permiteCredito: false, sujeitoST: true },
  '203': { codigo: '203', descricao: 'Isenção do ICMS no Simples Nacional para faixa de receita e cobrança do ICMS por ST', permiteCredito: false, sujeitoST: true },
  '300': { codigo: '300', descricao: 'Imune de ICMS', permiteCredito: false, sujeitoST: false },
  '400': { codigo: '400', descricao: 'Não tributada pelo Simples Nacional', permiteCredito: false, sujeitoST: false },
  '500': { codigo: '500', descricao: 'ICMS cobrado anteriormente por substituição tributária (substituído)', permiteCredito: false, sujeitoST: true },
  '900': { codigo: '900', descricao: 'Outros (operações atípicas do Simples Nacional)', permiteCredito: false, sujeitoST: false }
}

// Tabela de Origem da Mercadoria (0 a 8)
export const TABELA_ORIGEM: Record<string, ItemOrigem> = {
  '0': { codigo: '0', descricao: 'Nacional, exceto as indicadas nos códigos 3, 4, 5 e 8' },
  '1': { codigo: '1', descricao: 'Estrangeira - Importação direta, exceto a indicada no código 6' },
  '2': { codigo: '2', descricao: 'Estrangeira - Adquirida no mercado interno, exceto a indicada no código 7' },
  '3': { codigo: '3', descricao: 'Nacional, mercadoria ou bem com Conteúdo de Importação superior a 40% e inferior ou igual a 70%' },
  '4': { codigo: '4', descricao: 'Nacional, cuja produção tenha sido feita em conformidade com os processos produtivos básicos (PPB)' },
  '5': { codigo: '5', descricao: 'Nacional, mercadoria ou bem com Conteúdo de Importação inferior ou igual a 40%' },
  '6': { codigo: '6', descricao: 'Estrangeira - Importação direta, sem similar nacional, constante em lista da CAMEX' },
  '7': { codigo: '7', descricao: 'Estrangeira - Adquirida no mercado interno, sem similar nacional, constante em lista da CAMEX' },
  '8': { codigo: '8', descricao: 'Nacional, mercadoria ou bem com Conteúdo de Importação superior a 70%' }
}

// CFOPs de Venda no Varejo (Estaduais)
export const CFOPS_VENDA_VAREJO: Record<string, { descricao: string; st: boolean }> = {
  '5101': { descricao: 'Venda de produção do estabelecimento', st: false },
  '5102': { descricao: 'Venda de mercadoria adquirida ou recebida de terceiros', st: false },
  '5401': { descricao: 'Venda de produção sujeita a ST (indústria/substituto)', st: true },
  '5403': { descricao: 'Venda de mercadoria com ST (substituto)', st: true },
  '5405': { descricao: 'Venda de mercadoria adquirida ou recebida de terceiros com ST (varejista substituído)', st: true }
}

/**
 * Avalia o enquadramento do produto na Reforma Tributária (IBS, CBS e IVA Dual - LC 214/2025)
 * baseado no NCM e palavras-chave da descrição.
 */
export function avaliarReformaTributaria(ncm: string, descricaoProd?: string): EnquadramentoReforma {
  const cleanNcm = (ncm || '').replace(/\D/g, '')
  const desc = (descricaoProd || '').toUpperCase()

  // 1. Cesta Básica Nacional (Alíquota Zero 100% IBS + CBS)
  // Arroz (1006), Feijão (0713), Carnes (0201, 0202, 0203, 0207), Leite (0401), Café (0901), Farinha trigo (1101), Pão francês (1905.90.90 com pão), etc.
  if (
    cleanNcm.startsWith('1006') || // Arroz
    cleanNcm.startsWith('0713') || // Feijão
    cleanNcm.startsWith('0401') || // Leite
    cleanNcm.startsWith('0901') || // Café
    cleanNcm.startsWith('1101') || // Farinha de trigo
    cleanNcm.startsWith('1507') || // Óleo de soja
    cleanNcm.startsWith('0201') || cleanNcm.startsWith('0202') || cleanNcm.startsWith('0203') || cleanNcm.startsWith('0207') || // Carnes
    (cleanNcm.startsWith('190590') && desc.includes('PAO'))
  ) {
    return {
      regime: 'zero',
      nomeRegime: 'Cesta Básica Nacional (Alíquota Zero)',
      aliquotaIbsEst: 0.0,
      aliquotaCbsEst: 0.0,
      aliquotaIvaDualEst: 0.0,
      temImpostoSeletivo: false,
      justificativa: 'Isenção total (Alíquota Zero) de IBS e CBS conforme Cesta Básica Nacional de Alimentos da Reforma Tributária (LC 214/2025).'
    }
  }

  // 2. Medicamentos, Dispositivos Médicos e Saúde (Redução de 60% ou Isenção)
  if (cleanNcm.startsWith('3003') || cleanNcm.startsWith('3004') || cleanNcm.startsWith('3002') || cleanNcm.startsWith('9018')) {
    return {
      regime: 'reduzido',
      nomeRegime: 'Saúde & Medicamentos (Redução de 60%)',
      aliquotaIbsEst: 7.08,
      aliquotaCbsEst: 3.52,
      aliquotaIvaDualEst: 10.60,
      temImpostoSeletivo: false,
      justificativa: 'Benefício fiscal de 60% de redução no IBS e CBS para medicamentos e dispositivos de saúde.'
    }
  }

  // 3. Combustíveis e Lubrificantes (Regime Específico Monofásico)
  if (cleanNcm.startsWith('2710') || cleanNcm.startsWith('2711') || cleanNcm.startsWith('2207')) {
    return {
      regime: 'combustiveis',
      nomeRegime: 'Combustíveis (Regime Específico Monofásico)',
      aliquotaIbsEst: 0.0,
      aliquotaCbsEst: 0.0,
      aliquotaIvaDualEst: 0.0,
      temImpostoSeletivo: true,
      justificativa: 'Cobrança monofásica por unidade de medida (ad rem) do IBS/CBS em etapa única no produtor/importador com incidência de Imposto Seletivo.'
    }
  }

  // 4. Produtos Nocivos (Bebidas Alcoólicas, Cigarros, Refrigerantes/Açucarados) - Sujeitos a Imposto Seletivo (IS)
  if (
    cleanNcm.startsWith('2402') || cleanNcm.startsWith('2403') || // Tabaco / Cigarros
    cleanNcm.startsWith('2203') || cleanNcm.startsWith('2204') || cleanNcm.startsWith('2205') || cleanNcm.startsWith('2206') || cleanNcm.startsWith('2208') || // Bebidas alcoólicas
    cleanNcm.startsWith('2202') // Refrigerantes e bebidas açucaradas
  ) {
    return {
      regime: 'seletivo',
      nomeRegime: 'Regime Geral + Imposto Seletivo (IS)',
      aliquotaIbsEst: 17.70,
      aliquotaCbsEst: 8.80,
      aliquotaIvaDualEst: 26.50,
      temImpostoSeletivo: true,
      justificativa: 'Tributação pelo IVA Dual (IBS + CBS padrão de ~26,5%) com sobretaxa de Imposto Seletivo (IS) sobre produtos prejudiciais à saúde ou meio ambiente.'
    }
  }

  // 5. Regime Padrão (Alíquota de Referência do IVA Dual)
  return {
    regime: 'padrao',
    nomeRegime: 'Regime Geral (IVA Dual Integral)',
    aliquotaIbsEst: 17.70,
    aliquotaCbsEst: 8.80,
    aliquotaIvaDualEst: 26.50,
    temImpostoSeletivo: false,
    justificativa: 'Alíquota de referência padrão projetada: IBS Estadual/Municipal (~17,70%) + CBS Federal (~8,80%), totalizando ~26,50% no IVA Dual.'
  }
}
