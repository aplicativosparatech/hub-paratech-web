-- Migration: Adiciona opcao configuravel para bloquear recepcao de XMLs por inadimplencia

-- 1. Opcao individual por cliente em configuracoes_hub
ALTER TABLE configuracoes_hub 
    ADD COLUMN IF NOT EXISTS bloquear_recepcao_xml_se_inadimplente BOOLEAN DEFAULT false;

-- 2. Opcao global no portal em configuracoes_portal_geral
ALTER TABLE configuracoes_portal_geral 
    ADD COLUMN IF NOT EXISTS global_bloquear_recepcao_xml_se_inadimplente BOOLEAN DEFAULT false;

-- Notifica o PostgREST para recarregar o cache de schemas
NOTIFY pgrst, 'reload schema';
