-- Migration: Storage RLS para certificados/xmls e configurações de alerta de certificados

-- 1. Novas colunas em configuracoes_hub para alerta de certificado
ALTER TABLE configuracoes_hub 
    ADD COLUMN IF NOT EXISTS avisar_whatsapp_certificado BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS exibir_faixa_topo_certificado BOOLEAN DEFAULT true;

-- 2. Garantir que os buckets existem
INSERT INTO storage.buckets (id, name, public)
VALUES ('xmls', 'xmls', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('certificados', 'certificados', false)
ON CONFLICT (id) DO NOTHING;

-- 3. RLS policies em storage.objects para o bucket xmls
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Allow authenticated uploads to xmls'
    ) THEN
        CREATE POLICY "Allow authenticated uploads to xmls" 
        ON storage.objects FOR INSERT TO authenticated 
        WITH CHECK (bucket_id = 'xmls');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Allow authenticated read xmls'
    ) THEN
        CREATE POLICY "Allow authenticated read xmls" 
        ON storage.objects FOR SELECT TO authenticated 
        USING (bucket_id = 'xmls');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Allow authenticated update xmls'
    ) THEN
        CREATE POLICY "Allow authenticated update xmls" 
        ON storage.objects FOR UPDATE TO authenticated 
        USING (bucket_id = 'xmls') WITH CHECK (bucket_id = 'xmls');
    END IF;
END $$;
