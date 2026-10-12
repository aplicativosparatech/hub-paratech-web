'use client'

import { useState, useEffect } from 'react'
import { 
  BarChart3, Download, RefreshCw, AlertTriangle, CheckCircle2, 
  FileText, Hash, ShieldAlert, Sparkles, Building2, Calendar, FileArchive,
  KeyRound, Clock, ShieldCheck
} from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import toast from 'react-hot-toast'

export default function RelatoriosPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [loadingAudit, setLoadingAudit] = useState(false)
  const [downloadingZip, setDownloadingZip] = useState(false)

  // Dados do Usuário e Clientes
  const [clientes, setClientes] = useState<any[]>([])
  const [selectedCliente, setSelectedCliente] = useState<string>('')
  
  // Filtro de Mês/Ano (Padrão: Mês Atual)
  const today = new Date()
  const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  const [selectedMonth, setSelectedMonth] = useState<string>(defaultMonth)

  // Abas do Relatório
  const [activeTab, setActiveTab] = useState<'faturamento' | 'monofasicos' | 'quebra' | 'nao_assinadas' | 'inutilizadas' | 'certificados'>('faturamento')

  // Configurações do Hub do Cliente Atual (permissões de exibição)
  const [configHub, setConfigHub] = useState<{
    exibir_certificados_contabilidade: boolean
    exibir_certificados_cliente: boolean
  } | null>(null)

  // Dados da Auditoria
  const [auditData, setAuditData] = useState<any>(null)
  // Papel do usuário logado ('admin' | 'contabilidade' | 'cliente')
  const [userRole, setUserRole] = useState<'admin' | 'contabilidade' | 'cliente'>('admin')
  const [clientSearchTerm, setClientSearchTerm] = useState('')

  // Carrega clientes disponíveis para o usuário
  useEffect(() => {
    async function init() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setLoading(false)
          return
        }

        const { data: roleData } = await supabase.from('user_roles').select('*').eq('user_id', user.id).maybeSingle()
        const role = (roleData?.role as any) || 'admin'
        setUserRole(role)

        let clisData: any[] = []

        if (role === 'cliente' && roleData?.cliente_id) {
          const { data: cli } = await supabase
            .from('clientes')
            .select('*')
            .eq('id', roleData.cliente_id)
            .maybeSingle()
          if (cli) clisData = [cli]
        } else if (role === 'contabilidade' && roleData?.contabilidade_id) {
          const { data: clis } = await supabase
            .from('clientes')
            .select('*')
            .eq('contabilidade_id', roleData.contabilidade_id)
            .order('razao_social')
          if (clis) clisData = clis
        } else {
          // Admin: busca todas as empresas cadastradas
          const { data: clis, error: errClis } = await supabase
            .from('clientes')
            .select('*')
            .order('razao_social')
          
          if (errClis) {
            console.error('Erro ao buscar clientes para relatorios:', errClis)
          }
          if (clis) clisData = clis
        }

        // Se temos clientes, buscar os nomes das contabilidades vinculadas para exibição no card
        if (clisData.length > 0) {
          const { data: contabs } = await supabase.from('contabilidades').select('id, razao_social')
          const contabMap = new Map((contabs || []).map(c => [c.id, c.razao_social]))

          const mapped = clisData.map(c => ({
            ...c,
            contabilidade_nome: c.contabilidade_id ? contabMap.get(c.contabilidade_id) : 'Não vinculada'
          }))

          setClientes(mapped)
          setSelectedCliente(mapped[0].id)
        } else {
          setClientes([])
        }
      } catch (err) {
        console.error('Erro geral no init de relatorios:', err)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  // Carrega permissões de configuração do Hub para a empresa selecionada
  useEffect(() => {
    async function loadConfigHub() {
      if (!selectedCliente) {
        setConfigHub(null)
        return
      }
      const { data: cfg } = await supabase
        .from('configuracoes_hub')
        .select('exibir_certificados_contabilidade, exibir_certificados_cliente')
        .eq('cliente_id', selectedCliente)
        .maybeSingle()

      setConfigHub(cfg || {
        exibir_certificados_contabilidade: false,
        exibir_certificados_cliente: false
      })
    }
    loadConfigHub()
  }, [selectedCliente])

  // Define se o usuário tem permissão para visualizar o relatório de certificados
  const canViewCertificados = userRole === 'admin' ||
    (userRole === 'contabilidade' && configHub?.exibir_certificados_contabilidade === true) ||
    (userRole === 'cliente' && configHub?.exibir_certificados_cliente === true)

  // Se o usuário perder a permissão (por ex. ao alternar de cliente), volta para faturamento
  useEffect(() => {
    if (!canViewCertificados && activeTab === 'certificados') {
      setActiveTab('faturamento')
    }
  }, [canViewCertificados, activeTab])

  // Dispara a auditoria ao mudar cliente ou mês
  useEffect(() => {
    if (selectedCliente) {
      loadAuditoria()
    }
  }, [selectedCliente, selectedMonth])

  const loadAuditoria = async () => {
    if (!selectedCliente) return
    setLoadingAudit(true)
    try {
      const res = await fetch(`/api/relatorios/auditoria-fiscal?cliente_id=${selectedCliente}&mes=${selectedMonth}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao carregar auditoria')
      setAuditData(data)
    } catch (err: any) {
      toast.error('Erro na auditoria: ' + err.message)
    } finally {
      setLoadingAudit(false)
    }
  }

  // Atalhos para Mês Anterior / Mês Atual
  const setMesAnterior = () => {
    const d = new Date(selectedMonth + '-01')
    d.setMonth(d.getMonth() - 1)
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const setMesAtual = () => {
    setSelectedMonth(defaultMonth)
  }

  // Download do pacote ZIP de XMLs
  const handleDownloadZip = async () => {
    if (!selectedCliente) return
    setDownloadingZip(true)
    const toastId = toast.loading('Compactando XMLs do período...')

    try {
      const res = await fetch(`/api/relatorios/download-zip?cliente_id=${selectedCliente}&mes=${selectedMonth}`)
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao gerar ZIP')
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `XMLs_${selectedMonth}.zip`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      toast.success('Download do ZIP concluído!', { id: toastId })
    } catch (err: any) {
      toast.error(err.message, { id: toastId })
    } finally {
      setDownloadingZip(false)
    }
  }

  if (loading) {
    return <div className="p-8 text-slate-500">Carregando módulo fiscal...</div>
  }

  const consolidado = auditData?.consolidado
  const quebras = auditData?.quebras_sequencia || []
  const naoAssinadas = auditData?.nao_assinadas
  const inutilizadas = auditData?.inutilizadas

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-300">
      
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <BarChart3 className="text-blue-600" size={32} />
            Auditoria Fiscal & Relatórios
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Painel completo de faturamento, segregação de monofásicos (PIS/COFINS), quebras de numeração e download de XMLs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleDownloadZip}
            disabled={downloadingZip}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-semibold shadow-sm hover:shadow transition text-sm disabled:opacity-50"
          >
            <FileArchive size={18} />
            {downloadingZip ? 'Baixando ZIP...' : 'Baixar XMLs (.zip)'}
          </button>
          <button
            onClick={loadAuditoria}
            disabled={loadingAudit}
            className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl font-semibold transition text-sm disabled:opacity-50"
          >
            <RefreshCw size={18} className={loadingAudit ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Barra de Filtros (Cliente + Mês) */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Seletor e Localizador de Cliente */}
        {userRole !== 'cliente' && clientes.length > 0 && (
          <div className="flex-1 max-w-xl space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                {userRole === 'admin' ? '🔍 Localizar Cliente (Admin)' : '🏢 Empresa Selecionada (Contabilidade)'}
              </label>
              <span className="text-[11px] text-blue-600 font-medium">
                {clientes.length} {clientes.length === 1 ? 'empresa' : 'empresas'}
              </span>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2">
              {/* Campo de Busca Rápida por Nome ou CNPJ */}
              <input
                type="text"
                placeholder="Filtrar por nome ou CNPJ..."
                value={clientSearchTerm}
                onChange={e => setClientSearchTerm(e.target.value)}
                className="w-full sm:w-1/2 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              {/* Select filtrado */}
              <select
                value={selectedCliente}
                onChange={e => setSelectedCliente(e.target.value)}
                className="w-full sm:w-1/2 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              >
                {clientes
                  .filter(c => {
                    if (!clientSearchTerm) return true
                    const term = clientSearchTerm.toLowerCase()
                    return (
                      (c.razao_social && c.razao_social.toLowerCase().includes(term)) ||
                      (c.nome_fantasia && c.nome_fantasia.toLowerCase().includes(term)) ||
                      (c.cnpj && c.cnpj.includes(term))
                    )
                  })
                  .map(c => (
                    <option key={c.id} value={c.id}>
                      {c.razao_social} {c.nome_fantasia ? `(${c.nome_fantasia})` : ''}
                    </option>
                  ))}
              </select>
            </div>
          </div>
        )}

        {/* Exibição para o Cliente logado (apenas visualização da própria titularidade) */}
        {userRole === 'cliente' && clientes.length > 0 && (
          <div className="flex-1 max-w-md">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              🏢 Sua Empresa Titular
            </label>
            <div className="px-4 py-2.5 bg-blue-50/60 rounded-xl text-sm font-bold text-slate-900 border border-blue-200 flex items-center justify-between">
              <span>{clientes[0].razao_social}</span>
              <span className="text-xs font-mono font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-md">
                {clientes[0].cnpj}
              </span>
            </div>
          </div>
        )}

        {/* Caso nenhuma empresa seja encontrada */}
        {clientes.length === 0 && (
          <div className="flex-1 p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-xs font-medium">
            ⚠️ Nenhuma empresa vinculada encontrada para este usuário.
          </div>
        )}

        {/* Seletor de Competência (Mês/Ano) */}
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              Competência (Mês/Ano)
            </label>
            <input
              type="month"
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            />
          </div>

          <div className="flex items-center gap-2 pt-5">
            <button
              onClick={setMesAnterior}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-semibold text-slate-600 transition"
            >
              Mês Anterior
            </button>
            <button
              onClick={setMesAtual}
              className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-xs font-semibold transition"
            >
              Mês Atual
            </button>
          </div>
        </div>
      </div>

      {/* Card de Detalhes da Empresa Selecionada */}
      {(() => {
        const currentCli = clientes.find(c => c.id === selectedCliente)
        if (!currentCli) return null
        const contabNome = currentCli.contabilidade_nome || 'Não vinculada'
        return (
          <div className="bg-gradient-to-r from-slate-900 to-blue-950 text-white rounded-2xl p-5 shadow-sm border border-slate-800">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-400 mb-3">
              <Building2 size={16} /> Dados Cadastrais da Empresa Selecionada (Conferência Fiscal)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 text-sm">
              <div>
                <p className="text-slate-400 text-xs">Razão Social</p>
                <p className="font-semibold text-slate-100 truncate" title={currentCli.razao_social}>{currentCli.razao_social || '—'}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs">Nome Fantasia</p>
                <p className="font-semibold text-slate-100 truncate" title={currentCli.nome_fantasia}>{currentCli.nome_fantasia || '—'}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs">CNPJ</p>
                <p className="font-semibold font-mono text-blue-300">{currentCli.cnpj || '—'}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs">Regime Tributário</p>
                <p className="font-semibold text-amber-300">
                  {currentCli.regime_tributario === 'simples_nacional' && 'Simples Nacional'}
                  {currentCli.regime_tributario === 'simples_nacional_excesso' && 'Simples (Excesso)'}
                  {currentCli.regime_tributario === 'lucro_presumido' && 'Lucro Presumido'}
                  {currentCli.regime_tributario === 'lucro_real' && 'Lucro Real'}
                  {currentCli.regime_tributario === 'mei' && 'MEI'}
                  {!currentCli.regime_tributario && 'Simples Nacional'}
                </p>
              </div>
              <div>
                <p className="text-slate-400 text-xs">WhatsApp / Contato</p>
                <p className="font-semibold text-slate-100">{currentCli.whatsapp || '—'}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs">Contabilidade</p>
                <p className="font-semibold text-emerald-400 truncate" title={contabNome}>{contabNome}</p>
              </div>
            </div>
          </div>
        )
      })()}

      {/* CARDS DE RESUMO DE FATURAMENTO CONSOLIDADO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* NF-e Modelo 55 */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md">Modelo 55</span>
            <span className="text-xs text-slate-400 font-medium">{consolidado?.nfe?.quantidade || 0} notas</span>
          </div>
          <p className="text-xs font-medium text-slate-500">NF-e (Vendas / Grandes Operações)</p>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            R$ {(consolidado?.nfe?.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>

        {/* NFC-e Modelo 65 */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md">Modelo 65</span>
            <span className="text-xs text-slate-400 font-medium">{consolidado?.nfce?.quantidade || 0} notas</span>
          </div>
          <p className="text-xs font-medium text-slate-500">NFC-e (Consumidor / Cupom PDV)</p>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            R$ {(consolidado?.nfce?.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>

        {/* Faturamento Geral Consolidado */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md">Soma Total</span>
            <span className="text-xs text-slate-400 font-medium">{consolidado?.geral?.quantidade_total || 0} notas</span>
          </div>
          <p className="text-xs font-medium text-slate-500">Faturamento Bruto Consolidado</p>
          <p className="text-2xl font-bold text-emerald-600 mt-2">
            R$ {(consolidado?.geral?.total_faturado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>

        {/* Produtos Monofásicos */}
        <div className="bg-gradient-to-br from-amber-50 to-orange-50/40 p-6 rounded-2xl border border-amber-200 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-md flex items-center gap-1">
              <Sparkles size={12} /> Monofásicos
            </span>
            <span className="text-xs text-amber-800 font-semibold">Economia DAS</span>
          </div>
          <p className="text-xs font-medium text-amber-800">Total Monofásico a Segregar</p>
          <p className="text-2xl font-bold text-amber-700 mt-2">
            R$ {(consolidado?.geral?.total_monofasico || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-amber-600 mt-1">Dedução no PGDAS (Simples Nacional)</p>
        </div>

      </div>

      {/* ABAS DO AUDITOR */}
      <div className="flex space-x-2 border-b border-slate-200 pb-px overflow-x-auto">
        <button
          onClick={() => setActiveTab('faturamento')}
          className={`flex items-center gap-2 px-5 py-3 font-semibold text-sm border-b-2 transition whitespace-nowrap ${
            activeTab === 'faturamento' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText size={18} /> Faturamento Validado
        </button>

        <button
          onClick={() => setActiveTab('monofasicos')}
          className={`flex items-center gap-2 px-5 py-3 font-semibold text-sm border-b-2 transition whitespace-nowrap ${
            activeTab === 'monofasicos' ? 'border-amber-600 text-amber-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Sparkles size={18} /> Auditor de Monofásicos (PIS/COFINS)
        </button>

        <button
          onClick={() => setActiveTab('quebra')}
          className={`flex items-center gap-2 px-5 py-3 font-semibold text-sm border-b-2 transition whitespace-nowrap ${
            activeTab === 'quebra' ? 'border-red-600 text-red-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Hash size={18} /> Quebra de Sequência ({quebras.length})
        </button>

        <button
          onClick={() => setActiveTab('nao_assinadas')}
          className={`flex items-center gap-2 px-5 py-3 font-semibold text-sm border-b-2 transition whitespace-nowrap ${
            activeTab === 'nao_assinadas' ? 'border-orange-600 text-orange-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShieldAlert size={18} /> Não Assinadas / Sem Protocolo ({naoAssinadas?.total || 0})
        </button>

        <button
          onClick={() => setActiveTab('inutilizadas')}
          className={`flex items-center gap-2 px-5 py-3 font-semibold text-sm border-b-2 transition whitespace-nowrap ${
            activeTab === 'inutilizadas' ? 'border-slate-800 text-slate-800' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <CheckCircle2 size={18} /> Inutilizadas ({inutilizadas?.total || 0})
        </button>

        {canViewCertificados && (
          <button
            onClick={() => setActiveTab('certificados')}
            className={`flex items-center gap-2 px-5 py-3 font-semibold text-sm border-b-2 transition whitespace-nowrap ${
              activeTab === 'certificados' ? 'border-amber-600 text-amber-600' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <KeyRound size={18} /> Certificados Digitais A1
          </button>
        )}
      </div>

      {/* CONTEÚDO DAS ABAS */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
        
        {/* ABA 1: FATURAMENTO VALIDADO */}
        {activeTab === 'faturamento' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-bold text-slate-900 mb-1">Faturamento Consolidado do Período</h3>
              <p className="text-sm text-slate-500">Notas com assinatura digital e protocolo SEFAZ autorizado (cStat 100).</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 rounded-xl bg-slate-50 border border-slate-200">
                <h4 className="text-base font-bold text-slate-800 mb-4 flex items-center justify-between">
                  <span>Demonstrativo por Modelo</span>
                  <span className="text-xs text-slate-400 font-normal">Mês: {selectedMonth}</span>
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-200 text-sm">
                    <span className="text-slate-600 font-medium">NF-e (Modelo 55):</span>
                    <span className="font-bold text-slate-800">R$ {(consolidado?.nfe?.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-slate-200 text-sm">
                    <span className="text-slate-600 font-medium">NFC-e (Modelo 65):</span>
                    <span className="font-bold text-slate-800">R$ {(consolidado?.nfce?.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 font-bold text-base text-emerald-700">
                    <span>Total Faturado:</span>
                    <span>R$ {(consolidado?.geral?.total_faturado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              <div className="p-6 rounded-xl bg-slate-50 border border-slate-200">
                <h4 className="text-base font-bold text-slate-800 mb-4">Segregação do Simples Nacional</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-200 text-sm">
                    <span className="text-slate-600 font-medium">Faturamento Bruto:</span>
                    <span className="font-bold text-slate-800">R$ {(consolidado?.geral?.total_faturado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-slate-200 text-sm">
                    <span className="text-amber-700 font-medium">(-) Monofásicos a Deduzir:</span>
                    <span className="font-bold text-amber-700">- R$ {(consolidado?.geral?.total_monofasico || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 font-bold text-base text-blue-700">
                    <span>Base Tributável Restante:</span>
                    <span>R$ {(consolidado?.geral?.total_tributavel_restante || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ABA 2: AUDITOR DE MONOFÁSICOS */}
        {activeTab === 'monofasicos' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-bold text-slate-900 mb-1 flex items-center gap-2">
                <Sparkles className="text-amber-600" size={24} />
                Auditor de Produtos Monofásicos (PIS & COFINS)
              </h3>
              <p className="text-sm text-slate-500">
                Análise automática de itens por cruzamento de <strong>NCM Oficial da Receita x CST de PIS/COFINS</strong>.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Via 1: Dinheiro a Recuperar */}
              <div className="p-6 rounded-2xl bg-emerald-50/60 border border-emerald-200">
                <div className="flex items-center gap-2 text-emerald-800 font-bold mb-3">
                  <CheckCircle2 size={20} className="text-emerald-600" />
                  Via 1: Segregação Correta (Dedução no DAS)
                </div>
                <p className="text-xs text-emerald-700 leading-relaxed mb-4">
                  Produtos monofásicos (Bebidas, Autopeças, Remédios, Cosméticos) que possuem alíquota zero de PIS/COFINS na revenda e geram redução direta no boleto do Simples Nacional.
                </p>
                <div className="p-4 bg-white rounded-xl border border-emerald-200 text-center">
                  <span className="text-xs text-slate-500 block uppercase font-bold tracking-wider">Valor Total a Segregar</span>
                  <span className="text-3xl font-extrabold text-emerald-700 block mt-1">
                    R$ {(consolidado?.geral?.total_monofasico || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Via 2: Auditoria de Risco */}
              <div className="p-6 rounded-2xl bg-amber-50/60 border border-amber-200">
                <div className="flex items-center gap-2 text-amber-800 font-bold mb-3">
                  <AlertTriangle size={20} className="text-amber-600" />
                  Via 2: Alerta de Inconsistência Cadastral
                </div>
                <p className="text-xs text-amber-700 leading-relaxed mb-4">
                  O motor do Hub verifica se algum produto com NCM comum foi cadastrado erroneamente com CST 04 (falso monofásico) ou se produtos monofásicos foram tributados integralmente no ERP.
                </p>
                <div className="p-4 bg-white rounded-xl border border-amber-200 text-center">
                  <span className="text-xs text-slate-500 block uppercase font-bold tracking-wider">Status da Base Cadastral</span>
                  <span className="text-sm font-bold text-amber-800 block mt-2">
                    ✅ Itens auditados conforme tabela NCM Receita Federal
                  </span>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ABA 3: QUEBRA DE SEQUÊNCIA */}
        {activeTab === 'quebra' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-bold text-slate-900 mb-1 flex items-center gap-2">
                <Hash className="text-red-600" size={24} />
                Relatório de Quebra de Sequência de Numeração
              </h3>
              <p className="text-sm text-slate-500">
                Identificação automática de números de notas que foram pulados ou faltam na sequência cronológica da SEFAZ.
              </p>
            </div>

            {quebras.length === 0 ? (
              <div className="p-12 text-center bg-slate-50 rounded-2xl border border-slate-200">
                <CheckCircle2 size={40} className="text-emerald-500 mx-auto mb-3" />
                <h4 className="font-bold text-slate-800 text-lg">Nenhuma Quebra de Sequência Detectada!</h4>
                <p className="text-sm text-slate-500 mt-1">Todas as notas fiscais do período estão perfeitamente contínuas por série.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      <th className="p-4">Modelo</th>
                      <th className="p-4">Série</th>
                      <th className="p-4">Intervalo Faltante</th>
                      <th className="p-4">Qtd. Notas Puladas</th>
                      <th className="p-4">Nota Anterior</th>
                      <th className="p-4">Nota Posterior</th>
                      <th className="p-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {quebras.map((q: any, idx: number) => (
                      <tr key={idx} className="hover:bg-red-50/30 transition">
                        <td className="p-4 font-semibold text-slate-800">{q.modelo}</td>
                        <td className="p-4 text-slate-600">Série {q.serie}</td>
                        <td className="p-4 font-mono font-bold text-red-600">
                          {q.esperado_de === q.esperado_ate ? `Nº ${q.esperado_de}` : `Nº ${q.esperado_de} até ${q.esperado_ate}`}
                        </td>
                        <td className="p-4 font-semibold text-slate-800">{q.quantidade_faltante} nota(s)</td>
                        <td className="p-4 text-slate-500 font-mono">Nº {q.anterior_emitido}</td>
                        <td className="p-4 text-slate-500 font-mono">Nº {q.posterior_emitido}</td>
                        <td className="p-4">
                          <span className="px-2.5 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full">
                            Pendente / Inutilizar
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ABA 4: NÃO ASSINADAS / SEM PROTOCOLO */}
        {activeTab === 'nao_assinadas' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-bold text-slate-900 mb-1 flex items-center gap-2">
                <ShieldAlert className="text-orange-600" size={24} />
                Notas Não Assinadas ou Sem Protocolo SEFAZ
              </h3>
              <p className="text-sm text-slate-500">
                Arquivos XML locais que não contêm a assinatura digital válida ou autorização de uso (cStat != 100).
              </p>
            </div>

            {(!naoAssinadas?.total || naoAssinadas.total === 0) ? (
              <div className="p-12 text-center bg-slate-50 rounded-2xl border border-slate-200">
                <CheckCircle2 size={40} className="text-emerald-500 mx-auto mb-3" />
                <h4 className="font-bold text-slate-800 text-lg">100% das Notas Estão Assinadas e Validadas!</h4>
                <p className="text-sm text-slate-500 mt-1">Nenhuma nota rejeitada ou sem protocolo encontrada neste período.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      <th className="p-4">Número</th>
                      <th className="p-4">Chave de Acesso</th>
                      <th className="p-4">Valor (R$)</th>
                      <th className="p-4">Data Emissão</th>
                      <th className="p-4">Assinatura Digital</th>
                      <th className="p-4">Status SEFAZ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {[...(naoAssinadas?.nfe || []), ...(naoAssinadas?.nfce || [])].map((n: any) => (
                      <tr key={n.id} className="hover:bg-orange-50/30 transition">
                        <td className="p-4 font-bold text-slate-800">Nº {n.numero || '-'}</td>
                        <td className="p-4 font-mono text-xs text-slate-600">{n.chave}</td>
                        <td className="p-4 font-semibold text-slate-800">R$ {Number(n.valor || 0).toFixed(2)}</td>
                        <td className="p-4 text-slate-500">{n.data_emissao ? new Date(n.data_emissao).toLocaleDateString('pt-BR') : '-'}</td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 text-xs font-bold rounded-md ${n.tem_assinatura ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                            {n.tem_assinatura ? 'Assinada' : 'Sem Assinatura'}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="px-2 py-0.5 text-xs font-bold bg-orange-100 text-orange-800 rounded-md">
                            {n.motivo_sefaz || (n.cstat ? `cStat: ${n.cstat}` : 'Sem Protocolo')}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ABA 5: INUTILIZADAS */}
        {activeTab === 'inutilizadas' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-bold text-slate-900 mb-1 flex items-center gap-2">
                <CheckCircle2 className="text-slate-700" size={24} />
                Relatório de Numerações Inutilizadas na SEFAZ
              </h3>
              <p className="text-sm text-slate-500">
                Registro de faixas de numeração oficialmente inutilizadas e homologadas pelo Fisco.
              </p>
            </div>

            {(!inutilizadas?.total || inutilizadas.total === 0) ? (
              <div className="p-12 text-center bg-slate-50 rounded-2xl border border-slate-200">
                <p className="text-sm text-slate-500">Nenhuma numeração inutilizada registrada para esta competência.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      <th className="p-4">Número</th>
                      <th className="p-4">Protocolo / Chave</th>
                      <th className="p-4">Motivo SEFAZ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {[...(inutilizadas?.nfe || []), ...(inutilizadas?.nfce || [])].map((n: any) => (
                      <tr key={n.id}>
                        <td className="p-4 font-bold text-slate-800">Nº {n.numero}</td>
                        <td className="p-4 font-mono text-xs text-slate-600">{n.chave}</td>
                        <td className="p-4 text-slate-600">{n.motivo_sefaz || 'Inutilização Homologada'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ABA 6: CERTIFICADOS DIGITAIS A1 (A VENCER) */}
        {canViewCertificados && activeTab === 'certificados' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold text-slate-900">Relatório de Certificados Digitais A1</h3>
                  <span className="text-xs bg-amber-100 text-amber-800 font-bold px-2.5 py-0.5 rounded-full">
                    Alerta com 45 dias de antecedência
                  </span>
                </div>
                <p className="text-sm text-slate-500 mt-0.5">
                  Monitoramento proativo de validade dos certificados para evitar paralisação da emissão de notas fiscais.
                </p>
              </div>
            </div>

            {(() => {
              // Lista de clientes a exibir:
              // Se usuário for 'cliente', exibe apenas a sua empresa.
              // Se for 'contabilidade' ou 'admin', exibe todas as empresas acessíveis com os dados calculados de certificado.
              const clisCert = (userRole === 'cliente' 
                ? clientes.filter(c => c.id === selectedCliente) 
                : clientes
              ).map(c => {
                let dias = null
                let status: 'sem_certificado' | 'vencido' | 'alerta' | 'valido' = 'sem_certificado'
                let validadeFormatada = '—'

                if (c.certificado_validade) {
                  const dVal = new Date(c.certificado_validade)
                  dVal.setHours(0, 0, 0, 0)
                  const hojeMid = new Date()
                  hojeMid.setHours(0, 0, 0, 0)
                  dias = Math.ceil((dVal.getTime() - hojeMid.getTime()) / (1000 * 60 * 60 * 24))
                  validadeFormatada = new Date(c.certificado_validade + 'T00:00:00').toLocaleDateString('pt-BR')

                  if (dias < 0) {
                    status = 'vencido'
                  } else if (dias <= 45) {
                    status = 'alerta'
                  } else {
                    status = 'valido'
                  }
                }

                return {
                  ...c,
                  dias,
                  status,
                  validadeFormatada
                }
              })

              const totalAlerta = clisCert.filter(c => c.status === 'alerta').length
              const totalVencidos = clisCert.filter(c => c.status === 'vencido').length
              const totalValidos = clisCert.filter(c => c.status === 'valido').length
              const totalSemCert = clisCert.filter(c => c.status === 'sem_certificado').length

              return (
                <div className="space-y-6">
                  {/* Resumo Rápido */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl">
                      <div className="flex items-center justify-between text-amber-700 mb-1">
                        <span className="text-xs font-bold uppercase tracking-wider">A Vencer (≤ 45 Dias)</span>
                        <Clock size={18} />
                      </div>
                      <p className="text-3xl font-black text-amber-800">{totalAlerta}</p>
                      <p className="text-xs text-amber-600 mt-1">Requerem renovação imediata</p>
                    </div>

                    <div className="bg-red-50 border border-red-200 p-5 rounded-2xl">
                      <div className="flex items-center justify-between text-red-700 mb-1">
                        <span className="text-xs font-bold uppercase tracking-wider">Vencidos / Expirados</span>
                        <AlertTriangle size={18} />
                      </div>
                      <p className="text-3xl font-black text-red-800">{totalVencidos}</p>
                      <p className="text-xs text-red-600 mt-1">Emissão fiscal bloqueada</p>
                    </div>

                    <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-2xl">
                      <div className="flex items-center justify-between text-emerald-700 mb-1">
                        <span className="text-xs font-bold uppercase tracking-wider">Certificados Válidos</span>
                        <ShieldCheck size={18} />
                      </div>
                      <p className="text-3xl font-black text-emerald-800">{totalValidos}</p>
                      <p className="text-xs text-emerald-600 mt-1">Mais de 45 dias restantes</p>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl">
                      <div className="flex items-center justify-between text-slate-600 mb-1">
                        <span className="text-xs font-bold uppercase tracking-wider">Sem Certificado</span>
                        <KeyRound size={18} />
                      </div>
                      <p className="text-3xl font-black text-slate-800">{totalSemCert}</p>
                      <p className="text-xs text-slate-500 mt-1">Validade não informada</p>
                    </div>
                  </div>

                  {/* Tabela de Certificados */}
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                          <th className="p-4">Empresa</th>
                          <th className="p-4">CNPJ</th>
                          <th className="p-4">Contabilidade</th>
                          <th className="p-4">Data de Validade</th>
                          <th className="p-4">Dias Restantes</th>
                          <th className="p-4 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {clisCert.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-8 text-center text-slate-400">
                              Nenhuma empresa encontrada para exibição.
                            </td>
                          </tr>
                        ) : (
                          clisCert.map(c => (
                            <tr key={c.id} className="hover:bg-slate-50/80 transition">
                              <td className="p-4">
                                <div className="font-bold text-slate-900">{c.razao_social}</div>
                                {c.nome_fantasia && (
                                  <div className="text-xs text-slate-500">{c.nome_fantasia}</div>
                                )}
                              </td>
                              <td className="p-4 font-mono text-xs font-semibold text-slate-700">
                                {c.cnpj}
                              </td>
                              <td className="p-4 text-xs text-slate-600">
                                {c.contabilidade_nome || 'Não vinculada'}
                              </td>
                              <td className="p-4 font-medium text-slate-800">
                                {c.validadeFormatada}
                              </td>
                              <td className="p-4">
                                {c.dias !== null ? (
                                  <span className={`font-bold ${
                                    c.dias < 0 
                                      ? 'text-red-600' 
                                      : c.dias <= 45 
                                      ? 'text-amber-600' 
                                      : 'text-emerald-700'
                                  }`}>
                                    {c.dias < 0 ? `Expirado há ${Math.abs(c.dias)} dias` : `${c.dias} dias`}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                              <td className="p-4 text-center">
                                {c.status === 'vencido' && (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800">
                                    <AlertTriangle size={14} /> Vencido
                                  </span>
                                )}
                                {c.status === 'alerta' && (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 animate-pulse">
                                    <Clock size={14} /> A Vencer (≤ 45d)
                                  </span>
                                )}
                                {c.status === 'valido' && (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                                    <CheckCircle2 size={14} /> Regular
                                  </span>
                                )}
                                {c.status === 'sem_certificado' && (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                                    Não Informado
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                </div>
              )
            })()}
          </div>
        )}

      </div>

    </div>
  )
}
