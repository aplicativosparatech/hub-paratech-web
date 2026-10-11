'use client'

import { useState, useEffect } from 'react'
import { PlugZap, CreditCard, MessageCircle, Save, Send, Calendar, Sliders, Bell, FileText, CheckCircle2, AlertTriangle } from 'lucide-react'
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
  const [testPhone, setTestPhone] = useState('')
  const [isTestingWpp, setIsTestingWpp] = useState(false)

  const handleTestWhatsApp = async () => {
    if (!testPhone) {
      toast.error('Digite um número para teste (com DDD)')
      return
    }

    setIsTestingWpp(true)
    const tId = toast.loading('Enviando mensagem de teste via WhatsApp...')

    try {
      const res = await fetch('/api/whatsapp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: testPhone })
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Falha no disparo')
      }

      toast.success('Mensagem enviada com sucesso para o seu WhatsApp!', { id: tId })
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`, { id: tId })
    } finally {
      setIsTestingWpp(false)
    }
  }

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

      {/* Card de Teste em Tempo Real de WhatsApp */}
      {activeTab === 'whatsapp' && (
        <div className="mt-8 bg-emerald-50 border border-emerald-200 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-emerald-900 mb-1 flex items-center gap-2">
            <Send size={18} className="text-emerald-600" /> Testar Envio em Tempo Real
          </h3>
          <p className="text-sm text-emerald-700 mb-4">
            Envie uma mensagem de teste para o seu próprio WhatsApp para verificar se a API configurada está respondendo.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 max-w-xl">
            <input 
              type="text" 
              placeholder="DDD + Seu Número (Ex: 5511999999999)" 
              value={testPhone} 
              onChange={e => setTestPhone(e.target.value)}
              className="flex-1 bg-white border border-emerald-300 px-4 py-2.5 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
            />
            <button 
              onClick={handleTestWhatsApp}
              disabled={isTestingWpp}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-6 py-2.5 rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 text-sm disabled:opacity-50"
            >
              <Send size={16} /> {isTestingWpp ? 'Disparando...' : 'Enviar Teste'}
            </button>
          </div>
        </div>
      )}

      {/* Seção de Regras de Feriados e Contagem Regressiva */}
      {activeTab === 'whatsapp' && (
        <div className="mt-8 space-y-6">
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm">
            <h3 className="text-xl font-bold text-slate-900 mb-2 flex items-center gap-2">
              <Calendar size={22} className="text-blue-600" />
              Regra de Feriados e Contagem Regressiva do Bloqueio
            </h3>
            <p className="text-sm text-slate-500 mb-6">
              A data de vencimento da fatura <strong>nunca muda</strong>. O Hub <strong>nunca bloqueia</strong> em fins de semana ou feriados nacionais. Escolha como a contagem regressiva nos alertas de WhatsApp deve ser calculada:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                (evolution.is_ativo ? evolution.credenciais?.modo_contagem_bloqueio : uazapi.credenciais?.modo_contagem_bloqueio) !== 'bloqueio_nominal'
                  ? 'border-blue-600 bg-blue-50/30'
                  : 'border-slate-200 hover:border-slate-300'
              }`}>
                <input 
                  type="radio" 
                  name="modo_contagem" 
                  className="mt-1 text-blue-600 focus:ring-blue-500"
                  checked={(evolution.is_ativo ? evolution.credenciais?.modo_contagem_bloqueio : uazapi.credenciais?.modo_contagem_bloqueio) !== 'bloqueio_nominal'}
                  onChange={() => {
                    const activeProv = evolution.is_ativo ? 'evolution' : 'uazapi'
                    handleCredencialChange(activeProv, 'modo_contagem_bloqueio', 'bloqueio_real')
                  }}
                />
                <div>
                  <span className="font-semibold text-slate-900 text-sm block">Contagem até o Bloqueio Real (Recomendado)</span>
                  <span className="text-xs text-slate-500 mt-0.5 block leading-relaxed">
                    Se o 5º dia de tolerância cair em sábado, domingo ou feriado nacional, a contagem de dias restantes considera a prorrogação para o <strong>próximo dia útil</strong>.
                  </span>
                </div>
              </label>

              <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                (evolution.is_ativo ? evolution.credenciais?.modo_contagem_bloqueio : uazapi.credenciais?.modo_contagem_bloqueio) === 'bloqueio_nominal'
                  ? 'border-blue-600 bg-blue-50/30'
                  : 'border-slate-200 hover:border-slate-300'
              }`}>
                <input 
                  type="radio" 
                  name="modo_contagem" 
                  className="mt-1 text-blue-600 focus:ring-blue-500"
                  checked={(evolution.is_ativo ? evolution.credenciais?.modo_contagem_bloqueio : uazapi.credenciais?.modo_contagem_bloqueio) === 'bloqueio_nominal'}
                  onChange={() => {
                    const activeProv = evolution.is_ativo ? 'evolution' : 'uazapi'
                    handleCredencialChange(activeProv, 'modo_contagem_bloqueio', 'bloqueio_nominal')
                  }}
                />
                <div>
                  <span className="font-semibold text-slate-900 text-sm block">Contagem Nominal Fixa</span>
                  <span className="text-xs text-slate-500 mt-0.5 block leading-relaxed">
                    Calcula a contagem de dias estritamente a partir da data de vencimento da fatura (+5 dias corridos), postergando o bloqueio físico se cair em dia não útil.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Catálogo de Mensagens Automáticas da Régua */}
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Bell size={22} className="text-emerald-600" />
                  Modelos de Mensagens Automáticas (Régua de Cobrança)
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  Estes são os disparos programados que o robô envia automaticamente aos clientes.
                </p>
              </div>
              <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full border border-emerald-100">
                Ativo no Cron (08:00 Diário)
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              
              {/* Modelo 1 */}
              <div className="bg-slate-50/70 rounded-xl p-5 border border-slate-200/80 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md">1. Pré-Vencimento</span>
                    <span className="text-[11px] text-slate-400 font-medium">5 dias antes</span>
                  </div>
                  <h4 className="text-sm font-semibold text-slate-800 mb-2">Fatura Disponível</h4>
                  <p className="text-xs text-slate-600 font-mono bg-white p-3 rounded-lg border border-slate-200 leading-relaxed">
                    &quot;Olá, [Cliente]! A fatura [FAT-001] da empresa [Empresa] já está disponível. Valor: [R$ 150,00]. Vencimento: [Data]. Toque no link para pagar via Pix...&quot;
                  </p>
                </div>
              </div>

              {/* Modelo 2 */}
              <div className="bg-slate-50/70 rounded-xl p-5 border border-slate-200/80 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-md">2. No Vencimento</span>
                    <span className="text-[11px] text-slate-400 font-medium">Dia D</span>
                  </div>
                  <h4 className="text-sm font-semibold text-slate-800 mb-2">Lembrete de Vencimento</h4>
                  <p className="text-xs text-slate-600 font-mono bg-white p-3 rounded-lg border border-slate-200 leading-relaxed">
                    &quot;Olá, [Cliente]! Sua fatura vence hoje, [Data]. Valor: [R$ 150,00]. Para evitar o bloqueio previsto para [Data_Bloqueio], regularize o pagamento. Faltam 5 dias...&quot;
                  </p>
                </div>
              </div>

              {/* Modelo 3 */}
              <div className="bg-slate-50/70 rounded-xl p-5 border border-slate-200/80 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-red-600 bg-red-50 px-2.5 py-1 rounded-md">3. Atraso & Regressiva</span>
                    <span className="text-[11px] text-slate-400 font-medium">A partir do dia +1</span>
                  </div>
                  <h4 className="text-sm font-semibold text-slate-800 mb-2">Cobrança Progressiva</h4>
                  <p className="text-xs text-slate-600 font-mono bg-white p-3 rounded-lg border border-slate-200 leading-relaxed">
                    &quot;Olá. Ainda não identificamos o pagamento. Para evitar o bloqueio previsto para [Data], faltam [X] dias. Regularize pelo link Pix abaixo...&quot;
                  </p>
                </div>
              </div>

              {/* Modelo 4 */}
              <div className="bg-slate-50/70 rounded-xl p-5 border border-slate-200/80 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md">4. Ao Pagar (Cliente)</span>
                    <span className="text-[11px] text-slate-400 font-medium">Webhook Instantâneo</span>
                  </div>
                  <h4 className="text-sm font-semibold text-slate-800 mb-2">Confirmação de Pagamento</h4>
                  <p className="text-xs text-slate-600 font-mono bg-white p-3 rounded-lg border border-slate-200 leading-relaxed">
                    &quot;✅ Pagamento Confirmado! Olá, [Cliente]. Confirmamos o recebimento da fatura de [R$ 150,00]. Seu sistema está liberado para uso. Muito obrigado!&quot;
                  </p>
                </div>
              </div>

              {/* Modelo 5 */}
              <div className="bg-slate-50/70 rounded-xl p-5 border border-slate-200/80 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md">5. Ao Pagar (Admin)</span>
                    <span className="text-[11px] text-slate-400 font-medium">Webhook Instantâneo</span>
                  </div>
                  <h4 className="text-sm font-semibold text-slate-800 mb-2">Notificação ao Administrador</h4>
                  <p className="text-xs text-slate-600 font-mono bg-white p-3 rounded-lg border border-slate-200 leading-relaxed">
                    &quot;💰 Novo Pagamento Recebido! Cliente: [Empresa] | Valor: [R$ 150,00] | Ref: [10/2026]. Status do Hub: Liberado no sistema.&quot;
                  </p>
                </div>
              </div>

              {/* Modelo 6 */}
              <div className="bg-slate-50/70 rounded-xl p-5 border border-slate-200/80 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2.5 py-1 rounded-md">6. Abandono de Pix</span>
                    <span className="text-[11px] text-slate-400 font-medium">Checkout não concluído</span>
                  </div>
                  <h4 className="text-sm font-semibold text-slate-800 mb-2">Recuperação de Pagamento</h4>
                  <p className="text-xs text-slate-600 font-mono bg-white p-3 rounded-lg border border-slate-200 leading-relaxed">
                    &quot;Olá, [Cliente]. Notamos que você iniciou o pagamento da fatura de [R$ 150,00], mas a operação não foi concluída. Precisa de ajuda com o Pix?&quot;
                  </p>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      <div className="mt-8 flex justify-end">
        <button onClick={handleSave} className="flex items-center gap-2 bg-slate-900 text-white px-8 py-3 rounded-xl font-semibold shadow-lg hover:bg-slate-800 hover:shadow-xl transition-all hover:-translate-y-0.5">
          <Save size={20} /> Salvar Configurações
        </button>
      </div>

    </div>
  )
}
