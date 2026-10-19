// Tabela de prefixos NCM oficiais sujeitos à tributação monofásica de PIS/COFINS
// Leis 10.147/00, 10.485/02, 10.833/03, 10.865/04, 13.097/15

export interface NcmMonofasicoRule {
  prefixo: string;
  categoria: string;
  descricao: string;
}

export const NCMS_MONOFASICOS_PREFIXOS: NcmMonofasicoRule[] = [
  // BEBIDAS FRIAS (Cervejas, Refrigerantes, Águas, Energéticos) - Lei 13.097/2015
  { prefixo: '2201', categoria: 'Bebidas Frias', descricao: 'Águas minerais, potáveis ou gaseificadas' },
  { prefixo: '2202', categoria: 'Bebidas Frias', descricao: 'Refrigerantes, isotônicos, cerveja sem álcool, energéticos' },
  { prefixo: '2203', categoria: 'Bebidas Frias', descricao: 'Cervejas de malte' },

  // FARMACÊUTICOS / MEDICAMENTOS - Lei 10.147/2000
  { prefixo: '3001', categoria: 'Medicamentos', descricao: 'Glândulas, órgãos e extratos' },
  { prefixo: '3002', categoria: 'Medicamentos', descricao: 'Vacinas, toxinas e culturas de micro-organismos' },
  { prefixo: '3003', categoria: 'Medicamentos', descricao: 'Medicamentos em dosagem a granel' },
  { prefixo: '3004', categoria: 'Medicamentos', descricao: 'Medicamentos em doses embaladas para venda' },
  { prefixo: '3005', categoria: 'Medicamentos', descricao: 'Curativos, gazes e ataduras impregnadas' },
  { prefixo: '3006', categoria: 'Medicamentos', descricao: 'Preparações farmacêuticas especiais' },

  // PERFUMARIA, COSMÉTICOS E HIGIENE PESSOAL - Lei 10.147/2000
  { prefixo: '3303', categoria: 'Cosméticos & Higiene', descricao: 'Perfumes e águas-de-colônia' },
  { prefixo: '3304', categoria: 'Cosméticos & Higiene', descricao: 'Produtos de maquiagem e cuidados da pele' },
  { prefixo: '3305', categoria: 'Cosméticos & Higiene', descricao: 'Produtos capilares (xampus, cremes, tinturas)' },
  { prefixo: '3306', categoria: 'Cosméticos & Higiene', descricao: 'Preparações para higiene bucal ou dentária (pastas de dente)' },
  { prefixo: '3307', categoria: 'Cosméticos & Higiene', descricao: 'Desodorantes, produtos para barbear, depilatórios' },
  { prefixo: '3401', categoria: 'Cosméticos & Higiene', descricao: 'Sabões, sabonetes e preparações de toucador' },
  { prefixo: '960321', categoria: 'Cosméticos & Higiene', descricao: 'Escovas de dente' },

  // AUTOMAÇÃO / AUTOPEÇAS, MÁQUINAS E PNEUMÁTICOS - Leis 10.485/2002 e 10.865/2004
  { prefixo: '4011', categoria: 'Autopeças & Pneus', descricao: 'Pneus novos de borracha' },
  { prefixo: '4013', categoria: 'Autopeças & Pneus', descricao: 'Câmaras de ar de borracha' },
  { prefixo: '8701', categoria: 'Autopeças & Veículos', descricao: 'Tratores e veículos agrícolas' },
  { prefixo: '8702', categoria: 'Autopeças & Veículos', descricao: 'Veículos automóveis para transporte de 10 pessoas ou mais' },
  { prefixo: '8703', categoria: 'Autopeças & Veículos', descricao: 'Automóveis de passageiros e outros veículos' },
  { prefixo: '8704', categoria: 'Autopeças & Veículos', descricao: 'Veículos automóveis para transporte de mercadorias (caminhões)' },
  { prefixo: '8705', categoria: 'Autopeças & Veículos', descricao: 'Veículos automóveis para usos especiais' },
  { prefixo: '8706', categoria: 'Autopeças & Veículos', descricao: 'Chassis com motor para veículos automóveis' },
  { prefixo: '8707', categoria: 'Autopeças & Veículos', descricao: 'Carroçarias para veículos automóveis' },
  { prefixo: '8708', categoria: 'Autopeças & Veículos', descricao: 'Partes e acessórios para veículos automóveis' },
  { prefixo: '8711', categoria: 'Autopeças & Veículos', descricao: 'Motocicletas, ciclomotores e triciclos' },
  { prefixo: '8716', categoria: 'Autopeças & Veículos', descricao: 'Reboques e semirreboques para veículos' },
  { prefixo: '8407', categoria: 'Autopeças & Peças', descricao: 'Motores de pistão alternativo' },
  { prefixo: '8408', categoria: 'Autopeças & Peças', descricao: 'Motores diesel e semidiesel' },
  { prefixo: '8409', categoria: 'Autopeças & Peças', descricao: 'Partes para motores de pistão' },
  { prefixo: '841330', categoria: 'Autopeças & Peças', descricao: 'Bombas para combustível, óleo ou arrefecimento' },
  { prefixo: '841480', categoria: 'Autopeças & Peças', descricao: 'Turbocompressores e compressores para veículos' },
  { prefixo: '842123', categoria: 'Autopeças & Peças', descricao: 'Filtros de óleo ou combustível para motores' },
  { prefixo: '842131', categoria: 'Autopeças & Peças', descricao: 'Filtros de ar para motores de combustão' },
  { prefixo: '8483', categoria: 'Autopeças & Peças', descricao: 'Árvores de transmissão, engrenagens e caixas de câmbio' },
  { prefixo: '8507', categoria: 'Autopeças & Peças', descricao: 'Acumuladores elétricos (baterias automotivas)' },
  { prefixo: '8511', categoria: 'Autopeças & Peças', descricao: 'Velas de ignição, distribuidores, bobinas de ignição' },
  { prefixo: '8512', categoria: 'Autopeças & Peças', descricao: 'Aparelhos elétricos de iluminação ou sinalização para veículos' },
  { prefixo: '8539', categoria: 'Autopeças & Peças', descricao: 'Lâmpadas e tubos elétricos automotivos' },
  { prefixo: '854430', categoria: 'Autopeças & Peças', descricao: 'Jogos de fios para velas de ignição automotivas' },
  { prefixo: '681381', categoria: 'Autopeças & Peças', descricao: 'Guarnições de freios montadas para veículos' },
  { prefixo: '700711', categoria: 'Autopeças & Peças', descricao: 'Vidros de segurança temperados para veículos' },
  { prefixo: '700721', categoria: 'Autopeças & Peças', descricao: 'Vidros de segurança laminados para veículos' },

  // COMBUSTÍVEIS E LUBRIFICANTES - Lei 9.718/1998
  { prefixo: '2710', categoria: 'Combustíveis & Lubrificantes', descricao: 'Óleos de petróleo, lubrificantes, gasolinas, diesel' },
  { prefixo: '2711', categoria: 'Combustíveis & Lubrificantes', descricao: 'Gás de petróleo (GLP, gás natural liquefeito)' },
  { prefixo: '3403', categoria: 'Combustíveis & Lubrificantes', descricao: 'Preparações lubrificantes para veículos e máquinas' },
  { prefixo: '38200000', categoria: 'Combustíveis & Lubrificantes', descricao: 'Fluidos para freios hidráulicos e anticongelantes' },
]

export function isNcmMonofasico(ncm: string): { isMonofasico: boolean; regra?: NcmMonofasicoRule } {
  if (!ncm) return { isMonofasico: false }
  const cleanNcm = ncm.replace(/\D/g, '')

  for (const regra of NCMS_MONOFASICOS_PREFIXOS) {
    if (cleanNcm.startsWith(regra.prefixo)) {
      return { isMonofasico: true, regra }
    }
  }

  return { isMonofasico: false }
}

export function formatarNcm(ncm?: string): string {
  if (!ncm) return '—'
  const clean = ncm.replace(/\D/g, '')
  if (clean.length === 8) {
    return `${clean.substring(0, 4)}.${clean.substring(4, 6)}.${clean.substring(6, 8)}`
  }
  return ncm
}

export function identificarDescricaoNcm(ncm: string): { categoria: string; descricao: string } {
  const clean = (ncm || '').replace(/\D/g, '')
  if (clean.startsWith('2203')) return { categoria: 'Bebidas Frias', descricao: 'Cervejas de malte' }
  if (clean.startsWith('220210')) return { categoria: 'Bebidas Frias', descricao: 'Refrigerantes' }
  if (clean.startsWith('220299') || clean.startsWith('220290')) return { categoria: 'Bebidas Frias', descricao: 'Energéticos e outras bebidas' }
  if (clean.startsWith('2202')) return { categoria: 'Bebidas Frias', descricao: 'Refrigerantes e outras bebidas' }
  if (clean.startsWith('2201')) return { categoria: 'Bebidas Frias', descricao: 'Águas minerais' }
  
  const res = isNcmMonofasico(ncm)
  if (res.isMonofasico && res.regra) {
    return { categoria: res.regra.categoria, descricao: res.regra.descricao }
  }
  return { categoria: 'Outros Monofásicos', descricao: 'Produto Monofásico (CST 04/06)' }
}

export type StatusConformidadeMonofasico = 'regular' | 'divergente_cst' | 'sem_cst'

export interface AnaliseConformidadeItem {
  isMonofasicoNcm: boolean
  isCstMonofasico: boolean
  statusConformidade: StatusConformidadeMonofasico
  cstFormatado: string
  categoria: string
  descricaoNcm: string
  statusTitulo: string
  statusDescricao: string
  temOportunidadeRecuperacao: boolean
}

/**
 * Realiza a análise tributária cruzando o NCM do produto com o CST e alíquotas do XML.
 * Identifica quando o cliente preencheu incorretamente (ex: CST 01, 49, 99) mesmo o NCM sendo monofásico por lei.
 */
export function analisarConformidadeItem(ncm: string, cstPis?: string, aliquotaPis?: number): AnaliseConformidadeItem {
  const cleanNcm = (ncm || '').replace(/\D/g, '')
  const { isMonofasico, regra } = isNcmMonofasico(cleanNcm)
  const infoNcm = identificarDescricaoNcm(cleanNcm)

  const cstClean = (cstPis || '').replace(/\D/g, '')
  const isCstMono = cstClean === '04' || cstClean === '06' || cstClean === '4' || cstClean === '6'
  const cstFormatado = cstClean ? cstClean.padStart(2, '0') : 'Sem CST'

  if (isMonofasico) {
    if (isCstMono) {
      return {
        isMonofasicoNcm: true,
        isCstMonofasico: true,
        statusConformidade: 'regular',
        cstFormatado,
        categoria: infoNcm.categoria,
        descricaoNcm: infoNcm.descricao,
        statusTitulo: 'Conforme (CST 04/06)',
        statusDescricao: 'NCM e CST preenchidos corretamente com alíquota zero.',
        temOportunidadeRecuperacao: false
      }
    } else if (!cstClean) {
      return {
        isMonofasicoNcm: true,
        isCstMonofasico: false,
        statusConformidade: 'sem_cst',
        cstFormatado: 'Não informado',
        categoria: infoNcm.categoria,
        descricaoNcm: infoNcm.descricao,
        statusTitulo: 'NCM Monofásico sem CST',
        statusDescricao: 'NCM monofásico na lei, mas sem tag de PIS/COFINS no XML.',
        temOportunidadeRecuperacao: true
      }
    } else {
      return {
        isMonofasicoNcm: true,
        isCstMonofasico: false,
        statusConformidade: 'divergente_cst',
        cstFormatado,
        categoria: infoNcm.categoria,
        descricaoNcm: infoNcm.descricao,
        statusTitulo: `Divergência: NCM Monofásico com CST ${cstFormatado}`,
        statusDescricao: `NCM monofásico legalmente, mas emitido com CST tributado/outros (${cstFormatado}). Sujeito a segregação e recuperação no DAS.`,
        temOportunidadeRecuperacao: true
      }
    }
  }

  // Se o NCM não estava na lista de prefixos conhecidos, mas foi emitido com CST 04 ou 06
  if (isCstMono) {
    return {
      isMonofasicoNcm: false,
      isCstMonofasico: true,
      statusConformidade: 'regular',
      cstFormatado,
      categoria: 'Declarado Monofásico',
      descricaoNcm: 'CST 04/06 declarado no XML',
      statusTitulo: `Declarado pelo ERP (CST ${cstFormatado})`,
      statusDescricao: 'CST 04/06 informado no XML.',
      temOportunidadeRecuperacao: false
    }
  }

  return {
    isMonofasicoNcm: false,
    isCstMonofasico: false,
    statusConformidade: 'regular',
    cstFormatado,
    categoria: 'Tributação Normal',
    descricaoNcm: 'Não monofásico',
    statusTitulo: 'Tributado Integralmente',
    statusDescricao: 'Item não classificado como monofásico.',
    temOportunidadeRecuperacao: false
  }
}


