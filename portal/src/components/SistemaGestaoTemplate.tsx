'use client'

import { useEffect, useState, useMemo } from 'react'
import { 
  Users, CheckCircle2, AlertTriangle, XCircle, Search, 
  RefreshCw, Plus, Copy, Lock, Unlock, Zap, DollarSign, Clock, 
  KeyRound, QrCode, FileText, Check, ShieldAlert, Phone, UserPlus, UserMinus,
  Image as ImageIcon, Cloud, ShoppingCart, Receipt, Sparkles, Package, ExternalLink,
  Laptop, MonitorCheck, UtensilsCrossed, Scale
} from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import toast from 'react-hot-toast'
import { formatarCnpjCpf } from '@/utils/cnpjAlfanumerico'

export interface SistemaFeatureConfig {
  key: string
  label: string
  desc: string
  defaultValue: boolean
}

export interface SistemaConfigProps {
  id: string
  nome: string
  codigoDb: string
  termoBuscaSistema: string
  subtitulo: string
  badgeText: string
  descricao: string
  icon: any
  corTema: 'blue' | 'indigo' | 'emerald' | 'amber' | 'orange' | 'purple' | 'cyan'
  mensalidadePadrao: string
  features: SistemaFeatureConfig[]
}

interface ClienteSistema {
  id: string
  razao_social: string
  nome_fantasia?: string
  cnpj: string
  telefone?: string
  is_ativo: boolean
  dia_vencimento?: number
  valor_mensalidade?: number
  dias_carencia?: number
  hub_token: string
  nome_sistema_utilizado?: string
  configuracoes_hub?: {
    offline_secret?: string
    ultima_sincronizacao?: string
    dias_tolerancia_bloqueio?: number
    mensagem_bloqueio?: string
    banner_url?: string
    support_whatsapp?: string
    [key: string]: any
  }
  fatura_atual?: {
    id: string
    valor: number
    status: string
    data_vencimento: string
    qr_code_payload?: string
    desbloqueio_confianca_em?: string
  }
}

export default function SistemaGestaoTemplate({ config }: { config: SistemaConfigProps }) {
  const IconComponent = config.icon
  const [clientes, setClientes] = useState<ClienteSistema[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'ativos' | 'bloqueados' | 'confianca'>('todos')

  // Modais
  const [modalEditarOpen, setModalEditarOpen] = useState(false)
  const [modalPixOpen, setModalPixOpen] = useState(false)
  const [modalVincularOpen, setModalVincularOpen] = useState(false)
  const [clienteSelecionado, setClienteSelecionado] = useState<ClienteSistema | null>(null)

  // Lista de outros clientes para vinculação rápida
  const [outrosClientes, setOutrosClientes] = useState<{ id: string, razao_social: string, nome_fantasia?: string, cnpj: string, nome_sistema_utilizado?: string }[]>([])
  const [clienteParaVincularId, setClienteParaVincularId] = useState('')
  const [vinculando, setVinculando] = useState(false)

  // Form Edição
  const [editDiaVencimento, setEditDiaVencimento] = useState(10)
  const [editValorMensalidade, setEditValorMensalidade] = useState(config.mensalidadePadrao)
  const [editDiasCarencia, setEditDiasCarencia] = useState(3)
  const [editOfflineSecret, setEditOfflineSecret] = useState('')
  const [editMensagemBloqueio, setEditMensagemBloqueio] = useState('')
  const [editBannerUrl, setEditBannerUrl] = useState('')
  const [editSupportWhatsapp, setEditSupportWhatsapp] = useState('')
  const [editFeatures, setEditFeatures] = useState<Record<string, boolean>>({})
  const [salvando, setSalvando] = useState(false)
  const [now, setNow] = useState<number>(() => Date.now())

  // Ticker de 1 segundo para atualizar os cronômetros regressivos em tempo real
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const supabase = createClient()

  async function carregarDados() {
    setLoading(true)
    try {
      // 1. Busca os clientes cadastrados que utilizam este sistema específico
      const { data: clientesData, error: cliErr } = await supabase
        .from('clientes')
        .select(`
          id, razao_social, nome_fantasia, cnpj, telefone, is_ativo, 
          dia_vencimento, valor_mensalidade, dias_carencia, hub_token, 
          nome_sistema_utilizado,
          configuracoes_hub (
            offline_secret, ultima_sincronizacao, dias_tolerancia_bloqueio, mensagem_bloqueio, banner_url, support_whatsapp,
            feature_sugestao_tributaria, feature_nuvem_produtos, feature_loja_virtual, feature_nfce, feature_nfe, feature_contas_pagar, feature_estoque_avancado
          )
        `)
        .ilike('nome_sistema_utilizado', `%${config.termoBuscaSistema}%`)
        .order('created_at', { ascending: false })

      if (cliErr) throw cliErr

      // 1.1 Busca lista de outros clientes para possibilitar vinculação rápida
      const { data: outrosData } = await supabase
        .from('clientes')
        .select('id, razao_social, nome_fantasia, cnpj, nome_sistema_utilizado')
        .or(`nome_sistema_utilizado.is.null,nome_sistema_utilizado.not.ilike.%${config.termoBuscaSistema}%`)
        .order('razao_social', { ascending: true })

      if (outrosData) setOutrosClientes(outrosData)

      // 2. Busca faturas mais recentes
      const { data: faturasData } = await supabase
        .from('faturas')
        .select('id, cliente_id, valor, status, data_vencimento, qr_code_payload, desbloqueio_confianca_em')
        .order('data_vencimento', { ascending: false })

      const lista: ClienteSistema[] = (clientesData || []).map((c: any) => {
        const hubConfig = Array.isArray(c.configuracoes_hub) ? c.configuracoes_hub[0] : c.configuracoes_hub
        const faturasDoCliente = (faturasData || []).filter(f => f.cliente_id === c.id)
        
        const faturaPendente = faturasDoCliente.find(f => f.status === 'pendente')
        const faturaRecente = faturaPendente || faturasDoCliente[0]

        return {
          ...c,
          configuracoes_hub: hubConfig || {},
          fatura_atual: faturaRecente || undefined
        }
      })

      setClientes(lista)
    } catch (err: any) {
      console.error(`Erro ao carregar clientes do sistema ${config.nome}:`, err)
      toast.error(`Erro ao carregar dados: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [config.termoBuscaSistema])

  // Métricas calculadas
  const metricas = useMemo(() => {
    const total = clientes.length
    const hoje = new Date().toISOString().split('T')[0]

    let ativos = 0
    let bloqueados = 0
    let emConfianca = 0
    let mrr = 0

    clientes.forEach(c => {
      const isConfianca = Boolean(
        c.fatura_atual?.desbloqueio_confianca_em &&
        (new Date().getTime() - new Date(c.fatura_atual.desbloqueio_confianca_em).getTime()) <= (24 * 60 * 60 * 1000)
      )
      const isInadimplente = c.fatura_atual?.status === 'pendente' && c.fatura_atual.data_vencimento < hoje && !isConfianca
      const isBloqueado = !c.is_ativo || isInadimplente

      if (isConfianca) emConfianca++
      if (isBloqueado) bloqueados++
      else ativos++

      if (c.is_ativo) {
        mrr += Number(c.valor_mensalidade || parseFloat(config.mensalidadePadrao) || 0)
      }
    })

    return { total, ativos, bloqueados, emConfianca, mrr }
  }, [clientes, config.mensalidadePadrao])

  // Filtro de Busca e Status
  const clientesFiltrados = useMemo(() => {
    const hoje = new Date().toISOString().split('T')[0]
    return clientes.filter(c => {
      const termo = searchTerm.toLowerCase().trim()
      const matchBusca = !termo ||
        c.razao_social.toLowerCase().includes(termo) ||
        (c.nome_fantasia && c.nome_fantasia.toLowerCase().includes(termo)) ||
        (c.cnpj && c.cnpj.toLowerCase().includes(termo)) ||
        c.hub_token.toLowerCase().includes(termo)

      if (!matchBusca) return false

      const isConfianca = Boolean(
        c.fatura_atual?.desbloqueio_confianca_em &&
        (new Date().getTime() - new Date(c.fatura_atual.desbloqueio_confianca_em).getTime()) <= (24 * 60 * 60 * 1000)
      )
      const isInadimplente = c.fatura_atual?.status === 'pendente' && c.fatura_atual.data_vencimento < hoje && !isConfianca
      const isBloqueado = !c.is_ativo || isInadimplente

      if (filtroStatus === 'ativos') return !isBloqueado
      if (filtroStatus === 'bloqueados') return isBloqueado
      if (filtroStatus === 'confianca') return isConfianca

      return true
    })
  }, [clientes, searchTerm, filtroStatus])

  // Ações de Bloqueio / Desbloqueio Manual
  const alternarBloqueio = async (cliente: ClienteSistema) => {
    const novoStatus = !cliente.is_ativo
    const acaoNome = novoStatus ? 'desbloquear' : 'bloquear'

    if (!confirm(`Deseja realmente ${acaoNome} o acesso do cliente ${cliente.razao_social}?`)) return

    try {
      const { error } = await supabase
        .from('clientes')
        .update({ is_ativo: novoStatus })
        .eq('id', cliente.id)

      if (error) throw error

      toast.success(`Cliente ${novoStatus ? 'desbloqueado' : 'bloqueado'} com sucesso!`)
      carregarDados()
    } catch (err: any) {
      toast.error('Erro ao atualizar bloqueio: ' + err.message)
    }
  }

  // Conceder Desbloqueio em Confiança
  const concederDesbloqueioConfianca = async (cliente: ClienteSistema) => {
    if (!cliente.fatura_atual?.id) {
      toast.error('O cliente não possui fatura pendente para liberar em confiança.')
      return
    }

    try {
      const res = await fetch('/api/faturas/desbloqueio-confianca', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fatura_id: cliente.fatura_atual.id })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao conceder desbloqueio')

      toast.success(data.mensagem || 'Desbloqueio em confiança concedido por 24h!')
      carregarDados()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao liberar em confiança')
    }
  }

  // Abrir Modal de Edição
  const abrirEdicao = (cliente: ClienteSistema) => {
    setClienteSelecionado(cliente)
    setEditDiaVencimento(cliente.dia_vencimento || 10)
    setEditValorMensalidade(Number(cliente.valor_mensalidade || config.mensalidadePadrao).toFixed(2))
    setEditDiasCarencia(cliente.dias_carencia ?? 3)
    setEditOfflineSecret(cliente.configuracoes_hub?.offline_secret || '123456')
    setEditMensagemBloqueio(cliente.configuracoes_hub?.mensagem_bloqueio || `SISTEMA ${config.nome.toUpperCase()} BLOQUEADO. Por favor, regularize sua mensalidade.`)
    setEditBannerUrl(cliente.configuracoes_hub?.banner_url || '')
    setEditSupportWhatsapp(cliente.configuracoes_hub?.support_whatsapp || '')
    
    // Inicializa features
    const feats: Record<string, boolean> = {}
    config.features.forEach(f => {
      const val = cliente.configuracoes_hub?.[f.key]
      feats[f.key] = val !== undefined ? Boolean(val) : f.defaultValue
    })
    setEditFeatures(feats)

    setModalEditarOpen(true)
  }

  // Salvar Edição
  const salvarEdicao = async () => {
    if (!clienteSelecionado) return
    setSalvando(true)

    try {
      // 1. Atualiza dados no cliente
      const { error: errCli } = await supabase
        .from('clientes')
        .update({
          dia_vencimento: editDiaVencimento,
          valor_mensalidade: parseFloat(editValorMensalidade.replace(',', '.')),
          dias_carencia: editDiasCarencia,
          nome_sistema_utilizado: config.codigoDb
        })
        .eq('id', clienteSelecionado.id)

      if (errCli) throw errCli

      // 2. Atualiza configurações do Hub
      const upsertPayload: Record<string, any> = {
        cliente_id: clienteSelecionado.id,
        offline_secret: editOfflineSecret.trim(),
        mensagem_bloqueio: editMensagemBloqueio.trim(),
        banner_url: editBannerUrl.trim(),
        support_whatsapp: editSupportWhatsapp.trim(),
        dias_tolerancia_bloqueio: editDiasCarencia,
        dia_vencimento: editDiaVencimento,
        valor_mensalidade: parseFloat(editValorMensalidade.replace(',', '.'))
      }

      // Adiciona toggles de features
      Object.entries(editFeatures).forEach(([k, v]) => {
        upsertPayload[k] = v
      })

      const { error: errHub } = await supabase
        .from('configuracoes_hub')
        .upsert(upsertPayload, { onConflict: 'cliente_id' })

      if (errHub) throw errHub

      toast.success('Parâmetros da licença atualizados com sucesso!')
      setModalEditarOpen(false)
      carregarDados()
    } catch (err: any) {
      toast.error('Erro ao salvar parâmetros: ' + err.message)
    } finally {
      setSalvando(false)
    }
  }

  // Vincular Cliente ao Sistema
  const vincularCliente = async (id: string) => {
    if (!id) return
    setVinculando(true)
    try {
      const { error } = await supabase
        .from('clientes')
        .update({ 
          nome_sistema_utilizado: config.codigoDb,
          valor_mensalidade: parseFloat(config.mensalidadePadrao)
        })
        .eq('id', id)

      if (error) throw error

      toast.success(`Cliente ativado no ${config.nome} com sucesso!`)
      setModalVincularOpen(false)
      setClienteParaVincularId('')
      carregarDados()
    } catch (err: any) {
      toast.error('Erro ao vincular cliente: ' + err.message)
    } finally {
      setVinculando(false)
    }
  }

  // Desvincular Cliente
  const desvincularCliente = async (cliente: ClienteSistema) => {
    if (!confirm(`Deseja desativar o aplicativo ${config.nome} para "${cliente.nome_fantasia || cliente.razao_social}"?\nO cliente deixará de ser listado nesta aba.`)) return
    try {
      const { error } = await supabase
        .from('clientes')
        .update({ nome_sistema_utilizado: 'PDV+' })
        .eq('id', cliente.id)

      if (error) throw error

      toast.success(`Cliente desvinculado de ${config.nome}.`)
      carregarDados()
    } catch (err: any) {
      toast.error('Erro ao desvincular: ' + err.message)
    }
  }

  // Copiar para Área de Transferência
  const copiarTexto = (texto: string, label: string) => {
    navigator.clipboard.writeText(texto)
    toast.success(`${label} copiado!`)
  }

  // Intervalo e Tolerância do Heartbeat (15 minutos + 2 min carência)
  const INTERVALO_HEARTBEAT_MS = 15 * 60 * 1000
  const TOLERANCIA_HEARTBEAT_MS = 2 * 60 * 1000

  const formatarHeartbeat = (dataIso?: string) => {
    if (!dataIso) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          Nunca conectou
        </span>
      )
    }

    const syncTime = new Date(dataIso).getTime()
    const diff = now - syncTime

    if (diff <= INTERVALO_HEARTBEAT_MS) {
      const restanteMs = Math.max(0, INTERVALO_HEARTBEAT_MS - diff)
      const minutos = Math.floor(restanteMs / 60000)
      const segundos = Math.floor((restanteMs % 60000) / 1000)
      const tempoFormatado = `${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`

      return (
        <div className="flex flex-col gap-0.5">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 w-fit">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Online
          </span>
          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Clock className="w-3 h-3 text-slate-400" />
            Próximo sinal: <strong className="text-emerald-600 dark:text-emerald-400">{tempoFormatado}</strong>
          </span>
        </div>
      )
    }

    if (diff <= (INTERVALO_HEARTBEAT_MS + TOLERANCIA_HEARTBEAT_MS)) {
      const atrasoSegundos = Math.floor((diff - INTERVALO_HEARTBEAT_MS) / 1000)
      return (
        <div className="flex flex-col gap-0.5">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800 w-fit">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
            Aguardando Sinal
          </span>
          <span className="text-[10px] text-amber-700 dark:text-amber-400">
            Tolerância (+{atrasoSegundos}s)
          </span>
        </div>
      )
    }

    const diffMinutos = Math.floor(diff / 60000)
    const textoDecorrido = diffMinutos < 60 
      ? `${diffMinutos} min` 
      : diffMinutos < 1440 
        ? `${Math.floor(diffMinutos / 60)} h` 
        : `${Math.floor(diffMinutos / 1440)} dias`

    return (
      <div className="flex flex-col gap-0.5">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700 w-fit">
          <span className="w-2 h-2 rounded-full bg-slate-400"></span>
          Offline
        </span>
        <span className="text-[10px] text-slate-400 dark:text-slate-500">
          Último sinal há {textoDecorrido}
        </span>
      </div>
    )
  }

  // Estilos de cor
  const colorMap = {
    blue: {
      headerBg: 'bg-blue-600',
      badgeBg: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
      btnPrimary: 'bg-blue-600 hover:bg-blue-700',
      iconBoxBg: 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400',
      textAccent: 'text-blue-600 dark:text-blue-400',
    },
    indigo: {
      headerBg: 'bg-indigo-600',
      badgeBg: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
      btnPrimary: 'bg-indigo-600 hover:bg-indigo-700',
      iconBoxBg: 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400',
      textAccent: 'text-indigo-600 dark:text-indigo-400',
    },
    emerald: {
      headerBg: 'bg-emerald-600',
      badgeBg: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
      btnPrimary: 'bg-emerald-600 hover:bg-emerald-700',
      iconBoxBg: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400',
      textAccent: 'text-emerald-600 dark:text-emerald-400',
    },
    amber: {
      headerBg: 'bg-amber-600',
      badgeBg: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
      btnPrimary: 'bg-amber-600 hover:bg-amber-700',
      iconBoxBg: 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400',
      textAccent: 'text-amber-600 dark:text-amber-400',
    },
    orange: {
      headerBg: 'bg-orange-600',
      badgeBg: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
      btnPrimary: 'bg-orange-600 hover:bg-orange-700',
      iconBoxBg: 'bg-orange-50 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400',
      textAccent: 'text-orange-600 dark:text-orange-400',
    },
    purple: {
      headerBg: 'bg-purple-600',
      badgeBg: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
      btnPrimary: 'bg-purple-600 hover:bg-purple-700',
      iconBoxBg: 'bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400',
      textAccent: 'text-purple-600 dark:text-purple-400',
    },
    cyan: {
      headerBg: 'bg-cyan-600',
      badgeBg: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
      btnPrimary: 'bg-cyan-600 hover:bg-cyan-700',
      iconBoxBg: 'bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400',
      textAccent: 'text-cyan-600 dark:text-cyan-400',
    }
  }

  const tema = colorMap[config.corTema] || colorMap.blue

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* 1. CABEÇALHO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className={`p-3 ${tema.headerBg} text-white rounded-xl shadow-md`}>
            <IconComponent className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              {config.nome} • Gestão de Assinaturas & Licenças
              <span className={`px-2 py-0.5 text-[11px] font-semibold ${tema.badgeBg} rounded-full`}>
                {config.badgeText}
              </span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {config.descricao}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setModalVincularOpen(true)}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl ${tema.btnPrimary} text-white transition shadow-xs cursor-pointer`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Vincular Cliente</span>
          </button>

          <button
            onClick={carregarDados}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {/* 2. CARDS DE MÉTRICAS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs flex items-center gap-3.5">
          <div className={`p-3 ${tema.iconBoxBg} rounded-xl`}>
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-medium text-slate-500">Total de Licenças</span>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">{metricas.total}</h3>
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs flex items-center gap-3.5">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 rounded-xl">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-medium text-slate-500">Em Dia / Ativos</span>
            <h3 className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{metricas.ativos}</h3>
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs flex items-center gap-3.5">
          <div className="p-3 bg-rose-50 dark:bg-rose-950/50 text-rose-600 rounded-xl">
            <XCircle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-medium text-slate-500">Bloqueados</span>
            <h3 className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-0.5">{metricas.bloqueados}</h3>
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs flex items-center gap-3.5">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 rounded-xl">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-medium text-slate-500">MRR (Recorrência)</span>
            <h3 className="text-xl font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
              R$ {metricas.mrr.toFixed(2).replace('.', ',')}
            </h3>
          </div>
        </div>
      </div>

      {/* 3. BARRA DE BUSCA E FILTROS */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por razão social, CNPJ ou token..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setFiltroStatus('todos')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              filtroStatus === 'todos'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            Todos ({metricas.total})
          </button>
          <button
            onClick={() => setFiltroStatus('ativos')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              filtroStatus === 'ativos'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            Ativos ({metricas.ativos})
          </button>
          <button
            onClick={() => setFiltroStatus('bloqueados')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              filtroStatus === 'bloqueados'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            Bloqueados ({metricas.bloqueados})
          </button>
          <button
            onClick={() => setFiltroStatus('confianca')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              filtroStatus === 'confianca'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            Confiança ({metricas.emConfianca})
          </button>
        </div>
      </div>

      {/* 4. TABELA DE LICENÇAS */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider">
                <th className="p-3.5">Empresa / Assinante</th>
                <th className="p-3.5">Token de Conexão</th>
                <th className="p-3.5">Status da Licença</th>
                <th className="p-3.5">Última Sincronização</th>
                <th className="p-3.5">Mensalidade</th>
                <th className="p-3.5">Fatura Atual</th>
                <th className="p-3.5">Chave Offline</th>
                <th className="p-3.5 text-right">Ações de Controle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                    Carregando clientes do {config.nome}...
                  </td>
                </tr>
              ) : clientesFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    Nenhum cliente do {config.nome} encontrado com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                clientesFiltrados.map(cliente => {
                  const hoje = new Date().toISOString().split('T')[0]
                  const isConfianca = Boolean(
                    cliente.fatura_atual?.desbloqueio_confianca_em &&
                    (new Date().getTime() - new Date(cliente.fatura_atual.desbloqueio_confianca_em).getTime()) <= (24 * 60 * 60 * 1000)
                  )
                  const isInadimplente = cliente.fatura_atual?.status === 'pendente' && cliente.fatura_atual.data_vencimento < hoje && !isConfianca
                  const isBloqueado = !cliente.is_ativo || isInadimplente

                  return (
                    <tr key={cliente.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                      {/* Empresa */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-white">
                            {cliente.nome_fantasia || cliente.razao_social}
                          </span>
                          {cliente.nome_sistema_utilizado && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                              {cliente.nome_sistema_utilizado}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                          <span>{formatarCnpjCpf(cliente.cnpj) || cliente.cnpj}</span>
                          {cliente.telefone && (
                            <span className="flex items-center gap-1 text-slate-400">
                              • <Phone className="w-3 h-3" /> {cliente.telefone}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Token */}
                      <td className="p-3.5">
                        <button
                          onClick={() => copiarTexto(cliente.hub_token, 'Token')}
                          className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 font-mono text-[11px] text-slate-700 dark:text-slate-300 transition"
                          title="Clique para copiar o token"
                        >
                          <span>{cliente.hub_token.substring(0, 10)}...</span>
                          <Copy className="w-3 h-3 text-slate-400" />
                        </button>
                      </td>

                      {/* Status */}
                      <td className="p-3.5">
                        {isBloqueado ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                            <Lock className="w-3 h-3" />
                            {isInadimplente ? 'Bloqueado (Fatura)' : 'Bloqueado (Admin)'}
                          </span>
                        ) : isConfianca ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-900">
                            <Clock className="w-3 h-3" />
                            Em Confiança (24h)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
                            <CheckCircle2 className="w-3 h-3" />
                            Ativo / Liberado
                          </span>
                        )}
                      </td>

                      {/* Última Sincronização */}
                      <td className="p-3.5">
                        {formatarHeartbeat(cliente.configuracoes_hub?.ultima_sincronizacao)}
                      </td>

                      {/* Mensalidade */}
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900 dark:text-white">
                          R$ {Number(cliente.valor_mensalidade || config.mensalidadePadrao).toFixed(2).replace('.', ',')}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Vence dia {cliente.dia_vencimento || 10}
                        </div>
                      </td>

                      {/* Fatura Atual */}
                      <td className="p-3.5">
                        {cliente.fatura_atual ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                cliente.fatura_atual.status === 'pago' 
                                  ? 'bg-emerald-100 text-emerald-700' 
                                  : cliente.fatura_atual.data_vencimento < hoje 
                                    ? 'bg-rose-100 text-rose-700' 
                                    : 'bg-amber-100 text-amber-700'
                              }`}>
                                {cliente.fatura_atual.status === 'pago' ? 'Paga' : cliente.fatura_atual.data_vencimento < hoje ? 'Vencida' : 'A Vencer'}
                              </span>
                              <span className="text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                                {cliente.fatura_atual.data_vencimento.split('-').reverse().join('/')}
                              </span>
                            </div>

                            {cliente.fatura_atual.qr_code_payload && cliente.fatura_atual.status !== 'pago' && (
                              <button
                                onClick={() => {
                                  setClienteSelecionado(cliente)
                                  setModalPixOpen(true)
                                }}
                                className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-700 font-semibold cursor-pointer"
                              >
                                <QrCode className="w-3 h-3" />
                                <span>Ver PIX</span>
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">Sem faturas</span>
                        )}
                      </td>

                      {/* Chave Offline */}
                      <td className="p-3.5">
                        <button
                          onClick={() => copiarTexto(cliente.configuracoes_hub?.offline_secret || '123456', 'Chave Offline')}
                          className="flex items-center gap-1 font-mono text-[11px] text-slate-600 dark:text-slate-400 hover:text-blue-600"
                          title="Clique para copiar a chave offline"
                        >
                          <KeyRound className="w-3 h-3 text-slate-400" />
                          <span>{cliente.configuracoes_hub?.offline_secret || '123456'}</span>
                        </button>
                      </td>

                      {/* Ações */}
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Botão Bloquear / Desbloquear */}
                          <button
                            onClick={() => alternarBloqueio(cliente)}
                            className={`p-1.5 rounded-lg border transition cursor-pointer ${
                              cliente.is_ativo
                                ? 'border-rose-200 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50'
                                : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50'
                            }`}
                            title={cliente.is_ativo ? 'Bloquear Licença' : 'Desbloquear Licença'}
                          >
                            {cliente.is_ativo ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                          </button>

                          {/* Botão Desbloqueio Confiança */}
                          {isInadimplente && (
                            <button
                              onClick={() => concederDesbloqueioConfianca(cliente)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px] shadow-xs cursor-pointer"
                              title="Liberar temporariamente por 24h"
                            >
                              <Zap className="w-3 h-3" />
                              <span>Confiança</span>
                            </button>
                          )}

                          {/* Botão Editar Parâmetros */}
                          <button
                            onClick={() => abrirEdicao(cliente)}
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                            title="Editar Parâmetros da Licença"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>

                          {/* Botão Desvincular */}
                          <button
                            onClick={() => desvincularCliente(cliente)}
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition cursor-pointer"
                            title={`Desativar ${config.nome} para esta empresa`}
                          >
                            <UserMinus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. MODAL DE EDIÇÃO DE ASSINATURA / LICENÇA */}
      {modalEditarOpen && clienteSelecionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Header Sticky */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 ${tema.badgeBg} rounded-xl`}>
                  <IconComponent className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    Parâmetros da Licença • {config.nome}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {clienteSelecionado.razao_social}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setModalEditarOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                ✕
              </button>
            </div>

            {/* Body Scrollable */}
            <div className="p-5 space-y-6 overflow-y-auto grow text-xs">
              {/* BLOCO 1: COBRANÇA E ACESSO */}
              <div>
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5 text-blue-500" />
                  <span>Cobrança & Tolerâncias da Assinatura</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Dia de Vencimento</label>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={editDiaVencimento}
                      onChange={e => setEditDiaVencimento(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Valor Mensalidade (R$)</label>
                    <input
                      type="text"
                      value={editValorMensalidade}
                      onChange={e => setEditValorMensalidade(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-blue-600 dark:text-blue-400"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Carência após Vencimento</label>
                    <input
                      type="number"
                      min={0}
                      max={30}
                      value={editDiasCarencia}
                      onChange={e => setEditDiasCarencia(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* BLOCO 2: CHAVE OFFLINE & SEGURANÇA */}
              <div>
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                  <span>Chave Mestra Offline de Contingência</span>
                </h4>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={editOfflineSecret}
                    onChange={e => setEditOfflineSecret(e.target.value)}
                    placeholder="Chave secreta para contingência offline"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-xs"
                  />
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Permite ao cliente desbloquear localmente o PDV em casos extremos de falta prolongada de internet.
                  </p>
                </div>
              </div>

              {/* BLOCO 3: MENSAGEM E COMUNICAÇÃO DE BLOQUEIO */}
              <div>
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
                  <span>Mensagem & Banner na Tela de Bloqueio</span>
                </h4>
                <div className="space-y-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Mensagem exibida na tela</label>
                    <textarea
                      rows={2}
                      value={editMensagemBloqueio}
                      onChange={e => setEditMensagemBloqueio(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">URL do Banner</label>
                      <input
                        type="url"
                        placeholder="https://exemplo.com/banner.png"
                        value={editBannerUrl}
                        onChange={e => setEditBannerUrl(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">WhatsApp de Suporte</label>
                      <input
                        type="text"
                        placeholder="Ex: 37920007857"
                        value={editSupportWhatsapp}
                        onChange={e => setEditSupportWhatsapp(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* BLOCO 4: RECURSOS E MÓDULOS ESPECÍFICOS DO SISTEMA */}
              {config.features && config.features.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Recursos Habilitados na Licença ({config.nome})</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {config.features.map(feat => (
                      <label key={feat.key} className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                        <input
                          type="checkbox"
                          checked={Boolean(editFeatures[feat.key])}
                          onChange={e => setEditFeatures({ ...editFeatures, [feat.key]: e.target.checked })}
                          className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                        />
                        <div>
                          <p className="font-bold text-slate-800 dark:text-slate-200 leading-tight">{feat.label}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{feat.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Modal */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 shrink-0 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalEditarOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={salvarEdicao}
                disabled={salvando}
                className={`px-4 py-2 text-xs font-semibold rounded-xl ${tema.btnPrimary} text-white transition flex items-center gap-1.5 shadow-xs`}
              >
                {salvando ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>Salvar Parâmetros</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. MODAL DE VINCULAÇÃO RÁPIDA */}
      {modalVincularOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 ${tema.badgeBg} rounded-xl`}>
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    Vincular Empresa ao {config.nome}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Selecione uma empresa já cadastrada no Hub Paratech
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setModalVincularOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Selecione a Empresa
                </label>
                <select
                  value={clienteParaVincularId}
                  onChange={e => setClienteParaVincularId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:border-blue-500"
                >
                  <option value="">Selecione uma empresa...</option>
                  {outrosClientes.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.razao_social} {c.nome_fantasia ? `(${c.nome_fantasia})` : ''} — CNPJ: {c.cnpj} {c.nome_sistema_utilizado ? `[${c.nome_sistema_utilizado}]` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                  Ao vincular, o sistema utilizado será definido para <strong>{config.codigoDb}</strong> e a mensalidade padrão sugerida será de <strong>R$ {parseFloat(config.mensalidadePadrao).toFixed(2).replace('.', ',')}</strong>.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalVincularOpen(false)}
                  className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={!clienteParaVincularId || vinculando}
                  onClick={() => vincularCliente(clienteParaVincularId)}
                  className={`px-4 py-2 text-xs font-semibold rounded-xl ${tema.btnPrimary} text-white transition flex items-center gap-1.5 disabled:opacity-50`}
                >
                  {vinculando ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Confirmar Ativação</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL DE QR CODE PIX */}
      {modalPixOpen && clienteSelecionado?.fatura_atual?.qr_code_payload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-5 text-center animate-in fade-in zoom-in-95 duration-150">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-1">
              PIX Copia e Cola • Mensalidade {config.nome}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              {clienteSelecionado.razao_social}
            </p>

            <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-left font-mono text-[10px] break-all max-h-32 overflow-y-auto mb-4 text-slate-700 dark:text-slate-300">
              {clienteSelecionado.fatura_atual.qr_code_payload}
            </div>

            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => copiarTexto(clienteSelecionado.fatura_atual!.qr_code_payload!, 'Código PIX')}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copiar Código</span>
              </button>
              <button
                type="button"
                onClick={() => setModalPixOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
