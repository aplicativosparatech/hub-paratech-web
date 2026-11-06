'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useSearchParams } from 'next/navigation'
import { 
  RefreshCw, Trash2, AlertTriangle, Sparkles, Sliders, CheckCircle2, 
  ShieldAlert, FileText, ArrowRight, Calendar, Filter, Search, RotateCcw, Clock, X, Download,
  Printer, ExternalLink 
} from 'lucide-react'
import toast from 'react-hot-toast'
import Link from 'next/link'
import Pagination from '@/components/Pagination'
import { useNotasFiscaisFilters } from './NotasFiscaisFilterContext'
import { formatarDataBrasil, 
  formatarHoraBrasil, 
  extrairCompetenciaBrasil, 
  extrairDataIsoBrasil 
} from '@/utils/dateBrasil'
import { limparDocumento, formatarCnpjCpf } from '@/utils/cnpjAlfanumerico'
import { useTableFeatures } from '@/hooks/useTableFeatures'
import { ResizableSortableTh } from '@/components/ui/ResizableSortableTh'
import CompetenciaSelector from '@/components/CompetenciaSelector'

export default function TabelaCorrecao() {
  const supabase = createClient()
  const {
    userRole,
    clientes,
    loadingClientes,
    selectedCliente,
    setSelectedCliente,
    clientSearchTerm,
    setClientSearchTerm,
    filtroMes,
    setFiltroMes,
    dataInicio,
    setDataInicio,
    dataFim,
    setDataFim,
    buscaNumero,
    setBuscaNumero,
    buscaGeral,
    setBuscaGeral,
    pageSize,
    setPageSize,
    temFiltroAtivo,
    limparFiltros,
  } = useNotasFiscaisFilters()

  const [notas, setNotas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Paginação
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [ultimaConsultaHora, setUltimaConsultaHora] = useState<string>('')

  // Modais
  const [modalManual, setModalManual] = useState<{
    open: boolean
    nota?: any
    nProt: string
    dhRecbto: string
    digVal: string
    verAplic: string
  }>({
    open: false,
    nProt: '',
    dhRecbto: '',
    digVal: '',
    verAplic: 'W-1.5.11'
  })

  const [modalDelete, setModalDelete] = useState<{
    open: boolean
    tipo: 'individual' | 'em_lote'
    id?: string
    tabela?: string
    numero?: string
    idsLote?: { id: string; tabela: string }[]
  }>({ open: false, tipo: 'individual' })

  const [corrigindoId, setCorrigindoId] = useState<string | null>(null)
  const [processandoLote, setProcessandoLote] = useState(false)
  const [salvandoManual, setSalvandoManual] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [itensObsoletos, setItensObsoletos] = useState<any[]>([])
  const [modalSaneamentoOpen, setModalSaneamentoOpen] = useState(false)
  const [saneando, setSaneando] = useState(false)

  const [ultimaSincronizacaoHub, setUltimaSincronizacaoHub] = useState<string | null>(null)

  // Busca horário da última sincronização do Hub
  async function loadUltimaSincronizacao() {
    try {
      let query = supabase.from('configuracoes_hub').select('ultima_sincronizacao').order('ultima_sincronizacao', { ascending: false }).limit(1)
      if (selectedCliente) {
        query = query.eq('cliente_id', selectedCliente)
      }
      const { data } = await query
      if (data && data.length > 0 && data[0].ultima_sincronizacao) {
        setUltimaSincronizacaoHub(data[0].ultima_sincronizacao)
      } else {
        setUltimaSincronizacaoHub(null)
      }
    } catch (e) {
      console.warn('Erro ao carregar ultima sincronizacao:', e)
    }
  }

  // Carrega notas com pendências de correção (nfce_saidas e nfe_saidas)
  async function loadNotas() {
    setLoading(true)
    const agora = new Date()
    setUltimaConsultaHora(agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    loadUltimaSincronizacao()

    const targetClienteId = selectedCliente || (clientes?.length > 0 ? clientes[0].id : null)

    if (!targetClienteId) {
      setNotas([])
      setLoading(false)
      return
    }

    // Busca em nfce_saidas estritamente da empresa selecionada
    const queryNfce = supabase.from('nfce_saidas').select('*').eq('cliente_id', targetClienteId).order('data_emissao', { ascending: false })

    // Busca em nfe_saidas estritamente da empresa selecionada
    const queryNfe = supabase.from('nfe_saidas').select('*').eq('cliente_id', targetClienteId).order('data_emissao', { ascending: false })

    // Busca em nfe_entradas estritamente da empresa selecionada
    const queryEntradas = supabase.from('nfe_entradas').select('*').eq('cliente_id', targetClienteId).order('data_emissao', { ascending: false })

    const [resNfce, resNfe, resEntradas] = await Promise.all([queryNfce, queryNfe, queryEntradas])

    const currentCli = clientes.find(c => c.id === targetClienteId) || (userRole === 'cliente' ? clientes[0] : null)
    const cleanCurrentCnpj = limparDocumento(currentCli?.cnpj)
    const isAssociacao = Boolean(currentCli?.is_associacao)

    const pendentesNfce = (resNfce.data || [])
      .filter((n: any) => {
        const isAut = n.is_autorizada === true || n.cstat === '100' || (Boolean(n.protocolo) && Boolean(n.tem_assinatura))
        const cleanChaveCnpj = n.chave && n.chave.length === 44 ? n.chave.substring(6, 20) : ''
        const emit = limparDocumento(n.cnpj_emitente || cleanChaveCnpj)
        const isDivergente = Boolean(cleanCurrentCnpj) && Boolean(emit) && cleanCurrentCnpj !== emit
        return !isAut || !n.tem_assinatura || n.cnpj_divergente || isDivergente
      })
      .map((n: any) => ({ ...n, _tabela: 'nfce_saidas', _tipo: 'NFC-e (Mod 65)' }))

    const pendentesNfe = (resNfe.data || [])
      .filter((n: any) => {
        const isAut = n.is_autorizada === true || n.cstat === '100' || (Boolean(n.protocolo) && Boolean(n.tem_assinatura))
        const cleanChaveCnpj = n.chave && n.chave.length === 44 ? n.chave.substring(6, 20) : ''
        const emit = limparDocumento(n.cnpj_emitente || cleanChaveCnpj)
        const isDivergente = Boolean(cleanCurrentCnpj) && Boolean(emit) && cleanCurrentCnpj !== emit
        return !isAut || !n.tem_assinatura || n.cnpj_divergente || isDivergente
      })
      .map((n: any) => ({ ...n, _tabela: 'nfe_saidas', _tipo: 'NF-e (Mod 55)' }))

    const pendentesEntradas = (resEntradas.data || [])
      .filter((n: any) => {
        const isAut = n.is_autorizada === true || n.cstat === '100' || Boolean(n.protocolo)
        const cleanChaveCnpj = n.chave && n.chave.length === 44 ? n.chave.substring(6, 20) : ''
        const emit = limparDocumento(n.cnpj_emitente || cleanChaveCnpj)
        const emitentePropriaEmpresa = !isAssociacao && Boolean(cleanCurrentCnpj) && Boolean(emit) && cleanCurrentCnpj === emit
        return !isAut || n.cnpj_divergente || emitentePropriaEmpresa
      })
      .map((n: any) => ({ ...n, _tabela: 'nfe_entradas', _tipo: 'NF-e de Entrada' }))

    const todasPendentes = [...pendentesNfce, ...pendentesNfe, ...pendentesEntradas]

    // Diagnóstico inteligente e 100% seguro de tentativas rejeitadas já regularizadas na nuvem
    try {
      const diagRes = await fetch('/api/notas-fiscais/sanear-quarentena', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_id: targetClienteId,
          acao: 'diagnosticar'
        })
      })
      if (diagRes.ok) {
        const diagData = await diagRes.json()
        if (diagData.success && Array.isArray(diagData.itens)) {
          setItensObsoletos(diagData.itens)
          const mapaSubstitutas = new Map(diagData.itens.map((it: any) => [it.id, it.nota_oficial]))
          const pendentesComSubstituta = todasPendentes.map(n => ({
            ...n,
            nota_oficial_substituta: mapaSubstitutas.get(n.id) || null
          }))
          setNotas(pendentesComSubstituta)
          setLoading(false)
          return
        }
      }
    } catch (errDiag) {
      console.warn('Falha no diagnóstico automático de quarentena:', errDiag)
    }

    setItensObsoletos([])
    setNotas(todasPendentes)
    setLoading(false)
  }

  useEffect(() => {
    if (!loadingClientes) {
      loadNotas()
    }
  }, [selectedCliente, loadingClientes])

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

  // Filtragem Dinâmica das Notas em Quarentena (por Mês, Data de Emissão, Número e Busca Geral)
  const notasFiltradas = useMemo(() => {
    return notas.filter(n => {
      // 1. Filtro por Mês de Competência (YYYY-MM) no fuso de Minas Gerais / SEFAZ
      if (filtroMes) {
        const emissaoMes = extrairCompetenciaBrasil(n.data_emissao, n.chave)
        if (emissaoMes !== filtroMes) return false
      }

      // 2. Filtro por Intervalo de Data de Emissão no fuso de Minas Gerais / Brasil
      if (dataInicio || dataFim) {
        const emissaoData = extrairDataIsoBrasil(n.data_emissao)
        if (dataInicio && emissaoData < dataInicio) return false
        if (dataFim && emissaoData > dataFim) return false
      }

      // 3. Filtro por Número da Nota ou Chave
      if (buscaNumero.trim()) {
        const term = buscaNumero.trim().toLowerCase()
        const num = String(n.numero || '').toLowerCase()
        const chave = String(n.chave || '').toLowerCase()
        if (!num.includes(term) && !chave.includes(term)) return false
      }

      // 4. Busca Geral (CNPJ, Emitente, Valor)
      if (buscaGeral.trim()) {
        const term = buscaGeral.trim().toLowerCase()
        const emit = String(n.cnpj_emitente || '').toLowerCase()
        const num = String(n.numero || '').toLowerCase()
        const chave = String(n.chave || '').toLowerCase()
        const valor = String(n.valor || '').toLowerCase()
        if (!emit.includes(term) && !num.includes(term) && !chave.includes(term) && !valor.includes(term)) {
          return false
        }
      }

      return true
    })
  }, [notas, filtroMes, dataInicio, dataFim, buscaNumero, buscaGeral])

  // Resetar para página 1 ao alterar qualquer filtro
  useEffect(() => {
    setCurrentPage(1)
  }, [filtroMes, dataInicio, dataFim, buscaNumero, buscaGeral, selectedCliente, pageSize])

  // Hook de Ordenação e Redimensionamento de Colunas
  const {
    sortedData: notasOrdenadas,
    sortKey,
    sortDirection,
    handleSort,
    columnWidths,
    handleResizeColumn
  } = useTableFeatures({
    data: notasFiltradas,
    tableId: 'tabela_correcao',
    defaultSortKey: 'emissao',
    defaultSortDirection: 'desc',
    initialWidths: {
      tipo: 110,
      numero: 140,
      chave: 320,
      valor: 130,
      emissao: 130,
      diagnostico: 240,
      acoes: 220
    },
    customExtractors: {
      tipo: (n: any) => n._tipo || '',
      numero: (n: any) => Number(n.numero || 0),
      chave: (n: any) => n.chave || '',
      valor: (n: any) => Number(n.valor || 0),
      emissao: (n: any) => n.data_emissao || '',
      diagnostico: (n: any) => (!n.tem_assinatura ? 'Sem Assinatura' : !n.is_autorizada ? 'Sem Protocolo' : n.cstat || '')
    }
  })

  // Paginação dos registros filtrados e ordenados
  const notasPaginadas = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return notasOrdenadas.slice(start, start + pageSize)
  }, [notasOrdenadas, currentPage, pageSize])

  const syncInfo = formatRelativeSync(ultimaSincronizacaoHub)

  // Download Individual de XML
  const handleDownloadXml = (nota: any) => {
    try {
      const url = `/api/notas-fiscais/download-xml?tabela=${nota._tabela}&id=${nota.id}`
      const a = document.createElement('a')
      a.href = url
      a.download = `${nota.chave || nota.numero || 'nota_fiscal'}.xml`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      toast.success(`Download do XML ${nota.numero ? 'Nº ' + nota.numero : ''} iniciado!`)
    } catch (err: any) {
      toast.error('Erro ao baixar XML: ' + (err.message || 'Falha no download'))
    }
  }

  // Ação 1: Consultar e Corrigir via SEFAZ
  const handleCorrigirSefaz = async (nota: any) => {
    setCorrigindoId(nota.id)
    const toastId = toast.loading(`Consultando SEFAZ para a nota ${nota.numero || nota.chave.substring(25, 34)}...`)

    try {
      const res = await fetch('/api/sefaz/corrigir-nota', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nota_id: nota.id,
          tabela: nota._tabela
        })
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || `SEFAZ: ${data.xMotivo || 'Falha na consulta'}`)
      }

      toast.success(data.message || 'Nota autorizada e corrigida com sucesso!', { id: toastId })
      // Remove da lista de correção
      setNotas(prev => prev.filter(n => n.id !== nota.id))
    } catch (err: any) {
      toast.error(err.message || 'Erro ao consultar SEFAZ', { id: toastId })
      loadNotas()
    } finally {
      setCorrigindoId(null)
    }
  }

  // Ação 2: Corrigir Todas via SEFAZ em Lote
  const handleCorrigirLote = async () => {
    if (notas.length === 0) return
    setProcessandoLote(true)
    const toastId = toast.loading(`Iniciando consulta e correção de ${notas.length} notas na SEFAZ...`)

    let sucesso = 0
    let falhas = 0

    let ultimoErro = ''

    for (const nota of notas) {
      try {
        const res = await fetch('/api/sefaz/corrigir-nota', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nota_id: nota.id,
            tabela: nota._tabela
          })
        })
        const data = await res.json()
        if (res.ok && data.success) {
          sucesso++
        } else {
          falhas++
          if (!ultimoErro && (data.error || data.xMotivo)) {
            ultimoErro = data.error || data.xMotivo
          }
        }
      } catch (err: any) {
        falhas++
        if (!ultimoErro) ultimoErro = err.message
      }
    }

    setProcessandoLote(false)
    if (sucesso > 0) {
      toast.success(`${sucesso} nota(s) corrigida(s) e autorizada(s) via SEFAZ!`, { id: toastId })
    } else {
      const msg = ultimoErro ? `Nenhuma nota autorizada (${falhas} falhas): ${ultimoErro}` : `Nenhuma nota pôde ser autorizada pela SEFAZ (${falhas} falhas). Verifique o certificado ou situação na SEFAZ.`
      toast.error(msg, { id: toastId })
    }
    loadNotas()
  }

  // Ação 2.5: Executar Saneamento Seguro de Tentativas Obsoletas
  const handleExecutarSaneamento = async (ids?: string[]) => {
    const targetClienteId = selectedCliente || (clientes?.length > 0 ? clientes[0].id : null)
    if (!targetClienteId) return

    setSaneando(true)
    const toastId = toast.loading('Saneando arquivos rejeitados obsoletos...')
    try {
      const res = await fetch('/api/notas-fiscais/sanear-quarentena', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_id: targetClienteId,
          acao: 'executar',
          ids_para_excluir: ids
        })
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Falha ao executar saneamento')
      }

      toast.success(data.message || `${data.total_removidas} tentativa(s) obsoleta(s) removida(s) com sucesso!`, { id: toastId })
      setModalSaneamentoOpen(false)
      loadNotas()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao sanear notas', { id: toastId })
    } finally {
      setSaneando(false)
    }
  }

  // Ação 3: Salvar Correção Manual
  const handleSalvarManual = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!modalManual.nota) return

    setSalvandoManual(true)
    const toastId = toast.loading('Assinando e anexando protocolo ao XML...')

    try {
      const res = await fetch('/api/sefaz/corrigir-nota', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nota_id: modalManual.nota.id,
          tabela: modalManual.nota._tabela,
          manualData: {
            nProt: modalManual.nProt,
            dhRecbto: modalManual.dhRecbto,
            digVal: modalManual.digVal,
            verAplic: modalManual.verAplic,
            cStat: '100',
            xMotivo: 'Autorizado o uso da NF-e'
          }
        })
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erro ao processar correção manual.')
      }

      toast.success('XML corrigido, assinado e aprovado com sucesso!', { id: toastId })
      setNotas(prev => prev.filter(n => n.id !== modalManual.nota.id))
      setModalManual({ open: false, nProt: '', dhRecbto: '', digVal: '', verAplic: 'W-1.5.11' })
    } catch (err: any) {
      toast.error(err.message || 'Falha ao salvar correção manual.', { id: toastId })
    } finally {
      setSalvandoManual(false)
    }
  }

  // Ação 4: Excluir
  const confirmDeleteAction = async () => {
    setDeleting(true)
    try {
      if (modalDelete.tipo === 'individual' && modalDelete.id && modalDelete.tabela) {
        const { error } = await supabase.from(modalDelete.tabela).delete().eq('id', modalDelete.id)
        if (error) throw error
        setNotas(prev => prev.filter(n => n.id !== modalDelete.id))
        toast.success(`Nota fiscal ${modalDelete.numero || ''} excluída com sucesso!`)
      } else if (modalDelete.tipo === 'em_lote' && modalDelete.idsLote) {
        for (const item of modalDelete.idsLote) {
          await supabase.from(item.tabela).delete().eq('id', item.id)
        }
        setNotas([])
        toast.success(`${modalDelete.idsLote.length} arquivos incorretos excluídos com sucesso!`)
      }
    } catch (err: any) {
      toast.error('Erro ao excluir: ' + (err.message || 'Falha na exclusão'))
    } finally {
      setDeleting(false)
      setModalDelete({ open: false, tipo: 'individual' })
    }
  }

  const currentCli = clientes.find(c => c.id === selectedCliente) || (userRole === 'cliente' ? clientes[0] : null)

  return (
    <div className="space-y-4">
      {/* Barra de Filtro de Clientes */}
      {userRole !== 'cliente' && clientes.length > 0 && (
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex-1 max-w-lg space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                {userRole === 'admin' ? '🔍 Localizar Cliente (Admin)' : '🏢 Empresa Selecionada'}
              </span>
              {userRole === 'admin' && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-blue-600 font-medium">
                    {selectedCliente ? 'Filtrado por empresa' : 'Exibindo todas as empresas'}
                  </span>
                  {selectedCliente && (
                    <button
                      type="button"
                      onClick={() => { setSelectedCliente(''); setClientSearchTerm(''); }}
                      className="text-[11px] text-slate-400 hover:text-rose-600 font-semibold flex items-center gap-0.5 transition"
                      title="Exibir todas as empresas"
                    >
                      <X size={12} /> Limpar
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative w-full sm:w-1/2">
                <input 
                  type="text" 
                  placeholder="Filtrar por nome, fantasia ou CNPJ..." 
                  value={clientSearchTerm}
                  onChange={e => {
                    const term = e.target.value
                    setClientSearchTerm(term)
                    if (term.trim()) {
                      const t = term.toLowerCase().trim()
                      const ct = limparDocumento(t)
                      const match = clientes.find(c => {
                        const doc = (c.cnpj || '').toLowerCase()
                        const cleanDoc = limparDocumento(doc)
                        return (
                          (c.razao_social && c.razao_social.toLowerCase().includes(t)) ||
                          (c.nome_fantasia && c.nome_fantasia.toLowerCase().includes(t)) ||
                          doc.includes(t) ||
                          (ct && cleanDoc.includes(ct))
                        )
                      })
                      if (match && match.id !== selectedCliente) {
                        setSelectedCliente(match.id)
                      }
                    } else {
                      setSelectedCliente('')
                    }
                  }}
                  className="w-full bg-white border border-slate-200 px-3 py-1.5 pr-7 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
                {clientSearchTerm && (
                  <button
                    type="button"
                    onClick={() => { setClientSearchTerm(''); setSelectedCliente(''); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                    title="Limpar busca"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
              <select
                value={selectedCliente}
                onChange={e => setSelectedCliente(e.target.value)}
                className="w-full sm:w-1/2 bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              >
                {userRole === 'admin' && <option value="">-- Todos os Clientes --</option>}
                {clientes
                  .filter(c => {
                    if (!clientSearchTerm) return true
                    const term = clientSearchTerm.toLowerCase().trim()
                    const cleanTerm = limparDocumento(term)
                    const doc = (c.cnpj || '').toLowerCase()
                    const cleanDoc = limparDocumento(doc)
                    return (
                      (c.razao_social && c.razao_social.toLowerCase().includes(term)) ||
                      (c.nome_fantasia && c.nome_fantasia.toLowerCase().includes(term)) ||
                      doc.includes(term) ||
                      (cleanTerm && cleanDoc.includes(cleanTerm))
                    )
                  })
                  .map(c => (
                    <option key={c.id} value={c.id}>
                      {c.razao_social} {c.nome_fantasia ? `(${c.nome_fantasia})` : ''} {c.cnpj ? `— ${formatarCnpjCpf(c.cnpj)}` : ''}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="text-xs text-slate-500 text-right sm:self-end">
            <span className="font-semibold text-amber-700">{notas.length}</span> arquivo(s) aguardando correção
          </div>
        </div>
      )}

      {/* Banner Informativo Explicando o Funcionamento */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-amber-950 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 bg-amber-100 text-amber-700 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
            <AlertTriangle size={22} />
          </div>
          <div>
            <h3 className="font-bold text-sm text-amber-900">
              Quarentena de Arquivos: Notas Incompletas ou Divergentes
            </h3>
            <p className="text-xs text-amber-800 mt-1 leading-relaxed">
              Estes arquivos foram recebidos pelo Hub porém <strong>não possuem protocolo oficial da SEFAZ (&lt;protNFe&gt;) ou assinatura digital</strong> (comuns em rascunhos de PDV, pré-vendas ou contingências).
              <br />
              Para não contaminar os relatórios contábeis, eles são mantidos isolados aqui até serem corrigidos ou excluídos.
            </p>
          </div>
        </div>

        {notas.length > 0 && (
          <div className="flex flex-wrap gap-2 w-full md:w-auto justify-end">
            <button
              onClick={handleCorrigirLote}
              disabled={processandoLote}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-2"
              title="Consulta automaticamente a SEFAZ de todas as notas da lista para obter protocolo e assinar"
            >
              <Sparkles size={16} className={processandoLote ? 'animate-spin' : ''} />
              {processandoLote ? 'Processando Lote...' : `Corrigir Todas via SEFAZ (${notas.length})`}
            </button>
            <button
              onClick={() => setModalDelete({ 
                open: true, 
                tipo: 'em_lote', 
                idsLote: notas.map(n => ({ id: n.id, tabela: n._tabela })) 
              })}
              className="px-4 py-2.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
            >
              <Trash2 size={16} /> Excluir Todas
            </button>
          </div>
        )}
      </div>

      {/* Cabeçalho da Tabela com Horário da Última Sincronização */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 pb-1 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-800">Arquivos para Correção Fiscal</h2>
            <span className="text-xs bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full font-bold">
              {notas.length} pendente(s)
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-500">
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

            {/* Consulta em tela */}
            {ultimaConsultaHora && (
              <span className="text-slate-400">
                Consulta atualizada às <strong className="text-slate-600">{ultimaConsultaHora}</strong>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Ao serem corrigidas com protocolo e assinatura, as notas serão transferidas automaticamente para as abas oficiais <strong>NF-e (Mod 55)</strong> ou <strong>NFC-e (Mod 65)</strong>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {itensObsoletos.length > 0 && (
            <button
              onClick={() => setModalSaneamentoOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-sm cursor-pointer animate-pulse"
              title="Existem arquivos rejeitados cujas notas oficiais já foram autorizadas no Portal"
            >
              <Sparkles size={14} />
              Sanear Tentativas Regularizadas ({itensObsoletos.length})
            </button>
          )}

          <button 
            onClick={loadNotas} 
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> 
            Atualizar Dados
          </button>
        </div>
      </div>

      {/* BANNER DE AUTO-SANEAMENTO SEGURO */}
      {itensObsoletos.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
              <CheckCircle2 size={22} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-sm font-bold text-emerald-950">
                  {itensObsoletos.length} Arquivo(s) Rejeitado(s) já Regularizado(s) no Portal
                </h4>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-200 text-emerald-900 border border-emerald-300">
                  🛡️ Risco Zero • Nota Oficial Preservada
                </span>
              </div>
              <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                O sistema verificou e confirmou que a tentativa rejeitada da nota <strong>{itensObsoletos.map(i => `Nº ${i.numero}`).join(', ')}</strong> (erro de código numérico ou sem protocolo) <strong>já possui seu XML oficial correspondente 100% autorizado pela SEFAZ</strong> arquivado no Portal. Você pode limpar esta tentativa obsoleta com total segurança fiscal.
              </p>
            </div>
          </div>
          <button
            onClick={() => setModalSaneamentoOpen(true)}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition shadow-md shrink-0 cursor-pointer whitespace-nowrap"
          >
            <Trash2 size={14} />
            Revisar e Limpar ({itensObsoletos.length})
          </button>
        </div>
      )}

      {/* PAINEL DE FILTROS AVANÇADOS: MÊS, DATA, NÚMERO E BUSCA */}
      <div className="bg-slate-50/90 p-3.5 rounded-2xl border border-slate-200 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Filter size={14} className="text-blue-600" />
              Filtros de Arquivos em Quarentena
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs">
              <Sparkles size={11} className="text-blue-500" />
              Filtros Globais Compartilhados
            </span>
          </div>

          {temFiltroAtivo && (
            <button
              onClick={limparFiltros}
              className="text-xs text-rose-600 hover:text-rose-800 font-bold flex items-center gap-1 transition"
            >
              <RotateCcw size={12} /> Limpar Filtros
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* 1. Mês de Competência com Busca Inteligente */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
              Mês de Competência:
            </label>
            <CompetenciaSelector
              value={filtroMes}
              onChange={setFiltroMes}
              notas={notas}
              placeholder="Buscar mês (ex: Outubro, 10/2026)..."
            />
          </div>

          {/* 2. Data de Emissão (De/Até) */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
              Período de Emissão:
            </label>
            <div className="flex items-center gap-1">
              <input
                type="date"
                placeholder="De"
                value={dataInicio}
                onChange={e => setDataInicio(e.target.value)}
                className="w-1/2 bg-white border border-slate-200 px-2 py-1.5 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              />
              <span className="text-slate-400 text-xs">até</span>
              <input
                type="date"
                placeholder="Até"
                value={dataFim}
                onChange={e => setDataFim(e.target.value)}
                className="w-1/2 bg-white border border-slate-200 px-2 py-1.5 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              />
            </div>
          </div>

          {/* 3. Número da Nota ou Chave */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
              Nº da Nota ou Chave:
            </label>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Ex: 44086 ou chave..."
                value={buscaNumero}
                onChange={e => setBuscaNumero(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              />
            </div>
          </div>

          {/* 4. Busca Geral */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
              Busca Textual (CNPJ / Valor):
            </label>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Filtrar por qualquer dado..."
                value={buscaGeral}
                onChange={e => setBuscaGeral(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tabela de Arquivos para Correção */}
      {loading ? (
        <div className="text-slate-400 py-12 text-center animate-pulse">Carregando arquivos pendentes...</div>
      ) : notas.length === 0 ? (
        <div className="text-center py-16 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 size={30} />
          </div>
          <h3 className="font-bold text-slate-800 text-base">Nenhum arquivo pendente de correção!</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Todos os XMLs importados no sistema estão com assinatura digital válida e autorização confirmada pela SEFAZ.
          </p>
        </div>
      ) : notasFiltradas.length === 0 ? (
        <div className="text-center py-16 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          <div className="w-14 h-14 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Search size={28} />
          </div>
          <h3 className="font-bold text-slate-800 text-base">Nenhum arquivo encontrado</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Nenhuma nota em quarentena corresponde aos filtros aplicados.
          </p>
          <button
            onClick={limparFiltros}
            className="mt-4 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5"
          >
            <RotateCcw size={14} /> Limpar Filtros de Busca
          </button>
        </div>
      ) : (
        <div className="border border-slate-200 rounded-2xl shadow-2xs bg-white overflow-hidden flex flex-col">
          <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-290px)] custom-scrollbar">
            <table className="w-full text-left text-sm text-slate-600 min-w-[1000px]" style={{ tableLayout: 'fixed' }}>
              <thead className="sticky top-0 z-10 bg-slate-50 text-slate-500 font-medium border-b border-slate-200 shadow-2xs">
                <tr>
                <ResizableSortableTh
                  columnId="tipo"
                  label="Tipo"
                  sortKey="tipo"
                  currentSortKey={sortKey}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                  width={columnWidths.tipo}
                  onResize={handleResizeColumn}
                  minWidth={90}
                />
                <ResizableSortableTh
                  columnId="numero"
                  label="Número / Série"
                  sortKey="numero"
                  currentSortKey={sortKey}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                  width={columnWidths.numero}
                  onResize={handleResizeColumn}
                  minWidth={120}
                />
                <ResizableSortableTh
                  columnId="chave"
                  label="Chave de Acesso"
                  sortKey="chave"
                  currentSortKey={sortKey}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                  width={columnWidths.chave}
                  onResize={handleResizeColumn}
                  minWidth={200}
                />
                <ResizableSortableTh
                  columnId="valor"
                  label="Valor (R$)"
                  sortKey="valor"
                  currentSortKey={sortKey}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                  width={columnWidths.valor}
                  onResize={handleResizeColumn}
                  minWidth={110}
                />
                <ResizableSortableTh
                  columnId="emissao"
                  label="Emissão"
                  sortKey="emissao"
                  currentSortKey={sortKey}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                  width={columnWidths.emissao}
                  onResize={handleResizeColumn}
                  minWidth={110}
                />
                <ResizableSortableTh
                  columnId="diagnostico"
                  label="Diagnóstico da Pendência"
                  sortKey="diagnostico"
                  currentSortKey={sortKey}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                  width={columnWidths.diagnostico}
                  onResize={handleResizeColumn}
                  minWidth={180}
                />
                <ResizableSortableTh
                  columnId="acoes"
                  label="Ações de Correção"
                  disableSort
                  width={columnWidths.acoes}
                  onResize={handleResizeColumn}
                  minWidth={180}
                  align="center"
                />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {notasPaginadas.map(n => {
                const isCorrigindo = corrigindoId === n.id
                return (
                  <tr key={n.id} className="hover:bg-amber-50/40 transition">
                    <td className="p-4 font-bold text-slate-800 text-xs truncate">
                      <span className="px-2 py-1 bg-slate-100 rounded-md border border-slate-200">
                        {n._tipo}
                      </span>
                    </td>
                    <td className="p-4 font-mono font-bold text-slate-900 truncate">
                      Nº {n.numero || 'S/N'} <span className="text-slate-400 font-normal text-xs">(Série {n.serie || 1})</span>
                    </td>
                    <td className="p-4 font-mono text-xs text-slate-600 select-all truncate" title={n.chave}>
                      {n.chave}
                    </td>
                    <td className="p-4 font-semibold text-slate-900 truncate">
                      R$ {Number(n.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-4 text-xs truncate">
                      <div className="font-semibold text-slate-800">{formatarDataBrasil(n.data_emissao)}</div>
                      {n.data_emissao && (
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5" title="Horário Oficial de Brasília / MG">
                          {formatarHoraBrasil(n.data_emissao)}
                        </div>
                      )}
                    </td>
                    <td className="p-4 truncate">
                      <div className="flex flex-col gap-1 text-xs">
                        {!n.tem_assinatura && (
                          <span className="inline-flex items-center gap-1 text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md font-medium w-fit">
                            ❌ Sem Assinatura Digital
                          </span>
                        )}
                        {!n.is_autorizada && (
                          <span className="inline-flex items-center gap-1 text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md font-medium w-fit">
                            ⚠️ Sem Protocolo SEFAZ
                          </span>
                        )}
                        {n.cstat && n.cstat !== '100' && (
                          <span className="text-[11px] text-slate-500 font-mono">
                            Status SEFAZ: {n.cstat} {n.motivo_sefaz ? `(${n.motivo_sefaz})` : ''}
                          </span>
                        )}

                        {/* Indicador de Nota Oficial Já Autorizada no Portal */}
                        {n.nota_oficial_substituta && (
                          <div className="mt-1 p-2 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-950 text-[11px] leading-tight shadow-2xs">
                            <div className="font-bold flex items-center gap-1 text-emerald-800">
                              <CheckCircle2 size={13} className="shrink-0 text-emerald-600" />
                              Nota Oficial #{n.numero} Já Autorizada no Portal!
                            </div>
                            <div className="text-[10px] text-emerald-700 font-mono mt-0.5">
                              Protocolo: {n.nota_oficial_substituta.protocolo} • R$ {Number(n.nota_oficial_substituta.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {/* Se a nota já foi substituída pela oficial autorizada, botão direto de descarte seguro */}
                        {n.nota_oficial_substituta ? (
                          <button
                            onClick={() => handleExecutarSaneamento([n.id])}
                            disabled={saneando}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                            title="A nota oficial já está no portal. Descartar este arquivo rejeitado com segurança total."
                          >
                            <Trash2 size={13} />
                            Descartar Lixo
                          </button>
                        ) : (
                          /* Botão Consultar SEFAZ */
                          <button
                            onClick={() => handleCorrigirSefaz(n)}
                            disabled={isCorrigindo}
                            className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold border border-blue-200 transition flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
                            title="Consulta a situação desta chave na SEFAZ e anexa o protocolo/assinatura automaticamente"
                          >
                            <Sparkles size={14} className={isCorrigindo ? 'animate-spin' : ''} />
                            {isCorrigindo ? 'Consultando...' : 'Consultar SEFAZ'}
                          </button>
                        )}

                        {/* Botão Correção Manual */}
                        <button
                          onClick={() => setModalManual({
                            open: true,
                            nota: n,
                            nProt: n.protocolo || '',
                            dhRecbto: n.data_transmissao || n.data_emissao || new Date().toISOString(),
                            digVal: '',
                            verAplic: 'W-1.5.11'
                          })}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 transition flex items-center gap-1"
                          title="Digitar manualmente protocolo e data/hora (estilo AssinaXML)"
                        >
                          <Sliders size={14} />
                          Manual
                        </button>

                        {/* Botão Gerar DANFE / DANFE-NFCe */}
                        <button
                          onClick={() => {
                            const url = `/api/notas-fiscais/danfe?tabela=${n._tabela}&id=${n.id}`
                            window.open(url, '_blank')
                            toast.success(`Gerando DANFE ${n.numero ? 'Nº ' + n.numero : ''}...`)
                          }}
                          className="p-1.5 text-purple-600 hover:text-purple-800 transition rounded-lg hover:bg-purple-50"
                          title="Gerar DANFE (com logotipo da empresa)"
                        >
                          <Printer size={16} />
                        </button>

                        {/* Botão Baixar XML */}
                        <button
                          onClick={() => handleDownloadXml(n)}
                          className="p-1.5 text-blue-600 hover:text-blue-800 transition rounded-lg hover:bg-blue-50"
                          title="Baixar Arquivo XML"
                        >
                          <Download size={16} />
                        </button>

                        {/* Botão Excluir */}
                        <button
                          onClick={() => setModalDelete({
                            open: true,
                            tipo: 'individual',
                            id: n.id,
                            tabela: n._tabela,
                            numero: n.numero
                          })}
                          className="p-1.5 text-slate-400 hover:text-red-600 transition rounded-lg hover:bg-red-50"
                          title="Excluir este arquivo"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>

          {/* Paginação de Registros */}
          <Pagination
            currentPage={currentPage}
            totalItems={notasFiltradas.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            itemLabel="arquivos pendentes"
          />
        </div>
      )}

      {/* MODAL CENTRALIZADO: Correção Manual (Estilo AssinaXML) */}
      {modalManual.open && modalManual.nota && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-100">
              <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                <Sliders size={22} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Correção Manual de XML</h3>
                <p className="text-xs text-slate-500">
                  Preencha os dados oficiais da SEFAZ para assinar e anexar o protocolo ao arquivo.
                </p>
              </div>
            </div>

            <form onSubmit={handleSalvarManual} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Chave de Acesso (44 Dígitos)</label>
                <input
                  type="text"
                  readOnly
                  value={modalManual.nota.chave}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-700"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Número do Protocolo <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 131241851090029"
                    value={modalManual.nProt}
                    onChange={e => setModalManual({ ...modalManual, nProt: e.target.value.trim() })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Data/Hora do Recibo <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="2026-09-30T19:32:22-03:00"
                    value={modalManual.dhRecbto}
                    onChange={e => setModalManual({ ...modalManual, dhRecbto: e.target.value.trim() })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    DigestValue <span className="text-slate-400 font-normal">(Opcional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Calculado automaticamente"
                    value={modalManual.digVal}
                    onChange={e => setModalManual({ ...modalManual, digVal: e.target.value.trim() })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Se vazio, calcula o SHA1 canônico</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Versão Aplicativo SEFAZ
                  </label>
                  <input
                    type="text"
                    value={modalManual.verAplic}
                    onChange={e => setModalManual({ ...modalManual, verAplic: e.target.value.trim() })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3 justify-end border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalManual({ open: false, nProt: '', dhRecbto: '', digVal: '', verAplic: 'W-1.5.11' })}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoManual}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs transition shadow-sm flex items-center gap-1.5"
                >
                  {salvandoManual ? 'Processando...' : 'Assinar e Concluir'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CENTRALIZADO: Exclusão */}
      {modalDelete.open && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-slate-100 text-center animate-in fade-in zoom-in-95 duration-150">
            <div className="w-14 h-14 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Trash2 size={28} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Excluir Arquivo</h3>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              {modalDelete.tipo === 'individual'
                ? `Deseja realmente excluir a nota ${modalDelete.numero ? `número ${modalDelete.numero}` : ''}?`
                : `Deseja realmente excluir todos os ${modalDelete.idsLote?.length} arquivos incorretos?`}
              <br /><span className="text-xs text-red-500 font-medium mt-1 block">Esta ação é irreversível.</span>
            </p>
            <div className="flex gap-3 justify-center">
              <button
                type="button"
                onClick={() => setModalDelete({ open: false, tipo: 'individual' })}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={confirmDeleteAction}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 transition shadow-sm disabled:opacity-50"
              >
                {deleting ? 'Excluindo...' : 'Sim, Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CENTRALIZADO: Saneamento Seguro de Tentativas Obsoletas */}
      {modalSaneamentoOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-6 border border-slate-100 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-100">
              <div className="w-11 h-11 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center shrink-0">
                <CheckCircle2 size={24} />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  Saneamento Seguro de Tentativas Rejeitadas
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Risco Zero
                  </span>
                </h3>
                <p className="text-xs text-slate-500">
                  Os arquivos abaixo são tentativas rejeitadas cujas notas fiscais oficiais <strong>já estão 100% autorizadas</strong> pela SEFAZ no Portal.
                </p>
              </div>
              <button
                onClick={() => setModalSaneamentoOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto space-y-3 flex-1 pr-1">
              {itensObsoletos.map(item => (
                <div key={item.id} className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-sm">
                      {item.tipo_nome} • Nº {item.numero} (Série {item.serie})
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                      Rejeição SEFAZ {item.cstat}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                    {/* Tentativa Rejeitada */}
                    <div className="p-2.5 rounded-xl bg-red-50/70 border border-red-200 text-red-950">
                      <div className="font-bold text-red-700 flex items-center gap-1 text-[11px] uppercase tracking-wide">
                        <Trash2 size={12} /> Tentativa Rejeitada (Será Limpa)
                      </div>
                      <div className="font-mono text-[11px] text-slate-600 mt-1 break-all">
                        Chave: {item.chave_rejeitada}
                      </div>
                      <div className="text-[11px] text-red-600 mt-1">
                        Motivo: {item.motivo_sefaz}
                      </div>
                    </div>

                    {/* Nota Oficial Preservada */}
                    <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950">
                      <div className="font-bold text-emerald-700 flex items-center gap-1 text-[11px] uppercase tracking-wide">
                        <CheckCircle2 size={12} /> Nota Oficial (Preservada no Portal)
                      </div>
                      <div className="font-mono text-[11px] text-slate-600 mt-1 break-all">
                        Chave: {item.nota_oficial.chave}
                      </div>
                      <div className="text-[11px] text-emerald-800 font-semibold mt-1">
                        Protocolo: {item.nota_oficial.protocolo} • R$ {Number(item.nota_oficial.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-4 mt-3 flex items-center justify-between border-t border-slate-100">
              <span className="text-xs text-slate-500 font-medium">
                {itensObsoletos.length} arquivo(s) serão descartados com segurança.
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setModalSaneamentoOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={saneando}
                  onClick={() => handleExecutarSaneamento()}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs transition shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 size={14} />
                  {saneando ? 'Saneando...' : `Confirmar e Limpar ${itensObsoletos.length} Tentativa(s)`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
