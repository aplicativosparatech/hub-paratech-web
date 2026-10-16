-- ==============================================================================
-- DISTRIBUIÇÃO DE DF-e (CONSULTA DE NOTAS DESTINADAS CONTRA O CNPJ) E CONSULTAS SALVAS
-- ==============================================================================

-- 1. Tabela de Notas Fiscais Destinadas (Recebidas de Fornecedores contra o CNPJ)
CREATE TABLE IF NOT EXISTS dfe_notas_destinadas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
    chave TEXT NOT NULL,
    nsu TEXT,
    numero TEXT,
    serie TEXT,
    emitente_cnpj TEXT,
    emitente_nome TEXT,
    emitente_ie TEXT,
    destinatario_cnpj TEXT,
    valor NUMERIC(14, 2) DEFAULT 0,
    data_emissao TIMESTAMP WITH TIME ZONE,
    tipo_documento TEXT DEFAULT '55',
    situacao_nfe TEXT DEFAULT 'AUTORIZADA',
    manifestacao_status TEXT DEFAULT 'SEM_MANIFESTACAO',
    protocolo TEXT,
    storage_path TEXT,
    xml_completo TEXT,
    competencia TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(cliente_id, chave)
);

CREATE INDEX IF NOT EXISTS idx_dfe_notas_cliente ON dfe_notas_destinadas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_dfe_notas_chave ON dfe_notas_destinadas(chave);
CREATE INDEX IF NOT EXISTS idx_dfe_notas_comp ON dfe_notas_destinadas(cliente_id, competencia);

-- 2. Tabela de Consultas Salvas (Histórico Organizado por Cliente e Mês de Competência)
CREATE TABLE IF NOT EXISTS dfe_consultas_salvas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
    competencia TEXT NOT NULL,
    total_notas INTEGER DEFAULT 0,
    valor_total NUMERIC(14, 2) DEFAULT 0,
    dados_notas JSONB NOT NULL DEFAULT '[]'::jsonb,
    usuario_responsavel TEXT,
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dfe_consultas_cliente ON dfe_consultas_salvas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_dfe_consultas_comp ON dfe_consultas_salvas(competencia);

-- 3. Habilitação de RLS e Políticas de Acesso
ALTER TABLE dfe_notas_destinadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE dfe_consultas_salvas ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'dfe_notas_destinadas' AND policyname = 'dfe_notas_destinadas_auth_select') THEN
        CREATE POLICY dfe_notas_destinadas_auth_select ON dfe_notas_destinadas FOR SELECT TO authenticated USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'dfe_notas_destinadas' AND policyname = 'dfe_notas_destinadas_auth_all') THEN
        CREATE POLICY dfe_notas_destinadas_auth_all ON dfe_notas_destinadas FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'dfe_consultas_salvas' AND policyname = 'dfe_consultas_salvas_auth_select') THEN
        CREATE POLICY dfe_consultas_salvas_auth_select ON dfe_consultas_salvas FOR SELECT TO authenticated USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'dfe_consultas_salvas' AND policyname = 'dfe_consultas_salvas_auth_all') THEN
        CREATE POLICY dfe_consultas_salvas_auth_all ON dfe_consultas_salvas FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 4. Registrar novo módulo no catálogo de permissões
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
  'distribuicao_dfe',
  'Distribuição de DF-e (Notas Destinadas)',
  'Consulta de notas fiscais emitidas contra o CNPJ junto à SEFAZ, com download de XML, geração de DANFE e histórico de buscas salvas.',
  'Fiscal & SEFAZ',
  '/dashboard/distribuicao-dfe',
  'Inbox',
  14,
  true,
  true,
  true
) ON CONFLICT (modulo_chave) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  rota = EXCLUDED.rota,
  icone = EXCLUDED.icone;
