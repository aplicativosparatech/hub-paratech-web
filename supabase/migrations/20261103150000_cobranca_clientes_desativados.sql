-- Migration: Controle de Cobrança Intensiva 4x ao dia para Clientes Desativados com Faturas em Aberto

-- 1. Colunas de controle na tabela de faturas
ALTER TABLE faturas 
  ADD COLUMN IF NOT EXISTS ultimo_disparo_inativo_slot TEXT,
  ADD COLUMN IF NOT EXISTS ultimo_disparo_inativo_em TIMESTAMPTZ;

-- 2. Cadastro da rotina em integracoes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM integracoes WHERE tipo = 'cron' AND provedor = 'cobranca_inadimplentes'
  ) THEN
    INSERT INTO integracoes (tipo, provedor, is_ativo, credenciais) VALUES 
    ('cron', 'cobranca_inadimplentes', true, '{
        "nome": "Cobrança Intensiva de Clientes Desativados (4x ao dia)",
        "categoria": "WhatsApp",
        "endpoint": "/api/cron/billing-alerts?tipo=inadimplentes",
        "schedule": "0 12,17,20,0 * * *",
        "horario_amigavel": "4x ao dia: 09:00, 14:00, 17:00 e 21:00 (Brasília)",
        "descricao": "Dispara notificações automáticas de cobrança 4 vezes ao dia exclusivamente para clientes desativados que possuem faturas em aberto até a quitação, sempre alertando ser um aviso automático.",
        "permite_disparo_manual": true
    }'::jsonb);
  ELSE
    UPDATE integracoes 
    SET credenciais = '{
        "nome": "Cobrança Intensiva de Clientes Desativados (4x ao dia)",
        "categoria": "WhatsApp",
        "endpoint": "/api/cron/billing-alerts?tipo=inadimplentes",
        "schedule": "0 12,17,20,0 * * *",
        "horario_amigavel": "4x ao dia: 09:00, 14:00, 17:00 e 21:00 (Brasília)",
        "descricao": "Dispara notificações automáticas de cobrança 4 vezes ao dia exclusivamente para clientes desativados que possuem faturas em aberto até a quitação, sempre alertando ser um aviso automático.",
        "permite_disparo_manual": true
    }'::jsonb,
    is_ativo = true
    WHERE tipo = 'cron' AND provedor = 'cobranca_inadimplentes';
  END IF;
END $$;
