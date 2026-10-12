-- Migration: Controle de permissão de avisos e relatórios de certificados digitais
ALTER TABLE configuracoes_hub
    ADD COLUMN IF NOT EXISTS exibir_certificados_contabilidade BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS exibir_certificados_cliente BOOLEAN DEFAULT false;
