'use client'

import SistemaGestaoTemplate, { SistemaConfigProps } from '@/components/SistemaGestaoTemplate'
import { UtensilsCrossed } from 'lucide-react'

const gastroConfig: SistemaConfigProps = {
  id: 'gastro',
  nome: 'Gastro',
  codigoDb: 'GASTRO',
  termoBuscaSistema: 'gastro',
  subtitulo: 'Food Service, Bares, Restaurantes & Delivery',
  badgeText: 'Food Service & Restaurantes',
  descricao: 'Gestão completa para o setor gastronômico: mapa de mesas interativo, comandas mobile/touch, impressão automática em setores de produção (cozinha/bar) e delivery integrado.',
  icon: UtensilsCrossed,
  corTema: 'orange',
  mensalidadePadrao: '149.90',
  features: [
    {
      key: 'feature_comanda_mobile',
      label: 'Comanda Eletrônica & Garçom Mobile',
      desc: 'Lançamento de pedidos diretamente pelo smartphone ou tablet',
      defaultValue: true
    },
    {
      key: 'feature_mapa_mesas',
      label: 'Mapa de Mesas & Balcão em Tempo Real',
      desc: 'Visualização de mesas ocupadas, tempo de permanência e prévia de conta',
      defaultValue: true
    },
    {
      key: 'feature_impressao_cozinha',
      label: 'Impressão por Setores (Cozinha / Bar)',
      desc: 'Roteamento automático de itens para impressoras térmicas ESC/POS',
      defaultValue: true
    },
    {
      key: 'feature_cardapio_digital',
      label: 'Cardápio Digital & QR Code nas Mesas',
      desc: 'Autoatendimento onde o cliente escaneia e visualiza os pratos',
      defaultValue: true
    },
    {
      key: 'feature_modulo_delivery',
      label: 'Módulo de Delivery & Integração WhatsApp',
      desc: 'Gestão de entregadores, rotas e notificações automáticas de status',
      defaultValue: true
    },
    {
      key: 'feature_taxa_servico',
      label: 'Controle de Taxa de Serviço (10%) & Couvert',
      desc: 'Cálculo e divisão automática no fechamento de conta',
      defaultValue: true
    }
  ]
}

export default function GastroPage() {
  return <SistemaGestaoTemplate config={gastroConfig} />
}
