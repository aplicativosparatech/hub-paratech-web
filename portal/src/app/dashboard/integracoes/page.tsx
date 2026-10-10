'use client'

import { useState, useEffect } from 'react'
import { PlugZap, CreditCard, MessageCircle, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/utils/supabase/client'

type Integracao = {
  id: string;
  tipo: string;
  provedor: string;
  is_ativo: boolean;
  credenciais: any;
}

export default function IntegracoesPage() {
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<'gateways' | 'whatsapp'>('gateways')
  const [isLoading, setIsLoading] = useState(true)
  const [integracoes, setIntegracoes] = useState<Integracao[]>([])

  // Fetch das configurações do banco
  useEffect(() => {
    async function loadData() {
      const { data, error } = await supabase.from('integracoes').select('*')
      if (error) {
        toast.error('Erro ao carregar integrações')
      } else if (data) {
        setIntegracoes(data)
      }
      setIsLoading(false)
    }
    loadData()
  }, [])

  const getIntegracao = (provedor: string) => {
    return integracoes.find(i => i.provedor === provedor) || { is_ativo: false, credenciais: {} }
  }

  const updateIntegracaoLocal = (provedor: string, updates: Partial<Integracao>) => {
    setIntegracoes(prev => prev.map(i => i.provedor === provedor ? { ...i, ...updates } : i))
  }

  const handleCredencialChange = (provedor: string, key: string, value: string) => {
    const current = getIntegracao(provedor)
    const newCredenciais = { ...(current.credenciais || {}), [key]: value }
    updateIntegracaoLocal(provedor, { credenciais: newCredenciais })
  }

  const toggleAtivo = (provedor: string, tipo: string) => {
    // Desliga os outros do mesmo tipo
    setIntegracoes(prev => prev.map(i => {
      if (i.tipo === tipo) {
        return i.provedor === provedor ? { ...i, is_ativo: true } : { ...i, is_ativo: false }
      }
      return i
    }))
  }

  const handleSave = async () => {
    const loadingToast = toast.loading('Salvando configurações...')
    try {
      for (const i of integracoes) {
        await supabase.from('integracoes').update({
          is_ativo: i.is_ativo,
          credenciais: i.credenciais
        }).eq('id', i.id)
      }
      toast.success('Configurações salvas com sucesso!', { id: loadingToast })
    } catch (error) {
      toast.error('Erro ao salvar!', { id: loadingToast })
    }
  }

  if (isLoading) return <div className="p-8">Carregando integrações...</div>

  const infinite = getIntegracao('infinitepay')
  const mp = getIntegracao('mercadopago')
  const evolution = getIntegracao('evolution')
  const uazapi = getIntegracao('uazapi')

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
          <PlugZap className="text-blue-600" size={32} />
          Integrações & APIs
        </h1>
        <p className="text-slate-500 mt-2 text-lg">
          Configure os motores de pagamento e as APIs de envio automático de mensagens.
        </p>
      </header>

      {/* Tabs */}
      <div className="flex space-x-1 bg-slate-200/50 p-1 rounded-xl w-fit mb-8">
        <button
          onClick={() => setActiveTab('gateways')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 ${
            activeTab === 'gateways' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <CreditCard size={18} /> Gateways de Pagamento
        </button>
        <button
          onClick={() => setActiveTab('whatsapp')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 ${
            activeTab === 'whatsapp' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <MessageCircle size={18} /> APIs de WhatsApp
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* ===================== ABA GATEWAYS ===================== */}
        {activeTab === 'gateways' && (
          <>
            <div className={`bg-white rounded-2xl p-6 border-2 transition-all duration-300 ${infinite.is_ativo ? 'border-blue-500 shadow-lg shadow-blue-500/10' : 'border-slate-200'}`}>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">InfinitePay</h3>
                  <p className="text-sm text-slate-500 mt-1">Taxas reduzidas para Pix e Cartão.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={infinite.is_ativo} onChange={() => toggleAtivo('infinitepay', 'gateway')} />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Client ID</label>
                  <input type="text" value={infinite.credenciais?.client_id || ''} onChange={e => handleCredencialChange('infinitepay', 'client_id', e.target.value)} className="w-full bg-slate-50 border border-slate-200 px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="ip_client_..." />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Secret Key</label>
                  <input type="password" value={infinite.credenciais?.secret_key || ''} onChange={e => handleCredencialChange('infinitepay', 'secret_key', e.target.value)} className="w-full bg-slate-50 border border-slate-200 px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="••••••••••••••••" />
                </div>
              </div>
            </div>

            <div className={`bg-white rounded-2xl p-6 border-2 transition-all duration-300 ${mp.is_ativo ? 'border-blue-500 shadow-lg shadow-blue-500/10' : 'border-slate-200'}`}>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Mercado Pago</h3>
                  <p className="text-sm text-slate-500 mt-1">Integração nativa rápida via Access Token.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={mp.is_ativo} onChange={() => toggleAtivo('mercadopago', 'gateway')} />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Access Token de Produção</label>
                  <input type="password" value={mp.credenciais?.access_token || ''} onChange={e => handleCredencialChange('mercadopago', 'access_token', e.target.value)} className="w-full bg-slate-50 border border-slate-200 px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="APP_USR-..." />
                </div>
              </div>
            </div>
          </>
        )}

        {/* ===================== ABA WHATSAPP ===================== */}
        {activeTab === 'whatsapp' && (
          <>
            <div className={`bg-white rounded-2xl p-6 border-2 transition-all duration-300 ${evolution.is_ativo ? 'border-emerald-500 shadow-lg shadow-emerald-500/10' : 'border-slate-200'}`}>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Evolution API</h3>
                  <p className="text-sm text-slate-500 mt-1">Motor open-source (Recomendado).</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={evolution.is_ativo} onChange={() => toggleAtivo('evolution', 'whatsapp')} />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Endpoint (URL da VPS)</label>
                  <input type="text" value={evolution.credenciais?.endpoint || ''} onChange={e => handleCredencialChange('evolution', 'endpoint', e.target.value)} className="w-full bg-slate-50 border border-slate-200 px-4 py-2 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none" placeholder="https://api.seudominio.com.br" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Global API Key</label>
                  <input type="password" value={evolution.credenciais?.api_key || ''} onChange={e => handleCredencialChange('evolution', 'api_key', e.target.value)} className="w-full bg-slate-50 border border-slate-200 px-4 py-2 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none" placeholder="••••••••••••••••" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Nome da Instância</label>
                  <input type="text" value={evolution.credenciais?.instance || ''} onChange={e => handleCredencialChange('evolution', 'instance', e.target.value)} className="w-full bg-slate-50 border border-slate-200 px-4 py-2 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none" placeholder="ParatechBot" />
                </div>
              </div>
            </div>

            <div className={`bg-white rounded-2xl p-6 border-2 transition-all duration-300 ${uazapi.is_ativo ? 'border-emerald-500 shadow-lg shadow-emerald-500/10' : 'border-slate-200'}`}>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Uazapi</h3>
                  <p className="text-sm text-slate-500 mt-1">Integração baseada em Wuzapi/Baileys.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={uazapi.is_ativo} onChange={() => toggleAtivo('uazapi', 'whatsapp')} />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">URL Base da Uazapi</label>
                  <input type="text" value={uazapi.credenciais?.endpoint || ''} onChange={e => handleCredencialChange('uazapi', 'endpoint', e.target.value)} className="w-full bg-slate-50 border border-slate-200 px-4 py-2 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none" placeholder="http://sua-vps:3333" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Token de Acesso</label>
                  <input type="password" value={uazapi.credenciais?.token || ''} onChange={e => handleCredencialChange('uazapi', 'token', e.target.value)} className="w-full bg-slate-50 border border-slate-200 px-4 py-2 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none" placeholder="••••••••••••••••" />
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="mt-8 flex justify-end">
        <button onClick={handleSave} className="flex items-center gap-2 bg-slate-900 text-white px-8 py-3 rounded-xl font-semibold shadow-lg hover:bg-slate-800 hover:shadow-xl transition-all hover:-translate-y-0.5">
          <Save size={20} /> Salvar Configurações
        </button>
      </div>

    </div>
  )
}
