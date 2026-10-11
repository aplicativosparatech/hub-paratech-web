-- Adiciona colunas para auditoria avançada de XML nas tabelas fiscais
ALTER TABLE nfe_entradas 
    ADD COLUMN IF NOT EXISTS serie TEXT,
    ADD COLUMN IF NOT EXISTS cstat TEXT,
    ADD COLUMN IF NOT EXISTS motivo_sefaz TEXT,
    ADD COLUMN IF NOT EXISTS protocolo TEXT,
    ADD COLUMN IF NOT EXISTS is_autorizada BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS valor_monofasico NUMERIC(12, 2) DEFAULT 0;

ALTER TABLE nfe_saidas 
    ADD COLUMN IF NOT EXISTS serie TEXT,
    ADD COLUMN IF NOT EXISTS cstat TEXT,
    ADD COLUMN IF NOT EXISTS motivo_sefaz TEXT,
    ADD COLUMN IF NOT EXISTS protocolo TEXT,
    ADD COLUMN IF NOT EXISTS is_autorizada BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS valor_monofasico NUMERIC(12, 2) DEFAULT 0;

ALTER TABLE nfce_saidas 
    ADD COLUMN IF NOT EXISTS serie TEXT,
    ADD COLUMN IF NOT EXISTS cstat TEXT,
    ADD COLUMN IF NOT EXISTS motivo_sefaz TEXT,
    ADD COLUMN IF NOT EXISTS protocolo TEXT,
    ADD COLUMN IF NOT EXISTS is_autorizada BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS valor_monofasico NUMERIC(12, 2) DEFAULT 0;
