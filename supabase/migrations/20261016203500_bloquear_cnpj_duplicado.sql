-- Migration: Bloqueio Rigoroso de Cadastros Repetidos na tabela Clientes
-- Garante que nenhum CNPJ ou CPF possa ser cadastrado em duplicidade, independentemente de pontuação (pontos, barras e traços)

-- 1. Cria índice de unicidade normalizado (apenas caracteres numéricos/alfanuméricos limpos)
CREATE UNIQUE INDEX IF NOT EXISTS clientes_cnpj_normalizado_unique_idx 
ON clientes (regexp_replace(cnpj, '[^a-zA-Z0-9]', '', 'g'))
WHERE cnpj IS NOT NULL AND cnpj != '';

-- 2. Índice equivalente para contabilidades
CREATE UNIQUE INDEX IF NOT EXISTS contabilidades_cnpj_normalizado_unique_idx 
ON contabilidades (regexp_replace(cnpj, '[^a-zA-Z0-9]', '', 'g'))
WHERE cnpj IS NOT NULL AND cnpj != '';
