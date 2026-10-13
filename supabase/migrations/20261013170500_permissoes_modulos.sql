-- Tabela de permissões e módulos do sistema
CREATE TABLE IF NOT EXISTS permissoes_modulos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modulo_chave TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  categoria TEXT NOT NULL,
  rota TEXT,
  icone TEXT,
  ordem INT DEFAULT 0,
  permitido_cliente BOOLEAN NOT NULL DEFAULT true,
  permitido_contabilidade BOOLEAN NOT NULL DEFAULT true,
  permitido_admin BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE permissoes_modulos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permissoes Modulos Authenticated Select" ON permissoes_modulos 
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Permissoes Modulos Authenticated Modify" ON permissoes_modulos 
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Inserção dos módulos padrão do sistema
INSERT INTO permissoes_modulos (modulo_chave, nome, descricao, categoria, rota, icone, ordem, permitido_cliente, permitido_contabilidade, permitido_admin)
VALUES
  (
    'notas_fiscais',
    'Notas Fiscais (NFe & NFCe)',
    'Acesso à visualização e listagem das notas fiscais de entrada e saída (modelos 55 e 65).',
    'Documentos & XMLs',
    '/dashboard/notas-fiscais',
    'FileDown',
    1,
    true,
    true,
    true
  ),
  (
    'download_xml_individual',
    'Download de XML Individual',
    'Permite que o usuário faça o download do arquivo XML original de cada nota diretamente na tabela.',
    'Documentos & XMLs',
    NULL,
    'Download',
    2,
    true,
    true,
    true
  ),
  (
    'download_xml_lote',
    'Download de XMLs em Lote (ZIP)',
    'Permite gerar e baixar pacotes compactados em .ZIP com todos os XMLs filtrados do período.',
    'Documentos & XMLs',
    NULL,
    'Archive',
    3,
    true,
    true,
    true
  ),
  (
    'relatorios_resumo',
    'Relatórios: Vendas & Formas de Pagamento',
    'Visualização de resumos consolidados por período, com totais em Dinheiro, Cartões, PIX, Boleto e Outros.',
    'Relatórios & Auditoria',
    '/dashboard/relatorios',
    'BarChart3',
    4,
    true,
    true,
    true
  ),
  (
    'relatorios_monofasicos',
    'Relatórios: Produtos Monofásicos',
    'Acesso à segregação de produtos sujeitos à tributação monofásica de PIS/COFINS (ideal para recuperação de impostos).',
    'Relatórios & Auditoria',
    '/dashboard/relatorios',
    'Coins',
    5,
    true,
    true,
    true
  ),
  (
    'relatorios_auditoria',
    'Relatórios: Auditoria Fiscal & Inconsistências',
    'Verificação de quebra de numeração sequencial, notas canceladas e divergências cadastrais na SEFAZ.',
    'Relatórios & Auditoria',
    '/dashboard/relatorios',
    'AlertTriangle',
    6,
    false,
    true,
    true
  ),
  (
    'faturas',
    'Financeiro: Minhas Faturas & Mensalidades',
    'Visualização das faturas do plano, código PIX para pagamento e histórico de mensalidades.',
    'Financeiro & Mensalidades',
    '/dashboard/minhas-faturas',
    'Receipt',
    7,
    true,
    false,
    true
  ),
  (
    'configuracoes_portal',
    'Configurações do Portal',
    'Configurar alertas de vencimento de certificados, escolha do processamento (Hub ou Portal) e auto-exclusão.',
    'Configurações & Painéis',
    '/dashboard/configuracoes-portal',
    'Sliders',
    8,
    true,
    true,
    true
  ),
  (
    'contabilidade_meus_clientes',
    'Escritório: Gestão de Clientes',
    'Permite que a contabilidade visualize e filtre todos os clientes vinculados ao seu escritório.',
    'Escritório & Cadastros',
    '/dashboard/meus-clientes',
    'Users',
    9,
    false,
    true,
    true
  ),
  (
    'meu_perfil',
    'Meu Perfil & Dados Cadastrais',
    'Acesso às informações cadastrais da empresa/escritório (CNPJ, Razão Social, contabilidade vinculada).',
    'Conta & Cadastros',
    '/dashboard/meu-perfil',
    'UserCircle',
    10,
    true,
    true,
    true
  )
ON CONFLICT (modulo_chave) DO NOTHING;
