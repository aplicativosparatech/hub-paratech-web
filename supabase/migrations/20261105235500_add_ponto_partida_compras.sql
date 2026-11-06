-- Migration: Ponto de Partida Fiscal e Competência Inicial para Notas de Compra / Entrada
ALTER TABLE clientes 
    ADD COLUMN IF NOT EXISTS data_inicio_monitoramento_entradas DATE,
    ADD COLUMN IF NOT EXISTS numero_inicial_compras_nfe INTEGER DEFAULT 1;

ALTER TABLE configuracoes_hub
    ADD COLUMN IF NOT EXISTS data_inicio_monitoramento_entradas DATE,
    ADD COLUMN IF NOT EXISTS numero_inicial_compras_nfe INTEGER DEFAULT 1;
