-- Migration: Taxas, Juros, Carência e Parâmetros de Desbloqueio em Confiança (Globais e Individuais)
-- Suporte completo a Mercado Pago e InfinitePay, e antecipação de faturas

-- 1. Campos globais em configuracoes_portal_geral
ALTER TABLE configuracoes_portal_geral 
    ADD COLUMN IF NOT EXISTS global_multa_atraso_percentual NUMERIC(5,2) DEFAULT 2.00,
    ADD COLUMN IF NOT EXISTS global_juros_mora_mensal_percentual NUMERIC(5,2) DEFAULT 1.00,
    ADD COLUMN IF NOT EXISTS global_dias_carencia INTEGER DEFAULT 3,
    ADD COLUMN IF NOT EXISTS limite_desbloqueios_confianca INTEGER DEFAULT 1,
    ADD COLUMN IF NOT EXISTS horas_desbloqueio_confianca INTEGER DEFAULT 24,
    ADD COLUMN IF NOT EXISTS intervalo_horas_entre_desbloqueios INTEGER DEFAULT 24;

-- 2. Campos individuais por cliente em clientes (sobrepõem os globais se definidos)
ALTER TABLE clientes 
    ADD COLUMN IF NOT EXISTS multa_atraso_percentual NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS juros_mora_mensal_percentual NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS dias_carencia INTEGER;

-- 3. Campos em faturas para suporte a juros, multa e Mercado Pago
ALTER TABLE faturas 
    ADD COLUMN IF NOT EXISTS valor_original NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS valor_multa NUMERIC(10,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS valor_juros NUMERIC(10,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS mercadopago_payment_id TEXT,
    ADD COLUMN IF NOT EXISTS provedor_pagamento TEXT;

-- 4. Inicializa valor_original nas faturas existentes
UPDATE faturas SET valor_original = valor WHERE valor_original IS NULL;
