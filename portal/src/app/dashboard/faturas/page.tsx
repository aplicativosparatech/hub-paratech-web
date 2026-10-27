'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { FileText, Plus, X, Pencil, Trash2, RefreshCw, Zap, DollarSign } from 'lucide-react'
import toast from 'react-hot-toast'
import ResizableSortableTh from '@/components/ui/ResizableSortableTh'
import { useTableFeatures } from '@/hooks/useTableFeatures'
import { formatarDuasCasasDecimais, parseValorDecimal } from '@/utils/money'

export default function FaturasPage() {
  const [faturas, setFaturas] = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [gerando, setGerando] = useState(false)
  const [gerandoLote, setGerandoLote] = useState(false)
  const supabase = createClient()

  // Form de nova fatura/edição
  const [selectedCliente, setSelectedCliente] = useState('')
  const [competencia, setCompetencia] = useState('')
  const [dataVencimento, setDataVencimento] = useState('')
  const [valor, setValor] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmLoteModalOpen, setConfirmLoteModalOpen] = useState(false)
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; id: string; clienteNome?: string }>({ open: false, id: '', clienteNome: '' })
  const [limiteConfianca, setLimiteConfianca] = useState(1)

  async function fetchFaturas() {
    const { data } = await supabase
      .from('faturas')
      .select('*, clientes(razao_social)')
      .order('data_vencimento', { ascending: false })
    if (data) setFaturas(data)
    setLoading(false)
  }

  async function fetchClientes() {
    const { data } = await supabase.from('clientes').select('id, razao_social')
    if (data) setClientes(data)
  }

  useEffect(() => {
    fetchFaturas()
    fetchClientes()
    async function loadConfigGeral() {
      const { data } = await supabase.from('configuracoes_portal_geral').select('limite_desbloqueios_confianca').eq('id', 1).maybeSingle()
      if (data?.limite_desbloqueios_confianca) setLimiteConfianca(Number(data.limite_desbloqueios_confianca))
    }
    loadConfigGeral()
  }, [])

  // Gerar faturas em lote para todos os clientes ativos mensalistas
  const executarGerarLote = async () => {
    setConfirmLoteModalOpen(false)
    setGerandoLote(true)
    const toastId = toast.loading('Processando faturas dos mensalistas...')
    try {
      const res = await fetch('/api/cron/gerar-faturas', { method: 'POST' })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Erro ao gerar faturas')
      toast.success(`${data.result.faturasCriadas} nova(s) fatura(s) gerada(s) para ${data.result.competencia}!`, { id: toastId })
      fetchFaturas()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao gerar faturas em lote', { id: toastId })
    } finally {
      setGerandoLote(false)
    }
  }

  // Quando seleciona um cliente (apenas na criação), preenche automaticamente
  const handleClienteChange = async (clienteId: string) => {
    setSelectedCliente(clienteId)
    if (!clienteId || editingId) return

    // Busca dados no cliente primeiro
    const { data: cli } = await supabase
      .from('clientes')
      .select('dia_vencimento, valor_mensalidade')
      .eq('id', clienteId)
      .single()

    let diaVenc = cli?.dia_vencimento
    let valMensal = cli?.valor_mensalidade

    // Fallback para configuracoes_hub se não houver no cliente
    if (!diaVenc || !valMensal) {
      const { data: config } = await supabase
        .from('configuracoes_hub')
        .select('dia_vencimento, valor_mensalidade')
        .eq('cliente_id', clienteId)
        .single()
      if (config) {
        diaVenc = diaVenc || config.dia_vencimento
        valMensal = valMensal || config.valor_mensalidade
      }
    }

    if (diaVenc || valMensal) {
      const hoje = new Date()
      const mesComp = `${String(hoje.getMonth() + 1).padStart(2, '0')}/${hoje.getFullYear()}`
      
      const dia = diaVenc || 10
      const anoVenc = hoje.getFullYear()
      const mesVenc = hoje.getMonth() + 1
      const dataVenc = `${anoVenc}-${String(mesVenc).padStart(2, '0')}-${String(dia).padStart(2, '0')}`

      setCompetencia(mesComp)
      setDataVencimento(dataVenc)
      setValor(valMensal ? formatarDuasCasasDecimais(valMensal) : '')
    }
  }

  const handleEditFatura = (f: any) => {
    setEditingId(f.id)
    setSelectedCliente(f.cliente_id)
    setCompetencia(f.competencia)
    setDataVencimento(f.data_vencimento)
    setValor(formatarDuasCasasDecimais(f.valor))
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
    if (!selectedCliente) { toast.error('Selecione um cliente.'); return }
    setGerando(true)

    let error;
    if (editingId) {
      const { error: updateError } = await supabase.from('faturas').update({
        cliente_id: selectedCliente,
        competencia,
        data_vencimento: dataVencimento,
        valor: parseValorDecimal(valor),
      }).eq('id', editingId)
      error = updateError
    } else {
      const { error: insertError } = await supabase.from('faturas').insert([{
        cliente_id: selectedCliente,
        competencia,
        data_vencimento: dataVencimento,
        valor: parseValorDecimal(valor),
        status: 'pendente'
      }])
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
    setCompetencia('')
    setDataVencimento('')
    setValor('')
  }

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'pago': return 'bg-green-100 text-green-700'
      case 'pendente': return 'bg-yellow-100 text-yellow-700'
      case 'cancelado': return 'bg-slate-100 text-slate-500'
      default: return 'bg-slate-100 text-slate-500'
    }
  }

  const isVencida = (dataVenc: string, status: string) => {
    if (status !== 'pendente') return false
    return new Date(dataVenc) < new Date()
  }

  const {
    sortedData: faturasOrdenadas,
    sortKey,
    sortDirection,
    handleSort,
    columnWidths,
    handleResizeColumn
  } = useTableFeatures({
    data: faturas,
    tableId: 'faturas_admin',
    defaultSortKey: 'data_vencimento',
    defaultSortDirection: 'desc',
    initialWidths: {
      cliente: 260,
      competencia: 130,
      vencimento: 160,
      valor: 130,
      status: 130,
      acoes: 140
    },
    customExtractors: {
      cliente: (f: any) => f.clientes?.razao_social || '',
      competencia: (f: any) => f.competencia || '',
      data_vencimento: (f: any) => f.data_vencimento || '',
      valor: (f: any) => Number(f.valor || 0),
      status: (f: any) => f.status || ''
    }
  })

  return (
    <div className="p-8">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Faturas e Pagamentos</h1>
          <p className="text-slate-500 mt-1">Histórico de cobranças e controle de pagamentos.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/dashboard/configuracoes-portal?aba=cobranca"
            className="bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-300 px-4 py-2 rounded-lg font-semibold transition flex items-center gap-2 shadow-xs text-sm"
            title="Configurar regras globais de juros, multa por atraso, dias de carência e desbloqueio em confiança"
          >
            <DollarSign size={18} className="text-emerald-700" />
            Regras Globais de Cobrança
          </Link>
          <button onClick={() => { setLoading(true); fetchFaturas() }} className="bg-slate-100 text-slate-600 px-4 py-2 rounded-lg font-medium hover:bg-slate-200 transition flex items-center gap-2">
            <RefreshCw size={20} />
            Atualizar
          </button>
          <button 
            onClick={() => setConfirmLoteModalOpen(true)} 
            disabled={gerandoLote}
            className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-emerald-700 transition flex items-center gap-2 shadow-sm disabled:opacity-50"
            title="Gera automaticamente faturas da competência atual para todos os clientes ativos mensalistas (idempotente)"
          >
            <Zap size={20} className={gerandoLote ? 'animate-spin' : ''} />
            {gerandoLote ? 'Gerando...' : 'Gerar Faturas do Mês'}
          </button>
          <button onClick={() => setModalOpen(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition flex items-center gap-2">
            <Plus size={20} />
            Gerar Fatura Avulsa
          </button>
        </div>
      </header>

      <div className="bg-white dark:bg-[#0B1120] rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-x-auto custom-scrollbar w-full">
        <table className="w-full text-left border-collapse min-w-[900px]">
          <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 shadow-2xs">
            <tr className="bg-slate-50 border-b border-slate-200">
              <ResizableSortableTh
                columnId="cliente"
                label="Cliente"
                sortKey="cliente"
                currentSortKey={sortKey}
                currentSortDirection={sortDirection}
                onSort={handleSort}
                width={columnWidths.cliente}
                onResize={handleResizeColumn}
                minWidth={150}
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
                minWidth={110}
              />
              <ResizableSortableTh
                columnId="valor"
                label="Valor"
                sortKey="valor"
                currentSortKey={sortKey}
                currentSortDirection={sortDirection}
                onSort={handleSort}
                width={columnWidths.valor}
                onResize={handleResizeColumn}
                minWidth={90}
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
                minWidth={90}
              />
              <ResizableSortableTh
                columnId="acoes"
                label="Ações"
                disableSort
                width={columnWidths.acoes}
                onResize={handleResizeColumn}
                minWidth={120}
                align="right"
              />
            </tr>
          </thead>
          <tbody>
            {loading ? (
               <tr><td colSpan={6} className="p-8 text-center text-slate-500">Carregando...</td></tr>
            ) : faturasOrdenadas.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-12 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <FileText size={40} className="text-slate-300" />
                    <p className="text-slate-500">Nenhuma fatura gerada ainda.</p>
                    <p className="text-slate-400 text-sm">Clique em &quot;Gerar Fatura&quot; para criar a primeira.</p>
                  </div>
                </td>
              </tr>
            ) : (
              faturasOrdenadas.map(f => (
                <tr key={f.id} className={`border-b border-slate-100 hover:bg-slate-50 ${isVencida(f.data_vencimento, f.status) ? 'bg-red-50' : ''}`}>
                  <td className="p-4 font-medium text-slate-800">{f.clientes?.razao_social}</td>
                  <td className="p-4 text-slate-600">{f.competencia}</td>
                  <td className="p-4 text-slate-600">
                    {new Date(f.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}
                    {isVencida(f.data_vencimento, f.status) && (
                      <span className="ml-2 text-xs text-red-600 font-semibold">VENCIDA</span>
                    )}
                  </td>
                  <td className="p-4 text-slate-800 font-medium">R$ {parseFloat(f.valor).toFixed(2)}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium uppercase ${getStatusStyle(f.status)}`}>
                      {f.status}
                    </span>
                  </td>
                  <td className="p-4 text-right flex items-center justify-end gap-2">
                    {/* Botões de Ação Comuns a Todos os Status */}
                    <button onClick={() => handleEditFatura(f)} className="p-1 text-slate-400 hover:text-blue-600 transition" title="Editar Fatura">
                      <Pencil size={18} />
                    </button>
                    <button onClick={() => setDeleteModal({ open: true, id: f.id, clienteNome: f.clientes?.razao_social })} className="p-1 text-slate-400 hover:text-red-600 transition" title="Excluir Fatura">
                      <Trash2 size={18} />
                    </button>

                    {/* Botões Específicos para Pendente */}
                    {f.status === 'pendente' && (
                      <>
                        <button 
                          disabled={(f.confianca_qtd || 0) >= limiteConfianca}
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
                          className={`text-xs px-3 py-1 rounded transition font-medium ${
                            (f.confianca_qtd || 0) >= limiteConfianca
                              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                              : 'bg-orange-100 text-orange-700 hover:bg-orange-200 cursor-pointer'
                          }`}
                          title={(f.confianca_qtd || 0) >= limiteConfianca ? 'Limite de desbloqueios em confiança atingido para esta fatura' : 'Libera o bloqueio no cliente'}
                        >
                          {(f.confianca_qtd || 0) >= limiteConfianca 
                            ? `Confiança Esgotada (${f.confianca_qtd || 0}/${limiteConfianca})` 
                            : `Liberar em Confiança (${f.confianca_qtd || 0}/${limiteConfianca})`
                          }
                        </button>
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
                          className="text-xs bg-emerald-100 text-emerald-700 px-3 py-1 rounded hover:bg-emerald-200 transition font-medium cursor-pointer"
                          title="Confirma o pagamento e já gera automaticamente a fatura do próximo mês para antecipação"
                        >
                          Simular Pagamento
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Gerar Fatura */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6">
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-xl font-bold text-slate-900">{editingId ? 'Editar Fatura' : 'Gerar Nova Fatura'}</h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleGerarFatura} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Cliente</label>
                <select required className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={selectedCliente} onChange={e => handleClienteChange(e.target.value)}>
                  <option value="">-- Selecione --</option>
                  {clientes.map(c => (
                    <option key={c.id} value={c.id}>{c.razao_social}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-400 mt-1">Ao selecionar, os campos abaixo serão preenchidos automaticamente (se houver configuração).</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Competência</label>
                  <input required type="text" placeholder="09/2026" className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={competencia} onChange={e => setCompetencia(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Data de Vencimento</label>
                  <input required type="date" className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={dataVencimento} onChange={e => setDataVencimento(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Valor (R$)</label>
                <input 
                  required 
                  type="text" 
                  inputMode="decimal"
                  placeholder="0,00"
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                  value={valor} 
                  onChange={e => setValor(e.target.value)} 
                  onBlur={e => {
                    if (e.target.value) {
                      setValor(formatarDuasCasasDecimais(e.target.value))
                    }
                  }}
                />
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button type="button" onClick={closeModal} className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition font-medium">
                  Cancelar
                </button>
                <button type="submit" disabled={gerando} className="px-6 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition font-medium disabled:opacity-50">
                  {gerando ? 'Salvando...' : (editingId ? 'Atualizar Fatura' : 'Gerar Fatura')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirmar Geração em Lote */}
      {confirmLoteModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-slate-100 text-center animate-in fade-in zoom-in-95 duration-150">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Zap size={28} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Gerar Faturas Mensalistas</h3>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              Deseja disparar a geração automática das faturas do mês corrente para todos os clientes ativos mensalistas?
              <br /><span className="text-xs text-slate-400 mt-1 block">Esta operação é segura e não duplicará faturas existentes.</span>
            </p>
            <div className="flex gap-3 justify-center">
              <button
                type="button"
                onClick={() => setConfirmLoteModalOpen(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={executarGerarLote}
                className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition shadow-sm"
              >
                Confirmar e Gerar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmar Exclusão de Fatura */}
      {deleteModal.open && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-slate-100 text-center animate-in fade-in zoom-in-95 duration-150">
            <div className="w-14 h-14 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Trash2 size={28} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Excluir Fatura</h3>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              Deseja realmente excluir esta fatura {deleteModal.clienteNome ? `do cliente "${deleteModal.clienteNome}"` : ''}?
              <br /><span className="text-xs text-red-500 font-medium mt-1 block">Esta ação é irreversível.</span>
            </p>
            <div className="flex gap-3 justify-center">
              <button
                type="button"
                onClick={() => setDeleteModal({ open: false, id: '', clienteNome: '' })}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={executarExcluirFatura}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 transition shadow-sm"
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
