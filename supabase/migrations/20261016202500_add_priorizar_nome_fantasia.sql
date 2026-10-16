-- Migration: Adicionar preferência global de exibição de empresas (Priorizar Nome Fantasia sobre Razão Social)
ALTER TABLE configuracoes_portal_geral 
    ADD COLUMN IF NOT EXISTS priorizar_nome_fantasia BOOLEAN DEFAULT false;
