-- Migration: Adicionar campo motivo_divergencia em nfe_entradas
ALTER TABLE nfe_entradas
    ADD COLUMN IF NOT EXISTS motivo_divergencia TEXT;
