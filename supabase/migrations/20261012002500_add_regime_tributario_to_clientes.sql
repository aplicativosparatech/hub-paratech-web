-- Migration: Adicionar regime tributario no cadastro de clientes para integracoes futuras
ALTER TABLE clientes 
    ADD COLUMN IF NOT EXISTS regime_tributario TEXT DEFAULT 'simples_nacional';
