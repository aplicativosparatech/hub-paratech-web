-- Migration: Adicionar preferência de cliente padrão ao fazer login (vazio por padrão ou manter último usado)
ALTER TABLE configuracoes_portal_geral 
    ADD COLUMN IF NOT EXISTS cliente_padrao_login VARCHAR(20) DEFAULT 'vazio';
