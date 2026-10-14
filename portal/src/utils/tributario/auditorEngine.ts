import { isNcmMonofasico, identificarDescricaoNcm } from '@/utils/ncmMonofasicos'
import { ITENS_CEST_142, ncmExigeCest, buscarMelhorCest, ItemCest } from './cestData'
import { avaliarReformaTributaria, EnquadramentoReforma, TABELA_CSOSN, TABELA_ORIGEM, CFOPS_VENDA_VAREJO } from './tabelasReferencia'

export interface ItemProdutoXml {
  idItem?: string
  cProd: string
  xProd: string
  ncm: string
  cest?: string
  cfop: string
  csosn?: string
  cstIcms?: string
  cstPis?: string
  cstCofins?: string
  orig?: string
  vProd: number
  qCom: number
  vUnCom: number
  uCom?: string
  chaveNota: string
  numeroNota: string
  modeloNota: '55' | '65'
  dataEmissao?: string
}

export interface InconsistenciaTributaria {
  tipo: 'risco_fiscal' | 'pagamento_indevido' | 'alerta_cadastral'
  campo: 'ncm' | 'cest' | 'cfop' | 'csosn' | 'pis_cofins' | 'reforma'
  titulo: string
  descricao: string
  impacto: 'alto' | 'medio' | 'baixo'
  valorEstimadoEconomia?: number
}

export interface SugestaoCorrecao {
  ncmSugerido?: string
  cestSugerido?: string
  cestDescricao?: string
  cfopSugerido?: string
  csosnSugerido?: string
  cstPisSugerido?: string
  cstCofinsSugerido?: string
  motivo: string
}

export interface DiagnosticoItem {
  item: ItemProdutoXml
  inconsistencias: InconsistenciaTributaria[]
  sugestao: SugestaoCorrecao
  reformaTributaria: EnquadramentoReforma
  status: 'inconsistente' | 'conforme'
  decisao?: 'manter' | 'corrigir'
}

/**
 * Motor central de auditoria tributária de itens de XMLs
 */
export function auditarItemTributario(item: ItemProdutoXml): DiagnosticoItem {
  const inconsistencias: InconsistenciaTributaria[] = []
  const sugestao: SugestaoCorrecao = { motivo: '' }

  const cleanNcm = (item.ncm || '').replace(/\D/g, '')
  const cleanCest = (item.cest || '').replace(/\D/g, '')
  const cleanCfop = (item.cfop || '').trim()
  const csosnOuCst = (item.csosn || item.cstIcms || '').trim()
  const cleanPis = (item.cstPis || '').trim().padStart(2, '0')
  const cleanCofins = (item.cstCofins || '').trim().padStart(2, '0')

  // 1. AUDITORIA DE NCM
  if (!cleanNcm || cleanNcm.length < 8) {
    inconsistencias.push({
      tipo: 'risco_fiscal',
      campo: 'ncm',
      titulo: 'NCM Incompleto ou Inválido',
      descricao: `O código NCM informado (${item.ncm || 'vazio'}) não possui os 8 dígitos obrigatórios da Nomenclatura Comum do Mercosul.`,
      impacto: 'alto'
    })
  } else if (cleanNcm === '00000000' || cleanNcm === '99999999') {
    inconsistencias.push({
      tipo: 'alerta_cadastral',
      campo: 'ncm',
      titulo: 'NCM Genérico Provisório',
      descricao: 'O produto utiliza NCM genérico (0000.00.00 / 9999.99.99), o que pode acarretar multas por erro de classificação fiscal.',
      impacto: 'medio'
    })
  }

  // 2. AUDITORIA DE CEST (Convênio ICMS 142/2018)
  const exigeCest = ncmExigeCest(cleanNcm)
  const melhorCest = buscarMelhorCest(cleanNcm, item.xProd)

  if (exigeCest) {
    if (!cleanCest) {
      inconsistencias.push({
        tipo: 'risco_fiscal',
        campo: 'cest',
        titulo: 'Falta de CEST Obrigatório (Convênio ICMS 142/2018)',
        descricao: `O NCM ${item.ncm} está listado no Convênio 142/18 no regime de Substituição Tributária e exige o código CEST no XML.`,
        impacto: 'alto'
      })
      if (melhorCest) {
        sugestao.cestSugerido = melhorCest.cestFormatado
        sugestao.cestDescricao = melhorCest.descricao
      }
    } else if (melhorCest && cleanCest !== melhorCest.cest) {
      // Verifica se o CEST informado faz sentido com o NCM
      inconsistencias.push({
        tipo: 'alerta_cadastral',
        campo: 'cest',
        titulo: 'CEST Divergente do Segmento',
        descricao: `O CEST informado (${item.cest}) difere do CEST mais aderente (${melhorCest.cestFormatado} - ${melhorCest.descricao}) para este NCM.`,
        impacto: 'baixo'
      })
      sugestao.cestSugerido = melhorCest.cestFormatado
      sugestao.cestDescricao = melhorCest.descricao
    }
  }

  // 3. AUDITORIA DE PIS / COFINS (Produtos Monofásicos - Alíquota Zero no Varejo)
  const isMonofasico = isNcmMonofasico(cleanNcm)
  if (isMonofasico) {
    // No comércio varejista (NF-e 55 ou NFC-e 65 de saída), produtos monofásicos DEVEM ser emitidos com CST 04 (Alíquota Zero)
    if (cleanPis === '01' || cleanPis === '02' || cleanCofins === '01' || cleanCofins === '02') {
      const valorEstimado = item.vProd * 0.0925 // Estimativa média de PIS/COFINS (9,25% Presumido/Real) ou dedução do Simples
      inconsistencias.push({
        tipo: 'pagamento_indevido',
        campo: 'pis_cofins',
        titulo: 'Bitributação de PIS/COFINS (Produto Monofásico)',
        descricao: `O produto pertence ao regime monofásico de PIS/COFINS (alíquota concentrada na indústria/importador). Vender com CST 01/02 acarreta pagamento de impostos em duplicidade.`,
        impacto: 'alto',
        valorEstimadoEconomia: valorEstimado
      })
      sugestao.cstPisSugerido = '04'
      sugestao.cstCofinsSugerido = '04'
    }
  }

  // 4. AUDITORIA DE CFOP x CSOSN/CST ICMS (Substituição Tributária Estadual)
  // Se o item tem CEST / está na ST e foi vendido como CFOP 5102 com CSOSN 102/101 (tributado integralmente):
  if ((exigeCest || cleanCest) && (cleanCfop === '5102' || cleanCfop === '5101')) {
    if (csosnOuCst === '102' || csosnOuCst === '101' || csosnOuCst === '00') {
      const valorEstimadoIcms = item.vProd * 0.05 // Estimativa da faixa de ICMS dentro do Simples Nacional ou débito
      inconsistencias.push({
        tipo: 'pagamento_indevido',
        campo: 'cfop',
        titulo: 'Bitributação de ICMS! Venda Tributada de Produto com ST',
        descricao: `O produto está no regime de Substituição Tributária (CEST), mas foi emitido com CFOP ${cleanCfop} e CSOSN/CST ${csosnOuCst} (tributado integralmente), pagando ICMS que já foi retido na fonte.`,
        impacto: 'alto',
        valorEstimadoEconomia: valorEstimadoIcms
      })
      sugestao.cfopSugerido = '5405'
      sugestao.csosnSugerido = '500'
    }
  }

  // Se foi emitido como CFOP 5405 (com ST), mas com CSOSN 102 (sem ST):
  if (cleanCfop === '5405' && (csosnOuCst === '102' || csosnOuCst === '101')) {
    inconsistencias.push({
      tipo: 'alerta_cadastral',
      campo: 'csosn',
      titulo: 'Incompatibilidade entre CFOP 5405 e CSOSN 102',
      descricao: `O CFOP 5405 indica mercadoria com ICMS retido por ST, mas o CSOSN 102 indica tributação comum sem crédito. O correto é CSOSN 500.`,
      impacto: 'medio'
    })
    sugestao.csosnSugerido = '500'
  }

  // 5. ENQUADRAMENTO DA REFORMA TRIBUTÁRIA (IBS, CBS e IVA Dual - LC 214/2025)
  const reforma = avaliarReformaTributaria(cleanNcm, item.xProd)

  // Monta justificativa consolidada
  if (inconsistencias.length > 0) {
    const motivos = inconsistencias.map(i => i.titulo).join('; ')
    sugestao.motivo = motivos
  }

  return {
    item,
    inconsistencias,
    sugestao,
    reformaTributaria: reforma,
    status: inconsistencias.length > 0 ? 'inconsistente' : 'conforme'
  }
}

/**
 * Executa auditoria em lote sobre uma lista de produtos extraídos dos XMLs
 */
export function auditarLoteProdutos(itens: ItemProdutoXml[]): {
  diagnosticos: DiagnosticoItem[]
  metricas: {
    totalItens: number
    itensConformes: number
    itensInconsistentes: number
    totalRiscoFiscal: number
    totalPagamentoIndevido: number
    economiaEstimadaTotal: number
    reformaCestaBasica: number
    reformaReduzido: number
    reformaSeletivo: number
    reformaPadrao: number
  }
} {
  const diagnosticos = itens.map(item => auditarItemTributario(item))

  let totalRiscoFiscal = 0
  let totalPagamentoIndevido = 0
  let economiaEstimadaTotal = 0
  let reformaCestaBasica = 0
  let reformaReduzido = 0
  let reformaSeletivo = 0
  let reformaPadrao = 0

  diagnosticos.forEach(d => {
    if (d.inconsistencias.some(i => i.tipo === 'risco_fiscal')) totalRiscoFiscal++
    if (d.inconsistencias.some(i => i.tipo === 'pagamento_indevido')) totalPagamentoIndevido++
    
    d.inconsistencias.forEach(i => {
      if (i.valorEstimadoEconomia) economiaEstimadaTotal += i.valorEstimadoEconomia
    })

    if (d.reformaTributaria.regime === 'zero') reformaCestaBasica++
    else if (d.reformaTributaria.regime === 'reduzido') reformaReduzido++
    else if (d.reformaTributaria.regime === 'seletivo') reformaSeletivo++
    else reformaPadrao++
  })

  return {
    diagnosticos,
    metricas: {
      totalItens: itens.length,
      itensConformes: diagnosticos.filter(d => d.status === 'conforme').length,
      itensInconsistentes: diagnosticos.filter(d => d.status === 'inconsistente').length,
      totalRiscoFiscal,
      totalPagamentoIndevido,
      economiaEstimadaTotal: Math.round(economiaEstimadaTotal * 100) / 100,
      reformaCestaBasica,
      reformaReduzido,
      reformaSeletivo,
      reformaPadrao
    }
  }
}
