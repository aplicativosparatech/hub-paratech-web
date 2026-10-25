'use client'

import { useEffect, useState, useMemo } from 'react'
import { 
  Store, Users, CheckCircle2, AlertTriangle, XCircle, Search, 
  RefreshCw, Plus, Copy, Lock, Unlock, Zap, DollarSign, Clock, 
  KeyRound, QrCode, FileText, Check, ShieldAlert, Phone
} from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import toast from 'react-hot-toast'
import { formatarCnpjCpf } from '@/utils/cnpjAlfanumerico'

interface ClienteMei {
  id: string
  razao_social: string
  nome_fantasia?: string
  cnpj_cpf: string
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
  const [clienteSelecionado, setClienteSelecionado] = useState<ClienteMei | null>(null)
  
  // Form Edição
  const [editDiaVencimento, setEditDiaVencimento] = useState(10)
  const [editValorMensalidade, setEditValorMensalidade] = useState('79.90')
  const [editDiasCarencia, setEditDiasCarencia] = useState(3)
  const [editOfflineSecret, setEditOfflineSecret] = useState('')
  const [editMensagemBloqueio, setEditMensagemBloqueio] = useState('')
  const [salvando, setSalvando] = useState(false)
  
  const supabase = createClient()

  async function carregarDados() {
    setLoading(true)
    try {
      // 1. Busca todos os clientes cadastrados para o MEI Simples (ou todos com identificação MEI)
      const { data: clientesData, error: cliErr } = await supabase
        .from('clientes')
        .select(`
          id, razao_social, nome_fantasia, cnpj_cpf, telefone, is_ativo, 
          dia_vencimento, valor_mensalidade, dias_carencia, hub_token, 
          nome_sistema_utilizado,
          configuracoes_hub (
            offline_secret, ultima_sincronizacao, dias_tolerancia_bloqueio, mensagem_bloqueio
          )
        `)
        .order('created_at', { ascending: false })

      if (cliErr) throw cliErr

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
        c.cnpj_cpf.includes(termo) ||
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

  // Copiar para Área de Transferência
  const copiarTexto = (texto: string, label: string) => {
    navigator.clipboard.writeText(texto)
    toast.success(`${label} copiado para a área de transferência!`)
  }

  // Formatar tempo de última sincronização
  const formatarHeartbeat = (dataIso?: string) => {
    if (!dataIso) return <span className="text-slate-400 text-xs">Nunca conectou</span>
    const diff = (new Date().getTime() - new Date(dataIso).getTime()) / 1000
    if (diff < 120) return <span className="text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>Online agora</span>
    if (diff < 3600) return <span className="text-sky-600 dark:text-sky-400 text-xs">Conectou há {Math.floor(diff / 60)} min</span>
    if (diff < 86400) return <span className="text-slate-600 dark:text-slate-300 text-xs">Conectou há {Math.floor(diff / 3600)} h</span>
    return <span className="text-amber-600 dark:text-amber-400 text-xs">Offline há {Math.floor(diff / 86400)} dias</span>
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
                        <div className="font-bold text-slate-900 dark:text-white">
                          {cliente.nome_fantasia || cliente.razao_social}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                          <span>{formatarCnpjCpf(cliente.cnpj_cpf)}</span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Store className="w-4 h-4 text-blue-600" />
                Parâmetros da Assinatura MEI Simples
              </h3>
              <button 
                onClick={() => setModalEditarOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Empresa</label>
                <input
                  type="text"
                  disabled
                  value={clienteSelecionado.razao_social}
                  className="w-full p-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-700 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Dia de Vencimento</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={editDiaVencimento}
                    onChange={e => setEditDiaVencimento(Number(e.target.value))}
                    className="w-full p-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg border border-slate-200 dark:border-slate-700"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Mensalidade (R$)</label>
                  <input
                    type="text"
                    value={editValorMensalidade}
                    onChange={e => setEditValorMensalidade(e.target.value)}
                    className="w-full p-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg border border-slate-200 dark:border-slate-700 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Carência / Tolerância (Dias)</label>
                  <input
                    type="number"
                    min="0"
                    max="30"
                    value={editDiasCarencia}
                    onChange={e => setEditDiasCarencia(Number(e.target.value))}
                    className="w-full p-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg border border-slate-200 dark:border-slate-700"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Chave Secreta Offline</label>
                  <input
                    type="text"
                    value={editOfflineSecret}
                    onChange={e => setEditOfflineSecret(e.target.value)}
                    placeholder="Ex: 849201"
                    className="w-full p-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg border border-slate-200 dark:border-slate-700 font-mono font-bold text-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Mensagem de Bloqueio na Tela do App</label>
                <textarea
                  rows={2}
                  value={editMensagemBloqueio}
                  onChange={e => setEditMensagemBloqueio(e.target.value)}
                  className="w-full p-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg border border-slate-200 dark:border-slate-700"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setModalEditarOpen(false)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 dark:text-slate-300 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={salvarEdicao}
                disabled={salvando}
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-1.5"
              >
                {salvando ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>Salvar Parâmetros</span>
              </button>
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
    </div>
  )
}
