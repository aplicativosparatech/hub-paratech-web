-- Migration: Adicionar campo is_associacao a tabela clientes e motivo_divergencia em nfe_entradas
ALTER TABLE clientes 
    ADD COLUMN IF NOT EXISTS is_associacao BOOLEAN DEFAULT false;

ALTER TABLE nfe_entradas
    ADD COLUMN IF NOT EXISTS motivo_divergencia TEXT;
