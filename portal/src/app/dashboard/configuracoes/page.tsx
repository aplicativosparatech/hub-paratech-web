'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import toast from 'react-hot-toast'
import { 
  RefreshCw, Download, Clock, ArrowUpCircle, CheckCircle2, AlertTriangle,
  ArrowUpRight, ArrowDownLeft, ShieldAlert, Layers, Calendar, DollarSign,
  Phone, SlidersHorizontal, Lock, FolderArchive, Sparkles, Inbox,
  Check, Copy, Key, Search, X, ShieldCheck, Cpu, MessageSquare,
  Building2, Power, RotateCcw, Zap, Laptop, FileText, LayoutGrid, TableProperties
} from 'lucide-react'
import { APP_VERSION } from '@/utils/version'
import { useTableFeatures } from '@/hooks/useTableFeatures'
import { ResizableSortableTh } from '@/components/ui/ResizableSortableTh'
import { ClienteAutocompleteInput } from '@/components/ClienteAutocompleteInput'

const VERSAO_MAIS_RECENTE = '2.8.5'
const INTERVALO_MS = 15 * 60 * 1000
const TOLERANCIA_MS = 2 * 60 * 1000

export default function ConfiguracoesPage() {
  const supabase = createClient()
  const [clientes, setClientes] = useState<any[]>([])
  const [hubs, setHubs] = useState<any[]>([])
  const [selectedCliente, setSelectedCliente] = useState<string>('')
  const [termoBuscaTabela, setTermoBuscaTabela] = useState<string>('')
  const [now, setNow] = useState<number>(() => Date.now())

  // Controle de Abas: 'mapa' (Cards em até 6 colunas), 'configuracao' (Formulário), 'tabela' (Tabela)
  const [abaAtiva, setAbaAtiva] = useState<'mapa' | 'configuracao' | 'tabela'>('mapa')
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'online' | 'aguardando' | 'offline' | 'nao_instalado'>('todos')
  
  // Totais de XMLs por cliente e modelo (NFC-e 65, NF-e 55, Entradas)
  const [totaisXmls, setTotaisXmls] = useState<Record<string, { nfce: number; nfe: number; entradas: number; total: number }>>({})
  
  // Modal de Ações de Energia / Controle Remoto
  const [modalEnergia, setModalEnergia] = useState<{
    open: boolean
    tipo: 'desligar_pc' | 'reiniciar_pc' | 'acordar_pc'
    clienteId: string
    nome: string
    mac?: string
  } | null>(null)
  const [loadingEnergia, setLoadingEnergia] = useState(false)

  // Ticker de 1 segundo para atualizar o cronômetro regressivo de batimento cardíaco (15 min)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loadingComandoId, setLoadingComandoId] = useState<string | null>(null)

  // Formata Uptime (segundos) em texto amigável
  const formatUptime = (seconds?: number | null) => {
    if (!seconds || seconds <= 0) return 'Indisponível'
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (days > 0) return `${days}d ${hours}h ${minutes}m`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  // Filtro de busca textual
  const hubsFiltrados = useMemo(() => {
    if (!termoBuscaTabela.trim()) return hubs
    const t = termoBuscaTabela.toLowerCase().trim()
    return hubs.filter((h: any) => 
      (h.razao_social || '').toLowerCase().includes(t) ||
      (h.nome_fantasia || '').toLowerCase().includes(t) ||
      (h.cnpj || '').toLowerCase().includes(t) ||
      (h.hub_token || '').toLowerCase().includes(t)
    )
  }, [hubs, termoBuscaTabela])

  // Contadores para o resumo do topo do mapa
  const contadoresStatus = useMemo(() => {
    let online = 0
    let aguardando = 0
    let offline = 0
    let naoInstalado = 0

    for (const h of hubs) {
      const config = Array.isArray(h.configuracoes_hub) ? h.configuracoes_hub[0] : h.configuracoes_hub
      const lastSync = config?.ultima_sincronizacao
      if (!lastSync) {
        naoInstalado++
      } else {
        const diff = now - new Date(lastSync).getTime()
        if (diff <= INTERVALO_MS) {
          online++
        } else if (diff <= (INTERVALO_MS + TOLERANCIA_MS)) {
          aguardando++
        } else {
          offline++
        }
      }
    }

    return { online, aguardando, offline, naoInstalado, total: hubs.length }
  }, [hubs, now])

  // Filtragem dos Cards (Busca textual + Filtro de Status)
  const cardsFiltrados = useMemo(() => {
    return hubsFiltrados.filter((h: any) => {
      if (filtroStatus === 'todos') return true
      const config = Array.isArray(h.configuracoes_hub) ? h.configuracoes_hub[0] : h.configuracoes_hub
      const lastSync = config?.ultima_sincronizacao
      if (!lastSync) return filtroStatus === 'nao_instalado'
      const diff = now - new Date(lastSync).getTime()
      if (filtroStatus === 'online') return diff <= INTERVALO_MS
      if (filtroStatus === 'aguardando') return diff > INTERVALO_MS && diff <= (INTERVALO_MS + TOLERANCIA_MS)
      if (filtroStatus === 'offline') return diff > (INTERVALO_MS + TOLERANCIA_MS)
      return true
    })
  }, [hubsFiltrados, filtroStatus, now])

  const {
    sortedData: hubsOrdenados,
    sortKey,
    sortDirection,
    handleSort,
    columnWidths,
    handleResizeColumn
  } = useTableFeatures({
    data: hubsFiltrados,
    tableId: 'tabela_hubs_configuracoes_v2',
    defaultSortKey: 'cliente',
    defaultSortDirection: 'asc',
    initialWidths: {
      cliente: 240,
      token: 130,
      contraSenha: 140,
      ultimaSync: 140,
      status: 160,
      versao: 130,
      acao: 220
    },
    customExtractors: {
      cliente: (h: any) => h.razao_social || h.nome_fantasia || '',
      token: (h: any) => h.hub_token || '',
      contraSenha: (h: any) => {
        const config = Array.isArray(h.configuracoes_hub) ? h.configuracoes_hub[0] : h.configuracoes_hub
        return config?.offline_secret || ''
      },
      ultimaSync: (h: any) => {
        const config = Array.isArray(h.configuracoes_hub) ? h.configuracoes_hub[0] : h.configuracoes_hub
        return config?.ultima_sincronizacao || ''
      },
      status: (h: any) => {
        const config = Array.isArray(h.configuracoes_hub) ? h.configuracoes_hub[0] : h.configuracoes_hub
        const lastSync = config?.ultima_sincronizacao
        if (!lastSync) return 0
        const diff = Date.now() - new Date(lastSync).getTime()
        return diff < (INTERVALO_MS + TOLERANCIA_MS) ? 1 : 0
      },
      versao: (h: any) => {
        const config = Array.isArray(h.configuracoes_hub) ? h.configuracoes_hub[0] : h.configuracoes_hub
        return config?.versao_hub_instalada || ''
      }
    }
  })

  const [formData, setFormData] = useState({
    // Card 1: Monitoramento de Vendas (Saídas) & Ponto de Partida
    pastas_vendas: '',
    data_inicio_monitoramento: '',
    numero_inicial_nfe: 1,
    numero_inicial_nfce: 1,
    numero_inicial_nfse: 1,
    numero_inicial_cte: 1,
    numero_inicial_mdfe: 1,

    // Card 2: Monitoramento de Compras (Entradas) & Ponto de Partida
    pastas_compras: '',
    data_inicio_monitoramento_entradas: '',
    numero_inicial_compras_nfe: 1,

    // Card 3: Executáveis Monitorados & Cobrança
    exes_monitorados: '',
    dia_vencimento: 10,
    valor_mensalidade: 150.00,
    whatsapp_cobranca: '',
    dias_aviso_previo: 7,
    intervalo_aviso_horas: 4,
    dias_tolerancia_bloqueio: 3,
    mensagem_aviso_previo: 'AVISO DE VENCIMENTO: Sua mensalidade vence em breve. Regularize via Pix no Hub para evitar bloqueio.',
    mensagem_bloqueio: 'SISTEMA BLOQUEADO. Por favor, regularize seu pagamento.',
    bloquear_recepcao_xml_se_inadimplente: false,

    // Card 4: Inteligência, Tratamento e Validação de XMLs do Hub
    auto_excluir_divergentes: false,
    apenas_xmls_autorizados: false,
    analise_ia_xmls_ativa: true,
    support_whatsapp: '',
    intervalo_checagem_horas: 6
  })

  const copyToClipboard = (text?: string, label?: string) => {
    if (!text) {
      toast.error('Nenhum dado para copiar.')
      return
    }
    navigator.clipboard.writeText(text)
    toast.success(`${label || 'Dado'} copiado para a área de transferência!`)
  }

  async function loadClientes() {
    try {
      const [clientesRes, totaisRes] = await Promise.all([
        supabase
          .from('clientes')
          .select('id, razao_social, nome_fantasia, cnpj, logo_url, hub_token, whatsapp, whatsapp_cobranca, dia_vencimento, valor_mensalidade, dias_carencia, bloquear_recepcao_xml_se_inadimplente, data_inicio_monitoramento, data_inicio_monitoramento_entradas, numero_inicial_nfe, numero_inicial_nfce, numero_inicial_nfse, numero_inicial_cte, numero_inicial_mdfe, numero_inicial_compras_nfe, configuracoes_hub(ultima_sincronizacao, offline_secret, versao_hub_instalada, comando_remoto, comando_remoto_em, auto_excluir_divergentes, apenas_xmls_autorizados, analise_ia_xmls_ativa, support_whatsapp, intervalo_checagem_horas, uptime_segundos, computador_nome, ip_local, mac_address)')
          .order('razao_social'),
        fetch('/api/hub/totais-xmls').then(r => r.json()).catch(() => ({ totais: {} }))
      ])

      let data: any = clientesRes.data
      if (clientesRes.error && clientesRes.error.message.includes('column')) {
        const fallbackRes: any = await supabase
          .from('clientes')
          .select('id, razao_social, nome_fantasia, cnpj, logo_url, hub_token, whatsapp, whatsapp_cobranca, dia_vencimento, valor_mensalidade, dias_carencia, bloquear_recepcao_xml_se_inadimplente, data_inicio_monitoramento, data_inicio_monitoramento_entradas, numero_inicial_nfe, numero_inicial_nfce, numero_inicial_nfse, numero_inicial_cte, numero_inicial_mdfe, numero_inicial_compras_nfe, configuracoes_hub(ultima_sincronizacao, offline_secret, versao_hub_instalada, comando_remoto, comando_remoto_em, auto_excluir_divergentes, apenas_xmls_autorizados, analise_ia_xmls_ativa, support_whatsapp, intervalo_checagem_horas)')
          .order('razao_social')
        data = fallbackRes.data
      }

      if (data) {
        setClientes(data)
        setHubs(data)
      }
      if (totaisRes && totaisRes.totais) {
        setTotaisXmls(totaisRes.totais)
      }
    } catch (err: any) {
      console.error('Erro ao carregar clientes do Hub:', err)
      toast.error('Erro ao carregar clientes: ' + err.message)
    }
  }

  async function handleDispararComando(clienteId: string, comando: string) {
    setLoadingComandoId(clienteId)
    try {
      const res = await fetch('/api/hub/comando-remoto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cliente_id: clienteId, comando })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar comando')
      
      toast.success(data.message)
      await loadClientes()
    } catch (err: any) {
      toast.error(`Falha: ${err.message}`)
    } finally {
      setLoadingComandoId(null)
    }
  }

  useEffect(() => {
    loadClientes()
    const timer = setInterval(loadClientes, 15000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!selectedCliente) return
    async function loadConfig() {
      setLoading(true)
      const [hubRes, cliRes] = await Promise.all([
        supabase.from('configuracoes_hub').select('*').eq('cliente_id', selectedCliente).maybeSingle(),
        supabase.from('clientes').select('*').eq('id', selectedCliente).maybeSingle()
      ])

      const hub = hubRes.data
      const cli = cliRes.data
      
      setFormData({
        // Vendas
        pastas_vendas: Array.isArray(hub?.pastas_vendas) ? hub.pastas_vendas.map((p: string) => p.replace(/\\\\+/g, '\\')).join('\n') : '',
        data_inicio_monitoramento: cli?.data_inicio_monitoramento ? cli.data_inicio_monitoramento.substring(0, 7) : '',
        numero_inicial_nfe: cli?.numero_inicial_nfe || 1,
        numero_inicial_nfce: cli?.numero_inicial_nfce || 1,
        numero_inicial_nfse: cli?.numero_inicial_nfse || 1,
        numero_inicial_cte: cli?.numero_inicial_cte || 1,
        numero_inicial_mdfe: cli?.numero_inicial_mdfe || 1,

        // Compras
        pastas_compras: Array.isArray(hub?.pastas_compras) ? hub.pastas_compras.map((p: string) => p.replace(/\\\\+/g, '\\')).join('\n') : '',
        data_inicio_monitoramento_entradas: cli?.data_inicio_monitoramento_entradas ? cli.data_inicio_monitoramento_entradas.substring(0, 7) : '',
        numero_inicial_compras_nfe: cli?.numero_inicial_compras_nfe || 1,

        // Executáveis e Cobrança
        exes_monitorados: Array.isArray(hub?.exes_monitorados) ? hub.exes_monitorados.join('\n') : '',
        dia_vencimento: cli?.dia_vencimento ?? hub?.dia_vencimento ?? 10,
        valor_mensalidade: cli?.valor_mensalidade !== undefined ? Number(cli.valor_mensalidade) : (hub?.valor_mensalidade !== undefined ? Number(hub.valor_mensalidade) : 150.00),
        whatsapp_cobranca: cli?.whatsapp_cobranca || '',
        dias_aviso_previo: hub?.dias_aviso_previo ?? 7,
        intervalo_aviso_horas: hub?.intervalo_aviso_horas ?? 4,
        dias_tolerancia_bloqueio: cli?.dias_carencia ?? hub?.dias_tolerancia_bloqueio ?? 3,
        mensagem_aviso_previo: hub?.mensagem_aviso_previo || 'AVISO DE VENCIMENTO: Sua mensalidade vence em breve. Regularize via Pix no Hub para evitar bloqueio.',
        mensagem_bloqueio: hub?.mensagem_bloqueio || 'SISTEMA BLOQUEADO. Por favor, regularize seu pagamento.',
        bloquear_recepcao_xml_se_inadimplente: Boolean(cli?.bloquear_recepcao_xml_se_inadimplente ?? hub?.bloquear_recepcao_xml_se_inadimplente ?? false),

        // Inteligência e Automação
        auto_excluir_divergentes: Boolean(hub?.auto_excluir_divergentes ?? false),
        apenas_xmls_autorizados: Boolean(hub?.apenas_xmls_autorizados ?? false),
        analise_ia_xmls_ativa: Boolean(hub?.analise_ia_xmls_ativa ?? true),
        support_whatsapp: hub?.support_whatsapp || '',
        intervalo_checagem_horas: hub?.intervalo_checagem_horas || 6
      })
      setLoading(false)
    }
    loadConfig()
  }, [selectedCliente])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCliente) return
    setSaving(true)

    const dataInicioVendas = formData.data_inicio_monitoramento ? `${formData.data_inicio_monitoramento}-01` : null
    const dataInicioCompras = formData.data_inicio_monitoramento_entradas ? `${formData.data_inicio_monitoramento_entradas}-01` : null

    const hubPayload = {
      cliente_id: selectedCliente,
      pastas_vendas: formData.pastas_vendas.split('\n').filter(Boolean).map(s => s.trim().replace(/\\\\+/g, '\\')),
      pastas_compras: formData.pastas_compras.split('\n').filter(Boolean).map(s => s.trim().replace(/\\\\+/g, '\\')),
      exes_monitorados: formData.exes_monitorados.split('\n').filter(Boolean).map(s => s.trim()),
      dia_vencimento: formData.dia_vencimento,
      valor_mensalidade: formData.valor_mensalidade,
      dias_aviso_previo: formData.dias_aviso_previo,
      intervalo_aviso_horas: formData.intervalo_aviso_horas,
      dias_tolerancia_bloqueio: formData.dias_tolerancia_bloqueio,
      mensagem_aviso_previo: formData.mensagem_aviso_previo,
      mensagem_bloqueio: formData.mensagem_bloqueio,
      bloquear_recepcao_xml_se_inadimplente: Boolean(formData.bloquear_recepcao_xml_se_inadimplente),
      data_inicio_monitoramento_entradas: dataInicioCompras,
      numero_inicial_compras_nfe: formData.numero_inicial_compras_nfe || 1,
      auto_excluir_divergentes: Boolean(formData.auto_excluir_divergentes),
      apenas_xmls_autorizados: Boolean(formData.apenas_xmls_autorizados),
      analise_ia_xmls_ativa: Boolean(formData.analise_ia_xmls_ativa),
      support_whatsapp: formData.support_whatsapp,
      intervalo_checagem_horas: formData.intervalo_checagem_horas || 6,
      updated_at: new Date().toISOString()
    }

    const cliPayload = {
      dia_vencimento: formData.dia_vencimento,
      valor_mensalidade: formData.valor_mensalidade,
      whatsapp_cobranca: formData.whatsapp_cobranca,
      bloquear_recepcao_xml_se_inadimplente: Boolean(formData.bloquear_recepcao_xml_se_inadimplente),
      data_inicio_monitoramento: dataInicioVendas,
      numero_inicial_nfe: Math.max(1, parseInt(String(formData.numero_inicial_nfe || 1), 10)),
      numero_inicial_nfce: Math.max(1, parseInt(String(formData.numero_inicial_nfce || 1), 10)),
      numero_inicial_nfse: Math.max(1, parseInt(String(formData.numero_inicial_nfse || 1), 10)),
      numero_inicial_cte: Math.max(1, parseInt(String(formData.numero_inicial_cte || 1), 10)),
      numero_inicial_mdfe: Math.max(1, parseInt(String(formData.numero_inicial_mdfe || 1), 10)),
      data_inicio_monitoramento_entradas: dataInicioCompras,
      numero_inicial_compras_nfe: Math.max(1, parseInt(String(formData.numero_inicial_compras_nfe || 1), 10)),
      dias_carencia: formData.dias_tolerancia_bloqueio
    }

    const [hubRes, cliRes] = await Promise.all([
      supabase.from('configuracoes_hub').upsert(hubPayload, { onConflict: 'cliente_id' }),
      supabase.from('clientes').update(cliPayload).eq('id', selectedCliente)
    ])
    
    if (hubRes.error || cliRes.error) {
      toast.error('Erro ao salvar: ' + (hubRes.error?.message || cliRes.error?.message))
    } else {
      toast.success('Regras do Hub, Pontos de Partida e Cobrança salvos com sucesso!')
      await loadClientes()
    }
    setSaving(false)
  }

  const clienteSelecionadoObj = clientes.find(c => c.id === selectedCliente)
  const configSelected = Array.isArray(clienteSelecionadoObj?.configuracoes_hub) 
    ? clienteSelecionadoObj?.configuracoes_hub[0] 
    : clienteSelecionadoObj?.configuracoes_hub
  const lastSyncSelected = configSelected?.ultima_sincronizacao
  const diffMinSelected = lastSyncSelected ? Math.floor((now - new Date(lastSyncSelected).getTime()) / (1000 * 60)) : null
  const isOnlineSelected = diffMinSelected !== null && diffMinSelected <= 15
  const versaoHubSelected = configSelected?.versao_hub_instalada || (lastSyncSelected ? '2.8.0' : null)
  const isAtualizadoSelected = versaoHubSelected === VERSAO_MAIS_RECENTE
  const isPendenteAtualizacaoSelected = configSelected?.comando_remoto === 'atualizar_hub'
  const offlineSecretSelected = configSelected?.offline_secret || 'Não gerada'

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-300">
      {/* Cabeçalho Geral da Página */}
      <header className="mb-2 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-3xl font-bold text-slate-900">Configurações do Hub</h1>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">
              v{APP_VERSION}
            </span>
          </div>
          <p className="text-slate-500 mt-1">
            Gerencie o Mapa de Hubs, regras de monitoramento, controle de energia, XMLs emitidos e bloqueio financeiro.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a 
            href="/HubParatech.zip" 
            download 
            className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-indigo-700 transition flex items-center gap-2 shadow-sm text-xs"
          >
            <Download size={16} />
            Baixar Hub Executável v{APP_VERSION} (.zip)
          </a>
          <button 
            onClick={() => loadClientes()} 
            className="bg-slate-100 text-slate-700 px-4 py-2 rounded-xl font-semibold hover:bg-slate-200 transition flex items-center gap-2 text-xs cursor-pointer"
          >
            <RefreshCw size={15} />
            Atualizar Status
          </button>
        </div>
      </header>

      {/* ABAS DE NAVEGAÇÃO PRINCIPAL */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setAbaAtiva('mapa')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            abaAtiva === 'mapa'
              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <LayoutGrid size={15} />
          Mapa de Hubs (Cards em até 6 Colunas)
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
            abaAtiva === 'mapa' ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-600'
          }`}>
            {hubs.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setAbaAtiva('configuracao')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            abaAtiva === 'configuracao'
              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <SlidersHorizontal size={15} />
          Parâmetros & Configurações da Empresa
          {selectedCliente && (
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setAbaAtiva('tabela')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            abaAtiva === 'tabela'
              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <TableProperties size={15} />
          Tabela Detalhada (Monitoramento em Tempo Real)
        </button>
      </div>

      {/* ======================================================== */}
      {/* ABA 1: MAPA DE HUBS (CARDS EM ATÉ 6 COLUNAS)              */}
      {/* ======================================================== */}
      {abaAtiva === 'mapa' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Barra de Busca e Filtros de Status */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Campo de Busca Rápida */}
            <div className="relative flex-1 max-w-md">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar cliente, nome fantasia, CNPJ ou token..."
                value={termoBuscaTabela}
                onChange={e => setTermoBuscaTabela(e.target.value)}
                className="pl-8 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full"
              />
              {termoBuscaTabela && (
                <button
                  type="button"
                  onClick={() => setTermoBuscaTabela('')}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Filtros Rápidos por Status */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setFiltroStatus('todos')}
                className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                  filtroStatus === 'todos' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Todos ({contadoresStatus.total})
              </button>
              <button
                type="button"
                onClick={() => setFiltroStatus('online')}
                className={`px-2.5 py-1 rounded-lg font-medium transition flex items-center gap-1 cursor-pointer ${
                  filtroStatus === 'online' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Online ({contadoresStatus.online})
              </button>
              <button
                type="button"
                onClick={() => setFiltroStatus('aguardando')}
                className={`px-2.5 py-1 rounded-lg font-medium transition flex items-center gap-1 cursor-pointer ${
                  filtroStatus === 'aguardando' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span> Aguardando ({contadoresStatus.aguardando})
              </button>
              <button
                type="button"
                onClick={() => setFiltroStatus('offline')}
                className={`px-2.5 py-1 rounded-lg font-medium transition flex items-center gap-1 cursor-pointer ${
                  filtroStatus === 'offline' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span> Offline ({contadoresStatus.offline})
              </button>
              <button
                type="button"
                onClick={() => setFiltroStatus('nao_instalado')}
                className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                  filtroStatus === 'nao_instalado' ? 'bg-slate-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                Não instalado ({contadoresStatus.naoInstalado})
              </button>
            </div>
          </div>

          {/* Grid de Cards em até 6 Colunas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3.5">
            {cardsFiltrados.map((hub: any) => {
              const config = Array.isArray(hub.configuracoes_hub) ? hub.configuracoes_hub[0] : hub.configuracoes_hub
              const lastSync = config?.ultima_sincronizacao
              const offlineSecret = config?.offline_secret || 'Não gerada'
              const versaoHub = config?.versao_hub_instalada || (lastSync ? '2.8.0' : null)
              const comandoRemoto = config?.comando_remoto
              const isAtualizado = versaoHub === VERSAO_MAIS_RECENTE
              const isPendenteAtualizacao = comandoRemoto === 'atualizar_hub'
              const uptimeSegundos = config?.uptime_segundos
              const computadorNome = config?.computador_nome
              const macAddress = config?.mac_address
              const totaisDoCliente = totaisXmls[hub.id] || { nfce: 0, nfe: 0, entradas: 0, total: 0 }

              let statusBadge: React.ReactNode
              let isOnline = false
              let mmssPulso = ''

              if (!lastSync) {
                statusBadge = (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500">
                    Não instalado
                  </span>
                )
              } else {
                const diff = now - new Date(lastSync).getTime()
                if (diff <= INTERVALO_MS) {
                  isOnline = true
                  const restanteMs = Math.max(0, INTERVALO_MS - diff)
                  const min = Math.floor(restanteMs / 60000)
                  const sec = Math.floor((restanteMs % 60000) / 1000)
                  mmssPulso = `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
                  statusBadge = (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1 animate-pulse"></span>
                      Online
                    </span>
                  )
                } else if (diff <= (INTERVALO_MS + TOLERANCIA_MS)) {
                  statusBadge = (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1 animate-ping"></span>
                      Aguardando
                    </span>
                  )
                } else {
                  const diffMin = Math.floor(diff / 60000)
                  const decorrido = diffMin < 60 ? `${diffMin}m` : diffMin < 1440 ? `${Math.floor(diffMin / 60)}h` : `${Math.floor(diffMin / 1440)}d`
                  statusBadge = (
                    <div className="flex flex-col">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-rose-50 text-rose-700 w-fit">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1"></span>
                        Offline
                      </span>
                      <span className="text-[9px] text-slate-400 mt-0.5">
                        há {decorrido}
                      </span>
                    </div>
                  )
                }
              }

              let versaoBadge: React.ReactNode
              if (isPendenteAtualizacao) {
                versaoBadge = (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700 animate-pulse border border-blue-200">
                    Atualização enviada ⏳
                  </span>
                )
              } else if (versaoHub) {
                versaoBadge = (
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                    isAtualizado 
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {isAtualizado ? (
                      <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-500" />
                    ) : (
                      <AlertTriangle className="w-3 h-3 mr-1 text-amber-500" />
                    )}
                    v{versaoHub} {isAtualizado ? '(Atual)' : ''}
                  </span>
                )
              } else {
                versaoBadge = (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] text-slate-400 bg-slate-100">
                    Não instalado
                  </span>
                )
              }

              return (
                <div 
                  key={hub.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden group hover:border-indigo-300"
                >
                  <div className="p-3.5 space-y-2.5">
                    {/* Cabeçalho do Card: Logo + Nome Fantasia + CNPJ */}
                    <div className="flex items-start gap-2.5">
                      {hub.logo_url ? (
                        <img
                          src={hub.logo_url}
                          alt={hub.nome_fantasia || hub.razao_social}
                          className="w-9 h-9 rounded-xl object-contain bg-slate-50 border border-slate-200 p-0.5 shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-100 border border-blue-200 text-indigo-600 flex items-center justify-center shrink-0 shadow-xs">
                          <Building2 size={18} />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <h4 
                          className="font-bold text-xs text-slate-800 leading-snug truncate" 
                          title={hub.nome_fantasia ? `${hub.nome_fantasia} (${hub.razao_social})` : hub.razao_social}
                        >
                          {hub.nome_fantasia || hub.razao_social}
                        </h4>
                        {hub.nome_fantasia && hub.razao_social && hub.nome_fantasia !== hub.razao_social && (
                          <p className="text-[10px] text-slate-500 truncate" title={hub.razao_social}>
                            {hub.razao_social}
                          </p>
                        )}
                        <span className="font-mono text-[10px] text-slate-400 block mt-0.5">
                          {hub.cnpj}
                        </span>
                      </div>
                    </div>

                    {/* Informações Técnicas e Status */}
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[11px] pt-1.5 border-t border-slate-100">
                      {/* Token do Hub */}
                      <div>
                        <span className="text-[10px] text-slate-400 flex items-center gap-1 font-medium">
                          <Key size={10} className="text-slate-400" /> Token do Hub
                        </span>
                        <div className="flex items-center gap-1 mt-0.5">
                          <code className="text-[10px] font-mono font-bold bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded border border-slate-200 truncate max-w-[80px]" title={hub.hub_token}>
                            {hub.hub_token ? `${hub.hub_token.substring(0, 8)}...` : 'Sem Token'}
                          </code>
                          {hub.hub_token && (
                            <button
                              type="button"
                              onClick={() => copyToClipboard(hub.hub_token, 'Token do Hub')}
                              className="text-slate-400 hover:text-indigo-600 p-0.5 cursor-pointer"
                              title="Copiar Token"
                            >
                              <Copy size={11} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Status do Hub */}
                      <div>
                        <span className="text-[10px] text-slate-400 font-medium block">
                          Status do Hub
                        </span>
                        <div className="mt-0.5">
                          {statusBadge}
                        </div>
                      </div>

                      {/* Contra-senha Offline */}
                      <div>
                        <span className="text-[10px] text-slate-400 flex items-center gap-1 font-medium">
                          <Lock size={10} className="text-slate-400" /> Contra-senha
                        </span>
                        <div className="flex items-center gap-1 mt-0.5">
                          <code className="text-[10px] font-mono font-bold bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded border border-slate-200 truncate max-w-[80px]" title={offlineSecret}>
                            {offlineSecret !== 'Não gerada' ? `${offlineSecret.substring(0, 8)}...` : 'Não gerada'}
                          </code>
                          {offlineSecret !== 'Não gerada' && (
                            <button
                              type="button"
                              onClick={() => copyToClipboard(offlineSecret, 'Contra-senha')}
                              className="text-slate-400 hover:text-indigo-600 p-0.5 cursor-pointer"
                              title="Copiar Contra-senha"
                            >
                              <Copy size={11} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Versão do Hub */}
                      <div>
                        <span className="text-[10px] text-slate-400 font-medium block">
                          Versão Hub
                        </span>
                        <div className="mt-0.5">
                          {versaoBadge}
                        </div>
                      </div>

                      {/* Última Conexão */}
                      <div className="col-span-2 flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                        <span className="flex items-center gap-1 text-slate-400">
                          <Clock size={10} /> Última conexão:
                        </span>
                        {lastSync ? (
                          <span className="font-semibold text-slate-700">
                            {new Date(lastSync).toLocaleTimeString('pt-BR')} • {new Date(lastSync).toLocaleDateString('pt-BR')}
                          </span>
                        ) : (
                          <span className="italic text-slate-400">Nunca</span>
                        )}
                      </div>

                      {/* Próximo pulso (se Online) */}
                      {isOnline && (
                        <div className="col-span-2 flex items-center justify-between text-[10px] bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-md font-mono">
                          <span>Próximo pulso:</span>
                          <strong className="text-emerald-700">{mmssPulso}</strong>
                        </div>
                      )}
                    </div>

                    {/* UPTIME DO COMPUTADOR (TEMPO LIGADO) */}
                    <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2 text-[10px] flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Cpu size={12} className={isOnline ? 'text-indigo-600 animate-pulse' : 'text-slate-400'} />
                        <span className="font-medium">Tempo ligado:</span>
                      </div>
                      {isOnline ? (
                        <span className="font-bold text-indigo-700" title={computadorNome ? `Máquina: ${computadorNome}` : undefined}>
                          {formatUptime(uptimeSegundos)}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Desligado / Sem sinal</span>
                      )}
                    </div>

                    {/* TOTAL GERAL DOS XMLS POR TIPO DE NOTA */}
                    <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-2 space-y-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-bold text-indigo-950 flex items-center gap-1">
                          <FileText size={11} className="text-indigo-600" /> XMLs Emitidos:
                        </span>
                        <span className="font-bold text-indigo-700 bg-indigo-100/80 px-1.5 py-0.2 rounded-md font-mono">
                          Total: {totaisDoCliente.total.toLocaleString('pt-BR')}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1 text-[9px] text-center font-semibold">
                        <div className="bg-emerald-50 text-emerald-800 border border-emerald-200/60 rounded px-1 py-0.5" title="NFC-e Modelo 65">
                          <span className="block text-[8px] text-emerald-600 font-normal">NFC-e 65</span>
                          {totaisDoCliente.nfce.toLocaleString('pt-BR')}
                        </div>
                        <div className="bg-blue-50 text-blue-800 border border-blue-200/60 rounded px-1 py-0.5" title="NF-e Modelo 55 (Saídas)">
                          <span className="block text-[8px] text-blue-600 font-normal">NF-e 55</span>
                          {totaisDoCliente.nfe.toLocaleString('pt-BR')}
                        </div>
                        <div className="bg-amber-50 text-amber-800 border border-amber-200/60 rounded px-1 py-0.5" title="NF-e Compras / Entradas">
                          <span className="block text-[8px] text-amber-600 font-normal">Entradas</span>
                          {totaisDoCliente.entradas.toLocaleString('pt-BR')}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Rodapé / Ações do Card */}
                  <div className="p-2.5 bg-slate-50/80 border-t border-slate-100 flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Botão Configurar */}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCliente(hub.id)
                          setAbaAtiva('configuracao')
                          setTimeout(() => {
                            document.getElementById('painel-configuracao')?.scrollIntoView({ behavior: 'smooth' })
                          }, 150)
                        }}
                        className="flex-1 py-1 px-2 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300 font-bold text-[10px] transition flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
                        title="Abrir configurações deste cliente"
                      >
                        <SlidersHorizontal size={11} className="text-indigo-600" />
                        Configurar
                      </button>

                      {/* Botão Reconciliar Gaps */}
                      <button
                        type="button"
                        onClick={() => handleDispararComando(hub.id, 'reconciliar_gaps')}
                        disabled={loadingComandoId === hub.id}
                        className="py-1 px-2 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300 font-semibold text-[10px] transition flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
                        title="Reconciliar Gaps de XMLs no PDV"
                      >
                        Reconciliar Gaps
                      </button>

                      {/* Botão Atualizar / Reinstalar */}
                      {lastSync && (
                        <button
                          type="button"
                          onClick={() => handleDispararComando(hub.id, isPendenteAtualizacao ? 'cancelar' : 'atualizar_hub')}
                          disabled={loadingComandoId === hub.id}
                          className={`py-1 px-2 rounded-lg font-bold text-[10px] transition flex items-center justify-center gap-1 cursor-pointer ${
                            isPendenteAtualizacao
                              ? 'bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100'
                              : !isAtualizado
                                ? 'bg-amber-500 text-white hover:bg-amber-600 animate-pulse'
                                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                          }`}
                          title={isPendenteAtualizacao ? 'Cancelar atualização' : !isAtualizado ? `Atualizar v${VERSAO_MAIS_RECENTE}` : 'Reinstalar Hub'}
                        >
                          {isPendenteAtualizacao ? 'Cancelar' : !isAtualizado ? 'Atualizar' : 'Reinstalar'}
                        </button>
                      )}
                    </div>

                    {/* Linha de Controle de Energia do PC */}
                    <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-200/60">
                      <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">
                        Controle do PC:
                      </span>
                      <div className="flex items-center gap-1">
                        {/* Acordar PC (Wake-on-LAN) */}
                        <button
                          type="button"
                          onClick={() => setModalEnergia({
                            open: true,
                            tipo: 'acordar_pc',
                            clienteId: hub.id,
                            nome: hub.nome_fantasia || hub.razao_social,
                            mac: macAddress
                          })}
                          className="p-1 rounded-md bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition cursor-pointer"
                          title="Acordar PC (Wake-on-LAN)"
                        >
                          <Zap size={11} />
                        </button>

                        {/* Reiniciar PC */}
                        <button
                          type="button"
                          onClick={() => setModalEnergia({
                            open: true,
                            tipo: 'reiniciar_pc',
                            clienteId: hub.id,
                            nome: hub.nome_fantasia || hub.razao_social
                          })}
                          className="p-1 rounded-md bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 transition cursor-pointer"
                          title="Reiniciar PC Remotamente"
                        >
                          <RotateCcw size={11} />
                        </button>

                        {/* Desligar PC */}
                        <button
                          type="button"
                          onClick={() => setModalEnergia({
                            open: true,
                            tipo: 'desligar_pc',
                            clienteId: hub.id,
                            nome: hub.nome_fantasia || hub.razao_social
                          })}
                          className="p-1 rounded-md bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition cursor-pointer"
                          title="Desligar PC Remotamente"
                        >
                          <Power size={11} />
                        </button>
                      </div>
                    </div>

                    {comandoRemoto && (
                      <span className="text-[9px] text-amber-600 font-medium text-center truncate" title={`Comando: ${comandoRemoto}`}>
                        Comando ({comandoRemoto}) pendente...
                      </span>
                    )}
                  </div>
                </div>
              )
            })}

            {cardsFiltrados.length === 0 && (
              <div className="col-span-full p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-500">
                Nenhum Hub encontrado para os filtros selecionados.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ABA 2: PARÂMETROS & CONFIGURAÇÕES (FORMULÁRIO)            */}
      {/* ======================================================== */}
      {abaAtiva === 'configuracao' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Seletor de Cliente com Autocomplete */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <ClienteAutocompleteInput
              clientes={clientes}
              selectedId={selectedCliente}
              onSelect={id => {
                setSelectedCliente(id)
                if (id) {
                  setTimeout(() => {
                    document.getElementById('painel-configuracao')?.scrollIntoView({ behavior: 'smooth' })
                  }, 100)
                }
              }}
              label="Selecione a Empresa / Cliente para Configurar o Hub"
              placeholder="Digite a Razão Social, Nome Fantasia ou CNPJ..."
            />
          </div>

          {/* Formulário & Painel do Cliente Selecionado */}
          {selectedCliente ? (
            <div id="painel-configuracao" className="space-y-6 pt-2">
              {/* BANNER DE IDENTIFICAÇÃO, TOKEN DO HUB E COMANDOS REMOTOS */}
              <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 border border-indigo-900/60 rounded-2xl p-6 text-white shadow-xl">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-indigo-900/60">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-xl font-bold text-white tracking-tight">
                        {clienteSelecionadoObj?.razao_social || clienteSelecionadoObj?.nome_fantasia || 'Empresa Selecionada'}
                      </h2>
                      {clienteSelecionadoObj?.nome_fantasia && (
                        <span className="text-xs text-indigo-300 font-medium">({clienteSelecionadoObj.nome_fantasia})</span>
                      )}
                      <span className="text-xs font-mono bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-md border border-indigo-500/30">
                        CNPJ: {clienteSelecionadoObj?.cnpj || 'Não informado'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Estação monitorada em tempo real pelo Hub Desktop. Gerencie tokens, diretórios e atualizações.
                    </p>
                  </div>

                  {/* Status de Conexão e Versão do Hub */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Badge de Status Online / Offline */}
                    <div className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 border ${
                      !lastSyncSelected
                        ? 'bg-slate-800 text-slate-400 border-slate-700'
                        : isOnlineSelected
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                    }`}>
                      <span className={`w-2 h-2 rounded-full ${
                        !lastSyncSelected ? 'bg-slate-500' : isOnlineSelected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
                      }`} />
                      {!lastSyncSelected 
                        ? 'Não instalado' 
                        : isOnlineSelected 
                          ? 'Hub Online' 
                          : `Offline há ${diffMinSelected !== null && diffMinSelected < 60 ? `${diffMinSelected} min` : diffMinSelected !== null && diffMinSelected < 1440 ? `${Math.floor(diffMinSelected / 60)} h` : `${Math.floor((diffMinSelected || 0) / 1440)} dias`}`}
                    </div>

                    {/* Badge de Versão */}
                    {versaoHubSelected && (
                      <div className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border ${
                        isAtualizadoSelected
                          ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
                          : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                      }`}>
                        {isAtualizadoSelected ? <CheckCircle2 size={13} className="text-emerald-400" /> : <AlertTriangle size={13} className="text-amber-400" />}
                        <span>v{versaoHubSelected} {isAtualizadoSelected ? '(Atual)' : '(Desatualizado)'}</span>
                      </div>
                    )}

                    {/* Botão de Disparo / Cancelamento de Atualização Remota */}
                    {lastSyncSelected && (
                      <button
                        type="button"
                        onClick={() => handleDispararComando(selectedCliente, isPendenteAtualizacaoSelected ? 'cancelar' : 'atualizar_hub')}
                        disabled={loadingComandoId === selectedCliente}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer ${
                          isPendenteAtualizacaoSelected
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
                            : 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-emerald-900/20'
                        }`}
                      >
                        <ArrowUpCircle size={14} />
                        {loadingComandoId === selectedCliente ? 'Enviando...' : isPendenteAtualizacaoSelected ? 'Cancelar Atualização' : `Atualizar Hub para v${VERSAO_MAIS_RECENTE}`}
                      </button>
                    )}

                    {/* Botão Reconciliar Gaps no PDV */}
                    <button
                      type="button"
                      onClick={() => handleDispararComando(selectedCliente, 'reconciliar_gaps')}
                      disabled={loadingComandoId === selectedCliente}
                      className="px-3 py-1.5 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 text-indigo-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                      title="Forçar varredura e reconciliação imediata de notas fiscais faltantes no PDV do cliente"
                    >
                      <Sparkles size={14} />
                      {loadingComandoId === selectedCliente ? 'Enviando...' : 'Reconciliar Gaps'}
                    </button>
                  </div>
                </div>

                {/* Sub-painel: Token e Contra-Senha Offline */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                  <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Key size={13} className="text-indigo-400" /> Token de Conexão do Hub
                      </span>
                      <code className="text-xs font-mono font-bold text-indigo-300 block">
                        {clienteSelecionadoObj?.hub_token || 'Sem token gerado'}
                      </code>
                    </div>
                    {clienteSelecionadoObj?.hub_token && (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(clienteSelecionadoObj.hub_token, 'Token do Hub')}
                        className="px-2.5 py-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 text-indigo-200 text-xs font-semibold transition flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        <Copy size={13} />
                        Copiar
                      </button>
                    )}
                  </div>

                  <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Lock size={13} className="text-amber-400" /> Contra-Senha (Desbloqueio Offline)
                      </span>
                      <code className="text-xs font-mono font-bold text-amber-300 block">
                        {offlineSecretSelected}
                      </code>
                    </div>
                    {offlineSecretSelected !== 'Não gerada' && (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(offlineSecretSelected, 'Contra-Senha Offline')}
                        className="px-2.5 py-1.5 rounded-lg bg-amber-600/30 hover:bg-amber-600/50 border border-amber-500/40 text-amber-200 text-xs font-semibold transition flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        <Copy size={13} />
                        Copiar
                      </button>
                    )}
                  </div>
                </div>

                {isPendenteAtualizacaoSelected && (
                  <div className="mt-4 bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 text-xs text-blue-300 flex items-center gap-2">
                    <ArrowUpCircle size={16} className="text-blue-400 animate-spin" />
                    <span>
                      <strong>Comando de Atualização Pendente:</strong> O executável Desktop do cliente fará a auto-atualização silenciosa para a v{VERSAO_MAIS_RECENTE} no próximo pulso de sincronização (a cada 15 min ou ao iniciar).
                    </span>
                  </div>
                )}
              </div>

              {/* FORMULÁRIO COMPLETO DE CONFIGURAÇÃO */}
              <form onSubmit={handleSubmit} className="space-y-6">
                {loading ? (
                  <div className="p-12 text-center text-slate-500 bg-white rounded-2xl border border-slate-200">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-600 mb-2" />
                    Carregando parâmetros do Hub...
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* CARD 1: MONITORAMENTO DE VENDAS (SAÍDAS) & PONTOS DE PARTIDA */}
                      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
                        <div className="flex items-center gap-2 text-indigo-600 font-semibold border-b border-slate-100 pb-3">
                          <ArrowUpRight size={20} />
                          <h3 className="text-slate-800 font-bold">1. Monitoramento de Vendas (Saídas) & Ponto de Partida</h3>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            Pastas de Vendas (Saídas) • 1 por linha
                          </label>
                          <textarea
                            rows={3}
                            value={formData.pastas_vendas}
                            onChange={e => setFormData({ ...formData, pastas_vendas: e.target.value })}
                            placeholder="C:\Sistema\XML\Vendas&#10;D:\PDV\Emitidas"
                            className="w-full text-xs font-mono p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                          <p className="text-[11px] text-slate-400 mt-1">
                            O Hub varre estas pastas e <strong>todas as subpastas</strong> recursivamente.
                          </p>
                        </div>

                        <div className="pt-2 border-t border-slate-100 space-y-3">
                          <span className="text-xs font-bold text-slate-700 block">
                            Regras de Ponto de Partida Fiscal (Auditoria Inicial de Vendas)
                          </span>

                          <div>
                            <label className="block text-[11px] text-slate-600 mb-1">
                              Mês/Ano Inicial para Leitura de Vendas
                            </label>
                            <input
                              type="month"
                              value={formData.data_inicio_monitoramento}
                              onChange={e => setFormData({ ...formData, data_inicio_monitoramento: e.target.value })}
                              className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              Notas emitidas antes deste mês não serão enviadas ou geradas como gaps.
                            </p>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] text-slate-600 mb-1">
                                Número Inicial NF-e (Mod 55)
                              </label>
                              <input
                                type="number"
                                min={1}
                                value={formData.numero_inicial_nfe}
                                onChange={e => setFormData({ ...formData, numero_inicial_nfe: parseInt(e.target.value) || 1 })}
                                className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] text-slate-600 mb-1">
                                Número Inicial NFC-e (Mod 65)
                              </label>
                              <input
                                type="number"
                                min={1}
                                value={formData.numero_inicial_nfce}
                                onChange={e => setFormData({ ...formData, numero_inicial_nfce: parseInt(e.target.value) || 1 })}
                                className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* CARD 2: MONITORAMENTO DE COMPRAS (ENTRADAS) */}
                      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
                        <div className="flex items-center gap-2 text-indigo-600 font-semibold border-b border-slate-100 pb-3">
                          <ArrowDownLeft size={20} />
                          <h3 className="text-slate-800 font-bold">2. Monitoramento de Compras (Entradas) & Ponto de Partida</h3>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            Pastas de Compras (Entradas) • 1 por linha
                          </label>
                          <textarea
                            rows={3}
                            value={formData.pastas_compras}
                            onChange={e => setFormData({ ...formData, pastas_compras: e.target.value })}
                            placeholder="C:\Sistema\XML\Entradas&#10;D:\Compras\XML"
                            className="w-full text-xs font-mono p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                          <p className="text-[11px] text-slate-400 mt-1">
                            O Hub sincroniza automaticamente com a aba de Compras no Portal.
                          </p>
                        </div>

                        <div className="pt-2 border-t border-slate-100 space-y-3">
                          <span className="text-xs font-bold text-slate-700 block">
                            Regras de Ponto de Partida Fiscal (Auditoria Inicial de Compras)
                          </span>

                          <div>
                            <label className="block text-[11px] text-slate-600 mb-1">
                              Mês/Ano Inicial para Leitura de Compras
                            </label>
                            <input
                              type="month"
                              value={formData.data_inicio_monitoramento_entradas}
                              onChange={e => setFormData({ ...formData, data_inicio_monitoramento_entradas: e.target.value })}
                              className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              Notas de compras recebidas antes deste mês não serão sincronizadas.
                            </p>
                          </div>

                          <div>
                            <label className="block text-[11px] text-slate-600 mb-1">
                              Número Inicial Compras NF-e (Mod 55)
                            </label>
                            <input
                              type="number"
                              min={1}
                              value={formData.numero_inicial_compras_nfe}
                              onChange={e => setFormData({ ...formData, numero_inicial_compras_nfe: parseInt(e.target.value) || 1 })}
                              className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                        </div>
                      </div>

                      {/* CARD 3: EXECUTÁVEIS MONITORADOS & COBRANÇA */}
                      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
                        <div className="flex items-center gap-2 text-indigo-600 font-semibold border-b border-slate-100 pb-3">
                          <ShieldAlert size={20} />
                          <h3 className="text-slate-800 font-bold">3. Executáveis Monitorados & Cobrança</h3>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            Executáveis do PDV / Sistema Monitorados • 1 por linha
                          </label>
                          <textarea
                            rows={2}
                            value={formData.exes_monitorados}
                            onChange={e => setFormData({ ...formData, exes_monitorados: e.target.value })}
                            placeholder="techslim.exe&#10;meisimples.exe"
                            className="w-full text-xs font-mono p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Processos que exibirão a tela de bloqueio com Pix caso haja inadimplência.
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] text-slate-600 mb-1">
                              Dia do Vencimento
                            </label>
                            <input
                              type="number"
                              min={1}
                              max={31}
                              value={formData.dia_vencimento}
                              onChange={e => setFormData({ ...formData, dia_vencimento: parseInt(e.target.value) || 10 })}
                              className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] text-slate-600 mb-1">
                              Valor Mensalidade (R$)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={formData.valor_mensalidade}
                              onChange={e => setFormData({ ...formData, valor_mensalidade: parseFloat(e.target.value) || 0 })}
                              className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] text-slate-600 mb-1">
                              Dias Tolerância (Carência)
                            </label>
                            <input
                              type="number"
                              min={0}
                              value={formData.dias_tolerancia_bloqueio}
                              onChange={e => setFormData({ ...formData, dias_tolerancia_bloqueio: parseInt(e.target.value) || 0 })}
                              className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] text-slate-600 mb-1">
                              Dias Aviso Prévio
                            </label>
                            <input
                              type="number"
                              min={1}
                              value={formData.dias_aviso_previo}
                              onChange={e => setFormData({ ...formData, dias_aviso_previo: parseInt(e.target.value) || 7 })}
                              className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="flex items-center gap-2 cursor-pointer pt-2">
                            <input
                              type="checkbox"
                              checked={formData.bloquear_recepcao_xml_se_inadimplente}
                              onChange={e => setFormData({ ...formData, bloquear_recepcao_xml_se_inadimplente: e.target.checked })}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-xs text-slate-700 font-medium">
                              Bloquear recepção de XMLs caso o cliente esteja inadimplente
                            </span>
                          </label>
                        </div>
                      </div>

                      {/* CARD 4: INTELIGÊNCIA, TRATAMENTO E VALIDAÇÃO DE XMLS */}
                      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
                        <div className="flex items-center gap-2 text-indigo-600 font-semibold border-b border-slate-100 pb-3">
                          <Sparkles size={20} />
                          <h3 className="text-slate-800 font-bold">4. Inteligência, Tratamento e Validação de XMLs</h3>
                        </div>

                        <div className="space-y-3">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData.auto_excluir_divergentes}
                              onChange={e => setFormData({ ...formData, auto_excluir_divergentes: e.target.checked })}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-xs text-slate-700">
                              Auto-excluir XMLs com CNPJ divergente da pasta
                            </span>
                          </label>

                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData.apenas_xmls_autorizados}
                              onChange={e => setFormData({ ...formData, apenas_xmls_autorizados: e.target.checked })}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-xs text-slate-700">
                              Aceitar apenas XMLs com cStat 100 (Autorizados)
                            </span>
                          </label>

                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData.analise_ia_xmls_ativa}
                              onChange={e => setFormData({ ...formData, analise_ia_xmls_ativa: e.target.checked })}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-xs text-slate-700">
                              Ativar Análise de Inteligência Fiscal e Auditoria Automática
                            </span>
                          </label>
                        </div>

                        <div className="pt-2 border-t border-slate-100">
                          <label className="block text-[11px] text-slate-600 mb-1">
                            Intervalo de Checagem do Hub (Horas)
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={24}
                            value={formData.intervalo_checagem_horas}
                            onChange={e => setFormData({ ...formData, intervalo_checagem_horas: parseInt(e.target.value) || 6 })}
                            className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* BOTÃO SALVAR CONFIGURAÇÕES */}
                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                      <button
                        type="submit"
                        disabled={saving}
                        className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition flex items-center gap-2 shadow-sm cursor-pointer text-xs"
                      >
                        <Check size={16} />
                        {saving ? 'Salvando Parâmetros...' : 'Salvar Todas as Configurações'}
                      </button>
                    </div>
                  </>
                )}
              </form>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-6 shadow-xs">
              <div className="max-w-md mx-auto space-y-2">
                <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                  <Building2 size={28} />
                </div>
                <h3 className="text-lg font-bold text-slate-800">
                  Nenhuma Empresa Selecionada
                </h3>
                <p className="text-xs text-slate-500">
                  Utilize o campo de busca acima ou clique em uma das empresas abaixo para abrir o formulário completo de parâmetros, certificados, diretórios fiscais e tokens do Hub.
                </p>
              </div>

              {/* Grade de Seleção Rápida de Empresas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-left pt-2">
                {clientes.slice(0, 16).map((c: any) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setSelectedCliente(c.id)
                      setTimeout(() => {
                        document.getElementById('painel-configuracao')?.scrollIntoView({ behavior: 'smooth' })
                      }, 100)
                    }}
                    className="p-3.5 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/40 transition cursor-pointer flex flex-col justify-between gap-2 group bg-white shadow-2xs"
                  >
                    <div>
                      <h4 className="font-bold text-xs text-slate-900 group-hover:text-indigo-600 line-clamp-1">
                        {c.razao_social}
                      </h4>
                      {c.nome_fantasia && (
                        <p className="text-[11px] text-indigo-600 font-semibold line-clamp-1">
                          {c.nome_fantasia}
                        </p>
                      )}
                      <p className="text-[10px] font-mono text-slate-400 mt-1">
                        CNPJ: {c.cnpj || 'Não informado'}
                      </p>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-100">
                      <span>Configurar</span>
                      <span className="text-indigo-600 font-bold group-hover:translate-x-0.5 transition-transform">→</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* ABA 3: TABELA DETALHADA DE HUBS (MONITORAMENTO)           */}
      {/* ======================================================== */}
      {abaAtiva === 'tabela' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in duration-200">
          <div className="px-6 py-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div>
              <h3 className="font-semibold text-lg text-slate-800 flex items-center gap-2">
                <SlidersHorizontal size={18} className="text-indigo-600" />
                Hubs Ativos (Monitoramento em Tempo Real)
              </h3>
              <p className="text-xs text-slate-500">
                Acompanhamento de batimentos, tokens de conexão, versões instaladas e comandos remotos.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              {/* Campo de Busca Rápida na Tabela */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar cliente, CNPJ ou token..."
                  value={termoBuscaTabela}
                  onChange={e => setTermoBuscaTabela(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-60"
                />
                {termoBuscaTabela && (
                  <button
                    type="button"
                    onClick={() => setTermoBuscaTabela('')}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Legenda Visual */}
              <div className="flex flex-wrap items-center gap-2 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 shadow-xs">
                <span className="flex items-center gap-1 font-medium text-emerald-700">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Online
                </span>
                <span className="text-slate-300">•</span>
                <span className="flex items-center gap-1 font-medium text-amber-700">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span> Desatualizado
                </span>
                <span className="text-slate-300">•</span>
                <span className="flex items-center gap-1 font-medium text-rose-700">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span> Offline
                </span>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[850px]">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-600 uppercase text-[11px] tracking-wider">
                  <ResizableSortableTh columnId="cliente" label="Cliente / Empresa" currentSortKey={sortKey} currentSortDirection={sortDirection} onSort={handleSort} width={columnWidths.cliente} onResize={handleResizeColumn} />
                  <ResizableSortableTh columnId="token" label="Token do Hub" currentSortKey={sortKey} currentSortDirection={sortDirection} onSort={handleSort} width={columnWidths.token} onResize={handleResizeColumn} />
                  <ResizableSortableTh columnId="contraSenha" label="Contra-Senha (Offline)" currentSortKey={sortKey} currentSortDirection={sortDirection} onSort={handleSort} width={columnWidths.contraSenha} onResize={handleResizeColumn} />
                  <ResizableSortableTh columnId="ultimaSync" label="Última Conexão" currentSortKey={sortKey} currentSortDirection={sortDirection} onSort={handleSort} width={columnWidths.ultimaSync} onResize={handleResizeColumn} />
                  <ResizableSortableTh columnId="status" label="Status do Hub" currentSortKey={sortKey} currentSortDirection={sortDirection} onSort={handleSort} width={columnWidths.status} onResize={handleResizeColumn} />
                  <ResizableSortableTh columnId="versao" label="Versão Hub" currentSortKey={sortKey} currentSortDirection={sortDirection} onSort={handleSort} width={columnWidths.versao} onResize={handleResizeColumn} />
                  <th className="py-3 px-4 font-semibold text-center text-[11px]" style={{ width: columnWidths.acao }}>Ações & Comandos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {hubsOrdenados.map((hub: any) => {
                  const config = Array.isArray(hub.configuracoes_hub) ? hub.configuracoes_hub[0] : hub.configuracoes_hub
                  const lastSync = config?.ultima_sincronizacao
                  const offlineSecret = config?.offline_secret || 'Não gerada'
                  const versaoHub = config?.versao_hub_instalada || (lastSync ? '2.8.0' : null)
                  const comandoRemoto = config?.comando_remoto
                  const isAtualizado = versaoHub === VERSAO_MAIS_RECENTE
                  const isPendenteAtualizacao = comandoRemoto === 'atualizar_hub'

                  let statusElement: React.ReactNode

                  if (!lastSync) {
                    statusElement = (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                        Não instalado
                      </span>
                    )
                  } else {
                    const diff = now - new Date(lastSync).getTime()
                    if (diff <= INTERVALO_MS) {
                      const restanteMs = Math.max(0, INTERVALO_MS - diff)
                      const min = Math.floor(restanteMs / 60000)
                      const sec = Math.floor((restanteMs % 60000) / 1000)
                      const mmss = `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
                      statusElement = (
                        <div className="flex flex-col gap-0.5">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700 w-fit">
                            <span className="w-2 h-2 rounded-full bg-green-500 mr-1.5 animate-pulse"></span>
                            Online
                          </span>
                          <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            Próximo pulso: <strong className="text-emerald-600">{mmss}</strong>
                          </span>
                        </div>
                      )
                    } else if (diff <= (INTERVALO_MS + TOLERANCIA_MS)) {
                      const atrasoSec = Math.floor((diff - INTERVALO_MS) / 1000)
                      statusElement = (
                        <div className="flex flex-col gap-0.5">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 w-fit">
                            <span className="w-2 h-2 rounded-full bg-amber-500 mr-1.5 animate-ping"></span>
                            Aguardando Sinal
                          </span>
                          <span className="text-[10px] text-amber-700">
                            Tolerância (+{atrasoSec}s)
                          </span>
                        </div>
                      )
                    } else {
                      const diffMin = Math.floor(diff / 60000)
                      const decorrido = diffMin < 60 ? `${diffMin} min` : diffMin < 1440 ? `${Math.floor(diffMin / 60)} h` : `${Math.floor(diffMin / 1440)} dias`
                      statusElement = (
                        <div className="flex flex-col gap-0.5">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 w-fit">
                            <span className="w-2 h-2 rounded-full bg-rose-500 mr-1.5"></span>
                            Offline
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Último sinal há {decorrido}
                          </span>
                        </div>
                      )
                    }
                  }

                  return (
                    <tr 
                      key={hub.id} 
                      className={`hover:bg-slate-50/80 transition ${selectedCliente === hub.id ? 'bg-indigo-50/50' : ''}`}
                    >
                      {/* Cliente */}
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-800 block text-xs truncate max-w-[220px]" title={hub.razao_social}>
                          {hub.nome_fantasia || hub.razao_social}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono block">
                          {hub.cnpj}
                        </span>
                      </td>

                      {/* Token do Hub */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <code className="text-[11px] font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 max-w-[95px] truncate" title={hub.hub_token}>
                            {hub.hub_token ? `${hub.hub_token.substring(0, 8)}...` : 'Sem Token'}
                          </code>
                          {hub.hub_token && (
                            <button
                              type="button"
                              onClick={() => copyToClipboard(hub.hub_token, 'Token do Hub')}
                              className="p-1 text-slate-400 hover:text-indigo-600 rounded hover:bg-slate-100 transition cursor-pointer"
                              title="Copiar Token do Hub"
                            >
                              <Copy size={13} />
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Contra-Senha Offline */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <code className="text-[11px] font-mono font-bold bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200 max-w-[110px] truncate" title={offlineSecret}>
                            {offlineSecret}
                          </code>
                          {offlineSecret !== 'Não gerada' && (
                            <button
                              type="button"
                              onClick={() => copyToClipboard(offlineSecret, 'Contra-Senha Offline')}
                              className="p-1 text-slate-400 hover:text-indigo-600 rounded hover:bg-slate-100 transition cursor-pointer"
                              title="Copiar Contra-Senha Offline"
                            >
                              <Copy size={13} />
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Última Conexão */}
                      <td className="py-3 px-4 text-slate-600">
                        {lastSync ? (
                          <div>
                            <span className="font-semibold block">{new Date(lastSync).toLocaleTimeString('pt-BR')}</span>
                            <span className="text-[10px] text-slate-400">{new Date(lastSync).toLocaleDateString('pt-BR')}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Nunca</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        {statusElement}
                      </td>

                      {/* Versão Hub */}
                      <td className="py-3 px-4">
                        {isPendenteAtualizacao ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 animate-pulse border border-blue-200 w-fit" title="Atualização solicitada. O Hub aplicará na próxima conexão.">
                              <ArrowUpCircle className="w-3.5 h-3.5 mr-1 text-blue-600" />
                              Atualização enviada ⏳
                            </span>
                          </div>
                        ) : versaoHub ? (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${
                            isAtualizado 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            {isAtualizado ? (
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-500" />
                            ) : (
                              <AlertTriangle className="w-3.5 h-3.5 mr-1 text-amber-500" />
                            )}
                            v{versaoHub} {isAtualizado ? '(Atual)' : '(Desatualizado)'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs text-slate-400 bg-slate-100">
                            Não instalado
                          </span>
                        )}
                      </td>

                      {/* Ações & Comandos */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          {/* Botão Configurar */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCliente(hub.id)
                              setAbaAtiva('configuracao')
                              setTimeout(() => {
                                document.getElementById('painel-configuracao')?.scrollIntoView({ behavior: 'smooth' })
                              }, 100)
                            }}
                            className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 font-bold text-[11px] transition flex items-center gap-1 cursor-pointer"
                            title="Carregar formulário de configuração deste cliente"
                          >
                            <SlidersHorizontal size={12} />
                            Configurar
                          </button>

                          {/* Botão Atualizar Hub */}
                          {lastSync && (
                            <button
                              type="button"
                              onClick={() => handleDispararComando(hub.id, isPendenteAtualizacao ? 'cancelar' : 'atualizar_hub')}
                              disabled={loadingComandoId === hub.id}
                              title={isPendenteAtualizacao ? 'Cancelar ordem de atualização pendente' : `Enviar comando remoto para o Hub atualizar sozinho para a v${VERSAO_MAIS_RECENTE}`}
                              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition flex items-center gap-1 cursor-pointer ${
                                isPendenteAtualizacao
                                  ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                                  : !isAtualizado
                                    ? 'bg-amber-500 text-white hover:bg-amber-600 shadow-sm animate-pulse'
                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                              }`}
                            >
                              <ArrowUpCircle size={12} />
                              {loadingComandoId === hub.id ? '...' : isPendenteAtualizacao ? 'Cancelar' : !isAtualizado ? `Atualizar v${VERSAO_MAIS_RECENTE}` : 'Reinstalar Hub'}
                            </button>
                          )}

                          {/* Botão Reconciliar Gaps */}
                          <button
                            type="button"
                            onClick={() => handleDispararComando(hub.id, 'reconciliar_gaps')}
                            disabled={loadingComandoId === hub.id}
                            className="px-2 py-1 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 font-semibold text-[11px] transition cursor-pointer"
                            title="Enviar comando remoto para forçar varredura e reconciliação de XMLs no PDV"
                          >
                            Reconciliar Gaps
                          </button>
                        </div>

                        {comandoRemoto && (
                          <span className="text-[10px] text-amber-600 font-medium block mt-1">
                            Comando ({comandoRemoto}) pendente...
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}

                {hubsFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500">
                      Nenhum cliente ou Hub encontrado{termoBuscaTabela ? ` para a busca "${termoBuscaTabela}"` : ''}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL DE CONFIRMAÇÃO DE ENERGIA (DESLIGAR / REINICIAR / WOL) */}
      {/* ======================================================== */}
      {modalEnergia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                modalEnergia.tipo === 'desligar_pc' 
                  ? 'bg-rose-100 text-rose-600' 
                  : modalEnergia.tipo === 'reiniciar_pc'
                    ? 'bg-amber-100 text-amber-600'
                    : 'bg-indigo-100 text-indigo-600'
              }`}>
                {modalEnergia.tipo === 'desligar_pc' && <Power size={20} />}
                {modalEnergia.tipo === 'reiniciar_pc' && <RotateCcw size={20} />}
                {modalEnergia.tipo === 'acordar_pc' && <Zap size={20} />}
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">
                  {modalEnergia.tipo === 'desligar_pc' && 'Desligar Computador Remotamente'}
                  {modalEnergia.tipo === 'reiniciar_pc' && 'Reiniciar Computador Remotamente'}
                  {modalEnergia.tipo === 'acordar_pc' && 'Acordar Computador (Wake-on-LAN)'}
                </h3>
                <p className="text-xs text-slate-500 font-medium">{modalEnergia.nome}</p>
              </div>
            </div>

            <div className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              {modalEnergia.tipo === 'desligar_pc' && (
                <p>
                  Você está prestes a enviar uma ordem remota para <strong>DESLIGAR</strong> a estação deste cliente.
                  O Windows exibirá uma notificação e executará o desligamento com contagem regressiva de segurança de 60 segundos.
                </p>
              )}
              {modalEnergia.tipo === 'reiniciar_pc' && (
                <p>
                  Você está prestes a enviar uma ordem remota para <strong>REINICIAR</strong> a estação deste cliente.
                  O computador será reiniciado com aviso prévio em 60 segundos.
                </p>
              )}
              {modalEnergia.tipo === 'acordar_pc' && (
                <div className="space-y-2">
                  <p>
                    O sistema disparará um pacote mágico <strong>Wake-on-LAN (UDP Broadcast)</strong> para o endereço físico (MAC) da placa de rede.
                  </p>
                  {modalEnergia.mac ? (
                    <p className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded border border-indigo-200">
                      MAC Address: {modalEnergia.mac}
                    </p>
                  ) : (
                    <p className="text-amber-700 font-medium">
                      ℹ️ Nenhum MAC Address registrado automaticamente ainda. O comando será enfileirado para execução na rede local pelo Hub ou nó gateway.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalEnergia(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={loadingEnergia}
                onClick={async () => {
                  setLoadingEnergia(true)
                  try {
                    if (modalEnergia.tipo === 'acordar_pc') {
                      const res = await fetch('/api/hub/wake-on-lan', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ cliente_id: modalEnergia.clienteId, mac_address: modalEnergia.mac })
                      })
                      const data = await res.json()
                      if (!res.ok) throw new Error(data.error || 'Erro ao enviar Wake-on-LAN')
                      toast.success(data.message || 'Pacote Wake-on-LAN transmitido!')
                    } else {
                      await handleDispararComando(modalEnergia.clienteId, modalEnergia.tipo)
                    }
                    setModalEnergia(null)
                  } catch (err: any) {
                    toast.error(err.message)
                  } finally {
                    setLoadingEnergia(false)
                  }
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition flex items-center gap-1.5 shadow-sm cursor-pointer ${
                  modalEnergia.tipo === 'desligar_pc'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : modalEnergia.tipo === 'reiniciar_pc'
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {loadingEnergia ? 'Processando...' : 'Confirmar Execução'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
