-- Migration: Adicionar campo custo à tabela clientes
ALTER TABLE clientes 
    ADD COLUMN IF NOT EXISTS custo NUMERIC(10,2) DEFAULT 0.00;
