-- Migration: Permitir valores default ou nulos em dia_vencimento e valor_mensalidade na configuracoes_hub
ALTER TABLE configuracoes_hub 
    ALTER COLUMN dia_vencimento DROP NOT NULL,
    ALTER COLUMN dia_vencimento SET DEFAULT 10;

ALTER TABLE configuracoes_hub 
    ALTER COLUMN valor_mensalidade DROP NOT NULL,
    ALTER COLUMN valor_mensalidade SET DEFAULT 0.00;
