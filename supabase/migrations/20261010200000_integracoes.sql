
CREATE TABLE integracoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo TEXT NOT NULL CHECK (tipo IN ('gateway', 'whatsapp')),
    provedor TEXT NOT NULL CHECK (provedor IN ('mercadopago', 'infinitepay', 'uazapi', 'evolution')),
    credenciais JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_ativo BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE integracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin All Integracoes" ON integracoes
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur 
            WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
        )
    );

-- Inserir os placeholders para o admin preencher na UI
INSERT INTO integracoes (tipo, provedor) VALUES 
('gateway', 'infinitepay'),
('gateway', 'mercadopago'),
('whatsapp', 'uazapi'),
('whatsapp', 'evolution');


