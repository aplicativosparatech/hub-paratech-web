-- Migration: Configurações Gerais do Portal (Valores Fictícios do Dashboard) e Cidades em Clientes
CREATE TABLE IF NOT EXISTS configuracoes_portal_geral (
    id INTEGER PRIMARY KEY DEFAULT 1,
    valores_ficticios_ativos BOOLEAN DEFAULT false,
    ficticio_clientes INTEGER DEFAULT 28,
    ficticio_contabilidades INTEGER DEFAULT 8,
    ficticio_faturas_atrasadas INTEGER DEFAULT 0,
    ficticio_nf_quantidade INTEGER DEFAULT 14500,
    ficticio_nf_valor NUMERIC(14,2) DEFAULT 894520.50,
    ficticio_relatorios INTEGER DEFAULT 120,
    ficticio_cidades INTEGER DEFAULT 14,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insere registro padrão com ID 1
INSERT INTO configuracoes_portal_geral (id, valores_ficticios_ativos)
VALUES (1, false)
ON CONFLICT (id) DO NOTHING;

-- RLS para configuracoes_portal_geral
ALTER TABLE configuracoes_portal_geral ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Todos autenticados podem ler configuracoes_portal_geral" ON configuracoes_portal_geral;
CREATE POLICY "Todos autenticados podem ler configuracoes_portal_geral"
    ON configuracoes_portal_geral FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Admin pode atualizar configuracoes_portal_geral" ON configuracoes_portal_geral;
CREATE POLICY "Admin pode atualizar configuracoes_portal_geral"
    ON configuracoes_portal_geral FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_roles.user_id = auth.uid() 
            AND user_roles.role = 'admin'
        )
    );

-- Adiciona campos de cidade e UF nos clientes se não existirem
ALTER TABLE clientes 
    ADD COLUMN IF NOT EXISTS cidade TEXT,
    ADD COLUMN IF NOT EXISTS uf TEXT;
