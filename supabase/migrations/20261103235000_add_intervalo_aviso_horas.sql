-- Migration: Adiciona configuracao de intervalo de horas de aviso na tela e mensagem personalizada de aviso previo

ALTER TABLE configuracoes_hub 
    ADD COLUMN IF NOT EXISTS intervalo_aviso_horas INTEGER DEFAULT 4,
    ADD COLUMN IF NOT EXISTS mensagem_aviso_previo TEXT DEFAULT 'AVISO DE VENCIMENTO: Sua mensalidade vence em breve. Regularize via Pix no Hub para evitar bloqueio.';

NOTIFY pgrst, 'reload schema';
