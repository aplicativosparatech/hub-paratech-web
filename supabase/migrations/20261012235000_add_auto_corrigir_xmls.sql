-- Adiciona configuracao para auto-corrigir e assinar XMLs sem protocolo usando certificado digital
ALTER TABLE configuracoes_hub 
ADD COLUMN IF NOT EXISTS auto_corrigir_assinar_xmls BOOLEAN DEFAULT FALSE;

-- Adiciona status de correcao nas notas
ALTER TABLE nfe_saidas
ADD COLUMN IF NOT EXISTS status_correcao TEXT DEFAULT NULL;

ALTER TABLE nfce_saidas
ADD COLUMN IF NOT EXISTS status_correcao TEXT DEFAULT NULL;
