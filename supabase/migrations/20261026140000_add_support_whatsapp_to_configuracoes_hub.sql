-- Adiciona campo de WhatsApp de Suporte do MEI Simples e Hub
ALTER TABLE configuracoes_hub ADD COLUMN IF NOT EXISTS support_whatsapp TEXT;
