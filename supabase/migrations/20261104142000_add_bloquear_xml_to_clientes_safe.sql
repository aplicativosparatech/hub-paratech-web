-- Migration: Adiciona a coluna bloquear_recepcao_xml_se_inadimplente tambem em clientes para compatibilidade retroativa total
ALTER TABLE clientes 
    ADD COLUMN IF NOT EXISTS bloquear_recepcao_xml_se_inadimplente BOOLEAN DEFAULT false;

-- Notifica o PostgREST para recarregar o schema cache
NOTIFY pgrst, 'reload schema';
