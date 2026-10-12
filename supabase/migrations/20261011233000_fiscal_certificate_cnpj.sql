-- Migration: Cadastro fiscal do cliente, Certificado Digital A1 e Detecção de CNPJ Divergente
ALTER TABLE clientes 
    ADD COLUMN IF NOT EXISTS nome_contato TEXT,
    ADD COLUMN IF NOT EXISTS cpf_contato TEXT,
    ADD COLUMN IF NOT EXISTS email_fiscal TEXT,
    ADD COLUMN IF NOT EXISTS certificado_url TEXT,
    ADD COLUMN IF NOT EXISTS certificado_senha TEXT,
    ADD COLUMN IF NOT EXISTS certificado_validade DATE;

-- Configuração do Hub para auto-excluir XMLs divergentes
ALTER TABLE configuracoes_hub
    ADD COLUMN IF NOT EXISTS auto_excluir_divergentes BOOLEAN DEFAULT false;

-- Marcação de CNPJ divergente nas tabelas de notas fiscais
ALTER TABLE nfe_saidas 
    ADD COLUMN IF NOT EXISTS cnpj_emitente TEXT,
    ADD COLUMN IF NOT EXISTS cnpj_divergente BOOLEAN DEFAULT false;

ALTER TABLE nfce_saidas 
    ADD COLUMN IF NOT EXISTS cnpj_emitente TEXT,
    ADD COLUMN IF NOT EXISTS cnpj_divergente BOOLEAN DEFAULT false;

ALTER TABLE nfe_entradas 
    ADD COLUMN IF NOT EXISTS cnpj_emitente TEXT,
    ADD COLUMN IF NOT EXISTS cnpj_destinatario TEXT,
    ADD COLUMN IF NOT EXISTS cnpj_divergente BOOLEAN DEFAULT false;
