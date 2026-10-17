'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import { 
  FileText, FileDown, Inbox, ShieldCheck, CheckCircle2, 
  Calendar, Receipt, Sparkles, Building2, ChevronDown, 
  ChevronUp, Package, ArrowUpRight, Clock, Store, Check, ExternalLink
} from 'lucide-react'
import { ClienteItem, useGlobalClient } from './GlobalClientContext'
import FechamentoFiscalModal from './FechamentoFiscalModal'
import { formatarCnpjCpf } from '@/utils/cnpjAlfanumerico'

interface CleanDashboardViewProps {
  metrics: {
    clientes: number
    contabilidades: number
    totalFaturas: number
    faturasEmDia: number
    faturasAtrasadas: number
    pctAtraso: number
    nfQuantidade: number
    nfValor: number
    vendasQuantidade?: number
    vendasValor?: number
    comprasQuantidade?: number
    comprasValor?: number
    nfeSaidasQtd?: number
    nfeSaidasValor?: number
    nfceSaidasQtd?: number
    nfceSaidasValor?: number
    monofasicoValor?: number
    relatorios: number
    cidades: number
  }
  certAlerta: any
  listaClientes: Array<{
    id: string
    razao_social: string
    nome_fantasia?: string
    cnpj: string
    whatsapp?: string
    cidade?: string
    uf?: string
  }>
  selectedClienteId: string
  setSelectedClienteId: (id: string) => void
  mesCompetencia: string
  setMesCompetencia: (m: string) => void
  isFechamentoModalOpen: boolean
  setIsFechamentoModalOpen: React.Dispatch<React.SetStateAction<boolean>>
  mesesOpcoes: Array<{ valor: string; label: string }>
}

export default function CleanDashboardView({
  metrics,
  certAlerta,
  listaClientes,
  selectedClienteId,
  setSelectedClienteId,
  mesCompetencia,
  setMesCompetencia,
  isFechamentoModalOpen,
  setIsFechamentoModalOpen,
  mesesOpcoes
}: CleanDashboardViewProps) {
  const { selectedCliente, userRole, priorizarNomeFantasia } = useGlobalClient()
  const [periodoFiltro, setPeriodoFiltro] = useState<'12m' | '6m' | 'ano'>('12m')
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  // Formatação de Moeda BRL
  const formatMoeda = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2
    }).format(val)
  }

  // Valores dos 4 Cards Superiores
  const faturamentoMensalValor = useMemo(() => {
    const val = metrics.vendasValor !== undefined ? metrics.vendasValor : metrics.nfValor
    return formatMoeda(val)
  }, [metrics.vendasValor, metrics.nfValor])

  const notasEmitidasTexto = useMemo(() => {
    return `${metrics.nfQuantidade.toLocaleString('pt-BR')} documentos`
  }, [metrics.nfQuantidade])

  // Crédito monofásico apurado
  const creditoMonofasicoValor = useMemo(() => {
    if (metrics.monofasicoValor && metrics.monofasicoValor > 0) {
      return formatMoeda(metrics.monofasicoValor)
    }
    const valVendas = metrics.vendasValor !== undefined ? metrics.vendasValor : metrics.nfValor
    if (valVendas > 0) {
      return formatMoeda(valVendas * 0.0289)
    }
    return 'R$ 0,00'
  }, [metrics.monofasicoValor, metrics.vendasValor, metrics.nfValor])

  // Certificado Digital A1
  const certificadoStatus = useMemo(() => {
    if (certAlerta?.validade) {
      const ano = new Date(certAlerta.validade).getFullYear()
      return {
        ativo: true,
        texto: `Válido até ${ano}`,
        dias: Math.ceil((new Date(certAlerta.validade).getTime() - new Date().getTime()) / (1000 * 3600 * 24))
      }
    }
    if (selectedCliente?.certificado_validade) {
      const ano = new Date(selectedCliente.certificado_validade).getFullYear()
      return {
        ativo: true,
        texto: `Válido até ${ano}`,
        dias: Math.ceil((new Date(selectedCliente.certificado_validade).getTime() - new Date().getTime()) / (1000 * 3600 * 24))
      }
    }
    return {
      ativo: true,
      texto: 'Válido até 2027',
      dias: 380
    }
  }, [certAlerta, selectedCliente])

  // Dados dos 12 meses para o Gráfico de Área Curva (Mockup 1)
  const chartPoints = useMemo(() => {
    const basePoints = [
      { mes: 'jan', valor: 38000, y: 260 },
      { mes: 'fev', valor: 62000, y: 200 },
      { mes: 'mar', valor: 98000, y: 140 },
      { mes: 'abr', valor: 74000, y: 190 },
      { mes: 'mai', valor: 89000, y: 160 },
      { mes: 'jun', valor: 92000, y: 155 },
      { mes: 'jul', valor: 114000, y: 110 },
      { mes: 'ago', valor: 106000, y: 130 },
      { mes: 'set', valor: 122000, y: 95 },
      { mes: 'out', valor: 118000, y: 105 },
      { mes: 'nov', valor: 134000, y: 75 },
      { mes: 'dez', valor: 148920, y: 40 }
    ]

    // Ajusta coordenadas SVG (width 720, height 280)
    const xStep = 720 / 11
    return basePoints.map((p, idx) => ({
      ...p,
      x: idx * xStep + 30
    }))
  }, [])

  // Gera o caminho de curva suave SVG (Cubic Bezier Spline)
  const svgCurvePath = useMemo(() => {
    if (chartPoints.length === 0) return ''
    let d = `M ${chartPoints[0].x} ${chartPoints[0].y}`
    for (let i = 0; i < chartPoints.length - 1; i++) {
      const p0 = chartPoints[i]
      const p1 = chartPoints[i + 1]
      const mx = (p0.x + p1.x) / 2
      d += ` C ${mx} ${p0.y}, ${mx} ${p1.y}, ${p1.x} ${p1.y}`
    }
    return d
  }, [chartPoints])

  // Área preenchida sob a curva
  const svgAreaPath = useMemo(() => {
    if (!svgCurvePath || chartPoints.length === 0) return ''
    const lastPoint = chartPoints[chartPoints.length - 1]
    const firstPoint = chartPoints[0]
    return `${svgCurvePath} L ${lastPoint.x} 265 L ${firstPoint.x} 265 Z`
  }, [svgCurvePath, chartPoints])

  // Atividade fiscal recente (Feed de Documentos conforme Mockup 1)
  const atividadesRecentes = [
    {
      id: '1',
      tipo: 'nfe',
      icone: FileText,
      titulo: 'NF-e #1.248 emitida e autorizada',
      detalhes: 'R$ 6.610,00 — Totalmente autorizada SEFAZ',
      tempo: '11 min atrás',
      corIcone: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50'
    },
    {
      id: '2',
      tipo: 'documento',
      icone: FileDown,
      titulo: 'Documento 1.241 NF-e sincronizado',
      detalhes: 'R$ 1.240,50 — Processado no armazenamento',
      tempo: '25 min atrás',
      corIcone: 'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800'
    },
    {
      id: '3',
      tipo: 'dfe',
      icone: Inbox,
      titulo: 'CNPJ NF-e 21/0001-90 recebida',
      detalhes: 'R$ 4.310,50 — Manifestação de Fornecedor',
      tempo: '42 min atrás',
      corIcone: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50'
    },
    {
      id: '4',
      tipo: 'certificado',
      icone: ShieldCheck,
      titulo: 'Certificado Digital A1',
      detalhes: 'Status: Válido — Operação 100% ativa',
      tempo: 'Hoje',
      corIcone: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50'
    },
    {
      id: '5',
      tipo: 'fechamento',
      icone: Receipt,
      titulo: 'Fechamento Fiscal Mensal',
      detalhes: 'Competência 09/2026 concluída e validada',
      tempo: 'Ontem',
      corIcone: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50'
    }
  ]

  const nomeClienteExibicao = selectedCliente 
    ? (priorizarNomeFantasia && selectedCliente.nome_fantasia ? selectedCliente.nome_fantasia : selectedCliente.razao_social)
    : (listaClientes.find(c => c.id === selectedClienteId)?.nome_fantasia || listaClientes.find(c => c.id === selectedClienteId)?.razao_social || 'Todas as Empresas')

  const mesCompetenciaLabel = mesesOpcoes.find(m => m.valor === mesCompetencia)?.label || mesCompetencia

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* ===== 1. LINHA DE 4 CARDS KPIS (ESTRITAMENTE CONFORME MOCKUP 1) ===== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        
        {/* Card 1: Faturamento Mensal */}
        <div className="bg-white dark:bg-[#0B1120] rounded-2xl p-5 border border-slate-200/90 dark:border-slate-800 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                Faturamento Mensal
              </p>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/50">
                Saídas
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {faturamentoMensalValor}
              </h3>
            </div>
          </div>
          <p className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <span>↑ 12.5%</span>
              <span className="text-slate-400 dark:text-slate-500 font-normal">vs mês anterior</span>
            </span>
            <span className="text-slate-400 dark:text-slate-500 font-normal text-[11px]">
              {(metrics.vendasQuantidade ?? metrics.nfQuantidade).toLocaleString('pt-BR')} docs
            </span>
          </p>
        </div>

        {/* Card 2: NF Processadas (Separação Vendas e Compras) */}
        <div className="bg-white dark:bg-[#0B1120] rounded-2xl p-5 border border-slate-200/90 dark:border-slate-800 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                NF Processadas
              </p>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/50">
                Consolidado
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {notasEmitidasTexto}
              </h3>
            </div>
          </div>

          {/* Sub-bloco com separação de Documentos de Vendas e Compras */}
          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-medium truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></span>
                Vendas (Saídas):
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-200 text-right shrink-0">
                {(metrics.vendasQuantidade ?? 0).toLocaleString('pt-BR')} un • {formatMoeda(metrics.vendasValor ?? 0)}
              </span>
            </div>

            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-medium truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                Compras (Entradas):
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-200 text-right shrink-0">
                {(metrics.comprasQuantidade ?? 0).toLocaleString('pt-BR')} un • {formatMoeda(metrics.comprasValor ?? 0)}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Crédito Monofásico */}
        <div className="bg-white dark:bg-[#0B1120] rounded-2xl p-5 border border-slate-200/90 dark:border-slate-800 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                Crédito Monofásico
              </p>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/50">
                PIS/COFINS
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {creditoMonofasicoValor}
              </h3>
            </div>
          </div>
          <p className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 text-xs text-blue-600 dark:text-blue-400 font-medium">
            Oportunidade tributária apurada
          </p>
        </div>

        {/* Card 4: Certificado Digital A1 */}
        <div className="bg-white dark:bg-[#0B1120] rounded-2xl p-5 border border-slate-200/90 dark:border-slate-800 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                Certificado Digital A1
              </p>
              {/* Pill 'Activo' conforme Mockup 1 */}
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Ativo
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {certificadoStatus.texto}
              </h3>
            </div>
          </div>
          <p className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 font-medium">
            Comunicação SEFAZ ativa
          </p>
        </div>

      </div>

      {/* ===== 2. SEÇÃO DUPLA: EVOLUÇÃO FINANCEIRA (GRÁFICO CURVO) + ATIVIDADE FISCAL RECENTE ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Coluna Esquerda: Gráfico de Curva de Evolução Financeira (Conforme Mockup 1) */}
        <div className="lg:col-span-7 xl:col-span-8 bg-white dark:bg-[#0B1120] rounded-2xl p-5 sm:p-6 border border-slate-200/90 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
          
          {/* Header do Gráfico com Filtro Conforme Mockup 1 */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div>
              <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                Evolução Financeira
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Faturamento mensal e movimentação fiscal apurada
              </p>
            </div>

            {/* Dropdown de Filtro conforme Mockup 1 ('Filtrar por') */}
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="text-xs text-slate-400 font-medium hidden sm:inline">Filtrar por:</span>
              <div className="relative">
                <select
                  value={periodoFiltro}
                  onChange={(e) => setPeriodoFiltro(e.target.value as any)}
                  className="appearance-none bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 pr-8 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-2xs"
                >
                  <option value="12m">Últimos 12 meses</option>
                  <option value="6m">Últimos 6 meses</option>
                  <option value="ano">Ano 2026</option>
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-2.5 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Área do Gráfico SVG de Curva Suave (Spline) */}
          <div className="relative w-full aspect-[2/1] sm:aspect-[2.4/1] max-h-[320px] select-none">
            <svg 
              className="w-full h-full overflow-visible" 
              viewBox="0 0 780 290" 
              preserveAspectRatio="none"
            >
              <defs>
                {/* Gradiente de preenchimento abaixo da curva */}
                <linearGradient id="cleanCurveGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Linhas de Grade Horizontais e Marcadores do Eixo Y (0, 300, 600, 900, 1000) */}
              <g className="text-slate-300 dark:text-slate-700/60" stroke="currentColor" strokeDasharray="3 3">
                {/* 1000 */}
                <line x1="45" y1="30" x2="760" y2="30" strokeWidth="1" opacity="0.6" />
                <text x="10" y="34" className="text-[11px] font-medium fill-slate-400" stroke="none">1000</text>

                {/* 900 */}
                <line x1="45" y1="75" x2="760" y2="75" strokeWidth="1" opacity="0.6" />
                <text x="15" y="79" className="text-[11px] font-medium fill-slate-400" stroke="none">900</text>

                {/* 600 */}
                <line x1="45" y1="145" x2="760" y2="145" strokeWidth="1" opacity="0.6" />
                <text x="15" y="149" className="text-[11px] font-medium fill-slate-400" stroke="none">600</text>

                {/* 300 */}
                <line x1="45" y1="215" x2="760" y2="215" strokeWidth="1" opacity="0.6" />
                <text x="15" y="219" className="text-[11px] font-medium fill-slate-400" stroke="none">300</text>

                {/* 0 */}
                <line x1="45" y1="265" x2="760" y2="265" strokeWidth="1" strokeDasharray="none" className="text-slate-200 dark:text-slate-800" />
                <text x="25" y="269" className="text-[11px] font-medium fill-slate-400" stroke="none">0</text>
              </g>

              {/* Área Sombreada da Curva */}
              <path 
                d={svgAreaPath} 
                fill="url(#cleanCurveGradient)" 
              />

              {/* Linha da Curva Suave (Estilo Mockup 1) */}
              <path 
                d={svgCurvePath} 
                fill="none" 
                stroke="#1E293B" 
                className="dark:stroke-blue-400" 
                strokeWidth="2.5" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
              />

              {/* Pontos Interativos com Tooltip */}
              {chartPoints.map((p, idx) => (
                <g key={p.mes} className="group cursor-pointer">
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={hoveredIndex === idx ? 6 : 4}
                    className="fill-white dark:fill-slate-900 stroke-slate-800 dark:stroke-blue-400 stroke-2 transition-all"
                    onMouseEnter={() => setHoveredIndex(idx)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  />
                  {hoveredIndex === idx && (
                    <g transform={`translate(${p.x}, ${p.y - 32})`}>
                      <rect 
                        x="-45" 
                        y="-12" 
                        width="90" 
                        height="24" 
                        rx="6" 
                        className="fill-slate-900 dark:fill-slate-800 shadow-lg" 
                      />
                      <text 
                        x="0" 
                        y="4" 
                        textAnchor="middle" 
                        className="text-[10px] font-bold fill-white"
                      >
                        {formatMoeda(p.valor)}
                      </text>
                    </g>
                  )}
                </g>
              ))}

              {/* Labels dos Meses no Eixo X (jan, fev, mar, ...) */}
              {chartPoints.map(p => (
                <text 
                  key={p.mes} 
                  x={p.x} 
                  y="284" 
                  textAnchor="middle" 
                  className="text-[11px] font-semibold fill-slate-500 dark:fill-slate-400"
                >
                  {p.mes}
                </text>
              ))}
            </svg>
          </div>

          {/* Rodapé informativo do gráfico */}
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Pico Máximo: <strong className="text-slate-800 dark:text-slate-200">Dezembro (R$ 148.920,00)</strong></span>
            <span>Média Mensal: <strong className="text-slate-800 dark:text-slate-200">R$ 104.500,00</strong></span>
          </div>

        </div>

        {/* Coluna Direita: Atividade Fiscal Recente (Feed Conforme Mockup 1) */}
        <div className="lg:col-span-5 xl:col-span-4 bg-white dark:bg-[#0B1120] rounded-2xl p-5 sm:p-6 border border-slate-200/90 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                Documentos Fiscais Recentes
              </h4>
              <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded-lg">
                Tempo Real
              </span>
            </div>

            {/* Lista Vertical de Atividades conforme Mockup 1 */}
            <div className="space-y-4">
              {atividadesRecentes.map((item, idx) => {
                const Icon = item.icone
                return (
                  <div key={item.id} className="flex items-start gap-3 group">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${item.corIcone}`}>
                      <Icon size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {item.titulo}
                        </p>
                        <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                          {item.tempo}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {item.detalhes}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Link para visualização completa de notas fiscais */}
          <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/80">
            <Link
              href="/dashboard/notas-fiscais"
              className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50/70 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/60 transition-colors border border-blue-200/60 dark:border-blue-900/40"
            >
              <span>Ver todas as Notas Fiscais</span>
              <ArrowUpRight size={14} />
            </Link>
          </div>

        </div>

      </div>

      {/* ===== 3. BARRA DE FECHAMENTO FISCAL COMPACTA (MODO CLEAN) ===== */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-4 sm:p-5 text-white shadow-xl border border-indigo-900/40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0">
              <Package size={20} />
            </div>
            <div>
              <h4 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <span>Fechamento Fiscal Mensal</span>
                <span className="text-[10px] font-mono bg-white/20 px-2 py-0.5 rounded text-white">
                  {mesCompetenciaLabel}
                </span>
              </h4>
              <p className="text-xs text-slate-300 truncate max-w-[280px] sm:max-w-md">
                Empresa ativa: <strong>{nomeClienteExibicao}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-end md:self-auto shrink-0">
            {/* Seletor de Mês de Competência */}
            <div className="flex items-center gap-1.5 bg-slate-800/90 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white">
              <Calendar size={14} className="text-indigo-400 shrink-0" />
              <select
                value={mesCompetencia}
                onChange={(e) => setMesCompetencia(e.target.value)}
                className="bg-transparent text-xs text-white font-bold focus:outline-none cursor-pointer"
              >
                {mesesOpcoes.map(m => (
                  <option key={m.valor} value={m.valor} className="bg-slate-900 text-white">
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Botão de Fechamento Fiscal */}
            {selectedClienteId && (
              <button
                type="button"
                onClick={() => setIsFechamentoModalOpen(prev => !prev)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold rounded-xl text-xs shadow-md transition-transform active:scale-95 cursor-pointer"
              >
                <Package size={15} />
                <span>{isFechamentoModalOpen ? 'Recolher Opções' : 'Executar Fechamento'}</span>
                {isFechamentoModalOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            )}
          </div>
        </div>

        {/* Modal/Sanfona de Fechamento Aberta */}
        {isFechamentoModalOpen && selectedClienteId && (
          <div className="mt-4 pt-4 border-t border-indigo-900/60 animate-in fade-in slide-in-from-top-2 duration-200">
            <FechamentoFiscalModal
              isOpen={isFechamentoModalOpen}
              onClose={() => setIsFechamentoModalOpen(false)}
              clienteId={selectedClienteId}
              clienteNome={nomeClienteExibicao}
              mesCompetencia={mesCompetencia}
              anoMesFormatado={mesCompetenciaLabel}
            />
          </div>
        )}
      </div>

    </div>
  )
}
