-- Migration: Adicionar coluna whatsapp à tabela clientes
ALTER TABLE clientes 
    ADD COLUMN IF NOT EXISTS whatsapp TEXT;
