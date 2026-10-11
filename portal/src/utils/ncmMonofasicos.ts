// Tabela de prefixos NCM oficiais sujeitos à tributação monofásica de PIS/COFINS
// Leis 10.147/00, 10.485/02, 10.833/03, 10.865/04, 13.097/15

export interface NcmMonofasicoRule {
  prefixo: string;
  categoria: string;
  descricao: string;
}

export const NCMS_MONOFASICOS_PREFIXOS: NcmMonofasicoRule[] = [
  // BEBIDAS FRIAS (Cervejas, Refrigerantes, Águas, Energéticos) - Lei 13.097/2015
  { prefixo: '2201', categoria: 'Bebidas', descricao: 'Águas minerais, gaseificadas ou não' },
  { prefixo: '2202', categoria: 'Bebidas', descricao: 'Refrigerantes, isotônicos, cerveja sem álcool, energéticos' },
  { prefixo: '2203', categoria: 'Bebidas', descricao: 'Cervejas de malte' },

  // FARMACÊUTICOS / MEDICAMENTOS - Lei 10.147/2000
  { prefixo: '3001', categoria: 'Medicamentos', descricao: 'Glândulas, órgãos e extratos' },
  { prefixo: '3002', categoria: 'Medicamentos', descricao: 'Vacinas, toxinas e culturas de micro-organismos' },
  { prefixo: '3003', categoria: 'Medicamentos', descricao: 'Medicamentos em dosagem a granel' },
  { prefixo: '3004', categoria: 'Medicamentos', descricao: 'Medicamentos em doses embaladas para venda' },
  { prefixo: '3005', categoria: 'Medicamentos', descricao: 'Curativos, gazes e ataduras impregnadas' },
  { prefixo: '3006', categoria: 'Medicamentos', descricao: 'Preparações farmacêuticas especiais' },

  // PERFUMARIA, COSMÉTICOS E HIGIENE PESSOAL - Lei 10.147/2000
  { prefixo: '3303', categoria: 'Cosméticos', descricao: 'Perfumes e águas-de-colônia' },
  { prefixo: '3304', categoria: 'Cosméticos', descricao: 'Produtos de maquiagem e cuidados da pele' },
  { prefixo: '3305', categoria: 'Cosméticos', descricao: 'Produtos capilares (xampus, cremes, tinturas)' },
  { prefixo: '3306', categoria: 'Higiene', descricao: 'Preparações para higiene bucal ou dentária (pastas de dente)' },
  { prefixo: '3307', categoria: 'Higiene', descricao: 'Desodorantes, produtos para barbear, depilatórios' },
  { prefixo: '3401', categoria: 'Higiene', descricao: 'Sabões, sabonetes e preparações de toucador' },
  { prefixo: '960321', categoria: 'Higiene', descricao: 'Escovas de dente' },

  // AUTOMAÇÃO / AUTOPEÇAS E PNEUMÁTICOS - Leis 10.485/2002 e 10.865/2004
  { prefixo: '4011', categoria: 'Autopeças', descricao: 'Pneus novos de borracha' },
  { prefixo: '4013', categoria: 'Autopeças', descricao: 'Câmaras de ar de borracha' },
  { prefixo: '8708', categoria: 'Autopeças', descricao: 'Partes e acessórios para veículos automóveis' },
  { prefixo: '8407', categoria: 'Autopeças', descricao: 'Motores de pistão alternativo' },
  { prefixo: '8408', categoria: 'Autopeças', descricao: 'Motores diesel e semidiesel' },
  { prefixo: '8409', categoria: 'Autopeças', descricao: 'Partes para motores' },
  { prefixo: '841330', categoria: 'Autopeças', descricao: 'Bombas para combustível ou lubrificantes' },
  { prefixo: '842123', categoria: 'Autopeças', descricao: 'Filtros de óleo ou combustível' },
  { prefixo: '842131', categoria: 'Autopeças', descricao: 'Filtros de ar para motores' },
  { prefixo: '8507', categoria: 'Autopeças', descricao: 'Acumuladores elétricos (baterias automotivas)' },
  { prefixo: '8511', categoria: 'Autopeças', descricao: 'Velas de ignição, distribuidores, bobinas' },
  { prefixo: '8512', categoria: 'Autopeças', descricao: 'Aparelhos de iluminação ou sinalização visual' },

  // COMBUSTÍVEIS E LUBRIFICANTES - Lei 9.718/1998
  { prefixo: '2710', categoria: 'Combustíveis', descricao: 'Óleos de petróleo, lubrificantes, gasolinas, diesel' },
  { prefixo: '2711', categoria: 'Combustíveis', descricao: 'Gás de petróleo (GLP, gás natural)' },
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
