'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import toast from 'react-hot-toast'
import { RefreshCw } from 'lucide-react'

export default function ConfiguracoesPage() {
  const supabase = createClient()
  const [clientes, setClientes] = useState<any[]>([])
  const [hubs, setHubs] = useState<any[]>([])
  const [selectedCliente, setSelectedCliente] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const [formData, setFormData] = useState({
    dia_vencimento: 10,
    valor_mensalidade: 150.00,
    dias_aviso_previo: 7,
    dias_tolerancia_bloqueio: 3,
    mensagem_bloqueio: 'SISTEMA BLOQUEADO. Por favor, regularize seu pagamento.',
    pastas_vendas: '',
    pastas_compras: '',
    exes_monitorados: ''
  })

  async function loadClientes() {
    const { data } = await supabase
      .from('clientes')
      .select('id, razao_social, configuracoes_hub(ultima_sincronizacao)')
      .order('razao_social')
    
    if (data) {
      setClientes(data)
      setHubs(data)
    }
  }

  useEffect(() => {
    loadClientes()
  }, [])

  useEffect(() => {
    if (!selectedCliente) return
    async function loadConfig() {
      setLoading(true)
      const { data } = await supabase.from('configuracoes_hub').select('*').eq('cliente_id', selectedCliente).single()
      
      if (data) {
        setFormData({
          dia_vencimento: data.dia_vencimento || 10,
          valor_mensalidade: data.valor_mensalidade || 150.00,
          dias_aviso_previo: data.dias_aviso_previo || 7,
          dias_tolerancia_bloqueio: data.dias_tolerancia_bloqueio || 3,
          mensagem_bloqueio: data.mensagem_bloqueio || '',
          pastas_vendas: Array.isArray(data.pastas_vendas) ? data.pastas_vendas.join('\n') : '',
          pastas_compras: Array.isArray(data.pastas_compras) ? data.pastas_compras.join('\n') : '',
          exes_monitorados: Array.isArray(data.exes_monitorados) ? data.exes_monitorados.join('\n') : ''
        })
      } else {
        // Reseta se nao tiver
        setFormData({
          dia_vencimento: 10, valor_mensalidade: 150.00, dias_aviso_previo: 7, dias_tolerancia_bloqueio: 3,
          mensagem_bloqueio: 'SISTEMA BLOQUEADO. Por favor, regularize seu pagamento.',
          pastas_vendas: 'C:\\\\Sistemas\\\\Vendas\\\\XML', pastas_compras: '', exes_monitorados: 'vendas.exe'
        })
      }
      setLoading(false)
    }
    loadConfig()
  }, [selectedCliente])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCliente) return
    setSaving(true)
    setMessage('')

    const payload = {
      cliente_id: selectedCliente,
      dia_vencimento: formData.dia_vencimento,
      valor_mensalidade: formData.valor_mensalidade,
      dias_aviso_previo: formData.dias_aviso_previo,
      dias_tolerancia_bloqueio: formData.dias_tolerancia_bloqueio,
      mensagem_bloqueio: formData.mensagem_bloqueio,
      pastas_vendas: formData.pastas_vendas.split('\n').filter(Boolean).map(s => s.trim()),
      pastas_compras: formData.pastas_compras.split('\n').filter(Boolean).map(s => s.trim()),
      exes_monitorados: formData.exes_monitorados.split('\n').filter(Boolean).map(s => s.trim()),
      updated_at: new Date().toISOString()
    }

    const { error } = await supabase.from('configuracoes_hub').upsert(payload, { onConflict: 'cliente_id' })
    
    if (error) {
      toast.error('Erro: ' + error.message)
    } else {
      toast.success('Configurações salvas com sucesso!')
    }
    setSaving(false)
  }

  return (
    <div className="p-8 max-w-4xl">
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Configurações do Hub</h1>
          <p className="text-slate-500 mt-1">Defina as regras de bloqueio e monitoramento por cliente.</p>
        </div>
        <button onClick={() => loadClientes()} className="bg-slate-100 text-slate-600 px-4 py-2 rounded-lg font-medium hover:bg-slate-200 transition flex items-center gap-2">
          <RefreshCw size={20} />
          Atualizar Tabela
        </button>
      </header>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <label className="block text-sm font-medium text-slate-700 mb-2">Selecione o Cliente para Configurar</label>
        <select
          className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={selectedCliente} onChange={e => setSelectedCliente(e.target.value)}
        >
          <option value="">-- Selecione --</option>
          {clientes.map(c => (
            <option key={c.id} value={c.id}>{c.razao_social}</option>
          ))}
        </select>
      </div>

      {selectedCliente && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {loading ? (
            <div className="p-4 text-slate-500">Carregando configurações...</div>
          ) : (
            <>
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <h3 className="font-semibold text-lg text-slate-800 border-b pb-2">Regras Financeiras</h3>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Dia do Vencimento</label>
                  <input type="number" required min="1" max="31" className="w-full px-4 py-2 rounded-lg border border-slate-200"
                    value={formData.dia_vencimento} onChange={e => setFormData({...formData, dia_vencimento: parseInt(e.target.value)})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Valor da Mensalidade (R$)</label>
                  <input type="number" required step="0.01" className="w-full px-4 py-2 rounded-lg border border-slate-200"
                    value={formData.valor_mensalidade} onChange={e => setFormData({...formData, valor_mensalidade: parseFloat(e.target.value)})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Dias p/ Aviso Prévio</label>
                  <input type="number" required className="w-full px-4 py-2 rounded-lg border border-slate-200"
                    value={formData.dias_aviso_previo} onChange={e => setFormData({...formData, dias_aviso_previo: parseInt(e.target.value)})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Dias p/ Bloqueio (Tolerância)</label>
                  <input type="number" required className="w-full px-4 py-2 rounded-lg border border-slate-200"
                    value={formData.dias_tolerancia_bloqueio} onChange={e => setFormData({...formData, dias_tolerancia_bloqueio: parseInt(e.target.value)})} />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Mensagem de Bloqueio na Tela</label>
                  <textarea rows={3} className="w-full px-4 py-2 rounded-lg border border-slate-200"
                    value={formData.mensagem_bloqueio} onChange={e => setFormData({...formData, mensagem_bloqueio: e.target.value})} />
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 grid grid-cols-1 gap-6">
                <div>
                  <h3 className="font-semibold text-lg text-slate-800 border-b pb-2">Regras do Hub (Monitoramento)</h3>
                  <p className="text-sm text-slate-500 mt-1">Coloque um item por linha.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Pastas de Vendas (XML)</label>
                  <textarea rows={3} className="w-full px-4 py-2 rounded-lg border border-slate-200 placeholder-slate-400"
                    placeholder="C:\Sistema\Vendas\XML"
                    value={formData.pastas_vendas} onChange={e => setFormData({...formData, pastas_vendas: e.target.value})} />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Pastas de Compras (XML)</label>
                  <textarea rows={3} className="w-full px-4 py-2 rounded-lg border border-slate-200 placeholder-slate-400"
                    value={formData.pastas_compras} onChange={e => setFormData({...formData, pastas_compras: e.target.value})} />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Arquivos .exe Monitorados (Para bloqueio)</label>
                  <textarea rows={3} className="w-full px-4 py-2 rounded-lg border border-slate-200 placeholder-slate-400"
                    placeholder="vendas.exe&#10;pdv.exe"
                    value={formData.exes_monitorados} onChange={e => setFormData({...formData, exes_monitorados: e.target.value})} />
                </div>
              </div>

              {message && (
                <div className={`p-4 rounded-lg font-medium ${message.includes('Erro') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                  {message}
                </div>
              )}

              <button 
                type="submit" disabled={saving}
                className="w-full bg-blue-600 text-white font-medium py-3 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                {saving ? 'Salvando...' : 'Salvar Configurações no Banco'}
              </button>
            </>
          )}
        </form>
      )}

      {/* Tabela de Hubs */}
      {!selectedCliente && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 mt-8 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="font-semibold text-lg text-slate-800">Hubs Ativos (Monitoramento)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-sm text-slate-500">
                  <th className="p-4 font-medium">Cliente</th>
                  <th className="p-4 font-medium">Contra-Senha (Offline)</th>
                  <th className="p-4 font-medium">Última Sincronização</th>
                  <th className="p-4 font-medium">Status do Hub</th>
                  <th className="p-4 font-medium text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {hubs.map((hub) => {
                  const config = Array.isArray(hub.configuracoes_hub) ? hub.configuracoes_hub[0] : hub.configuracoes_hub;
                  const lastSync = config?.ultima_sincronizacao;
                  const offlineSecret = config?.offline_secret || 'Não gerada';
                  let isOnline = false;
                  
                  if (lastSync) {
                    const diff = new Date().getTime() - new Date(lastSync).getTime();
                    // Considera online se comunicou nos últimos 3 minutos (180000 ms)
                    isOnline = diff < 180000;
                  }

                  return (
                    <tr key={hub.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="p-4 text-sm font-medium text-slate-800">{hub.razao_social}</td>
                      <td className="p-4 text-sm text-slate-600 font-mono bg-slate-100 rounded px-2 py-1 select-all">{offlineSecret}</td>
                      <td className="p-4 text-sm text-slate-600">
                        {lastSync ? new Date(lastSync).toLocaleString('pt-BR') : 'Nunca'}
                      </td>
                      <td className="p-4 text-sm">
                        {isOnline ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            <span className="w-2 h-2 rounded-full bg-green-500 mr-1.5 animate-pulse"></span>
                            Online
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                            Offline
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => setSelectedCliente(hub.id)}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          Configurar
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {hubs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-500">
                      Nenhum cliente encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
