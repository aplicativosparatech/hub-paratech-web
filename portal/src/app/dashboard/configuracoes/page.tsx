'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import toast from 'react-hot-toast'
import { 
  RefreshCw, Download, Clock, ArrowUpCircle, CheckCircle2, AlertTriangle,
  ArrowUpRight, ArrowDownLeft, ShieldAlert, Layers, Calendar, DollarSign,
  Phone, SlidersHorizontal, Lock, FolderArchive, Sparkles, Inbox, ShoppingBag,
  Check, FileText, CheckSquare, MessageSquare
} from 'lucide-react'
import { APP_VERSION } from '@/utils/version'
import { useTableFeatures } from '@/hooks/useTableFeatures'
import { ResizableSortableTh } from '@/components/ui/ResizableSortableTh'
import { ClienteAutocompleteInput } from '@/components/ClienteAutocompleteInput'

export default function ConfiguracoesPage() {
  const supabase = createClient()
  const [clientes, setClientes] = useState<any[]>([])
  const [hubs, setHubs] = useState<any[]>([])
  const [selectedCliente, setSelectedCliente] = useState<string>('')
  const [now, setNow] = useState<number>(() => Date.now())

  // Ticker de 1 segundo para atualizar o cronômetro regressivo de batimento cardíaco (15 min)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [loadingComandoId, setLoadingComandoId] = useState<string | null>(null)

  const {
    sortedData: hubsOrdenados,
    sortKey,
    sortDirection,
    handleSort,
    columnWidths,
    handleResizeColumn
  } = useTableFeatures({
    data: hubs,
    tableId: 'tabela_hubs_configuracoes',
    defaultSortKey: 'cliente',
    defaultSortDirection: 'asc',
    initialWidths: {
      cliente: 240,
      contraSenha: 170,
      ultimaSync: 160,
      status: 120,
      versao: 150,
      acao: 150
    },
    customExtractors: {
      cliente: (h: any) => h.razao_social || '',
      contraSenha: (h: any) => {
        const config = Array.isArray(h.configuracoes_hub) ? h.configuracoes_hub[0] : h.configuracoes_hub
        return config?.offline_secret || ''
      },
      ultimaSync: (h: any) => {
        const config = Array.isArray(h.configuracoes_hub) ? h.configuracoes_hub[0] : h.configuracoes_hub
        return config?.ultima_sincronizacao || ''
      },
      status: (h: any) => {
        const config = Array.isArray(h.configuracoes_hub) ? h.configuracoes_hub[0] : h.configuracoes_hub
        const lastSync = config?.ultima_sincronizacao
        if (!lastSync) return 0
        const diff = Date.now() - new Date(lastSync).getTime()
        return diff < (15 * 60 * 1000 + 2 * 60 * 1000) ? 1 : 0
      },
      versao: (h: any) => {
        const config = Array.isArray(h.configuracoes_hub) ? h.configuracoes_hub[0] : h.configuracoes_hub
        return config?.versao_hub_instalada || ''
      }
    }
  })

  const [formData, setFormData] = useState({
    // Card 1: Monitoramento de Vendas (Saídas) & Ponto de Partida
    pastas_vendas: '',
    data_inicio_monitoramento: '',
    numero_inicial_nfe: 1,
    numero_inicial_nfce: 1,
    numero_inicial_nfse: 1,
    numero_inicial_cte: 1,
    numero_inicial_mdfe: 1,

    // Card 2: Monitoramento de Compras (Entradas) & Ponto de Partida
    pastas_compras: '',
    data_inicio_monitoramento_entradas: '',
    numero_inicial_compras_nfe: 1,

    // Card 3: Executáveis Monitorados & Cobrança
    exes_monitorados: '',
    dia_vencimento: 10,
    valor_mensalidade: 150.00,
    whatsapp_cobranca: '',
    dias_aviso_previo: 7,
    intervalo_aviso_horas: 4,
    dias_tolerancia_bloqueio: 3,
    mensagem_aviso_previo: 'AVISO DE VENCIMENTO: Sua mensalidade vence em breve. Regularize via Pix no Hub para evitar bloqueio.',
    mensagem_bloqueio: 'SISTEMA BLOQUEADO. Por favor, regularize seu pagamento.',
    bloquear_recepcao_xml_se_inadimplente: false
  })

  async function loadClientes() {
    const { data } = await supabase
      .from('clientes')
      .select('id, razao_social, nome_fantasia, cnpj, configuracoes_hub(ultima_sincronizacao, offline_secret, versao_hub_instalada, comando_remoto, comando_remoto_em)')
      .order('razao_social')
    
    if (data) {
      setClientes(data)
      setHubs(data)
    }
  }

  async function handleDispararComando(clienteId: string, comando: string) {
    setLoadingComandoId(clienteId)
    try {
      const res = await fetch('/api/hub/comando-remoto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cliente_id: clienteId, comando })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar comando')
      
      toast.success(data.message)
      await loadClientes()
    } catch (err: any) {
      toast.error(`Falha: ${err.message}`)
    } finally {
      setLoadingComandoId(null)
    }
  }

  useEffect(() => {
    loadClientes()
    const timer = setInterval(loadClientes, 15000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!selectedCliente) return
    async function loadConfig() {
      setLoading(true)
      const [hubRes, cliRes] = await Promise.all([
        supabase.from('configuracoes_hub').select('*').eq('cliente_id', selectedCliente).maybeSingle(),
        supabase.from('clientes').select('*').eq('id', selectedCliente).maybeSingle()
      ])

      const hub = hubRes.data
      const cli = cliRes.data
      
      setFormData({
        // Vendas
        pastas_vendas: Array.isArray(hub?.pastas_vendas) ? hub.pastas_vendas.map((p: string) => p.replace(/\\\\+/g, '\\')).join('\n') : '',
        data_inicio_monitoramento: cli?.data_inicio_monitoramento ? cli.data_inicio_monitoramento.substring(0, 7) : '',
        numero_inicial_nfe: cli?.numero_inicial_nfe || 1,
        numero_inicial_nfce: cli?.numero_inicial_nfce || 1,
        numero_inicial_nfse: cli?.numero_inicial_nfse || 1,
        numero_inicial_cte: cli?.numero_inicial_cte || 1,
        numero_inicial_mdfe: cli?.numero_inicial_mdfe || 1,

        // Compras
        pastas_compras: Array.isArray(hub?.pastas_compras) ? hub.pastas_compras.map((p: string) => p.replace(/\\\\+/g, '\\')).join('\n') : '',
        data_inicio_monitoramento_entradas: cli?.data_inicio_monitoramento_entradas 
          ? cli.data_inicio_monitoramento_entradas.substring(0, 7) 
          : (hub?.data_inicio_monitoramento_entradas ? hub.data_inicio_monitoramento_entradas.substring(0, 7) : ''),
        numero_inicial_compras_nfe: cli?.numero_inicial_compras_nfe || hub?.numero_inicial_compras_nfe || 1,

        // Cobrança & Bloqueio
        dia_vencimento: cli?.dia_vencimento || hub?.dia_vencimento || 10,
        valor_mensalidade: cli?.valor_mensalidade || hub?.valor_mensalidade || 150.00,
        whatsapp_cobranca: cli?.whatsapp_cobranca || cli?.whatsapp || '',
        exes_monitorados: Array.isArray(hub?.exes_monitorados) ? hub.exes_monitorados.join('\n') : '',
        dias_aviso_previo: hub?.dias_aviso_previo || 7,
        intervalo_aviso_horas: hub?.intervalo_aviso_horas || 4,
        dias_tolerancia_bloqueio: cli?.dias_carencia ?? (hub?.dias_tolerancia_bloqueio ?? 3),
        mensagem_aviso_previo: hub?.mensagem_aviso_previo || 'AVISO DE VENCIMENTO: Sua mensalidade vence em breve. Regularize via Pix no Hub para evitar bloqueio.',
        mensagem_bloqueio: hub?.mensagem_bloqueio || 'SISTEMA BLOQUEADO. Por favor, regularize seu pagamento.',
        bloquear_recepcao_xml_se_inadimplente: Boolean(cli?.bloquear_recepcao_xml_se_inadimplente ?? hub?.bloquear_recepcao_xml_se_inadimplente)
      })
      setLoading(false)
    }
    loadConfig()
  }, [selectedCliente])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCliente) return
    setSaving(true)
    setMessage('')

    const dataInicioVendas = formData.data_inicio_monitoramento ? `${formData.data_inicio_monitoramento}-01` : null
    const dataInicioCompras = formData.data_inicio_monitoramento_entradas ? `${formData.data_inicio_monitoramento_entradas}-01` : null

    const hubPayload = {
      cliente_id: selectedCliente,
      pastas_vendas: formData.pastas_vendas.split('\n').filter(Boolean).map(s => s.trim().replace(/\\\\+/g, '\\')),
      pastas_compras: formData.pastas_compras.split('\n').filter(Boolean).map(s => s.trim().replace(/\\\\+/g, '\\')),
      exes_monitorados: formData.exes_monitorados.split('\n').filter(Boolean).map(s => s.trim()),
      dia_vencimento: formData.dia_vencimento,
      valor_mensalidade: formData.valor_mensalidade,
      dias_aviso_previo: formData.dias_aviso_previo,
      intervalo_aviso_horas: formData.intervalo_aviso_horas,
      dias_tolerancia_bloqueio: formData.dias_tolerancia_bloqueio,
      mensagem_aviso_previo: formData.mensagem_aviso_previo,
      mensagem_bloqueio: formData.mensagem_bloqueio,
      bloquear_recepcao_xml_se_inadimplente: Boolean(formData.bloquear_recepcao_xml_se_inadimplente),
      data_inicio_monitoramento_entradas: dataInicioCompras,
      numero_inicial_compras_nfe: formData.numero_inicial_compras_nfe || 1,
      updated_at: new Date().toISOString()
    }

    const cliPayload = {
      dia_vencimento: formData.dia_vencimento,
      valor_mensalidade: formData.valor_mensalidade,
      whatsapp_cobranca: formData.whatsapp_cobranca,
      bloquear_recepcao_xml_se_inadimplente: Boolean(formData.bloquear_recepcao_xml_se_inadimplente),
      data_inicio_monitoramento: dataInicioVendas,
      numero_inicial_nfe: Math.max(1, parseInt(String(formData.numero_inicial_nfe || 1), 10)),
      numero_inicial_nfce: Math.max(1, parseInt(String(formData.numero_inicial_nfce || 1), 10)),
      numero_inicial_nfse: Math.max(1, parseInt(String(formData.numero_inicial_nfse || 1), 10)),
      numero_inicial_cte: Math.max(1, parseInt(String(formData.numero_inicial_cte || 1), 10)),
      numero_inicial_mdfe: Math.max(1, parseInt(String(formData.numero_inicial_mdfe || 1), 10)),
      data_inicio_monitoramento_entradas: dataInicioCompras,
      numero_inicial_compras_nfe: Math.max(1, parseInt(String(formData.numero_inicial_compras_nfe || 1), 10)),
      dias_carencia: formData.dias_tolerancia_bloqueio
    }

    const [hubRes, cliRes] = await Promise.all([
      supabase.from('configuracoes_hub').upsert(hubPayload, { onConflict: 'cliente_id' }),
      supabase.from('clientes').update(cliPayload).eq('id', selectedCliente)
    ])
    
    if (hubRes.error || cliRes.error) {
      toast.error('Erro ao salvar: ' + (hubRes.error?.message || cliRes.error?.message))
    } else {
      toast.success('Regras do Hub, Pontos de Partida e Cobrança salvos com sucesso!')
      await loadClientes()
    }
    setSaving(false)
  }

  const clienteSelecionadoObj = clientes.find(c => c.id === selectedCliente)

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-300">
      <header className="mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-3xl font-bold text-slate-900">Configurações do Hub</h1>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">
              v{APP_VERSION}
            </span>
          </div>
          <p className="text-slate-500 mt-1">Gerencie regras de monitoramento, pontos de partida fiscais de entrada/saída e bloqueio financeiro.</p>
        </div>
        <div className="flex items-center gap-3">
          <a href="/HubParatech.zip" download className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-indigo-700 transition flex items-center gap-2 shadow-sm text-xs">
            <Download size={16} />
            Baixar Hub v{APP_VERSION} (.zip)
          </a>
          <button onClick={() => loadClientes()} className="bg-slate-100 text-slate-700 px-4 py-2 rounded-xl font-semibold hover:bg-slate-200 transition flex items-center gap-2 text-xs">
            <RefreshCw size={15} />
            Atualizar Tabela
          </button>
        </div>
      </header>

      {/* Seletor de Cliente */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
        <ClienteAutocompleteInput
          clientes={clientes}
          selectedId={selectedCliente}
          onSelect={id => setSelectedCliente(id)}
          label="Selecione a Empresa / Cliente para Configurar o Hub"
          placeholder="Digite a Razão Social, Nome Fantasia ou CNPJ..."
        />
      </div>

      {selectedCliente && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {loading ? (
            <div className="p-8 text-center text-slate-500 bg-white rounded-2xl border border-slate-200">
              <RefreshCw size={24} className="animate-spin mx-auto text-indigo-600 mb-2" />
              Carregando regras de monitoramento do cliente...
            </div>
          ) : (
            <>
              {/* ===== CARD 1: MONITORAMENTO DE VENDAS (SAÍDAS) & PONTO DE PARTIDA FISCAL ===== */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 bg-gradient-to-r from-indigo-50/60 to-purple-50/40 border-b border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs">
                      <ArrowUpRight size={18} />
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                        1. Monitoramento de Vendas (Saídas) & Ponto de Partida
                      </h3>
                      <p className="text-xs text-slate-500">
                        Diretórios locais e ponto de corte numérico das notas fiscais emitidas pelo PDV/ERP.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800">
                      NF-e (55)
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                      NFC-e (65)
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-cyan-100 text-cyan-800">
                      NFS-e
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-100 text-purple-800">
                      CT-e
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800">
                      MDF-e
                    </span>
                  </div>
                </div>

                <div className="p-6 space-y-5">
                  {/* Pastas de Vendas */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <FolderArchive size={14} className="text-indigo-600" />
                        Pastas de Vendas no PDV (XML)
                      </label>
                      <span className="text-[11px] text-slate-400">Um caminho por linha</span>
                    </div>
                    <textarea 
                      rows={3} 
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 font-mono text-xs text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      placeholder="C:\PDV+\temp\DocumentosAutorizados&#10;C:\PDV+\temp\DocumentosAutorizados\NFCe&#10;C:\PDV+\temp\DocumentosAutorizados\NFe"
                      value={formData.pastas_vendas} 
                      onChange={e => setFormData({...formData, pastas_vendas: e.target.value})} 
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      O monitor do Hub Desktop sincroniza automaticamente qualquer XML autorizado gravado nestas pastas.
                    </p>
                  </div>

                  {/* Card Réplica do Ponto de Partida Fiscal (Idêntico ao de Quebras de Sequência) */}
                  <div className="bg-slate-900 border border-indigo-900/50 rounded-2xl p-5 text-white shadow-md">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-indigo-950 mb-4">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-indigo-500/20 text-indigo-400 rounded-lg">
                          <Layers size={16} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                              PONTO DE PARTIDA FISCAL & COMPETÊNCIA INICIAL
                            </span>
                            <span className="text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/30">
                              Contrato de Monitoramento
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            XMLs emitidos antes desta data ou números inferiores ao ponto de partida são ignorados e não geram falsos gaps.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <label className="text-[11px] font-semibold text-slate-300">Mês Início:</label>
                        <input
                          type="month"
                          value={formData.data_inicio_monitoramento}
                          onChange={e => setFormData({...formData, data_inicio_monitoramento: e.target.value})}
                          className="bg-slate-800 text-xs font-bold text-white px-3 py-1.5 rounded-xl border border-indigo-700/60 focus:ring-2 focus:ring-indigo-400 outline-none cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* Pills Editáveis de Numeração Inicial de Vendas */}
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2.5">
                        Numeração Inicial Contratada (Ponto de Partida):
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                        <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-2.5">
                          <span className="text-[10px] font-bold text-slate-400 block mb-1">NF-e (55)</span>
                          <div className="flex items-center gap-1">
                            <span className="text-emerald-400 text-xs font-bold font-mono">#</span>
                            <input
                              type="number"
                              min={1}
                              value={formData.numero_inicial_nfe}
                              onChange={e => setFormData({...formData, numero_inicial_nfe: parseInt(e.target.value) || 1})}
                              className="w-full bg-transparent text-emerald-400 text-xs font-bold font-mono focus:outline-none"
                            />
                          </div>
                        </div>

                        <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-2.5">
                          <span className="text-[10px] font-bold text-slate-400 block mb-1">NFC-e (65)</span>
                          <div className="flex items-center gap-1">
                            <span className="text-emerald-400 text-xs font-bold font-mono">#</span>
                            <input
                              type="number"
                              min={1}
                              value={formData.numero_inicial_nfce}
                              onChange={e => setFormData({...formData, numero_inicial_nfce: parseInt(e.target.value) || 1})}
                              className="w-full bg-transparent text-emerald-400 text-xs font-bold font-mono focus:outline-none"
                            />
                          </div>
                        </div>

                        <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-2.5">
                          <span className="text-[10px] font-bold text-slate-400 block mb-1">NFS-e</span>
                          <div className="flex items-center gap-1">
                            <span className="text-indigo-400 text-xs font-bold font-mono">#</span>
                            <input
                              type="number"
                              min={1}
                              value={formData.numero_inicial_nfse}
                              onChange={e => setFormData({...formData, numero_inicial_nfse: parseInt(e.target.value) || 1})}
                              className="w-full bg-transparent text-indigo-400 text-xs font-bold font-mono focus:outline-none"
                            />
                          </div>
                        </div>

                        <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-2.5">
                          <span className="text-[10px] font-bold text-slate-400 block mb-1">CT-e (57)</span>
                          <div className="flex items-center gap-1">
                            <span className="text-purple-400 text-xs font-bold font-mono">#</span>
                            <input
                              type="number"
                              min={1}
                              value={formData.numero_inicial_cte}
                              onChange={e => setFormData({...formData, numero_inicial_cte: parseInt(e.target.value) || 1})}
                              className="w-full bg-transparent text-purple-400 text-xs font-bold font-mono focus:outline-none"
                            />
                          </div>
                        </div>

                        <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-2.5">
                          <span className="text-[10px] font-bold text-slate-400 block mb-1">MDF-e (58)</span>
                          <div className="flex items-center gap-1">
                            <span className="text-blue-400 text-xs font-bold font-mono">#</span>
                            <input
                              type="number"
                              min={1}
                              value={formData.numero_inicial_mdfe}
                              onChange={e => setFormData({...formData, numero_inicial_mdfe: parseInt(e.target.value) || 1})}
                              className="w-full bg-transparent text-blue-400 text-xs font-bold font-mono focus:outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ===== CARD 2: MONITORAMENTO DE COMPRAS (ENTRADAS) & PONTO DE PARTIDA FISCAL ===== */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 bg-gradient-to-r from-blue-50/60 to-cyan-50/40 border-b border-blue-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-blue-600 text-white rounded-xl shadow-xs">
                      <ArrowDownLeft size={18} />
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                        2. Monitoramento de Compras (Entradas) & Ponto de Partida
                      </h3>
                      <p className="text-xs text-slate-500">
                        Diretórios de notas fiscais de compra recebidas de fornecedores e data inicial contratada.
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 self-start sm:self-auto">
                    NF-e de Compra (Mod. 55) • Fornecedores
                  </span>
                </div>

                <div className="p-6 space-y-5">
                  {/* Pastas de Compras */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Inbox size={14} className="text-blue-600" />
                        Pastas de Compras no Cliente (XML)
                      </label>
                      <span className="text-[11px] text-slate-400">Um caminho por linha</span>
                    </div>
                    <textarea 
                      rows={3} 
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 font-mono text-xs text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      placeholder="C:\Sistema\Compras\XML&#10;C:\GDOOR Sistemas\GDOOR PRO\NFe\XML\Compras"
                      value={formData.pastas_compras} 
                      onChange={e => setFormData({...formData, pastas_compras: e.target.value})} 
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      O monitor do Hub varre estas pastas para capturar XMLs de aquisição para o fechamento mensal e conciliação com o DF-e.
                    </p>
                  </div>

                  {/* Card Ponto de Partida Fiscal de Compras */}
                  <div className="bg-slate-900 border border-blue-900/50 rounded-2xl p-5 text-white shadow-md">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-blue-950 mb-4">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-blue-500/20 text-blue-400 rounded-lg">
                          <Calendar size={16} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-blue-300">
                              PONTO DE PARTIDA FISCAL DE COMPRAS (ENTRADAS)
                            </span>
                            <span className="text-[10px] font-semibold bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/30">
                              Aquisições de Fornecedores
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            XMLs de compras anteriores a este mês não são sincronizados para evitar carregar notas antigas de anos anteriores.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <label className="text-[11px] font-semibold text-slate-300">Mês Início Compras:</label>
                        <input
                          type="month"
                          value={formData.data_inicio_monitoramento_entradas}
                          onChange={e => setFormData({...formData, data_inicio_monitoramento_entradas: e.target.value})}
                          className="bg-slate-800 text-xs font-bold text-white px-3 py-1.5 rounded-xl border border-blue-700/60 focus:ring-2 focus:ring-blue-400 outline-none cursor-pointer"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-3">
                        <span className="text-[11px] font-bold text-slate-400 block mb-1">
                          Primeiro Número de Compra / Ponto Inicial (NF-e Mod. 55):
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-blue-400 text-xs font-bold font-mono">#</span>
                          <input
                            type="number"
                            min={1}
                            value={formData.numero_inicial_compras_nfe}
                            onChange={e => setFormData({...formData, numero_inicial_compras_nfe: parseInt(e.target.value) || 1})}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-blue-400 text-xs font-bold font-mono focus:outline-none"
                            placeholder="Ex: 1"
                          />
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-1">
                          Notas de compra com numeração igual ou superior nunca são descartadas.
                        </span>
                      </div>

                      <div className="p-3 bg-blue-950/40 border border-blue-900/40 rounded-xl flex items-center gap-3">
                        <Sparkles size={20} className="text-blue-400 shrink-0" />
                        <p className="text-[11px] text-slate-300 leading-relaxed">
                          Se o mês de início de compras for deixado em branco, o Hub utilizará a mesma data de início do contrato de vendas configurada no Card 1.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ===== CARD 3: ARQUIVOS .EXE MONITORADOS & REGRAS FINANCEIRAS DE BLOQUEIO ===== */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 bg-gradient-to-r from-rose-50/70 to-amber-50/50 border-b border-rose-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-rose-600 text-white rounded-xl shadow-xs">
                      <ShieldAlert size={18} />
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                        3. Arquivos .exe Monitorados & Regras de Cobrança (Bloqueio)
                      </h3>
                      <p className="text-xs text-slate-500">
                        Processos executáveis do ERP/PDV monitorados no Windows e condições de vencimento para bloqueio automático.
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 self-start sm:self-auto">
                    Travamento por Inadimplência
                  </span>
                </div>

                <div className="p-6 space-y-6">
                  {/* Tríade de Cobrança: Vencimento, Valor da Mensalidade e WhatsApp que recebe cobrança */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-1.5">
                      <DollarSign size={15} className="text-emerald-600" />
                      Dados Financeiros da Mensalidade & Destino da Cobrança
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {/* 1. Dia de Vencimento */}
                      <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                        <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1">
                          <Calendar size={13} className="text-indigo-600" />
                          Dia do Vencimento:
                        </label>
                        <div className="relative">
                          <input 
                            type="number" 
                            required 
                            min="1" 
                            max="31" 
                            className="w-full bg-white px-3 py-2 rounded-lg border border-slate-300 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            value={formData.dia_vencimento} 
                            onChange={e => setFormData({...formData, dia_vencimento: parseInt(e.target.value) || 10})} 
                          />
                          <span className="absolute right-3 top-2.5 text-[10px] font-bold text-slate-400 uppercase">
                            todo dia
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500 mt-1 block">Dia do mês em que vence a fatura.</span>
                      </div>

                      {/* 2. Valor da Mensalidade */}
                      <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                        <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1">
                          <DollarSign size={13} className="text-emerald-600" />
                          Valor da Mensalidade (R$):
                        </label>
                        <input 
                          type="number" 
                          required 
                          step="0.01" 
                          className="w-full bg-white px-3 py-2 rounded-lg border border-slate-300 text-xs font-bold text-emerald-700 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                          value={formData.valor_mensalidade} 
                          onChange={e => setFormData({...formData, valor_mensalidade: parseFloat(e.target.value) || 0})} 
                        />
                        <span className="text-[11px] text-slate-500 mt-1 block">Valor cobrado mensalmente do cliente.</span>
                      </div>

                      {/* 3. WhatsApp que Recebe a Cobrança */}
                      <div className="p-3.5 bg-emerald-50/70 rounded-xl border border-emerald-200">
                        <label className="text-xs font-bold text-emerald-950 block mb-1 flex items-center gap-1">
                          <Phone size={13} className="text-emerald-600" />
                          WhatsApp que Recebe a Cobrança:
                        </label>
                        <input 
                          type="text" 
                          placeholder="Ex: 37999998888"
                          className="w-full bg-white px-3 py-2 rounded-lg border border-emerald-300 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none placeholder-slate-400"
                          value={formData.whatsapp_cobranca} 
                          onChange={e => setFormData({...formData, whatsapp_cobranca: e.target.value})} 
                        />
                        <span className="text-[11px] text-emerald-800 mt-1 block">
                          Receberá alertas prévios, link PIX e avisos de vencimento.
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Textarea de Executáveis Monitorados */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Lock size={14} className="text-rose-600" />
                        Arquivos .exe Monitorados (Para Bloqueio por Inadimplência)
                      </label>
                      <span className="text-[11px] text-slate-400">Um processo por linha</span>
                    </div>
                    <textarea 
                      rows={3} 
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 font-mono text-xs text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                      placeholder="pdv_mais.exe&#10;Paratech.exe&#10;vendas.exe&#10;gdoor.exe"
                      value={formData.exes_monitorados} 
                      onChange={e => setFormData({...formData, exes_monitorados: e.target.value})} 
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      O Hub Desktop monitora esses executáveis no computador do cliente e aplica encerramento caso a carência seja excedida.
                    </p>
                  </div>

                  {/* Prazos de Tolerância e Aviso */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Dias p/ Aviso Prévio</label>
                      <input 
                        type="number" 
                        required 
                        min="1" 
                        max="30" 
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold"
                        value={formData.dias_aviso_previo} 
                        onChange={e => setFormData({...formData, dias_aviso_previo: parseInt(e.target.value) || 7})} 
                      />
                      <span className="text-[11px] text-slate-400 mt-0.5 block">Exibe aviso X dias antes do vencimento</span>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Reaviso na Tela (Horas)</label>
                      <input 
                        type="number" 
                        required 
                        min="1" 
                        max="24" 
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold"
                        value={formData.intervalo_aviso_horas} 
                        onChange={e => setFormData({...formData, intervalo_aviso_horas: parseInt(e.target.value) || 4})} 
                      />
                      <span className="text-[11px] text-slate-400 mt-0.5 block">Reapresenta na tela a cada X horas</span>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Dias de Carência / Bloqueio</label>
                      <input 
                        type="number" 
                        required 
                        min="0" 
                        max="60" 
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-rose-700"
                        value={formData.dias_tolerancia_bloqueio} 
                        onChange={e => setFormData({...formData, dias_tolerancia_bloqueio: parseInt(e.target.value) || 0})} 
                      />
                      <span className="text-[11px] text-slate-400 mt-0.5 block">Tolerância após o vencimento antes de travar</span>
                    </div>
                  </div>

                  {/* Mensagens de Notificação */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Mensagem de Aviso Prévio na Tela</label>
                      <textarea 
                        rows={2} 
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                        placeholder="AVISO DE VENCIMENTO: Sua mensalidade vence em breve..."
                        value={formData.mensagem_aviso_previo} 
                        onChange={e => setFormData({...formData, mensagem_aviso_previo: e.target.value})} 
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Mensagem de Bloqueio na Tela</label>
                      <textarea 
                        rows={2} 
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                        placeholder="SISTEMA BLOQUEADO. Por favor, regularize seu pagamento."
                        value={formData.mensagem_bloqueio} 
                        onChange={e => setFormData({...formData, mensagem_bloqueio: e.target.value})} 
                      />
                    </div>
                  </div>

                  {/* Trava de Suspensão de XML */}
                  <div className="p-3.5 bg-rose-50 rounded-xl border border-rose-200 flex items-start gap-3">
                    <input 
                      type="checkbox" 
                      id="bloquear_recepcao_xml_se_inadimplente"
                      checked={Boolean(formData.bloquear_recepcao_xml_se_inadimplente)}
                      onChange={e => setFormData({ ...formData, bloquear_recepcao_xml_se_inadimplente: e.target.checked })}
                      className="mt-1 h-4 w-4 rounded border-rose-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                    />
                    <label htmlFor="bloquear_recepcao_xml_se_inadimplente" className="cursor-pointer select-none">
                      <span className="font-bold text-slate-900 block text-xs">
                        Suspender Recepção de XMLs em caso de Inadimplência
                      </span>
                      <span className="text-[11px] text-slate-600 leading-relaxed block mt-0.5">
                        Se marcado, o Hub Desktop receberá recusa (HTTP 403) no envio de novos XMLs caso o cliente esteja com fatura vencida além da carência.
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Botão Salvar Todas as Configurações */}
              <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={saving}
                  className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold py-3.5 rounded-xl transition shadow-md disabled:opacity-50 text-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  {saving ? (
                    <>
                      <RefreshCw size={18} className="animate-spin" />
                      Salvando Configurações no Banco...
                    </>
                  ) : (
                    <>
                      <Check size={18} />
                      Salvar Regras do Hub, Pontos de Partida e Cobrança
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </form>
      )}

      {/* Tabela de Hubs Ativos */}
      {!selectedCliente && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 mt-8 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div>
              <h3 className="font-semibold text-lg text-slate-800">Hubs Ativos (Monitoramento)</h3>
              <p className="text-xs text-slate-500">Acompanhamento em tempo real de conexão, versões instaladas e comandos remotos</p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm">
              <span className="flex items-center gap-1.5 font-medium text-emerald-700">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span> Online (&lt; 15 min)
              </span>
              <span className="text-slate-300">•</span>
              <span className="flex items-center gap-1.5 font-medium text-rose-700">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Offline / Alerta
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-600 uppercase text-[11px] tracking-wider">
                  <ResizableSortableTh columnId="cliente" label="Cliente / Empresa" currentSortKey={sortKey} currentSortDirection={sortDirection} onSort={handleSort} width={columnWidths.cliente} onResize={handleResizeColumn} />
                  <ResizableSortableTh columnId="contraSenha" label="Contra-Senha (Offline)" currentSortKey={sortKey} currentSortDirection={sortDirection} onSort={handleSort} width={columnWidths.contraSenha} onResize={handleResizeColumn} />
                  <ResizableSortableTh columnId="ultimaSync" label="Última Conexão" currentSortKey={sortKey} currentSortDirection={sortDirection} onSort={handleSort} width={columnWidths.ultimaSync} onResize={handleResizeColumn} />
                  <ResizableSortableTh columnId="status" label="Status" currentSortKey={sortKey} currentSortDirection={sortDirection} onSort={handleSort} width={columnWidths.status} onResize={handleResizeColumn} />
                  <ResizableSortableTh columnId="versao" label="Versão Hub" currentSortKey={sortKey} currentSortDirection={sortDirection} onSort={handleSort} width={columnWidths.versao} onResize={handleResizeColumn} />
                  <th className="py-3 px-4 font-semibold text-center" style={{ width: columnWidths.acao }}>Comando Remoto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {hubsOrdenados.map((h: any) => {
                  const config = Array.isArray(h.configuracoes_hub) ? h.configuracoes_hub[0] : h.configuracoes_hub
                  const lastSync = config?.ultima_sincronizacao
                  const diffMin = lastSync ? Math.floor((now - new Date(lastSync).getTime()) / (1000 * 60)) : null
                  const isOnline = diffMin !== null && diffMin <= 15
                  const versaoHub = config?.versao_hub_instalada || 'Desconhecida'
                  const offlineSecret = config?.offline_secret || 'Não gerada'
                  const comandoPendente = config?.comando_remoto

                  return (
                    <tr key={h.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-800 block text-xs">{h.razao_social || h.nome_fantasia}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{h.cnpj}</span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-600 font-bold">
                        {offlineSecret}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {lastSync ? (
                          <div>
                            <span className="font-semibold block">{new Date(lastSync).toLocaleTimeString('pt-BR')}</span>
                            <span className="text-[10px] text-slate-400">{new Date(lastSync).toLocaleDateString('pt-BR')}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Nunca conectou</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {isOnline ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span> Online ({diffMin}m)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span> {diffMin !== null ? `Offline há ${diffMin}m` : 'Offline'}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                          {versaoHub}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleDispararComando(h.id, 'sync_imediato')}
                            disabled={loadingComandoId === h.id || Boolean(comandoPendente)}
                            className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 font-bold text-[11px] transition disabled:opacity-50"
                            title="Forçar sincronização de XMLs na próxima conexão"
                          >
                            Forçar Sync
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDispararComando(h.id, 'reiniciar_servico')}
                            disabled={loadingComandoId === h.id || Boolean(comandoPendente)}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 font-semibold text-[11px] transition disabled:opacity-50"
                            title="Reiniciar monitor de arquivos do Hub Desktop"
                          >
                            Reiniciar
                          </button>
                        </div>
                        {comandoPendente && (
                          <span className="text-[10px] text-amber-600 font-medium block mt-1">
                            Comando ({comandoPendente}) pendente...
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
