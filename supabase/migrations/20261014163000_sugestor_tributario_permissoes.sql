-- Migration: Inclusão do módulo Sugestor Tributário & OCR nas permissões
INSERT INTO permissoes_modulos (modulo_chave, nome, descricao, categoria, rota, icone, ordem, permitido_cliente, permitido_contabilidade, permitido_admin)
VALUES 
  ('sugestor_tributario', 'Sugestor Tributário & OCR Fiscal', 'Acesso à aba de apoio fiscal com sugestão inteligente de NCM, CFOP, CSOSN/CST, PIS/COFINS, IBS/CBS e OCR.', 'Inteligência Tributária & Auditoria', '/dashboard/sugestor-tributario', 'ScanText', 21, true, true, true),
  ('sugestor_consulta_unitario', 'Sugestor: Consulta Unitária por Digitação', 'Permite digitar o nome de um produto individual e buscar o enquadramento tributário completo e automático.', 'Inteligência Tributária & Auditoria', NULL, 'Search', 22, true, true, true),
  ('sugestor_importar_arquivos', 'Sugestor: Importar Planilhas & Arquivos TXT', 'Permite enviar listas de produtos em massa (.xlsx, .xls, .csv, .txt) para classificação tributária em lote.', 'Inteligência Tributária & Auditoria', NULL, 'Database', 23, true, true, true),
  ('sugestor_ocr_foto', 'Sugestor: Leitura de Produtos por Foto (OCR / Visão IA)', 'Permite enviar fotos de etiquetas, gôndolas ou notas para extração automática dos produtos via OCR com IA.', 'Inteligência Tributária & Auditoria', NULL, 'ScanText', 24, true, true, true),
  ('sugestor_exportar_tabela', 'Sugestor: Download da Tabela Totalmente Tributada', 'Permite baixar os resultados da tributação em Excel (.xlsx), CSV, TXT formatado ou JSON para ERPs.', 'Inteligência Tributária & Auditoria', NULL, 'Download', 25, true, true, true)
ON CONFLICT (modulo_chave) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  categoria = EXCLUDED.categoria,
  rota = EXCLUDED.rota,
  icone = EXCLUDED.icone,
  ordem = EXCLUDED.ordem,
  updated_at = NOW();
