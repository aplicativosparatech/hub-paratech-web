/**
 * Base de Conhecimento Estruturada para RAG (Retrieval-Augmented Generation) do Robotech IA
 * Contém regras tributárias, resoluções SEFAZ, manual da Reforma Tributária (LC 214/2025) e documentação dos sistemas Paratech.
 */

export interface ArtigoConhecimento {
  id: string;
  titulo: string;
  categoria: 'reforma_tributaria' | 'simples_nacional' | 'monofasicos' | 'sefaz_rejeicoes' | 'sistemas_paratech' | 'portal_hub';
  tags: string[];
  conteudo: string;
}

export const BASE_CONHECIMENTO_FISCAL: ArtigoConhecimento[] = [
  // 1. REFORMA TRIBUTÁRIA (LC 214/2025 - IBS & CBS)
  {
    id: 'reforma-lc214-visao-geral',
    titulo: 'Reforma Tributária (Lei Complementar 214/2025) - IVA Dual (IBS & CBS)',
    categoria: 'reforma_tributaria',
    tags: ['reforma tributaria', 'lc 214', 'ibs', 'cbs', 'iva dual', 'transicao', 'aliquotas'],
    conteudo: `A Reforma Tributária sobre o Consumo (EC 132/2023 e LC 214/2025) institui o modelo de IVA Dual, substituindo 5 tributos (PIS, COFINS, IPI, ICMS e ISS) por dois novos tributos sobre valor agregado:
- CBS (Contribuição sobre Bens e Serviços): Tributo Federal administrado pela Receita Federal, substituindo PIS e COFINS.
- IBS (Imposto sobre Bens e Serviços): Tributo Subnacional compartilhado entre Estados e Municípios, substituindo ICMS e ISS.
Período de Transição:
- 2026: Ano de teste com alíquota de 0,9% de CBS e 0,1% de IBS (compensáveis com PIS/COFINS).
- 2027: Extinção definitiva de PIS e COFINS e vigência plena da CBS federal.
- 2029 a 2032: Redução gradual de ICMS e ISS à razão de 1/10 por ano e elevação progressiva do IBS.
- 2033: Vigência 100% integral do novo sistema tributário nacional.`
  },
  {
    id: 'reforma-cesta-basica-isencao',
    titulo: 'Cesta Básica Nacional e Produtos com Alíquota Zero no IBS/CBS',
    categoria: 'reforma_tributaria',
    tags: ['cesta basica', 'aliquota zero', 'isencao', 'arroz', 'feijao', 'leite', 'cafe', 'hortifruti'],
    conteudo: `Pela LC 214/2025, os itens que compõem a Cesta Básica Nacional possuem redução de 100% nas alíquotas do IBS e da CBS (Alíquota Zero Real):
- Arroz (NCM 1006)
- Feijão (NCM 0713)
- Leite fluído e leite em pó (NCM 0401 e 0402)
- Farinha de trigo, mandioca ou milho (NCM 1101, 1102 e 1106)
- Pão comum tipo francês (NCM 1905.90)
- Café torrado e moído (NCM 0901)
- Óleo de soja (NCM 1507)
- Carnes bovina, suína, ovina e aves frescas/resfriadas (Capítulo 02)
- Hortifrutigranjeiros in natura (frutas, verduras, legumes, ovos e raízes)
Dica Fiscal: No Hub Paratech, o Analisador Tributário e o Sugestor já marcam esses itens com a etiqueta "Alíquota Zero Cesta Básica", permitindo precificação e crédito automáticos.`
  },
  {
    id: 'reforma-imposto-seletivo',
    titulo: 'Imposto Seletivo (IS - "Imposto do Pecado")',
    categoria: 'reforma_tributaria',
    tags: ['imposto seletivo', 'cigarro', 'bebida alcoolica', 'refrigerante', 'veiculos', 'minerais'],
    conteudo: `O Imposto Seletivo incide sobre a produção, extração ou importação de bens prejudiciais à saúde ou ao meio ambiente:
- Cigarros e produtos derivados do fumo (NCM 2402 e 2403).
- Bebidas alcoólicas (cervejas NCM 2203, vinhos NCM 2204, destilados NCM 2208).
- Refrigerantes e bebidas açucaradas (NCM 2202).
- Veículos automotores e embarcações poluentes.
- Bens minerais extraídos (petróleo, gás e minério de ferro).
O Imposto Seletivo é cumulativo, integrando a base de cálculo do IBS e da CBS, mas é cobrado em etapa única.`
  },

  // 2. SIMPLES NACIONAL & PRODUTOS MONOFÁSICOS
  {
    id: 'monofasicos-pis-cofins-segregacao',
    titulo: 'Segregação de Receitas de Produtos Monofásicos no Simples Nacional (Lei 10.147/2000)',
    categoria: 'monofasicos',
    tags: ['monofasico', 'pis', 'cofins', 'simples nacional', 'pgdas', 'recuperacao', 'farmacia', 'autopecas', 'bebidas'],
    conteudo: `A tributação monofásica concentra o recolhimento do PIS e da COFINS nas indústrias e importadoras. Logo, comerciantes varejistas e atacadistas estão sujeitos à ALÍQUOTA ZERO no momento da revenda.
Regra de Ouro no Simples Nacional:
- No cálculo mensal do DAS (PGDAS-D), a empresa optante pelo Simples Nacional DEVE segregar a receita decorrente de produtos monofásicos para NÃO pagar a parcela de PIS e COFINS do Simples em duplicidade!
- Segmentos Monofásicos Típicos:
  1. Combustíveis e Lubrificantes (NCM 2710, 2711, 2207).
  2. Medicamentos e Artigos Farmacêuticos (NCM 3001 a 3006).
  3. Perfumaria, Cosméticos e Higiene Pessoal (NCM 3303 a 3307 e 3401).
  4. Autopeças, Pneus e Baterias (NCM 8708, 4011, 8409, 8507).
  5. Bebidas frias (Cervejas NCM 2203, Refrigerantes e Energéticos NCM 2202, Águas NCM 2201).
No Hub Paratech: A aba Sistema > Relatórios > Produtos Monofásicos gera a memória de cálculo exata para o contador deduzir no PGDAS-D, gerando economia mensal de 15% a 35% no valor total do DAS.`
  },
  {
    id: 'icms-st-substituicao-tributaria',
    titulo: 'ICMS Substituição Tributária (ICMS-ST) e Código CEST (Convênio ICMS 142/2018)',
    categoria: 'simples_nacional',
    tags: ['icms st', 'cest', 'substituicao tributaria', 'csosn 500', 'cst 60', 'cfop 5405'],
    conteudo: `O ICMS-ST ocorre quando a responsabilidade pelo recolhimento do imposto de toda a cadeia é atribuída ao primeiro elo (fabricante/importador).
- Para revenda de produtos sob ICMS-ST por optantes do Simples Nacional:
  * CSOSN utilizado: 500 (ICMS cobrado anteriormente por substituição tributária ou por antecipação).
  * CFOP utilizado: 5.405 (Venda de mercadoria adquirida de terceiros com ICMS-ST).
  * CEST (Código Especificador da Substituição Tributária): Obrigatório conforme Convênio 142/2018 se o NCM constar no anexo do convênio.
- No Hub Paratech: O Corretor Tributário audita se o item possui NCM passível de ST e sugere o CEST compatível automaticamente.`
  },

  // 3. REJEIÇÕES E ERROS DA SEFAZ
  {
    id: 'sefaz-rejeicao-204-duplicidade',
    titulo: 'Rejeição 204: Duplicidade de NF-e / NFC-e [nRec:...]',
    categoria: 'sefaz_rejeicoes',
    tags: ['rejeicao 204', 'duplicidade', 'chave de acesso', 'numero ja emitido'],
    conteudo: `A Rejeição 204 ocorre quando se tenta transmitir uma nota com número, série e modelo já autorizados anteriormente na base da SEFAZ para o mesmo CNPJ.
Como resolver:
1. Acesse o Hub Paratech na aba "Distribuição de DF-e" ou "Notas Fiscais".
2. Verifique se a nota já havia sido autorizada e sincronize o XML para o PDV local.
3. Se a nota anterior foi cancelada ou transmitida em duplicidade acidental, altere a numeração do documento localmente para a próxima numeração livre e retransmita.`
  },
  {
    id: 'sefaz-rejeicao-539-duplicidade-chave',
    titulo: 'Rejeição 539: Duplicidade de NF-e com diferença na Chave de Acesso',
    categoria: 'sefaz_rejeicoes',
    tags: ['rejeicao 539', 'duplicidade chave', 'mesmo numero'],
    conteudo: `Ocorre quando já existe uma nota autorizada na SEFAZ com o mesmo CNPJ emitente, modelo, série e número, porém gerada com dados diferentes (código numérico, data de emissão ou certificado).
Como resolver:
- Não tente reenviar com os mesmos dados. Obtenha a nota já autorizada via Consulta de DF-e ou consulte a chave original no portal da SEFAZ Estadual.`
  },
  {
    id: 'sefaz-rejeicao-703-data-emissao',
    titulo: 'Rejeição 703: Data-Hora de Emissão posterior ao horário da SEFAZ',
    categoria: 'sefaz_rejeicoes',
    tags: ['rejeicao 703', 'relogio atrasado', 'data emissao', 'horario'],
    conteudo: `Ocorre quando o relógio do computador emitente está adiantado em mais de 5 minutos em relação aos servidores oficiais da SEFAZ.
Como resolver:
- No Windows, clique com o botão direito no relógio > "Ajustar data e hora" > marque "Definir horário automaticamente" e clique no botão "Sincronizar agora".`
  },
  {
    id: 'sefaz-contingencia-offline-nfce',
    titulo: 'Regras de Emissão em Contingência Offline da NFC-e (Modelo 65)',
    categoria: 'sefaz_rejeicoes',
    tags: ['contingencia offline', 'sem internet', 'tpemis 9', 'qrcode offline'],
    conteudo: `Quando os servidores da SEFAZ estiverem fora do ar ou o cliente estiver sem internet:
- A NFC-e pode ser emitida em contingência (tpEmis = 9), impressa em via única com a mensagem "Emitida em Contingência" e entregue ao cliente.
- Prazo Legal: A nota deve ser transmitida para a SEFAZ em até 24 horas úteis após o restabelecimento da comunicação.
- O Hub Desktop Paratech monitora a pasta de contingência e envia automaticamente assim que a conexão retorna.`
  },

  // 4. SISTEMAS PARATECH
  {
    id: 'sistema-mei-simples',
    titulo: 'MEI Simples • Aplicativo Nativo para Microempreendedores',
    categoria: 'sistemas_paratech',
    tags: ['mei simples', 'microempreendedor', 'pix', 'bloqueio automatico', 'saas'],
    conteudo: `O MEI Simples é o ecossistema SaaS da Paratech voltado para microempreendedores individuais.
- Opera 100% em nuvem e também possui executável local.
- Controle de vencimento de licença mensal (sugerido R$ 79,90) com cobrança Pix dinâmica.
- Em caso de inadimplência, aplica tela de bloqueio com banner customizado e WhatsApp de suporte, mas permite liberação temporária de 24h em confiança.
- Conta com catálogo em nuvem, sugestão tributária IA e emissão de notas fiscais simplificada.`
  },
  {
    id: 'sistema-tech-slim',
    titulo: 'Tech Slim • Frente de Caixa Ágil & NFC-e para Varejo',
    categoria: 'sistemas_paratech',
    tags: ['tech slim', 'pdv', 'nfce', 'varejo', 'frente de caixa', 'tef', 'balanca'],
    conteudo: `O Tech Slim é a solução de ponto de venda ultrarrápida da Paratech para mercados, padarias, açougues e lojas de varejo em geral:
- Emissão instantânea de NFC-e (modelo 65) síncrona.
- Integração homologada com TEF multi-bandeiras (crédito, débito, voucher e PIX dinâmico no Pinpad).
- Suporte a balanças de checkout seriais e USB (Toledo, Filizola, Urano).
- Abertura de gaveta eletrônica, controle de sangrias e suprimentos por operador de caixa.`
  },
  {
    id: 'sistema-tech-pro',
    titulo: 'Tech Pro • ERP Empresarial Completo & Gestão Fiscal',
    categoria: 'sistemas_paratech',
    tags: ['tech pro', 'erp', 'nfe 55', 'cte', 'mdfe', 'financeiro', 'dre', 'estoque'],
    conteudo: `O Tech Pro é o sistema corporativo mais completo da Paratech para distribuidores, indústrias e comércio em geral:
- Emissão de NF-e (Modelo 55) com devoluções, transferências, remessas e manifestação automática.
- Módulo de transporte com emissão de CT-e (Conhecimento de Transporte) e MDF-e (Manifesto Eletrônico).
- Módulo financeiro avançado: contas a pagar/receber, conciliação bancária, DRE gerencial e fluxo de caixa.
- Controle de estoque multi-depósito, grade de produtos (tamanhos e cores) e lote/validade.`
  },
  {
    id: 'sistema-gastro',
    titulo: 'Gastro • Food Service, Bares, Restaurantes & Delivery',
    categoria: 'sistemas_paratech',
    tags: ['gastro', 'restaurante', 'bar', 'pizzaria', 'comanda', 'mesas', 'delivery', 'cardapio digital'],
    conteudo: `O Gastro é o software da Paratech especializado no segmento de alimentação:
- Comandas eletrônicas em tablets ou celulares para garçons lançarem pedidos na mesa.
- Impressão automática em impressoras de produção (cozinha, bar, churrasqueira) via protocolo ESC/POS.
- Mapa de mesas visual e interativo em tempo real.
- Cardápio digital com QR Code nas mesas para autoatendimento.
- Módulo de delivery integrado com roteirizador de entregas e avisos no WhatsApp.`
  },
  {
    id: 'sistema-pes-ai',
    titulo: 'Pes.Ai • Pesagem Inteligente, Visão Computacional & Balanças com IA',
    categoria: 'sistemas_paratech',
    tags: ['pes ai', 'balanca', 'pesagem', 'visao computacional', 'ia', 'ean 13', 'tara'],
    conteudo: `O Pes.Ai é a solução de vanguarda da Paratech que une inteligência artificial e hardware de pesagem:
- Reconhecimento automático de itens pesáveis por visão computacional (identifica frutas, verduras e pães na balança sem digitar código).
- Geração e interpretação de etiquetas com código de barras padrão EAN-13 e GS1 DataBar de balança.
- Controle de tara automática para conformidade com normas do IPEM/Inmetro.
- Carga automática em lote de cadastros, preços e tabelas nutricionais para balanças de rede (MGV Toledo, Urano, Filizola).`
  }
];

/**
 * Motor de busca semântica do RAG
 * Retorna os artigos mais pertinentes combinando similaridade de termos, tags e categorias.
 */
export function buscarConhecimentoRAG(consulta: string, topK: number = 3): ArtigoConhecimento[] {
  const consultaNorm = consulta.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const termos = consultaNorm.split(/[\s\-_/]+/).filter(t => t.length >= 3);

  const scores: { artigo: ArtigoConhecimento; score: number }[] = BASE_CONHECIMENTO_FISCAL.map(artigo => {
    let score = 0;
    const tituloNorm = artigo.titulo.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const conteudoNorm = artigo.conteudo.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // 1. Termo exato no título
    if (tituloNorm.includes(consultaNorm)) score += 50;

    // 2. Pontuação por tags
    artigo.tags.forEach(tag => {
      if (consultaNorm.includes(tag)) score += 30;
      termos.forEach(termo => {
        if (tag.includes(termo)) score += 15;
      });
    });

    // 3. Pontuação por termos no título e conteúdo
    termos.forEach(termo => {
      if (tituloNorm.includes(termo)) score += 10;
      const countNoConteudo = (conteudoNorm.match(new RegExp(termo, 'g')) || []).length;
      score += Math.min(countNoConteudo * 2, 20);
    });

    return { artigo, score };
  });

  return scores
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(s => s.artigo);
}
