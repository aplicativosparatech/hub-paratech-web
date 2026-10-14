'use client'

import { useState, useEffect } from 'react'
import { PlugZap, CreditCard, MessageCircle, Save, Send, Calendar, Sliders, Bell, FileText, CheckCircle2, AlertTriangle, Cpu, Sparkles, Bot, ExternalLink, RefreshCw, Check, ShieldCheck, Zap, Server } from 'lucide-react'
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
  const [activeTab, setActiveTab] = useState<'gateways' | 'whatsapp' | 'ia_mcp'>('gateways')
  const [isLoading, setIsLoading] = useState(true)
  const [integracoes, setIntegracoes] = useState<Integracao[]>([])
  const [testPhone, setTestPhone] = useState('')
  const [isTestingWpp, setIsTestingWpp] = useState(false)
  const [testandoIa, setTestandoIa] = useState<string | null>(null)
  const [resultadoTesteIa, setResultadoTesteIa] = useState<Record<string, { ok: boolean; msg: string; tempo?: number }>>({})

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
    // Desliga os outros do mesmo tipo (apenas para gateways e whatsapp)
    setIntegracoes(prev => prev.map(i => {
      if (i.tipo === tipo) {
        return i.provedor === provedor ? { ...i, is_ativo: true } : { ...i, is_ativo: false }
      }
      return i
    }))
  }

  const toggleAtivoIa = (provedor: string) => {
    setIntegracoes(prev => prev.map(i => i.provedor === provedor ? { ...i, is_ativo: !i.is_ativo } : i))
  }

  const handleTestarIa = async (provedor: string) => {
    const item = getIntegracao(provedor)
    setTestandoIa(provedor)
    const tId = toast.loading(`Testando conexão com ${item.credenciais?.nome || provedor}...`)
    try {
      const res = await fetch('/api/tributario/testar-ia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provedor,
          credenciais: item.credenciais
        })
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || data.msg || 'Falha ao responder')
      }
      setResultadoTesteIa(prev => ({
        ...prev,
        [provedor]: { ok: true, msg: `${data.msg} (NCM: ${data.ncmSugerido}, IBS: ${data.ibsAliq}%, CBS: ${data.cbsAliq}%)`, tempo: data.duracaoMs }
      }))
      toast.success(`Conexão confirmada com sucesso! (${data.duracaoMs}ms)`, { id: tId })
    } catch (err: any) {
      setResultadoTesteIa(prev => ({
        ...prev,
        [provedor]: { ok: false, msg: err.message }
      }))
      toast.error(`Erro: ${err.message}`, { id: tId })
    } finally {
      setTestandoIa(null)
    }
  }

  const handleSalvarIndividual = async (provedor: string) => {
    const item = getIntegracao(provedor)
    const tId = toast.loading(`Salvando ${item.credenciais?.nome || provedor.toUpperCase()}...`)
    try {
      const cleanCreds = { ...item.credenciais }
      if (cleanCreds.api_key) cleanCreds.api_key = String(cleanCreds.api_key).trim()

      const { error } = await supabase.from('integracoes').upsert({
        provedor,
        tipo: provedor.startsWith('mcp') ? 'mcp' : 'ia',
        is_ativo: true,
        credenciais: cleanCreds
      }, { onConflict: 'provedor' })

      if (error) throw error

      // Atualiza o estado local
      setIntegracoes(prev => prev.map(i => i.provedor === provedor ? { ...i, is_ativo: true, credenciais: cleanCreds } : i))
      toast.success(`${item.credenciais?.nome || provedor.toUpperCase()} salvo com sucesso!`, { id: tId })
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + err.message, { id: tId })
    }
  }

  const handleSave = async () => {
    const loadingToast = toast.loading('Salvando configurações...')
    try {
      for (const i of integracoes) {
        const cleanCreds = { ...i.credenciais }
        if (cleanCreds.api_key) cleanCreds.api_key = String(cleanCreds.api_key).trim()

        await supabase.from('integracoes').upsert({
          id: i.id || undefined,
          provedor: i.provedor,
          tipo: i.tipo,
          is_ativo: i.is_ativo,
          credenciais: cleanCreds
        }, { onConflict: 'provedor' })
      }
      toast.success('Configurações salvas com sucesso!', { id: loadingToast })
    } catch (error: any) {
      toast.error('Erro ao salvar: ' + error.message, { id: loadingToast })
    }
  }

  if (isLoading) return <div className="p-8">Carregando integrações...</div>

  const infinite = getIntegracao('infinitepay')
  const mp = getIntegracao('mercadopago')
  const evolution = getIntegracao('evolution')
  const uazapi = getIntegracao('uazapi')
  const gemini = getIntegracao('gemini')
  const groq = getIntegracao('groq')
  const openai = getIntegracao('openai')
  const claude = getIntegracao('claude')
  const ollama = getIntegracao('ollama')
  const mcpFiscalBrasil = getIntegracao('mcp_fiscal_brasil')
  const fiscalAi = getIntegracao('fiscal_ai')
  const iaGeral = getIntegracao('ia_geral')

  const totalIasAtivas = [gemini, groq, openai, claude, ollama, mcpFiscalBrasil, fiscalAi].filter(i => i.is_ativo).length

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
          <PlugZap className="text-blue-600" size={32} />
          Integrações & APIs
        </h1>
        <p className="text-slate-500 mt-2 text-lg">
          Configure gateways de pagamento, disparos de WhatsApp e motores de Inteligência Artificial e Servidores MCP Fiscais.
        </p>
      </header>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 bg-slate-200/50 p-1.5 rounded-xl w-fit mb-8">
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
        <button
          onClick={() => setActiveTab('ia_mcp')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 ${
            activeTab === 'ia_mcp' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Cpu size={18} /> APIs & MCPs de IA
          {totalIasAtivas > 0 && (
            <span className="ml-1 px-2 py-0.5 text-xs font-bold bg-purple-100 text-purple-700 rounded-full">
              {totalIasAtivas} ativas
            </span>
          )}
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

      {/* ===================== ABA APIS & MCPS DE IA ===================== */}
      {activeTab === 'ia_mcp' && (
        <div className="space-y-8">
          {/* Card de Governança & Modo Consenso */}
          <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
            <div className="absolute right-0 top-0 opacity-10 pointer-events-none">
              <Cpu size={320} />
            </div>
            
            <div className="relative z-10">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-white/10">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-purple-500/20 text-purple-300 border border-purple-400/30 text-xs font-semibold rounded-full flex items-center gap-1.5">
                      <Sparkles size={14} /> Inteligência Tributária Cooperativa
                    </span>
                    <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-xs font-semibold rounded-full flex items-center gap-1.5">
                      <ShieldCheck size={14} /> Convênio 142/2018 & LC 214/2024
                    </span>
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight">
                    Modo Consenso Multi-IA & Eleição da Melhor Resposta
                  </h2>
                  <p className="text-slate-300 text-sm max-w-2xl leading-relaxed">
                    Você pode ativar <strong>qualquer uma ou todas as IAs e Servidores MCP</strong> simultaneamente. Quando o modo consenso está ativo, o Hub consulta todas as IAs em paralelo, cruza com o catálogo legal e elege o NCM, CEST e enquadramento de IBS/CBS com maior aprovação e certeza fiscal.
                  </p>
                </div>

                <div className="flex flex-wrap sm:flex-nowrap gap-3">
                  {/* Modo Consenso */}
                  <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 flex flex-col items-center justify-center min-w-[170px] text-center">
                    <span className="text-xs text-purple-200 font-medium mb-1">Modo Consenso</span>
                    <label className="relative inline-flex items-center cursor-pointer my-1.5">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={iaGeral.credenciais?.modo_consenso !== false} 
                        onChange={e => handleCredencialChange('ia_geral', 'modo_consenso', e.target.checked as any)} 
                      />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500"></div>
                    </label>
                    <span className="text-[11px] font-bold text-emerald-300">
                      {iaGeral.credenciais?.modo_consenso !== false ? 'Multi-Votação Ativa' : '1ª IA por Prioridade'}
                    </span>
                  </div>

                  {/* Análise de XMLs com IA */}
                  <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 flex flex-col items-center justify-center min-w-[170px] text-center">
                    <span className="text-xs text-purple-200 font-medium mb-1">Auditoria de XMLs</span>
                    <label className="relative inline-flex items-center cursor-pointer my-1.5">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={iaGeral.credenciais?.habilitar_ia_xmls !== false} 
                        onChange={e => handleCredencialChange('ia_geral', 'habilitar_ia_xmls', e.target.checked as any)} 
                      />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                    <span className="text-[11px] font-bold text-emerald-300">
                      {iaGeral.credenciais?.habilitar_ia_xmls !== false ? 'IA Ativa nos XMLs' : 'IA Desativada nos XMLs'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status das IAs ativas */}
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Motores Prontos:</span>
                {[
                  { prov: gemini, label: 'Gemini (Grátis)', icon: '⚡' },
                  { prov: groq, label: 'Groq Llama 3.3 (Grátis)', icon: '🚀' },
                  { prov: openai, label: 'OpenAI GPT-4o', icon: '🤖' },
                  { prov: claude, label: 'Claude 3.5', icon: '🧠' },
                  { prov: ollama, label: 'Ollama Local', icon: '💻' },
                  { prov: mcpFiscalBrasil, label: 'MCP Fiscal Brasil', icon: '🏛️' },
                  { prov: fiscalAi, label: 'Fiscal.ai MCP', icon: '📊' },
                ].map((item, idx) => (
                  <span 
                    key={idx}
                    className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all ${
                      item.prov.is_ativo 
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 shadow-sm' 
                        : 'bg-white/5 text-slate-400 border border-white/10 opacity-60'
                    }`}
                  >
                    <span>{item.icon}</span> {item.label}: <strong>{item.prov.is_ativo ? 'Ligado' : 'Desligado'}</strong>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Grid de IAs e MCPs */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* 1. Google Gemini (Grátis AI Studio) */}
            <div className={`bg-white rounded-2xl p-6 border-2 transition-all duration-300 flex flex-col justify-between ${gemini.is_ativo ? 'border-purple-500 shadow-lg shadow-purple-500/10' : 'border-slate-200'}`}>
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-lg">
                      G
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-slate-900">Google Gemini</h3>
                        <span className="text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                          100% Gratuito
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">Google AI Studio • 15 RPM / 1M Tokens por Minuto</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={gemini.is_ativo} onChange={() => toggleAtivoIa('gemini')} />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-semibold text-slate-700">API Key (Google AI Studio)</label>
                      <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-xs text-purple-600 hover:text-purple-700 flex items-center gap-1 font-medium">
                        Pegar chave grátis <ExternalLink size={12} />
                      </a>
                    </div>
                    <input 
                      type="password" 
                      value={gemini.credenciais?.api_key || ''} 
                      onChange={e => handleCredencialChange('gemini', 'api_key', e.target.value)} 
                      className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none" 
                      placeholder="AIzaSy..." 
                    />
                  </div>

                    <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Modelo</label>
                    <select
                      value={(gemini.credenciais?.model && !gemini.credenciais.model.includes('2.0')) ? gemini.credenciais.model : 'gemini-2.5-flash'}
                      onChange={e => handleCredencialChange('gemini', 'model', e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    >
                      <option value="gemini-2.5-flash">Gemini 2.5 Flash (Recomendado - Grátis e Mais Rápido)</option>
                      <option value="gemini-1.5-flash">Gemini 1.5 Flash (Estável e Gratuito - 15 RPM)</option>
                      <option value="gemini-2.5-pro">Gemini 2.5 Pro (Nova Geração Google)</option>
                      <option value="gemini-1.5-pro">Gemini 1.5 Pro (Alta Precisão)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSalvarIndividual('gemini')}
                      disabled={!gemini.credenciais?.api_key}
                      className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
                      title="Salvar esta chave agora no banco"
                    >
                      <Save size={13} />
                      <span>Salvar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTestarIa('gemini')}
                      disabled={testandoIa === 'gemini' || !gemini.credenciais?.api_key}
                      className="px-3.5 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <RefreshCw size={13} className={testandoIa === 'gemini' ? 'animate-spin' : ''} />
                      <span>{testandoIa === 'gemini' ? 'Testando...' : 'Testar Conexão'}</span>
                    </button>
                  </div>
                  {resultadoTesteIa['gemini'] && (
                    <span className={`text-xs font-bold ${resultadoTesteIa['gemini'].ok ? 'text-emerald-600' : 'text-red-600'}`}>
                      {resultadoTesteIa['gemini'].ok ? `✓ OK (${resultadoTesteIa['gemini'].tempo}ms)` : '✕ Erro'}
                    </span>
                  )}
                </div>
                {resultadoTesteIa['gemini'] && (
                  <div className={`mt-3 p-2.5 rounded-lg text-xs leading-relaxed ${resultadoTesteIa['gemini'].ok ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {resultadoTesteIa['gemini'].msg}
                  </div>
                )}
              </div>
            </div>

            {/* 2. Groq Cloud - Llama 3.3 (Grátis) */}
            <div className={`bg-white rounded-2xl p-6 border-2 transition-all duration-300 flex flex-col justify-between ${groq.is_ativo ? 'border-purple-500 shadow-lg shadow-purple-500/10' : 'border-slate-200'}`}>
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center font-bold text-lg">
                      ⚡
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-slate-900">Groq Cloud (Llama 3.3)</h3>
                        <span className="text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                          100% Gratuito
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">Ultra Baixa Latência (&lt; 0.8s) • 30 RPM Grátis</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={groq.is_ativo} onChange={() => toggleAtivoIa('groq')} />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-semibold text-slate-700">API Key (Groq Cloud)</label>
                      <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" className="text-xs text-orange-600 hover:text-orange-700 flex items-center gap-1 font-medium">
                        Pegar chave grátis <ExternalLink size={12} />
                      </a>
                    </div>
                    <input 
                      type="password" 
                      value={groq.credenciais?.api_key || ''} 
                      onChange={e => handleCredencialChange('groq', 'api_key', e.target.value)} 
                      className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none" 
                      placeholder="gsk_..." 
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Modelo</label>
                    <select
                      value={groq.credenciais?.model || 'llama-3.3-70b-versatile'}
                      onChange={e => handleCredencialChange('groq', 'model', e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    >
                      <option value="llama-3.3-70b-versatile">Llama 3.3 70B Versatile (Recomendado - Mais Inteligente)</option>
                      <option value="llama-3.1-8b-instant">Llama 3.1 8B Instant (Ultra Veloz)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSalvarIndividual('groq')}
                      disabled={!groq.credenciais?.api_key}
                      className="px-3.5 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
                      title="Salvar esta chave agora no banco"
                    >
                      <Save size={13} />
                      <span>Salvar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTestarIa('groq')}
                      disabled={testandoIa === 'groq' || !groq.credenciais?.api_key}
                      className="px-3.5 py-2 bg-orange-50 hover:bg-orange-100 text-orange-700 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <RefreshCw size={13} className={testandoIa === 'groq' ? 'animate-spin' : ''} />
                      <span>{testandoIa === 'groq' ? 'Testando...' : 'Testar Conexão'}</span>
                    </button>
                  </div>
                  {resultadoTesteIa['groq'] && (
                    <span className={`text-xs font-bold ${resultadoTesteIa['groq'].ok ? 'text-emerald-600' : 'text-red-600'}`}>
                      {resultadoTesteIa['groq'].ok ? `✓ OK (${resultadoTesteIa['groq'].tempo}ms)` : '✕ Erro'}
                    </span>
                  )}
                </div>
                {resultadoTesteIa['groq'] && (
                  <div className={`mt-3 p-2.5 rounded-lg text-xs leading-relaxed ${resultadoTesteIa['groq'].ok ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {resultadoTesteIa['groq'].msg}
                  </div>
                )}
              </div>
            </div>

            {/* 3. OpenAI (ChatGPT) */}
            <div className={`bg-white rounded-2xl p-6 border-2 transition-all duration-300 flex flex-col justify-between ${openai.is_ativo ? 'border-purple-500 shadow-lg shadow-purple-500/10' : 'border-slate-200'}`}>
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-lg">
                      <Bot size={22} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">OpenAI (ChatGPT)</h3>
                      <p className="text-xs text-slate-500 mt-0.5">GPT-4o & GPT-4o-mini</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={openai.is_ativo} onChange={() => toggleAtivoIa('openai')} />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">OpenAI API Key</label>
                    <input 
                      type="password" 
                      value={openai.credenciais?.api_key || ''} 
                      onChange={e => handleCredencialChange('openai', 'api_key', e.target.value)} 
                      className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none" 
                      placeholder="sk-proj-..." 
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Modelo</label>
                    <select
                      value={openai.credenciais?.model || 'gpt-4o-mini'}
                      onChange={e => handleCredencialChange('openai', 'model', e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    >
                      <option value="gpt-4o-mini">GPT-4o mini (Econômico e Preciso)</option>
                      <option value="gpt-4o">GPT-4o (Máxima Capacidade)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSalvarIndividual('openai')}
                      disabled={!openai.credenciais?.api_key}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
                      title="Salvar esta chave agora no banco"
                    >
                      <Save size={13} />
                      <span>Salvar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTestarIa('openai')}
                      disabled={testandoIa === 'openai' || !openai.credenciais?.api_key}
                      className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <RefreshCw size={13} className={testandoIa === 'openai' ? 'animate-spin' : ''} />
                      <span>{testandoIa === 'openai' ? 'Testando...' : 'Testar Conexão'}</span>
                    </button>
                  </div>
                  {resultadoTesteIa['openai'] && (
                    <span className={`text-xs font-bold ${resultadoTesteIa['openai'].ok ? 'text-emerald-600' : 'text-red-600'}`}>
                      {resultadoTesteIa['openai'].ok ? `✓ OK (${resultadoTesteIa['openai'].tempo}ms)` : '✕ Erro'}
                    </span>
                  )}
                </div>
                {resultadoTesteIa['openai'] && (
                  <div className={`mt-3 p-2.5 rounded-lg text-xs leading-relaxed ${resultadoTesteIa['openai'].ok ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {resultadoTesteIa['openai'].msg}
                  </div>
                )}
              </div>
            </div>

            {/* 4. Anthropic Claude */}
            <div className={`bg-white rounded-2xl p-6 border-2 transition-all duration-300 flex flex-col justify-between ${claude.is_ativo ? 'border-purple-500 shadow-lg shadow-purple-500/10' : 'border-slate-200'}`}>
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-lg">
                      🧠
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">Anthropic Claude</h3>
                      <p className="text-xs text-slate-500 mt-0.5">Claude 3.5 Sonnet & Haiku</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={claude.is_ativo} onChange={() => toggleAtivoIa('claude')} />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Anthropic API Key</label>
                    <input 
                      type="password" 
                      value={claude.credenciais?.api_key || ''} 
                      onChange={e => handleCredencialChange('claude', 'api_key', e.target.value)} 
                      className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none" 
                      placeholder="sk-ant-..." 
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Modelo</label>
                    <select
                      value={claude.credenciais?.model || 'claude-3-5-sonnet-20241022'}
                      onChange={e => handleCredencialChange('claude', 'model', e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    >
                      <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet (Altíssima Precisão Normativa)</option>
                      <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku (Rápido)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSalvarIndividual('claude')}
                      disabled={!claude.credenciais?.api_key}
                      className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
                      title="Salvar esta chave agora no banco"
                    >
                      <Save size={13} />
                      <span>Salvar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTestarIa('claude')}
                      disabled={testandoIa === 'claude' || !claude.credenciais?.api_key}
                      className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                      <RefreshCw size={13} className={testandoIa === 'claude' ? 'animate-spin' : ''} />
                      <span>{testandoIa === 'claude' ? 'Testando...' : 'Testar Conexão'}</span>
                    </button>
                  </div>
                  {resultadoTesteIa['claude'] && (
                    <span className={`text-xs font-bold ${resultadoTesteIa['claude'].ok ? 'text-emerald-600' : 'text-red-600'}`}>
                      {resultadoTesteIa['claude'].ok ? `✓ OK (${resultadoTesteIa['claude'].tempo}ms)` : '✕ Erro'}
                    </span>
                  )}
                </div>
                {resultadoTesteIa['claude'] && (
                  <div className={`mt-3 p-2.5 rounded-lg text-xs leading-relaxed ${resultadoTesteIa['claude'].ok ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {resultadoTesteIa['claude'].msg}
                  </div>
                )}
              </div>
            </div>

            {/* 5. Ollama (Local Grátis) */}
            <div className={`bg-white rounded-2xl p-6 border-2 transition-all duration-300 flex flex-col justify-between ${ollama.is_ativo ? 'border-purple-500 shadow-lg shadow-purple-500/10' : 'border-slate-200'}`}>
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center font-bold text-lg">
                      <Server size={22} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-slate-900">Ollama (Local / VPS)</h3>
                        <span className="text-[10px] font-bold uppercase bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
                          Offline & Gratuito
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">Execução Local Sem Limites de Custo</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={ollama.is_ativo} onChange={() => toggleAtivoIa('ollama')} />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Endpoint do Servidor Ollama</label>
                    <input 
                      type="text" 
                      value={ollama.credenciais?.endpoint || 'http://localhost:11434'} 
                      onChange={e => handleCredencialChange('ollama', 'endpoint', e.target.value)} 
                      className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none" 
                      placeholder="http://localhost:11434" 
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Nome do Modelo Carregado</label>
                    <input 
                      type="text" 
                      value={ollama.credenciais?.model || 'llama3'} 
                      onChange={e => handleCredencialChange('ollama', 'model', e.target.value)} 
                      className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none" 
                      placeholder="llama3, mistral, deepseek-r1" 
                    />
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => handleTestarIa('ollama')}
                  disabled={testandoIa === 'ollama'}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  <RefreshCw size={14} className={testandoIa === 'ollama' ? 'animate-spin' : ''} />
                  {testandoIa === 'ollama' ? 'Testando...' : 'Testar Conexão'}
                </button>
                {resultadoTesteIa['ollama'] && (
                  <span className={`text-xs font-medium ${resultadoTesteIa['ollama'].ok ? 'text-emerald-600' : 'text-red-600'}`}>
                    {resultadoTesteIa['ollama'].ok ? `✓ OK (${resultadoTesteIa['ollama'].tempo}ms)` : '✕ Erro'}
                  </span>
                )}
              </div>
            </div>

            {/* 6. MCP Fiscal Brasil (DeHor-Labs) */}
            <div className={`bg-white rounded-2xl p-6 border-2 transition-all duration-300 flex flex-col justify-between ${mcpFiscalBrasil.is_ativo ? 'border-purple-500 shadow-lg shadow-purple-500/10' : 'border-slate-200'}`}>
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-lg">
                      🏛️
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-slate-900">MCP Fiscal Brasil</h3>
                        <span className="text-[10px] font-bold uppercase bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                          Model Context Protocol
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">DeHor-Labs • Consulta NCM, Alíquotas e Reforma</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={mcpFiscalBrasil.is_ativo} onChange={() => toggleAtivoIa('mcp_fiscal_brasil')} />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-semibold text-slate-700">Endpoint SSE / HTTP do MCP</label>
                      <a href="https://github.com/DeHor-Labs/mcp-fiscal-brasil" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium">
                        Repositório GitHub <ExternalLink size={12} />
                      </a>
                    </div>
                    <input 
                      type="text" 
                      value={mcpFiscalBrasil.credenciais?.endpoint || ''} 
                      onChange={e => handleCredencialChange('mcp_fiscal_brasil', 'endpoint', e.target.value)} 
                      className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none" 
                      placeholder="http://localhost:8000/sse" 
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Token de Acesso (Opcional)</label>
                    <input 
                      type="password" 
                      value={mcpFiscalBrasil.credenciais?.token || ''} 
                      onChange={e => handleCredencialChange('mcp_fiscal_brasil', 'token', e.target.value)} 
                      className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none" 
                      placeholder="••••••••" 
                    />
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => handleTestarIa('mcp_fiscal_brasil')}
                  disabled={testandoIa === 'mcp_fiscal_brasil' || !mcpFiscalBrasil.credenciais?.endpoint}
                  className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  <RefreshCw size={14} className={testandoIa === 'mcp_fiscal_brasil' ? 'animate-spin' : ''} />
                  {testandoIa === 'mcp_fiscal_brasil' ? 'Testando...' : 'Testar Conexão'}
                </button>
                {resultadoTesteIa['mcp_fiscal_brasil'] && (
                  <span className={`text-xs font-medium ${resultadoTesteIa['mcp_fiscal_brasil'].ok ? 'text-emerald-600' : 'text-red-600'}`}>
                    {resultadoTesteIa['mcp_fiscal_brasil'].ok ? `✓ OK (${resultadoTesteIa['mcp_fiscal_brasil'].tempo}ms)` : '✕ Erro'}
                  </span>
                )}
              </div>
            </div>

            {/* 7. Fiscal.ai MCP Server */}
            <div className={`bg-white rounded-2xl p-6 border-2 transition-all duration-300 flex flex-col justify-between ${fiscalAi.is_ativo ? 'border-purple-500 shadow-lg shadow-purple-500/10' : 'border-slate-200'}`}>
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-cyan-100 text-cyan-700 flex items-center justify-center font-bold text-lg">
                      📊
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-slate-900">Fiscal.ai MCP Server</h3>
                        <span className="text-[10px] font-bold uppercase bg-cyan-100 text-cyan-800 px-2 py-0.5 rounded-full">
                          API & MCP Fiscal
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">Docs Fiscal.ai • Enquadramento & Classificação Fiscal</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={fiscalAi.is_ativo} onChange={() => toggleAtivoIa('fiscal_ai')} />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-semibold text-slate-700">Endpoint / URL Base</label>
                      <a href="https://docs.fiscal.ai/docs/guides/mcp-integration" target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-600 hover:text-cyan-700 flex items-center gap-1 font-medium">
                        Docs de Integração <ExternalLink size={12} />
                      </a>
                    </div>
                    <input 
                      type="text" 
                      value={fiscalAi.credenciais?.endpoint || 'https://api.fiscal.ai/v1'} 
                      onChange={e => handleCredencialChange('fiscal_ai', 'endpoint', e.target.value)} 
                      className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none" 
                      placeholder="https://api.fiscal.ai/v1" 
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Fiscal.ai API Key / Token</label>
                    <input 
                      type="password" 
                      value={fiscalAi.credenciais?.api_key || fiscalAi.credenciais?.token || ''} 
                      onChange={e => handleCredencialChange('fiscal_ai', 'api_key', e.target.value)} 
                      className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none" 
                      placeholder="••••••••••••••••" 
                    />
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => handleTestarIa('fiscal_ai')}
                  disabled={testandoIa === 'fiscal_ai' || !fiscalAi.credenciais?.endpoint}
                  className="px-4 py-2 bg-cyan-50 hover:bg-cyan-100 text-cyan-700 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  <RefreshCw size={14} className={testandoIa === 'fiscal_ai' ? 'animate-spin' : ''} />
                  {testandoIa === 'fiscal_ai' ? 'Testando...' : 'Testar Conexão'}
                </button>
                {resultadoTesteIa['fiscal_ai'] && (
                  <span className={`text-xs font-medium ${resultadoTesteIa['fiscal_ai'].ok ? 'text-emerald-600' : 'text-red-600'}`}>
                    {resultadoTesteIa['fiscal_ai'].ok ? `✓ OK (${resultadoTesteIa['fiscal_ai'].tempo}ms)` : '✕ Erro'}
                  </span>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

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
