-- Migration: Adicionar provedor de e-mail Resend na tabela integracoes
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM integracoes WHERE provedor = 'resend') THEN
    INSERT INTO integracoes (tipo, provedor, credenciais, is_ativo)
    VALUES ('email', 'resend', '{"api_key": "", "remetente_email": "onboarding@resend.dev", "remetente_nome": "Hub Paratech Fiscal"}'::jsonb, false);
  END IF;
END $$;
