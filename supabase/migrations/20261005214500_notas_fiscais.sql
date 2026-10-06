INSERT INTO storage.buckets (id, name, public) VALUES ('xmls', 'xmls', false) ON CONFLICT DO NOTHING;

CREATE TABLE nfe_entradas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
    numero TEXT,
    chave TEXT UNIQUE NOT NULL,
    valor NUMERIC(12, 2),
    data_emissao TIMESTAMP WITH TIME ZONE,
    data_transmissao TIMESTAMP WITH TIME ZONE,
    tem_assinatura BOOLEAN DEFAULT false,
    storage_path TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE nfe_saidas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
    numero TEXT,
    chave TEXT UNIQUE NOT NULL,
    valor NUMERIC(12, 2),
    data_emissao TIMESTAMP WITH TIME ZONE,
    data_transmissao TIMESTAMP WITH TIME ZONE,
    tem_assinatura BOOLEAN DEFAULT false,
    storage_path TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE nfce_saidas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
    numero TEXT,
    chave TEXT UNIQUE NOT NULL,
    valor NUMERIC(12, 2),
    data_emissao TIMESTAMP WITH TIME ZONE,
    data_transmissao TIMESTAMP WITH TIME ZONE,
    tem_assinatura BOOLEAN DEFAULT false,
    storage_path TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
