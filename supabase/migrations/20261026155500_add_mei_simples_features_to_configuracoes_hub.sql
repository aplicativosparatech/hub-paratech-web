-- Adiciona controle de restrição de recursos (Feature Flags) para o MEI Simples
ALTER TABLE configuracoes_hub ADD COLUMN IF NOT EXISTS feature_sugestao_tributaria BOOLEAN DEFAULT true;
ALTER TABLE configuracoes_hub ADD COLUMN IF NOT EXISTS feature_nuvem_produtos BOOLEAN DEFAULT true;
ALTER TABLE configuracoes_hub ADD COLUMN IF NOT EXISTS feature_loja_virtual BOOLEAN DEFAULT false;
ALTER TABLE configuracoes_hub ADD COLUMN IF NOT EXISTS feature_nfce BOOLEAN DEFAULT true;
ALTER TABLE configuracoes_hub ADD COLUMN IF NOT EXISTS feature_nfe BOOLEAN DEFAULT true;
ALTER TABLE configuracoes_hub ADD COLUMN IF NOT EXISTS feature_contas_pagar BOOLEAN DEFAULT true;
ALTER TABLE configuracoes_hub ADD COLUMN IF NOT EXISTS feature_estoque_avancado BOOLEAN DEFAULT true;
