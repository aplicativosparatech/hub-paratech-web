-- Adiciona configuração para aceitar apenas XMLs com protocolo de autorização SEFAZ e assinatura digital
ALTER TABLE configuracoes_hub 
ADD COLUMN IF NOT EXISTS apenas_xmls_autorizados BOOLEAN DEFAULT FALSE;
