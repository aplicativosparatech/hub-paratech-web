'use client'

import SistemaGestaoTemplate, { SistemaConfigProps } from '@/components/SistemaGestaoTemplate'
import { FileSpreadsheet } from 'lucide-react'

const saneadorTributarioConfig: SistemaConfigProps = {
  id: 'saneador-tributario',
  nome: 'Saneador Tributário',
  codigoDb: 'SANEADOR_TRIBUTARIO',
  termoBuscaSistema: 'saneador',
  subtitulo: 'Auditoria e Higienização Fiscal Local (Firebird, Postgres, SQLite, Excel & SQL)',
  badgeText: 'Auditoria & Saneamento Fiscal',
  descricao: 'Aplicação desktop especializada para saneamento e correção tributária em massa de cadastros de produtos: suporte nativo a bancos Firebird (.fdb/.gdb), PostgreSQL, SQLite, planilhas Excel (.xlsx/.xls), CSV e dumps SQL, com auditoria de NCM, CEST, PIS/COFINS monofásico e Reforma Tributária (IBS/CBS).',
  icon: FileSpreadsheet,
  corTema: 'emerald',
  mensalidadePadrao: '89.90',
  features: [
    {
      key: 'feature_firebird_postgres',
      label: 'Conexão Direta Firebird & PostgreSQL',
      desc: 'Leitura e atualização direta em bancos de dados locais (.fdb, .gdb, porta 3050/5432)',
      defaultValue: true
    },
    {
      key: 'feature_planilhas_dumps',
      label: 'Auditoria de Excel, CSV & Dumps SQL',
      desc: 'Importação rápida de catálogos e planilhas de produtos com mapeamento inteligente de colunas',
      defaultValue: true
    },
    {
      key: 'feature_pis_cofins_monofasico',
      label: 'Identificação de Monofásico (PIS/COFINS)',
      desc: 'Classificação automática de produtos monofásicos conforme tabelas da Receita Federal',
      defaultValue: true
    },
    {
      key: 'feature_reforma_tributaria',
      label: 'Preparação para Reforma Tributária (IBS / CBS)',
      desc: 'Alertas preventivos e adequação de regras para a transição tributária (LC 214/2025)',
      defaultValue: true
    },
    {
      key: 'feature_geracao_scripts_sql',
      label: 'Exportação de Scripts SQL de Atualização',
      desc: 'Geração de comandos UPDATE transacionais com cláusulas WHERE por ID e código de barras',
      defaultValue: true
    },
    {
      key: 'feature_ia_multillm',
      label: 'Auditoria Avançada com IA e Multi-LLM',
      desc: 'Resolução de descrições complexas e sugestão de NCM e CEST através da nuvem do Hub',
      defaultValue: true
    }
  ]
}

export default function SaneadorTributarioPage() {
  return <SistemaGestaoTemplate config={saneadorTributarioConfig} />
}
