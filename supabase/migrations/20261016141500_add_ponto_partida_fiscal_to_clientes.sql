-- Migration: Ponto de Partida Fiscal e Competência Inicial para Clientes
ALTER TABLE clientes 
    ADD COLUMN IF NOT EXISTS data_inicio_monitoramento DATE,
    ADD COLUMN IF NOT EXISTS numero_inicial_nfe INTEGER DEFAULT 1,
    ADD COLUMN IF NOT EXISTS numero_inicial_nfce INTEGER DEFAULT 1,
    ADD COLUMN IF NOT EXISTS numero_inicial_nfse INTEGER DEFAULT 1,
    ADD COLUMN IF NOT EXISTS numero_inicial_cte INTEGER DEFAULT 1,
    ADD COLUMN IF NOT EXISTS numero_inicial_mdfe INTEGER DEFAULT 1;
