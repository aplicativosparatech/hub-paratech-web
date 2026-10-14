-- Remover constraints restritivas de tipo e provedor para permitir IAs e Servidores MCP
ALTER TABLE integracoes DROP CONSTRAINT IF EXISTS integracoes_tipo_check;
ALTER TABLE integracoes DROP CONSTRAINT IF EXISTS integracoes_provedor_check;

-- Inserir provedores de IA e MCP caso ainda não existam
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM integracoes WHERE provedor = 'gemini') THEN
    INSERT INTO integracoes (tipo, provedor, credenciais, is_ativo)
    VALUES ('ia', 'gemini', '{"api_key": "", "model": "gemini-2.5-flash", "nome": "Google Gemini"}'::jsonb, false);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM integracoes WHERE provedor = 'groq') THEN
    INSERT INTO integracoes (tipo, provedor, credenciais, is_ativo)
    VALUES ('ia', 'groq', '{"api_key": "", "model": "llama-3.3-70b-versatile", "nome": "Groq Llama 3.3"}'::jsonb, false);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM integracoes WHERE provedor = 'openai') THEN
    INSERT INTO integracoes (tipo, provedor, credenciais, is_ativo)
    VALUES ('ia', 'openai', '{"api_key": "", "model": "gpt-4o-mini", "nome": "OpenAI GPT-4o"}'::jsonb, false);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM integracoes WHERE provedor = 'claude') THEN
    INSERT INTO integracoes (tipo, provedor, credenciais, is_ativo)
    VALUES ('ia', 'claude', '{"api_key": "", "model": "claude-3-5-sonnet-20241022", "nome": "Anthropic Claude"}'::jsonb, false);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM integracoes WHERE provedor = 'ollama') THEN
    INSERT INTO integracoes (tipo, provedor, credenciais, is_ativo)
    VALUES ('ia', 'ollama', '{"endpoint": "http://localhost:11434", "model": "llama3", "nome": "Ollama Local"}'::jsonb, false);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM integracoes WHERE provedor = 'mcp_fiscal_brasil') THEN
    INSERT INTO integracoes (tipo, provedor, credenciais, is_ativo)
    VALUES ('mcp', 'mcp_fiscal_brasil', '{"endpoint": "http://localhost:8000/sse", "token": "", "nome": "MCP Fiscal Brasil"}'::jsonb, false);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM integracoes WHERE provedor = 'fiscal_ai') THEN
    INSERT INTO integracoes (tipo, provedor, credenciais, is_ativo)
    VALUES ('mcp', 'fiscal_ai', '{"endpoint": "https://api.fiscal.ai/v1", "api_key": "", "nome": "Fiscal.ai"}'::jsonb, false);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM integracoes WHERE provedor = 'ia_geral') THEN
    INSERT INTO integracoes (tipo, provedor, credenciais, is_ativo)
    VALUES ('ia_config', 'ia_geral', '{"modo_consenso": true, "ia_fallback": "gemini", "temperatura": 0.2}'::jsonb, true);
  END IF;
END $$;

-- Adiciona o módulo Saneador Tributário de Arquivos e Bancos na tabela de permissões
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
) VALUES (
  'saneador_arquivos',
  'Saneador de Arquivos & Bancos (IBS, CBS e ICMS)',
  'Auditoria e saneamento tributário de planilhas (.xlsx, .csv), cadastros (.json), dumps (.sql) e bancos (.db/sqlite). Diagnóstico e correção de NCM, CEST, CFOP, CSOSN/CST, PIS/COFINS e Reforma Tributária (IBS e CBS) com Multi-IA.',
  'Relatórios & Auditoria',
  '/dashboard/saneador-arquivos',
  'Database',
  8,
  false,
  true,
  true
) ON CONFLICT (modulo_chave) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  rota = EXCLUDED.rota;
