-- Migration: Adicionar WhatsApp de cobrança para clientes e configurações de envio de arquivos fiscais para contabilidades
ALTER TABLE clientes 
    ADD COLUMN IF NOT EXISTS whatsapp_cobranca TEXT;

ALTER TABLE contabilidades 
    ADD COLUMN IF NOT EXISTS whatsapp_arquivos_fiscais TEXT,
    ADD COLUMN IF NOT EXISTS email_arquivos_fiscais TEXT,
    ADD COLUMN IF NOT EXISTS receber_arquivos_whatsapp BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS receber_arquivos_email BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS admin_permite_envio_whatsapp BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS admin_permite_envio_email BOOLEAN DEFAULT true;
