-- Migration: Adicionar updated_at na tabela clientes
ALTER TABLE clientes 
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
