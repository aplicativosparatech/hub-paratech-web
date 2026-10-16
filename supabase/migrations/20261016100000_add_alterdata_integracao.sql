-- Migration: Adicionar Integração com Ecossistema Alterdata (nf-stock & ePlugin)
-- Tabela de logs de sincronização e registro inicial na tabela de integrações

-- 1. Inserir provedor Alterdata na tabela integracoes caso não exista
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM integracoes WHERE provedor = 'alterdata') THEN
    INSERT INTO integracoes (tipo, provedor, credenciais, is_ativo)
    VALUES (
      'contabil_erp',
      'alterdata',
      '{
        "nome": "Alterdata Software",
        "nfstock_token": "",
        "nfstock_codigo_crm": "",
        "eplugin_token": "",
        "cnpj_contabilidade": "",
        "ambiente": "producao",
        "sync_xml_vendas": true,
        "sync_xml_compras": false,
        "fechamento_contabil": false,
        "relatorio_monofasicos": true,
        "leitura_guias": true,
        "aviso_whatsapp_guias": false,
        "pre_admissao": false,
        "rateio_folha": false
      }'::jsonb,
      false
    );
  END IF;
END $$;

-- 2. Tabela de logs de auditoria e sincronização com a Alterdata
CREATE TABLE IF NOT EXISTS alterdata_sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
    contabilidade_id UUID REFERENCES contabilidades(id) ON DELETE SET NULL,
    tipo_operacao VARCHAR(50) NOT NULL, -- 'XML_UPLOAD', 'LANCAMENTO_CONTABIL', 'GUIA_SYNC', 'PRE_ADMISSAO'
    status VARCHAR(20) NOT NULL, -- 'SUCESSO', 'ERRO', 'PENDENTE'
    identificador_externo TEXT,
    payload_resumo JSONB,
    mensagem_retorno TEXT,
    duracao_ms INT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS para alterdata_sync_logs
ALTER TABLE alterdata_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alterdata Sync Logs Authenticated Select" ON alterdata_sync_logs 
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Alterdata Sync Logs Authenticated Insert" ON alterdata_sync_logs 
  FOR INSERT TO authenticated WITH CHECK (true);

-- 3. Inserir módulos configuráveis na tabela permissoes_modulos
INSERT INTO permissoes_modulos (
  modulo_chave,
  nome,
  descricao,
  categoria,
  rota,
  icone,
  ordem,
  permitido_cliente,
  permitido_contabilidade,
  permitido_admin
) VALUES
  (
    'alterdata_integracao',
    'Integração Alterdata (nf-stock & ePlugin)',
    'Conexão direta à nuvem da Alterdata para tráfego automático de XMLs fiscais, conciliação e documentos.',
    'Integrações & Contabilidade',
    '/dashboard/integracoes',
    'Database',
    18,
    false,
    true,
    true
  ),
  (
    'alterdata_fechamento_contabil',
    'Alterdata: Fechamento Contábil Automático',
    'Gera e transmite lotes de lançamentos contábeis a partir das formas de pagamento e faturamento do PDV.',
    'Integrações & Contabilidade',
    NULL,
    'Coins',
    19,
    false,
    true,
    true
  ),
  (
    'alterdata_leitura_guias',
    'Alterdata: Mural de Guias & Tributos',
    'Exibe e disponibiliza guias geradas pelo contador no eContador com alertas de vencimento no WhatsApp.',
    'Integrações & Contabilidade',
    NULL,
    'Receipt',
    20,
    true,
    true,
    true
  )
ON CONFLICT (modulo_chave) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  categoria = EXCLUDED.categoria;
