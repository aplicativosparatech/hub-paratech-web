-- Adiciona switch de ativação de análise com IA dos XMLs em configuracoes_hub
ALTER TABLE configuracoes_hub 
ADD COLUMN IF NOT EXISTS analise_ia_xmls_ativa BOOLEAN DEFAULT true;

-- Atualizar integracoes para garantir credenciais default de ia_geral
UPDATE integracoes 
SET credenciais = credenciais || '{"habilitar_ia_xmls": true, "habilitar_reforma_xmls": true}'::jsonb
WHERE provedor = 'ia_geral';
