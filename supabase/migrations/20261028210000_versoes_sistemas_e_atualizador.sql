-- Migration: Sistema Universal de Versões e Atualizações Paratech (Auto-Updater)
-- Suporte a: MEI Simples, Hub Desktop, TechSlim, TechPro, Gastro, Pes.ai e futuros apps

CREATE TABLE IF NOT EXISTS public.versoes_sistemas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sistema_id TEXT NOT NULL, -- 'mei_simples', 'hub_desktop', 'tech_slim', 'tech_pro', 'gastro', 'pes_ai'
  versao TEXT NOT NULL, -- Ex: '1.2.0'
  build_number INTEGER NOT NULL DEFAULT 1,
  obrigatoria BOOLEAN NOT NULL DEFAULT false, -- Se true, força atualização imediata mesmo se cliente configurou 'manual'
  url_download TEXT NOT NULL, -- URL do instalador/executável (.exe)
  changelog TEXT, -- Notas da versão / Novidades
  sha256 TEXT, -- Hash de integridade
  tamanho_bytes BIGINT, -- Tamanho do arquivo em bytes
  canal TEXT NOT NULL DEFAULT 'stable', -- 'stable', 'beta', 'alpha'
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_versoes_sistema_ativo ON public.versoes_sistemas (sistema_id, ativo, build_number DESC);

-- Telemetria das instalações dos clientes
CREATE TABLE IF NOT EXISTS public.telemetria_versoes_clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  sistema_id TEXT NOT NULL,
  versao_atual TEXT NOT NULL,
  build_number_atual INTEGER DEFAULT 1,
  politica_configurada TEXT DEFAULT 'informativa', -- 'automatica', 'informativa'
  ip_origem TEXT,
  nome_computador TEXT,
  sistema_operacional TEXT,
  ultima_checagem TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT telemetria_cliente_sistema_pc_key UNIQUE(cliente_id, sistema_id, nome_computador)
);

CREATE INDEX IF NOT EXISTS idx_telemetria_sistema ON public.telemetria_versoes_clientes (sistema_id, versao_atual);

-- Adicionar política de atualização por cliente no cadastro
ALTER TABLE public.clientes 
ADD COLUMN IF NOT EXISTS politica_atualizacao TEXT DEFAULT 'padrao'; -- 'padrao', 'automatica', 'informativa'

-- Habilitar RLS
ALTER TABLE public.versoes_sistemas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telemetria_versoes_clientes ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Permitir leitura de versões ativas para todos') THEN
    CREATE POLICY "Permitir leitura de versões ativas para todos" 
      ON public.versoes_sistemas FOR SELECT 
      USING (ativo = true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin pode gerenciar versoes_sistemas') THEN
    CREATE POLICY "Admin pode gerenciar versoes_sistemas"
      ON public.versoes_sistemas FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Permitir envio de telemetria') THEN
    CREATE POLICY "Permitir envio de telemetria"
      ON public.telemetria_versoes_clientes FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Criação do Bucket de Instaladores
INSERT INTO storage.buckets (id, name, public)
VALUES ('instaladores', 'instaladores', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Read Instaladores') THEN
    CREATE POLICY "Public Read Instaladores"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'instaladores');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin All Instaladores') THEN
    CREATE POLICY "Admin All Instaladores"
    ON storage.objects FOR ALL
    TO authenticated
    USING (bucket_id = 'instaladores')
    WITH CHECK (bucket_id = 'instaladores');
  END IF;
END $$;
