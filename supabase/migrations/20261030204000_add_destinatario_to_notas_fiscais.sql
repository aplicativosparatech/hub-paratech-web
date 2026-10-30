-- Migration: Adiciona colunas para Destinatário e Emitente nas tabelas de notas fiscais
-- Permite busca textual, filtros e exibição imediata nas listagens fiscais

ALTER TABLE nfe_saidas 
    ADD COLUMN IF NOT EXISTS destinatario_nome TEXT,
    ADD COLUMN IF NOT EXISTS destinatario_documento TEXT,
    ADD COLUMN IF NOT EXISTS emitente_nome TEXT;

ALTER TABLE nfce_saidas 
    ADD COLUMN IF NOT EXISTS destinatario_nome TEXT,
    ADD COLUMN IF NOT EXISTS destinatario_documento TEXT,
    ADD COLUMN IF NOT EXISTS emitente_nome TEXT;

ALTER TABLE nfe_entradas 
    ADD COLUMN IF NOT EXISTS destinatario_nome TEXT,
    ADD COLUMN IF NOT EXISTS destinatario_documento TEXT,
    ADD COLUMN IF NOT EXISTS emitente_nome TEXT;

ALTER TABLE nfse_saidas 
    ADD COLUMN IF NOT EXISTS destinatario_nome TEXT,
    ADD COLUMN IF NOT EXISTS destinatario_documento TEXT,
    ADD COLUMN IF NOT EXISTS emitente_nome TEXT;

ALTER TABLE nfse_entradas 
    ADD COLUMN IF NOT EXISTS destinatario_nome TEXT,
    ADD COLUMN IF NOT EXISTS destinatario_documento TEXT,
    ADD COLUMN IF NOT EXISTS emitente_nome TEXT;

CREATE INDEX IF NOT EXISTS idx_nfe_saidas_destinatario ON nfe_saidas(destinatario_nome);
CREATE INDEX IF NOT EXISTS idx_nfce_saidas_destinatario ON nfce_saidas(destinatario_nome);
CREATE INDEX IF NOT EXISTS idx_nfe_entradas_destinatario ON nfe_entradas(destinatario_nome);
