-- Tabela para guardar configurações globais de Gateways de Pagamento do Super Admin
CREATE TABLE gateways (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provedor TEXT NOT NULL UNIQUE CHECK (provedor IN ('infinitepay', 'mercadopago')),
    is_ativo BOOLEAN DEFAULT false,
    api_key TEXT,
    client_id TEXT,
    client_secret TEXT,
    wallet_id TEXT, -- Muito usado na InfinitePay
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Adicionar o segredo offline na configuração do hub
ALTER TABLE configuracoes_hub ADD COLUMN offline_secret TEXT DEFAULT encode(gen_random_bytes(16), 'hex');
ALTER TABLE configuracoes_hub ADD COLUMN intervalo_checagem_horas INTEGER DEFAULT 6;

-- RLS para gateways
ALTER TABLE gateways ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all actions for authenticated users on gateways" ON gateways FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Insert default rows
INSERT INTO gateways (provedor) VALUES ('infinitepay'), ('mercadopago') ON CONFLICT DO NOTHING;
