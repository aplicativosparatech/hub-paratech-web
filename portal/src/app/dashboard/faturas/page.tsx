'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { FileText, Plus, X } from 'lucide-react'
import toast from 'react-hot-toast'

export default function FaturasPage() {
  const [faturas, setFaturas] = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [gerando, setGerando] = useState(false)
  const supabase = createClient()

  // Form de nova fatura
  const [selectedCliente, setSelectedCliente] = useState('')
  const [competencia, setCompetencia] = useState('')
  const [dataVencimento, setDataVencimento] = useState('')
  const [valor, setValor] = useState('')

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
  }, [])

  // Quando seleciona um cliente, preenche automaticamente com base nas configurações
  const handleClienteChange = async (clienteId: string) => {
    setSelectedCliente(clienteId)
    if (!clienteId) return

    const { data: config } = await supabase
      .from('configuracoes_hub')
      .select('dia_vencimento, valor_mensalidade')
      .eq('cliente_id', clienteId)
      .single()

    if (config) {
      const hoje = new Date()
      const mesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)
      const mesComp = `${String(mesAnterior.getMonth() + 1).padStart(2, '0')}/${mesAnterior.getFullYear()}`
      
      const diaVenc = config.dia_vencimento
      const anoVenc = hoje.getFullYear()
      const mesVenc = hoje.getMonth() + 1
      const dataVenc = `${anoVenc}-${String(mesVenc).padStart(2, '0')}-${String(diaVenc).padStart(2, '0')}`

      setCompetencia(mesComp)
      setDataVencimento(dataVenc)
      setValor(String(config.valor_mensalidade))
    }
  }

  const handleGerarFatura = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCliente) { toast.error('Selecione um cliente.'); return }
    setGerando(true)

    const { error } = await supabase.from('faturas').insert([{
      cliente_id: selectedCliente,
      competencia,
      data_vencimento: dataVencimento,
      valor: parseFloat(valor),
      status: 'pendente'
    }])

    if (error) {
      toast.error('Erro ao gerar fatura: ' + error.message)
    } else {
      toast.success('Fatura gerada com sucesso!')
      setModalOpen(false)
      setSelectedCliente('')
      setCompetencia('')
      setDataVencimento('')
      setValor('')
      fetchFaturas()
    }
    setGerando(false)
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

  return (
    <div className="p-8">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Faturas e Pagamentos</h1>
          <p className="text-slate-500 mt-1">Histórico de cobranças e controle de pagamentos.</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition flex items-center gap-2">
          <Plus size={20} />
          Gerar Fatura
        </button>
      </header>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="p-4 font-semibold text-slate-600 text-sm">Cliente</th>
              <th className="p-4 font-semibold text-slate-600 text-sm">Competência</th>
              <th className="p-4 font-semibold text-slate-600 text-sm">Vencimento</th>
              <th className="p-4 font-semibold text-slate-600 text-sm">Valor</th>
              <th className="p-4 font-semibold text-slate-600 text-sm">Status</th>
              <th className="p-4 font-semibold text-slate-600 text-sm text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
               <tr><td colSpan={6} className="p-8 text-center text-slate-500">Carregando...</td></tr>
            ) : faturas.length === 0 ? (
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
              faturas.map(f => (
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
                    {f.status === 'pendente' && (
                      <>
                        <button 
                          onClick={async () => {
                            const novaQtd = (f.confianca_qtd || 0) + 1
                            const { error } = await supabase.from('faturas').update({ 
                              desbloqueio_confianca_em: new Date().toISOString(),
                              confianca_qtd: novaQtd
                            }).eq('id', f.id)
                            if (!error) {
                              toast.success(`Liberado por 24h! (Usado ${novaQtd} vezes)`)
                              fetchFaturas()
                            } else {
                              toast.error('Erro ao liberar: ' + error.message)
                            }
                          }}
                          className="text-xs bg-orange-100 text-orange-700 px-3 py-1 rounded hover:bg-orange-200 transition font-medium"
                          title="Libera o bloqueio no cliente por 24 horas"
                        >
                          Liberar em Confiança ({(f.confianca_qtd || 0)}x)
                        </button>
                        <button 
                          onClick={async () => {
                            const { error } = await supabase.from('faturas').update({ status: 'pago', data_pagamento: new Date().toISOString() }).eq('id', f.id)
                            if (!error) {
                              toast.success('Pagamento simulado com sucesso!')
                              fetchFaturas()
                            } else {
                              toast.error('Erro ao simular: ' + error.message)
                            }
                          }}
                          className="text-xs bg-emerald-100 text-emerald-700 px-3 py-1 rounded hover:bg-emerald-200 transition font-medium"
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
              <h3 className="text-xl font-bold text-slate-900">Gerar Nova Fatura</h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600">
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
                <input required type="number" step="0.01" className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={valor} onChange={e => setValor(e.target.value)} />
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition font-medium">
                  Cancelar
                </button>
                <button type="submit" disabled={gerando} className="px-6 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition font-medium disabled:opacity-50">
                  {gerando ? 'Gerando...' : 'Gerar Fatura'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
