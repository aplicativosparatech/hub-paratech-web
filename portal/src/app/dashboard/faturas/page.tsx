'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import {
  FileText,
  Plus,
  X,
  Pencil,
  Trash2,
  RefreshCw,
  Zap,
  DollarSign,
  Clock,
  Timer,
  Search,
  ExternalLink,
  MessageSquare,
  Check,
  Building2,
  Laptop,
  CheckCircle2,
  Calendar,
  AlertCircle
} from 'lucide-react'
import toast from 'react-hot-toast'
import ResizableSortableTh from '@/components/ui/ResizableSortableTh'
import { useTableFeatures } from '@/hooks/useTableFeatures'
import { formatarDuasCasasDecimais, parseValorDecimal } from '@/utils/money'
import { formatarCnpjCpf, limparDocumento } from '@/utils/cnpjAlfanumerico'

export default function FaturasPage() {
  const [faturas, setFaturas] = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [gerando, setGerando] = useState(false)
  const [gerandoLote, setGerandoLote] = useState(false)
  const supabase = createClient()

  // Filtro de busca na tabela
  const [filtroTexto, setFiltroTexto] = useState('')

  // Form de nova fatura / edição
  const [selectedCliente, setSelectedCliente] = useState('')
  const [clienteBusca, setClienteBusca] = useState('')
  const [dropdownClientesAberto, setDropdownClientesAberto] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const [competencia, setCompetencia] = useState('')
  const [dataVencimento, setDataVencimento] = useState('')
  const [valor, setValor] = useState('')
  const [statusFatura, setStatusFatura] = useState<'pendente' | 'pago' | 'cancelado'>('pendente')
  const [dataPagamento, setDataPagamento] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  // Modal Geração em Lote
  const [confirmLoteModalOpen, setConfirmLoteModalOpen] = useState(false)
  const [loteCompetencia, setLoteCompetencia] = useState('')
  const [loteEnviarWhatsapp, setLoteEnviarWhatsapp] = useState(true)
  const [resumoLoteModal, setResumoLoteModal] = useState<any>(null)

  // Modal Exclusão
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; id: string; clienteNome?: string }>({
    open: false,
    id: '',
    clienteNome: ''
  })

  // Regras de desbloqueio em confiança
  const [limiteConfianca, setLimiteConfianca] = useState(1)
  const [horasConfianca, setHorasConfianca] = useState(24)

  async function fetchFaturas() {
    const { data } = await supabase
      .from('faturas')
      .select('*, clientes(id, razao_social, nome_fantasia, cnpj, nome_sistema_utilizado, whatsapp, whatsapp_cobranca)')
      .order('data_vencimento', { ascending: false })
    if (data) setFaturas(data)
    setLoading(false)
  }

  async function fetchClientes() {
    const { data } = await supabase
      .from('clientes')
      .select('id, razao_social, nome_fantasia, cnpj, valor_mensalidade, dia_vencimento, nome_sistema_utilizado, is_ativo')
      .order('razao_social', { ascending: true })
    if (data) setClientes(data)
  }

  useEffect(() => {
    fetchFaturas()
    fetchClientes()

    // Inicializa competência do mês corrente (MM/AAAA)
    const hoje = new Date()
    const compAtual = `${String(hoje.getMonth() + 1).padStart(2, '0')}/${hoje.getFullYear()}`
    setLoteCompetencia(compAtual)

    async function loadConfigGeral() {
      const { data } = await supabase
        .from('configuracoes_portal_geral')
        .select('limite_desbloqueios_confianca, horas_desbloqueio_confianca')
        .eq('id', 1)
        .maybeSingle()
      if (data?.limite_desbloqueios_confianca) setLimiteConfianca(Number(data.limite_desbloqueios_confianca))
      if (data?.horas_desbloqueio_confianca) setHorasConfianca(Number(data.horas_desbloqueio_confianca))
    }
    loadConfigGeral()
  }, [])

  // Fechar dropdown de clientes ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownClientesAberto(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Clientes filtrados para o seletor do modal (busca inteligente por Nome Fantasia, Razão Social ou CNPJ)
  const clientesFiltrados = useMemo(() => {
    const termo = clienteBusca.toLowerCase().trim()
    const termoLimpo = limparDocumento(termo)

    return clientes.filter(c => {
      if (!termo) return true
      const matchRazao = c.razao_social?.toLowerCase().includes(termo)
      const matchFantasia = c.nome_fantasia?.toLowerCase().includes(termo)
      const matchCnpj = c.cnpj && (c.cnpj.toLowerCase().includes(termo) || (termoLimpo && limparDocumento(c.cnpj).includes(termoLimpo)))
      const matchSistema = c.nome_sistema_utilizado?.toLowerCase().includes(termo)
      return matchRazao || matchFantasia || matchCnpj || matchSistema
    })
  }, [clientes, clienteBusca])

  // Cliente atualmente selecionado no form
  const clienteSelecionadoObj = useMemo(() => {
    return clientes.find(c => c.id === selectedCliente) || null
  }, [clientes, selectedCliente])

  // Gerar faturas em lote (faltantes do mês)
  const executarGerarLote = async () => {
    setConfirmLoteModalOpen(false)
    setGerandoLote(true)
    const toastId = toast.loading('Processando faturas dos mensalistas...')
    try {
      const res = await fetch('/api/cron/gerar-faturas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          competencia: loteCompetencia || undefined,
          disparar_whatsapp: loteEnviarWhatsapp
        })
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Erro ao gerar faturas')

      setResumoLoteModal(data.result)
      toast.success(
        `${data.result.faturasCriadas} nova(s) fatura(s) gerada(s)! ${data.result.mensagensEnviadas || 0} WhatsApp(s) enviado(s).`,
        { id: toastId, duration: 5000 }
      )
      fetchFaturas()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao gerar faturas em lote', { id: toastId })
    } finally {
      setGerandoLote(false)
    }
  }

  // Quando seleciona um cliente no combobox
  const selecionarCliente = (c: any) => {
    setSelectedCliente(c.id)
    setDropdownClientesAberto(false)
    setClienteBusca('')

    // Preenchimento automático de dados
    const diaVenc = c.dia_vencimento || 10
    const valMensal = c.valor_mensalidade

    const hoje = new Date()
    const mesComp = `${String(hoje.getMonth() + 1).padStart(2, '0')}/${hoje.getFullYear()}`
    const anoVenc = hoje.getFullYear()
    const mesVenc = hoje.getMonth() + 1
    const dataVenc = `${anoVenc}-${String(mesVenc).padStart(2, '0')}-${String(diaVenc).padStart(2, '0')}`

    if (!editingId) {
      setCompetencia(mesComp)
      setDataVencimento(dataVenc)
    }

    // SEMPRE traz o valor da fatura exatamente o mesmo do cadastro do cliente!
    setValor(valMensal !== undefined && valMensal !== null ? formatarDuasCasasDecimais(valMensal) : '')
  }

  const handleEditFatura = (f: any) => {
    setEditingId(f.id)
    setSelectedCliente(f.cliente_id)
    setCompetencia(f.competencia)
    setDataVencimento(f.data_vencimento)
    setStatusFatura(f.status || 'pendente')
    setDataPagamento(f.data_pagamento ? f.data_pagamento.split('T')[0] : '')

    // Busca o cliente correspondente para trazer o valor do cadastro
    const cli = clientes.find(c => c.id === f.cliente_id)
    const valorCadastrado = cli?.valor_mensalidade
    const valorDefinir = (valorCadastrado !== undefined && valorCadastrado !== null && Number(valorCadastrado) > 0)
      ? valorCadastrado
      : (f.valor_original ?? f.valor)

    setValor(formatarDuasCasasDecimais(valorDefinir))
    setModalOpen(true)
  }

  const executarExcluirFatura = async () => {
    if (!deleteModal.id) return
    const { error } = await supabase.from('faturas').delete().eq('id', deleteModal.id)
    if (error) {
      toast.error('Erro ao excluir fatura: ' + error.message)
    } else {
      toast.success('Fatura excluída com sucesso!')
      fetchFaturas()
    }
    setDeleteModal({ open: false, id: '', clienteNome: '' })
  }

  const handleGerarFatura = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCliente) {
      toast.error('Selecione um cliente para vincular à fatura.')
      return
    }
    setGerando(true)

    const valorNumerico = parseValorDecimal(valor)

    let error: any
    if (editingId) {
      const { error: updateError } = await supabase
        .from('faturas')
        .update({
          cliente_id: selectedCliente,
          competencia,
          data_vencimento: dataVencimento,
          valor: valorNumerico,
          valor_original: valorNumerico,
          valor_multa: 0,
          valor_juros: 0,
          status: statusFatura,
          data_pagamento: statusFatura === 'pago' 
            ? (dataPagamento ? `${dataPagamento}T12:00:00.000Z` : new Date().toISOString()) 
            : null,
          qr_code_payload: null // reseta Pix para regenerar com valor atualizado
        })
        .eq('id', editingId)
      error = updateError

      // Se foi alterado para 'pago', chama rotina para gerar próxima fatura em dia útil se necessário
      if (!error && statusFatura === 'pago') {
        try {
          await fetch('/api/pagamentos/confirmar-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fatura_id: editingId, status: 'pago' })
          })
        } catch (err) {
          console.warn('Erro ao disparar rotina de pagamento:', err)
        }
      }
    } else {
      const { error: insertError } = await supabase.from('faturas').insert([
        {
          cliente_id: selectedCliente,
          competencia,
          data_vencimento: dataVencimento,
          valor: valorNumerico,
          valor_original: valorNumerico,
          status: 'pendente'
        }
      ])
      error = insertError
    }

    if (error) {
      toast.error('Erro ao salvar fatura: ' + error.message)
    } else {
      toast.success(editingId ? 'Fatura atualizada com sucesso!' : 'Fatura gerada com sucesso!')
      closeModal()
      fetchFaturas()
    }
    setGerando(false)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingId(null)
    setSelectedCliente('')
    setClienteBusca('')
    setDropdownClientesAberto(false)
    setCompetencia('')
    setDataVencimento('')
    setValor('')
    setStatusFatura('pendente')
    setDataPagamento('')
  }

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'pago':
      case 'paga':
        return 'bg-emerald-100 text-emerald-800 border border-emerald-200'
      case 'pendente':
        return 'bg-amber-100 text-amber-800 border border-amber-200'
      case 'cancelado':
        return 'bg-slate-100 text-slate-500 border border-slate-200'
      default:
        return 'bg-slate-100 text-slate-500 border border-slate-200'
    }
  }

  const isVencida = (dataVenc: string, status: string) => {
    if (status !== 'pendente') return false
    return new Date(dataVenc) < new Date()
  }

  const isConfidenceActive = (f: any) => {
    if (!f?.desbloqueio_confianca_em) return false
    const dataInicio = new Date(f.desbloqueio_confianca_em).getTime()
    if (isNaN(dataInicio)) return false
    const dataFim = dataInicio + horasConfianca * 3600 * 1000
    return Date.now() < dataFim
  }

  // Filtragem da tabela por texto (Razão Social, Nome Fantasia, CNPJ ou Competência)
  const faturasFiltradasPorBusca = useMemo(() => {
    const termo = filtroTexto.toLowerCase().trim()
    const termoLimpo = limparDocumento(termo)

    if (!termo) return faturas

    return faturas.filter(f => {
      const cli = f.clientes
      const matchRazao = cli?.razao_social?.toLowerCase().includes(termo)
      const matchFantasia = cli?.nome_fantasia?.toLowerCase().includes(termo)
      const matchCnpj = cli?.cnpj && (cli.cnpj.toLowerCase().includes(termo) || (termoLimpo && limparDocumento(cli.cnpj).includes(termoLimpo)))
      const matchComp = f.competencia?.toLowerCase().includes(termo)
      const matchStatus = f.status?.toLowerCase().includes(termo)
      return matchRazao || matchFantasia || matchCnpj || matchComp || matchStatus
    })
  }, [faturas, filtroTexto])

  const {
    sortedData: faturasOrdenadas,
    sortKey,
    sortDirection,
    handleSort,
    columnWidths,
    handleResizeColumn
  } = useTableFeatures({
    data: faturasFiltradasPorBusca,
    tableId: 'faturas_admin',
    defaultSortKey: 'data_vencimento',
    defaultSortDirection: 'desc',
    initialWidths: {
      cliente: 320,
      competencia: 130,
      vencimento: 160,
      valor: 130,
      status: 130,
      acoes: 180
    },
    customExtractors: {
      cliente: (f: any) => f.clientes?.nome_fantasia || f.clientes?.razao_social || '',
      competencia: (f: any) => f.competencia || '',
      data_vencimento: (f: any) => f.data_vencimento || '',
      valor: (f: any) => Number(f.valor || 0),
      status: (f: any) => f.status || ''
    }
  })

  return (
    <div className="p-8">
      {/* Header Superior */}
      <header className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Faturas e Pagamentos</h1>
          <p className="text-slate-500 mt-1">Histórico de cobranças, emissão inteligente e controle de mensalidades.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/dashboard/configuracoes-portal?aba=cobranca"
            className="bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-300 px-4 py-2 rounded-xl font-semibold transition flex items-center gap-2 shadow-2xs text-sm"
            title="Configurar regras globais de juros, multa por atraso, dias de carência e desbloqueio em confiança"
          >
            <DollarSign size={18} className="text-emerald-700" />
            Regras de Cobrança
          </Link>

          <button
            onClick={() => {
              setLoading(true)
              fetchFaturas()
            }}
            className="bg-slate-100 text-slate-600 px-4 py-2 rounded-xl font-medium hover:bg-slate-200 transition flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw size={18} />
            Atualizar
          </button>

          {/* Botão Gerar Todas (Faltantes) */}
          <button
            onClick={() => setConfirmLoteModalOpen(true)}
            disabled={gerandoLote}
            className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-emerald-700 transition flex items-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
            title="Verifica todos os clientes ativos mensalistas e gera as faturas faltantes da competência sem duplicar"
          >
            <Zap size={18} className={gerandoLote ? 'animate-spin' : ''} />
            {gerandoLote ? 'Processando...' : 'Gerar Todas (Faltantes)'}
          </button>

          {/* Botão Gerar Fatura Avulsa */}
          <button
            onClick={() => {
              setEditingId(null)
              setSelectedCliente('')
              setClienteBusca('')
              setModalOpen(true)
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-blue-700 transition flex items-center gap-2 shadow-sm cursor-pointer"
          >
            <Plus size={18} />
            Gerar Fatura Avulsa
          </button>
        </div>
      </header>

      {/* Barra de Filtros e Busca Rápida na Tabela */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-4 mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative flex-1 w-full">
          <Search size={18} className="absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar faturas por Nome Fantasia, Razão Social, CNPJ ou Competência..."
            value={filtroTexto}
            onChange={e => setFiltroTexto(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
          />
          {filtroTexto && (
            <button
              onClick={() => setFiltroTexto('')}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs px-1.5 py-0.5 rounded bg-slate-200"
            >
              Limpar
            </button>
          )}
        </div>

        <div className="text-xs text-slate-500 shrink-0 font-medium">
          Exibindo <strong>{faturasOrdenadas.length}</strong> de <strong>{faturas.length}</strong> faturas
        </div>
      </div>

      {/* Tabela de Faturas */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto custom-scrollbar w-full">
        <table className="w-full text-left border-collapse min-w-[950px]">
          <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 shadow-2xs">
            <tr className="bg-slate-50 border-b border-slate-200">
              <ResizableSortableTh
                columnId="cliente"
                label="Cliente / Razão / Fantasia"
                sortKey="cliente"
                currentSortKey={sortKey}
                currentSortDirection={sortDirection}
                onSort={handleSort}
                width={columnWidths.cliente}
                onResize={handleResizeColumn}
                minWidth={200}
              />
              <ResizableSortableTh
                columnId="competencia"
                label="Competência"
                sortKey="competencia"
                currentSortKey={sortKey}
                currentSortDirection={sortDirection}
                onSort={handleSort}
                width={columnWidths.competencia}
                onResize={handleResizeColumn}
                minWidth={100}
              />
              <ResizableSortableTh
                columnId="vencimento"
                label="Vencimento"
                sortKey="data_vencimento"
                currentSortKey={sortKey}
                currentSortDirection={sortDirection}
                onSort={handleSort}
                width={columnWidths.vencimento}
                onResize={handleResizeColumn}
                minWidth={130}
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
                columnId="status"
                label="Status"
                sortKey="status"
                currentSortKey={sortKey}
                currentSortDirection={sortDirection}
                onSort={handleSort}
                width={columnWidths.status}
                onResize={handleResizeColumn}
                minWidth={120}
              />
              <ResizableSortableTh
                columnId="acoes"
                label="Ações & Pagamento"
                disableSort
                width={columnWidths.acoes}
                onResize={handleResizeColumn}
                minWidth={160}
                align="right"
              />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <span>Carregando faturas...</span>
                  </div>
                </td>
              </tr>
            ) : faturasOrdenadas.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-12 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <FileText size={40} className="text-slate-300" />
                    <p className="text-slate-600 font-semibold">
                      {filtroTexto ? 'Nenhuma fatura encontrada para este filtro.' : 'Nenhuma fatura gerada ainda.'}
                    </p>
                    <p className="text-slate-400 text-sm">
                      {filtroTexto
                        ? 'Tente buscar por outro termo ou limpe o campo de busca.'
                        : 'Clique em "Gerar Todas (Faltantes)" ou "Gerar Fatura Avulsa".'}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              faturasOrdenadas.map(f => {
                const cli = f.clientes
                const nomeDestaque = cli?.nome_fantasia || cli?.razao_social || 'Cliente não identificado'
                const temFantasia = Boolean(cli?.nome_fantasia && cli?.razao_social && cli.nome_fantasia !== cli.razao_social)

                return (
                  <tr
                    key={f.id}
                    className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                      isVencida(f.data_vencimento, f.status) ? 'bg-red-50/40' : ''
                    }`}
                  >
                    {/* Coluna Cliente */}
                    <td className="p-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900 text-sm">{nomeDestaque}</span>
                        {temFantasia && (
                          <span className="text-xs text-slate-500 font-normal truncate max-w-[280px]">
                            {cli.razao_social}
                          </span>
                        )}
                        <div className="flex items-center gap-2 mt-0.5">
                          {cli?.cnpj && (
                            <span className="text-[11px] font-mono text-slate-400">
                              {formatarCnpjCpf(cli.cnpj)}
                            </span>
                          )}
                          {cli?.nome_sistema_utilizado && (
                            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 font-medium border border-blue-200">
                              <Laptop size={10} />
                              {cli.nome_sistema_utilizado}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Competência */}
                    <td className="p-4 text-slate-700 font-semibold text-sm">{f.competencia}</td>

                    {/* Vencimento */}
                    <td className="p-4 text-slate-700 text-sm">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={14} className="text-slate-400" />
                        <span>{new Date(f.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                      </div>
                      {isVencida(f.data_vencimento, f.status) && (
                        <span className="mt-1 inline-block text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-bold border border-red-200">
                          VENCIDA
                        </span>
                      )}
                    </td>

                    {/* Valor */}
                    <td className="p-4 text-slate-900 font-bold text-sm">
                      R$ {parseFloat(f.valor).toFixed(2)}
                    </td>

                    {/* Status */}
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${getStatusStyle(f.status)}`}>
                        {f.status}
                      </span>
                      {f.status === 'pendente' && isConfidenceActive(f) && (
                        <div className="mt-1">
                          <ConfidenceCountdown
                            desbloqueioEm={f.desbloqueio_confianca_em}
                            horasDuracao={horasConfianca}
                            compact
                          />
                        </div>
                      )}
                    </td>

                    {/* Ações */}
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {/* Link Público da Fatura */}
                        <Link
                          href={`/fatura/${f.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition"
                          title="Abrir página pública de pagamento Pix da fatura"
                        >
                          <ExternalLink size={16} />
                        </Link>

                        {/* Editar Fatura */}
                        <button
                          onClick={() => handleEditFatura(f)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                          title="Editar Fatura"
                        >
                          <Pencil size={16} />
                        </button>

                        {/* Excluir Fatura */}
                        <button
                          onClick={() =>
                            setDeleteModal({
                              open: true,
                              id: f.id,
                              clienteNome: cli?.nome_fantasia || cli?.razao_social
                            })
                          }
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                          title="Excluir Fatura"
                        >
                          <Trash2 size={16} />
                        </button>

                        {/* Botões específicos para Pendente */}
                        {f.status === 'pendente' && (
                          <>
                            {/* Desbloqueio em Confiança */}
                            <button
                              disabled={(f.confianca_qtd || 0) >= limiteConfianca || isConfidenceActive(f)}
                              onClick={async () => {
                                const toastId = toast.loading('Processando liberação em confiança...')
                                try {
                                  const res = await fetch('/api/faturas/desbloqueio-confianca', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ fatura_id: f.id })
                                  })
                                  const data = await res.json()
                                  if (!res.ok) throw new Error(data.error || 'Erro ao liberar em confiança')
                                  toast.success(data.mensagem, { id: toastId })
                                  fetchFaturas()
                                } catch (err: any) {
                                  toast.error(err.message, { id: toastId })
                                }
                              }}
                              className={`text-[11px] px-2.5 py-1 rounded-lg transition font-semibold cursor-pointer ${
                                isConfidenceActive(f)
                                  ? 'bg-amber-100 text-amber-900 border border-amber-300 cursor-default'
                                  : (f.confianca_qtd || 0) >= limiteConfianca
                                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                    : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                              }`}
                              title={
                                isConfidenceActive(f)
                                  ? `Desbloqueio em confiança ativo (válido por ${horasConfianca}h)`
                                  : (f.confianca_qtd || 0) >= limiteConfianca
                                    ? 'Limite de desbloqueios em confiança atingido'
                                    : 'Libera o bloqueio do sistema no cliente por 24 horas'
                              }
                            >
                              {isConfidenceActive(f) ? 'Confiança Ativa' : 'Desbloquear 24h'}
                            </button>

                            {/* Simular Pagamento */}
                            <button
                              onClick={async () => {
                                const toastId = toast.loading('Registrando pagamento...')
                                try {
                                  const res = await fetch('/api/faturas/baixar-manual', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ fatura_id: f.id })
                                  })
                                  const data = await res.json()
                                  if (!res.ok) throw new Error(data.error || 'Erro ao registrar pagamento')
                                  toast.success('Pagamento confirmado e próxima fatura gerada com sucesso!', { id: toastId })
                                  fetchFaturas()
                                } catch (err: any) {
                                  toast.error(err.message, { id: toastId })
                                }
                              }}
                              className="text-[11px] bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-1 rounded-lg hover:bg-emerald-200 transition font-semibold cursor-pointer"
                              title="Confirma o pagamento e já gera automaticamente a fatura do próximo mês"
                            >
                              Simular Pagamento
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL 1: Gerar / Editar Fatura com Busca Inteligente */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-bold text-slate-900">
                  {editingId ? 'Editar Fatura' : 'Gerar Fatura Avulsa'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Preencha os dados da fatura para o cliente selecionado.
                </p>
              </div>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleGerarFatura} className="space-y-4">
              {/* Seletor Inteligente de Cliente */}
              <div className="relative" ref={dropdownRef}>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Cliente <span className="text-red-500">*</span>
                </label>

                {clienteSelecionadoObj ? (
                  // Card do Cliente Selecionado
                  <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-blue-600 text-white rounded-xl flex items-center justify-center font-bold text-sm shrink-0">
                        <Building2 size={18} />
                      </div>
                      <div className="text-left overflow-hidden">
                        <span className="font-bold text-slate-900 text-sm block truncate">
                          {clienteSelecionadoObj.nome_fantasia || clienteSelecionadoObj.razao_social}
                        </span>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          {clienteSelecionadoObj.cnpj && (
                            <span className="font-mono">{formatarCnpjCpf(clienteSelecionadoObj.cnpj)}</span>
                          )}
                          {clienteSelecionadoObj.nome_sistema_utilizado && (
                            <span className="text-blue-700 font-semibold bg-blue-100 px-1.5 py-0.2 rounded text-[10px]">
                              {clienteSelecionadoObj.nome_sistema_utilizado}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {!editingId && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCliente('')
                          setClienteBusca('')
                          setDropdownClientesAberto(true)
                        }}
                        className="text-xs text-blue-700 hover:text-blue-900 font-semibold px-2 py-1 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 transition cursor-pointer"
                      >
                        Trocar
                      </button>
                    )}
                  </div>
                ) : (
                  // Input de Busca
                  <div className="relative">
                    <Search size={18} className="absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Buscar por Nome Fantasia, Razão Social ou CNPJ..."
                      value={clienteBusca}
                      onChange={e => {
                        setClienteBusca(e.target.value)
                        setDropdownClientesAberto(true)
                      }}
                      onFocus={() => setDropdownClientesAberto(true)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                    />

                    {/* Dropdown com resultados filtrados */}
                    {dropdownClientesAberto && (
                      <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-2xl max-h-60 overflow-y-auto z-50 custom-scrollbar p-1">
                        {clientesFiltrados.length === 0 ? (
                          <div className="p-4 text-center text-xs text-slate-500">
                            Nenhum cliente encontrado para &quot;{clienteBusca}&quot;
                          </div>
                        ) : (
                          clientesFiltrados.map(c => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => selecionarCliente(c)}
                              className="w-full text-left p-3 hover:bg-blue-50/70 rounded-xl transition flex items-center justify-between gap-3 border-b border-slate-50 last:border-none cursor-pointer"
                            >
                              <div className="overflow-hidden">
                                <div className="font-bold text-slate-900 text-sm truncate">
                                  {c.nome_fantasia || c.razao_social}
                                </div>
                                {c.nome_fantasia && c.razao_social && c.nome_fantasia !== c.razao_social && (
                                  <div className="text-xs text-slate-500 truncate">{c.razao_social}</div>
                                )}
                                <div className="flex items-center gap-2 mt-1">
                                  {c.cnpj && (
                                    <span className="text-[11px] font-mono text-slate-400">
                                      {formatarCnpjCpf(c.cnpj)}
                                    </span>
                                  )}
                                  {c.nome_sistema_utilizado && (
                                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-100 text-blue-700 font-medium">
                                      {c.nome_sistema_utilizado}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                {c.valor_mensalidade ? (
                                  <span className="text-xs font-bold text-emerald-700 block">
                                    R$ {formatarDuasCasasDecimais(c.valor_mensalidade)}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-400 block">Sem valor</span>
                                )}
                                <span className="text-[10px] text-slate-400 block">
                                  Venc: dia {c.dia_vencimento || 10}
                                </span>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
                <p className="text-[11px] text-slate-400 mt-1">
                  Ao selecionar o cliente, competência, data de vencimento e valor serão pré-preenchidos.
                </p>
              </div>

              {/* Competência e Vencimento */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Competência</label>
                  <input
                    required
                    type="text"
                    placeholder="11/2026"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                    value={competencia}
                    onChange={e => setCompetencia(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Data de Vencimento</label>
                  <input
                    required
                    type="date"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                    value={dataVencimento}
                    onChange={e => setDataVencimento(e.target.value)}
                  />
                </div>
              </div>

              {/* Valor */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-semibold text-slate-700">
                    Valor da Fatura (R$) <span className="text-red-500">*</span>
                  </label>
                  {clienteSelecionadoObj?.valor_mensalidade ? (
                    <button
                      type="button"
                      onClick={() => setValor(formatarDuasCasasDecimais(clienteSelecionadoObj.valor_mensalidade))}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium underline cursor-pointer"
                      title="Preenche o campo com o valor de mensalidade cadastrado no cliente"
                    >
                      Usar valor do cadastro (R$ {formatarDuasCasasDecimais(clienteSelecionadoObj.valor_mensalidade)})
                    </button>
                  ) : null}
                </div>
                <input
                  required
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-lg text-slate-900"
                  value={valor}
                  onChange={e => setValor(e.target.value)}
                  onBlur={e => {
                    if (e.target.value) {
                      setValor(formatarDuasCasasDecimais(e.target.value))
                    }
                  }}
                />
                {clienteSelecionadoObj?.valor_mensalidade ? (
                  <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                    <span>Mensalidade cadastrada no cliente:</span>
                    <strong className="text-emerald-700">
                      R$ {formatarDuasCasasDecimais(clienteSelecionadoObj.valor_mensalidade)}
                    </strong>
                  </p>
                ) : null}
              </div>

              {/* Status da Fatura e Data do Pagamento */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Status da Fatura
                  </label>
                  <select
                    value={statusFatura}
                    onChange={e => {
                      const newStatus = e.target.value as 'pendente' | 'pago' | 'cancelado'
                      setStatusFatura(newStatus)
                      if (newStatus === 'pago' && !dataPagamento) {
                        setDataPagamento(new Date().toISOString().split('T')[0])
                      }
                    }}
                    className={`w-full px-3.5 py-2.5 rounded-xl border font-bold text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${
                      statusFatura === 'pago' ? 'text-emerald-700 border-emerald-300' :
                      statusFatura === 'cancelado' ? 'text-rose-700 border-rose-300' :
                      'text-amber-700 border-amber-300'
                    }`}
                  >
                    <option value="pendente">⏳ Pendente</option>
                    <option value="pago">✅ Pago / Quitado</option>
                    <option value="cancelado">❌ Cancelado</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Data do Pagamento {statusFatura === 'pago' && <span className="text-emerald-600 font-bold">*</span>}
                  </label>
                  <input
                    type="date"
                    disabled={statusFatura !== 'pago'}
                    value={dataPagamento}
                    onChange={e => setDataPagamento(e.target.value)}
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      statusFatura === 'pago' 
                        ? 'bg-white border-emerald-300 text-slate-900 cursor-text' 
                        : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  />
                  {statusFatura !== 'pago' && (
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Habilitado quando status for &quot;Pago&quot;
                    </span>
                  )}
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition font-medium cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={gerando}
                  className="px-6 py-2.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition disabled:opacity-50 shadow-sm cursor-pointer"
                >
                  {gerando ? 'Salvando...' : editingId ? 'Atualizar Fatura' : 'Gerar Fatura'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Gerar Todas as Faturas (Faltantes do Mês) com Envio WhatsApp */}
      {confirmLoteModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner">
              <Zap size={28} />
            </div>

            <h3 className="text-xl font-bold text-slate-900 text-center mb-1">
              Gerar Faturas Faltantes do Mês
            </h3>
            <p className="text-xs text-slate-500 text-center mb-5 leading-relaxed">
              O sistema verifica todos os clientes ativos mensalistas e cria as faturas da competência que ainda não existem.
              <span className="block text-emerald-600 font-semibold mt-1">✓ Idempotente: faturas existentes não são duplicadas.</span>
            </p>

            <div className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Competência de Cobrança</label>
                <input
                  type="text"
                  placeholder="11/2026"
                  value={loteCompetencia}
                  onChange={e => setLoteCompetencia(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl border border-slate-300 font-bold text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Opção Disparar WhatsApp */}
              <label className="flex items-start gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200 cursor-pointer hover:bg-emerald-50/50 transition">
                <input
                  type="checkbox"
                  checked={loteEnviarWhatsapp}
                  onChange={e => setLoteEnviarWhatsapp(e.target.checked)}
                  className="mt-0.5 w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
                />
                <div className="text-xs text-slate-700">
                  <span className="font-bold flex items-center gap-1.5 text-slate-900">
                    <MessageSquare size={14} className="text-emerald-600" />
                    Enviar fatura e Pix via WhatsApp
                  </span>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    Dispara mensagem cumprimentando o cliente, avisando sobre o sistema comercial, enviando o link de pagamento e o código Pix Copia e Cola.
                  </p>
                </div>
              </label>
            </div>

            <div className="flex gap-3 justify-center mt-6">
              <button
                type="button"
                onClick={() => setConfirmLoteModalOpen(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={executarGerarLote}
                className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition shadow-sm cursor-pointer"
              >
                Confirmar e Gerar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Relatório de Resultado da Geração em Lote */}
      {resumoLoteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Processamento Concluído</h3>
                  <p className="text-xs text-slate-500">Competência: {resumoLoteModal.competencia}</p>
                </div>
              </div>
              <button onClick={() => setResumoLoteModal(null)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            {/* Resumo em Cards */}
            <div className="grid grid-cols-3 gap-3 mb-4 text-center">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                <span className="text-xs text-emerald-700 block font-medium">Novas Faturas</span>
                <span className="text-xl font-extrabold text-emerald-800">{resumoLoteModal.faturasCriadas}</span>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                <span className="text-xs text-blue-700 block font-medium">Já Existiam</span>
                <span className="text-xl font-extrabold text-blue-800">{resumoLoteModal.faturasIgnoradas}</span>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                <span className="text-xs text-emerald-700 block font-medium">WhatsApps Enviados</span>
                <span className="text-xl font-extrabold text-emerald-800">{resumoLoteModal.mensagensEnviadas || 0}</span>
              </div>
            </div>

            {/* Lista dos Detalhes */}
            <div className="max-h-56 overflow-y-auto custom-scrollbar border border-slate-100 rounded-xl p-2 space-y-1.5 text-xs">
              {resumoLoteModal.detalhes?.map((item: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                  <div className="overflow-hidden">
                    <span className="font-bold text-slate-800 block truncate">{item.cliente}</span>
                    <span className="text-[10px] text-slate-400">
                      R$ {Number(item.valor).toFixed(2)} • Venc: {item.vencimento}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        item.status === 'criada'
                          ? 'bg-emerald-100 text-emerald-800'
                          : item.status === 'atualizada'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {item.status === 'criada' ? 'Gerada' : item.status === 'atualizada' ? 'Atualizada' : 'Existente'}
                    </span>
                    {item.whatsappEnviado && (
                      <span className="block text-[10px] text-emerald-600 font-bold mt-0.5">✓ WhatsApp</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 text-right">
              <button
                type="button"
                onClick={() => setResumoLoteModal(null)}
                className="px-5 py-2 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition cursor-pointer"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Excluir Fatura */}
      {deleteModal.open && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-slate-100 text-center animate-in fade-in zoom-in-95 duration-150">
            <div className="w-14 h-14 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Trash2 size={28} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Excluir Fatura</h3>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              Deseja realmente excluir esta fatura {deleteModal.clienteNome ? `do cliente "${deleteModal.clienteNome}"` : ''}?
              <br />
              <span className="text-xs text-red-500 font-medium mt-1 block">Esta ação é irreversível.</span>
            </p>
            <div className="flex gap-3 justify-center">
              <button
                type="button"
                onClick={() => setDeleteModal({ open: false, id: '', clienteNome: '' })}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={executarExcluirFatura}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 transition shadow-sm cursor-pointer"
              >
                Sim, Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ConfidenceCountdown({
  desbloqueioEm,
  horasDuracao = 24,
  compact = false
}: {
  desbloqueioEm?: string | null
  horasDuracao?: number
  compact?: boolean
}) {
  const [tempo, setTempo] = useState<{
    ativo: boolean
    texto: string
    horas: number
    minutos: number
    segundos: number
  }>({
    ativo: false,
    texto: '',
    horas: 0,
    minutos: 0,
    segundos: 0
  })

  useEffect(() => {
    function atualizar() {
      if (!desbloqueioEm) {
        setTempo({ ativo: false, texto: '', horas: 0, minutos: 0, segundos: 0 })
        return
      }
      const dataInicio = new Date(desbloqueioEm).getTime()
      if (isNaN(dataInicio)) {
        setTempo({ ativo: false, texto: '', horas: 0, minutos: 0, segundos: 0 })
        return
      }
      const dataFim = dataInicio + horasDuracao * 3600 * 1000
      const agora = Date.now()
      const diffMs = dataFim - agora

      if (diffMs <= 0) {
        setTempo({ ativo: false, texto: 'Expirado', horas: 0, minutos: 0, segundos: 0 })
        return
      }

      const totalSeg = Math.floor(diffMs / 1000)
      const horas = Math.floor(totalSeg / 3600)
      const minutos = Math.floor((totalSeg % 3600) / 60)
      const segundos = totalSeg % 60

      const formatado = `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`
      setTempo({ ativo: true, texto: formatado, horas, minutos, segundos })
    }

    atualizar()
    const timer = setInterval(atualizar, 1000)
    return () => clearInterval(timer)
  }, [desbloqueioEm, horasDuracao])

  if (!tempo.ativo) return null

  if (compact) {
    return (
      <span
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300 dark:border-amber-700"
        title={`Desbloqueio em confiança ativo • Expira em ${tempo.texto}`}
      >
        <Clock className="w-2.5 h-2.5 text-amber-600 animate-pulse" />
        <span>⏳ {tempo.texto}</span>
      </span>
    )
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-bold bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-700 shadow-xs animate-pulse"
      title={`Desbloqueio em confiança de ${horasDuracao}h ativo • Faltam ${tempo.horas}h ${tempo.minutos}m ${tempo.segundos}s`}
    >
      <Timer className="w-3.5 h-3.5 text-amber-600 shrink-0" />
      <span>⏳ {tempo.texto}</span>
    </span>
  )
}
