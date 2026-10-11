'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import toast from 'react-hot-toast'

export default function GatewaysPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [gateways, setGateways] = useState<any[]>([])

  // Store forms in state
  const [inf, setInf] = useState({ is_ativo: false, client_id: '', client_secret: '', wallet_id: '', api_key: '' })
  const [mp, setMp] = useState({ is_ativo: false, api_key: '' })

  useEffect(() => {
    async function fetchGateways() {
      const { data } = await supabase.from('gateways').select('*')
      if (data) {
        setGateways(data)
        const infinite = data.find(g => g.provedor === 'infinitepay')
        const mercado = data.find(g => g.provedor === 'mercadopago')
        if (infinite) setInf(infinite)
        if (mercado) setMp(mercado)
      }
      setLoading(false)
    }
    fetchGateways()
  }, [])

  const handleSave = async (provedor: string, payload: any) => {
    setSaving(true)
    const { error } = await supabase.from('gateways').update(payload).eq('provedor', provedor)
    if (error) {
      toast.error('Erro ao salvar: ' + error.message)
    } else {
      toast.success(`Configuração da ${provedor} salva!`)
    }
    setSaving(false)
  }

  if (loading) return <div className="p-8">Carregando...</div>

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-300">
      <header className="mb-4">
        <h1 className="text-3xl font-bold text-slate-900">Gateways de Pagamento</h1>
        <p className="text-slate-500 mt-1">Configure as integrações para geração de Pix Automático.</p>
      </header>

      <div className="space-y-6">
        {/* InfinitePay */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between border-b pb-4 mb-4">
            <h2 className="text-xl font-bold text-slate-800">InfinitePay</h2>
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-sm text-slate-500">Ativar Gateway</span>
              <input type="checkbox" className="w-5 h-5 rounded text-blue-600"
                checked={inf.is_ativo} onChange={e => setInf({...inf, is_ativo: e.target.checked})} />
            </label>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">API Key / Token Público</label>
              <input type="text" className="w-full px-4 py-2 rounded-lg border border-slate-200"
                value={inf.api_key || ''} onChange={e => setInf({...inf, api_key: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Client ID</label>
              <input type="text" className="w-full px-4 py-2 rounded-lg border border-slate-200"
                value={inf.client_id || ''} onChange={e => setInf({...inf, client_id: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Client Secret</label>
              <input type="password" className="w-full px-4 py-2 rounded-lg border border-slate-200"
                value={inf.client_secret || ''} onChange={e => setInf({...inf, client_secret: e.target.value})} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Wallet ID (Carteira PIX)</label>
              <input type="text" className="w-full px-4 py-2 rounded-lg border border-slate-200"
                value={inf.wallet_id || ''} onChange={e => setInf({...inf, wallet_id: e.target.value})} />
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <button onClick={() => handleSave('infinitepay', inf)} disabled={saving} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
              Salvar InfinitePay
            </button>
          </div>
        </div>

        {/* Mercado Pago */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between border-b pb-4 mb-4">
            <h2 className="text-xl font-bold text-slate-800">Mercado Pago</h2>
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-sm text-slate-500">Ativar Gateway</span>
              <input type="checkbox" className="w-5 h-5 rounded text-blue-600"
                checked={mp.is_ativo} onChange={e => setMp({...mp, is_ativo: e.target.checked})} />
            </label>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Access Token</label>
              <input type="password" className="w-full px-4 py-2 rounded-lg border border-slate-200"
                value={mp.api_key || ''} onChange={e => setMp({...mp, api_key: e.target.value})} />
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <button onClick={() => handleSave('mercadopago', mp)} disabled={saving} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
              Salvar Mercado Pago
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
