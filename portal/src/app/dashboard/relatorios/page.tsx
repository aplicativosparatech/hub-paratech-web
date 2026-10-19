'use client'

import { useState, useEffect, useMemo } from 'react'
import { 
  BarChart3, Download, RefreshCw, AlertTriangle, CheckCircle2, 
  FileText, Hash, ShieldAlert, Sparkles, Building2, Calendar, FileArchive,
  KeyRound, Clock, ShieldCheck, FileSpreadsheet, Filter, Layers, Search, Receipt, ShoppingBag
} from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import toast from 'react-hot-toast'
import { 
  exportarRelatorioIndividual, 
  TipoRelatorio, 
  FormatoExportacao, 
  EmpresaDados 
} from '@/utils/relatorioExporter'
import Pagination from '@/components/Pagination'
import { limparDocumento, formatarCnpjCpf } from '@/utils/cnpjAlfanumerico'
import { useTableFeatures } from '@/hooks/useTableFeatures'
import { ResizableSortableTh } from '@/components/ui/ResizableSortableTh'
import { useGlobalClient } from '@/components/GlobalClientContext'
import CompetenciaSelector from '@/components/CompetenciaSelector'

export default function RelatoriosPage() {
  const { interfaceMode, selectedClienteId: globalClienteId } = useGlobalClient()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [loadingAudit, setLoadingAudit] = useState(false)
  const [downloadingZip, setDownloadingZip] = useState(false)

  // Dados do Usuário e Clientes
  const [clientes, setClientes] = useState<any[]>([])
  const [selectedCliente, setSelectedCliente] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('hub_paratech_global_cliente') || ''
    }
    return ''
  })

  // Sincronização automática com a empresa selecionada globalmente
  useEffect(() => {
    if (globalClienteId) {
      setSelectedCliente(globalClienteId)
    }
  }, [globalClienteId])
  
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

  // Horário da Última Sincronização do Hub da Empresa
  const [ultimaSincronizacaoHub, setUltimaSincronizacaoHub] = useState<string | null>(null)

  // Dados da Auditoria
  const [auditData, setAuditData] = useState<any>(null)
  // Papel do usuário logado ('admin' | 'contabilidade' | 'cliente')
  const [userRole, setUserRole] = useState<'admin' | 'contabilidade' | 'cliente'>('admin')
  const [clientSearchTerm, setClientSearchTerm] = useState('')

  // Estados Específicos do Auditor de Produtos Monofásicos
  const [produtosMonofasicos, setProdutosMonofasicos] = useState<any[]>([])
  const [filtrosNcmDisponiveis, setFiltrosNcmDisponiveis] = useState<any[]>([])
  const [loadingProdutosMonofasicos, setLoadingProdutosMonofasicos] = useState(false)
  const [filtroNcmSelecionado, setFiltroNcmSelecionado] = useState<string>('todos')
  const [filtroConformidade, setFiltroConformidade] = useState<'todos' | 'divergentes' | 'regulares'>('todos')
  const [modoAgrupamentoMonofasico, setModoAgrupamentoMonofasico] = useState<'cupom' | 'agrupado'>('cupom')
  const [buscaMonofasico, setBuscaMonofasico] = useState<string>('')
  const [modoMonofasicoCard, setModoMonofasicoCard] = useState<'ncm' | 'cst'>('ncm')
  const [totaisMonofasicos, setTotaisMonofasicos] = useState<{
    total_itens: number
    valor_total: number
    valor_regular: number
    valor_divergente: number
    qtd_regular: number
    qtd_divergente: number
    cupons_distintos: number
    estimativa_economia_simples: number
  } | null>(null)

  // Estados de Paginação
  const [pageMonofasico, setPageMonofasico] = useState<number>(1)
  const [pageSizeMonofasico, setPageSizeMonofasico] = useState<number>(25)

  const [pageQuebras, setPageQuebras] = useState<number>(1)
  const [pageSizeQuebras, setPageSizeQuebras] = useState<number>(25)

  const [pageNaoAssinadas, setPageNaoAssinadas] = useState<number>(1)
  const [pageSizeNaoAssinadas, setPageSizeNaoAssinadas] = useState<number>(25)

  const [pageCertificados, setPageCertificados] = useState<number>(1)
  const [pageSizeCertificados, setPageSizeCertificados] = useState<number>(25)

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

          // Se tiver cliente_id nos parâmetros da URL ou no filtro global, prioriza ele
          if (typeof window !== 'undefined') {
            const urlParams = new URLSearchParams(window.location.search)
            const paramClienteId = urlParams.get('cliente_id')
            const globalSaved = localStorage.getItem('hub_paratech_global_cliente')
            const mode = localStorage.getItem('hub_interface_mode') || 'clean'
            if (paramClienteId && mapped.some(c => c.id === paramClienteId)) {
              setSelectedCliente(paramClienteId)
            } else if (globalSaved && mapped.some(c => c.id === globalSaved)) {
              setSelectedCliente(globalSaved)
            } else if (role === 'cliente') {
              setSelectedCliente(mapped[0].id)
            } else {
              setSelectedCliente(mode === 'clean' ? '' : mapped[0].id)
            }
          } else {
            setSelectedCliente(role === 'cliente' ? mapped[0].id : '')
          }
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

  // Sincronização reativa com o Filtro Global do Topo
  useEffect(() => {
    const handleGlobalChange = (e: any) => {
      const newId = e.detail?.clienteId ?? (typeof window !== 'undefined' ? localStorage.getItem('hub_paratech_global_cliente') || '' : '')
      setSelectedCliente(newId)
    }
    window.addEventListener('hub_global_cliente_changed', handleGlobalChange)
    return () => window.removeEventListener('hub_global_cliente_changed', handleGlobalChange)
  }, [])

  // Atualização bidirecional de cliente
  const handleSelectCliente = (id: string) => {
    setSelectedCliente(id)
    if (typeof window !== 'undefined') {
      if (id) {
        localStorage.setItem('hub_paratech_global_cliente', id)
      } else {
        localStorage.removeItem('hub_paratech_global_cliente')
      }
      window.dispatchEvent(new CustomEvent('hub_global_cliente_changed', { detail: { clienteId: id } }))
    }
  }
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

  // Busca horário da última sincronização do Hub para a empresa selecionada
  async function loadUltimaSincronizacao() {
    try {
      if (!selectedCliente) {
        setUltimaSincronizacaoHub(null)
        return
      }
      const { data } = await supabase
        .from('configuracoes_hub')
        .select('ultima_sincronizacao')
        .eq('cliente_id', selectedCliente)
        .order('ultima_sincronizacao', { ascending: false })
        .limit(1)

      if (data && data.length > 0 && data[0].ultima_sincronizacao) {
        setUltimaSincronizacaoHub(data[0].ultima_sincronizacao)
      } else {
        setUltimaSincronizacaoHub(null)
      }
    } catch (e) {
      console.warn('Erro ao carregar ultima sincronizacao:', e)
    }
  }

  useEffect(() => {
    loadUltimaSincronizacao()
  }, [selectedCliente])

  // Formatação humanizada do horário da última sincronização do Hub
  function formatRelativeSync(dateStr?: string | null) {
    if (!dateStr) return null
    try {
      const syncDate = new Date(dateStr)
      const now = new Date()
      const diffMs = now.getTime() - syncDate.getTime()
      const diffMin = Math.floor(diffMs / (1000 * 60))
      const diffHours = Math.floor(diffMin / 60)
      const diffDays = Math.floor(diffHours / 24)

      const horaFormatada = syncDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      const dataFormatada = syncDate.toLocaleDateString('pt-BR')

      let relStr = ''
      if (diffMin < 1) relStr = 'agora mesmo'
      else if (diffMin < 60) relStr = `há ${diffMin} min`
      else if (diffHours < 24) relStr = `há ${diffHours}h`
      else relStr = `há ${diffDays}d`

      return {
        textoCompleto: `${dataFormatada} às ${horaFormatada}`,
        tempoRelativo: relStr,
        isRecente: diffMin <= 60
      }
    } catch {
      return null
    }
  }

  const syncInfo = formatRelativeSync(ultimaSincronizacaoHub)

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

  // Carrega lista detalhada de produtos monofásicos extraídos dos XMLs
  const loadProdutosMonofasicos = async () => {
    if (!selectedCliente) return
    setLoadingProdutosMonofasicos(true)
    try {
      const res = await fetch(`/api/relatorios/produtos-monofasicos?cliente_id=${selectedCliente}&mes=${selectedMonth}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao carregar produtos monofásicos')
      setProdutosMonofasicos(data.produtos || [])
      setFiltrosNcmDisponiveis(data.filtros_disponiveis || [])
      setTotaisMonofasicos(data.totais || null)
    } catch (err: any) {
      console.warn('Erro ao carregar produtos monofásicos:', err)
    } finally {
      setLoadingProdutosMonofasicos(false)
    }
  }

  // Dispara carregamento de produtos monofásicos sempre que o cliente ou competência mudar (alimenta tanto o card da aba Faturamento quanto a aba do Auditor)
  useEffect(() => {
    if (selectedCliente) {
      loadProdutosMonofasicos()
    }
  }, [selectedCliente, selectedMonth])

  // Produtos Monofásicos Filtrados pelo NCM, Conformidade e Termo de Busca
  const produtosMonofasicosFiltrados = useMemo(() => {
    return produtosMonofasicos.filter(item => {
      const matchNcm = filtroNcmSelecionado === 'todos' || item.ncm === filtroNcmSelecionado
      const matchConformidade = 
        filtroConformidade === 'todos' ? true :
        filtroConformidade === 'divergentes' ? item.status_conformidade !== 'regular' :
        item.status_conformidade === 'regular'
      const matchBusca = !buscaMonofasico || 
        item.xProd?.toLowerCase().includes(buscaMonofasico.toLowerCase()) ||
        item.cProd?.toLowerCase().includes(buscaMonofasico.toLowerCase()) ||
        item.cupom_numero?.toLowerCase().includes(buscaMonofasico.toLowerCase()) ||
        item.descricao_ncm?.toLowerCase().includes(buscaMonofasico.toLowerCase()) ||
        item.ncm?.includes(buscaMonofasico)
      return matchNcm && matchConformidade && matchBusca
    })
  }, [produtosMonofasicos, filtroNcmSelecionado, filtroConformidade, buscaMonofasico])

  // Produtos Agrupados por Produto e NCM (Sintético)
  const produtosMonofasicosAgrupados = useMemo(() => {
    const map = new Map<string, any>()
    const totalGeral = produtosMonofasicosFiltrados.reduce((a, b) => a + (b.vProd || 0), 0)

    for (const item of produtosMonofasicosFiltrados) {
      const key = `${item.ncm}_${item.xProd}`
      if (!map.has(key)) {
        map.set(key, {
          ncm: item.ncm,
          ncm_formatado: item.ncm_formatado,
          categoria: item.categoria,
          descricao_ncm: item.descricao_ncm,
          cProd: item.cProd,
          xProd: item.xProd,
          uCom: item.uCom,
          qtd_total: 0,
          valor_total: 0,
          valor_regular: 0,
          valor_divergente: 0,
          qtd_divergentes: 0,
          cupons: new Set<string>()
        })
      }
      const reg = map.get(key)!
      reg.qtd_total += Number(item.qCom || 0)
      reg.valor_total += Number(item.vProd || 0)
      if (item.status_conformidade === 'regular') {
        reg.valor_regular += Number(item.vProd || 0)
      } else {
        reg.valor_divergente += Number(item.vProd || 0)
        reg.qtd_divergentes += 1
      }
      reg.cupons.add(item.chave || item.cupom_numero)
    }

    return Array.from(map.values()).map(r => ({
      ...r,
      qtd_cupons: r.cupons.size,
      preco_medio: r.qtd_total > 0 ? (r.valor_total / r.qtd_total) : 0,
      percentual: totalGeral > 0 ? ((r.valor_total / totalGeral) * 100) : 0,
      tem_divergencia: r.qtd_divergentes > 0
    })).sort((a, b) => b.valor_total - a.valor_total)
  }, [produtosMonofasicosFiltrados])

  // Reset de página dos produtos monofásicos ao alterar filtros ou competência
  useEffect(() => {
    setPageMonofasico(1)
  }, [filtroNcmSelecionado, filtroConformidade, modoAgrupamentoMonofasico, buscaMonofasico, selectedMonth, selectedCliente, pageSizeMonofasico])

  // Hook de ordenação e redimensionamento - Monofásicos Analítico (Cupom)
  const {
    sortedData: monofasicosFiltradosOrdenados,
    sortKey: sortKeyMonoCupom,
    sortDirection: sortDirMonoCupom,
    handleSort: handleSortMonoCupom,
    columnWidths: colWidthsMonoCupom,
    handleResizeColumn: handleResizeMonoCupom
  } = useTableFeatures({
    data: produtosMonofasicosFiltrados,
    tableId: 'tabela_monofasicos_cupom',
    defaultSortKey: 'total',
    defaultSortDirection: 'desc',
    initialWidths: {
      cupom: 160,
      produto: 240,
      ncm: 190,
      conformidade: 180,
      cfopCst: 130,
      qtd: 85,
      vlrUnit: 105,
      total: 135
    },
    customExtractors: {
      cupom: (i: any) => Number(i.cupom_numero || 0),
      produto: (i: any) => i.xProd || '',
      ncm: (i: any) => i.ncm || '',
      conformidade: (i: any) => i.status_conformidade || '',
      cfopCst: (i: any) => `${i.cfop || ''}/${i.cst || ''}`,
      qtd: (i: any) => Number(i.qCom || 0),
      vlrUnit: (i: any) => Number(i.vUnCom || 0),
      total: (i: any) => Number(i.vProd || 0)
    }
  })

  // Hook de ordenação e redimensionamento - Monofásicos Sintético (NCM/Produto)
  const {
    sortedData: monofasicosAgrupadosOrdenados,
    sortKey: sortKeyMonoNcm,
    sortDirection: sortDirMonoNcm,
    handleSort: handleSortMonoNcm,
    columnWidths: colWidthsMonoNcm,
    handleResizeColumn: handleResizeMonoNcm
  } = useTableFeatures({
    data: produtosMonofasicosAgrupados,
    tableId: 'tabela_monofasicos_ncm',
    defaultSortKey: 'total',
    defaultSortDirection: 'desc',
    initialWidths: {
      ncm: 210,
      produto: 250,
      conformidade: 170,
      cupons: 110,
      qtdTotal: 100,
      precoMedio: 120,
      total: 140,
      percentual: 110
    },
    customExtractors: {
      ncm: (i: any) => i.ncm || '',
      produto: (i: any) => i.xProd || '',
      conformidade: (i: any) => (i.tem_divergencia ? 'divergente' : 'regular'),
      cupons: (i: any) => Number(i.qtd_cupons || 0),
      qtdTotal: (i: any) => Number(i.qtd_total || 0),
      precoMedio: (i: any) => Number(i.preco_medio || 0),
      total: (i: any) => Number(i.valor_total || 0),
      percentual: (i: any) => Number(i.percentual || 0)
    }
  })

  // Fatiamento Paginado - Monofásicos Analítico (Cupom)
  const produtosMonofasicosFiltradosPaginados = useMemo(() => {
    const start = (pageMonofasico - 1) * pageSizeMonofasico
    return monofasicosFiltradosOrdenados.slice(start, start + pageSizeMonofasico)
  }, [monofasicosFiltradosOrdenados, pageMonofasico, pageSizeMonofasico])

  // Fatiamento Paginado - Monofásicos Agrupado (NCM/Produto)
  const produtosMonofasicosAgrupadosPaginados = useMemo(() => {
    const start = (pageMonofasico - 1) * pageSizeMonofasico
    return monofasicosAgrupadosOrdenados.slice(start, start + pageSizeMonofasico)
  }, [monofasicosAgrupadosOrdenados, pageMonofasico, pageSizeMonofasico])

  // Função Específica para Exportação de Monofásicos com os Filtros e Agrupamentos Ativos
  const handleExportarMonofasicosPersonalizado = (formato: FormatoExportacao) => {
    const currentCli = clientes.find(c => c.id === selectedCliente) || (userRole === 'cliente' ? clientes[0] : null)
    if (!currentCli) {
      toast.error('Selecione uma empresa.')
      return
    }

    const filtroObj = filtrosNcmDisponiveis.find(f => f.ncm === filtroNcmSelecionado)
    const filtroRotulo = filtroNcmSelecionado === 'todos' 
      ? 'Todos os Produtos Monofásicos' 
      : (filtroObj?.label || `NCM ${filtroNcmSelecionado}`)

    const empresaDados: EmpresaDados = {
      razao_social: currentCli.razao_social || 'Empresa',
      nome_fantasia: currentCli.nome_fantasia,
      cnpj: currentCli.cnpj || '',
      regime_tributario: currentCli.regime_tributario,
      contabilidade_nome: currentCli.contabilidade_nome
    }

    if (modoAgrupamentoMonofasico === 'cupom') {
      const payload = {
        produtos: produtosMonofasicosFiltrados,
        filtro_rotulo: filtroRotulo,
        total_valor: produtosMonofasicosFiltrados.reduce((a, b) => a + (b.vProd || 0), 0),
        cupons_distintos: new Set(produtosMonofasicosFiltrados.map(i => i.chave || i.cupom_numero)).size
      }
      exportarRelatorioIndividual('monofasicos_produtos_analitico', formato, empresaDados, selectedMonth, payload)
    } else {
      const payload = {
        produtos_agrupados: produtosMonofasicosAgrupados,
        filtro_rotulo: filtroRotulo,
        total_valor: produtosMonofasicosAgrupados.reduce((a, b) => a + (b.valor_total || 0), 0)
      }
      exportarRelatorioIndividual('monofasicos_produtos_agrupado', formato, empresaDados, selectedMonth, payload)
    }

    toast.success(`Download do relatório monofásico (${formato.toUpperCase()}) concluído!`)
  }

  // Exportação disparada pelo Card de Monofásicos da aba Faturamento (respeita o toggle NCM vs CST 04/06)
  const handleExportarCardMonofasicos = (formato: FormatoExportacao) => {
    const currentCli = clientes.find(c => c.id === selectedCliente) || (userRole === 'cliente' ? clientes[0] : null)
    if (!currentCli) {
      toast.error('Selecione uma empresa para exportar.')
      return
    }

    const empresaDados: EmpresaDados = {
      razao_social: currentCli.razao_social || 'Empresa',
      nome_fantasia: currentCli.nome_fantasia,
      cnpj: currentCli.cnpj || '',
      regime_tributario: currentCli.regime_tributario,
      contabilidade_nome: currentCli.contabilidade_nome
    }

    if (modoMonofasicoCard === 'ncm') {
      if (loadingProdutosMonofasicos) {
        toast.error('Os produtos monofásicos por NCM ainda estão sendo auditados. Aguarde alguns segundos.')
        return
      }

      if (produtosMonofasicos.length === 0) {
        toast.error('Nenhum produto monofásico por NCM foi localizado nesta competência.')
        return
      }

      const totalVal = totaisMonofasicos?.valor_total ?? produtosMonofasicos.reduce((a, b) => a + (b.vProd || 0), 0)
      const payload = {
        produtos: produtosMonofasicos,
        filtro_rotulo: 'Todos os Produtos Monofásicos Auditados por NCM (Faturamento Geral)',
        total_valor: totalVal,
        cupons_distintos: totaisMonofasicos?.cupons_distintos ?? new Set(produtosMonofasicos.map(i => i.chave || i.cupom_numero)).size
      }
      exportarRelatorioIndividual('monofasicos_produtos_analitico', formato, empresaDados, selectedMonth, payload)
      toast.success(`Relatório de monofásicos por NCM (${formato.toUpperCase()}) baixado com sucesso!`)
    } else {
      // Modo CST 04/06 convencional
      handleExportar('monofasicos', formato)
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

  // Função Universal para Exportação Individual de Relatórios (PDF, XLS, CSV)
  const handleExportar = (tipo: TipoRelatorio, formato: FormatoExportacao) => {
    const currentCli = clientes.find(c => c.id === selectedCliente) || (userRole === 'cliente' ? clientes[0] : null)
    if (!currentCli) {
      toast.error('Selecione uma empresa para exportar o relatório.')
      return
    }
    if (!auditData) {
      toast.error('Aguarde o carregamento dos dados da auditoria.')
      return
    }

    try {
      const empresaDados: EmpresaDados = {
        razao_social: currentCli.razao_social || 'Empresa',
        nome_fantasia: currentCli.nome_fantasia,
        cnpj: currentCli.cnpj || '',
        regime_tributario: currentCli.regime_tributario,
        contabilidade_nome: currentCli.contabilidade_nome
      }

      const payloadDados = {
        ...auditData,
        certificados: (userRole === 'cliente' 
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
            if (dias < 0) status = 'vencido'
            else if (dias <= 45) status = 'alerta'
            else status = 'valido'
          }

          return {
            razao_social: c.razao_social,
            cnpj: c.cnpj,
            validadeFormatada,
            dias,
            status,
            whatsapp: c.whatsapp
          }
        })
      }

      exportarRelatorioIndividual(tipo, formato, empresaDados, selectedMonth, payloadDados)
      toast.success(`Download do relatório (${formato.toUpperCase()}) concluído!`)
    } catch (err: any) {
      toast.error('Erro ao gerar relatório: ' + err.message)
    }
  }

  // Reset de páginas ao alterar competência ou cliente
  useEffect(() => {
    setPageQuebras(1)
  }, [selectedCliente, selectedMonth, pageSizeQuebras])

  useEffect(() => {
    setPageNaoAssinadas(1)
  }, [selectedCliente, selectedMonth, pageSizeNaoAssinadas])

  useEffect(() => {
    setPageCertificados(1)
  }, [selectedCliente, selectedMonth, pageSizeCertificados])

  const consolidado = auditData?.consolidado
  const quebras = auditData?.quebras_sequencia || []
  const naoAssinadas = auditData?.nao_assinadas
  const inutilizadas = auditData?.inutilizadas

  // Fatiamento Paginado - Quebras de Sequência
  const quebrasPaginadas = useMemo(() => {
    const start = (pageQuebras - 1) * pageSizeQuebras
    return (quebras || []).slice(start, start + pageSizeQuebras)
  }, [quebras, pageQuebras, pageSizeQuebras])

  // Fatiamento Paginado - Não Assinadas / Sem Protocolo
  const listaNaoAssinadas = useMemo(() => {
    return [...(naoAssinadas?.nfe || []), ...(naoAssinadas?.nfce || [])]
  }, [naoAssinadas])

  const naoAssinadasPaginadas = useMemo(() => {
    const start = (pageNaoAssinadas - 1) * pageSizeNaoAssinadas
    return listaNaoAssinadas.slice(start, start + pageSizeNaoAssinadas)
  }, [listaNaoAssinadas, pageNaoAssinadas, pageSizeNaoAssinadas])

  if (loading) {
    return <div className="p-8 text-slate-500">Carregando módulo fiscal...</div>
  }

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
          <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-500">
            {/* Horário da Última Sincronização do Hub */}
            <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-lg">
              <Clock size={13} className="text-blue-600" />
              <span>
                Última sincronização do Hub:{' '}
                {syncInfo ? (
                  <strong className="text-slate-800 font-semibold" title={syncInfo.textoCompleto}>
                    {syncInfo.textoCompleto} <span className="text-blue-600 font-bold">({syncInfo.tempoRelativo})</span>
                  </strong>
                ) : (
                  <span className="text-slate-400 italic">Aguardando primeira sincronização</span>
                )}
              </span>
            </div>

            {auditData?.gerado_em && (
              <span className="text-slate-400">
                Auditoria gerada em: <strong className="text-slate-600">{new Date(auditData.gerado_em).toLocaleTimeString('pt-BR')}</strong>
              </span>
            )}
          </div>
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

      {/* Barra de Filtros (Competência Mês/Ano) */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Competência de Análise</h3>
          <p className="text-xs text-slate-500">Selecione o mês para cálculo e auditoria dos arquivos fiscais da empresa ativa.</p>
        </div>

        {/* Seletor de Competência (Mês/Ano) com Busca Inteligente */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="min-w-[240px]">
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Mês de Competência:
            </label>
            <CompetenciaSelector
              value={selectedMonth}
              onChange={setSelectedMonth}
              placeholder="Buscar mês de competência..."
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
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md">Modelo 55</span>
              <span className="text-xs text-slate-400 font-medium">{consolidado?.nfe?.quantidade || 0} notas</span>
            </div>
            <p className="text-xs font-medium text-slate-500">NF-e (Vendas / Grandes Operações)</p>
            <p className="text-2xl font-bold text-slate-900 mt-2">
              R$ {(consolidado?.nfe?.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Baixar:</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleExportar('nfe', 'pdf')}
                title="Baixar Relatório NF-e em PDF"
                className="px-2 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 rounded-md transition flex items-center gap-1 shadow-2xs"
              >
                <FileText size={12} className="text-rose-600" /> PDF
              </button>
              <button
                onClick={() => handleExportar('nfe', 'xls')}
                title="Baixar Relatório NF-e em Excel (XLSX)"
                className="px-2 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 rounded-md transition flex items-center gap-1 shadow-2xs"
              >
                <FileSpreadsheet size={12} className="text-emerald-600" /> XLS
              </button>
              <button
                onClick={() => handleExportar('nfe', 'csv')}
                title="Baixar Relatório NF-e em CSV"
                className="px-2 py-1 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-md transition flex items-center gap-1 shadow-2xs"
              >
                <Download size={12} className="text-slate-500" /> CSV
              </button>
            </div>
          </div>
        </div>

        {/* NFC-e Modelo 65 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md">Modelo 65</span>
              <span className="text-xs text-slate-400 font-medium">{consolidado?.nfce?.quantidade || 0} notas</span>
            </div>
            <p className="text-xs font-medium text-slate-500">NFC-e (Consumidor / Cupom PDV)</p>
            <p className="text-2xl font-bold text-slate-900 mt-2">
              R$ {(consolidado?.nfce?.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Baixar:</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleExportar('nfce', 'pdf')}
                title="Baixar Relatório NFC-e em PDF"
                className="px-2 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 rounded-md transition flex items-center gap-1 shadow-2xs"
              >
                <FileText size={12} className="text-rose-600" /> PDF
              </button>
              <button
                onClick={() => handleExportar('nfce', 'xls')}
                title="Baixar Relatório NFC-e em Excel (XLSX)"
                className="px-2 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 rounded-md transition flex items-center gap-1 shadow-2xs"
              >
                <FileSpreadsheet size={12} className="text-emerald-600" /> XLS
              </button>
              <button
                onClick={() => handleExportar('nfce', 'csv')}
                title="Baixar Relatório NFC-e em CSV"
                className="px-2 py-1 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-md transition flex items-center gap-1 shadow-2xs"
              >
                <Download size={12} className="text-slate-500" /> CSV
              </button>
            </div>
          </div>
        </div>

        {/* Faturamento Geral Consolidado */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md">Soma Total</span>
              <span className="text-xs text-slate-400 font-medium">{consolidado?.geral?.quantidade_total || 0} notas</span>
            </div>
            <p className="text-xs font-medium text-slate-500">Faturamento Bruto Consolidado</p>
            <p className="text-2xl font-bold text-emerald-600 mt-2">
              R$ {(consolidado?.geral?.total_faturado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Baixar:</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleExportar('consolidado', 'pdf')}
                title="Baixar Relatório Consolidado em PDF"
                className="px-2 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 rounded-md transition flex items-center gap-1 shadow-2xs"
              >
                <FileText size={12} className="text-rose-600" /> PDF
              </button>
              <button
                onClick={() => handleExportar('consolidado', 'xls')}
                title="Baixar Relatório Consolidado em Excel (XLSX)"
                className="px-2 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 rounded-md transition flex items-center gap-1 shadow-2xs"
              >
                <FileSpreadsheet size={12} className="text-emerald-600" /> XLS
              </button>
              <button
                onClick={() => handleExportar('consolidado', 'csv')}
                title="Baixar Relatório Consolidado em CSV"
                className="px-2 py-1 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-md transition flex items-center gap-1 shadow-2xs"
              >
                <Download size={12} className="text-slate-500" /> CSV
              </button>
            </div>
          </div>
        </div>

        {/* Produtos Monofásicos com Seletor NCM x CST 04/06 */}
        <div className="bg-gradient-to-br from-amber-50 to-orange-50/40 p-5 rounded-2xl border border-amber-200 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
              <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-md flex items-center gap-1">
                <Sparkles size={12} /> Monofásicos
              </span>

              {/* Toggle NCM vs CST 04/06 */}
              <div className="flex items-center gap-1 bg-amber-100/90 p-0.5 rounded-lg border border-amber-300/80 text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => setModoMonofasicoCard('ncm')}
                  className={`px-2 py-0.5 rounded-md transition cursor-pointer ${
                    modoMonofasicoCard === 'ncm' 
                      ? 'bg-amber-600 text-white shadow-2xs font-extrabold' 
                      : 'text-amber-800 hover:text-amber-950'
                  }`}
                  title="Auditoria por Classificação Fiscal NCM Oficial (detecta monofásicos mesmo se o ERP emitiu com CST 01/49/99 incorreto)"
                >
                  Por NCM
                </button>
                <button
                  type="button"
                  onClick={() => setModoMonofasicoCard('cst')}
                  className={`px-2 py-0.5 rounded-md transition cursor-pointer ${
                    modoMonofasicoCard === 'cst' 
                      ? 'bg-amber-600 text-white shadow-2xs font-extrabold' 
                      : 'text-amber-800 hover:text-amber-950'
                  }`}
                  title="Apenas produtos emitidos formalmente com CST 04 ou 06 no XML"
                >
                  Por CST 04/06
                </button>
              </div>
            </div>

            <p className="text-xs font-bold text-amber-800 flex items-center justify-between">
              <span>{modoMonofasicoCard === 'ncm' ? 'Total Monofásico por NCM' : 'Total Declarado CST 04/06'}</span>
              <span className="text-[10px] text-amber-700 font-semibold uppercase">Economia DAS</span>
            </p>

            {loadingProdutosMonofasicos && modoMonofasicoCard === 'ncm' ? (
              <div className="flex items-center gap-2 mt-3 text-amber-700 text-sm font-bold">
                <RefreshCw size={16} className="animate-spin text-amber-600" />
                <span>Auditando NCMs nos XMLs...</span>
              </div>
            ) : (
              <p className="text-2xl font-black text-amber-700 mt-2">
                R$ {(modoMonofasicoCard === 'ncm'
                  ? (totaisMonofasicos?.valor_total ?? produtosMonofasicos.reduce((a, b) => a + (b.vProd || 0), 0))
                  : (totaisMonofasicos?.valor_regular ?? consolidado?.geral?.total_monofasico ?? 0)
                ).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            )}

            <div className="mt-1 text-[11px] text-amber-700 leading-tight">
              {modoMonofasicoCard === 'ncm' ? (
                totaisMonofasicos && totaisMonofasicos.qtd_divergente > 0 ? (
                  <span className="font-semibold block text-amber-800" title={`${totaisMonofasicos.qtd_divergente} item(ns) emitidos sem CST 04/06`}>
                    ⚠️ R$ {totaisMonofasicos.valor_divergente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} recuperável no PGDAS ({totaisMonofasicos.qtd_divergente} itens c/ CST 99/01)
                  </span>
                ) : (
                  <span>Dedução legal no PGDAS por NCM oficial</span>
                )
              ) : (
                <span>Declarado no PDV formalmente com CST 04/06</span>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-amber-200/70 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider">Baixar:</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleExportarCardMonofasicos('pdf')}
                title={`Baixar Demonstrativo de Monofásicos (${modoMonofasicoCard === 'ncm' ? 'Por NCM' : 'Por CST'}) em PDF`}
                className="px-2 py-1 text-xs font-semibold text-rose-700 bg-white/90 hover:bg-white border border-rose-200 rounded-md transition flex items-center gap-1 shadow-2xs cursor-pointer"
              >
                <FileText size={12} className="text-rose-600" /> PDF
              </button>
              <button
                type="button"
                onClick={() => handleExportarCardMonofasicos('xls')}
                title={`Baixar Demonstrativo de Monofásicos (${modoMonofasicoCard === 'ncm' ? 'Por NCM' : 'Por CST'}) em Excel (XLSX)`}
                className="px-2 py-1 text-xs font-semibold text-emerald-800 bg-white/90 hover:bg-white border border-emerald-200 rounded-md transition flex items-center gap-1 shadow-2xs cursor-pointer"
              >
                <FileSpreadsheet size={12} className="text-emerald-600" /> XLS
              </button>
              <button
                type="button"
                onClick={() => handleExportarCardMonofasicos('csv')}
                title={`Baixar Demonstrativo de Monofásicos (${modoMonofasicoCard === 'ncm' ? 'Por NCM' : 'Por CST'}) em CSV`}
                className="px-2 py-1 text-xs font-semibold text-slate-700 bg-white/90 hover:bg-white border border-amber-200 rounded-md transition flex items-center gap-1 shadow-2xs cursor-pointer"
              >
                <Download size={12} className="text-slate-500" /> CSV
              </button>
            </div>
          </div>
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-xl font-bold text-slate-900 mb-1">Faturamento Consolidado do Período</h3>
                <p className="text-sm text-slate-500">Notas com assinatura digital e protocolo SEFAZ autorizado (cStat 100).</p>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                <span className="text-xs font-semibold text-slate-500 px-2">Baixar Relatório:</span>
                <button
                  onClick={() => handleExportar('consolidado', 'pdf')}
                  className="px-2.5 py-1.5 text-xs font-semibold text-rose-700 bg-white hover:bg-rose-50 border border-rose-200 rounded-lg transition flex items-center gap-1 shadow-2xs"
                >
                  <FileText size={13} className="text-rose-600" /> PDF
                </button>
                <button
                  onClick={() => handleExportar('consolidado', 'xls')}
                  className="px-2.5 py-1.5 text-xs font-semibold text-emerald-700 bg-white hover:bg-emerald-50 border border-emerald-200 rounded-lg transition flex items-center gap-1 shadow-2xs"
                >
                  <FileSpreadsheet size={13} className="text-emerald-600" /> XLS
                </button>
                <button
                  onClick={() => handleExportar('consolidado', 'csv')}
                  className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition flex items-center gap-1 shadow-2xs"
                >
                  <Download size={13} className="text-slate-500" /> CSV
                </button>
              </div>
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

            {/* PAINEL DE MODALIDADES DE PAGAMENTO RECEBIDAS */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-teal-50/50 via-slate-50 to-emerald-50/30 border border-teal-200/80 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-teal-100">
                <div>
                  <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Receipt className="text-teal-600" size={20} />
                    Modalidades de Pagamento Recebidas (Caixa / PDV)
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Totalização financeira das formas de recebimento extraídas dos XMLs oficiais (PIX, Dinheiro, Cartões, etc.).
                  </p>
                </div>

                <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-xl border border-teal-200/80 shadow-2xs">
                  <span className="text-xs font-semibold text-teal-800 px-2">Baixar Pagamentos:</span>
                  <button
                    onClick={() => handleExportar('pagamentos', 'pdf')}
                    className="px-2.5 py-1.5 text-xs font-semibold text-rose-700 bg-white hover:bg-rose-50 border border-rose-200 rounded-lg transition flex items-center gap-1 shadow-2xs"
                    title="Baixar Relatório de Pagamentos em PDF"
                  >
                    <FileText size={13} className="text-rose-600" /> PDF
                  </button>
                  <button
                    onClick={() => handleExportar('pagamentos', 'xls')}
                    className="px-2.5 py-1.5 text-xs font-semibold text-emerald-700 bg-white hover:bg-emerald-50 border border-emerald-200 rounded-lg transition flex items-center gap-1 shadow-2xs"
                    title="Baixar Relatório de Pagamentos em Excel (XLSX)"
                  >
                    <FileSpreadsheet size={13} className="text-emerald-600" /> XLS
                  </button>
                  <button
                    onClick={() => handleExportar('pagamentos', 'csv')}
                    className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition flex items-center gap-1 shadow-2xs"
                    title="Baixar Relatório de Pagamentos em CSV"
                  >
                    <Download size={13} className="text-slate-500" /> CSV
                  </button>
                </div>
              </div>

              {/* Grid de Formas de Pagamento */}
              {Array.isArray(auditData?.formas_pagamento) && auditData.formas_pagamento.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  {auditData.formas_pagamento.map((fp: any) => {
                    let cardBg = 'bg-white border-slate-200 text-slate-800'
                    let icon = '🏷️'
                    let badgeBg = 'bg-slate-100 text-slate-700'
                    const nomeLower = (fp.nome || '').toLowerCase()

                    if (nomeLower.includes('pix')) {
                      cardBg = 'bg-teal-50/70 border-teal-200 text-teal-950'
                      badgeBg = 'bg-teal-100 text-teal-800'
                      icon = '⚡'
                    } else if (nomeLower.includes('dinheiro')) {
                      cardBg = 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                      badgeBg = 'bg-emerald-100 text-emerald-800'
                      icon = '💵'
                    } else if (nomeLower.includes('crédito') || nomeLower.includes('credito')) {
                      cardBg = 'bg-blue-50/70 border-blue-200 text-blue-950'
                      badgeBg = 'bg-blue-100 text-blue-800'
                      icon = '💳'
                    } else if (nomeLower.includes('débito') || nomeLower.includes('debito')) {
                      cardBg = 'bg-sky-50/70 border-sky-200 text-sky-950'
                      badgeBg = 'bg-sky-100 text-sky-800'
                      icon = '💳'
                    } else if (nomeLower.includes('boleto')) {
                      cardBg = 'bg-amber-50/70 border-amber-200 text-amber-950'
                      badgeBg = 'bg-amber-100 text-amber-800'
                      icon = '📄'
                    } else if (nomeLower.includes('depósito') || nomeLower.includes('transferência')) {
                      cardBg = 'bg-purple-50/70 border-purple-200 text-purple-950'
                      badgeBg = 'bg-purple-100 text-purple-800'
                      icon = '🏦'
                    }

                    return (
                      <div key={fp.nome} className={`p-4 rounded-xl border shadow-2xs flex flex-col justify-between ${cardBg}`}>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="font-bold text-xs flex items-center gap-1.5 truncate" title={fp.nome}>
                            <span>{icon}</span> {fp.nome}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeBg}`}>
                            {fp.percentual || 0}%
                          </span>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xl font-bold tracking-tight">
                            R$ {Number(fp.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                          <p className="text-[11px] opacity-75 font-medium">
                            {fp.quantidade} {fp.quantidade === 1 ? 'cupom / nota' : 'cupons / notas'}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="p-4 text-center text-xs text-slate-500 bg-white rounded-xl border border-dashed border-slate-200">
                  Nenhuma modalidade de pagamento registrada para as notas deste período.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ABA 2: AUDITOR DE MONOFÁSICOS POR NCM */}
        {activeTab === 'monofasicos' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-xl font-bold text-slate-900 mb-1 flex items-center gap-2">
                  <Sparkles className="text-amber-600" size={24} />
                  Auditor & Analisador de Monofásicos por NCM (PIS & COFINS)
                </h3>
                <p className="text-sm text-slate-500">
                  Cruzamento inteligente da classificação fiscal (<strong>NCM Oficial</strong>) com CST e alíquotas dos XMLs para identificar <strong>erros de preenchimento</strong> e <strong>oportunidades de recuperação tributária</strong>.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={loadProdutosMonofasicos}
                  disabled={loadingProdutosMonofasicos}
                  title="Atualizar lista de produtos dos XMLs"
                  className="p-2 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw size={16} className={loadingProdutosMonofasicos ? 'animate-spin' : ''} />
                </button>

                <div className="flex items-center gap-1.5 bg-amber-50/70 p-1.5 rounded-xl border border-amber-200">
                  <span className="text-xs font-semibold text-amber-800 px-2">Baixar Relatório:</span>
                  <button
                    onClick={() => handleExportarMonofasicosPersonalizado('pdf')}
                    title="Baixar Relatório Monofásico em PDF (com os filtros ativos)"
                    className="px-2.5 py-1.5 text-xs font-semibold text-rose-700 bg-white hover:bg-rose-50 border border-rose-200 rounded-lg transition flex items-center gap-1 shadow-2xs cursor-pointer"
                  >
                    <FileText size={13} className="text-rose-600" /> PDF
                  </button>
                  <button
                    onClick={() => handleExportarMonofasicosPersonalizado('xls')}
                    title="Baixar Relatório Monofásico em Excel (com os filtros ativos)"
                    className="px-2.5 py-1.5 text-xs font-semibold text-emerald-700 bg-white hover:bg-emerald-50 border border-emerald-200 rounded-lg transition flex items-center gap-1 shadow-2xs cursor-pointer"
                  >
                    <FileSpreadsheet size={13} className="text-emerald-600" /> XLS
                  </button>
                  <button
                    onClick={() => handleExportarMonofasicosPersonalizado('csv')}
                    title="Baixar Relatório Monofásico em CSV (com os filtros ativos)"
                    className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition flex items-center gap-1 shadow-2xs cursor-pointer"
                  >
                    <Download size={13} className="text-slate-500" /> CSV
                  </button>
                </div>
              </div>
            </div>

            {/* Vias e Cards de Métricas da Auditoria por NCM */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              
              {/* Card 1: Faturamento Monofásico Total por NCM */}
              <div className="p-5 rounded-2xl bg-blue-50/60 border border-blue-200 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 text-blue-900 font-bold mb-2">
                    <span className="flex items-center gap-1.5 text-sm">
                      <ShoppingBag size={18} className="text-blue-600" />
                      Total Monofásico por NCM
                    </span>
                    <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                      Base Legal
                    </span>
                  </div>
                  <p className="text-xs text-blue-700 leading-relaxed mb-3">
                    Classificação fiscal oficial de Bebidas frias, Medicamentos, Cosméticos, Autopeças e Combustíveis.
                  </p>
                </div>
                <div className="p-3.5 bg-white rounded-xl border border-blue-100 text-center">
                  <span className="text-[11px] text-slate-500 block uppercase font-bold tracking-wider">Faturado no Período</span>
                  <span className="text-2xl font-black text-blue-700 block mt-1">
                    R$ {(totaisMonofasicos?.valor_total ?? produtosMonofasicos.reduce((a, b) => a + (b.vProd || 0), 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    {totaisMonofasicos?.total_itens ?? produtosMonofasicos.length} itens em {totaisMonofasicos?.cupons_distintos ?? new Set(produtosMonofasicos.map(i => i.chave || i.cupom_numero)).size} cupons
                  </span>
                </div>
              </div>

              {/* Card 2: Segregação Regular no XML (CST 04/06) */}
              <div className="p-5 rounded-2xl bg-emerald-50/60 border border-emerald-200 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 text-emerald-900 font-bold mb-2">
                    <span className="flex items-center gap-1.5 text-sm">
                      <CheckCircle2 size={18} className="text-emerald-600" />
                      Regular no XML (CST 04/06)
                    </span>
                    <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      Conforme
                    </span>
                  </div>
                  <p className="text-xs text-emerald-700 leading-relaxed mb-3">
                    Itens preenchidos adequadamente no PDV/ERP com alíquota zero de PIS e COFINS.
                  </p>
                </div>
                <div className="p-3.5 bg-white rounded-xl border border-emerald-100 text-center">
                  <span className="text-[11px] text-slate-500 block uppercase font-bold tracking-wider">Segregação Confirmada</span>
                  <span className="text-2xl font-black text-emerald-700 block mt-1">
                    R$ {(totaisMonofasicos?.valor_regular ?? produtosMonofasicos.filter(i => i.status_conformidade === 'regular').reduce((a, b) => a + (b.vProd || 0), 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[11px] text-emerald-600 font-bold mt-1 block">
                    {totaisMonofasicos?.qtd_regular ?? produtosMonofasicos.filter(i => i.status_conformidade === 'regular').length} item(ns) regulares
                  </span>
                </div>
              </div>

              {/* Card 3: Oportunidade de Recuperação (NCM Monofásico c/ CST Divergente) */}
              <div className="p-5 rounded-2xl bg-amber-50/80 border border-amber-300 flex flex-col justify-between shadow-2xs">
                <div>
                  <div className="flex items-center justify-between gap-2 text-amber-900 font-bold mb-2">
                    <span className="flex items-center gap-1.5 text-sm">
                      <AlertTriangle size={18} className="text-amber-600" />
                      Oportunidade de Recuperação Fiscal
                    </span>
                    <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900">
                      Ação Fiscal
                    </span>
                  </div>
                  <p className="text-xs text-amber-800 leading-relaxed mb-3">
                    NCM monofásico por lei, mas emitido com CST tributado (01/49/99) ou sem CST. <strong>Segregar no DAS para recuperar imposto.</strong>
                  </p>
                </div>
                <div className="p-3.5 bg-white rounded-xl border border-amber-200 text-center">
                  <span className="text-[11px] text-slate-500 block uppercase font-bold tracking-wider">Faturamento Não Aproveitado</span>
                  <span className="text-2xl font-black text-amber-700 block mt-1">
                    R$ {(totaisMonofasicos?.valor_divergente ?? produtosMonofasicos.filter(i => i.status_conformidade !== 'regular').reduce((a, b) => a + (b.vProd || 0), 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                  <div className="mt-1.5 pt-1.5 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Economia est. DAS (~3%):</span>
                    <strong className="text-emerald-700 font-black">
                      R$ {(totaisMonofasicos?.estimativa_economia_simples ?? ((totaisMonofasicos?.valor_divergente || 0) * 0.03)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </strong>
                  </div>
                </div>
              </div>

            </div>

            {/* SEÇÃO PRINCIPAL: EXPLORADOR E AUDITOR DE PRODUTOS MONOFÁSICOS */}
            <div className="mt-8 pt-6 border-t border-slate-200 space-y-6">
              
              {/* Barra de Filtros e Controles */}
              <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-200 space-y-4">
                
                {/* Linha 1: Seletor Rápido de Conformidade Fiscal */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck size={15} className="text-blue-600" />
                    Filtrar por Status de Conformidade do NCM:
                  </span>

                  <div className="inline-flex p-1 bg-white border border-slate-200 rounded-xl shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setFiltroConformidade('todos')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        filtroConformidade === 'todos'
                          ? 'bg-slate-900 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      Todos ({produtosMonofasicos.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFiltroConformidade('divergentes')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        filtroConformidade === 'divergentes'
                          ? 'bg-amber-600 text-white shadow-2xs'
                          : 'text-amber-800 hover:bg-amber-50'
                      }`}
                    >
                      <AlertTriangle size={13} />
                      Com Divergência / Recuperação ({totaisMonofasicos?.qtd_divergente ?? produtosMonofasicos.filter(i => i.status_conformidade !== 'regular').length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFiltroConformidade('regulares')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        filtroConformidade === 'regulares'
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'text-emerald-800 hover:bg-emerald-50'
                      }`}
                    >
                      <CheckCircle2 size={13} />
                      Regulares CST 04/06 ({totaisMonofasicos?.qtd_regular ?? produtosMonofasicos.filter(i => i.status_conformidade === 'regular').length})
                    </button>
                  </div>
                </div>

                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  
                  {/* Filtro Dinâmico por NCM / Tipo de Produto */}
                  <div className="flex-1 min-w-[280px]">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <Filter size={14} className="text-amber-600" />
                      Filtrar por Produto / NCM (Detectados nos XMLs):
                    </label>
                    <select
                      value={filtroNcmSelecionado}
                      onChange={e => setFiltroNcmSelecionado(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="todos">
                        Todos os Produtos Monofásicos ({produtosMonofasicos.length} itens — R$ {produtosMonofasicos.reduce((a, b) => a + (b.vProd || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
                      </option>
                      {filtrosNcmDisponiveis.map(f => (
                        <option key={f.ncm} value={f.ncm}>
                          [{f.ncm_formatado}] {f.descricao} ({f.categoria}) — {f.total_itens} item(ns) | R$ {f.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} {f.qtd_divergente > 0 ? `(⚠️ ${f.qtd_divergente} divergente(s))` : '(✅ Conforme)'}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Alternador de Modo de Agrupamento */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <Layers size={14} className="text-blue-600" />
                      Visualização & Agrupamento:
                    </label>
                    <div className="inline-flex p-1 bg-white border border-slate-200 rounded-xl shadow-2xs">
                      <button
                        type="button"
                        onClick={() => setModoAgrupamentoMonofasico('cupom')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                          modoAgrupamentoMonofasico === 'cupom'
                            ? 'bg-blue-600 text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                      >
                        <Receipt size={14} />
                        Por Cupom / Item a Item
                      </button>
                      <button
                        type="button"
                        onClick={() => setModoAgrupamentoMonofasico('agrupado')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                          modoAgrupamentoMonofasico === 'agrupado'
                            ? 'bg-amber-600 text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                      >
                        <ShoppingBag size={14} />
                        Agrupado por Produto / NCM
                      </button>
                    </div>
                  </div>

                </div>

                {/* Linha 3: Busca rápida por texto */}
                <div className="relative">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar produto por nome (ex: cerveja, coca, remédio, óleo), NCM (ex: 2203), código ou cupom..."
                    value={buscaMonofasico}
                    onChange={e => setBuscaMonofasico(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  {buscaMonofasico && (
                    <button
                      type="button"
                      onClick={() => setBuscaMonofasico('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 font-bold cursor-pointer"
                    >
                      Limpar
                    </button>
                  )}
                </div>
              </div>

              {/* Indicadores Rápidos do Filtro */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-amber-50/80 border border-amber-200/80 p-3.5 rounded-xl">
                  <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block">Total Monofásico Filtrado</span>
                  <span className="text-xl font-bold text-amber-700 mt-0.5 block">
                    R$ {produtosMonofasicosFiltrados.reduce((a, b) => a + (b.vProd || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="bg-blue-50/80 border border-blue-200/80 p-3.5 rounded-xl">
                  <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider block">Itens / Vendas</span>
                  <span className="text-xl font-bold text-blue-700 mt-0.5 block">
                    {modoAgrupamentoMonofasico === 'cupom' 
                      ? `${produtosMonofasicosFiltrados.length} item(ns)` 
                      : `${produtosMonofasicosAgrupados.length} produto(s)`
                    }
                  </span>
                </div>

                <div className="bg-indigo-50/80 border border-indigo-200/80 p-3.5 rounded-xl">
                  <span className="text-[11px] font-bold text-indigo-800 uppercase tracking-wider block">Cupons / Notas</span>
                  <span className="text-xl font-bold text-indigo-700 mt-0.5 block">
                    {new Set(produtosMonofasicosFiltrados.map(i => i.chave || i.cupom_numero)).size} cupom(ns)
                  </span>
                </div>

                <div className="bg-emerald-50/80 border border-emerald-200/80 p-3.5 rounded-xl">
                  <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">Status do Filtro</span>
                  <span className="text-xs font-bold text-emerald-700 mt-1 block">
                    {filtroConformidade === 'divergentes' 
                      ? '⚠️ Apenas Divergentes' 
                      : filtroConformidade === 'regulares' 
                      ? '✅ Apenas Regulares (04/06)' 
                      : '🔍 Todos os Status'}
                  </span>
                </div>
              </div>

              {/* Tabela de Produtos Monofásicos */}
              {loadingProdutosMonofasicos ? (
                <div className="p-12 text-center bg-slate-50 rounded-2xl border border-slate-200">
                  <RefreshCw size={32} className="text-amber-600 animate-spin mx-auto mb-3" />
                  <h4 className="font-bold text-slate-800 text-base">Auditando Produtos Monofásicos nos XMLs...</h4>
                  <p className="text-xs text-slate-500 mt-1">Analisando NCMs oficiais e cruzando com CSTs de PIS/COFINS das notas fiscais do período.</p>
                </div>
              ) : produtosMonofasicosFiltrados.length === 0 ? (
                <div className="p-12 text-center bg-slate-50 rounded-2xl border border-slate-200">
                  <Sparkles size={36} className="text-slate-400 mx-auto mb-3" />
                  <h4 className="font-bold text-slate-800 text-base">Nenhum Produto Monofásico Encontrado</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    {buscaMonofasico 
                      ? 'Nenhum resultado corresponde ao termo pesquisado. Tente limpar a busca.' 
                      : 'Não foram localizados produtos com CST 04/06 ou NCM monofásico para o filtro selecionado nesta competência.'
                    }
                  </p>
                </div>
              ) : modoAgrupamentoMonofasico === 'cupom' ? (
                
                /* TABELA MODO 1: ANALÍTICO POR CUPOM COM AUDITORIA NCM */
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs custom-scrollbar w-full">
                  <table className="w-full text-left border-collapse min-w-[1050px]">
                    <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur-xs border-b border-slate-200 shadow-2xs">
                      <tr className="bg-slate-100/80 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                        <ResizableSortableTh
                          columnId="cupom"
                          label="Cupom / Nota Fiscal"
                          sortKey="cupom"
                          currentSortKey={sortKeyMonoCupom}
                          currentSortDirection={sortDirMonoCupom}
                          onSort={handleSortMonoCupom}
                          width={colWidthsMonoCupom.cupom}
                          onResize={handleResizeMonoCupom}
                          minWidth={140}
                        />
                        <ResizableSortableTh
                          columnId="produto"
                          label="Produto"
                          sortKey="produto"
                          currentSortKey={sortKeyMonoCupom}
                          currentSortDirection={sortDirMonoCupom}
                          onSort={handleSortMonoCupom}
                          width={colWidthsMonoCupom.produto}
                          onResize={handleResizeMonoCupom}
                          minWidth={180}
                        />
                        <ResizableSortableTh
                          columnId="ncm"
                          label="NCM & Classificação"
                          sortKey="ncm"
                          currentSortKey={sortKeyMonoCupom}
                          currentSortDirection={sortDirMonoCupom}
                          onSort={handleSortMonoCupom}
                          width={colWidthsMonoCupom.ncm}
                          onResize={handleResizeMonoCupom}
                          minWidth={160}
                        />
                        <ResizableSortableTh
                          columnId="conformidade"
                          label="Auditoria NCM & CST"
                          sortKey="conformidade"
                          currentSortKey={sortKeyMonoCupom}
                          currentSortDirection={sortDirMonoCupom}
                          onSort={handleSortMonoCupom}
                          width={colWidthsMonoCupom.conformidade}
                          onResize={handleResizeMonoCupom}
                          minWidth={160}
                        />
                        <ResizableSortableTh
                          columnId="cfopCst"
                          label="CFOP & CST"
                          sortKey="cfopCst"
                          currentSortKey={sortKeyMonoCupom}
                          currentSortDirection={sortDirMonoCupom}
                          onSort={handleSortMonoCupom}
                          width={colWidthsMonoCupom.cfopCst}
                          onResize={handleResizeMonoCupom}
                          minWidth={110}
                        />
                        <ResizableSortableTh
                          columnId="qtd"
                          label="Qtd"
                          sortKey="qtd"
                          currentSortKey={sortKeyMonoCupom}
                          currentSortDirection={sortDirMonoCupom}
                          onSort={handleSortMonoCupom}
                          width={colWidthsMonoCupom.qtd}
                          onResize={handleResizeMonoCupom}
                          minWidth={80}
                          align="right"
                        />
                        <ResizableSortableTh
                          columnId="vlrUnit"
                          label="Vlr Unit"
                          sortKey="vlrUnit"
                          currentSortKey={sortKeyMonoCupom}
                          currentSortDirection={sortDirMonoCupom}
                          onSort={handleSortMonoCupom}
                          width={colWidthsMonoCupom.vlrUnit}
                          onResize={handleResizeMonoCupom}
                          minWidth={95}
                          align="right"
                        />
                        <ResizableSortableTh
                          columnId="total"
                          label="Total Monofásico"
                          sortKey="total"
                          currentSortKey={sortKeyMonoCupom}
                          currentSortDirection={sortDirMonoCupom}
                          onSort={handleSortMonoCupom}
                          width={colWidthsMonoCupom.total}
                          onResize={handleResizeMonoCupom}
                          minWidth={120}
                          align="right"
                        />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm bg-white">
                      {produtosMonofasicosFiltradosPaginados.map((item: any) => {
                        const isRegular = item.status_conformidade === 'regular'
                        return (
                          <tr key={item.id} className="hover:bg-amber-50/30 transition">
                            <td className="p-3.5 whitespace-nowrap truncate">
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-extrabold rounded-md">
                                  {item.modelo === '65' ? 'NFC-e' : 'NF-e'} Nº {item.cupom_numero}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-400 mt-1">
                                {item.data_emissao ? new Date(item.data_emissao).toLocaleDateString('pt-BR') : '—'} {item.hora_emissao ? `às ${item.hora_emissao}` : ''}
                              </div>
                            </td>

                            <td className="p-3.5 truncate">
                              <span className="font-bold text-slate-900 block truncate">{item.xProd}</span>
                              <span className="text-[11px] text-slate-400 font-mono">Cód: {item.cProd}</span>
                            </td>

                            <td className="p-3.5 whitespace-nowrap truncate">
                              <span className="font-mono text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-md">
                                {item.ncm_formatado}
                              </span>
                              <span className="text-xs text-slate-600 block mt-1 font-medium truncate max-w-[220px]" title={item.descricao_ncm}>
                                {item.descricao_ncm} ({item.categoria})
                              </span>
                            </td>

                            {/* Coluna de Auditoria NCM e Conformidade */}
                            <td className="p-3.5 whitespace-nowrap">
                              {isRegular ? (
                                <div className="flex flex-col">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold">
                                    <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
                                    Conforme (CST {item.cst})
                                  </span>
                                  <span className="text-[10px] text-slate-400 mt-0.5">Alíquota zero no XML</span>
                                </div>
                              ) : (
                                <div className="flex flex-col" title={item.status_descricao || 'NCM Monofásico emitido com CST tributado'}>
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-300 text-amber-900 text-[11px] font-bold">
                                    <AlertTriangle size={12} className="text-amber-600 shrink-0" />
                                    Divergência (CST {item.cst})
                                  </span>
                                  <span className="text-[10px] text-amber-700 font-semibold mt-0.5">NCM Monofásico c/ Tributação</span>
                                </div>
                              )}
                            </td>

                            <td className="p-3.5 whitespace-nowrap truncate">
                              <span className="text-xs text-slate-600 font-mono font-medium block">CFOP: {item.cfop}</span>
                              <span className="text-[11px] font-mono font-bold text-slate-700">
                                CST: {item.cst}
                              </span>
                            </td>

                            <td className="p-3.5 text-right whitespace-nowrap truncate">
                              <span className="font-semibold text-slate-800">
                                {Number(item.qCom || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                              <span className="text-xs text-slate-400 ml-1">{item.uCom}</span>
                            </td>

                            <td className="p-3.5 text-right whitespace-nowrap text-slate-600 text-xs truncate">
                              R$ {Number(item.vUnCom || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </td>

                            <td className="p-3.5 text-right whitespace-nowrap truncate">
                              <span className="font-bold text-amber-700 text-base">
                                R$ {Number(item.vProd || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>

                  {/* Paginação do Modo Analítico */}
                  <Pagination
                    currentPage={pageMonofasico}
                    totalItems={produtosMonofasicosFiltrados.length}
                    pageSize={pageSizeMonofasico}
                    onPageChange={setPageMonofasico}
                    onPageSizeChange={setPageSizeMonofasico}
                    itemLabel="itens monofásicos"
                  />
                </div>

              ) : (

                /* TABELA MODO 2: AGRUPADO POR PRODUTO / NCM COM DIAGNÓSTICO FISCAL */
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs custom-scrollbar w-full">
                  <table className="w-full text-left border-collapse min-w-[1050px]">
                    <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur-xs border-b border-slate-200 shadow-2xs">
                      <tr className="bg-slate-100/80 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                        <ResizableSortableTh
                          columnId="ncm"
                          label="NCM & Classificação"
                          sortKey="ncm"
                          currentSortKey={sortKeyMonoNcm}
                          currentSortDirection={sortDirMonoNcm}
                          onSort={handleSortMonoNcm}
                          width={colWidthsMonoNcm.ncm}
                          onResize={handleResizeMonoNcm}
                          minWidth={160}
                        />
                        <ResizableSortableTh
                          columnId="produto"
                          label="Produto"
                          sortKey="produto"
                          currentSortKey={sortKeyMonoNcm}
                          currentSortDirection={sortDirMonoNcm}
                          onSort={handleSortMonoNcm}
                          width={colWidthsMonoNcm.produto}
                          onResize={handleResizeMonoNcm}
                          minWidth={180}
                        />
                        <ResizableSortableTh
                          columnId="conformidade"
                          label="Diagnóstico Fiscal"
                          sortKey="conformidade"
                          currentSortKey={sortKeyMonoNcm}
                          currentSortDirection={sortDirMonoNcm}
                          onSort={handleSortMonoNcm}
                          width={colWidthsMonoNcm.conformidade}
                          onResize={handleResizeMonoNcm}
                          minWidth={150}
                        />
                        <ResizableSortableTh
                          columnId="cupons"
                          label="Cupons"
                          sortKey="cupons"
                          currentSortKey={sortKeyMonoNcm}
                          currentSortDirection={sortDirMonoNcm}
                          onSort={handleSortMonoNcm}
                          width={colWidthsMonoNcm.cupons}
                          onResize={handleResizeMonoNcm}
                          minWidth={95}
                          align="center"
                        />
                        <ResizableSortableTh
                          columnId="qtdTotal"
                          label="Qtd Total"
                          sortKey="qtdTotal"
                          currentSortKey={sortKeyMonoNcm}
                          currentSortDirection={sortDirMonoNcm}
                          onSort={handleSortMonoNcm}
                          width={colWidthsMonoNcm.qtdTotal}
                          onResize={handleResizeMonoNcm}
                          minWidth={95}
                          align="right"
                        />
                        <ResizableSortableTh
                          columnId="precoMedio"
                          label="Preço Médio"
                          sortKey="precoMedio"
                          currentSortKey={sortKeyMonoNcm}
                          currentSortDirection={sortDirMonoNcm}
                          onSort={handleSortMonoNcm}
                          width={colWidthsMonoNcm.precoMedio}
                          onResize={handleResizeMonoNcm}
                          minWidth={110}
                          align="right"
                        />
                        <ResizableSortableTh
                          columnId="total"
                          label="Total Monofásico"
                          sortKey="total"
                          currentSortKey={sortKeyMonoNcm}
                          currentSortDirection={sortDirMonoNcm}
                          onSort={handleSortMonoNcm}
                          width={colWidthsMonoNcm.total}
                          onResize={handleResizeMonoNcm}
                          minWidth={130}
                          align="right"
                        />
                        <ResizableSortableTh
                          columnId="percentual"
                          label="% do Total"
                          sortKey="percentual"
                          currentSortKey={sortKeyMonoNcm}
                          currentSortDirection={sortDirMonoNcm}
                          onSort={handleSortMonoNcm}
                          width={colWidthsMonoNcm.percentual}
                          onResize={handleResizeMonoNcm}
                          minWidth={100}
                          align="right"
                        />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm bg-white">
                      {produtosMonofasicosAgrupadosPaginados.map((item: any, idx: number) => (
                        <tr key={idx} className="hover:bg-amber-50/30 transition">
                          <td className="p-3.5 whitespace-nowrap truncate">
                            <span className="font-mono text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-md">
                              {item.ncm_formatado}
                            </span>
                            <span className="text-xs text-slate-600 block mt-1 font-medium truncate" title={item.descricao_ncm}>
                              {item.descricao_ncm} ({item.categoria})
                            </span>
                          </td>

                          <td className="p-3.5 truncate">
                            <span className="font-bold text-slate-900 block truncate">{item.xProd}</span>
                            <span className="text-[11px] text-slate-400 font-mono">Cód: {item.cProd}</span>
                          </td>

                          {/* Diagnóstico Fiscal no Sintético */}
                          <td className="p-3.5 whitespace-nowrap">
                            {item.tem_divergencia ? (
                              <div>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-300 text-amber-900 text-[11px] font-bold">
                                  <AlertTriangle size={12} className="text-amber-600 shrink-0" />
                                  Divergente ({item.qtd_divergentes} vendas)
                                </span>
                                <span className="text-[10px] text-amber-700 block mt-0.5 font-medium">
                                  R$ {Number(item.valor_divergente || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} recuperável
                                </span>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold">
                                <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
                                100% Conforme
                              </span>
                            )}
                          </td>

                          <td className="p-3.5 text-center whitespace-nowrap truncate">
                            <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-lg border border-blue-200/50">
                              {item.qtd_cupons} cupom(ns)
                            </span>
                          </td>

                          <td className="p-3.5 text-right whitespace-nowrap truncate">
                            <span className="font-bold text-slate-800">
                              {Number(item.qtd_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                            <span className="text-xs text-slate-400 ml-1">{item.uCom}</span>
                          </td>

                          <td className="p-3.5 text-right whitespace-nowrap text-slate-600 text-xs truncate">
                            R$ {Number(item.preco_medio || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>

                          <td className="p-3.5 text-right whitespace-nowrap truncate">
                            <span className="font-bold text-amber-700 text-base">
                              R$ {Number(item.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </td>

                          <td className="p-3.5 text-right whitespace-nowrap truncate">
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-xs font-bold text-slate-700">
                                {Number(item.percentual || 0).toFixed(1)}%
                              </span>
                              <div className="w-12 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                <div 
                                  className="bg-amber-500 h-1.5 rounded-full" 
                                  style={{ width: `${Math.min(100, Math.max(2, item.percentual || 0))}%` }}
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Paginação do Modo Agrupado */}
                  <Pagination
                    currentPage={pageMonofasico}
                    totalItems={produtosMonofasicosAgrupados.length}
                    pageSize={pageSizeMonofasico}
                    onPageChange={setPageMonofasico}
                    onPageSizeChange={setPageSizeMonofasico}
                    itemLabel="produtos agrupados"
                  />
                </div>

              )}

            </div>
          </div>
        )}

        {/* ABA 3: QUEBRA DE SEQUÊNCIA */}
        {activeTab === 'quebra' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-xl font-bold text-slate-900 mb-1 flex items-center gap-2">
                  <Hash className="text-red-600" size={24} />
                  Relatório de Quebra de Sequência de Numeração
                </h3>
                <p className="text-sm text-slate-500">
                  Identificação automática de números de notas que foram pulados ou faltam na sequência cronológica da SEFAZ.
                </p>
              </div>

              <div className="flex items-center gap-1.5 bg-red-50/50 p-1.5 rounded-xl border border-red-200">
                <span className="text-xs font-semibold text-red-800 px-2">Baixar Quebras:</span>
                <button
                  onClick={() => handleExportar('quebra', 'pdf')}
                  className="px-2.5 py-1.5 text-xs font-semibold text-rose-700 bg-white hover:bg-rose-50 border border-rose-200 rounded-lg transition flex items-center gap-1 shadow-2xs"
                >
                  <FileText size={13} className="text-rose-600" /> PDF
                </button>
                <button
                  onClick={() => handleExportar('quebra', 'xls')}
                  className="px-2.5 py-1.5 text-xs font-semibold text-emerald-700 bg-white hover:bg-emerald-50 border border-emerald-200 rounded-lg transition flex items-center gap-1 shadow-2xs"
                >
                  <FileSpreadsheet size={13} className="text-emerald-600" /> XLS
                </button>
                <button
                  onClick={() => handleExportar('quebra', 'csv')}
                  className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition flex items-center gap-1 shadow-2xs"
                >
                  <Download size={13} className="text-slate-500" /> CSV
                </button>
              </div>
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
                    {quebrasPaginadas.map((q: any, idx: number) => (
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

                {/* Paginação de Quebras */}
                <Pagination
                  currentPage={pageQuebras}
                  totalItems={quebras.length}
                  pageSize={pageSizeQuebras}
                  onPageChange={setPageQuebras}
                  onPageSizeChange={setPageSizeQuebras}
                  itemLabel="quebras de sequência"
                />
              </div>
            )}
          </div>
        )}

        {/* ABA 4: NÃO ASSINADAS / SEM PROTOCOLO */}
        {activeTab === 'nao_assinadas' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-xl font-bold text-slate-900 mb-1 flex items-center gap-2">
                  <ShieldAlert className="text-orange-600" size={24} />
                  Notas Não Assinadas ou Sem Protocolo SEFAZ
                </h3>
                <p className="text-sm text-slate-500">
                  Arquivos XML locais que não contêm a assinatura digital válida ou autorização de uso (cStat != 100).
                </p>
              </div>

              <div className="flex items-center gap-1.5 bg-orange-50/50 p-1.5 rounded-xl border border-orange-200">
                <span className="text-xs font-semibold text-orange-800 px-2">Baixar Pendentes:</span>
                <button
                  onClick={() => handleExportar('nao_assinadas', 'pdf')}
                  className="px-2.5 py-1.5 text-xs font-semibold text-rose-700 bg-white hover:bg-rose-50 border border-rose-200 rounded-lg transition flex items-center gap-1 shadow-2xs"
                >
                  <FileText size={13} className="text-rose-600" /> PDF
                </button>
                <button
                  onClick={() => handleExportar('nao_assinadas', 'xls')}
                  className="px-2.5 py-1.5 text-xs font-semibold text-emerald-700 bg-white hover:bg-emerald-50 border border-emerald-200 rounded-lg transition flex items-center gap-1 shadow-2xs"
                >
                  <FileSpreadsheet size={13} className="text-emerald-600" /> XLS
                </button>
                <button
                  onClick={() => handleExportar('nao_assinadas', 'csv')}
                  className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition flex items-center gap-1 shadow-2xs"
                >
                  <Download size={13} className="text-slate-500" /> CSV
                </button>
              </div>
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
                    {naoAssinadasPaginadas.map((n: any) => (
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

                {/* Paginação de Não Assinadas */}
                <Pagination
                  currentPage={pageNaoAssinadas}
                  totalItems={listaNaoAssinadas.length}
                  pageSize={pageSizeNaoAssinadas}
                  onPageChange={setPageNaoAssinadas}
                  onPageSizeChange={setPageSizeNaoAssinadas}
                  itemLabel="notas pendentes"
                />
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

              <div className="flex items-center gap-1.5 bg-amber-50/50 p-1.5 rounded-xl border border-amber-200">
                <span className="text-xs font-semibold text-amber-800 px-2">Baixar Certificados:</span>
                <button
                  onClick={() => handleExportar('certificados', 'pdf')}
                  className="px-2.5 py-1.5 text-xs font-semibold text-rose-700 bg-white hover:bg-rose-50 border border-rose-200 rounded-lg transition flex items-center gap-1 shadow-2xs"
                >
                  <FileText size={13} className="text-rose-600" /> PDF
                </button>
                <button
                  onClick={() => handleExportar('certificados', 'xls')}
                  className="px-2.5 py-1.5 text-xs font-semibold text-emerald-700 bg-white hover:bg-emerald-50 border border-emerald-200 rounded-lg transition flex items-center gap-1 shadow-2xs"
                >
                  <FileSpreadsheet size={13} className="text-emerald-600" /> XLS
                </button>
                <button
                  onClick={() => handleExportar('certificados', 'csv')}
                  className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition flex items-center gap-1 shadow-2xs"
                >
                  <Download size={13} className="text-slate-500" /> CSV
                </button>
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

              const clisCertPaginados = clisCert.slice(
                (pageCertificados - 1) * pageSizeCertificados,
                pageCertificados * pageSizeCertificados
              )

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
                          <th className="p-4">CNPJ / CPF</th>
                          <th className="p-4">Contabilidade</th>
                          <th className="p-4">Data de Validade</th>
                          <th className="p-4">Dias Restantes</th>
                          <th className="p-4 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {clisCertPaginados.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-8 text-center text-slate-400">
                              Nenhuma empresa encontrada para exibição.
                            </td>
                          </tr>
                        ) : (
                          clisCertPaginados.map(c => (
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

                    {/* Paginação de Certificados */}
                    <Pagination
                      currentPage={pageCertificados}
                      totalItems={clisCert.length}
                      pageSize={pageSizeCertificados}
                      onPageChange={setPageCertificados}
                      onPageSizeChange={setPageSizeCertificados}
                      itemLabel="empresas / certificados"
                    />
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
