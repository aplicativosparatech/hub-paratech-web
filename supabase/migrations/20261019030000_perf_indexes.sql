-- Migration: Otimização de Índices para Performance e Escala
-- Data: 2026-10-19
-- Descrição: Criação de índices compostos em tabelas críticas de alto volume (notas fiscais e faturas)

-- 1. Índices para Notas Fiscais de Saída (NF-e Modelo 55)
CREATE INDEX IF NOT EXISTS idx_nfe_saidas_cliente_emissao 
ON nfe_saidas (cliente_id, data_emissao DESC);

CREATE INDEX IF NOT EXISTS idx_nfe_saidas_cliente_divergencia 
ON nfe_saidas (cliente_id, cnpj_divergente);

CREATE INDEX IF NOT EXISTS idx_nfe_saidas_cliente_autorizada 
ON nfe_saidas (cliente_id, is_autorizada);

-- 2. Índices para Notas Fiscais de Consumidor (NFC-e Modelo 65) - Maior volume de varejo
CREATE INDEX IF NOT EXISTS idx_nfce_saidas_cliente_emissao 
ON nfce_saidas (cliente_id, data_emissao DESC);

CREATE INDEX IF NOT EXISTS idx_nfce_saidas_cliente_divergencia 
ON nfce_saidas (cliente_id, cnpj_divergente);

CREATE INDEX IF NOT EXISTS idx_nfce_saidas_cliente_autorizada 
ON nfce_saidas (cliente_id, is_autorizada);

-- 3. Índices para Notas Fiscais de Entrada (Compras)
CREATE INDEX IF NOT EXISTS idx_nfe_entradas_cliente_emissao 
ON nfe_entradas (cliente_id, data_emissao DESC);

CREATE INDEX IF NOT EXISTS idx_nfe_entradas_cliente_divergencia 
ON nfe_entradas (cliente_id, cnpj_divergente);

-- 4. Índices para Faturas e Cobrança
CREATE INDEX IF NOT EXISTS idx_faturas_cliente_status_venc 
ON faturas (cliente_id, status, data_vencimento);

CREATE INDEX IF NOT EXISTS idx_faturas_status_vencimento 
ON faturas (status, data_vencimento);

-- 5. Índices para Arquivos XML e Sincronização
CREATE INDEX IF NOT EXISTS idx_arquivos_xml_cliente_tipo 
ON arquivos_xml (cliente_id, tipo);

-- 6. Índices para Perfis e Permissões de Usuário
CREATE INDEX IF NOT EXISTS idx_user_roles_user_role 
ON user_roles (user_id, role);

CREATE INDEX IF NOT EXISTS idx_user_roles_cliente 
ON user_roles (role, cliente_id);

CREATE INDEX IF NOT EXISTS idx_user_roles_contabilidade 
ON user_roles (role, contabilidade_id);

-- 7. Índice para Configurações do Hub
CREATE INDEX IF NOT EXISTS idx_configuracoes_hub_cliente 
ON configuracoes_hub (cliente_id);
