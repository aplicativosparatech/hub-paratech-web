'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { 
  RefreshCw, X, Trash2, AlertTriangle, ArrowRight, 
  Calendar, Filter, Search, Clock, RotateCcw, CheckCircle2, Download,
  Printer, ExternalLink, Copy, Check, FileText, Globe, Sparkles,
  CheckSquare, Square
} from 'lucide-react'
import JSZip from 'jszip'
import toast from 'react-hot-toast'
import Pagination from '@/components/Pagination'
import { useNotasFiscaisFilters } from './NotasFiscaisFilterContext'
import { 
  formatarDataBrasil, 
  formatarHoraBrasil, 
  extrairCompetenciaBrasil, 
  extrairDataIsoBrasil 
} from '@/utils/dateBrasil'
import { limparDocumento, formatarCnpjCpf } from '@/utils/cnpjAlfanumerico'
import ResizableSortableTh from '@/components/ui/ResizableSortableTh'
import { useTableFeatures } from '@/hooks/useTableFeatures'
import CompetenciaSelector from '@/components/CompetenciaSelector'

function AssinaturaChip({ ok }: { ok: boolean }) {
  return ok
    ? <span className="text-green-600 font-bold">✅</span>
    : <span className="text-red-500">❌</span>
}

function TabelaNotas({ tabela, label }: { tabela: string, label: string }) {
  const supabase = createClient()
  const isSaida = tabela.includes('saida') || tabela.startsWith('nfce_') || tabela === 'nfe_saidas'
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

  // Paginação local da tabela
  const [currentPage, setCurrentPage] = useState<number>(1)

  // Seleção múltipla de notas fiscais (Escolher várias ou todas)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [downloadingZipLote, setDownloadingZipLote] = useState(false)

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const handleSelectAll = () => {
    if (selectedIds.length === notasFiltradas.length && notasFiltradas.length > 0) {
      setSelectedIds([])
    } else {
      setSelectedIds(notasFiltradas.map(n => n.id))
    }
  }

  const handleClearSelection = () => {
    setSelectedIds([])
  }

  // Ação em Lote: Download de XMLs Selecionados em ZIP
  const handleDownloadZipLote = async () => {
    const selecionadas = notas.filter(n => selectedIds.includes(n.id))
    if (selecionadas.length === 0) {
      toast.error('Nenhuma nota fiscal selecionada.')
      return
    }

    setDownloadingZipLote(true)
    const toastId = toast.loading(`Compactando ${selecionadas.length} arquivos XML...`)
    try {
      const zip = new JSZip()
      let baixadas = 0

      for (const n of selecionadas) {
        try {
          const res = await fetch(`/api/notas-fiscais/download-xml?tabela=${tabela}&id=${n.id}`)
          if (res.ok) {
            const xmlBlob = await res.blob()
            const fileName = `${n.chave || n.numero || n.id}.xml`
            zip.file(fileName, xmlBlob)
            baixadas++
          }
        } catch (e) {
          console.warn('Erro ao obter XML da nota:', n.id, e)
        }
      }

      if (baixadas === 0) {
        throw new Error('Não foi possível obter os arquivos XML das notas selecionadas.')
      }

      const content = await zip.generateAsync({ type: 'blob' })
      const url = window.URL.createObjectURL(content)
      const a = document.createElement('a')
      a.href = url
      const nomeCliente = currentCli?.razao_social ? currentCli.razao_social.replace(/[^a-zA-Z0-9]/g, '_') : 'Notas'
      const labelLimpo = label.replace(/[^a-zA-Z0-9]/g, '_')
      a.download = `${labelLimpo}_${nomeCliente}_${filtroMes || 'periodo'}_${selecionadas.length}_xmls.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      toast.success(`${baixadas} XMLs compactados e baixados com sucesso!`, { id: toastId })
    } catch (err: any) {
      toast.error(err.message || 'Falha ao baixar lote de XMLs.', { id: toastId })
    } finally {
      setDownloadingZipLote(false)
    }
  }

  // Horário da Última Sincronização do Hub e Última Consulta
  const [ultimaSincronizacaoHub, setUltimaSincronizacaoHub] = useState<string | null>(null)
  const [ultimaConsultaHora, setUltimaConsultaHora] = useState<string>('')

  // Carrega o horário em que o Hub sincronizou pela última vez
  async function loadUltimaSincronizacao() {
    try {
      let query = supabase.from('configuracoes_hub').select('ultima_sincronizacao')
      if (selectedCliente) {
        query = query.eq('cliente_id', selectedCliente)
      } else {
        query = query.not('ultima_sincronizacao', 'is', null).order('ultima_sincronizacao', { ascending: false }).limit(1)
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

  async function load() {
    setLoading(true)
    const agora = new Date()
    setUltimaConsultaHora(agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    loadUltimaSincronizacao()

    const targetClienteId = selectedCliente || null

    let query = supabase.from(tabela).select('*').order('data_emissao', { ascending: false })
    if (targetClienteId) {
      query = query.eq('cliente_id', targetClienteId)
    }

    // Otimização: aplica filtro de período diretamente no banco utilizando os novos índices
    if (filtroMes && /^\d{4}-\d{2}$/.test(filtroMes)) {
      const [ano, mes] = filtroMes.split('-').map(Number)
      const dataInicioMes = new Date(Date.UTC(ano, mes - 1, 1, 0, 0, 0)).toISOString()
      const dataFimMes = new Date(Date.UTC(ano, mes, 0, 23, 59, 59, 999)).toISOString()
      query = query.gte('data_emissao', dataInicioMes).lte('data_emissao', dataFimMes)
    } else if (dataInicio || dataFim) {
      if (dataInicio) query = query.gte('data_emissao', `${dataInicio}T00:00:00.000Z`)
      if (dataFim) query = query.lte('data_emissao', `${dataFim}T23:59:59.999Z`)
    } else if (!targetClienteId) {
      query = query.limit(200)
    }

    const { data } = await query
    setNotas(data || [])
    setLoading(false)
  }

  useEffect(() => {
    if (!loadingClientes) {
      load()
    }
  }, [tabela, selectedCliente, loadingClientes, filtroMes, dataInicio, dataFim])

  function formatDoc(doc?: string | null) {
    if (!doc) return '—'
    return formatarCnpjCpf(doc) || doc
  }

  const [modalDelete, setModalDelete] = useState<{
    open: boolean
    tipo: 'individual' | 'em_lote'
    id?: string
    numero?: string
    idsLote?: string[]
  }>({ open: false, tipo: 'individual' })
  const [deleting, setDeleting] = useState(false)

  // Estado do Modal de Consulta do Documento no Portal SPED MG / SEFAZ Nacional
  const [modalConsulta, setModalConsulta] = useState<{
    open: boolean
    nota: any | null
    chaveCopiada: boolean
  }>({ open: false, nota: null, chaveCopiada: false })

  const confirmDeleteAction = async () => {
    setDeleting(true)
    try {
      if (modalDelete.tipo === 'individual' && modalDelete.id) {
        const { error } = await supabase.from(tabela).delete().eq('id', modalDelete.id)
        if (error) throw error
        setNotas(prev => prev.filter(n => n.id !== modalDelete.id))
        toast.success(`Nota fiscal ${modalDelete.numero || ''} excluída com sucesso!`)
      } else if (modalDelete.tipo === 'em_lote' && modalDelete.idsLote) {
        const { error } = await supabase.from(tabela).delete().in('id', modalDelete.idsLote)
        if (error) throw error
        setNotas(prev => prev.filter(n => !modalDelete.idsLote!.includes(n.id)))
        setSelectedIds(prev => prev.filter(id => !modalDelete.idsLote!.includes(id)))
        toast.success(`${modalDelete.idsLote.length} notas fiscais excluídas com sucesso!`)
      }
    } catch (err: any) {
      toast.error('Erro ao excluir: ' + (err.message || 'Falha na exclusão'))
    } finally {
      setDeleting(false)
      setModalDelete({ open: false, tipo: 'individual' })
    }
  }

  const currentCli = clientes.find(c => c.id === selectedCliente) || (userRole === 'cliente' ? clientes[0] : null)
  const cleanCurrentCnpj = limparDocumento(currentCli?.cnpj)

  const isAssociacao = Boolean(currentCli?.is_associacao)

  // Separação solicitada pelo usuário:
  // Se a nota tiver erro/pendência (não autorizada pela SEFAZ, sem assinatura, divergente),
  // ela NÃO é listada nas abas normais (NFC-e e NF-e), e sim exclusivamente na nova aba "Arquivos para Correção".
  const pendentesList = notas.filter(n => {
    if (isSaida) {
      // Saídas (emitidas pelo cliente): exigem autorização da SEFAZ e assinatura digital do emitente
      const isAut = n.is_autorizada === true || n.cstat === '100' || (Boolean(n.protocolo) && Boolean(n.tem_assinatura))
      if (!isAut) return true
      if (!n.tem_assinatura) return true
      if (n.cnpj_divergente) return true
      const cleanChaveCnpj = n.chave && n.chave.length === 44 ? n.chave.substring(6, 20) : ''
      const emit = limparDocumento(n.cnpj_emitente || cleanChaveCnpj)
      return Boolean(cleanCurrentCnpj) && Boolean(emit) && cleanCurrentCnpj !== emit
    } else {
      // Notas de entrada (compras emitidas por terceiros):
      // A nota é válida se estiver autorizada pela SEFAZ (com protocolo, cstat 100 ou is_autorizada).
      const isAut = n.is_autorizada === true || n.cstat === '100' || Boolean(n.protocolo)
      if (!isAut) return true
      if (n.cnpj_divergente) return true
      const cleanChaveCnpj = n.chave && n.chave.length === 44 ? n.chave.substring(6, 20) : ''
      const emit = limparDocumento(n.cnpj_emitente || cleanChaveCnpj)
      // O emitente DEVE ser um terceiro/fornecedor (divergente do cliente).
      // Se for a própria empresa emitindo, só é permitido para Associação.
      if (!isAssociacao && Boolean(cleanCurrentCnpj) && Boolean(emit) && cleanCurrentCnpj === emit) {
        return true
      }
      return false
    }
  })

  // Apenas notas 100% regulares e autorizadas são exibidas nas abas oficiais
  const notasOficiaisValidas = notas.filter(n => !pendentesList.some(p => p.id === n.id))

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

  // Filtragem Dinâmica das Notas (por Mês, Data de Emissão, Número e Busca Geral)
  const notasFiltradas = useMemo(() => {
    return notasOficiaisValidas.filter(n => {
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
  }, [notasOficiaisValidas, filtroMes, dataInicio, dataFim, buscaNumero, buscaGeral])

  // Resetar para página 1 e limpar seleção ao alterar qualquer filtro
  useEffect(() => {
    setCurrentPage(1)
    setSelectedIds([])
  }, [filtroMes, dataInicio, dataFim, buscaNumero, buscaGeral, selectedCliente, pageSize])

  // Hook de Ordenação Inteligente e Redimensionamento de Colunas
  const {
    sortedData: notasOrdenadas,
    sortKey,
    sortDirection,
    handleSort,
    columnWidths,
    handleResizeColumn
  } = useTableFeatures({
    data: notasFiltradas,
    tableId: `notas_${tabela}`,
    defaultSortKey: 'numero',
    defaultSortDirection: 'desc',
    initialWidths: {
      select: 48,
      numero: 110,
      chave: isSaida ? 380 : 320,
      emitente: 220,
      valor: 120,
      emissao: 130,
      transmissao: 130,
      assinatura: 100,
      acoes: 160
    },
    customExtractors: {
      numero: (n: any) => Number(String(n.numero || '0').replace(/\D/g, '')),
      chave: (n: any) => n.chave || '',
      emitente: (n: any) => n.cnpj_emitente || (n.chave && n.chave.length === 44 ? n.chave.substring(6, 20) : '') || '',
      valor: (n: any) => Number(n.valor || 0),
      emissao: (n: any) => n.data_emissao || '',
      transmissao: (n: any) => n.data_transmissao || '',
      assinatura: (n: any) => (n.tem_assinatura ? 1 : 0)
    }
  })

  // Paginação dos registros ordenados
  const notasPaginadas = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return notasOrdenadas.slice(start, start + pageSize)
  }, [notasOrdenadas, currentPage, pageSize])

  const syncInfo = formatRelativeSync(ultimaSincronizacaoHub)

  // Download Individual de XML
  const handleDownloadXml = (nota: any) => {
    try {
      const url = `/api/notas-fiscais/download-xml?tabela=${tabela}&id=${nota.id}`
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

  // Geração de DANFE (NF-e Modelo 55) ou DANFE-NFCe (Modelo 65) com Logomarca do Cliente
  const handleGerarDanfe = (nota: any) => {
    try {
      const url = `/api/notas-fiscais/danfe?tabela=${tabela}&id=${nota.id}`
      window.open(url, '_blank')
      toast.success(`Gerando DANFE ${nota.numero ? 'Nº ' + nota.numero : ''}...`)
    } catch (err: any) {
      toast.error('Erro ao gerar DANFE: ' + err.message)
    }
  }

  // Abertura do Modal de Consulta do Documento nos Portais Oficiais da SEFAZ
  const handleAbrirConsulta = (nota: any) => {
    if (nota.chave) {
      navigator.clipboard.writeText(nota.chave).then(() => {
        toast.success('Chave de acesso copiada para a área de transferência!')
      }).catch(() => {})
    }
    setModalConsulta({ open: true, nota, chaveCopiada: true })
  }

  // Consolidação Financeira e Modalidades de Pagamento (PIX, Dinheiro, Cartões, etc.)
  const resumoFinanceiro = useMemo(() => {
    let valorTotal = 0
    const formasMap: Record<string, { total: number; qtd: number }> = {}

    for (const n of notasFiltradas) {
      const vNota = Number(n.valor || 0)
      valorTotal += vNota

      if (Array.isArray(n.formas_pagamento) && n.formas_pagamento.length > 0) {
        for (const fp of n.formas_pagamento) {
          const nome = fp.nome || 'Outros'
          const v = Number(fp.valor || 0)
          if (!formasMap[nome]) formasMap[nome] = { total: 0, qtd: 0 }
          formasMap[nome].total += v
          formasMap[nome].qtd += 1
        }
      } else {
        const nome = 'Outros'
        if (!formasMap[nome]) formasMap[nome] = { total: 0, qtd: 0 }
        formasMap[nome].total += vNota
        formasMap[nome].qtd += 1
      }
    }

    return {
      valorTotal,
      formas: Object.entries(formasMap)
        .map(([nome, dados]) => ({ nome, ...dados }))
        .sort((a, b) => b.total - a.total)
    }
  }, [notasFiltradas])

  return (
    <div className="space-y-4">
      {/* Resumo Financeiro da Empresa Selecionada */}
      {clientes.length > 0 && (
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
            Totais do Período Filtrado
          </div>

          <div className="flex flex-col sm:items-end justify-center gap-1.5 text-right sm:self-end">
            <div className="flex flex-wrap items-center justify-end gap-2 text-xs">
              <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1 rounded-xl font-bold flex items-center gap-1 shadow-2xs">
                <span>Total:</span>
                <strong className="text-emerald-700 text-sm">
                  R$ {resumoFinanceiro.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </strong>
              </span>

              <span className="text-slate-500 bg-white border border-slate-200 px-2.5 py-1 rounded-xl font-medium">
                <strong className="text-slate-800 font-semibold">{notasFiltradas.length}</strong> {notasFiltradas.length === 1 ? 'nota oficial' : 'notas oficiais'}
              </span>
            </div>

            {/* Modalidades de Pagamento */}
            {resumoFinanceiro.formas.length > 0 && (
              <div className="flex flex-wrap items-center justify-end gap-1.5 text-[11px] mt-0.5">
                {resumoFinanceiro.formas.map(fp => {
                  let badgeColor = 'bg-slate-50 text-slate-700 border-slate-200'
                  let icon = '🏷️'
                  const nomeLower = fp.nome.toLowerCase()
                  if (nomeLower.includes('pix')) {
                    badgeColor = 'bg-teal-50 text-teal-800 border-teal-200'
                    icon = '⚡'
                  } else if (nomeLower.includes('dinheiro')) {
                    badgeColor = 'bg-green-50 text-green-800 border-green-200'
                    icon = '💵'
                  } else if (nomeLower.includes('crédito') || nomeLower.includes('credito')) {
                    badgeColor = 'bg-blue-50 text-blue-800 border-blue-200'
                    icon = '💳'
                  } else if (nomeLower.includes('débito') || nomeLower.includes('debito')) {
                    badgeColor = 'bg-sky-50 text-sky-800 border-sky-200'
                    icon = '💳'
                  } else if (nomeLower.includes('boleto')) {
                    badgeColor = 'bg-amber-50 text-amber-800 border-amber-200'
                    icon = '📄'
                  } else if (nomeLower.includes('depósito') || nomeLower.includes('transferência')) {
                    badgeColor = 'bg-purple-50 text-purple-800 border-purple-200'
                    icon = '🏦'
                  }

                  return (
                    <span 
                      key={fp.nome} 
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border font-medium ${badgeColor}`}
                      title={`${fp.nome}: R$ ${fp.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${fp.qtd} notas)`}
                    >
                      <span>{icon} {fp.nome}:</span>
                      <strong className="font-bold">
                        R$ {fp.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </strong>
                    </span>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Banner Informativo de Redirecionamento para a Aba de Correção */}
      {pendentesList.length > 0 && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-950 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="font-bold text-sm text-amber-900">
                {pendentesList.length} {pendentesList.length === 1 ? 'arquivo com pendência foi movido' : 'arquivos com pendências foram movidos'} para a aba de Correção!
              </p>
              <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                Para manter a escrituração contábil 100% segura, notas sem protocolo da SEFAZ, sem assinatura ou divergentes são listadas exclusivamente em <strong>Arquivos para Correção</strong>.
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/notas-fiscais/saidas/correcao"
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition shadow whitespace-nowrap flex items-center justify-center gap-1.5 shrink-0"
          >
            <span>Ir para Correção ({pendentesList.length})</span>
            <ArrowRight size={15} />
          </Link>
        </div>
      )}

      {/* CABEÇALHO COM HORÁRIO DA ÚLTIMA SINCRONIZAÇÃO E ATUALIZAÇÃO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-slate-100">
        <div>
          <h2 className="text-xl font-bold text-slate-800">{label}</h2>
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
        </div>

        <button 
          onClick={load} 
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition disabled:opacity-50 self-start sm:self-auto"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> 
          Atualizar Dados
        </button>
      </div>

      {/* PAINEL DE FILTROS AVANÇADOS: MÊS, DATA, NÚMERO E BUSCA */}
      <div className="bg-slate-50/90 p-3.5 rounded-2xl border border-slate-200 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Filter size={14} className="text-blue-600" />
              Filtros de Notas Fiscais
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
              notas={notasOficiaisValidas}
              placeholder="Buscar mês (ex: Outubro, 10/2026)..."
            />
          </div>

          {/* 2. Data de Emissão (De/Até) */}
          <div className="sm:col-span-1 md:col-span-1">
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
                placeholder="Buscar por CNPJ, valor..."
                value={buscaGeral}
                onChange={e => setBuscaGeral(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              />
            </div>
          </div>
        </div>

        {/* Resumo do Filtro Ativo e Botão Rápido Escolher Todas */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs text-slate-500">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleSelectAll}
              disabled={notasFiltradas.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition disabled:opacity-40 shadow-2xs cursor-pointer"
            >
              {selectedIds.length === notasFiltradas.length && notasFiltradas.length > 0 ? (
                <CheckSquare size={14} className="text-blue-600" />
              ) : selectedIds.length > 0 ? (
                <div className="w-3.5 h-3.5 rounded border-2 border-blue-600 bg-blue-50 flex items-center justify-center">
                  <div className="w-2 h-0.5 bg-blue-600 rounded"></div>
                </div>
              ) : (
                <Square size={14} className="text-slate-400" />
              )}
              {selectedIds.length === notasFiltradas.length && notasFiltradas.length > 0
                ? 'Desmarcar Todas'
                : `Escolher Todas (${notasFiltradas.length})`}
            </button>

            {temFiltroAtivo && (
              <span>Resultados encontrados: <strong className="text-blue-600 font-bold">{notasFiltradas.length}</strong> de {notasOficiaisValidas.length} notas oficiais</span>
            )}
          </div>
        </div>

        {/* Barra de Ações em Lote quando houver notas selecionadas */}
        {selectedIds.length > 0 && (
          <div className="p-3 bg-blue-50/90 border border-blue-200/80 rounded-2xl flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-150">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-blue-900 bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-lg">
                {selectedIds.length} {selectedIds.length === 1 ? 'nota selecionada' : 'notas selecionadas'}
              </span>
              <span className="text-xs text-blue-700">
                de {notasFiltradas.length} notas listadas
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadZipLote}
                disabled={downloadingZipLote}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                title="Baixar arquivos XML das notas selecionadas em um único arquivo .ZIP"
              >
                <Download size={14} className={downloadingZipLote ? 'animate-bounce' : ''} />
                {downloadingZipLote ? 'Compactando...' : `Baixar XMLs Selecionados (${selectedIds.length}) .ZIP`}
              </button>
              <button
                type="button"
                onClick={() => setModalDelete({ open: true, tipo: 'em_lote', idsLote: selectedIds })}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition cursor-pointer"
                title="Excluir as notas fiscais selecionadas"
              >
                <Trash2 size={14} />
                Excluir Selecionadas
              </button>
              <button
                type="button"
                onClick={handleClearSelection}
                className="text-xs text-slate-500 hover:text-slate-700 px-2.5 py-1.5 font-medium hover:bg-slate-200/50 rounded-xl transition cursor-pointer"
              >
                Desmarcar Todas
              </button>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-slate-400 py-8 text-center animate-pulse">Carregando notas...</div>
      ) : (
        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs bg-white dark:bg-[#0B1120] overflow-hidden flex flex-col w-full">
          <div className="overflow-x-auto w-full custom-scrollbar">
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300 min-w-[1000px]">
              <thead className="sticky top-0 z-10 bg-slate-50 text-slate-500 font-medium border-b border-slate-200 shadow-2xs">
                <tr>
                <ResizableSortableTh
                  columnId="select"
                  label={
                    <input
                      type="checkbox"
                      checked={notasFiltradas.length > 0 && selectedIds.length === notasFiltradas.length}
                      ref={el => {
                        if (el) {
                          el.indeterminate = selectedIds.length > 0 && selectedIds.length < notasFiltradas.length
                        }
                      }}
                      onChange={handleSelectAll}
                      title={selectedIds.length === notasFiltradas.length && notasFiltradas.length > 0 ? "Desmarcar Todas as Notas" : "Escolher Todas as Notas"}
                      aria-label="Escolher todas as notas"
                      className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer transition mx-auto block"
                    />
                  }
                  disableSort
                  width={columnWidths.select || 48}
                  onResize={handleResizeColumn}
                  minWidth={45}
                  align="center"
                />
                <ResizableSortableTh
                  columnId="numero"
                  label="Número"
                  sortKey="numero"
                  currentSortKey={sortKey}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                  width={columnWidths.numero}
                  onResize={handleResizeColumn}
                  minWidth={80}
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
                  minWidth={160}
                />
                {!isSaida && (
                  <ResizableSortableTh
                    columnId="emitente"
                    label="Emitente (CNPJ / CPF)"
                    sortKey="emitente"
                    currentSortKey={sortKey}
                    currentSortDirection={sortDirection}
                    onSort={handleSort}
                    width={columnWidths.emitente}
                    onResize={handleResizeColumn}
                    minWidth={150}
                  />
                )}
                <ResizableSortableTh
                  columnId="valor"
                  label="Valor (R$)"
                  sortKey="valor"
                  currentSortKey={sortKey}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                  width={columnWidths.valor}
                  onResize={handleResizeColumn}
                  minWidth={90}
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
                  columnId="transmissao"
                  label="Transmissão"
                  sortKey="transmissao"
                  currentSortKey={sortKey}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                  width={columnWidths.transmissao}
                  onResize={handleResizeColumn}
                  minWidth={110}
                />
                <ResizableSortableTh
                  columnId="assinatura"
                  label="Assinatura"
                  sortKey="assinatura"
                  currentSortKey={sortKey}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                  width={columnWidths.assinatura}
                  onResize={handleResizeColumn}
                  minWidth={85}
                  align="center"
                />
                <ResizableSortableTh
                  columnId="acoes"
                  label="Ações"
                  disableSort
                  width={columnWidths.acoes}
                  onResize={handleResizeColumn}
                  minWidth={140}
                  align="center"
                />
              </tr>
            </thead>
            <tbody>
              {notasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={isSaida ? 8 : 9} className="p-8 text-center text-slate-400">
                    {temFiltroAtivo 
                      ? 'Nenhuma nota encontrada com os filtros selecionados. Tente ajustar os parâmetros ou limpar os filtros.' 
                      : 'Nenhuma nota encontrada. O Hub ainda não enviou dados para esta seção.'}
                  </td>
                </tr>
              ) : notasPaginadas.map(n => {
                const cleanChaveCnpj = n.chave && n.chave.length === 44 ? n.chave.substring(6, 20) : ''
                const emitenteDoc = n.cnpj_emitente || cleanChaveCnpj
                const cleanEmit = limparDocumento(emitenteDoc)

                let isDivergente = false
                let motivoDivergencia = n.motivo_divergencia || ''

                if (isSaida) {
                  // Vendas: o emitente DEVE ser a própria empresa do cliente
                  isDivergente = Boolean(n.cnpj_divergente) || (Boolean(cleanCurrentCnpj) && Boolean(cleanEmit) && cleanCurrentCnpj !== cleanEmit)
                  if (isDivergente && !motivoDivergencia) {
                    motivoDivergencia = 'Emitente diverge da empresa atual (venda emitida por outro CNPJ)'
                  }
                } else {
                  // Entradas: o emitente é fornecedor terceiro (divergente da empresa por natureza).
                  // Se o emitente for a mesma empresa, só é permitido se a empresa for Associação.
                  if (n.cnpj_divergente) {
                    isDivergente = true
                  } else if (!isAssociacao && Boolean(cleanCurrentCnpj) && Boolean(cleanEmit) && cleanCurrentCnpj === cleanEmit) {
                    isDivergente = true
                    motivoDivergencia = 'Nota de entrada emitida pela própria empresa (permitido apenas para Associação)'
                  } else {
                    isDivergente = false
                  }
                }

                const isSelected = selectedIds.includes(n.id)

                return (
                  <tr 
                    key={n.id} 
                    className={`border-b transition ${isDivergente ? 'bg-red-50 hover:bg-red-100/90 text-red-900 border-red-200' : isSelected ? 'bg-blue-50/60 hover:bg-blue-100/70 border-blue-200/80' : 'border-slate-100 hover:bg-slate-50'}`}
                  >
                    <td className="p-3.5 text-center shrink-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(n.id)}
                        onClick={e => e.stopPropagation()}
                        aria-label={`Selecionar nota ${n.numero || n.id}`}
                        className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer transition mx-auto block"
                      />
                    </td>
                    <td className="p-3.5 font-mono overflow-hidden">
                      <div className="flex items-center gap-2 truncate">
                        <span className={isDivergente ? 'font-bold text-red-700' : 'text-slate-800 font-semibold'}>{n.numero || '—'}</span>
                        {isDivergente && (
                          <span 
                            className="bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0"
                            title={motivoDivergencia || 'Emitente não pertence à empresa cadastrada'}
                          >
                            ⚠️ Divergente
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3.5 font-mono text-xs text-slate-500 overflow-hidden" title={n.chave || ''}>
                      <div className="flex items-center gap-1.5 overflow-hidden">
                        <span className="truncate select-all" title={n.chave || ''}>
                          {n.chave || '—'}
                        </span>
                        {n.chave && (
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(n.chave)
                              toast.success('Chave copiada!')
                            }}
                            className="text-slate-400 hover:text-blue-600 p-0.5 rounded transition shrink-0"
                            title="Copiar chave de acesso"
                          >
                            <Copy size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                    {!isSaida && (
                      <td className="p-3.5 font-mono text-xs overflow-hidden">
                        <div className={`truncate ${isDivergente ? 'text-red-700 font-bold' : 'text-slate-800 font-medium'}`} title={formatDoc(emitenteDoc)}>
                          {formatDoc(emitenteDoc)}
                        </div>
                        {isDivergente && (
                          <div className="text-[10px] text-red-600 mt-0.5 font-sans truncate" title={motivoDivergencia || 'Emitente diverge da regra fiscal'}>
                            {motivoDivergencia || `CNPJ diverge da regra`}
                          </div>
                        )}
                      </td>
                    )}
                    <td className="p-3.5 font-medium overflow-hidden whitespace-nowrap">
                      R$ {Number(n.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="p-3.5 text-xs overflow-hidden whitespace-nowrap">
                      <div className="font-semibold text-slate-800">{formatarDataBrasil(n.data_emissao)}</div>
                      {n.data_emissao && (
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5" title="Horário Oficial de Brasília / MG">
                          {formatarHoraBrasil(n.data_emissao)}
                        </div>
                      )}
                    </td>
                    <td className="p-3.5 text-xs overflow-hidden whitespace-nowrap">
                      <div className="font-semibold text-slate-800">{formatarDataBrasil(n.data_transmissao)}</div>
                      {n.data_transmissao && (
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5" title="Horário de Transmissão SEFAZ">
                          {formatarHoraBrasil(n.data_transmissao)}
                        </div>
                      )}
                    </td>
                    <td className="p-3.5 text-center overflow-hidden">
                      <AssinaturaChip ok={isSaida ? Boolean(n.tem_assinatura) : Boolean(n.tem_assinatura || n.protocolo || n.cstat === '100' || n.is_autorizada)} />
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {/* 1. Botão Gerar DANFE / DANFE-NFCe */}
                        <button
                          onClick={() => handleGerarDanfe(n)}
                          className="p-1.5 rounded-lg text-purple-600 hover:bg-purple-100 hover:text-purple-800 transition"
                          title={tabela === 'nfce_saidas' ? 'Gerar DANFE-NFCe (com logotipo da empresa)' : 'Gerar DANFE NF-e (com logotipo da empresa)'}
                        >
                          <Printer size={15} />
                        </button>

                        {/* 2. Botão Consultar Documento (Portal SPED MG / SEFAZ Nacional) */}
                        <button
                          onClick={() => handleAbrirConsulta(n)}
                          className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-100 hover:text-emerald-800 transition"
                          title="Consultar Documento no Portal SPED MG / Portal Nacional SEFAZ"
                        >
                          <Search size={15} />
                        </button>

                        {/* 3. Botão Baixar XML */}
                        <button
                          onClick={() => handleDownloadXml(n)}
                          className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-100 hover:text-blue-800 transition"
                          title="Baixar Arquivo XML"
                        >
                          <Download size={15} />
                        </button>

                        {/* 4. Botão Excluir */}
                        <button 
                          onClick={() => setModalDelete({ open: true, tipo: 'individual', id: n.id, numero: n.numero })}
                          className="p-1.5 rounded-lg text-red-500 hover:bg-red-100 hover:text-red-700 transition" 
                          title="Excluir XML"
                        >
                          <span className="font-bold text-sm">✕</span>
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
            itemLabel="notas oficiais"
          />
        </div>
      )}

      {/* Modal Centralizado de Confirmação de Exclusão */}
      {modalDelete.open && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 sm:p-7 border border-slate-100 animate-in zoom-in-95 duration-200 relative">
            <button
              onClick={() => setModalDelete({ open: false, tipo: 'individual' })}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-3.5 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center border border-red-100 shrink-0">
                <Trash2 size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {modalDelete.tipo === 'em_lote' ? 'Excluir Notas Selecionadas' : 'Excluir Nota Fiscal'}
                </h3>
                <p className="text-xs text-slate-500">Ação irreversível de limpeza</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed mb-6">
              {modalDelete.tipo === 'em_lote' ? (
                <>
                  Tem certeza que deseja excluir permanentemente todas as <strong className="text-red-600 font-semibold">{modalDelete.idsLote?.length} notas fiscais selecionadas</strong>? Elas serão removidas do Portal e dos relatórios fiscais.
                </>
              ) : (
                <>
                  Tem certeza que deseja excluir a nota fiscal número <strong className="text-red-600 font-semibold">{modalDelete.numero || 'selecionada'}</strong>? Esta ação removerá o registro e o arquivo XML associado.
                </>
              )}
            </p>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setModalDelete({ open: false, tipo: 'individual' })}
                disabled={deleting}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold text-sm transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteAction}
                disabled={deleting}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-sm transition shadow-sm hover:shadow disabled:opacity-50 flex items-center gap-2"
              >
                <Trash2 size={16} />
                {deleting ? 'Excluindo...' : (modalDelete.tipo === 'em_lote' ? 'Sim, Excluir Todas' : 'Sim, Excluir Nota')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Oficial de Consulta do Documento nos Portais da SEFAZ */}
      {modalConsulta.open && modalConsulta.nota && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-slate-200">
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200 shrink-0">
                  <Search size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Consultar Documento Fiscal na SEFAZ
                  </h3>
                  <p className="text-xs text-slate-500">
                    Nota Fiscal Nº {modalConsulta.nota.numero || 'S/N'} • Modelo {tabela === 'nfce_saidas' ? '65 (NFC-e)' : '55 (NF-e)'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalConsulta({ open: false, nota: null, chaveCopiada: false })}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Chave de Acesso com Cópia Rápida */}
            <div className="my-5 p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
                <span>Chave de Acesso (44 dígitos):</span>
                <span className="text-emerald-600 font-bold flex items-center gap-1">
                  <CheckCircle2 size={13} /> Chave Copiada!
                </span>
              </div>
              <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-bold text-slate-800 break-all select-all">
                  {modalConsulta.nota.chave || 'Chave não informada'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (modalConsulta.nota?.chave) {
                      navigator.clipboard.writeText(modalConsulta.nota.chave)
                      toast.success('Chave de acesso copiada!')
                    }
                  }}
                  className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition shrink-0"
                  title="Copiar Chave de Acesso"
                >
                  <Copy size={16} />
                </button>
              </div>
            </div>

            {/* Opções de Portais Oficiais */}
            <div className="space-y-3 mb-6">
              <div className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                Selecione o Portal de Consulta Desejado:
              </div>

              {/* Portal SPED MG (NFC-e / MG) */}
              <a
                href={
                  tabela === 'nfce_saidas'
                    ? 'https://portalsped.fazenda.mg.gov.br/portalnfce/sistema/consultaarg.xhtml'
                    : 'https://dfe-portal.svrs.rs.gov.br/dfe/nfe'
                }
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  if (modalConsulta.nota?.chave) {
                    navigator.clipboard.writeText(modalConsulta.nota.chave)
                  }
                }}
                className="p-4 rounded-2xl border-2 border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 transition flex items-center justify-between group cursor-pointer block text-left"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-xs">
                    MG
                  </div>
                  <div>
                    <div className="text-sm font-bold text-emerald-950 group-hover:text-emerald-700 flex items-center gap-1.5">
                      <span>Portal SPED Fazenda MG</span>
                      <ExternalLink size={14} className="text-emerald-600" />
                    </div>
                    <p className="text-xs text-emerald-800/80 mt-0.5">
                      {tabela === 'nfce_saidas' 
                        ? 'portalsped.fazenda.mg.gov.br/portalnfce (Consulta NFC-e)' 
                        : 'Portal Estadual de Documentos Fiscais de Minas Gerais'}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1.5 rounded-xl shrink-0">
                  Abrir Portal ↗
                </span>
              </a>

              {/* Portal Nacional da NF-e (Receita Federal) */}
              <a
                href="https://www.nfe.fazenda.gov.br/portal/consultaRecaptcha.aspx?tipoConsulta=resumo&tipoConteudo=7PhJ+gAVw2g="
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  if (modalConsulta.nota?.chave) {
                    navigator.clipboard.writeText(modalConsulta.nota.chave)
                  }
                }}
                className="p-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 transition flex items-center justify-between group cursor-pointer block text-left"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-xs">
                    BR
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-800 group-hover:text-blue-600 flex items-center gap-1.5">
                      <span>Portal Nacional da NF-e (Receita Federal)</span>
                      <ExternalLink size={14} className="text-slate-400 group-hover:text-blue-600" />
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      nfe.fazenda.gov.br (Consulta Completa Nacional de Autenticidade)
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-xl shrink-0">
                  Abrir Portal ↗
                </span>
              </a>

              {/* Atalho para Gerar DANFE com Logomarca */}
              <button
                type="button"
                onClick={() => {
                  handleGerarDanfe(modalConsulta.nota)
                  setModalConsulta({ open: false, nota: null, chaveCopiada: false })
                }}
                className="w-full p-4 rounded-2xl border border-purple-200 bg-purple-50/50 hover:bg-purple-50 transition flex items-center justify-between group cursor-pointer text-left"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Printer size={20} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-purple-950 group-hover:text-purple-700 flex items-center gap-1.5">
                      <span>Visualizar / Imprimir DANFE</span>
                    </div>
                    <p className="text-xs text-purple-800/80 mt-0.5">
                      Gerar documento auxiliar oficial com o logotipo da empresa cadastrada
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold text-purple-700 bg-purple-100 px-3 py-1.5 rounded-xl shrink-0">
                  Gerar DANFE
                </span>
              </button>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setModalConsulta({ open: false, nota: null, chaveCopiada: false })}
                className="px-5 py-2.5 rounded-xl bg-slate-900 text-white font-semibold text-xs hover:bg-slate-800 transition"
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

export default TabelaNotas
