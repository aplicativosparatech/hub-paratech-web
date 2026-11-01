-- Migration: Registro Oficial de Rotinas de Cron do Hub Paratech

INSERT INTO integracoes (tipo, provedor, is_ativo, credenciais) VALUES 
('cron', 'gerar_faturas', true, '{
    "nome": "Geração Automática de Faturas Mensais",
    "categoria": "Financeiro",
    "endpoint": "/api/cron/gerar-faturas",
    "schedule": "0 6 1 * *",
    "horario_amigavel": "Todo dia 1º do mês às 03:00 (Brasília)",
    "descricao": "Varre todos os clientes ativos com mensalidade cadastrada e gera as faturas da competência que se inicia no banco de dados.",
    "permite_disparo_manual": true
}'::jsonb),
('cron', 'billing_alerts', false, '{
    "nome": "Régua de Cobrança & Alertas de Vencimento",
    "categoria": "WhatsApp",
    "endpoint": "/api/cron/billing-alerts",
    "schedule": "0 9 * * *",
    "horario_amigavel": "Diariamente às 06:00 (Brasília)",
    "descricao": "Dispara notificações automáticas de cobrança via WhatsApp: 3 dias antes do vencimento, no dia do vencimento, tolerância e alertas de bloqueio.",
    "permite_disparo_manual": true
}'::jsonb),
('cron', 'fechamento_mensal', true, '{
    "nome": "Fechamento Fiscal Mensal & Escrituração",
    "categoria": "Fiscal",
    "endpoint": "/api/cron/fechamento-mensal",
    "schedule": "0 8 * * *",
    "horario_amigavel": "Diariamente às 05:00 (Brasília)",
    "descricao": "Gera relatórios de fechamento contábil e apuração de impostos do mês anterior e despacha por e-mail e WhatsApp para clientes e contabilidades.",
    "permite_disparo_manual": true
}'::jsonb),
('cron', 'alterdata_sync', true, '{
    "nome": "Sincronização Nuvem Alterdata (nf-stock)",
    "categoria": "Contábil ERP",
    "endpoint": "/api/cron/alterdata-sync",
    "schedule": "0 2 * * *",
    "horario_amigavel": "Diariamente às 23:00 (Brasília)",
    "descricao": "Exporta e transmite lotes diários de XMLs de NFC-e e NF-e dos clientes diretamente ao ambiente em nuvem da Alterdata para conciliação contábil.",
    "permite_disparo_manual": true
}'::jsonb),
('cron', 'sefaz_distribuicao_dfe', true, '{
    "nome": "Consulta & Distribuição DFe da SEFAZ Nacional",
    "categoria": "SEFAZ",
    "endpoint": "/api/cron/sefaz-distribuicao-dfe",
    "schedule": "0 */6 * * *",
    "horario_amigavel": "A cada 6 horas (00h, 06h, 12h, 18h)",
    "descricao": "Consulta na SEFAZ Nacional novas notas fiscais emitidas por fornecedores contra os CNPJs dos clientes e sincroniza com o painel do Hub.",
    "permite_disparo_manual": true
}'::jsonb),
('cron', 'auditoria_tributaria', true, '{
    "nome": "Auditoria Noturna de Tributação & NCM",
    "categoria": "Tributário",
    "endpoint": "/api/cron/auditoria-tributaria",
    "schedule": "0 4 * * 0",
    "horario_amigavel": "Todo domingo às 01:00 (Brasília)",
    "descricao": "Executa auditoria em massa nos cadastros de produtos identificando NCMs inválidos, CESTs ausentes e regras da Reforma Tributária (LC 214/2025).",
    "permite_disparo_manual": true
}'::jsonb),
('cron', 'cleanup_logs', true, '{
    "nome": "Manutenção & Limpeza de Logs Expirados",
    "categoria": "Sistema",
    "endpoint": "/api/cron/cleanup-logs",
    "schedule": "0 3 1 * *",
    "horario_amigavel": "Todo dia 1º às 00:00 (Brasília)",
    "descricao": "Compacta e descarta registros de logs temporários, auditorias e payloads antigos com mais de 90 dias, mantendo o banco ágil e leve.",
    "permite_disparo_manual": true
}'::jsonb)
ON CONFLICT DO NOTHING;
