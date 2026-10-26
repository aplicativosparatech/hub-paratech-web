'use client'

import { useEffect, useState, useMemo } from 'react'
import { 
  Store, Users, CheckCircle2, AlertTriangle, XCircle, Search, 
  RefreshCw, Plus, Copy, Lock, Unlock, Zap, DollarSign, Clock, 
  KeyRound, QrCode, FileText, Check, ShieldAlert, Phone, UserPlus, UserMinus,
  Image as ImageIcon, Cloud, ShoppingCart, Receipt, Sparkles, Package, ExternalLink, Trash2
} from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import toast from 'react-hot-toast'
import { formatarCnpjCpf } from '@/utils/cnpjAlfanumerico'

interface ClienteMei {
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
    feature_sugestao_tributaria?: boolean
    feature_nuvem_produtos?: boolean
    feature_loja_virtual?: boolean
    feature_nfce?: boolean
    feature_nfe?: boolean
    feature_contas_pagar?: boolean
    feature_estoque_avancado?: boolean
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

export default function MeiSimplesPage() {
  const [clientes, setClientes] = useState<ClienteMei[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'ativos' | 'bloqueados' | 'confianca'>('todos')
  
  // Modais
  const [modalEditarOpen, setModalEditarOpen] = useState(false)
  const [modalPixOpen, setModalPixOpen] = useState(false)
  const [modalVincularOpen, setModalVincularOpen] = useState(false)
  const [clienteSelecionado, setClienteSelecionado] = useState<ClienteMei | null>(null)
  
  // Lista de outros clientes para vinculação rápida
  const [outrosClientes, setOutrosClientes] = useState<{ id: string, razao_social: string, nome_fantasia?: string, cnpj: string, nome_sistema_utilizado?: string }[]>([])
  const [clienteParaVincularId, setClienteParaVincularId] = useState('')
  const [vinculando, setVinculando] = useState(false)
  
  // Form Edição
  const [editDiaVencimento, setEditDiaVencimento] = useState(10)
  const [editValorMensalidade, setEditValorMensalidade] = useState('79.90')
  const [editDiasCarencia, setEditDiasCarencia] = useState(3)
  const [editOfflineSecret, setEditOfflineSecret] = useState('')
  const [editMensagemBloqueio, setEditMensagemBloqueio] = useState('')
  const [editBannerUrl, setEditBannerUrl] = useState('')
  const [editSupportWhatsapp, setEditSupportWhatsapp] = useState('')
  const [editFeatureSugestaoTributaria, setEditFeatureSugestaoTributaria] = useState(true)
  const [editFeatureNuvemProdutos, setEditFeatureNuvemProdutos] = useState(true)
  const [editFeatureLojaVirtual, setEditFeatureLojaVirtual] = useState(false)
  const [editFeatureNfce, setEditFeatureNfce] = useState(true)
  const [editFeatureNfe, setEditFeatureNfe] = useState(true)
  const [editFeatureContasPagar, setEditFeatureContasPagar] = useState(true)
  const [editFeatureEstoqueAvancado, setEditFeatureEstoqueAvancado] = useState(true)
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
      // 1. Busca SOMENTE os clientes cadastrados que utilizam o MEI Simples
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
        .ilike('nome_sistema_utilizado', '%mei%')
        .order('created_at', { ascending: false })

      if (cliErr) throw cliErr

      // 1.1 Busca lista de clientes convencionais para possibilitar vinculação rápida
      const { data: outrosData } = await supabase
        .from('clientes')
        .select('id, razao_social, nome_fantasia, cnpj, nome_sistema_utilizado')
        .or('nome_sistema_utilizado.is.null,nome_sistema_utilizado.not.ilike.%mei%')
        .order('razao_social', { ascending: true })

      if (outrosData) setOutrosClientes(outrosData)

      // 2. Busca faturas mais recentes
      const { data: faturasData } = await supabase
        .from('faturas')
        .select('id, cliente_id, valor, status, data_vencimento, qr_code_payload, desbloqueio_confianca_em')
        .order('data_vencimento', { ascending: false })

      const hoje = new Date().toISOString().split('T')[0]

      // Mapeia os clientes com suas respectivas faturas
      const lista: ClienteMei[] = (clientesData || []).map((c: any) => {
        const config = Array.isArray(c.configuracoes_hub) ? c.configuracoes_hub[0] : c.configuracoes_hub
        const faturasDoCliente = (faturasData || []).filter(f => f.cliente_id === c.id)
        
        // Pega a fatura vencida pendente ou a fatura pendente mais próxima
        const faturaPendente = faturasDoCliente.find(f => f.status === 'pendente')
        const faturaRecente = faturaPendente || faturasDoCliente[0]

        return {
          ...c,
          configuracoes_hub: config || {},
          fatura_atual: faturaRecente || undefined
        }
      })

      setClientes(lista)
    } catch (err: any) {
      console.error('Erro ao carregar clientes MEI Simples:', err)
      toast.error('Erro ao carregar assinantes: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [])

  // Métricas calculadas
  const metricas = useMemo(() => {
    const hoje = new Date().toISOString().split('T')[0]
    let totalAtivos = 0
    let totalBloqueados = 0
    let totalConfianca = 0
    let mrrTotal = 0

    clientes.forEach(c => {
      const isConfianca = Boolean(
        c.fatura_atual?.desbloqueio_confianca_em &&
        (new Date().getTime() - new Date(c.fatura_atual.desbloqueio_confianca_em).getTime()) <= (24 * 60 * 60 * 1000)
      )
      
      const isInadimplente = c.fatura_atual?.status === 'pendente' && c.fatura_atual.data_vencimento < hoje && !isConfianca
      const isBloqueado = !c.is_ativo || isInadimplente

      if (isConfianca) totalConfianca++
      if (isBloqueado) totalBloqueados++
      else totalAtivos++

      mrrTotal += Number(c.valor_mensalidade || 0)
    })

    return {
      total: clientes.length,
      ativos: totalAtivos,
      bloqueados: totalBloqueados,
      confianca: totalConfianca,
      mrr: mrrTotal
    }
  }, [clientes])

  // Filtragem da lista
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
  const alternarBloqueio = async (cliente: ClienteMei) => {
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
  const concederDesbloqueioConfianca = async (cliente: ClienteMei) => {
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
  const abrirEdicao = (cliente: ClienteMei) => {
    setClienteSelecionado(cliente)
    setEditDiaVencimento(cliente.dia_vencimento || 10)
    setEditValorMensalidade(Number(cliente.valor_mensalidade || 79.90).toFixed(2))
    setEditDiasCarencia(cliente.dias_carencia ?? 3)
    setEditOfflineSecret(cliente.configuracoes_hub?.offline_secret || '123456')
    setEditMensagemBloqueio(cliente.configuracoes_hub?.mensagem_bloqueio || 'SISTEMA BLOQUEADO. Por favor, regularize sua mensalidade.')
    setEditBannerUrl(cliente.configuracoes_hub?.banner_url || '')
    setEditSupportWhatsapp(cliente.configuracoes_hub?.support_whatsapp || '')
    setEditFeatureSugestaoTributaria(cliente.configuracoes_hub?.feature_sugestao_tributaria !== false)
    setEditFeatureNuvemProdutos(cliente.configuracoes_hub?.feature_nuvem_produtos !== false)
    setEditFeatureLojaVirtual(cliente.configuracoes_hub?.feature_loja_virtual === true)
    setEditFeatureNfce(cliente.configuracoes_hub?.feature_nfce !== false)
    setEditFeatureNfe(cliente.configuracoes_hub?.feature_nfe !== false)
    setEditFeatureContasPagar(cliente.configuracoes_hub?.feature_contas_pagar !== false)
    setEditFeatureEstoqueAvancado(cliente.configuracoes_hub?.feature_estoque_avancado !== false)
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
          nome_sistema_utilizado: 'MEI_SIMPLES'
        })
        .eq('id', clienteSelecionado.id)

      if (errCli) throw errCli

      // 2. Atualiza ou insere configurações do Hub
      const { error: errHub } = await supabase
        .from('configuracoes_hub')
        .upsert({
          cliente_id: clienteSelecionado.id,
          offline_secret: editOfflineSecret.trim(),
          mensagem_bloqueio: editMensagemBloqueio.trim(),
          banner_url: editBannerUrl.trim(),
          support_whatsapp: editSupportWhatsapp.trim(),
          feature_sugestao_tributaria: editFeatureSugestaoTributaria,
          feature_nuvem_produtos: editFeatureNuvemProdutos,
          feature_loja_virtual: editFeatureLojaVirtual,
          feature_nfce: editFeatureNfce,
          feature_nfe: editFeatureNfe,
          feature_contas_pagar: editFeatureContasPagar,
          feature_estoque_avancado: editFeatureEstoqueAvancado,
          dias_tolerancia_bloqueio: editDiasCarencia,
          dia_vencimento: editDiaVencimento,
          valor_mensalidade: parseFloat(editValorMensalidade.replace(',', '.'))
        }, { onConflict: 'cliente_id' })

      if (errHub) throw errHub

      toast.success('Parâmetros da assinatura atualizados com sucesso!')
      setModalEditarOpen(false)
      carregarDados()
    } catch (err: any) {
      toast.error('Erro ao salvar parâmetros: ' + err.message)
    } finally {
      setSalvando(false)
    }
  }

  // Vincular Cliente Existente ao MEI Simples
  const vincularClienteAoMei = async (id: string) => {
    if (!id) return
    setVinculando(true)
    try {
      const { error } = await supabase
        .from('clientes')
        .update({ nome_sistema_utilizado: 'MEI_SIMPLES' })
        .eq('id', id)

      if (error) throw error

      toast.success('Cliente ativado no MEI Simples com sucesso!')
      setModalVincularOpen(false)
      setClienteParaVincularId('')
      carregarDados()
    } catch (err: any) {
      toast.error('Erro ao vincular cliente: ' + err.message)
    } finally {
      setVinculando(false)
    }
  }

  // Desvincular Cliente do MEI Simples
  const desvincularClienteDoMei = async (cliente: ClienteMei) => {
    if (!confirm(`Deseja desativar o aplicativo MEI Simples para "${cliente.nome_fantasia || cliente.razao_social}"?\nO cliente deixará de ser listado nesta aba.`)) return
    try {
      const { error } = await supabase
        .from('clientes')
        .update({ nome_sistema_utilizado: 'PDV+' })
        .eq('id', cliente.id)

      if (error) throw error

      toast.success('Cliente desvinculado do MEI Simples.')
      carregarDados()
    } catch (err: any) {
      toast.error('Erro ao desvincular: ' + err.message)
    }
  }

  // Copiar para Área de Transferência
  const copiarTexto = (texto: string, label: string) => {
    navigator.clipboard.writeText(texto)
    toast.success(`${label} copiado para a área de transferência!`)
  }

  // Intervalo e Tolerância do Heartbeat (15 minutos + 2 min carência)
  const INTERVALO_HEARTBEAT_MS = 15 * 60 * 1000
  const TOLERANCIA_HEARTBEAT_MS = 2 * 60 * 1000

  // Formatar tempo de última sincronização com Cronômetro Regressivo ao vivo
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

    // Caso 1: Dentro da janela de 15 minutos (Online com cronômetro regressivo)
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

    // Caso 2: Entre 15 e 17 minutos (Janela de tolerância / aguardando pulso)
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

    // Caso 3: Mais de 17 minutos (Offline)
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

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* 1. CABEÇALHO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-blue-600 text-white rounded-xl shadow-md">
            <Store className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              MEI Simples • Gestão de Assinaturas & Licenças
              <span className="px-2 py-0.5 text-[11px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 rounded-full">
                SaaS Nativo
              </span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Controle de vencimentos, bloqueios/desbloqueios automáticos por PIX e tolerâncias sem necessidade do Hub Desktop instalado.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setModalVincularOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-xs cursor-pointer"
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
          <div className="p-3 bg-blue-50 dark:bg-blue-950/50 text-blue-600 rounded-xl">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-medium text-slate-500">Total de Assinantes</span>
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
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
              filtroStatus === 'todos' 
                ? 'bg-blue-600 text-white' 
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Todos ({clientes.length})
          </button>
          <button
            onClick={() => setFiltroStatus('ativos')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
              filtroStatus === 'ativos' 
                ? 'bg-emerald-600 text-white' 
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Ativos ({metricas.ativos})
          </button>
          <button
            onClick={() => setFiltroStatus('bloqueados')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
              filtroStatus === 'bloqueados' 
                ? 'bg-rose-600 text-white' 
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Bloqueados ({metricas.bloqueados})
          </button>
          <button
            onClick={() => setFiltroStatus('confianca')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
              filtroStatus === 'confianca' 
                ? 'bg-amber-600 text-white' 
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Em Confiança ({metricas.confianca})
          </button>
        </div>
      </div>

      {/* 4. TABELA DE ASSINANTES */}
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
                    Carregando clientes do MEI Simples...
                  </td>
                </tr>
              ) : clientesFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    Nenhum cliente do MEI Simples encontrado com os filtros selecionados.
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
                          R$ {Number(cliente.valor_mensalidade || 79.90).toFixed(2).replace('.', ',')}
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
                          {/* Botão Bloquear / Desbloquear Manual */}
                          <button
                            onClick={() => alternarBloqueio(cliente)}
                            className={`p-1.5 rounded-lg border transition cursor-pointer ${
                              cliente.is_ativo
                                ? 'border-rose-200 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50'
                                : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50'
                            }`}
                            title={cliente.is_ativo ? 'Bloquear Aplicativo' : 'Desbloquear Aplicativo'}
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
                            title="Editar Assinatura e Chave Offline"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>

                          {/* Botão Desvincular do MEI Simples */}
                          <button
                            onClick={() => desvincularClienteDoMei(cliente)}
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition cursor-pointer"
                            title="Desativar MEI Simples para esta empresa"
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

      {/* 5. MODAL DE EDIÇÃO DE ASSINATURA */}
      {modalEditarOpen && clienteSelecionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Header Sticky */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-100 dark:bg-blue-950/70 text-blue-600 rounded-xl">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    Parâmetros da Assinatura MEI Simples
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
                  <DollarSign className="w-3.5 h-3.5 text-blue-600" />
                  Cobrança & Parâmetros de Licenciamento
                </h4>
                <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200/70 dark:border-slate-800 space-y-3.5">
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Empresa Licenciada</label>
                    <input
                      type="text"
                      disabled
                      value={clienteSelecionado.razao_social}
                      className="w-full p-2.5 bg-slate-100 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-700 font-medium"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Dia de Vencimento</label>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        value={editDiaVencimento}
                        onChange={e => setEditDiaVencimento(Number(e.target.value))}
                        className="w-full p-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg border border-slate-200 dark:border-slate-700"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Mensalidade (R$)</label>
                      <input
                        type="text"
                        value={editValorMensalidade}
                        onChange={e => setEditValorMensalidade(e.target.value)}
                        className="w-full p-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg border border-slate-200 dark:border-slate-700 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Carência / Tolerância (Dias)</label>
                      <input
                        type="number"
                        min="0"
                        max="30"
                        value={editDiasCarencia}
                        onChange={e => setEditDiasCarencia(Number(e.target.value))}
                        className="w-full p-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg border border-slate-200 dark:border-slate-700"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Chave Secreta Offline</label>
                      <input
                        type="text"
                        value={editOfflineSecret}
                        onChange={e => setEditOfflineSecret(e.target.value)}
                        placeholder="Ex: 849201"
                        className="w-full p-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg border border-slate-200 dark:border-slate-700 font-mono font-bold text-blue-600"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Mensagem de Bloqueio na Tela do App</label>
                    <textarea
                      rows={2}
                      value={editMensagemBloqueio}
                      onChange={e => setEditMensagemBloqueio(e.target.value)}
                      className="w-full p-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg border border-slate-200 dark:border-slate-700"
                    />
                  </div>
                </div>
              </div>

              {/* BLOCO 2: BANNER PROMOCIONAL / GIF */}
              <div>
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-indigo-600" />
                  Banner Superior do MEI Simples (Imagem ou GIF)
                </h4>
                <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200/70 dark:border-slate-800 space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-semibold text-slate-700 dark:text-slate-300">URL do Banner (WebP, PNG, JPG ou GIF Animado)</label>
                      {editBannerUrl && (
                        <button
                          type="button"
                          onClick={() => setEditBannerUrl('')}
                          className="text-[11px] text-rose-500 hover:text-rose-600 font-semibold flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          Restaurar Padrão
                        </button>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={editBannerUrl}
                        onChange={e => setEditBannerUrl(e.target.value)}
                        placeholder="https://... ou caminho de imagem/GIF (em branco = padrão institucional de Contabilidade)"
                        className="grow p-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg border border-slate-200 dark:border-slate-700 font-mono text-xs"
                      />
                      {editBannerUrl && (
                        <a
                          href={editBannerUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 flex items-center justify-center shrink-0"
                          title="Abrir imagem em nova aba"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Este banner é exibido no topo da tela inicial do MEI Simples. Deixe em branco para manter o banner padrão de Contabilidade.
                    </p>
                  </div>

                  {/* Preview do Banner */}
                  <div className="pt-1">
                    <span className="text-[11px] font-semibold text-slate-500 block mb-1.5">Visualização Prévia:</span>
                    <div className="h-16 w-full rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700 bg-slate-900 flex items-center justify-center relative shadow-inner">
                      {editBannerUrl ? (
                        <img
                          src={editBannerUrl}
                          alt="Banner MEI Simples"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none'
                          }}
                        />
                      ) : (
                        <div className="text-center px-4">
                          <span className="text-[11px] text-blue-400 font-bold block">Banner Padrão de Contabilidade Ativo</span>
                          <span className="text-[10px] text-slate-400">Arte nativa embutida com assessoria fiscal e contábil.</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* BLOCO 3: SUPORTE WHATSAPP */}
              <div>
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-emerald-600" />
                  Canais de Atendimento & Suporte
                </h4>
                <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200/70 dark:border-slate-800 space-y-1.5">
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">WhatsApp(s) de Suporte (Rodapé do App)</label>
                  <input
                    type="text"
                    value={editSupportWhatsapp}
                    onChange={e => setEditSupportWhatsapp(e.target.value)}
                    placeholder="Ex: (37) 92000-7857 ou múltiplos: (37) 92000-7857, (37) 99999-0000"
                    className="w-full p-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg border border-slate-200 dark:border-slate-700 font-mono text-xs"
                  />
                  <p className="text-[11px] text-slate-500">
                    Utilizado pelo botão fixo do rodapé do MEI Simples. Se houver 1 número, o chat abre diretamente. Se houver mais de um, o app abre seletor modal com os canais disponíveis.
                  </p>
                </div>
              </div>

              {/* BLOCO 4: RESTRIÇÃO DE RECURSOS (FEATURE FLAGS) */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    Recursos & Restrições do Plano MEI Simples
                  </h4>
                  <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 text-[10px] font-bold rounded-full border border-amber-300 dark:border-amber-800">
                    Controle de Plano
                  </span>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200/70 dark:border-slate-800 divide-y divide-slate-200/70 dark:divide-slate-800">
                  {/* Recurso 1: Sugestão de Tributação */}
                  <label className="flex items-start justify-between gap-4 py-3 cursor-pointer first:pt-0">
                    <div className="space-y-0.5">
                      <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-amber-500" />
                        <span>Sugestão de Tributação Inteligente (IA & OCR Fiscal)</span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Sugere automaticamente NCM, CEST, CFOP, CSOSN e alíquotas na importação de notas fiscais XML e no cadastro de produtos.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={editFeatureSugestaoTributaria}
                      onChange={e => setEditFeatureSugestaoTributaria(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 mt-1 cursor-pointer"
                    />
                  </label>

                  {/* Recurso 2: Importação de Produtos da Nuvem */}
                  <label className="flex items-start justify-between gap-4 py-3 cursor-pointer">
                    <div className="space-y-0.5">
                      <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Cloud className="w-4 h-4 text-cyan-600" />
                        <span>Importação de Produtos da Nuvem Paratech</span>
                        <span className="px-1.5 py-0.2 bg-cyan-100 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-400 text-[9px] font-bold rounded">Em breve</span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Permite consultar e importar o catálogo completo de produtos pré-classificados da nuvem diretamente para o estoque do cliente.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={editFeatureNuvemProdutos}
                      onChange={e => setEditFeatureNuvemProdutos(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 mt-1 cursor-pointer"
                    />
                  </label>

                  {/* Recurso 3: Loja Virtual / Delivery */}
                  <label className="flex items-start justify-between gap-4 py-3 cursor-pointer">
                    <div className="space-y-0.5">
                      <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <ShoppingCart className="w-4 h-4 text-violet-600" />
                        <span>Loja Virtual & Catálogo Online de Pedidos</span>
                        <span className="px-1.5 py-0.2 bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-400 text-[9px] font-bold rounded">Em breve</span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Habilita a vitrine online e a recepção de pedidos web (delivery) integrados diretamente na frente de caixa.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={editFeatureLojaVirtual}
                      onChange={e => setEditFeatureLojaVirtual(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 mt-1 cursor-pointer"
                    />
                  </label>

                  {/* Recurso 4: Emissão NFC-e */}
                  <label className="flex items-start justify-between gap-4 py-3 cursor-pointer">
                    <div className="space-y-0.5">
                      <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Receipt className="w-4 h-4 text-emerald-600" />
                        <span>Emissão de Cupom Fiscal Eletrônico (NFC-e mod. 65)</span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Permite a transmissão em tempo real à SEFAZ e impressão térmica com QR-Code 2.0.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={editFeatureNfce}
                      onChange={e => setEditFeatureNfce(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 mt-1 cursor-pointer"
                    />
                  </label>

                  {/* Recurso 5: Emissão NF-e */}
                  <label className="flex items-start justify-between gap-4 py-3 cursor-pointer">
                    <div className="space-y-0.5">
                      <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-blue-600" />
                        <span>Emissão de Nota Fiscal Eletrônica (NF-e mod. 55)</span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Permite a emissão, faturamento e exportação de XML de NF-e mercantil para empresas e órgãos públicos.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={editFeatureNfe}
                      onChange={e => setEditFeatureNfe(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 mt-1 cursor-pointer"
                    />
                  </label>

                  {/* Recurso 6: Contas a Pagar */}
                  <label className="flex items-start justify-between gap-4 py-3 cursor-pointer">
                    <div className="space-y-0.5">
                      <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <DollarSign className="w-4 h-4 text-rose-600" />
                        <span>Módulo de Contas a Pagar & Despesas</span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Habilita a gestão financeira de títulos, contas a pagar geradas por entradas de notas e compras.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={editFeatureContasPagar}
                      onChange={e => setEditFeatureContasPagar(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 mt-1 cursor-pointer"
                    />
                  </label>

                  {/* Recurso 7: Controle Avançado de Estoque */}
                  <label className="flex items-start justify-between gap-4 py-3 cursor-pointer last:pb-0">
                    <div className="space-y-0.5">
                      <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Package className="w-4 h-4 text-indigo-600" />
                        <span>Controle Avançado de Estoque & Fator de Conversão</span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Habilita cálculo de custo médio, conversão de fardos/caixas em unidades e alerta de estoque mínimo.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={editFeatureEstoqueAvancado}
                      onChange={e => setEditFeatureEstoqueAvancado(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 mt-1 cursor-pointer"
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Footer Sticky */}
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 shrink-0">
              <span className="text-[11px] text-slate-500">
                Os parâmetros são sincronizados com o app via Hub.
              </span>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setModalEditarOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={salvarEdicao}
                  disabled={salvando}
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                >
                  {salvando ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Salvar Parâmetros</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. MODAL DE QR CODE PIX */}
      {modalPixOpen && clienteSelecionado?.fatura_atual && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden p-5 text-center space-y-4">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Cobrança PIX - {clienteSelecionado.razao_social}
            </h3>

            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
              <div className="text-xs text-slate-500">Valor da Fatura</div>
              <div className="text-xl font-bold text-slate-900 dark:text-white">
                R$ {Number(clienteSelecionado.fatura_atual.valor).toFixed(2).replace('.', ',')}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Vencimento: {clienteSelecionado.fatura_atual.data_vencimento.split('-').reverse().join('/')}
              </div>
            </div>

            {clienteSelecionado.fatura_atual.qr_code_payload ? (
              <div className="space-y-3">
                <div className="bg-white p-3 rounded-xl border border-slate-200 inline-block shadow-xs">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(clienteSelecionado.fatura_atual.qr_code_payload)}`}
                    alt="QR Code PIX"
                    className="w-44 h-44 mx-auto"
                  />
                </div>

                <button
                  onClick={() => copiarTexto(clienteSelecionado.fatura_atual!.qr_code_payload!, 'Código PIX')}
                  className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar Código Copia-e-Cola</span>
                </button>
              </div>
            ) : (
              <div className="p-4 text-xs text-slate-500">
                Payload do PIX não disponível para esta fatura.
              </div>
            )}

            <button
              onClick={() => setModalPixOpen(false)}
              className="w-full py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* 7. MODAL DE VINCULAR CLIENTE AO MEI SIMPLES */}
      {modalVincularOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600">
                <Store className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Vincular Cliente ao MEI Simples
                </h3>
                <p className="text-xs text-slate-500">
                  Selecione uma empresa já cadastrada no Hub para ativar o aplicativo MEI Simples.
                </p>
              </div>
            </div>

            <div className="space-y-1.5 text-left">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Selecione o Cliente
              </label>
              <select
                value={clienteParaVincularId}
                onChange={e => setClienteParaVincularId(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Selecione uma empresa...</option>
                {outrosClientes.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.razao_social} {c.nome_fantasia ? `(${c.nome_fantasia})` : ''} — CNPJ: {c.cnpj} {c.nome_sistema_utilizado ? `[${c.nome_sistema_utilizado}]` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs text-slate-600 dark:text-slate-400 space-y-1">
              <p className="font-medium text-slate-800 dark:text-slate-200">
                O que acontece ao vincular:
              </p>
              <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                <li>O sistema em uso será alterado para <strong>MEI_SIMPLES</strong>.</li>
                <li>A empresa passará a ser gerenciada nativamente nesta aba.</li>
                <li>O aplicativo Flutter no PC/dispositivo do cliente conectará via token.</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setModalVincularOpen(false)
                  setClienteParaVincularId('')
                }}
                disabled={vinculando}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => vincularClienteAoMei(clienteParaVincularId)}
                disabled={vinculando || !clienteParaVincularId}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {vinculando ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>{vinculando ? 'Vinculando...' : 'Ativar no MEI Simples'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
