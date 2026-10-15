-- Migration: Adiciona tabelas para NFS-e de Entradas e NFS-e de Saidas
-- Garante a estrutura completa de documentos fiscais municipais

CREATE TABLE IF NOT EXISTS nfse_entradas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
    numero TEXT,
    chave TEXT,
    codigo_verificacao TEXT,
    valor NUMERIC(12, 2) DEFAULT 0,
    data_emissao TIMESTAMP WITH TIME ZONE,
    data_entrada TIMESTAMP WITH TIME ZONE,
    fornecedor TEXT,
    cidade TEXT,
    uf TEXT,
    storage_path TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nfse_saidas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
    numero TEXT,
    chave TEXT,
    codigo_verificacao TEXT,
    valor NUMERIC(12, 2) DEFAULT 0,
    data_emissao TIMESTAMP WITH TIME ZONE,
    cliente TEXT,
    cidade TEXT,
    uf TEXT,
    storage_path TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nfse_entradas_cliente ON nfse_entradas(cliente_id, data_emissao);
CREATE INDEX IF NOT EXISTS idx_nfse_saidas_cliente ON nfse_saidas(cliente_id, data_emissao);
