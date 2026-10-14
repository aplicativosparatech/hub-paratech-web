-- Migration: Completar módulos e sub-funções configuráveis no painel de permissões
-- Atualiza categorias e insere Configurações Hub, Integrações APIs e sub-funções do Corretor, Saneador e Configurações

-- 1. Atualizar categorias existentes para ficarem padronizadas
UPDATE permissoes_modulos SET categoria = 'Inteligência Tributária & Auditoria' WHERE modulo_chave IN ('corretor_tributario', 'saneador_arquivos');
UPDATE permissoes_modulos SET categoria = 'Relatórios & Financeiro' WHERE modulo_chave IN ('relatorios_resumo', 'relatorios_monofasicos', 'relatorios_auditoria', 'faturas');

-- 2. Inserir novos módulos e sub-funções configuráveis
INSERT INTO permissoes_modulos (
  modulo_chave,
  nome,
  descricao,
  categoria,
  rota,
  icone,
  ordem,
  permitido_cliente,
  permitido_contabilidade,
  permitido_admin
) VALUES
  -- Relatórios (Geral)
  (
    'relatorios',
    'Painel Geral de Relatórios',
    'Acesso à visualização da tela principal de relatórios com gráficos, métricas e consolidações.',
    'Relatórios & Financeiro',
    '/dashboard/relatorios',
    'BarChart3',
    4,
    true,
    true,
    true
  ),

  -- Corretor Tributário: Decisões Manter/Corrigir
  (
    'corretor_aplicar_decisoes',
    'Corretor: Decidir Manter ou Corrigir Itens',
    'Permite que o usuário aprove as correções sugeridas de NCM, CEST, PIS/COFINS e Reforma Tributária (IBS/CBS) ou mantenha os valores originais.',
    'Inteligência Tributária & Auditoria',
    NULL,
    'Sparkles',
    8,
    false,
    true,
    true
  ),

  -- Saneador: Exportação de Arquivos Corrigidos
  (
    'saneador_gerar_arquivos',
    'Saneador: Exportar Arquivos Corrigidos',
    'Permite gerar e fazer o download de novos arquivos saneados (.xlsx, .db SQLite ou scripts SQL UPDATE com risco zero ao ERP).',
    'Inteligência Tributária & Auditoria',
    NULL,
    'Database',
    10,
    false,
    true,
    true
  ),

  -- Configurações Hub (Desktop)
  (
    'configuracoes_hub',
    'Configurações do Hub Desktop',
    'Gerenciar pastas monitoradas de vendas/compras, executáveis vigiados e regras de tolerância de cobrança do Hub.',
    'Configurações & Painéis',
    '/dashboard/configuracoes',
    'Settings',
    14,
    false,
    false,
    true
  ),

  -- Integrações (APIs, Gateways & IAs)
  (
    'integracoes',
    'Integrações (APIs, Gateways & Multi-IA)',
    'Configurar chaves de APIs do WhatsApp, gateways de pagamento (Asaas, InfinitePay), modelos de IA (Gemini, Groq, OpenAI) e Servidores MCP.',
    'Configurações & Painéis',
    '/dashboard/integracoes',
    'PlugZap',
    15,
    false,
    false,
    true
  ),

  -- Configurações do Portal: IA nos XMLs
  (
    'config_portal_ia_xmls',
    'Configurações Portal: Controle de IA nos XMLs',
    'Permite ligar ou desligar o módulo de auditoria com Multi-IA e enquadramento da Reforma Tributária (IBS, CBS e IVA Dual) nas notas do cliente.',
    'Configurações & Painéis',
    NULL,
    'Sliders',
    16,
    false,
    true,
    true
  ),

  -- Notas Fiscais: Correção & Contingência SEFAZ
  (
    'notas_fiscais_correcao',
    'Notas Fiscais: Análise de Correções SEFAZ',
    'Acesso à ferramenta de diagnóstico e auxílio de retificação de notas fiscais com rejeição ou pendência na SEFAZ.',
    'Documentos & XMLs',
    '/dashboard/notas-fiscais/saidas/correcao',
    'Wrench',
    4,
    false,
    true,
    true
  )
ON CONFLICT (modulo_chave) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  categoria = EXCLUDED.categoria,
  rota = EXCLUDED.rota,
  icone = EXCLUDED.icone,
  ordem = EXCLUDED.ordem;
