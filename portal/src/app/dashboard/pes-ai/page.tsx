'use client'

import SistemaGestaoTemplate, { SistemaConfigProps } from '@/components/SistemaGestaoTemplate'
import { Scale } from 'lucide-react'

const pesAiConfig: SistemaConfigProps = {
  id: 'pes-ai',
  nome: 'Pes.Ai',
  codigoDb: 'PES_AI',
  termoBuscaSistema: 'pes',
  subtitulo: 'Pesagem Inteligente & Automação com IA',
  badgeText: 'Inteligência Artificial & Pesagem',
  descricao: 'Ecossistema inteligente para automação de pesagem comercial e industrial: integração com balanças (Toledo, Filizola, Urano), leitura de etiquetas EAN-13, visão computacional e auditoria por IA.',
  icon: Scale,
  corTema: 'purple',
  mensalidadePadrao: '99.90',
  features: [
    {
      key: 'feature_reconhecimento_ia',
      label: 'Reconhecimento de Produtos por IA (Visão Computacional)',
      desc: 'Identificação imediata de hortifrúti e padaria na balança sem digitar código',
      defaultValue: true
    },
    {
      key: 'feature_etiquetagem_ean13',
      label: 'Etiquetagem & Leitura EAN-13 / GS1 Databar',
      desc: 'Interpretação e emissão de códigos com peso líquido e preço total',
      defaultValue: true
    },
    {
      key: 'feature_tara_automatica',
      label: 'Tara Automática & Dedução de Embalagem',
      desc: 'Proteção contra perdas e pesagem em conformidade com o IPEM/Inmetro',
      defaultValue: true
    },
    {
      key: 'feature_auditoria_perdas',
      label: 'Auditoria de Quebras & Perdas por IA',
      desc: 'Detecção de divergências entre peso em estoque e checkout',
      defaultValue: true
    },
    {
      key: 'feature_carga_balancas',
      label: 'Carga em Lote para Balanças de Rede (MGV / Carga)',
      desc: 'Exportação síncrona de itens, preços e tabelas nutricionais',
      defaultValue: true
    },
    {
      key: 'feature_telemetria_pesagem',
      label: 'Telemetria & Diagnóstico de Balanças em Tempo Real',
      desc: 'Monitoramento de calibração, estabilidade e comunicação serial/IP',
      defaultValue: true
    }
  ]
}

export default function PesAiPage() {
  return <SistemaGestaoTemplate config={pesAiConfig} />
}
