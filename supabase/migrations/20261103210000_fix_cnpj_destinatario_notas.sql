-- Migration: Adiciona coluna cnpj_destinatario em nfce_saidas e nfe_saidas para compatibilidade com nfe_entradas

ALTER TABLE nfce_saidas ADD COLUMN IF NOT EXISTS cnpj_destinatario TEXT;
ALTER TABLE nfe_saidas ADD COLUMN IF NOT EXISTS cnpj_destinatario TEXT;

NOTIFY pgrst, 'reload schema';
