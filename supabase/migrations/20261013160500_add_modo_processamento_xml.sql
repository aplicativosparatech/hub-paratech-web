-- Adiciona configuracao de escolha do modo de processamento de XMLs (pelo Hub ou pelo Portal)
ALTER TABLE configuracoes_hub 
ADD COLUMN IF NOT EXISTS modo_processamento_xml TEXT DEFAULT 'hub';
