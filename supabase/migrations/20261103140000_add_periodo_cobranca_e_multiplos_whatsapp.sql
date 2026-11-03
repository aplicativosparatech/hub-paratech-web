-- Adiciona campo de periodicidade de cobrança no cadastro do cliente (mensal, quinzenal ou semanal)
ALTER TABLE clientes 
    ADD COLUMN IF NOT EXISTS periodo_cobranca TEXT DEFAULT 'mensal';

-- Adiciona campos de periodicidade e parcela na tabela de faturas
ALTER TABLE faturas 
    ADD COLUMN IF NOT EXISTS periodo_cobranca TEXT DEFAULT 'mensal',
    ADD COLUMN IF NOT EXISTS parcela_periodo INTEGER DEFAULT 1;

-- Atualiza faturas existentes sem periodo_cobranca para 'mensal'
UPDATE faturas SET periodo_cobranca = 'mensal' WHERE periodo_cobranca IS NULL;
UPDATE clientes SET periodo_cobranca = 'mensal' WHERE periodo_cobranca IS NULL;

COMMENT ON COLUMN clientes.periodo_cobranca IS 'Periodicidade de cobrança: mensal, quinzenal ou semanal';
COMMENT ON COLUMN faturas.periodo_cobranca IS 'Periodicidade da fatura: mensal, quinzenal ou semanal';
COMMENT ON COLUMN faturas.parcela_periodo IS 'Número da parcela/período no mês (ex: 1 ou 2 para quinzenal; 1 a 4 para semanal)';
