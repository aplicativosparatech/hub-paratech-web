-- Adiciona suporte a versionamento do Hub Desktop e comandos remotos pelo portal
ALTER TABLE configuracoes_hub
ADD COLUMN IF NOT EXISTS versao_hub_instalada TEXT,
ADD COLUMN IF NOT EXISTS comando_remoto TEXT,
ADD COLUMN IF NOT EXISTS comando_remoto_em TIMESTAMPTZ;
