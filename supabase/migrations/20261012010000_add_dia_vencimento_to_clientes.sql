-- Migration para adicionar dia_vencimento na tabela clientes
ALTER TABLE clientes 
    ADD COLUMN IF NOT EXISTS dia_vencimento INTEGER DEFAULT 10;

-- Sincronizar dia_vencimento inicial a partir de configuracoes_hub para clientes existentes
UPDATE clientes c
SET dia_vencimento = COALESCE(ch.dia_vencimento, 10)
FROM configuracoes_hub ch
WHERE c.id = ch.cliente_id AND c.dia_vencimento IS NULL;

-- Sincronizar valor_mensalidade inicial a partir de configuracoes_hub se estiver zerado/nulo
UPDATE clientes c
SET valor_mensalidade = ch.valor_mensalidade
FROM configuracoes_hub ch
WHERE c.id = ch.cliente_id AND (c.valor_mensalidade IS NULL OR c.valor_mensalidade = 0);
