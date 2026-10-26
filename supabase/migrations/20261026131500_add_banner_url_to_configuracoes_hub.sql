-- Adiciona suporte a Banner Promocional / Contabilidade no Hub para o MEI Simples (inclusive GIF animado)
ALTER TABLE configuracoes_hub ADD COLUMN IF NOT EXISTS banner_url TEXT;
