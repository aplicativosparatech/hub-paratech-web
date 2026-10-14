/**
 * Base de Dados Consolidada do Convênio ICMS 142/2018 (CONFAZ)
 * Tabela Nacional de CEST (Código Especificador da Substituição Tributária) x NCM/SH
 */

export interface ItemCest {
  cest: string
  cestFormatado: string
  ncm: string
  descricao: string
}

// Catálogo consolidado dos principais segmentos do Convênio ICMS 142/2018
export const ITENS_CEST_142: ItemCest[] = [
  // Segmento 01: Autopeças
  { cest: '0100100', cestFormatado: '01.001.00', ncm: '3815.12.10 3815.12.90', descricao: 'Catalisadores em colmeia cerâmica ou metálica para conversão catalítica de gases de escape de veículos' },
  { cest: '0100200', cestFormatado: '01.002.00', ncm: '3917', descricao: 'Tubos e seus acessórios (juntas, cotovelos, flanges, uniões), de plásticos automotivos' },
  { cest: '0100600', cestFormatado: '01.006.00', ncm: '4010.3 5910.00.00', descricao: 'Correias de transmissão de borracha vulcanizada automotivas' },
  { cest: '0100700', cestFormatado: '01.007.00', ncm: '4016.93.00 4823.90.9', descricao: 'Juntas, gaxetas e outros elementos de vedação automotivos' },
  { cest: '0101400', cestFormatado: '01.014.00', ncm: '6813', descricao: 'Pastilhas e lonas de freios, embreagens automotivas' },
  { cest: '0101600', cestFormatado: '01.016.00', ncm: '7009.10.00', descricao: 'Espelhos retrovisores para veículos' },
  { cest: '0103200', cestFormatado: '01.032.00', ncm: '8413.30', descricao: 'Bombas para combustíveis, lubrificantes ou arrefecimento de motores' },
  { cest: '0103700', cestFormatado: '01.037.00', ncm: '8421.23.00', descricao: 'Aparelhos para filtrar óleos minerais nos motores (filtro de óleo)' },
  { cest: '0104100', cestFormatado: '01.041.00', ncm: '8421.31.00', descricao: 'Filtros de entrada de ar para motores (filtro de ar)' },
  { cest: '0104900', cestFormatado: '01.049.00', ncm: '8482', descricao: 'Rolamentos para veículos' },
  { cest: '0105300', cestFormatado: '01.053.00', ncm: '8507.10', descricao: 'Acumuladores elétricos de chumbo (baterias automotivas)' },
  { cest: '0105400', cestFormatado: '01.054.00', ncm: '8511', descricao: 'Velas de ignição, bobinas, motores de arranque e alternadores' },
  { cest: '0107100', cestFormatado: '01.071.00', ncm: '8539.2', descricao: 'Lâmpadas halógenas e de incandescência automotivas' },
  { cest: '0107500', cestFormatado: '01.075.00', ncm: '8708', descricao: 'Partes e acessórios dos veículos automóveis em geral' },

  // Segmento 02: Bebidas Alcoólicas
  { cest: '0200400', cestFormatado: '02.004.00', ncm: '2207.20 2208.40.00', descricao: 'Cachaça e aguardentes' },
  { cest: '0200600', cestFormatado: '02.006.00', ncm: '2208.20.00', descricao: 'Conhaque, brandy e similares' },
  { cest: '0200800', cestFormatado: '02.008.00', ncm: '2208.50.00', descricao: 'Gim (gin) e genebra' },
  { cest: '0201000', cestFormatado: '02.010.00', ncm: '2208.70.00', descricao: 'Licores e similares' },
  { cest: '0201200', cestFormatado: '02.012.00', ncm: '2208.40.00', descricao: 'Rum' },
  { cest: '0201500', cestFormatado: '02.015.00', ncm: '2208.90.00', descricao: 'Tequila e derivados' },
  { cest: '0201600', cestFormatado: '02.016.00', ncm: '2208.30', descricao: 'Uísque (whisky)' },
  { cest: '0201700', cestFormatado: '02.017.00', ncm: '2205', descricao: 'Vermute e similares' },
  { cest: '0201800', cestFormatado: '02.018.00', ncm: '2208.60.00', descricao: 'Vodka' },
  { cest: '0202400', cestFormatado: '02.024.00', ncm: '2204', descricao: 'Vinhos de uvas frescas e espumantes' },

  // Segmento 03: Cervejas, Chopes, Refrigerantes, Águas e Energéticos
  { cest: '0300100', cestFormatado: '03.001.00', ncm: '2201.10.00', descricao: 'Água mineral, gasosa ou não, ou potável, em garrafa de até 500 ml' },
  { cest: '0300200', cestFormatado: '03.002.00', ncm: '2201.10.00', descricao: 'Água mineral em embalagem com capacidade igual ou superior a 5.000 ml (galão)' },
  { cest: '0300500', cestFormatado: '03.005.00', ncm: '2201.10.00', descricao: 'Água mineral em copos plásticos e embalagens de até 500 ml' },
  { cest: '0300600', cestFormatado: '03.006.00', ncm: '2201', descricao: 'Outras águas minerais potáveis naturais' },
  { cest: '0300700', cestFormatado: '03.007.00', ncm: '2202.10.00', descricao: 'Água aromatizada artificialmente e gaseificada' },
  { cest: '0301000', cestFormatado: '03.010.00', ncm: '2202.10.00 2202.99.00', descricao: 'Refrigerante em garrafa com capacidade igual ou superior a 600 ml' },
  { cest: '0301001', cestFormatado: '03.010.01', ncm: '2202.10.00 2202.99.00', descricao: 'Refrigerante em embalagem PET' },
  { cest: '0301002', cestFormatado: '03.010.02', ncm: '2202.10.00 2202.99.00', descricao: 'Refrigerante em lata' },
  { cest: '0301100', cestFormatado: '03.011.00', ncm: '2202.10.00 2202.99.00', descricao: 'Demais refrigerantes' },
  { cest: '0301300', cestFormatado: '03.013.00', ncm: '2106.90 2202.99.00', descricao: 'Bebidas energéticas em lata ou embalagem < 600 ml' },
  { cest: '0301500', cestFormatado: '03.015.00', ncm: '2106.90 2202.99.00', descricao: 'Bebidas hidroeletrolíticas (isotônicos)' },
  { cest: '0302100', cestFormatado: '03.021.00', ncm: '2203.00.00', descricao: 'Cerveja em garrafa de vidro' },
  { cest: '0302103', cestFormatado: '03.021.03', ncm: '2203.00.00', descricao: 'Cerveja em lata' },
  { cest: '0302104', cestFormatado: '03.021.04', ncm: '2203.00.00', descricao: 'Cerveja em barril (chopp)' },
  { cest: '0302200', cestFormatado: '03.022.00', ncm: '2202.91.00', descricao: 'Cerveja sem álcool' },

  // Segmento 04: Cigarros e Tabaco
  { cest: '0400100', cestFormatado: '04.001.00', ncm: '2402', descricao: 'Charutos, cigarrilhas e cigarros de tabaco' },

  // Segmento 05: Cimento
  { cest: '0500100', cestFormatado: '05.001.00', ncm: '2523', descricao: 'Cimento portland e derivados' },

  // Segmento 06: Combustíveis e Lubrificantes
  { cest: '0600100', cestFormatado: '06.001.00', ncm: '2207.10.10', descricao: 'Álcool etílico anidro combustível (EAC)' },
  { cest: '0600101', cestFormatado: '06.001.01', ncm: '2207.10.90', descricao: 'Álcool etílico hidratado combustível (EHC)' },
  { cest: '0600201', cestFormatado: '06.002.01', ncm: '2710.12.59', descricao: 'Gasolina automotiva C' },
  { cest: '0600601', cestFormatado: '06.006.01', ncm: '2710.19.2', descricao: 'Óleo diesel B S500 / comum' },
  { cest: '0600605', cestFormatado: '06.006.05', ncm: '2710.19.2', descricao: 'Óleo diesel B S10' },
  { cest: '0600700', cestFormatado: '06.007.00', ncm: '2710.19.3', descricao: 'Óleos lubrificantes automotivos e industriais' },
  { cest: '0601100', cestFormatado: '06.011.00', ncm: '2711.19.10', descricao: 'Gás liquefeito de petróleo em botijão de 13 kg (GLP P13)' },

  // Segmento 09: Lâmpadas
  { cest: '0900100', cestFormatado: '09.001.00', ncm: '8539', descricao: 'Lâmpadas elétricas em geral' },
  { cest: '0900500', cestFormatado: '09.005.00', ncm: '8539.52.00 8539.50.00', descricao: 'Lâmpadas de LED (diodos emissores de luz)' },

  // Segmento 10: Materiais de Construção, Acabamento e Tintas
  { cest: '1000200', cestFormatado: '10.002.00', ncm: '3816.00.1 3824.50.00', descricao: 'Argamassas e rejuntes' },
  { cest: '1000600', cestFormatado: '10.006.00', ncm: '3917', descricao: 'Tubos e conexões de PVC e plásticos para construção' },
  { cest: '1001300', cestFormatado: '10.013.00', ncm: '3922', descricao: 'Pias, cubas, lavatórios, bacias sanitárias plásticas' },
  { cest: '1001500', cestFormatado: '10.015.00', ncm: '3925.10.00', descricao: 'Caixas d’água plásticas' },
  { cest: '1003000', cestFormatado: '10.030.00', ncm: '6907', descricao: 'Porcelanatos, ladrilhos e placas de cerâmica para revestimento' },
  { cest: '1003100', cestFormatado: '10.031.00', ncm: '6910', descricao: 'Pias, lavatórios, vasos sanitários cerâmicos' },
  { cest: '1004200', cestFormatado: '10.042.00', ncm: '7214.20.00', descricao: 'Vergalhões de aço para construção' },
  { cest: '1004600', cestFormatado: '10.046.00', ncm: '7307', descricao: 'Acessórios para tubos de ferro ou aço' },
  { cest: '1005800', cestFormatado: '10.058.00', ncm: '7318', descricao: 'Parafusos, porcas, arruelas e rebites de aço' },
  { cest: '1007900', cestFormatado: '10.079.00', ncm: '8481', descricao: 'Torneiras, registros e válvulas' },

  // Segmento 11: Produtos de Limpeza
  { cest: '1100100', cestFormatado: '11.001.00', ncm: '2828.90.11 2828.90.19 3402.50.00', descricao: 'Água sanitária, cloro e alvejantes' },
  { cest: '1100200', cestFormatado: '11.002.00', ncm: '3401.20.90', descricao: 'Sabão em pó para lavar roupas' },
  { cest: '1100400', cestFormatado: '11.004.00', ncm: '3402.50.00 3402.20.00', descricao: 'Detergentes em pó ou grânulos' },
  { cest: '1100500', cestFormatado: '11.005.00', ncm: '3402.50.00 3402.20.00', descricao: 'Detergente líquido lava louças' },
  { cest: '1100600', cestFormatado: '11.006.00', ncm: '3402.50.00 3402.20.00', descricao: 'Detergente líquido para lavar roupas (lava roupas líquido)' },
  { cest: '1100700', cestFormatado: '11.007.00', ncm: '3402', descricao: 'Desinfetantes, limpadores multiuso e limpa vidros' },
  { cest: '1100800', cestFormatado: '11.008.00', ncm: '3809.91.90', descricao: 'Amaciante de roupas' },
  { cest: '1100900', cestFormatado: '11.009.00', ncm: '3924.10.00 6805.30.90', descricao: 'Esponjas para limpeza doméstica' },
  { cest: '1101100', cestFormatado: '11.011.00', ncm: '7323.10.00', descricao: 'Palhas de aço e esponjas de aço (Bombril / Assolan)' },

  // Segmento 12: Materiais Elétricos
  { cest: '1200200', cestFormatado: '12.002.00', ncm: '8516', descricao: 'Chuveiros e duchas elétricas, resistências e aquecedores' },
  { cest: '1200400', cestFormatado: '12.004.00', ncm: '8536', descricao: 'Disjuntores, interruptores, tomadas, plugues e conectores' },
  { cest: '1200700', cestFormatado: '12.007.00', ncm: '8544', descricao: 'Fios e cabos elétricos isolados para construção' },

  // Segmento 13: Medicamentos e Farmácia
  { cest: '1300100', cestFormatado: '13.001.00', ncm: '3003 3004', descricao: 'Medicamentos de referência - lista positiva' },
  { cest: '1300200', cestFormatado: '13.002.00', ncm: '3003 3004', descricao: 'Medicamentos genéricos - lista positiva' },
  { cest: '1300300', cestFormatado: '13.003.00', ncm: '3003 3004', descricao: 'Medicamentos similares - lista positiva' },
  { cest: '1301000', cestFormatado: '13.010.00', ncm: '3005.10.10', descricao: 'Curativos adesivos (band-aid)' },
  { cest: '1301200', cestFormatado: '13.012.00', ncm: '4015.12.00 4015.19.00', descricao: 'Luvas cirúrgicas e de procedimento' },
  { cest: '1301300', cestFormatado: '13.013.00', ncm: '4014.10.00', descricao: 'Preservativos (camisinha)' },

  // Segmento 16: Pneus e Câmaras
  { cest: '1600100', cestFormatado: '16.001.00', ncm: '4011.10.00', descricao: 'Pneus novos para automóveis de passeio' },
  { cest: '1600200', cestFormatado: '16.002.00', ncm: '4011', descricao: 'Pneus novos para caminhões e ônibus' },
  { cest: '1600300', cestFormatado: '16.003.00', ncm: '4011.40.00', descricao: 'Pneus novos para motocicletas' },

  // Segmento 17: Alimentos e Laticínios
  { cest: '1700100', cestFormatado: '17.001.00', ncm: '1704.90.10', descricao: 'Chocolate branco em tabletes ou barras' },
  { cest: '1700200', cestFormatado: '17.002.00', ncm: '1806.31.10 1806.31.20', descricao: 'Chocolates recheados em tabletes ou barras' },
  { cest: '1700300', cestFormatado: '17.003.00', ncm: '1806.32.10 1806.32.20', descricao: 'Chocolates não recheados em tabletes ou barras' },
  { cest: '1700400', cestFormatado: '17.004.00', ncm: '1806.90.00', descricao: 'Chocolates e bombons finos' },
  { cest: '1700600', cestFormatado: '17.006.00', ncm: '1806.90.00', descricao: 'Achocolatados em pó (Toddy, Nescau, etc.)' },
  { cest: '1701200', cestFormatado: '17.012.00', ncm: '0402.1 0402.2 0402.9', descricao: 'Leite em pó' },
  { cest: '1701600', cestFormatado: '17.016.00', ncm: '0401.10.10 0401.20.10', descricao: 'Leite longa vida (UHT / caixinha)' },
  { cest: '1701900', cestFormatado: '17.019.00', ncm: '0401.40.2 0402.21.30 0402.29.30', descricao: 'Creme de leite em caixinha ou lata' },
  { cest: '1702000', cestFormatado: '17.020.00', ncm: '0402.9', descricao: 'Leite condensado' },
  { cest: '1702100', cestFormatado: '17.021.00', ncm: '0403', descricao: 'Iogurtes e leite fermentado' },
  { cest: '1702300', cestFormatado: '17.023.00', ncm: '0406', descricao: 'Requeijão cremoso' },
  { cest: '1702401', cestFormatado: '17.024.01', ncm: '0406.10.10', descricao: 'Queijo muçarela' },
  { cest: '1702402', cestFormatado: '17.024.02', ncm: '0406.10.90', descricao: 'Queijo minas frescal' },
  { cest: '1702500', cestFormatado: '17.025.00', ncm: '0405.10.00', descricao: 'Manteiga de leite' },
  { cest: '1702600', cestFormatado: '17.026.00', ncm: '1517.10.00', descricao: 'Margarina e creme vegetal' },
  { cest: '1703100', cestFormatado: '17.031.00', ncm: '1905.90.90', descricao: 'Salgadinhos diversos (snacks / chips)' },
  { cest: '1703200', cestFormatado: '17.032.00', ncm: '2005.20.00 2005.9', descricao: 'Batata frita (palha e ondulada), mandioca frita' },
  { cest: '1703400', cestFormatado: '17.034.00', ncm: '2103.20.10', descricao: 'Catchup' },
  { cest: '1703800', cestFormatado: '17.038.00', ncm: '2103.30.21', descricao: 'Mostarda preparada' },
  { cest: '1703900', cestFormatado: '17.039.00', ncm: '2103.90.11', descricao: 'Maionese' },
  { cest: '1704000', cestFormatado: '17.040.00', ncm: '2002', descricao: 'Extrato e polpa de tomate' },
  { cest: '1704100', cestFormatado: '17.041.00', ncm: '2103.20.10', descricao: 'Molhos de tomate prontos' },
  { cest: '1704400', cestFormatado: '17.044.00', ncm: '1101.00.10', descricao: 'Farinha de trigo especial pacote' },
  { cest: '1704700', cestFormatado: '17.047.00', ncm: '1902.30.00', descricao: 'Massas alimentícias instantâneas (miojo)' },
  { cest: '1704900', cestFormatado: '17.049.00', ncm: '1902.1', descricao: 'Macarrão e massas alimentícias secas comuns' },
  { cest: '1705300', cestFormatado: '17.053.00', ncm: '1905.31.00', descricao: 'Biscoitos e bolachas recheadas de trigo' },
  { cest: '1705600', cestFormatado: '17.056.00', ncm: '1905.90.20', descricao: 'Biscoitos água e sal e cream cracker' },
  { cest: '1705700', cestFormatado: '17.057.00', ncm: '1905.32.00', descricao: 'Biscoitos tipo Wafers' },
  { cest: '1706000', cestFormatado: '17.060.00', ncm: '1905.90.10', descricao: 'Pães de forma industrializados' },
  { cest: '1706500', cestFormatado: '17.065.00', ncm: '1507.90.11', descricao: 'Óleo de soja refinado garrafa/pet' },
  { cest: '1706700', cestFormatado: '17.067.00', ncm: '1509', descricao: 'Azeite de oliva extravirgem' },
  { cest: '1707700', cestFormatado: '17.077.00', ncm: '1601.00.00', descricao: 'Salsichas e linguiças' },
  { cest: '1707800', cestFormatado: '17.078.00', ncm: '1601.00.00', descricao: 'Mortadela' },
  { cest: '1708100', cestFormatado: '17.081.00', ncm: '1604', descricao: 'Sardinha e atum em conserva (lata)' },

  // Segmento 20: Cosméticos, Perfumaria e Higiene Pessoal
  { cest: '2000700', cestFormatado: '20.007.00', ncm: '3303.00.10', descricao: 'Perfumes e colônias' },
  { cest: '2000800', cestFormatado: '20.008.00', ncm: '3303.00.20', descricao: 'Águas-de-colônia e desodorante colônia' },
  { cest: '2000900', cestFormatado: '20.009.00', ncm: '3304.10.00', descricao: 'Batom e maquiagem para lábios' },
  { cest: '2001200', cestFormatado: '20.012.00', ncm: '3304.30.00', descricao: 'Esmaltes para unhas e acetonas' },
  { cest: '2001400', cestFormatado: '20.014.00', ncm: '3304.99.10', descricao: 'Cremes hidratantes e loções corporais' },
  { cest: '2001600', cestFormatado: '20.016.00', ncm: '3304.99.90', descricao: 'Protetor solar e bronzeador' },
  { cest: '2001700', cestFormatado: '20.017.00', ncm: '3305.10.00', descricao: 'Xampus para cabelos' },
  { cest: '2002100', cestFormatado: '20.021.00', ncm: '3305.90.00', descricao: 'Condicionadores e máscaras capilares' },
  { cest: '2002200', cestFormatado: '20.022.00', ncm: '3305.90.00', descricao: 'Tinturas e colorações para cabelo' },
  { cest: '2002300', cestFormatado: '20.023.00', ncm: '3306.10.00', descricao: 'Creme dental e pastas de dente' },
  { cest: '2002400', cestFormatado: '20.024.00', ncm: '3306.20.00', descricao: 'Fio dental e fitas dentais' },
  { cest: '2002500', cestFormatado: '20.025.00', ncm: '3306.90.00', descricao: 'Enxaguantes bucais' },
  { cest: '2002700', cestFormatado: '20.027.00', ncm: '3307.20.10', descricao: 'Desodorantes corporais e antitranspirantes roll-on/aerosol' },
  { cest: '2003400', cestFormatado: '20.034.00', ncm: '3401.11.90', descricao: 'Sabonetes em barra de toucador' },
  { cest: '2003600', cestFormatado: '20.036.00', ncm: '3401.20.10', descricao: 'Sabonete líquido' },
  { cest: '2004200', cestFormatado: '20.042.00', ncm: '4818.10.00', descricao: 'Papel higiênico folha simples' },
  { cest: '2004300', cestFormatado: '20.043.00', ncm: '4818.10.00', descricao: 'Papel higiênico folha dupla/tripla' },
  { cest: '2004700', cestFormatado: '20.047.00', ncm: '4818.90.90', descricao: 'Papel toalha de cozinha' },
  { cest: '2004800', cestFormatado: '20.048.00', ncm: '9619.00.00', descricao: 'Fraldas infantis e geriátricas descartáveis' },
  { cest: '2005000', cestFormatado: '20.050.00', ncm: '9619.00.00', descricao: 'Absorventes higiênicos femininos' },
  { cest: '2005100', cestFormatado: '20.051.00', ncm: '5601.21.90', descricao: 'Hastes flexíveis (cotonetes)' },
  { cest: '2005800', cestFormatado: '20.058.00', ncm: '9603.21.00', descricao: 'Escovas de dente' },
  { cest: '2006400', cestFormatado: '20.064.00', ncm: '8212.10.20 8212.20.10', descricao: 'Aparelhos e lâminas de barbear descartáveis' },

  // Segmento 23: Sorvetes
  { cest: '2300100', cestFormatado: '23.001.00', ncm: '2105.00', descricao: 'Sorvetes e picolés de qualquer espécie' },

  // Segmento 24: Tintas e Vernizes
  { cest: '2400100', cestFormatado: '24.001.00', ncm: '3208 3209 3210.00', descricao: 'Tintas imobiliárias, esmaltes sintéticos e vernizes' }
]

/**
 * Normaliza NCM para dígitos puros
 */
function cleanNcm(ncm: string): string {
  return (ncm || '').replace(/\D/g, '')
}

/**
 * Verifica se um NCM está sujeito à Substituição Tributária (exige CEST pelo Convênio 142/18)
 */
export function ncmExigeCest(ncm: string): boolean {
  const code = cleanNcm(ncm)
  if (!code || code.length < 4) return false

  return ITENS_CEST_142.some(item => {
    const ncmsRegra = item.ncm.split(' ').map(cleanNcm)
    return ncmsRegra.some(reg => code.startsWith(reg) || reg.startsWith(code))
  })
}

/**
 * Retorna todos os CESTs elegíveis para um dado NCM
 */
export function buscarCestsPorNcm(ncm: string): ItemCest[] {
  const code = cleanNcm(ncm)
  if (!code || code.length < 4) return []

  return ITENS_CEST_142.filter(item => {
    const ncmsRegra = item.ncm.split(' ').map(cleanNcm)
    return ncmsRegra.some(reg => code.startsWith(reg) || reg.startsWith(code))
  })
}

/**
 * Sugere o melhor CEST para o produto cruzando NCM e palavras da descrição comercial
 */
export function buscarMelhorCest(ncm: string, descricaoProd?: string): ItemCest | null {
  const candidatos = buscarCestsPorNcm(ncm)
  if (candidatos.length === 0) return null
  if (candidatos.length === 1) return candidatos[0]

  if (!descricaoProd) return candidatos[0]

  // Se houver múltiplos candidatos, calcula score de afinidade com a descrição
  const descTokens = descricaoProd
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/\s+/)
    .filter(t => t.length > 2)

  let melhorItem = candidatos[0]
  let maiorScore = -1

  for (const item of candidatos) {
    const itemDescTokens = item.descricao
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .split(/\s+/)

    let score = 0
    for (const dt of descTokens) {
      if (itemDescTokens.includes(dt)) score += 2
      else if (itemDescTokens.some(it => it.includes(dt))) score += 1
    }

    if (score > maiorScore) {
      maiorScore = score
      melhorItem = item
    }
  }

  return melhorItem
}
