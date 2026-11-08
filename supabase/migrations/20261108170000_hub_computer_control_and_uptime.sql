-- Suporte a monitoramento de Uptime (tempo ligado), identificação da máquina e Wake-on-LAN
ALTER TABLE configuracoes_hub
ADD COLUMN IF NOT EXISTS uptime_segundos BIGINT,
ADD COLUMN IF NOT EXISTS computador_nome TEXT,
ADD COLUMN IF NOT EXISTS ip_local TEXT,
ADD COLUMN IF NOT EXISTS mac_address TEXT;

-- View agregada para totais de XMLs por cliente e modelo de nota
CREATE OR REPLACE VIEW v_hub_xml_totais AS
SELECT 
    c.id as cliente_id,
    COALESCE(nfce.total, 0)::INT as total_nfce,
    COALESCE(nfe.total, 0)::INT as total_nfe,
    COALESCE(entr.total, 0)::INT as total_entradas,
    (COALESCE(nfce.total, 0) + COALESCE(nfe.total, 0) + COALESCE(entr.total, 0))::INT as total_geral
FROM clientes c
LEFT JOIN (SELECT cliente_id, count(*) as total FROM nfce_saidas GROUP BY cliente_id) nfce ON nfce.cliente_id = c.id
LEFT JOIN (SELECT cliente_id, count(*) as total FROM nfe_saidas GROUP BY cliente_id) nfe ON nfe.cliente_id = c.id
LEFT JOIN (SELECT cliente_id, count(*) as total FROM nfe_entradas GROUP BY cliente_id) entr ON entr.cliente_id = c.id;
