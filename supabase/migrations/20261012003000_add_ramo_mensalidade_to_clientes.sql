-- Migration: Adicionar ramo de atividade e valor da mensalidade na tabela clientes
ALTER TABLE clientes 
    ADD COLUMN IF NOT EXISTS ramo_atividade TEXT,
    ADD COLUMN IF NOT EXISTS valor_mensalidade NUMERIC(10,2) DEFAULT 0.00;
