-- Adiciona Inscrição Estadual ao cadastro de clientes
ALTER TABLE clientes 
ADD COLUMN IF NOT EXISTS inscricao_estadual TEXT;

-- Adiciona motivo de divergência e campos de conferência às notas fiscais
ALTER TABLE nfe_saidas 
ADD COLUMN IF NOT EXISTS motivo_divergencia TEXT,
ADD COLUMN IF NOT EXISTS cnpj_emitente TEXT,
ADD COLUMN IF NOT EXISTS cnpj_divergente BOOLEAN DEFAULT FALSE;

ALTER TABLE nfce_saidas 
ADD COLUMN IF NOT EXISTS motivo_divergencia TEXT,
ADD COLUMN IF NOT EXISTS cnpj_emitente TEXT,
ADD COLUMN IF NOT EXISTS cnpj_divergente BOOLEAN DEFAULT FALSE;
