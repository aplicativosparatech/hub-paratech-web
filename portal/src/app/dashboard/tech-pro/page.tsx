'use client'

import SistemaGestaoTemplate, { SistemaConfigProps } from '@/components/SistemaGestaoTemplate'
import { Zap } from 'lucide-react'

const techProConfig: SistemaConfigProps = {
  id: 'tech-pro',
  nome: 'Tech Pro',
  codigoDb: 'TECH_PRO',
  termoBuscaSistema: 'pro',
  subtitulo: 'ERP Completo & Gestão Fiscal Empresarial',
  badgeText: 'Gestão Empresarial Completa',
  descricao: 'ERP robusto para comércio, distribuidoras e atacado: emissão de NF-e (modelo 55), CT-e, MDF-e, financeiro avançado (DRE/Fluxo) e estoque multi-depósito.',
  icon: Zap,
  corTema: 'amber',
  mensalidadePadrao: '189.90',
  features: [
    {
      key: 'feature_nfe',
      label: 'Emissão de NF-e (Modelo 55)',
      desc: 'Notas fiscais eletrônicas de saída, entrada, devolução e remessa',
      defaultValue: true
    },
    {
      key: 'feature_cte_mdfe',
      label: 'Módulo de Transporte (CT-e & MDF-e)',
      desc: 'Conhecimento de transporte e manifesto de documentos fiscais',
      defaultValue: true
    },
    {
      key: 'feature_financeiro_avancado',
      label: 'Financeiro Completo & DRE Gerencial',
      desc: 'Contas a pagar/receber, conciliação bancária e fluxo de caixa',
      defaultValue: true
    },
    {
      key: 'feature_estoque_avancado',
      label: 'Estoque Multi-Depósito & Grade',
      desc: 'Controle de lotes, datas de validade, grades de tamanho e cor',
      defaultValue: true
    },
    {
      key: 'feature_sugestao_tributaria',
      label: 'Classificador Tributário IA (Reforma LC 214/2025)',
      desc: 'Enquadramento automático de IBS, CBS, ICMS-ST e Monofásicos',
      defaultValue: true
    },
    {
      key: 'feature_comissoes_metas',
      label: 'Comissões de Vendedores & Metas',
      desc: 'Relatórios de produtividade e comissionamento flexível',
      defaultValue: true
    }
  ]
}

export default function TechProPage() {
  return <SistemaGestaoTemplate config={techProConfig} />
}
