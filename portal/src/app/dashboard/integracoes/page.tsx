'use client'

import { useState } from 'react'
import { PlugZap, CreditCard, MessageCircle, Save } from 'lucide-react'
import toast from 'react-hot-toast'

export default function IntegracoesPage() {
  const [activeTab, setActiveTab] = useState<'gateways' | 'whatsapp'>('gateways')

  // Estados locais temporários (até ligarmos com o banco na próxima etapa)
  const [infinitePayActive, setInfinitePayActive] = useState(true)
  const [mercadoPagoActive, setMercadoPagoActive] = useState(false)
  
  const [evolutionActive, setEvolutionActive] = useState(true)
  const [uazapiActive, setUazapiActive] = useState(false)

  const handleSave = () => {
    toast.success('Configurações salvas com sucesso!')
  }

  const toggleGateway = (gateway: 'infinite' | 'mp') => {
    if (gateway === 'infinite') {
      setInfinitePayActive(true)
      setMercadoPagoActive(false)
    } else {
      setInfinitePayActive(false)
      setMercadoPagoActive(true)
    }
  }

  const toggleWhatsapp = (api: 'evolution' | 'uazapi') => {
    if (api === 'evolution') {
      setEvolutionActive(true)
      setUazapiActive(false)
    } else {
      setEvolutionActive(false)
      setUazapiActive(true)
    }
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
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
            {/* InfinitePay Card */}
            <div className={`bg-white rounded-2xl p-6 border-2 transition-all duration-300 ${infinitePayActive ? 'border-blue-500 shadow-lg shadow-blue-500/10' : 'border-slate-200'}`}>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">InfinitePay</h3>
                  <p className="text-sm text-slate-500 mt-1">Taxas reduzidas para Pix e Cartão.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={infinitePayActive} onChange={() => toggleGateway('infinite')} />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Client ID</label>
                  <input type="text" className="w-full bg-slate-50 border border-slate-200 px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="ip_client_..." />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Secret Key</label>
                  <input type="password" className="w-full bg-slate-50 border border-slate-200 px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="••••••••••••••••" />
                </div>
              </div>
            </div>

            {/* Mercado Pago Card */}
            <div className={`bg-white rounded-2xl p-6 border-2 transition-all duration-300 ${mercadoPagoActive ? 'border-blue-500 shadow-lg shadow-blue-500/10' : 'border-slate-200'}`}>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Mercado Pago</h3>
                  <p className="text-sm text-slate-500 mt-1">Integração nativa rápida via Access Token.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={mercadoPagoActive} onChange={() => toggleGateway('mp')} />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Access Token de Produção</label>
                  <input type="password" className="w-full bg-slate-50 border border-slate-200 px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="APP_USR-..." />
                </div>
              </div>
            </div>
          </>
        )}

        {/* ===================== ABA WHATSAPP ===================== */}
        {activeTab === 'whatsapp' && (
          <>
            {/* Evolution API Card */}
            <div className={`bg-white rounded-2xl p-6 border-2 transition-all duration-300 ${evolutionActive ? 'border-emerald-500 shadow-lg shadow-emerald-500/10' : 'border-slate-200'}`}>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Evolution API</h3>
                  <p className="text-sm text-slate-500 mt-1">Motor open-source (Recomendado).</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={evolutionActive} onChange={() => toggleWhatsapp('evolution')} />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Endpoint (URL da VPS)</label>
                  <input type="text" className="w-full bg-slate-50 border border-slate-200 px-4 py-2 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none" placeholder="https://api.seudominio.com.br" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Global API Key</label>
                  <input type="password" className="w-full bg-slate-50 border border-slate-200 px-4 py-2 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none" placeholder="••••••••••••••••" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Nome da Instância</label>
                  <input type="text" className="w-full bg-slate-50 border border-slate-200 px-4 py-2 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none" placeholder="ParatechBot" />
                </div>
              </div>
            </div>

            {/* Uazapi Card */}
            <div className={`bg-white rounded-2xl p-6 border-2 transition-all duration-300 ${uazapiActive ? 'border-emerald-500 shadow-lg shadow-emerald-500/10' : 'border-slate-200'}`}>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Uazapi</h3>
                  <p className="text-sm text-slate-500 mt-1">Integração baseada em Wuzapi/Baileys.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={uazapiActive} onChange={() => toggleWhatsapp('uazapi')} />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">URL Base da Uazapi</label>
                  <input type="text" className="w-full bg-slate-50 border border-slate-200 px-4 py-2 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none" placeholder="http://sua-vps:3333" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Token de Acesso</label>
                  <input type="password" className="w-full bg-slate-50 border border-slate-200 px-4 py-2 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none" placeholder="••••••••••••••••" />
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
