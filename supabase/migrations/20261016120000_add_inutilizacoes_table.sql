-- Migração para registrar inutilizações de notas fiscais (NF-e e NFC-e) junto à SEFAZ
CREATE TABLE IF NOT EXISTS inutilizacoes_saidas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
    modelo TEXT NOT NULL, -- '55' (NF-e) ou '65' (NFC-e)
    serie TEXT NOT NULL,
    numero_inicial INTEGER NOT NULL,
    numero_final INTEGER NOT NULL,
    ano TEXT NOT NULL, -- ex: '26'
    justificativa TEXT NOT NULL,
    protocolo TEXT,
    data_hora TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status_sefaz TEXT NOT NULL, -- '102' (homologado), '204' (duplicidade/já inutilizado), '206' (já utilizado), '256', 'ERRO'
    motivo_sefaz TEXT,
    xml_pedido TEXT,
    xml_retorno TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para otimização de consultas
CREATE INDEX IF NOT EXISTS idx_inut_cliente_modelo_serie ON inutilizacoes_saidas(cliente_id, modelo, serie);
CREATE INDEX IF NOT EXISTS idx_inut_faixa ON inutilizacoes_saidas(numero_inicial, numero_final);

-- Habilitar RLS
ALTER TABLE inutilizacoes_saidas ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'inutilizacoes_saidas' AND policyname = 'Acesso irrestrito a inutilizacoes_saidas para usuarios autenticados'
    ) THEN
        CREATE POLICY "Acesso irrestrito a inutilizacoes_saidas para usuarios autenticados"
        ON inutilizacoes_saidas
        FOR ALL
        TO authenticated
        USING (true)
        WITH CHECK (true);
    END IF;
END $$;
