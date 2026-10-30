-- Migration: Tabela de Registro de Disparos de WhatsApp e Toggle de Crons

-- 1. Coluna para controle do Cron de WhatsApp em configuracoes_portal_geral
ALTER TABLE configuracoes_portal_geral 
    ADD COLUMN IF NOT EXISTS cron_whatsapp_ativo BOOLEAN DEFAULT true;

-- 2. Tabela de Logs de Mensagens de WhatsApp
CREATE TABLE IF NOT EXISTS whatsapp_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    remetente TEXT NOT NULL DEFAULT 'Robô Automático (Cron)',
    destinatario_tipo TEXT NOT NULL DEFAULT 'cliente', -- 'cliente', 'contabilidade', 'admin', 'outro'
    destinatario_nome TEXT,
    destinatario_numero TEXT NOT NULL,
    motivo TEXT NOT NULL,
    modelo TEXT NOT NULL,
    mensagem TEXT NOT NULL,
    provedor TEXT,
    status TEXT NOT NULL DEFAULT 'sucesso', -- 'sucesso', 'falha'
    erro TEXT,
    resposta_api JSONB,
    cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
    contabilidade_id UUID REFERENCES contabilidades(id) ON DELETE SET NULL,
    fatura_id UUID REFERENCES faturas(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_created_at ON whatsapp_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_destinatario_tipo ON whatsapp_logs(destinatario_tipo);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_status ON whatsapp_logs(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_cliente_id ON whatsapp_logs(cliente_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_contabilidade_id ON whatsapp_logs(contabilidade_id);

-- RLS
ALTER TABLE whatsapp_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin All WhatsApp Logs" ON whatsapp_logs;
CREATE POLICY "Admin All WhatsApp Logs" ON whatsapp_logs
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur 
            WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
        )
    );
