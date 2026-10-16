'use client'

import { useState, useEffect, useMemo } from 'react'
import { 
  Inbox, Search, Download, FileText, CheckCircle2, AlertTriangle, 
  RefreshCw, Archive, Calendar, Building2, CheckSquare, Square, 
  Trash2, ExternalLink, Copy, Check, FileDown, Layers, ShieldCheck,
  Eye, FolderArchive, ArrowRight, Zap, Filter
} from 'lucide-react'
import toast from 'react-hot-toast'
import JSZip from 'jszip'
import { createClient } from '@/utils/supabase/client'
import { formatarCnpjCpf } from '@/utils/cnpjAlfanumerico'
import ResizableSortableTh from '@/components/ui/ResizableSortableTh'
import { useTableFeatures } from '@/hooks/useTableFeatures'

interface Cliente {
  id: string
  razao_social: string
  nome_fantasia?: string
  cnpj: string
  uf: string
  certificado_url?: string
}

interface DfeNotaItem {
  id: string
  chave: string
  numero: string
  serie: string
  emitente_cnpj: string
  emitente_nome: string
  emitente_ie?: string
  destinatario_cnpj?: string
  valor: number
  data_emissao: string
  tipo_documento: string
  situacao_nfe: 'AUTORIZADA' | 'CANCELADA' | 'DENEGADA'
  manifestacao_status: 'SEM_MANIFESTACAO' | 'CIENCIA' | 'CONFIRMADA' | 'DESCONHECIDA' | 'NAO_REALIZADA'
  protocolo?: string
  tem_xml: boolean
  storage_path?: string
  origem: 'sefaz_dfe' | 'nfe_entradas'
}

interface ConsultaSalvaItem {
  id: string
  cliente_id: string
  competencia: string
  total_notas: number
  valor_total: number
  dados_notas: DfeNotaItem[]
  usuario_responsavel?: string
  observacoes?: string
  created_at: string
  clientes?: {
    razao_social: string
    cnpj: string
  }
}

export default function DistribuicaoDfePage() {
  const supabase = createClient()
  const [abaAtiva, setAbaAtiva] = useState<'analise' | 'salvas'>('analise')
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loadingClientes, setLoadingClientes] = useState(true)
  const [selectedClienteId, setSelectedClienteId] = useState<string>('')
  
  // Mês de Competência padrão (mês atual YYYY-MM)
  const [competencia, setCompetencia] = useState<string>(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  // Consulta ao vivo na SEFAZ
  const [consultarAoVivo, setConsultarAoVivo] = useState(true)
  const [loadingConsulta, setLoadingConsulta] = useState(false)
  const [notas, setNotas] = useState<DfeNotaItem[]>([])
  const [selectedChaves, setSelectedChaves] = useState<string[]>([])
  const [chaveCopiada, setChaveCopiada] = useState<string | null>(null)
  const [avisoSefaz, setAvisoSefaz] = useState<string | null>(null)
  const [competenciasDisponiveis, setCompetenciasDisponiveis] = useState<string[]>([])

  // Resumo da Consulta
  const [resumo, setResumo] = useState({
    totalNotas: 0,
    valorTotal: 0,
    autorizadas: 0,
    canceladas: 0,
    comXml: 0,
    semManifestacao: 0
  })

  // Filtros Locais da Tabela
  const [filtroSituacao, setFiltroSituacao] = useState<'todas' | 'AUTORIZADA' | 'CANCELADA'>('todas')
  const [termoBusca, setTermoBusca] = useState('')

  // Consultas Salvas
  const [consultasSalvas, setConsultasSalvas] = useState<ConsultaSalvaItem[]>([])
  const [loadingSalvas, setLoadingSalvas] = useState(false)
  const [modalSalvarOpen, setModalSalvarOpen] = useState(false)
  const [observacaoSalvar, setObservacaoSalvar] = useState('')
  const [salvandoConsulta, setSalvandoConsulta] = useState(false)

  // Carrega clientes
  useEffect(() => {
    async function loadClientes() {
      setLoadingClientes(true)
      try {
        const { data, error } = await supabase
          .from('clientes')
          .select('id, razao_social, nome_fantasia, cnpj, uf, certificado_url')
          .order('razao_social', { ascending: true })

        if (error) throw error
        setClientes(data || [])
        if (data && data.length > 0) {
          setSelectedClienteId(data[0].id)
        }
      } catch (err: any) {
        toast.error('Erro ao listar empresas: ' + (err.message || ''))
      } finally {
        setLoadingClientes(false)
      }
    }
    loadClientes()
  }, [])

  // Carrega histórico de consultas salvas
  const carregarConsultasSalvas = async () => {
    setLoadingSalvas(true)
    try {
      const url = selectedClienteId 
        ? `/api/sefaz/distribuicao-dfe/historico?cliente_id=${selectedClienteId}`
        : '/api/sefaz/distribuicao-dfe/historico'
      const res = await fetch(url)
      const data = await res.json()
      if (data.success) {
        setConsultasSalvas(data.consultas || [])
      }
    } catch (err) {
      console.warn('Erro ao carregar consultas salvas:', err)
    } finally {
      setLoadingSalvas(false)
    }
  }

  useEffect(() => {
    if (abaAtiva === 'salvas') {
      carregarConsultasSalvas()
    }
  }, [abaAtiva, selectedClienteId])

  const clienteAtual = useMemo(() => {
    return clientes.find(c => c.id === selectedClienteId)
  }, [clientes, selectedClienteId])

  // Ação: Analisar / Consultar Notas Destinadas
  const handleAnalisar = async (compOverride?: string, aoVivoParam?: boolean) => {
    if (!selectedClienteId) {
      toast.error('Selecione uma empresa para analisar.')
      return
    }

    const compParaConsultar = compOverride !== undefined ? compOverride : competencia
    const isLive = aoVivoParam !== undefined ? aoVivoParam : consultarAoVivo
    setLoadingConsulta(true)
    setSelectedChaves([])
    setAvisoSefaz(null)
    const toastId = isLive ? toast.loading('Consultando notas emitidas contra o CNPJ na SEFAZ...') : undefined

    try {
      const res = await fetch('/api/sefaz/distribuicao-dfe/consultar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_id: selectedClienteId,
          competencia: compParaConsultar === 'todas' ? '' : compParaConsultar,
          ao_vivo: isLive
        })
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Falha ao consultar distribuição de DF-e.')
      }

      setNotas(data.notas || [])
      if (data.competenciasDisponiveis) {
        setCompetenciasDisponiveis(data.competenciasDisponiveis)
      }
      setResumo(data.resumo || {
        totalNotas: 0,
        valorTotal: 0,
        autorizadas: 0,
        canceladas: 0,
        comXml: 0,
        semManifestacao: 0
      })

      if (data.aviso) {
        setAvisoSefaz(data.aviso)
      }

      if (toastId) {
        toast.success(
          data.notas?.length > 0 
            ? `Análise concluída: ${data.notas.length} notas fiscais localizadas!` 
            : (data.aviso || 'Nenhuma nota localizada para esta competência.'),
          { id: toastId }
        )
      }
    } catch (err: any) {
      if (toastId) {
        toast.error('Erro na análise: ' + (err.message || ''), { id: toastId })
      }
    } finally {
      setLoadingConsulta(false)
    }
  }

  // Carrega notas salvas no banco imediatamente ao trocar de cliente
  useEffect(() => {
    if (selectedClienteId) {
      handleAnalisar(competencia, false)
    }
  }, [selectedClienteId])

  // Filtragem local das notas
  const notasFiltradas = useMemo(() => {
    return notas.filter(nota => {
      if (filtroSituacao !== 'todas' && nota.situacao_nfe !== filtroSituacao) {
        return false
      }
      if (termoBusca) {
        const termo = termoBusca.toLowerCase().trim()
        const matchChave = nota.chave.toLowerCase().includes(termo)
        const matchNum = nota.numero.includes(termo)
        const matchEmit = nota.emitente_nome.toLowerCase().includes(termo)
        const matchCnpj = nota.emitente_cnpj.includes(termo)
        return matchChave || matchNum || matchEmit || matchCnpj
      }
      return true
    })
  }, [notas, filtroSituacao, termoBusca])

  // Hook de Ordenação Inteligente e Redimensionamento de Colunas
  const {
    sortedData: notasDestinadasOrdenadas,
    sortKey,
    sortDirection,
    handleSort,
    columnWidths,
    handleResizeColumn
  } = useTableFeatures({
    data: notasFiltradas,
    tableId: 'distribuicao_dfe',
    defaultSortKey: 'numero',
    defaultSortDirection: 'desc',
    initialWidths: {
      select: 50,
      doc: 280,
      fornecedor: 280,
      emissao: 130,
      valor: 130,
      situacao: 140,
      manifestacao: 150,
      acoes: 140
    },
    customExtractors: {
      numero: (n: any) => Number(String(n.numero || '0').replace(/\D/g, '')),
      fornecedor: (n: any) => n.emitente_nome || n.emitente_cnpj || '',
      emissao: (n: any) => n.data_emissao || '',
      valor: (n: any) => Number(n.valor || 0),
      situacao: (n: any) => n.situacao_nfe || '',
      manifestacao: (n: any) => n.tipo_manifestacao || ''
    }
  })

  // Copiar chave de acesso
  const handleCopiarChave = (chave: string) => {
    navigator.clipboard.writeText(chave)
    setChaveCopiada(chave)
    toast.success('Chave de acesso copiada!')
    setTimeout(() => setChaveCopiada(null), 2000)
  }

  // Seleção em Lote
  const handleSelectAll = () => {
    if (selectedChaves.length === notasFiltradas.length) {
      setSelectedChaves([])
    } else {
      setSelectedChaves(notasFiltradas.map(n => n.chave))
    }
  }

  const handleToggleSelect = (chave: string) => {
    setSelectedChaves(prev => 
      prev.includes(chave) ? prev.filter(c => c !== chave) : [...prev, chave]
    )
  }

  // Ação: Download de XML Individual
  const handleBaixarXmlIndividual = (nota: DfeNotaItem) => {
    const url = `/api/notas-fiscais/download-xml?tabela=${nota.origem === 'nfe_entradas' ? 'nfe_entradas' : 'dfe_notas_destinadas'}&id=${nota.id}`
    window.open(url, '_blank')
  }

  // Ação: Gerar / Baixar DANFE Individual
  const handleGerarDanfeIndividual = (nota: DfeNotaItem) => {
    const url = `/api/notas-fiscais/danfe?tabela=${nota.origem === 'nfe_entradas' ? 'nfe_entradas' : 'dfe_notas_destinadas'}&id=${nota.id}`
    window.open(url, '_blank')
  }

  // Ação em Lote: Download de XMLs Selecionados em ZIP
  const handleDownloadZipLote = async () => {
    const selecionadas = notas.filter(n => selectedChaves.includes(n.chave))
    if (selecionadas.length === 0) {
      toast.error('Nenhuma nota selecionada.')
      return
    }

    const toastId = toast.loading(`Compactando ${selecionadas.length} arquivos XML em lote...`)
    try {
      const zip = new JSZip()
      let baixadas = 0

      for (const n of selecionadas) {
        try {
          const res = await fetch(`/api/notas-fiscais/download-xml?tabela=${n.origem === 'nfe_entradas' ? 'nfe_entradas' : 'dfe_notas_destinadas'}&id=${n.id}`)
          if (res.ok) {
            const xmlBlob = await res.blob()
            zip.file(`${n.chave || n.numero}.xml`, xmlBlob)
            baixadas++
          }
        } catch (e) {
          console.warn('Erro ao obter XML da nota:', n.chave, e)
        }
      }

      if (baixadas === 0) {
        throw new Error('Não foi possível obter o XML das notas selecionadas.')
      }

      const content = await zip.generateAsync({ type: 'blob' })
      const url = window.URL.createObjectURL(content)
      const a = document.createElement('a')
      a.href = url
      const nomeCliente = clienteAtual?.razao_social ? clienteAtual.razao_social.replace(/[^a-zA-Z0-9]/g, '_') : 'Notas'
      a.download = `Notas_Destinadas_${nomeCliente}_${competencia}.zip`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success(`Pacote ZIP gerado com sucesso (${baixadas} notas)!`, { id: toastId })
    } catch (err: any) {
      toast.error('Erro ao gerar pacote ZIP: ' + (err.message || ''), { id: toastId })
    }
  }

  // Ação: Salvar Consulta para o Histórico
  const handleSalvarConsulta = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedClienteId || notas.length === 0) {
      toast.error('Nenhuma nota disponível para salvar.')
      return
    }

    setSalvandoConsulta(true)
    const toastId = toast.loading('Salvando consulta no histórico organizado...')
    try {
      const res = await fetch('/api/sefaz/distribuicao-dfe/salvar-consulta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_id: selectedClienteId,
          competencia,
          total_notas: notas.length,
          valor_total: resumo.valorTotal,
          dados_notas: notas,
          observacoes: observacaoSalvar
        })
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Falha ao salvar consulta.')
      }

      toast.success('Consulta arquivada com sucesso nas Consultas Salvas!', { id: toastId })
      setModalSalvarOpen(false)
      setObservacaoSalvar('')
      await carregarConsultasSalvas()
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + (err.message || ''), { id: toastId })
    } finally {
      setSalvandoConsulta(false)
    }
  }

  // Ação: Reabrir Consulta Salva na Tela de Análise
  const handleAbrirConsultaSalva = (consulta: ConsultaSalvaItem) => {
    setSelectedClienteId(consulta.cliente_id)
    setCompetencia(consulta.competencia)
    setNotas(consulta.dados_notas || [])
    
    const notasList = consulta.dados_notas || []
    setResumo({
      totalNotas: consulta.total_notas,
      valorTotal: consulta.valor_total,
      autorizadas: notasList.filter(n => n.situacao_nfe === 'AUTORIZADA').length,
      canceladas: notasList.filter(n => n.situacao_nfe === 'CANCELADA').length,
      comXml: notasList.filter(n => n.tem_xml).length,
      semManifestacao: notasList.filter(n => n.manifestacao_status === 'SEM_MANIFESTACAO').length
    })

    setAbaAtiva('analise')
    toast.success(`Consulta de ${consulta.competencia} carregada com ${notasList.length} notas!`)
  }

  // Ação: Excluir Consulta Salva
  const handleExcluirConsultaSalva = async (id: string) => {
    if (!confirm('Deseja realmente remover esta consulta salva do histórico?')) return
    const toastId = toast.loading('Removendo consulta...')
    try {
      const res = await fetch(`/api/sefaz/distribuicao-dfe/historico?id=${id}`, {
        method: 'DELETE'
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Falha ao remover.')
      }
      toast.success('Consulta removida com sucesso!', { id: toastId })
      setConsultasSalvas(prev => prev.filter(c => c.id !== id))
    } catch (err: any) {
      toast.error('Erro ao excluir: ' + (err.message || ''), { id: toastId })
    }
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-600/20">
              <Inbox size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Distribuição de DF-e
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Consulta Oficial de Notas Fiscais Emitidas contra o CNPJ da Empresa (SEFAZ Nacional)
              </p>
            </div>
          </div>
        </div>

        {/* Abas de Navegação */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
          <button
            type="button"
            onClick={() => setAbaAtiva('analise')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition ${
              abaAtiva === 'analise'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Search size={14} />
            Consulta em Tempo Real
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva('salvas')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition ${
              abaAtiva === 'salvas'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FolderArchive size={14} />
            Consultas Salvas ({consultasSalvas.length})
          </button>
        </div>
      </div>

      {/* ABA 1: CONSULTA EM TEMPO REAL / ANALISAR */}
      {abaAtiva === 'analise' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Card de Filtro e Disparo da Consulta */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              {/* Seleção do Cliente */}
              <div className="md:col-span-5">
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 flex items-center justify-between">
                  <span>Empresa / Destinatário:</span>
                  {clienteAtual && (
                    <span className="text-[11px] font-normal text-slate-500">
                      UF: {clienteAtual.uf || 'MG'}
                    </span>
                  )}
                </label>
                <select
                  value={selectedClienteId}
                  onChange={(e) => setSelectedClienteId(e.target.value)}
                  disabled={loadingClientes || loadingConsulta}
                  className="w-full text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none transition"
                >
                  {clientes.map(cli => (
                    <option key={cli.id} value={cli.id}>
                      {cli.razao_social} ({formatarCnpjCpf(cli.cnpj)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Mês de Competência */}
              <div className="md:col-span-3">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase">
                    Mês de Competência:
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const nova = competencia === 'todas' ? new Date().toISOString().substring(0, 7) : 'todas'
                      setCompetencia(nova)
                      handleAnalisar(nova, false)
                    }}
                    className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold underline transition"
                  >
                    {competencia === 'todas' ? 'Filtrar por Mês' : 'Ver Todos os Meses'}
                  </button>
                </div>
                <div className="relative">
                  {competencia === 'todas' ? (
                    <div className="w-full flex items-center justify-between text-xs font-bold font-mono text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-xl px-3.5 py-2.5">
                      <span>Todas as Competências</span>
                      <button
                        type="button"
                        onClick={() => {
                          const atual = new Date().toISOString().substring(0, 7)
                          setCompetencia(atual)
                          handleAnalisar(atual, false)
                        }}
                        className="text-[10px] bg-white text-indigo-700 px-2 py-0.5 rounded border border-indigo-200 hover:bg-indigo-50 font-sans font-semibold transition"
                      >
                        Filtrar Mês
                      </button>
                    </div>
                  ) : (
                    <input
                      type="month"
                      value={competencia}
                      onChange={(e) => {
                        const val = e.target.value
                        setCompetencia(val)
                        if (val) handleAnalisar(val, false)
                      }}
                      disabled={loadingConsulta}
                      className="w-full text-xs font-bold font-mono text-slate-800 bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none transition"
                    />
                  )}
                </div>
              </div>

              {/* Botão Primário: Analisar */}
              <div className="md:col-span-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleAnalisar(competencia, true)}
                  disabled={loadingConsulta || !selectedClienteId}
                  className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition disabled:opacity-50"
                >
                  {loadingConsulta ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" />
                      Consultando SEFAZ...
                    </>
                  ) : (
                    <>
                      <Search size={15} />
                      Analisar Notas Destinadas (Ao Vivo)
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Atalhos Rápidos por Competência Encontrada */}
            {competenciasDisponiveis.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 text-xs">
                <span className="text-[11px] font-bold text-slate-500">Compras registradas por mês:</span>
                <button
                  type="button"
                  onClick={() => {
                    setCompetencia('todas')
                    handleAnalisar('todas', false)
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${competencia === 'todas' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
                >
                  Ver Todas ({resumo.totalNotas})
                </button>
                {competenciasDisponiveis.map(c => {
                  const parts = c.split('-')
                  const rotulo = parts.length === 2 ? `${parts[1]}/${parts[0]}` : c
                  const isSel = competencia === c
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        setCompetencia(c)
                        handleAnalisar(c, false)
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${isSel ? 'bg-indigo-600 text-white shadow-xs' : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80'}`}
                    >
                      {rotulo}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Status do Certificado e Opção de Consulta ao Vivo */}
            <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                {clienteAtual?.certificado_url ? (
                  <span className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full font-medium border border-emerald-200/60">
                    <ShieldCheck size={13} className="text-emerald-600" />
                    Certificado Digital A1 Conectado ({clienteAtual.uf || 'MG'})
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-amber-800 bg-amber-50 px-2.5 py-1 rounded-full font-medium border border-amber-200/60">
                    <AlertTriangle size={13} className="text-amber-600" />
                    Sem Certificado A1 cadastrado (a SEFAZ exige certificado para consultar em tempo real)
                  </span>
                )}
              </div>

              <label className="flex items-center gap-2 cursor-pointer text-slate-600 select-none font-medium">
                <input
                  type="checkbox"
                  checked={consultarAoVivo}
                  onChange={(e) => setConsultarAoVivo(e.target.checked)}
                  disabled={!clienteAtual?.certificado_url}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span>Sincronizar ao vivo com WebService SEFAZ Nacional</span>
              </label>
            </div>
          </div>

          {/* Aviso SEFAZ (ex: Consumo Indevido / Rate Limit) */}
          {avisoSefaz && (
            <div className="p-3.5 bg-blue-50 border border-blue-200/80 rounded-xl text-xs text-blue-900 flex items-start gap-2.5">
              <AlertTriangle size={16} className="text-blue-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <span className="font-bold block mb-0.5">Informativo do WebService SEFAZ:</span>
                <p>{avisoSefaz}</p>
              </div>
            </div>
          )}

          {/* Cards de Resumo KPI */}
          {notas.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 animate-in fade-in">
              <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Notas Localizadas
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-slate-900">{resumo.totalNotas}</span>
                  <span className="text-xs text-slate-400 font-medium">NF-e Mod 55</span>
                </div>
              </div>

              <div className="bg-emerald-50/50 rounded-xl p-4 border border-emerald-200/70 shadow-xs">
                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block mb-1">
                  Valor Total das Compras
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-black text-emerald-900">
                    {resumo.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
              </div>

              <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-200/70 shadow-xs">
                <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider block mb-1">
                  XMLs Disponíveis
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-blue-900">{resumo.comXml}</span>
                  <span className="text-xs text-blue-600 font-medium">prontos p/ download</span>
                </div>
              </div>

              <div className="bg-amber-50/50 rounded-xl p-4 border border-amber-200/70 shadow-xs">
                <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block mb-1">
                  Sem Manifestação
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-amber-900">{resumo.semManifestacao}</span>
                  <span className="text-xs text-amber-600 font-medium">aguardando ciência</span>
                </div>
              </div>
            </div>
          )}

          {/* Barra de Ações em Lote e Filtros Locais */}
          {notas.length > 0 && (
            <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Barra de Seleção em Lote */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  {selectedChaves.length === notasFiltradas.length && notasFiltradas.length > 0 ? (
                    <CheckSquare size={14} className="text-indigo-600" />
                  ) : (
                    <Square size={14} className="text-slate-400" />
                  )}
                  {selectedChaves.length === notasFiltradas.length && notasFiltradas.length > 0
                    ? 'Desmarcar Todas'
                    : `Selecionar Todas (${notasFiltradas.length})`}
                </button>

                {selectedChaves.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={handleDownloadZipLote}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition shadow-xs"
                    >
                      <Download size={13} />
                      Baixar XMLs Selecionados ({selectedChaves.length}) .ZIP
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => setModalSalvarOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition"
                >
                  <Archive size={13} />
                  Salvar Consulta no Histórico
                </button>
              </div>

              {/* Filtro de Busca e Situação */}
              <div className="flex items-center gap-2">
                <select
                  value={filtroSituacao}
                  onChange={(e) => setFiltroSituacao(e.target.value as any)}
                  className="text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none"
                >
                  <option value="todas">Todas as Situações</option>
                  <option value="AUTORIZADA">Apenas Autorizadas</option>
                  <option value="CANCELADA">Apenas Canceladas</option>
                </select>

                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Filtrar por chave, número ou fornecedor..."
                    value={termoBusca}
                    onChange={(e) => setTermoBusca(e.target.value)}
                    className="text-xs pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 w-52"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Tabela de Notas Fiscais Destinadas */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse" style={{ tableLayout: 'fixed' }}>
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    <ResizableSortableTh
                      columnId="select"
                      label=""
                      disableSort
                      width={columnWidths.select}
                      onResize={handleResizeColumn}
                      minWidth={45}
                      align="center"
                    />
                    <ResizableSortableTh
                      columnId="doc"
                      label="Documento Fiscal"
                      sortKey="numero"
                      currentSortKey={sortKey}
                      currentSortDirection={sortDirection}
                      onSort={handleSort}
                      width={columnWidths.doc}
                      onResize={handleResizeColumn}
                      minWidth={160}
                    />
                    <ResizableSortableTh
                      columnId="fornecedor"
                      label="Fornecedor / Emitente"
                      sortKey="fornecedor"
                      currentSortKey={sortKey}
                      currentSortDirection={sortDirection}
                      onSort={handleSort}
                      width={columnWidths.fornecedor}
                      onResize={handleResizeColumn}
                      minWidth={160}
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
                      minWidth={100}
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
                      minWidth={100}
                    />
                    <ResizableSortableTh
                      columnId="situacao"
                      label="Situação SEFAZ"
                      sortKey="situacao"
                      currentSortKey={sortKey}
                      currentSortDirection={sortDirection}
                      onSort={handleSort}
                      width={columnWidths.situacao}
                      onResize={handleResizeColumn}
                      minWidth={110}
                      align="center"
                    />
                    <ResizableSortableTh
                      columnId="manifestacao"
                      label="Manifestação"
                      sortKey="manifestacao"
                      currentSortKey={sortKey}
                      currentSortDirection={sortDirection}
                      onSort={handleSort}
                      width={columnWidths.manifestacao}
                      onResize={handleResizeColumn}
                      minWidth={110}
                      align="center"
                    />
                    <ResizableSortableTh
                      columnId="acoes"
                      label="Ações Rápidas"
                      disableSort
                      width={columnWidths.acoes}
                      onResize={handleResizeColumn}
                      minWidth={130}
                      align="right"
                    />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingConsulta ? (
                    <tr>
                      <td colSpan={8} className="p-12 text-center text-slate-500">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <RefreshCw size={24} className="animate-spin text-indigo-600" />
                          <span className="font-semibold text-xs">Conectando ao WebService da SEFAZ Nacional...</span>
                          <span className="text-[11px] text-slate-400">Verificando notas emitidas contra o CNPJ na competência selecionada.</span>
                        </div>
                      </td>
                    </tr>
                  ) : notasDestinadasOrdenadas.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-12 text-center text-slate-500">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Inbox size={32} className="text-slate-300" />
                          <p className="font-bold text-sm text-slate-700">
                            {notas.length === 0 
                              ? 'Nenhuma nota de compra encontrada para os filtros atuais.' 
                              : 'Nenhuma nota encontrada com os filtros aplicados.'}
                          </p>
                          <p className="text-xs text-slate-400 max-w-md">
                            Selecione o mês desejado ou clique em <strong>Analisar Notas Destinadas (Ao Vivo)</strong> para buscar registros atualizados na SEFAZ.
                          </p>
                          {competenciasDisponiveis.length > 0 && (
                            <div className="mt-4 p-3 bg-indigo-50/60 border border-indigo-100 rounded-xl flex flex-col items-center gap-2 max-w-md">
                              <span className="text-xs font-bold text-indigo-900">
                                Existem compras registradas em outros meses:
                              </span>
                              <div className="flex flex-wrap items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCompetencia('todas')
                                    handleAnalisar('todas', false)
                                  }}
                                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition shadow-xs"
                                >
                                  Ver Todas as Notas
                                </button>
                                {competenciasDisponiveis.map(c => {
                                  const parts = c.split('-')
                                  const rotulo = parts.length === 2 ? `${parts[1]}/${parts[0]}` : c
                                  return (
                                    <button
                                      key={c}
                                      type="button"
                                      onClick={() => {
                                        setCompetencia(c)
                                        handleAnalisar(c, false)
                                      }}
                                      className="px-2.5 py-1 bg-white hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition"
                                    >
                                      {rotulo}
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    notasDestinadasOrdenadas.map((n) => {
                      const isSelected = selectedChaves.includes(n.chave)
                      return (
                        <tr 
                          key={n.chave} 
                          className={`hover:bg-indigo-50/30 transition ${isSelected ? 'bg-indigo-50/50' : ''}`}
                        >
                          <td className="p-3.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleSelect(n.chave)}
                              className="text-slate-400 hover:text-indigo-600 transition"
                            >
                              {isSelected ? (
                                <CheckSquare size={16} className="text-indigo-600" />
                              ) : (
                                <Square size={16} />
                              )}
                            </button>
                          </td>

                          {/* Documento */}
                          <td className="p-3.5 overflow-hidden">
                            <div className="flex items-center gap-1.5 font-bold text-slate-900 font-mono text-xs">
                              <span>NF-e #{n.numero}</span>
                              <span className="text-[10px] text-slate-400 font-sans font-normal">Série {n.serie}</span>
                            </div>
                            <div className="flex items-center gap-1 mt-0.5 overflow-hidden">
                              <span className="font-mono text-[10px] text-slate-500 truncate max-w-full select-all" title={n.chave}>
                                {n.chave}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopiarChave(n.chave)}
                                className="text-slate-400 hover:text-indigo-600 shrink-0"
                                title="Copiar chave de acesso"
                              >
                                {chaveCopiada === n.chave ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                              </button>
                            </div>
                          </td>

                          {/* Fornecedor */}
                          <td className="p-3.5 overflow-hidden">
                            <div className="font-bold text-slate-800 truncate max-w-full" title={n.emitente_nome}>
                              {n.emitente_nome}
                            </div>
                            <div className="text-[10px] font-mono text-slate-500 mt-0.5 truncate">
                              CNPJ: {formatarCnpjCpf(n.emitente_cnpj)}
                            </div>
                          </td>

                          {/* Data de Emissão */}
                          <td className="p-3.5 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                            {n.data_emissao ? new Date(n.data_emissao).toLocaleDateString('pt-BR') : '—'}
                          </td>

                          {/* Valor */}
                          <td className="p-3.5 font-bold text-slate-900 font-mono whitespace-nowrap">
                            {n.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </td>

                          {/* Situação SEFAZ */}
                          <td className="p-3.5 text-center">
                            {n.situacao_nfe === 'AUTORIZADA' ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                Autorizada
                              </span>
                            ) : n.situacao_nfe === 'CANCELADA' ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800">
                                Cancelada
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                                Denegada
                              </span>
                            )}
                          </td>

                          {/* Manifestação */}
                          <td className="p-3.5 text-center">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-600">
                              {n.manifestacao_status === 'CONFIRMADA'
                                ? 'Confirmada'
                                : n.manifestacao_status === 'CIENCIA'
                                  ? 'Ciência da Emissão'
                                  : 'Sem Manifestação'}
                            </span>
                          </td>

                          {/* Ações Rápidas por Linha */}
                          <td className="p-3.5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Baixar XML */}
                              <button
                                type="button"
                                onClick={() => handleBaixarXmlIndividual(n)}
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold transition"
                                title="Baixar arquivo XML original"
                              >
                                <Download size={12} />
                                <span>XML</span>
                              </button>

                              {/* Gerar / Baixar DANFE */}
                              <button
                                type="button"
                                onClick={() => handleGerarDanfeIndividual(n)}
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold transition"
                                title="Visualizar e Imprimir DANFE em PDF"
                              >
                                <FileText size={12} />
                                <span>DANFE</span>
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
        </div>
      )}

      {/* ABA 2: CONSULTAS SALVAS / HISTÓRICO ORGANIZADO */}
      {abaAtiva === 'salvas' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-slate-900 text-base">Histórico de Consultas Salvas</h2>
              <p className="text-xs text-slate-500">
                Acesse snapshots organizados de consultas anteriores sem necessidade de reconectar à SEFAZ.
              </p>
            </div>

            <button
              type="button"
              onClick={carregarConsultasSalvas}
              disabled={loadingSalvas}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition"
            >
              <RefreshCw size={13} className={loadingSalvas ? 'animate-spin' : ''} />
              Atualizar Lista
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loadingSalvas ? (
              <div className="col-span-full p-12 text-center text-slate-500">
                <RefreshCw size={24} className="animate-spin text-indigo-600 mx-auto mb-2" />
                <p className="text-xs font-semibold">Carregando histórico de consultas...</p>
              </div>
            ) : consultasSalvas.length === 0 ? (
              <div className="col-span-full bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500">
                <FolderArchive size={36} className="text-slate-300 mx-auto mb-3" />
                <p className="font-bold text-sm text-slate-700 mb-1">Nenhuma consulta arquivada ainda.</p>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Na aba de <strong>Consulta em Tempo Real</strong>, após clicar em Analisar, utilize o botão <strong>Salvar Consulta no Histórico</strong> para guardar a lista e os XMLs desta competência.
                </p>
              </div>
            ) : (
              consultasSalvas.map(c => (
                <div 
                  key={c.id} 
                  className="bg-white rounded-2xl p-5 border border-slate-200/90 hover:border-indigo-300 shadow-xs hover:shadow-md transition space-y-3.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="p-1 bg-indigo-50 text-indigo-600 rounded-md">
                          <Calendar size={13} />
                        </span>
                        <span className="font-black text-sm text-slate-900 font-mono">
                          {c.competencia}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-800 mt-1 line-clamp-1">
                        {c.clientes?.razao_social || 'Cliente'}
                      </p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        CNPJ: {formatarCnpjCpf(c.clientes?.cnpj || '')}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleExcluirConsultaSalva(c.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      title="Excluir consulta arquivada"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl grid grid-cols-2 gap-2 text-center border border-slate-100">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Total de Notas</span>
                      <span className="text-base font-black text-slate-900">{c.total_notas}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Valor Total</span>
                      <span className="text-xs font-black text-emerald-700 font-mono">
                        {c.valor_total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                  </div>

                  {c.observacoes && (
                    <p className="text-[11px] text-slate-600 italic bg-slate-50/60 p-2 rounded-lg border border-slate-100">
                      "{c.observacoes}"
                    </p>
                  )}

                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                    <span>Salvo em: {new Date(c.created_at).toLocaleDateString('pt-BR')}</span>
                    <button
                      type="button"
                      onClick={() => handleAbrirConsultaSalva(c)}
                      className="flex items-center gap-1 font-bold text-indigo-600 hover:text-indigo-800"
                    >
                      <span>Abrir Consulta</span>
                      <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Modal: Salvar Consulta no Histórico */}
      {modalSalvarOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2 text-indigo-700">
                <FolderArchive size={20} />
                <h3 className="font-bold text-slate-900 text-base">Salvar Consulta no Histórico</h3>
              </div>
              <button
                type="button"
                onClick={() => setModalSalvarOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSalvarConsulta} className="space-y-4">
              <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-xs text-indigo-900 space-y-1">
                <p><strong>Empresa:</strong> {clienteAtual?.razao_social}</p>
                <p><strong>Competência:</strong> {competencia}</p>
                <p><strong>Total de Registros:</strong> {notas.length} notas ({resumo.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Anotação / Observações (Opcional):
                </label>
                <textarea
                  rows={3}
                  value={observacaoSalvar}
                  onChange={(e) => setObservacaoSalvar(e.target.value)}
                  placeholder="Ex: Fechamento fiscal conferido com a contabilidade..."
                  className="w-full text-xs text-slate-800 border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalSalvarOpen(false)}
                  disabled={salvandoConsulta}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoConsulta}
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition shadow-xs"
                >
                  {salvandoConsulta ? 'Salvando...' : 'Confirmar e Arquivar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
