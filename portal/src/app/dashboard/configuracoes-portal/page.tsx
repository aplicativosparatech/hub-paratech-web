'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import toast from 'react-hot-toast'
import { Sliders, ShieldAlert, CheckCircle2, Building2, Save, RefreshCw, KeyRound, BellRing, LayoutDashboard, Sparkles, MapPin, FileCheck2, DollarSign, Cpu } from 'lucide-react'
import { APP_VERSION } from '@/utils/version'
import { limparDocumento } from '@/utils/cnpjAlfanumerico'

export default function ConfiguracoesPortalPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [userRole, setUserRole] = useState<'admin' | 'contabilidade' | 'cliente'>('admin')
  const [clientes, setClientes] = useState<any[]>([])
  const [selectedCliente, setSelectedCliente] = useState<string>('')
  const [clientSearchTerm, setClientSearchTerm] = useState('')

  const [formData, setFormData] = useState({
    modo_processamento_xml: 'hub' as 'hub' | 'portal',
    auto_excluir_divergentes: false,
    apenas_xmls_autorizados: false,
    auto_corrigir_assinar_xmls: false,
    analise_ia_xmls_ativa: true,
    exibir_certificados_contabilidade: false,
    exibir_certificados_cliente: false,
    avisar_whatsapp_certificado: true,
    exibir_faixa_topo_certificado: true
  })

  // Configuração Global de Valores Fictícios do Dashboard (Exclusivo Super Admin)
  const [ficticioData, setFicticioData] = useState({
    valores_ficticios_ativos: false,
    ficticio_clientes: 28,
    ficticio_contabilidades: 8,
    ficticio_faturas_atrasadas: 0,
    ficticio_nf_quantidade: 14500,
    ficticio_nf_valor: 894520.50,
    ficticio_relatorios: 120,
    ficticio_cidades: 14
  })

  // Preferência de exibição do Nome Fantasia como título principal
  const [priorizarNomeFantasia, setPriorizarNomeFantasia] = useState(false)

  // Controle de Alternância de Interface (Clean vs Clássico)
  const [permitirTrocaInterface, setPermitirTrocaInterface] = useState(true)
  const [modoPadraoInterface, setModoPadraoInterface] = useState<'clean' | 'classico'>('clean')

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
          .select('id, razao_social, nome_fantasia, cnpj, configuracoes_hub(auto_excluir_divergentes, apenas_xmls_autorizados, auto_corrigir_assinar_xmls, analise_ia_xmls_ativa, exibir_certificados_contabilidade, exibir_certificados_cliente, avisar_whatsapp_certificado, exibir_faixa_topo_certificado, modo_processamento_xml)')
          .eq('id', roleData.cliente_id)
          .single()
        if (cli) {
          setClientes([cli])
          const config = Array.isArray(cli.configuracoes_hub) ? cli.configuracoes_hub[0] : cli.configuracoes_hub
          setFormData({ 
            modo_processamento_xml: (config?.modo_processamento_xml as 'hub' | 'portal') || 'hub',
            auto_excluir_divergentes: Boolean(config?.auto_excluir_divergentes),
            apenas_xmls_autorizados: Boolean(config?.apenas_xmls_autorizados),
            auto_corrigir_assinar_xmls: Boolean(config?.auto_corrigir_assinar_xmls),
            analise_ia_xmls_ativa: config?.analise_ia_xmls_ativa !== false,
            exibir_certificados_contabilidade: Boolean(config?.exibir_certificados_contabilidade),
            exibir_certificados_cliente: Boolean(config?.exibir_certificados_cliente),
            avisar_whatsapp_certificado: config?.avisar_whatsapp_certificado !== false,
            exibir_faixa_topo_certificado: config?.exibir_faixa_topo_certificado !== false
          })
        }
      } else if (role === 'contabilidade' && roleData?.contabilidade_id) {
        const { data: clis } = await supabase
          .from('clientes')
          .select('id, razao_social, nome_fantasia, cnpj, configuracoes_hub(auto_excluir_divergentes, apenas_xmls_autorizados, auto_corrigir_assinar_xmls, exibir_certificados_contabilidade, exibir_certificados_cliente, avisar_whatsapp_certificado, exibir_faixa_topo_certificado, modo_processamento_xml)')
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
          .select('id, razao_social, nome_fantasia, cnpj, configuracoes_hub(auto_excluir_divergentes, apenas_xmls_autorizados, auto_corrigir_assinar_xmls, exibir_certificados_contabilidade, exibir_certificados_cliente, avisar_whatsapp_certificado, exibir_faixa_topo_certificado, modo_processamento_xml)')
          .order('razao_social')
        if (clis && clis.length > 0) {
          setClientes(clis)
          setSelectedCliente(clis[0].id)
        }
      }

      // Carregar preferência salva em localStorage
      const localPriorizar = localStorage.getItem('hub_priorizar_nome_fantasia') === 'true'
      setPriorizarNomeFantasia(localPriorizar)

      // Se for Admin, carregar valores fictícios do dashboard e preferência global
      if (role === 'admin') {
        const { data: geralData } = await supabase
          .from('configuracoes_portal_geral')
          .select('*')
          .eq('id', 1)
          .maybeSingle()

        if (geralData) {
          if (geralData.priorizar_nome_fantasia !== undefined && geralData.priorizar_nome_fantasia !== null) {
            const dbPriorizar = Boolean(geralData.priorizar_nome_fantasia)
            setPriorizarNomeFantasia(dbPriorizar)
            localStorage.setItem('hub_priorizar_nome_fantasia', String(dbPriorizar))
          }
          setFicticioData({
            valores_ficticios_ativos: Boolean(geralData.valores_ficticios_ativos),
            ficticio_clientes: Number(geralData.ficticio_clientes ?? 28),
            ficticio_contabilidades: Number(geralData.ficticio_contabilidades ?? 8),
            ficticio_faturas_atrasadas: Number(geralData.ficticio_faturas_atrasadas ?? 0),
            ficticio_nf_quantidade: Number(geralData.ficticio_nf_quantidade ?? 14500),
            ficticio_nf_valor: Number(geralData.ficticio_nf_valor ?? 894520.50),
            ficticio_relatorios: Number(geralData.ficticio_relatorios ?? 120),
            ficticio_cidades: Number(geralData.ficticio_cidades ?? 14)
          })
        }
      }

      // Carregar permissão de troca de interface e modo padrão
      try {
        const { data: permTroca } = await supabase
          .from('permissoes_modulos')
          .select('permitido_cliente, permitido_contabilidade')
          .eq('modulo_chave', 'troca_modo_interface')
          .maybeSingle()
        if (permTroca) {
          setPermitirTrocaInterface(Boolean(permTroca.permitido_cliente && permTroca.permitido_contabilidade))
        } else {
          const savedPermitir = localStorage.getItem('hub_permitir_troca_interface')
          if (savedPermitir !== null) setPermitirTrocaInterface(savedPermitir === 'true')
        }
      } catch (errP) {
        console.warn('Erro ao carregar troca_modo_interface:', errP)
      }

      const savedModoPadrao = (localStorage.getItem('hub_interface_mode_default') as 'clean' | 'classico') || 'clean'
      setModoPadraoInterface(savedModoPadrao)

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
        .select('auto_excluir_divergentes, apenas_xmls_autorizados, auto_corrigir_assinar_xmls, analise_ia_xmls_ativa, exibir_certificados_contabilidade, exibir_certificados_cliente, avisar_whatsapp_certificado, exibir_faixa_topo_certificado, modo_processamento_xml')
        .eq('cliente_id', selectedCliente)
        .single()

      if (data) {
        setFormData({
          modo_processamento_xml: (data.modo_processamento_xml as 'hub' | 'portal') || 'hub',
          auto_excluir_divergentes: Boolean(data.auto_excluir_divergentes),
          apenas_xmls_autorizados: Boolean(data.apenas_xmls_autorizados),
          auto_corrigir_assinar_xmls: Boolean(data.auto_corrigir_assinar_xmls),
          analise_ia_xmls_ativa: data.analise_ia_xmls_ativa !== false,
          exibir_certificados_contabilidade: Boolean(data.exibir_certificados_contabilidade),
          exibir_certificados_cliente: Boolean(data.exibir_certificados_cliente),
          avisar_whatsapp_certificado: data.avisar_whatsapp_certificado !== false,
          exibir_faixa_topo_certificado: data.exibir_faixa_topo_certificado !== false
        })
      } else {
        setFormData({ 
          modo_processamento_xml: 'hub',
          auto_excluir_divergentes: false,
          apenas_xmls_autorizados: false,
          auto_corrigir_assinar_xmls: false,
          analise_ia_xmls_ativa: true,
          exibir_certificados_contabilidade: false,
          exibir_certificados_cliente: false,
          avisar_whatsapp_certificado: true,
          exibir_faixa_topo_certificado: true
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
      modo_processamento_xml: formData.modo_processamento_xml || 'hub',
      auto_excluir_divergentes: formData.auto_excluir_divergentes,
      apenas_xmls_autorizados: formData.apenas_xmls_autorizados,
      auto_corrigir_assinar_xmls: formData.auto_corrigir_assinar_xmls,
      analise_ia_xmls_ativa: formData.analise_ia_xmls_ativa,
      dia_vencimento: 10,
      valor_mensalidade: 0.00,
      updated_at: new Date().toISOString()
    }

    // Persiste a preferência em localStorage e notifica todas as abas
    localStorage.setItem('hub_priorizar_nome_fantasia', String(priorizarNomeFantasia))
    window.dispatchEvent(new Event('hub_settings_changed'))

    // Apenas Admin pode alterar a visibilidade/avisos de certificados e preferências globais
    if (userRole === 'admin') {
      payload.exibir_certificados_contabilidade = formData.exibir_certificados_contabilidade
      payload.exibir_certificados_cliente = formData.exibir_certificados_cliente
      payload.avisar_whatsapp_certificado = formData.avisar_whatsapp_certificado
      payload.exibir_faixa_topo_certificado = formData.exibir_faixa_topo_certificado

      // Salva também as configurações globais de valores fictícios do dashboard e exibição
      const { error: errFicticio } = await supabase
        .from('configuracoes_portal_geral')
        .upsert({
          id: 1,
          priorizar_nome_fantasia: priorizarNomeFantasia,
          valores_ficticios_ativos: ficticioData.valores_ficticios_ativos,
          ficticio_clientes: ficticioData.ficticio_clientes,
          ficticio_contabilidades: ficticioData.ficticio_contabilidades,
          ficticio_faturas_atrasadas: ficticioData.ficticio_faturas_atrasadas,
          ficticio_nf_quantidade: ficticioData.ficticio_nf_quantidade,
          ficticio_nf_valor: ficticioData.ficticio_nf_valor,
          ficticio_relatorios: ficticioData.ficticio_relatorios,
          ficticio_cidades: ficticioData.ficticio_cidades,
          updated_at: new Date().toISOString()
        })

      if (errFicticio) {
        console.error('Erro ao salvar preferências gerais:', errFicticio)
      }

      // Salva permissão de alternância de interface para cliente e contabilidade
      try {
        await supabase
          .from('permissoes_modulos')
          .update({
            permitido_cliente: permitirTrocaInterface,
            permitido_contabilidade: permitirTrocaInterface,
            updated_at: new Date().toISOString()
          })
          .eq('modulo_chave', 'troca_modo_interface')
      } catch (errP) {
        console.error('Erro ao salvar permissão de interface:', errP)
      }

      localStorage.setItem('hub_permitir_troca_interface', String(permitirTrocaInterface))
      localStorage.setItem('hub_interface_mode_default', modoPadraoInterface)
      if (!permitirTrocaInterface) {
        localStorage.setItem('hub_interface_mode', modoPadraoInterface)
      }
      window.dispatchEvent(new Event('hub_settings_changed'))
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
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <Sliders className="text-blue-600" size={32} />
            Configurações do Portal
          </h1>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
            {APP_VERSION}
          </span>
        </div>
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
                  placeholder="Filtrar empresa por nome, CNPJ ou CPF..."
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
                    const term = clientSearchTerm.toLowerCase().trim()
                    const cleanTerm = limparDocumento(term)
                    const doc = (c.cnpj || '').toLowerCase()
                    const cleanDoc = limparDocumento(doc)
                    return (
                      (c.razao_social && c.razao_social.toLowerCase().includes(term)) ||
                      (c.nome_fantasia && c.nome_fantasia.toLowerCase().includes(term)) ||
                      doc.includes(term) ||
                      (cleanTerm && cleanDoc.includes(cleanTerm))
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
            {/* Escolha do Modo de Processamento: Hub vs Portal */}
            <div className="p-5 bg-gradient-to-br from-blue-50/70 via-indigo-50/40 to-slate-50 rounded-2xl border-2 border-blue-200/90 shadow-2xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="font-bold text-slate-900 block text-base flex items-center gap-2">
                  <Cpu className="text-blue-600" size={20} />
                  Modo de Processamento e Extração de XMLs (Hub vs Portal)
                </span>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200 self-start sm:self-auto">
                  Performance & Nuvem
                </span>
              </div>
              <p className="text-slate-600 text-sm leading-relaxed">
                Defina como as notas fiscais e modalidades de pagamento devem ser decodificadas e calculadas no sistema:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {/* Opção 1: Hub Desktop */}
                <label 
                  className={`p-4 rounded-xl border-2 cursor-pointer transition flex items-start gap-3 ${
                    formData.modo_processamento_xml === 'hub'
                      ? 'border-blue-600 bg-white shadow-xs'
                      : 'border-slate-200 bg-white/70 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="modo_processamento_xml"
                    value="hub"
                    checked={formData.modo_processamento_xml === 'hub'}
                    onChange={() => setFormData({ ...formData, modo_processamento_xml: 'hub' })}
                    className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="font-bold text-slate-900 block text-sm flex items-center gap-1.5">
                      🚀 Processar pelo Hub Desktop (Recomendado)
                    </span>
                    <span className="text-xs text-slate-600 mt-1 block leading-relaxed">
                      O aplicativo Hub na máquina local lê os XMLs, extrai modalidades de pagamento e dados fiscais em microssegundos e transmite tudo já estruturado. 
                      <strong> Máxima velocidade e menor consumo de recursos na nuvem.</strong>
                    </span>
                  </div>
                </label>

                {/* Opção 2: Portal Web */}
                <label 
                  className={`p-4 rounded-xl border-2 cursor-pointer transition flex items-start gap-3 ${
                    formData.modo_processamento_xml === 'portal'
                      ? 'border-blue-600 bg-white shadow-xs'
                      : 'border-slate-200 bg-white/70 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="modo_processamento_xml"
                    value="portal"
                    checked={formData.modo_processamento_xml === 'portal'}
                    onChange={() => setFormData({ ...formData, modo_processamento_xml: 'portal' })}
                    className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="font-bold text-slate-900 block text-sm flex items-center gap-1.5">
                      ☁️ Processar pelo Portal Web (Nuvem)
                    </span>
                    <span className="text-xs text-slate-600 mt-1 block leading-relaxed">
                      O Hub envia o arquivo XML bruto e o Portal Web na nuvem faz a abertura, expressões regulares e cálculo dos totais e formas de pagamento diretamente nos servidores.
                    </span>
                  </div>
                </label>
              </div>
            </div>
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
                  Excluir automaticamente XMLs de vendas que não pertencem à empresa analisada
                </span>
                <span className="text-slate-600 text-sm leading-relaxed block">
                  O portal verifica se os XMLs enviados para a pasta de vendas realmente pertencem à empresa cadastrada (evitando equívocos como arquivos de fornecedores ou compras misturados com as vendas).
                </span>
                <span className="text-slate-600 text-sm leading-relaxed block mt-2">
                  • <strong>Se marcado:</strong> o sistema <strong>exclui diretamente</strong> o arquivo divergente no recebimento, impedindo que dados incorretos contaminem os relatórios fiscais.<br />
                  • <strong>Se desmarcado:</strong> o arquivo é importado, porém <strong>destacado em vermelho</strong> no painel de notas fiscais com aviso de divergência de titularidade e botão para exclusão manual.
                </span>
                <span className="inline-flex items-center gap-1.5 mt-3 text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100/70 text-blue-800">
                  <CheckCircle2 size={14} /> Ativo para: Super Admin, Contabilidade e Empresa Cliente
                </span>
              </label>
            </div>

            {/* Aceitar apenas XMLs com Protocolo e Assinatura Digital */}
            <div className="flex items-start gap-3.5 p-5 bg-slate-50 rounded-2xl border border-slate-200 hover:border-slate-300 transition">
              <input 
                type="checkbox" 
                id="apenas_xmls_autorizados"
                checked={formData.apenas_xmls_autorizados}
                onChange={e => setFormData({ ...formData, apenas_xmls_autorizados: e.target.checked })}
                className="mt-1 h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <label htmlFor="apenas_xmls_autorizados" className="cursor-pointer select-none">
                <span className="font-bold text-slate-900 block text-base mb-1">
                  Aceitar apenas XMLs com Protocolo de Autorização SEFAZ e Assinatura Digital
                </span>
                <span className="text-slate-600 text-sm leading-relaxed block">
                  Exige que todo XML de venda recebido contenha o protocolo de autorização oficial da SEFAZ (<code className="text-xs bg-slate-200 px-1 py-0.5 rounded">&lt;protNFe&gt;</code> com status 100) e a assinatura digital ICP-Brasil (<code className="text-xs bg-slate-200 px-1 py-0.5 rounded">&lt;Signature&gt;</code>).
                </span>
                <span className="text-slate-600 text-sm leading-relaxed block mt-2">
                  • <strong>Se marcado:</strong> o sistema <strong>recusa e descarta automaticamente</strong> arquivos em rascunho, pré-vendas geradas pelo PDV ou contingências não transmitidas à SEFAZ, garantindo que apenas arquivos com plena validade jurídica entrem na contabilidade.<br />
                  • <strong>Se desmarcado (Padrão):</strong> o sistema <strong>aceita e importa todos os XMLs</strong> gerados pelo PDV/ERP mesmo sem protocolo ou assinatura, registrando-os para fins de histórico e conferência interna.
                </span>
                <span className="inline-flex items-center gap-1.5 mt-3 text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100/70 text-blue-800">
                  <CheckCircle2 size={14} /> Ativo para: Super Admin, Contabilidade e Empresa Cliente
                </span>
              </label>
            </div>

            {/* Corrigir e Assinar Automaticamente via SEFAZ */}
            <div className="flex items-start gap-3.5 p-5 bg-indigo-50/60 rounded-2xl border border-indigo-200 hover:border-indigo-300 transition">
              <input 
                type="checkbox" 
                id="auto_corrigir_assinar_xmls"
                checked={formData.auto_corrigir_assinar_xmls}
                onChange={e => setFormData({ ...formData, auto_corrigir_assinar_xmls: e.target.checked })}
                className="mt-1 h-5 w-5 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <label htmlFor="auto_corrigir_assinar_xmls" className="cursor-pointer select-none">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-slate-900 block text-base">
                    Corrigir e Assinar Automaticamente XMLs na Nuvem (SEFAZ + Certificado A1)
                  </span>
                  <span className="text-[10px] uppercase font-bold tracking-wider bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-md border border-indigo-200">
                    Substitui AssinaXML Delphi
                  </span>
                </div>
                <span className="text-slate-600 text-sm leading-relaxed block">
                  Utiliza o Certificado Digital A1 da empresa salvo no Portal para consultar online na SEFAZ os dados de autorização (<code className="text-xs bg-slate-200 px-1 py-0.5 rounded">nProt</code>, <code className="text-xs bg-slate-200 px-1 py-0.5 rounded">dhRecbto</code>, <code className="text-xs bg-slate-200 px-1 py-0.5 rounded">digVal</code>), assinar o XML no padrão ICP-Brasil e envelopar o arquivo oficial <code className="text-xs bg-slate-200 px-1 py-0.5 rounded">&lt;nfeProc&gt;</code>.
                </span>
                <span className="text-slate-600 text-sm leading-relaxed block mt-2">
                  • <strong>Se marcado:</strong> Todo XML sem assinatura ou sem protocolo é <strong>corrigido, assinado e protocolado automaticamente</strong> logo ao ser recebido pelo Hub, sem nenhum trabalho manual.<br />
                  • <strong>Se desmarcado:</strong> Os arquivos são importados e direcionados com segurança para a aba exclusiva <strong>Arquivos para Correção</strong>, onde você pode consultar e corrigir com 1 clique ou manualmente quando desejar.
                </span>
                <span className="inline-flex items-center gap-1.5 mt-3 text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-800">
                  <CheckCircle2 size={14} /> Ativo para: Super Admin, Contabilidade e Empresa Cliente
                </span>
              </label>
            </div>

            {/* Análise Tributária com Multi-IA & Reforma Tributária (IBS/CBS) */}
            <div className="flex items-start gap-3.5 p-5 bg-purple-50/60 rounded-2xl border border-purple-200 hover:border-purple-300 transition">
              <input 
                type="checkbox" 
                id="analise_ia_xmls_ativa"
                checked={formData.analise_ia_xmls_ativa}
                onChange={e => setFormData({ ...formData, analise_ia_xmls_ativa: e.target.checked })}
                className="mt-1 h-5 w-5 rounded border-purple-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
              />
              <label htmlFor="analise_ia_xmls_ativa" className="cursor-pointer select-none">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-slate-900 block text-base">
                    Análise com Multi-IA & Reforma Tributária (IBS, CBS e IVA Dual) nos XMLs
                  </span>
                  <span className="text-[10px] uppercase font-bold tracking-wider bg-purple-100 text-purple-800 px-2 py-0.5 rounded-md border border-purple-200 flex items-center gap-1">
                    <Sparkles size={12} /> Motores IA + LC 214/2024
                  </span>
                </div>
                <span className="text-slate-600 text-sm leading-relaxed block">
                  Habilita os motores de Inteligência Artificial ativos (Google Gemini, Groq, OpenAI, Claude, Ollama e Servidores MCP) e o cálculo automático das alíquotas do IVA Dual (IBS estadual/municipal + CBS federal) durante a auditoria dos XMLs de vendas (NF-e 55 e NFC-e 65) no Corretor Tributário.
                </span>
                <span className="text-slate-600 text-sm leading-relaxed block mt-2">
                  • <strong>Se marcado (Padrão):</strong> Os itens com inconsistência fiscal nos XMLs são analisados por inteligência artificial em modo consenso para sugerir NCM, CEST, CFOP, CSOSN e alíquotas de IBS/CBS.<br />
                  • <strong>Se desmarcado:</strong> A auditoria de XMLs executa apenas as checagens normativas locais estáticas do Convênio ICMS 142/2018, sem acionar motores externos de IA.
                </span>
                <span className="inline-flex items-center gap-1.5 mt-3 text-xs font-semibold px-2.5 py-1 rounded-full bg-purple-100 text-purple-800">
                  <CheckCircle2 size={14} /> Ativo para: Super Admin, Contabilidade e Empresa Cliente
                </span>
              </label>
            </div>
          </div>

          {/* Preferências de Exibição de Empresas & Clientes (Nome Fantasia vs Razão Social) */}
          <div className="mt-8 pt-8 border-t border-slate-200">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100 mb-6">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                <Building2 size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900">Exibição de Empresas & Clientes</h3>
                  <span className="text-[10px] uppercase font-bold tracking-wider bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md border border-blue-200">
                    Visual & Listagens
                  </span>
                </div>
                <p className="text-slate-500 text-xs">
                  Defina como os nomes das empresas devem ser apresentados em destaque nas tabelas e no gerenciamento de clientes.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 p-5 bg-slate-50 rounded-2xl border border-slate-200 hover:border-slate-300 transition">
              <input 
                type="checkbox" 
                id="priorizar_nome_fantasia"
                checked={priorizarNomeFantasia}
                onChange={e => setPriorizarNomeFantasia(e.target.checked)}
                className="mt-1 h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <label htmlFor="priorizar_nome_fantasia" className="cursor-pointer select-none">
                <span className="font-bold text-slate-900 block text-base mb-1">
                  Exibir Nome Fantasia como Título Principal (e Razão Social como Subtítulo)
                </span>
                <span className="text-slate-600 text-sm leading-relaxed block">
                  Permite alternar a hierarquia visual na tela de <strong>Clientes (Empresas)</strong> e em outras listagens do portal.
                </span>
                <span className="text-slate-600 text-sm leading-relaxed block mt-2">
                  • <strong>Se marcado:</strong> O <strong>Nome Fantasia</strong> ganha destaque em negrito como título principal e a <strong>Razão Social</strong> é exibida logo abaixo em subtítulo cinza.<br />
                  • <strong>Se desmarcado (Padrão):</strong> A <strong>Razão Social</strong> permanece como título principal em negrito e o <strong>Nome Fantasia</strong> como subtítulo.
                </span>
                <span className={`inline-flex items-center gap-1.5 mt-3 text-xs font-semibold px-2.5 py-1 rounded-full ${
                  priorizarNomeFantasia 
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                    : 'bg-slate-200 text-slate-700'
                }`}>
                  <CheckCircle2 size={14} /> {priorizarNomeFantasia ? 'Status: Nome Fantasia em Destaque (Título Principal)' : 'Status: Razão Social em Destaque (Padrão)'}
                </span>
              </label>
            </div>
          </div>

          {/* Controle de Alternância e Modos de Interface (Clean vs Clássico) - Exclusivo Super Admin */}
          {userRole === 'admin' && (
            <div className="mt-8 pt-8 border-t border-slate-200">
              <div className="flex items-center gap-3 pb-4 border-b border-slate-100 mb-6">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                  <LayoutDashboard size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-900">Modo de Interface & Controle de Alternância</h3>
                    <span className="text-[10px] uppercase font-bold tracking-wider bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-md border border-indigo-200">
                      Exclusivo Admin
                    </span>
                  </div>
                  <p className="text-slate-500 text-xs">
                    Defina se clientes e contabilidades podem alternar livremente entre o Modo Clean e o Modo Clássico ou se o portal deve operar em um modo padrão fixo.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Switch de Habilitar / Desabilitar Mudança de Interface */}
                <div className="flex items-start gap-3.5 p-5 bg-slate-50 rounded-2xl border border-slate-200 hover:border-slate-300 transition">
                  <input 
                    type="checkbox" 
                    id="permitir_troca_interface"
                    checked={permitirTrocaInterface}
                    onChange={e => setPermitirTrocaInterface(e.target.checked)}
                    className="mt-1 h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <label htmlFor="permitir_troca_interface" className="cursor-pointer select-none flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-slate-900 block text-base">
                        Permitir que Usuários Alternem entre Modo Clean e Modo Clássico
                      </span>
                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md ${
                        permitirTrocaInterface ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {permitirTrocaInterface ? 'Habilitado' : 'Desabilitado'}
                      </span>
                    </div>
                    <span className="text-slate-600 text-sm leading-relaxed block">
                      Exibe o botão de alternância de interface na barra superior e no menu lateral para usuários do tipo <strong>Contabilidade</strong> e <strong>Cliente</strong>.
                    </span>
                    <span className="text-slate-600 text-sm leading-relaxed block mt-2">
                      • <strong>Se marcado (Habilitado):</strong> Todos os usuários podem escolher livremente entre o visual Clean (moderno, sem poluição) e o visual Clássico (banners e cartões tradicionais).<br />
                      • <strong>Se desmarcado (Desabilitado):</strong> Usuários comuns (Contabilidade e Clientes) não verão o botão de alternância e ficarão fixados no <strong>Modo Padrão</strong> selecionado abaixo. Apenas Administradores mantêm acesso à troca para supervisão e testes.
                    </span>
                  </label>
                </div>

                {/* Seletor do Modo Padrão */}
                <div className="p-5 bg-white rounded-2xl border border-slate-200 space-y-3">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Modo Padrão da Interface do Portal:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setModoPadraoInterface('clean')}
                      className={`p-4 rounded-xl border text-left transition flex items-start gap-3 cursor-pointer ${
                        modoPadraoInterface === 'clean'
                          ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20'
                          : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                      }`}
                    >
                      <div className={`p-2 rounded-lg shrink-0 ${modoPadraoInterface === 'clean' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                        <Sparkles size={18} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">Modo Clean</span>
                          <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.2 rounded">Recomendado</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                          Design minimalista, foco total nos dados fiscais, sem caixas repetitivas de empresa. Busca de clientes inteligente e unificada na barra superior.
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setModoPadraoInterface('classico')}
                      className={`p-4 rounded-xl border text-left transition flex items-start gap-3 cursor-pointer ${
                        modoPadraoInterface === 'classico'
                          ? 'border-amber-600 bg-amber-50/60 ring-2 ring-amber-500/20'
                          : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                      }`}
                    >
                      <div className={`p-2 rounded-lg shrink-0 ${modoPadraoInterface === 'classico' ? 'bg-amber-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                        <LayoutDashboard size={18} />
                      </div>
                      <div>
                        <span className="text-sm font-bold text-slate-900">Modo Clássico</span>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                          Layout visual tradicional com banners ilustrados coloridos, cards com gradientes em cada tela e seletores individuais em cada módulo.
                        </p>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

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
                {/* Opção de Envio por WhatsApp */}
                <div className="flex items-start gap-3.5 p-5 bg-slate-50 rounded-2xl border border-slate-200 hover:border-slate-300 transition">
                  <input 
                    type="checkbox" 
                    id="avisar_whatsapp_certificado"
                    checked={formData.avisar_whatsapp_certificado}
                    onChange={e => setFormData({ ...formData, avisar_whatsapp_certificado: e.target.checked })}
                    className="mt-1 h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <label htmlFor="avisar_whatsapp_certificado" className="cursor-pointer select-none">
                    <span className="font-bold text-slate-900 block text-base mb-1">
                      Aviso automático via WhatsApp 45 dias antes do vencimento
                    </span>
                    <span className="text-slate-600 text-sm leading-relaxed block">
                      Envia mensagem automática de alerta no WhatsApp cadastrado para a empresa 45 dias antes de expirar o Certificado Digital A1 e nos dias subsequentes até a renovação.
                    </span>
                    <span className="inline-flex items-center gap-1.5 mt-3 text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
                      Disparo Automático Integrado à Régua Diária
                    </span>
                  </label>
                </div>

                {/* Opção de Faixa Vermelha no Topo do Portal */}
                <div className="flex items-start gap-3.5 p-5 bg-slate-50 rounded-2xl border border-slate-200 hover:border-slate-300 transition">
                  <input 
                    type="checkbox" 
                    id="exibir_faixa_topo_certificado"
                    checked={formData.exibir_faixa_topo_certificado}
                    onChange={e => setFormData({ ...formData, exibir_faixa_topo_certificado: e.target.checked })}
                    className="mt-1 h-5 w-5 rounded border-slate-300 text-red-600 focus:ring-red-500 cursor-pointer"
                  />
                  <label htmlFor="exibir_faixa_topo_certificado" className="cursor-pointer select-none">
                    <span className="font-bold text-slate-900 block text-base mb-1">
                      Exibir faixa vermelha no topo do Portal quando o certificado estiver a vencer ou vencido
                    </span>
                    <span className="text-slate-600 text-sm leading-relaxed block">
                      Exibe um banner vermelho de destaque no topo da tela do cliente com nome do titular, CNPJ/CPF e dias restantes. Visível para o Admin e também para a Contabilidade e Cliente se as permissões abaixo estiverem ativadas.
                    </span>
                    <span className="inline-flex items-center gap-1.5 mt-3 text-xs font-medium px-2.5 py-1 rounded-full bg-red-100 text-red-800">
                      Alerta Visual Prioritário no Portal
                    </span>
                  </label>
                </div>
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

          {/* Configuração de Valores Fictícios do Dashboard - Exclusivo Super Admin */}
          {userRole === 'admin' && (
            <div className="mt-8 pt-8 border-t border-slate-200">
              <div className="flex items-center gap-3 pb-4 border-b border-slate-100 mb-6">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                  <LayoutDashboard size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-900">Personalização de Métricas do Dashboard (Contabilidades & Clientes)</h3>
                    <span className="text-[10px] uppercase font-black tracking-wider bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-md border border-indigo-200">
                      Exclusivo Admin
                    </span>
                  </div>
                  <p className="text-slate-500 text-xs">
                    Defina valores fictícios para exibição nos cards do Dashboard dos perfis de Contabilidade e Cliente. Se desativado, o sistema calculará e exibirá os valores reais.
                  </p>
                </div>
              </div>

              {/* Toggle Principal de Ativação */}
              <div className="flex items-start gap-3.5 p-5 bg-indigo-50/50 rounded-2xl border border-indigo-200 hover:border-indigo-300 transition mb-6">
                <input 
                  type="checkbox" 
                  id="valores_ficticios_ativos"
                  checked={ficticioData.valores_ficticios_ativos}
                  onChange={e => setFicticioData({ ...ficticioData, valores_ficticios_ativos: e.target.checked })}
                  className="mt-1 h-5 w-5 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <label htmlFor="valores_ficticios_ativos" className="cursor-pointer select-none">
                  <span className="font-bold text-slate-900 block text-base mb-1">
                    Ativar exibição de valores fictícios no Dashboard para Contabilidades e Clientes
                  </span>
                  <span className="text-slate-600 text-sm leading-relaxed block">
                    Quando esta opção estiver marcada, os cards do Dashboard de todos os clientes e contabilidades exibirão os números personalizados abaixo, gerando maior autoridade visual.
                  </span>
                  <span className={`inline-flex items-center gap-1.5 mt-3 text-xs font-semibold px-2.5 py-1 rounded-full ${
                    ficticioData.valores_ficticios_ativos 
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                      : 'bg-slate-200 text-slate-700'
                  }`}>
                    {ficticioData.valores_ficticios_ativos ? 'Status: Valores Fictícios ATIVOS para terceiros' : 'Status: Exibindo Valores REAIS do Sistema'}
                  </span>
                </label>
              </div>

              {/* Inputs dos Valores Fictícios (disponíveis quando ativo) */}
              {ficticioData.valores_ficticios_ativos && (
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2 flex items-center gap-1.5">
                    <Sparkles size={14} className="text-indigo-600" /> Digite os valores para cada card do Dashboard:
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Total de Clientes</label>
                      <input 
                        type="number"
                        min="0"
                        value={ficticioData.ficticio_clientes}
                        onChange={e => setFicticioData({ ...ficticioData, ficticio_clientes: Number(e.target.value) })}
                        className="w-full bg-white border border-slate-200 px-3.5 py-2 rounded-xl text-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Ex: 28"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Contabilidades</label>
                      <input 
                        type="number"
                        min="0"
                        value={ficticioData.ficticio_contabilidades}
                        onChange={e => setFicticioData({ ...ficticioData, ficticio_contabilidades: Number(e.target.value) })}
                        className="w-full bg-white border border-slate-200 px-3.5 py-2 rounded-xl text-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Ex: 8"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Faturas Atrasadas</label>
                      <input 
                        type="number"
                        min="0"
                        value={ficticioData.ficticio_faturas_atrasadas}
                        onChange={e => setFicticioData({ ...ficticioData, ficticio_faturas_atrasadas: Number(e.target.value) })}
                        className="w-full bg-white border border-slate-200 px-3.5 py-2 rounded-xl text-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Ex: 0"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">NF Processadas (Quantidade)</label>
                      <input 
                        type="number"
                        min="0"
                        value={ficticioData.ficticio_nf_quantidade}
                        onChange={e => setFicticioData({ ...ficticioData, ficticio_nf_quantidade: Number(e.target.value) })}
                        className="w-full bg-white border border-slate-200 px-3.5 py-2 rounded-xl text-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Ex: 14500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">NF Processadas (Valor Total R$)</label>
                      <input 
                        type="number"
                        step="0.01"
                        min="0"
                        value={ficticioData.ficticio_nf_valor}
                        onChange={e => setFicticioData({ ...ficticioData, ficticio_nf_valor: Number(e.target.value) })}
                        className="w-full bg-white border border-slate-200 px-3.5 py-2 rounded-xl text-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Ex: 894520.50"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Total de Relatórios Gerados</label>
                      <input 
                        type="number"
                        min="0"
                        value={ficticioData.ficticio_relatorios}
                        onChange={e => setFicticioData({ ...ficticioData, ficticio_relatorios: Number(e.target.value) })}
                        className="w-full bg-white border border-slate-200 px-3.5 py-2 rounded-xl text-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Ex: 120"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Cidades Atendidas</label>
                      <input 
                        type="number"
                        min="0"
                        value={ficticioData.ficticio_cidades}
                        onChange={e => setFicticioData({ ...ficticioData, ficticio_cidades: Number(e.target.value) })}
                        className="w-full bg-white border border-slate-200 px-3.5 py-2 rounded-xl text-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Ex: 14"
                      />
                    </div>
                  </div>
                </div>
              )}
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
