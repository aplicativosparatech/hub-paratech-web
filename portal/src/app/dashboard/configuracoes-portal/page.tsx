'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import toast from 'react-hot-toast'
import { Sliders, ShieldAlert, CheckCircle2, Building2, Save, RefreshCw, KeyRound, BellRing } from 'lucide-react'

export default function ConfiguracoesPortalPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [userRole, setUserRole] = useState<'admin' | 'contabilidade' | 'cliente'>('admin')
  const [clientes, setClientes] = useState<any[]>([])
  const [selectedCliente, setSelectedCliente] = useState<string>('')
  const [clientSearchTerm, setClientSearchTerm] = useState('')

  const [formData, setFormData] = useState({
    auto_excluir_divergentes: false,
    exibir_certificados_contabilidade: false,
    exibir_certificados_cliente: false
  })

  // Carrega permissões e empresas disponíveis
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: roleData } = await supabase.from('user_roles').select('*').eq('user_id', user.id).single()
      const role = (roleData?.role as any) || 'admin'
      setUserRole(role)

      if (role === 'cliente' && roleData?.cliente_id) {
        setSelectedCliente(roleData.cliente_id)
        const { data: cli } = await supabase
          .from('clientes')
          .select('id, razao_social, nome_fantasia, cnpj, configuracoes_hub(auto_excluir_divergentes, exibir_certificados_contabilidade, exibir_certificados_cliente)')
          .eq('id', roleData.cliente_id)
          .single()
        if (cli) {
          setClientes([cli])
          const config = Array.isArray(cli.configuracoes_hub) ? cli.configuracoes_hub[0] : cli.configuracoes_hub
          setFormData({ 
            auto_excluir_divergentes: Boolean(config?.auto_excluir_divergentes),
            exibir_certificados_contabilidade: Boolean(config?.exibir_certificados_contabilidade),
            exibir_certificados_cliente: Boolean(config?.exibir_certificados_cliente)
          })
        }
      } else if (role === 'contabilidade' && roleData?.contabilidade_id) {
        const { data: clis } = await supabase
          .from('clientes')
          .select('id, razao_social, nome_fantasia, cnpj, configuracoes_hub(auto_excluir_divergentes, exibir_certificados_contabilidade, exibir_certificados_cliente)')
          .eq('contabilidade_id', roleData.contabilidade_id)
          .order('razao_social')
        if (clis && clis.length > 0) {
          setClientes(clis)
          setSelectedCliente(clis[0].id)
        }
      } else {
        // Admin
        const { data: clis } = await supabase
          .from('clientes')
          .select('id, razao_social, nome_fantasia, cnpj, configuracoes_hub(auto_excluir_divergentes, exibir_certificados_contabilidade, exibir_certificados_cliente)')
          .order('razao_social')
        if (clis && clis.length > 0) {
          setClientes(clis)
          setSelectedCliente(clis[0].id)
        }
      }

      setLoading(false)
    }
    init()
  }, [])

  // Carrega configuração da empresa selecionada
  useEffect(() => {
    if (!selectedCliente) return
    async function loadConfig() {
      const { data } = await supabase
        .from('configuracoes_hub')
        .select('auto_excluir_divergentes, exibir_certificados_contabilidade, exibir_certificados_cliente')
        .eq('cliente_id', selectedCliente)
        .single()

      if (data) {
        setFormData({
          auto_excluir_divergentes: Boolean(data.auto_excluir_divergentes),
          exibir_certificados_contabilidade: Boolean(data.exibir_certificados_contabilidade),
          exibir_certificados_cliente: Boolean(data.exibir_certificados_cliente)
        })
      } else {
        setFormData({ 
          auto_excluir_divergentes: false,
          exibir_certificados_contabilidade: false,
          exibir_certificados_cliente: false
        })
      }
    }
    loadConfig()
  }, [selectedCliente])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCliente) {
      toast.error('Selecione uma empresa.')
      return
    }

    setSaving(true)
    const payload: any = {
      cliente_id: selectedCliente,
      auto_excluir_divergentes: formData.auto_excluir_divergentes,
      updated_at: new Date().toISOString()
    }

    // Apenas Admin pode alterar a visibilidade/avisos de certificados
    if (userRole === 'admin') {
      payload.exibir_certificados_contabilidade = formData.exibir_certificados_contabilidade
      payload.exibir_certificados_cliente = formData.exibir_certificados_cliente
    }

    const { error } = await supabase
      .from('configuracoes_hub')
      .upsert(payload, { onConflict: 'cliente_id' })

    if (error) {
      toast.error('Erro ao salvar: ' + error.message)
    } else {
      toast.success('Configurações do Portal atualizadas com sucesso!')
    }
    setSaving(false)
  }

  const currentCli = clientes.find(c => c.id === selectedCliente)

  if (loading) {
    return <div className="p-8 text-slate-500">Carregando configurações do portal...</div>
  }

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-300">
      
      {/* Cabeçalho */}
      <header className="pb-4 border-b border-slate-200">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
          <Sliders className="text-blue-600" size={32} />
          Configurações do Portal
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Gerenciamento de regras de exibição, segregação e conformidade fiscal do Portal Paratech.
        </p>
      </header>

      {/* Seletor de Empresa (para Admin e Contabilidade) */}
      {userRole !== 'cliente' && clientes.length > 0 && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1 max-w-lg space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                {userRole === 'admin' ? '🔍 Selecionar Empresa para Configurar' : '🏢 Selecionar Cliente'}
              </label>
              {userRole === 'admin' && (
                <span className="text-[11px] text-blue-600 font-medium">
                  {clientes.length} empresas disponíveis
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              {userRole === 'admin' && (
                <input
                  type="text"
                  placeholder="Filtrar empresa por nome ou CNPJ..."
                  value={clientSearchTerm}
                  onChange={e => setClientSearchTerm(e.target.value)}
                  className="w-full sm:w-1/2 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}

              <select
                value={selectedCliente}
                onChange={e => setSelectedCliente(e.target.value)}
                className={`w-full ${userRole === 'admin' ? 'sm:w-1/2' : ''} bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium`}
              >
                {clientes
                  .filter(c => {
                    if (!clientSearchTerm) return true
                    const term = clientSearchTerm.toLowerCase()
                    return (
                      (c.razao_social && c.razao_social.toLowerCase().includes(term)) ||
                      (c.nome_fantasia && c.nome_fantasia.toLowerCase().includes(term)) ||
                      (c.cnpj && c.cnpj.includes(term))
                    )
                  })
                  .map(c => (
                    <option key={c.id} value={c.id}>
                      {c.razao_social} {c.nome_fantasia ? `(${c.nome_fantasia})` : ''}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {currentCli && (
            <div className="text-right">
              <span className="text-xs text-slate-400 block">CNPJ da Empresa</span>
              <span className="text-sm font-mono font-bold text-slate-800">{currentCli.cnpj}</span>
            </div>
          )}
        </div>
      )}

      {/* Identificação para o Cliente Titular */}
      {userRole === 'cliente' && currentCli && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 block">Sua Empresa</span>
            <span className="text-sm font-bold text-slate-900">{currentCli.razao_social}</span>
          </div>
          <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">
            CNPJ: {currentCli.cnpj}
          </span>
        </div>
      )}

      {/* Formulário de Configurações */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
          
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100 mb-6">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <ShieldAlert size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Segregação e Auditoria Fiscal de XMLs</h3>
              <p className="text-slate-500 text-xs">
                Controle automático de arquivos XML recebidos para evitar contaminação da escrituração da empresa.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-3.5 p-5 bg-slate-50 rounded-2xl border border-slate-200 hover:border-slate-300 transition">
              <input 
                type="checkbox" 
                id="auto_excluir_divergentes"
                checked={formData.auto_excluir_divergentes}
                onChange={e => setFormData({ ...formData, auto_excluir_divergentes: e.target.checked })}
                className="mt-1 h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <label htmlFor="auto_excluir_divergentes" className="cursor-pointer select-none">
                <span className="font-bold text-slate-900 block text-base mb-1">
                  Excluir/Ignorar automaticamente XMLs de vendas que não pertencem à empresa analisada
                </span>
                <span className="text-slate-600 text-sm leading-relaxed block">
                  Quando marcado, caso o Hub encontre na pasta de vendas um arquivo XML cujo CNPJ emitente não seja igual ao CNPJ cadastrado desta empresa, o arquivo será descartado automaticamente no recebimento e não entrará nos relatórios fiscais.
                </span>
                <span className="inline-flex items-center gap-1.5 mt-3 text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100/70 text-blue-800">
                  <CheckCircle2 size={14} /> Ativo para: Super Admin, Contabilidade e Empresa Cliente
                </span>
              </label>
            </div>
          </div>

          {/* Controle de Visibilidade de Certificados A1 - Exclusivo do Super Admin */}
          {userRole === 'admin' && (
            <div className="mt-8 pt-8 border-t border-slate-200">
              <div className="flex items-center gap-3 pb-4 border-b border-slate-100 mb-6">
                <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
                  <KeyRound size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-900">Visibilidade e Alertas de Certificados Digitais A1</h3>
                    <span className="text-[10px] uppercase font-black tracking-wider bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md border border-amber-200">
                      Exclusivo Admin
                    </span>
                  </div>
                  <p className="text-slate-500 text-xs">
                    Defina quem além do Admin pode visualizar o relatório de certificados a vencer e receber avisos diários de expiração.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Opção para Contabilidade */}
                <div className="flex items-start gap-3.5 p-5 bg-slate-50 rounded-2xl border border-slate-200 hover:border-slate-300 transition">
                  <input 
                    type="checkbox" 
                    id="exibir_certificados_contabilidade"
                    checked={formData.exibir_certificados_contabilidade}
                    onChange={e => setFormData({ ...formData, exibir_certificados_contabilidade: e.target.checked })}
                    className="mt-1 h-5 w-5 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                  />
                  <label htmlFor="exibir_certificados_contabilidade" className="cursor-pointer select-none">
                    <span className="font-bold text-slate-900 block text-base mb-1">
                      Exibir relatório e avisar vencimento do certificado para a Contabilidade
                    </span>
                    <span className="text-slate-600 text-sm leading-relaxed block">
                      Permite que a contabilidade responsável por este cliente visualize a aba de Certificados a Vencer no painel e receba alertas diários caso faltem 45 dias ou menos para expirar.
                    </span>
                    <span className="inline-flex items-center gap-1.5 mt-3 text-xs font-medium px-2.5 py-1 rounded-full bg-slate-200 text-slate-700">
                      Padrão do Sistema: Desativado (Apenas Admin)
                    </span>
                  </label>
                </div>

                {/* Opção para Cliente */}
                <div className="flex items-start gap-3.5 p-5 bg-slate-50 rounded-2xl border border-slate-200 hover:border-slate-300 transition">
                  <input 
                    type="checkbox" 
                    id="exibir_certificados_cliente"
                    checked={formData.exibir_certificados_cliente}
                    onChange={e => setFormData({ ...formData, exibir_certificados_cliente: e.target.checked })}
                    className="mt-1 h-5 w-5 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                  />
                  <label htmlFor="exibir_certificados_cliente" className="cursor-pointer select-none">
                    <span className="font-bold text-slate-900 block text-base mb-1">
                      Exibir relatório e avisar vencimento do certificado para o Cliente
                    </span>
                    <span className="text-slate-600 text-sm leading-relaxed block">
                      Permite que os usuários da própria empresa cliente visualizem a aba de Certificados a Vencer e recebam notificações automáticas de aviso de vencimento via WhatsApp/Portal.
                    </span>
                    <span className="inline-flex items-center gap-1.5 mt-3 text-xs font-medium px-2.5 py-1 rounded-full bg-slate-200 text-slate-700">
                      Padrão do Sistema: Desativado (Apenas Admin)
                    </span>
                  </label>
                </div>
              </div>
            </div>
          )}

          <div className="pt-6 mt-6 border-t border-slate-100 flex justify-end">
            <button 
              type="submit" 
              disabled={saving}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Save size={18} />
              {saving ? 'Salvando...' : 'Salvar Configurações do Portal'}
            </button>
          </div>

        </div>
      </form>

    </div>
  )
}
