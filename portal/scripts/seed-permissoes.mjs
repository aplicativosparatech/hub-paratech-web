import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mdjfzqlnkytmmibjgplb.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1kamZ6cWxua3l0bW1pYmpncGxiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTAzNDU1NSwiZXhwIjoyMTA2NjEwNTU1fQ.koqUCVtDCFS8MoyGb4oZcSAwtm7JyuA6cxj3lDgDNpE';

const supabase = createClient(supabaseUrl, serviceRoleKey);

const modulos = [
  {
    modulo_chave: 'notas_fiscais',
    nome: 'Notas Fiscais (NFe & NFCe)',
    descricao: 'Acesso à visualização e listagem das notas fiscais de entrada e saída (modelos 55 e 65).',
    categoria: 'Documentos & XMLs',
    rota: '/dashboard/notas-fiscais',
    icone: 'FileDown',
    ordem: 1,
    permitido_cliente: true,
    permitido_contabilidade: true,
    permitido_admin: true
  },
  {
    modulo_chave: 'download_xml_individual',
    nome: 'Download de XML Individual',
    descricao: 'Permite que o usuário faça o download do arquivo XML original de cada nota diretamente na tabela.',
    categoria: 'Documentos & XMLs',
    rota: null,
    icone: 'Download',
    ordem: 2,
    permitido_cliente: true,
    permitido_contabilidade: true,
    permitido_admin: true
  },
  {
    modulo_chave: 'download_xml_lote',
    nome: 'Download de XMLs em Lote (ZIP)',
    descricao: 'Permite gerar e baixar pacotes compactados em .ZIP com todos os XMLs filtrados do período.',
    categoria: 'Documentos & XMLs',
    rota: null,
    icone: 'Archive',
    ordem: 3,
    permitido_cliente: true,
    permitido_contabilidade: true,
    permitido_admin: true
  },
  {
    modulo_chave: 'notas_fiscais_correcao',
    nome: 'Notas Fiscais: Correção & Contingência SEFAZ',
    descricao: 'Acesso à ferramenta de diagnóstico e auxílio de retificação de notas com inconsistência na SEFAZ.',
    categoria: 'Documentos & XMLs',
    rota: '/dashboard/notas-fiscais/saidas/correcao',
    icone: 'Wrench',
    ordem: 4,
    permitido_cliente: false,
    permitido_contabilidade: true,
    permitido_admin: true
  },
  {
    modulo_chave: 'corretor_tributario',
    nome: 'Corretor Tributário de XMLs (IBS, CBS & ICMS)',
    descricao: 'Auditoria tributária dos itens contidos nos XMLs com diagnóstico de NCM, CEST, CFOP, CSOSN/CST, PIS/COFINS e enquadramento da Reforma Tributária (IBS e CBS) com Multi-IA.',
    categoria: 'Inteligência Tributária & Auditoria',
    rota: '/dashboard/corretor-tributario',
    icone: 'Sparkles',
    ordem: 5,
    permitido_cliente: false,
    permitido_contabilidade: true,
    permitido_admin: true
  },
  {
    modulo_chave: 'corretor_aplicar_decisoes',
    nome: 'Corretor: Decidir Manter ou Corrigir',
    descricao: 'Permite aprovar as correções tributárias sugeridas pelo motor de IA ou manter os valores originais de cada produto auditado.',
    categoria: 'Inteligência Tributária & Auditoria',
    rota: null,
    icone: 'Sparkles',
    ordem: 6,
    permitido_cliente: false,
    permitido_contabilidade: true,
    permitido_admin: true
  },
  {
    modulo_chave: 'saneador_arquivos',
    nome: 'Saneador de Arquivos & Bancos (IBS, CBS & Estoque)',
    descricao: 'Auditoria e saneamento de estoques em planilhas (.xlsx, .csv), cadastros (.json), dumps (.sql) e bancos (.db/sqlite) com mapeador inteligente.',
    categoria: 'Inteligência Tributária & Auditoria',
    rota: '/dashboard/saneador-arquivos',
    icone: 'Database',
    ordem: 7,
    permitido_cliente: false,
    permitido_contabilidade: true,
    permitido_admin: true
  },
  {
    modulo_chave: 'saneador_gerar_arquivos',
    nome: 'Saneador: Exportar Arquivos Corrigidos',
    descricao: 'Permite gerar e fazer o download de novos arquivos saneados (.xlsx, .db SQLite ou scripts SQL de UPDATE seguros para o ERP).',
    categoria: 'Inteligência Tributária & Auditoria',
    rota: null,
    icone: 'Database',
    ordem: 8,
    permitido_cliente: false,
    permitido_contabilidade: true,
    permitido_admin: true
  },
  {
    modulo_chave: 'relatorios',
    nome: 'Painel Geral de Relatórios',
    descricao: 'Acesso à tela consolidada de relatórios fiscais, contábeis e gráficos de faturamento.',
    categoria: 'Relatórios & Financeiro',
    rota: '/dashboard/relatorios',
    icone: 'BarChart3',
    ordem: 9,
    permitido_cliente: true,
    permitido_contabilidade: true,
    permitido_admin: true
  },
  {
    modulo_chave: 'relatorios_resumo',
    nome: 'Relatórios: Vendas & Formas de Pagamento',
    descricao: 'Visualização de resumos consolidados por período com totais em Dinheiro, Cartões, PIX, Boleto e Outros.',
    categoria: 'Relatórios & Financeiro',
    rota: '/dashboard/relatorios',
    icone: 'BarChart3',
    ordem: 10,
    permitido_cliente: true,
    permitido_contabilidade: true,
    permitido_admin: true
  },
  {
    modulo_chave: 'relatorios_monofasicos',
    nome: 'Relatórios: Produtos Monofásicos',
    descricao: 'Segregação de produtos sujeitos à tributação monofásica de PIS/COFINS para recuperação tributária.',
    categoria: 'Relatórios & Financeiro',
    rota: '/dashboard/relatorios',
    icone: 'Coins',
    ordem: 11,
    permitido_cliente: true,
    permitido_contabilidade: true,
    permitido_admin: true
  },
  {
    modulo_chave: 'relatorios_auditoria',
    nome: 'Relatórios: Auditoria Fiscal & Inconsistências',
    descricao: 'Verificação de quebra de numeração sequencial, notas canceladas e divergências cadastrais na SEFAZ.',
    categoria: 'Relatórios & Financeiro',
    rota: '/dashboard/relatorios',
    icone: 'AlertTriangle',
    ordem: 12,
    permitido_cliente: false,
    permitido_contabilidade: true,
    permitido_admin: true
  },
  {
    modulo_chave: 'faturas',
    nome: 'Financeiro: Minhas Faturas & Mensalidades',
    descricao: 'Visualização das faturas do plano, código PIX para pagamento e histórico de mensalidades.',
    categoria: 'Relatórios & Financeiro',
    rota: '/dashboard/minhas-faturas',
    icone: 'Receipt',
    ordem: 13,
    permitido_cliente: true,
    permitido_contabilidade: false,
    permitido_admin: true
  },
  {
    modulo_chave: 'configuracoes_portal',
    nome: 'Configurações do Portal',
    descricao: 'Configurar alertas de vencimento de certificados A1, modo de processamento (Hub ou Portal) e chaves da empresa.',
    categoria: 'Configurações & Painéis',
    rota: '/dashboard/configuracoes-portal',
    icone: 'Sliders',
    ordem: 14,
    permitido_cliente: true,
    permitido_contabilidade: true,
    permitido_admin: true
  },
  {
    modulo_chave: 'config_portal_ia_xmls',
    nome: 'Configurações Portal: Controle de IA nos XMLs',
    descricao: 'Permite alterar a chave de ativação da análise com Multi-IA e Reforma Tributária (IBS/CBS) nas notas do cliente.',
    categoria: 'Configurações & Painéis',
    rota: null,
    icone: 'Sliders',
    ordem: 15,
    permitido_cliente: false,
    permitido_contabilidade: true,
    permitido_admin: true
  },
  {
    modulo_chave: 'configuracoes_hub',
    nome: 'Configurações do Hub Desktop',
    descricao: 'Gerenciar pastas locais de vendas/compras monitoradas, executáveis vigiados e regras de tolerância de bloqueio do Hub.',
    categoria: 'Configurações & Painéis',
    rota: '/dashboard/configuracoes',
    icone: 'Settings',
    ordem: 16,
    permitido_cliente: false,
    permitido_contabilidade: false,
    permitido_admin: true
  },
  {
    modulo_chave: 'integracoes',
    nome: 'Integrações (APIs, Gateways & Multi-IA)',
    descricao: 'Configurar e testar chaves de APIs (WhatsApp, Gateways de Pagamento, Provedores de IA Gemini/Groq/OpenAI e Servidores MCP).',
    categoria: 'Configurações & Painéis',
    rota: '/dashboard/integracoes',
    icone: 'PlugZap',
    ordem: 17,
    permitido_cliente: false,
    permitido_contabilidade: false,
    permitido_admin: true
  },
  {
    modulo_chave: 'contabilidade_meus_clientes',
    nome: 'Escritório: Gestão de Clientes',
    descricao: 'Permite que a contabilidade visualize, acerte cadastros e filtre todos os clientes vinculados ao seu escritório.',
    categoria: 'Escritório & Cadastros',
    rota: '/dashboard/meus-clientes',
    icone: 'Users',
    ordem: 18,
    permitido_cliente: false,
    permitido_contabilidade: true,
    permitido_admin: true
  },
  {
    modulo_chave: 'meu_perfil',
    nome: 'Meu Perfil & Dados Cadastrais',
    descricao: 'Acesso às informações cadastrais da empresa/escritório (CNPJ, Razão Social, contabilidade vinculada).',
    categoria: 'Escritório & Cadastros',
    rota: '/dashboard/meu-perfil',
    icone: 'UserCircle',
    ordem: 19,
    permitido_cliente: true,
    permitido_contabilidade: true,
    permitido_admin: true
  }
];

async function seed() {
  console.log(`Iniciando sincronização de ${modulos.length} módulos...`);
  const { data, error } = await supabase
    .from('permissoes_modulos')
    .upsert(modulos, { onConflict: 'modulo_chave' })
    .select('id, modulo_chave, nome');

  if (error) {
    console.error('Erro ao sincronizar permissoes_modulos:', error);
  } else {
    console.log('Sucesso! Módulos sincronizados no banco de dados:', data.length);
  }
}

seed();
