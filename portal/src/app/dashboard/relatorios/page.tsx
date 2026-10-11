'use client'

import { useState, useEffect } from 'react'
import { 
  BarChart3, Download, RefreshCw, AlertTriangle, CheckCircle2, 
  FileText, Hash, ShieldAlert, Sparkles, Building2, Calendar, FileArchive
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
  const [activeTab, setActiveTab] = useState<'faturamento' | 'monofasicos' | 'quebra' | 'nao_assinadas' | 'inutilizadas'>('faturamento')

  // Dados da Auditoria
  const [auditData, setAuditData] = useState<any>(null)

  // Carrega clientes disponíveis para o usuário
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: roleData } = await supabase.from('user_roles').select('*').eq('user_id', user.id).single()

      if (roleData?.role === 'cliente' && roleData.cliente_id) {
        setSelectedCliente(roleData.cliente_id)
      } else if (roleData?.role === 'contabilidade' && roleData.contabilidade_id) {
        const { data: clis } = await supabase.from('clientes').select('id, razao_social, nome_fantasia').eq('contabilidade_id', roleData.contabilidade_id)
        if (clis && clis.length > 0) {
          setClientes(clis)
          setSelectedCliente(clis[0].id)
        }
      } else {
        // Admin: vê todos os clientes
        const { data: clis } = await supabase.from('clientes').select('id, razao_social, nome_fantasia').order('razao_social')
        if (clis && clis.length > 0) {
          setClientes(clis)
          setSelectedCliente(clis[0].id)
        }
      }

      setLoading(false)
    }
    init()
  }, [])

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
        
        {/* Seletor de Cliente */}
        {clientes.length > 0 && (
          <div className="flex-1 max-w-md">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              Empresa / Cliente
            </label>
            <select
              value={selectedCliente}
              onChange={e => setSelectedCliente(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            >
              {clientes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.razao_social} {c.nome_fantasia ? `(${c.nome_fantasia})` : ''}
                </option>
              ))}
            </select>
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

      </div>

    </div>
  )
}
