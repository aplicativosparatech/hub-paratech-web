'use client'

import SistemaGestaoTemplate, { SistemaConfigProps } from '@/components/SistemaGestaoTemplate'
import { MonitorCheck } from 'lucide-react'

const techSlimConfig: SistemaConfigProps = {
  id: 'tech-slim',
  nome: 'Tech Slim',
  codigoDb: 'TECH_SLIM',
  termoBuscaSistema: 'slim',
  subtitulo: 'PDV Ágil & Frente de Caixa para Varejo',
  badgeText: 'Frente de Caixa Rápida',
  descricao: 'Frente de caixa rápida, emissão de NFC-e (modelo 65), controle de operadores, sangrias/suprimentos, gavetas e TEF multi-bandeiras.',
  icon: MonitorCheck,
  corTema: 'blue',
  mensalidadePadrao: '119.90',
  features: [
    {
      key: 'feature_nfce',
      label: 'Emissão Fiscal NFC-e (Mod 65)',
      desc: 'Transmissão síncrona com contingência offline e QR-Code 2.0',
      defaultValue: true
    },
    {
      key: 'feature_tef',
      label: 'TEF Integrado Multi-Bandeiras',
      desc: 'Transações de cartão de crédito/débito homologadas no checkout',
      defaultValue: true
    },
    {
      key: 'feature_balanca_checkout',
      label: 'Balança de Checkout (Serial/USB)',
      desc: 'Captura automática de peso no ponto de venda',
      defaultValue: true
    },
    {
      key: 'feature_sugestao_tributaria',
      label: 'Sugestão Tributária IA (NCM & CEST)',
      desc: 'Auditoria de cadastros e classificação automática de produtos',
      defaultValue: true
    },
    {
      key: 'feature_nuvem_produtos',
      label: 'Catálogo de Produtos em Nuvem',
      desc: 'Sincronização instantânea com a base de dados do Hub',
      defaultValue: true
    },
    {
      key: 'feature_gaveta_automatica',
      label: 'Controle de Gaveta & Suprimento',
      desc: 'Acionamento automático e relatórios de sangrias por operador',
      defaultValue: true
    }
  ]
}

export default function TechSlimPage() {
  return <SistemaGestaoTemplate config={techSlimConfig} />
}
