-- Adiciona o módulo Corretor Tributário na tabela de permissões
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
) VALUES (
  'corretor_tributario',
  'Corretor Tributário (IBS, CBS & ICMS)',
  'Diagnóstico e sugestão de correção de NCM, CEST, CFOP, CSOSN, PIS, COFINS e enquadramento na Reforma Tributária (IBS e CBS).',
  'Relatórios & Auditoria',
  '/dashboard/corretor-tributario',
  'Sparkles',
  7,
  false,
  true,
  true
) ON CONFLICT (modulo_chave) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  rota = EXCLUDED.rota;
