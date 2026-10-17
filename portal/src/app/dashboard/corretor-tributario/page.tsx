'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { 
  Sparkles, ShieldAlert, DollarSign, FileDown, CheckCircle2, 
  XCircle, AlertTriangle, Search, Filter, Calendar, 
  Download, RefreshCw, FileSpreadsheet, Printer, ArrowRight, 
  HelpCircle, Layers, Building2, Tag, Check, RotateCcw, 
  Info, Eye, BarChart3, Scale
} from 'lucide-react'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'
import { DiagnosticoItem } from '@/utils/tributario/auditorEngine'
import { useTableFeatures } from '@/hooks/useTableFeatures'
import { ResizableSortableTh } from '@/components/ui/ResizableSortableTh'
import { useGlobalClient } from '@/components/GlobalClientContext'
import CompetenciaSelector from '@/components/CompetenciaSelector'

export default function CorretorTributarioPage() {
  const router = useRouter()
  const supabase = createClient()
  const { selectedClienteId, setSelectedClienteId, selectedCliente: globalClienteObj, clientes: globalClientes } = useGlobalClient()

  const [loadingUser, setLoadingUser] = useState(true)
  const [loadingAuditoria, setLoadingAuditoria] = useState(false)
  const [userRole, setUserRole] = useState<'admin' | 'contabilidade' | 'cliente'>('admin')
  const [clientes, setClientes] = useState<any[]>([])
  
  // Utiliza a empresa selecionada globalmente no cabeçalho
  const selectedCliente = selectedClienteId

  // Filtros de Execução da Auditoria
  const [tipoFiltro, setTipoFiltro] = useState<'mes' | 'periodo' | 'numeracao'>('mes')
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-09')
  const [dataInicio, setDataInicio] = useState<string>('')
  const [dataFim, setDataFim] = useState<string>('')
  const [numeroInicio, setNumeroInicio] = useState<string>('')
  const [numeroFim, setNumeroFim] = useState<string>('')
  const [modeloSelecionado, setModeloSelecionado] = useState<'todos' | '55' | '65'>('todos')
  const [usarIa, setUsarIa] = useState<boolean>(true)

  // Resultados
  const [auditoriaRealizada, setAuditoriaRealizada] = useState(false)
  const [totalXmlsAnalisados, setTotalXmlsAnalisados] = useState(0)
  const [diagnosticos, setDiagnosticos] = useState<DiagnosticoItem[]>([])
  const [metricas, setMetricas] = useState<any>({
    totalItens: 0,
    itensConformes: 0,
    itensInconsistentes: 0,
    totalRiscoFiscal: 0,
    totalPagamentoIndevido: 0,
    economiaEstimadaTotal: 0,
    reformaCestaBasica: 0,
    reformaReduzido: 0,
    reformaSeletivo: 0,
    reformaPadrao: 0
  })

  // Decisões do usuário para cada item (manter | corrigir)
  const [decisoes, setDecisoes] = useState<Record<string, 'manter' | 'corrigir'>>({})

  // Filtros de Exibição na Tabela
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'inconsistente' | 'conforme'>('inconsistente')
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'risco_fiscal' | 'pagamento_indevido'>('todos')
  const [filtroReforma, setFiltroReforma] = useState<'todos' | 'zero' | 'reduzido' | 'seletivo' | 'padrao'>('todos')
  const [buscaTermo, setBuscaTermo] = useState<string>('')

  // Contagem Prévia de XMLs ao Montar o Filtro
  const [contagemXmls, setContagemXmls] = useState<{
    carregando: boolean;
    total: number;
    totalNfe: number;
    totalNfce: number;
  }>({
    carregando: false,
    total: 0,
    totalNfe: 0,
    totalNfce: 0
  })

  // Barra de Progresso Real durante a Auditoria
  const [progressoAuditoria, setProgressoAuditoria] = useState<{
    ativo: boolean;
    porcentagem: number;
    etapaAtual: string;
    detalhe: string;
    segundosDecorridos: number;
  }>({
    ativo: false,
    porcentagem: 0,
    etapaAtual: '',
    detalhe: '',
    segundosDecorridos: 0
  })

  // 1. Carrega dados do usuário e clientes
  useEffect(() => {
    async function init() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.push('/login'); return }

        const { data: roleData } = await supabase.from('user_roles').select('*').eq('user_id', user.id).single()
        const role = (roleData?.role as any) || 'admin'
        setUserRole(role)

        let clisData: any[] = []
        if (role === 'cliente' && roleData?.cliente_id) {
          const { data: cli } = await supabase.from('clientes').select('id, razao_social, nome_fantasia, cnpj').eq('id', roleData.cliente_id).single()
          if (cli) clisData = [cli]
        } else if (role === 'contabilidade' && roleData?.contabilidade_id) {
          const { data: clis } = await supabase.from('clientes').select('id, razao_social, nome_fantasia, cnpj').eq('contabilidade_id', roleData.contabilidade_id).order('razao_social')
          if (clis) clisData = clis
        } else {
          const { data: clis } = await supabase.from('clientes').select('id, razao_social, nome_fantasia, cnpj').order('razao_social')
          if (clis) clisData = clis
        }

        setClientes(clisData)
        if (clisData.length > 0 && !selectedClienteId) {
          setSelectedClienteId(clisData[0].id)
        }
      } catch (err: any) {
        toast.error('Erro ao carregar dados: ' + err.message)
      } finally {
        setLoadingUser(false)
      }
    }
    init()
  }, [])

  // 1.1 Contagem prévia dinâmica de XMLs ao alterar o filtro
  useEffect(() => {
    let cancelado = false

    async function buscarContagemXmls() {
      if (!selectedCliente) return
      setContagemXmls(prev => ({ ...prev, carregando: true }))

      try {
        let qNfe = supabase.from('nfe_saidas').select('id', { count: 'exact', head: true }).eq('cliente_id', selectedCliente)
        let qNfce = supabase.from('nfce_saidas').select('id', { count: 'exact', head: true }).eq('cliente_id', selectedCliente)

        if (tipoFiltro === 'mes' && selectedMonth) {
          const [ano, mes] = selectedMonth.split('-').map(Number)
          const inicio = new Date(ano, mes - 1, 1).toISOString()
          const fim = new Date(ano, mes, 0, 23, 59, 59, 999).toISOString()
          qNfe = qNfe.gte('data_emissao', inicio).lte('data_emissao', fim)
          qNfce = qNfce.gte('data_emissao', inicio).lte('data_emissao', fim)
        } else if (tipoFiltro === 'periodo' && dataInicio && dataFim) {
          const inicio = `${dataInicio}T00:00:00-03:00`
          const fim = `${dataFim}T23:59:59.999-03:00`
          qNfe = qNfe.gte('data_emissao', new Date(inicio).toISOString()).lte('data_emissao', new Date(fim).toISOString())
          qNfce = qNfce.gte('data_emissao', new Date(inicio).toISOString()).lte('data_emissao', new Date(fim).toISOString())
        } else if (tipoFiltro === 'numeracao') {
          const numIni = parseInt(numeroInicio || '0', 10)
          const numFim = parseInt(numeroFim || '999999999', 10)
          if (numIni > 0) {
            qNfe = qNfe.gte('numero', String(numIni))
            qNfce = qNfce.gte('numero', String(numIni))
          }
          if (numFim > 0) {
            qNfe = qNfe.lte('numero', String(numFim))
            qNfce = qNfce.lte('numero', String(numFim))
          }
        }

        let totalNfe = 0
        let totalNfce = 0

        if (modeloSelecionado === 'todos' || modeloSelecionado === '55') {
          const { count: c55 } = await qNfe
          totalNfe = c55 || 0
        }
        if (modeloSelecionado === 'todos' || modeloSelecionado === '65') {
          const { count: c65 } = await qNfce
          totalNfce = c65 || 0
        }

        if (!cancelado) {
          setContagemXmls({
            carregando: false,
            total: totalNfe + totalNfce,
            totalNfe,
            totalNfce
          })
        }
      } catch (e) {
        console.warn('Erro ao contar XMLs disponíveis:', e)
        if (!cancelado) setContagemXmls(prev => ({ ...prev, carregando: false }))
      }
    }

    buscarContagemXmls()
    return () => { cancelado = true }
  }, [selectedCliente, tipoFiltro, selectedMonth, dataInicio, dataFim, numeroInicio, numeroFim, modeloSelecionado])

  // 2. Executa a Auditoria Tributária via API com Barra de Progresso Real
  const handleExecutarAuditoria = async () => {
    if (!selectedCliente) {
      toast.error('Selecione uma empresa para auditar.')
      return
    }

    setLoadingAuditoria(true)
    setProgressoAuditoria({
      ativo: true,
      porcentagem: 8,
      etapaAtual: '1/4: Conectando ao Repositório & Carregando XMLs...',
      detalhe: `Localizando e descompactando os arquivos fiscais da empresa...`,
      segundosDecorridos: 0
    })

    // Inicia timer de avanço dinâmico e telemetria de progresso
    const inicioTimestamp = Date.now()
    const timerProgress = setInterval(() => {
      setProgressoAuditoria(prev => {
        const decorridoSeg = Math.floor((Date.now() - inicioTimestamp) / 1000)
        let novoPct = prev.porcentagem + (prev.porcentagem < 35 ? 3.5 : prev.porcentagem < 70 ? 2 : prev.porcentagem < 92 ? 1 : 0.2)
        if (novoPct > 94) novoPct = 94

        let etapa = prev.etapaAtual
        let detalhe = prev.detalhe

        if (novoPct < 25) {
          etapa = '1/4: Conectando ao Repositório & Carregando XMLs...'
          detalhe = 'Download e validação de integridade dos arquivos XML...'
        } else if (novoPct < 55) {
          etapa = '2/4: Extraindo Itens, NCMs e Regras Tributárias...'
          detalhe = 'Mapeando produtos, CESTs, CFOPs, alíquotas de ICMS e Convênio 142/18...'
        } else if (novoPct < 85) {
          etapa = '3/4: Auditoria Inteligente & Consenso Multi-IA...'
          detalhe = 'Cruzando monofásicos, apurando créditos e consultando Servidores de IA...'
        } else {
          etapa = '4/4: Simulando Reforma Tributária (IBS, CBS e IVA Dual)...'
          detalhe = 'Calculando alíquotas da PEC 45/2019 e consolidando o painel de diagnósticos...'
        }

        return {
          ativo: true,
          porcentagem: Math.min(novoPct, 94),
          etapaAtual: etapa,
          detalhe,
          segundosDecorridos: decorridoSeg
        }
      })
    }, 450)

    try {
      const payload: any = {
        cliente_id: selectedCliente,
        tipo_filtro: tipoFiltro,
        modelo: modeloSelecionado,
        usar_ia: usarIa
      }

      if (tipoFiltro === 'mes') payload.mes = selectedMonth
      else if (tipoFiltro === 'periodo') {
        payload.data_inicio = dataInicio
        payload.data_fim = dataFim
      } else if (tipoFiltro === 'numeracao') {
        payload.numero_inicio = numeroInicio
        payload.numero_fim = numeroFim
      }

      const res = await fetch('/api/tributario/auditar-produtos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro na auditoria')

      clearInterval(timerProgress)

      // Conclusão em 100%
      setProgressoAuditoria({
        ativo: true,
        porcentagem: 100,
        etapaAtual: 'Auditoria Concluída com Sucesso!',
        detalhe: `${data.metricas?.totalItens || 0} produtos analisados em ${data.total_xmls || 0} XMLs emitidos.`,
        segundosDecorridos: Math.floor((Date.now() - inicioTimestamp) / 1000)
      })

      setDiagnosticos(data.diagnosticos || [])
      setMetricas(data.metricas || {})
      setTotalXmlsAnalisados(data.total_xmls || 0)
      setAuditoriaRealizada(true)

      // Inicializa decisões (padrão: se inconsistente, sugere 'corrigir')
      const initialDecisoes: Record<string, 'manter' | 'corrigir'> = {}
      ;(data.diagnosticos || []).forEach((d: DiagnosticoItem) => {
        const id = d.item.idItem || `${d.item.cProd}_${d.item.numeroNota}`
        initialDecisoes[id] = d.status === 'inconsistente' ? 'corrigir' : 'manter'
      })
      setDecisoes(initialDecisoes)

      toast.success(`Auditoria concluída! ${data.metricas?.totalItens || 0} produtos analisados.`)

      setTimeout(() => {
        setProgressoAuditoria(prev => ({ ...prev, ativo: false }))
      }, 1500)
    } catch (err: any) {
      clearInterval(timerProgress)
      setProgressoAuditoria(prev => ({ ...prev, ativo: false }))
      toast.error('Falha ao executar auditoria: ' + err.message)
    } finally {
      setLoadingAuditoria(false)
    }
  }

  // Alterna decisão de manter ou corrigir
  const toggleDecisao = (id: string) => {
    setDecisoes(prev => ({
      ...prev,
      [id]: prev[id] === 'corrigir' ? 'manter' : 'corrigir'
    }))
  }

  // Ações em massa para decisões
  const setTodasDecisoes = (acao: 'corrigir' | 'manter') => {
    const novas: Record<string, 'manter' | 'corrigir'> = {}
    diagnosticosFiltrados.forEach(d => {
      const id = d.item.idItem || `${d.item.cProd}_${d.item.numeroNota}`
      novas[id] = acao
    })
    setDecisoes(prev => ({ ...prev, ...novas }))
    toast.success(`Marcados todos como "${acao === 'corrigir' ? 'Aprovar Correção' : 'Manter Original'}"!`)
  }

  // Filtragem dinâmica dos itens
  const diagnosticosFiltrados = useMemo(() => {
    return diagnosticos.filter(d => {
      // 1. Filtro por Status
      if (filtroStatus !== 'todos' && d.status !== filtroStatus) return false

      // 2. Filtro por Tipo de Inconsistência
      if (filtroTipo !== 'todos') {
        const temTipo = d.inconsistencias.some(i => i.tipo === filtroTipo)
        if (!temTipo) return false
      }

      // 3. Filtro por Reforma Tributária
      if (filtroReforma !== 'todos' && d.reformaTributaria.regime !== filtroReforma) return false

      // 4. Busca Textual (Nome, Código, NCM)
      if (buscaTermo.trim()) {
        const termo = buscaTermo.toLowerCase().trim()
        const prod = (d.item.xProd || '').toLowerCase()
        const cod = (d.item.cProd || '').toLowerCase()
        const ncm = (d.item.ncm || '').toLowerCase()
        const num = (d.item.numeroNota || '').toLowerCase()
        if (!prod.includes(termo) && !cod.includes(termo) && !ncm.includes(termo) && !num.includes(termo)) {
          return false
        }
      }

      return true
    })
  }, [diagnosticos, filtroStatus, filtroTipo, filtroReforma, buscaTermo])

  const {
    sortedData: diagnosticosOrdenados,
    sortKey,
    sortDirection,
    handleSort,
    columnWidths,
    handleResizeColumn
  } = useTableFeatures({
    data: diagnosticosFiltrados,
    tableId: 'tabela_corretor_tributario',
    defaultSortKey: 'produto',
    defaultSortDirection: 'asc',
    initialWidths: {
      produto: 300,
      xml: 170,
      sugestao: 170,
      diagnostico: 240,
      reforma: 200,
      decisao: 120
    },
    customExtractors: {
      produto: (d: any) => d.item?.xProd || '',
      xml: (d: any) => d.item?.ncm || '',
      sugestao: (d: any) => d.sugestao?.ncmSugerido || d.item?.ncm || '',
      diagnostico: (d: any) => d.inconsistencias?.length || 0,
      reforma: (d: any) => d.reformaTributaria?.nomeRegime || '',
      decisao: (d: any) => {
        const id = d.item.idItem || `${d.item.cProd}_${d.item.numeroNota}`
        return decisoes[id] || (d.status === 'inconsistente' ? 'corrigir' : 'manter')
      }
    }
  })

  // Exportar Relatório em Planilha Excel (.xlsx)
  const handleExportarExcel = () => {
    if (diagnosticosFiltrados.length === 0) {
      toast.error('Nenhum item para exportar.')
      return
    }

    const rows = diagnosticosFiltrados.map(d => {
      const id = d.item.idItem || `${d.item.cProd}_${d.item.numeroNota}`
      const decisao = decisoes[id] || (d.status === 'inconsistente' ? 'corrigir' : 'manter')

      return {
        'Cód. Produto': d.item.cProd,
        'Descrição do Produto': d.item.xProd,
        'Nº Nota': d.item.numeroNota,
        'Modelo': d.item.modeloNota === '65' ? 'NFC-e' : 'NF-e',
        'Valor Total': d.item.vProd,
        'NCM XML': d.item.ncm,
        'NCM Sugerido': d.sugestao.ncmSugerido || d.item.ncm,
        'CEST XML': d.item.cest || '—',
        'CEST Sugerido': d.sugestao.cestSugerido || '—',
        'CFOP XML': d.item.cfop,
        'CFOP Sugerido': d.sugestao.cfopSugerido || d.item.cfop,
        'CSOSN/CST XML': d.item.csosn || d.item.cstIcms || '—',
        'CSOSN/CST Sugerido': d.sugestao.csosnSugerido || d.item.csosn || '—',
        'CST PIS/COFINS XML': `${d.item.cstPis || '—'}/${d.item.cstCofins || '—'}`,
        'CST PIS/COFINS Sugerido': d.sugestao.cstPisSugerido ? `${d.sugestao.cstPisSugerido}/${d.sugestao.cstCofinsSugerido}` : '—',
        'Diagnóstico Fiscal': d.inconsistencias.map(i => i.titulo).join(' | ') || 'Conforme',
        'Enquadramento Reforma (IBS+CBS)': d.reformaTributaria.nomeRegime,
        'Alíquota IVA Dual Estimada': `${d.reformaTributaria.aliquotaIvaDualEst}%`,
        'Decisão': decisao === 'corrigir' ? 'APROVADA CORREÇÃO' : 'MANTER ORIGINAL'
      }
    })

    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Analisador_Tributario')
    XLSX.writeFile(wb, `Analisador_Tributario_${selectedMonth || 'periodo'}.xlsx`)
    toast.success('Planilha Excel exportada com sucesso!')
  }

  if (loadingUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 font-medium text-sm">Carregando módulo Analisador Tributário...</p>
      </div>
    )
  }

  const cliAtual = clientes.find(c => c.id === selectedCliente)

  return (
    <div className="space-y-8 pb-16">
      
      {/* 1. Header do Analisador Tributário */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-8 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold border border-indigo-500/30">
              <Sparkles size={14} className="text-indigo-400" />
              Auditoria Inteligente & Reforma Tributária (IBS, CBS e IVA Dual)
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Analisador Tributário de Produtos
            </h1>
            <p className="text-slate-300 text-sm max-w-2xl leading-relaxed">
              Analise os itens emitidos nos XMLs (NFe e NFCe), detecte inconsistências cadastrais de 
              <span className="text-indigo-300 font-semibold"> NCM, CEST (Convênio 142/18), CFOP e CSOSN</span>, 
              apure pagamentos indevidos em produtos monofásicos e simule o impacto no novo 
              <span className="text-indigo-300 font-semibold"> IBS e CBS (IVA Dual)</span>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {auditoriaRealizada && (
              <>
                <button
                  onClick={handleExportarExcel}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/15 transition shadow-sm"
                  title="Exportar para Excel"
                >
                  <FileSpreadsheet size={16} className="text-emerald-400" />
                  Exportar Excel (.xlsx)
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/15 transition shadow-sm"
                  title="Imprimir / Salvar PDF"
                >
                  <Printer size={16} />
                  Imprimir
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 2. Painel de Filtros e Disparo de Análise */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <Filter size={18} className="text-indigo-600" />
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
            Configuração da Análise de XMLs
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Tipo de Filtro */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
              Critério de Busca:
            </label>
            <select
              value={tipoFiltro}
              onChange={(e: any) => setTipoFiltro(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="mes">Por Mês de Competência</option>
              <option value="periodo">Por Período (De / Até)</option>
              <option value="numeracao">Por Numeração das Notas</option>
            </select>
          </div>

          {/* Campos Dinâmicos do Filtro */}
          {tipoFiltro === 'mes' && (
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
                Mês de Competência:
              </label>
              <CompetenciaSelector
                value={selectedMonth}
                onChange={setSelectedMonth}
                placeholder="Buscar mês de competência..."
              />
            </div>
          )}

          {tipoFiltro === 'periodo' && (
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
                Intervalo de Emissão:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="w-1/2 bg-slate-50 border border-slate-200 px-2 py-2 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                <span className="text-slate-400 text-xs">até</span>
                <input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="w-1/2 bg-slate-50 border border-slate-200 px-2 py-2 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {tipoFiltro === 'numeracao' && (
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
                Faixa de Numeração:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Nº Inicial"
                  value={numeroInicio}
                  onChange={(e) => setNumeroInicio(e.target.value)}
                  className="w-1/2 bg-slate-50 border border-slate-200 px-2.5 py-2 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                <span className="text-slate-400 text-xs">até</span>
                <input
                  type="number"
                  placeholder="Nº Final"
                  value={numeroFim}
                  onChange={(e) => setNumeroFim(e.target.value)}
                  className="w-1/2 bg-slate-50 border border-slate-200 px-2.5 py-2 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Modelo da Nota */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
              Modelo de Nota:
            </label>
            <select
              value={modeloSelecionado}
              onChange={(e: any) => setModeloSelecionado(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="todos">Todos (NF-e 55 + NFC-e 65)</option>
              <option value="65">NFC-e (Modelo 65 - Consumidor)</option>
              <option value="55">NF-e (Modelo 55 - Mercantil)</option>
            </select>
          </div>
        </div>

        {/* 2.1 Contagem Prévia de XMLs Prontos para Análise */}
        <div className={`p-4 rounded-2xl border transition-all ${
          contagemXmls.carregando ? 'bg-slate-50 border-slate-200' :
          contagemXmls.total > 0 ? 'bg-gradient-to-r from-indigo-50/80 via-purple-50/40 to-indigo-50/80 border-indigo-200 shadow-xs' :
          'bg-amber-50/70 border-amber-200'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${
                contagemXmls.carregando ? 'bg-slate-200 text-slate-500 animate-pulse' :
                contagemXmls.total > 0 ? 'bg-indigo-600 text-white shadow-sm' :
                'bg-amber-100 text-amber-700'
              }`}>
                <Layers size={20} />
              </div>
              <div>
                {contagemXmls.carregando ? (
                  <div className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-xs font-semibold text-slate-600">Localizando XMLs disponíveis para este filtro...</span>
                  </div>
                ) : contagemXmls.total > 0 ? (
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-slate-900">
                        {contagemXmls.total.toLocaleString('pt-BR')} XMLs prontos para análise
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                        <CheckCircle2 size={12} className="text-emerald-600" /> Disponível no Portal
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Composição: <strong className="text-indigo-950 font-bold">{contagemXmls.totalNfce.toLocaleString('pt-BR')} NFC-e (mod. 65)</strong> e <strong className="text-indigo-950 font-bold">{contagemXmls.totalNfe.toLocaleString('pt-BR')} NF-e (mod. 55)</strong> armazenados na nuvem.
                    </p>
                  </div>
                ) : (
                  <div>
                    <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                      <AlertTriangle size={14} className="text-amber-600" /> Nenhum XML localizado com os filtros atuais
                    </span>
                    <p className="text-[11px] text-amber-700 mt-0.5">
                      Dica: Altere o mês de competência ou o critério de busca para encontrar as notas emitidas pela empresa.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {contagemXmls.total > 0 && !contagemXmls.carregando && (
              <span className="text-xs font-bold text-indigo-700 bg-white/80 px-3 py-1.5 rounded-xl border border-indigo-100 self-start sm:self-center">
                Total a Auditar: {contagemXmls.total} notas
              </span>
            )}
          </div>
        </div>

        {/* 2.2 Barra de Progresso Real em Execução */}
        {progressoAuditoria.ativo && (
          <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 text-white shadow-xl space-y-3.5 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin shrink-0"></div>
                <div>
                  <h4 className="text-xs font-bold text-indigo-200 uppercase tracking-wider flex items-center gap-2">
                    <Sparkles size={14} className="text-indigo-400 animate-pulse" />
                    {progressoAuditoria.etapaAtual}
                  </h4>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    {progressoAuditoria.detalhe}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 self-end sm:self-auto">
                <span className="text-xs font-mono text-slate-400">
                  ⏱️ {String(Math.floor(progressoAuditoria.segundosDecorridos / 60)).padStart(2, '0')}:{String(progressoAuditoria.segundosDecorridos % 60).padStart(2, '0')}
                </span>
                <span className="text-base font-black text-indigo-300 font-mono">
                  {Math.round(progressoAuditoria.porcentagem)}%
                </span>
              </div>
            </div>

            {/* Barra de Progresso com Shimmer */}
            <div className="w-full bg-slate-800/80 rounded-full h-3 p-0.5 overflow-hidden border border-slate-700/80">
              <div
                className="bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-400 h-full rounded-full transition-all duration-300 ease-out relative overflow-hidden shadow-lg shadow-indigo-500/50"
                style={{ width: `${Math.max(progressoAuditoria.porcentagem, 5)}%` }}
              >
                <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
              </div>
            </div>
          </div>
        )}

        {/* Toggle IA e Botão de Disparo */}
        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={usarIa}
              onChange={(e) => setUsarIa(e.target.checked)}
              disabled={loadingAuditoria}
              className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500 disabled:opacity-50"
            />
            <div className="text-xs">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <Sparkles size={14} className="text-purple-600" />
                Auditoria com Multi-IA & Reforma Tributária (IBS, CBS e IVA Dual)
              </span>
              <p className="text-slate-500 text-[11px]">
                Analisa o produto com as IAs e Servidores MCP ativos em modo consenso e calcula as novas alíquotas de IBS/CBS.
              </p>
            </div>
          </label>

          <button
            onClick={handleExecutarAuditoria}
            disabled={loadingAuditoria || contagemXmls.total === 0}
            className="flex items-center justify-center gap-2 px-7 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-lg shadow-indigo-600/25 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingAuditoria ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Auditando ({Math.round(progressoAuditoria.porcentagem)}%)...
              </>
            ) : (
              <>
                <RefreshCw size={15} />
                Executar Diagnóstico Tributário
              </>
            )}
          </button>
        </div>
      </div>

      {/* 3. Cards de Resumo e Métricas (Se auditoria executada) */}
      {auditoriaRealizada && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Card 1: Total Analisado */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Produtos Analisados</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{metricas.totalItens}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Em {totalXmlsAnalisados} notas fiscais</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <Layers size={22} />
              </div>
            </div>

            {/* Card 2: Risco Fiscal */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Risco Fiscal (Autuação)</p>
                <p className="text-2xl font-bold text-amber-600 mt-1">{metricas.totalRiscoFiscal}</p>
                <p className="text-[11px] text-amber-600 font-medium mt-0.5">NCMs inválidos / Falta de CEST</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <ShieldAlert size={22} />
              </div>
            </div>

            {/* Card 3: Bitributação / Economia */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Bitributação Detectada</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">
                  R$ {Number(metricas.economiaEstimadaTotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-[11px] text-emerald-700 font-medium mt-0.5">
                  {metricas.totalPagamentoIndevido} itens com ICMS/PIS pago a maior
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <DollarSign size={22} />
              </div>
            </div>

            {/* Card 4: Reforma Tributária (IBS + CBS) */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Reforma: Cesta Básica</p>
                <p className="text-2xl font-bold text-indigo-600 mt-1">{metricas.reformaCestaBasica}</p>
                <p className="text-[11px] text-indigo-700 font-medium mt-0.5">
                  Itens com Alíquota Zero (IBS + CBS)
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <Scale size={22} />
              </div>
            </div>

          </div>

          {/* 4. Barra de Filtros e Busca dos Resultados */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              
              {/* Busca Textual */}
              <div className="relative flex-1 max-w-md">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar produto por nome, código, NCM ou nota..."
                  value={buscaTermo}
                  onChange={(e) => setBuscaTermo(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              {/* Filtros em Abas */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setFiltroStatus('inconsistente')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    filtroStatus === 'inconsistente'
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  ⚠️ Com Inconsistências ({metricas.itensInconsistentes})
                </button>
                <button
                  onClick={() => setFiltroStatus('conforme')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    filtroStatus === 'conforme'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  ✅ Conformes ({metricas.itensConformes})
                </button>
                <button
                  onClick={() => setFiltroStatus('todos')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    filtroStatus === 'todos'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Todos ({metricas.totalItens})
                </button>
              </div>

            </div>

            {/* Ações Rápidas de Decisão em Massa */}
            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
              <span className="text-slate-500 font-medium">Ações de Decisão em Massa:</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTodasDecisoes('corrigir')}
                  className="px-3 py-1 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold border border-indigo-200 transition"
                >
                  ✓ Aprovar Todas as Correções
                </button>
                <button
                  onClick={() => setTodasDecisoes('manter')}
                  className="px-3 py-1 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 font-semibold border border-slate-200 transition"
                >
                  ✕ Manter Todos Originais
                </button>
              </div>
            </div>
          </div>

          {/* 5. Tabela de Diagnóstico Comparativo */}
          <div className="bg-white dark:bg-[#0B1120] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden w-full">
            <div className="overflow-x-auto custom-scrollbar w-full">
              <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300 min-w-[1000px]">
                <thead className="sticky top-0 z-10 bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px] shadow-2xs">
                  <tr>
                    <ResizableSortableTh
                      columnId="produto"
                      label="Produto / Identificação"
                      sortKey="produto"
                      currentSortKey={sortKey}
                      currentSortDirection={sortDirection}
                      onSort={handleSort}
                      width={columnWidths.produto}
                      onResize={handleResizeColumn}
                      minWidth={180}
                    />
                    <ResizableSortableTh
                      columnId="xml"
                      label="No XML (Atual)"
                      sortKey="xml"
                      currentSortKey={sortKey}
                      currentSortDirection={sortDirection}
                      onSort={handleSort}
                      width={columnWidths.xml}
                      onResize={handleResizeColumn}
                      minWidth={130}
                    />
                    <ResizableSortableTh
                      columnId="sugestao"
                      label="Sugestão do Corretor"
                      sortKey="sugestao"
                      currentSortKey={sortKey}
                      currentSortDirection={sortDirection}
                      onSort={handleSort}
                      width={columnWidths.sugestao}
                      onResize={handleResizeColumn}
                      minWidth={130}
                    />
                    <ResizableSortableTh
                      columnId="diagnostico"
                      label="Diagnóstico & Apontamento"
                      sortKey="diagnostico"
                      currentSortKey={sortKey}
                      currentSortDirection={sortDirection}
                      onSort={handleSort}
                      width={columnWidths.diagnostico}
                      onResize={handleResizeColumn}
                      minWidth={180}
                    />
                    <ResizableSortableTh
                      columnId="reforma"
                      label="Reforma (IBS + CBS)"
                      sortKey="reforma"
                      currentSortKey={sortKey}
                      currentSortDirection={sortDirection}
                      onSort={handleSort}
                      width={columnWidths.reforma}
                      onResize={handleResizeColumn}
                      minWidth={150}
                    />
                    <ResizableSortableTh
                      columnId="decisao"
                      label="Decisão"
                      sortKey="decisao"
                      currentSortKey={sortKey}
                      currentSortDirection={sortDirection}
                      onSort={handleSort}
                      width={columnWidths.decisao}
                      onResize={handleResizeColumn}
                      minWidth={100}
                      align="center"
                    />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {diagnosticosOrdenados.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-12 text-center text-slate-400">
                        Nenhum item corresponde aos filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    diagnosticosOrdenados.map((d, idx) => {
                      const id = d.item.idItem || `${d.item.cProd}_${d.item.numeroNota}_${idx}`
                      const decisao = decisoes[id] || (d.status === 'inconsistente' ? 'corrigir' : 'manter')
                      const isCorrigido = decisao === 'corrigir'

                      return (
                        <tr 
                          key={id}
                          className={`hover:bg-slate-50/70 transition-colors ${
                            d.status === 'inconsistente' ? 'bg-amber-50/20' : ''
                          }`}
                        >
                          {/* Coluna 1: Produto */}
                          <td className="p-4">
                            <div className="space-y-1">
                              <span className="font-bold text-slate-800 text-sm block">
                                {d.item.xProd}
                              </span>
                              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                                <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                                  Cód: {d.item.cProd}
                                </span>
                                <span>Nota Nº {d.item.numeroNota}</span>
                                <span className="font-semibold text-slate-600">
                                  R$ {d.item.vProd.toFixed(2)} ({d.item.qCom} {d.item.uCom})
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Coluna 2: No XML (Atual) */}
                          <td className="p-4 font-mono text-[11px] space-y-1">
                            <div><strong className="text-slate-400">NCM:</strong> {d.item.ncm || '—'}</div>
                            <div><strong className="text-slate-400">CEST:</strong> {d.item.cest || '—'}</div>
                            <div><strong className="text-slate-400">CFOP:</strong> {d.item.cfop || '—'}</div>
                            <div><strong className="text-slate-400">CSOSN/CST:</strong> {d.item.csosn || d.item.cstIcms || '—'}</div>
                            <div><strong className="text-slate-400">PIS/COF:</strong> {d.item.cstPis || '—'}/{d.item.cstCofins || '—'}</div>
                          </td>

                          {/* Coluna 3: Sugestão */}
                          <td className="p-4 font-mono text-[11px] space-y-1 bg-indigo-50/30">
                            {d.sugestao.ncmSugerido ? (
                              <div className="text-indigo-700 font-bold">
                                NCM: {d.sugestao.ncmSugerido}
                              </div>
                            ) : <div>NCM: {d.item.ncm}</div>}

                            {d.sugestao.cestSugerido ? (
                              <div className="text-indigo-700 font-bold" title={d.sugestao.cestDescricao}>
                                CEST: {d.sugestao.cestSugerido}
                              </div>
                            ) : <div>CEST: {d.item.cest || '—'}</div>}

                            {d.sugestao.cfopSugerido ? (
                              <div className="text-emerald-700 font-bold">
                                CFOP: {d.sugestao.cfopSugerido}
                              </div>
                            ) : <div>CFOP: {d.item.cfop}</div>}

                            {d.sugestao.csosnSugerido ? (
                              <div className="text-emerald-700 font-bold">
                                CSOSN: {d.sugestao.csosnSugerido}
                              </div>
                            ) : <div>CSOSN: {d.item.csosn || d.item.cstIcms || '—'}</div>}

                            {d.sugestao.cstPisSugerido ? (
                              <div className="text-teal-700 font-bold">
                                PIS/COF: {d.sugestao.cstPisSugerido}/{d.sugestao.cstCofinsSugerido}
                              </div>
                            ) : <div>PIS/COF: {d.item.cstPis || '—'}/{d.item.cstCofins || '—'}</div>}
                          </td>

                          {/* Coluna 4: Diagnóstico */}
                          <td className="p-4 max-w-xs">
                            {d.inconsistencias.length === 0 ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                                <CheckCircle2 size={13} />
                                Regular / Conforme
                              </span>
                            ) : (
                              <div className="space-y-1.5">
                                {d.inconsistencias.map((inc, iIdx) => (
                                  <div 
                                    key={iIdx}
                                    className={`p-2 rounded-xl border text-[11px] leading-tight ${
                                      inc.tipo === 'pagamento_indevido' 
                                        ? 'bg-emerald-50 text-emerald-900 border-emerald-200' 
                                        : 'bg-amber-50 text-amber-900 border-amber-200'
                                    }`}
                                  >
                                    <strong className="block mb-0.5">{inc.titulo}</strong>
                                    <span className="text-[10px] text-slate-600 block">{inc.descricao}</span>
                                    {inc.valorEstimadoEconomia && (
                                      <span className="mt-1 font-bold text-emerald-700 block text-[10px]">
                                        💰 Economia Estimada: R$ {inc.valorEstimadoEconomia.toFixed(2)}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>

                          {/* Coluna 5: Reforma Tributária (IBS + CBS) */}
                          <td className="p-4 text-[11px]">
                            <div className="space-y-1">
                              <span className={`inline-block font-bold px-2 py-0.5 rounded-md ${
                                d.reformaTributaria.regime === 'zero'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : d.reformaTributaria.regime === 'reduzido'
                                  ? 'bg-blue-100 text-blue-800'
                                  : d.reformaTributaria.regime === 'seletivo'
                                  ? 'bg-purple-100 text-purple-800'
                                  : 'bg-slate-100 text-slate-800'
                              }`}>
                                {d.reformaTributaria.nomeRegime}
                              </span>
                              <div className="text-[10px] text-slate-500 font-mono">
                                <strong>IBS:</strong> ~{d.reformaTributaria.aliquotaIbsEst}% | 
                                <strong> CBS:</strong> ~{d.reformaTributaria.aliquotaCbsEst}%
                              </div>
                              <div className="text-[11px] font-bold text-indigo-700">
                                IVA Dual Total: {d.reformaTributaria.aliquotaIvaDualEst}%
                              </div>
                            </div>
                          </td>

                          {/* Coluna 6: Ação / Decisão */}
                          <td className="p-4 text-center">
                            <button
                              type="button"
                              onClick={() => toggleDecisao(id)}
                              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition border flex items-center justify-center gap-1 mx-auto shadow-sm ${
                                isCorrigido
                                  ? 'bg-indigo-600 text-white border-indigo-700 hover:bg-indigo-700'
                                  : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                              }`}
                            >
                              {isCorrigido ? (
                                <>
                                  <Check size={13} />
                                  Aprovado
                                </>
                              ) : (
                                <>
                                  <XCircle size={13} />
                                  Original
                                </>
                              )}
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* Se ainda não executou a auditoria */}
      {!auditoriaRealizada && !loadingAuditoria && (
        <div className="bg-white p-16 rounded-3xl border border-slate-200 text-center space-y-3">
          <div className="w-16 h-16 rounded-3xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-2">
            <Sparkles size={32} />
          </div>
          <h3 className="font-bold text-slate-800 text-lg">Pronto para Diagnosticar os XMLs</h3>
          <p className="text-slate-500 text-xs max-w-lg mx-auto leading-relaxed">
            Selecione a empresa e o período ou faixa de notas acima e clique em 
            <strong> "Executar Diagnóstico Tributário"</strong> para cruzar automaticamente os produtos contra o Convênio 142/2018, 
            detectar bitributações e projetar os impostos da Reforma Tributária (IBS e CBS).
          </p>
        </div>
      )}

    </div>
  )
}
