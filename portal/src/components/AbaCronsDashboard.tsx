'use client'

import React, { useState, useEffect } from 'react'
import {
  Clock,
  Play,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RotateCw,
  Plus,
  Server,
  Zap,
  Calendar,
  Layers,
  ShieldCheck,
  FileText,
  DollarSign,
  MessageSquare,
  Sparkles,
  ExternalLink,
  ChevronRight
} from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/utils/supabase/client'

export interface CronItem {
  id: string
  provedor: string
  tipo: string
  is_ativo: boolean
  updated_at?: string
  credenciais: {
    nome?: string
    categoria?: string
    endpoint?: string
    schedule?: string
    horario_amigavel?: string
    descricao?: string
    permite_disparo_manual?: boolean
  }
}

interface AbaCronsDashboardProps {
  onCronToggled?: (provedor: string, novoEstado: boolean) => void
}

export default function AbaCronsDashboard({ onCronToggled }: AbaCronsDashboardProps) {
  const supabase = createClient()
  const [crons, setCrons] = useState<CronItem[]>([])
  const [loading, setLoading] = useState(true)
  const [executandoId, setExecutandoId] = useState<string | null>(null)
  const [modalNovoAberto, setModalNovoAberto] = useState(false)

  // Form de novo cron futuro
  const [novoNome, setNovoNome] = useState('')
  const [novoEndpoint, setNovoEndpoint] = useState('/api/cron/')
  const [novoSchedule, setNovoSchedule] = useState('0 12 * * *')
  const [novoHorario, setNovoHorario] = useState('Diariamente às 09:00 (Brasília)')
  const [novaCategoria, setNovaCategoria] = useState('Sistema')
  const [novaDescricao, setNovaDescricao] = useState('')
  const [salvandoNovo, setSalvandoNovo] = useState(false)

  const carregarCrons = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('integracoes')
        .select('*')
        .eq('tipo', 'cron')
        .order('provedor', { ascending: true })

      if (error) throw error
      setCrons(data || [])
    } catch (err: any) {
      toast.error('Erro ao carregar lista de Crons: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarCrons()
  }, [])

  // Alterna estado do Cron (Ativo / Inativo)
  const handleToggleCron = async (cron: CronItem) => {
    const novoEstado = !cron.is_ativo
    const toastId = toast.loading(`${novoEstado ? 'Ativando' : 'Pausando'} rotina agendada...`)

    try {
      const { error } = await supabase
        .from('integracoes')
        .update({
          is_ativo: novoEstado,
          updated_at: new Date().toISOString()
        })
        .eq('id', cron.id)

      if (error) throw error

      // Se for o cron de WhatsApp (billing_alerts), sincroniza com configuracoes_portal_geral
      if (cron.provedor === 'billing_alerts') {
        await supabase
          .from('configuracoes_portal_geral')
          .update({ cron_whatsapp_ativo: novoEstado })
          .eq('id', 1)
      }

      setCrons(prev =>
        prev.map(c => (c.id === cron.id ? { ...c, is_ativo: novoEstado } : c))
      )

      toast.success(
        `Rotina "${cron.credenciais?.nome || cron.provedor}" ${novoEstado ? 'ativada' : 'pausada'} com sucesso!`,
        { id: toastId }
      )

      if (onCronToggled) {
        onCronToggled(cron.provedor, novoEstado)
      }
    } catch (err: any) {
      toast.error('Erro ao atualizar Cron: ' + err.message, { id: toastId })
    }
  }

  // Execução Manual Imediata
  const handleExecutarAgora = async (cron: CronItem) => {
    const endpoint = cron.credenciais?.endpoint
    if (!endpoint) {
      toast.error('Endpoint não configurado para este cron.')
      return
    }

    setExecutandoId(cron.id)
    const toastId = toast.loading(`Executando ${cron.credenciais?.nome || cron.provedor}...`)
    const inicio = performance.now()

    try {
      const url = `${endpoint}${endpoint.includes('?') ? '&' : '?'}forcar=true`
      const res = await fetch(url)
      const data = await res.json()
      const tempoMs = Math.round(performance.now() - inicio)

      if (res.ok && data.success) {
        toast.success(
          `Executado com sucesso em ${tempoMs}ms! ${data.message || ''}`,
          { id: toastId, duration: 6000 }
        )
      } else {
        throw new Error(data.error || data.message || 'Falha ao executar rotina.')
      }

      // Atualiza timestamp localmente
      setCrons(prev =>
        prev.map(c =>
          c.id === cron.id ? { ...c, updated_at: new Date().toISOString() } : c
        )
      )
    } catch (err: any) {
      toast.error(`Erro ao disparar cron: ${err.message}`, { id: toastId, duration: 7000 })
    } finally {
      setExecutandoId(null)
    }
  }

  // Cadastrar novo Cron futuro
  const handleCadastrarNovoCron = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!novoNome.trim() || !novoEndpoint.trim()) {
      toast.error('Nome e Endpoint são obrigatórios.')
      return
    }

    setSalvandoNovo(true)
    const toastId = toast.loading('Cadastrando nova rotina Cron...')

    try {
      const provedorKey = novoNome
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')

      const { data, error } = await supabase
        .from('integracoes')
        .insert({
          tipo: 'cron',
          provedor: provedorKey,
          is_ativo: true,
          credenciais: {
            nome: novoNome.trim(),
            categoria: novaCategoria,
            endpoint: novoEndpoint.trim(),
            schedule: novoSchedule.trim(),
            horario_amigavel: novoHorario.trim(),
            descricao: novaDescricao.trim(),
            permite_disparo_manual: true
          }
        })
        .select()
        .single()

      if (error) throw error

      setCrons(prev => [...prev, data])
      toast.success('Novo Cron cadastrado com sucesso!', { id: toastId })
      setModalNovoAberto(false)

      // Limpa campos
      setNovoNome('')
      setNovoEndpoint('/api/cron/')
      setNovaDescricao('')
    } catch (err: any) {
      toast.error('Erro ao cadastrar: ' + err.message, { id: toastId })
    } finally {
      setSalvandoNovo(false)
    }
  }

  // Estatísticas
  const totalCrons = crons.length
  const totalAtivos = crons.filter(c => c.is_ativo).length
  const totalPausados = totalCrons - totalAtivos

  const getCorCategoria = (cat?: string) => {
    switch ((cat || '').toLowerCase()) {
      case 'financeiro':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'whatsapp':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200'
      case 'fiscal':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200'
      case 'contábil erp':
        return 'bg-rose-100 text-rose-800 border-rose-200'
      case 'sefaz':
        return 'bg-amber-100 text-amber-800 border-amber-200'
      case 'tributário':
        return 'bg-purple-100 text-purple-800 border-purple-200'
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200'
    }
  }

  return (
    <div className="space-y-6">
      {/* 1. PAINEL DE ESTATÍSTICAS E CABEÇALHO */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 rounded-2xl p-6 sm:p-7 text-white shadow-xl border border-indigo-500/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 font-bold text-xs uppercase tracking-wider mb-2.5 border border-blue-400/30">
              <Clock size={14} /> Automações em Nuvem Vercel &amp; Hub Paratech
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
              Crons &amp; Rotinas Agendadas
            </h2>
            <p className="text-slate-300 text-sm mt-1.5 max-w-3xl leading-relaxed">
              Monitore, ative ou pause individualmente cada rotina periódica do Hub Paratech. Os crons executam em segundo plano na nuvem conforme os agendamentos registrados no <code>vercel.json</code>.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={carregarCrons}
              className="bg-white/10 hover:bg-white/20 text-white font-bold p-2.5 rounded-xl transition-all border border-white/20 cursor-pointer"
              title="Recarregar status dos crons"
            >
              <RotateCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              type="button"
              onClick={() => setModalNovoAberto(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4.5 py-2.5 rounded-xl transition-all shadow-md hover:shadow-lg flex items-center gap-2 text-sm cursor-pointer"
            >
              <Plus size={18} /> Novo Cron
            </button>
          </div>
        </div>

        {/* Métricas Rápidas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-white/10">
          <div className="bg-white/5 rounded-xl p-3.5 border border-white/10">
            <span className="text-xs text-slate-400 font-medium block">Total de Rotinas</span>
            <span className="text-2xl font-black text-white mt-1 block">{totalCrons}</span>
          </div>
          <div className="bg-white/5 rounded-xl p-3.5 border border-white/10">
            <span className="text-xs text-emerald-400 font-medium block">🟢 Ativos &amp; Operando</span>
            <span className="text-2xl font-black text-emerald-400 mt-1 block">{totalAtivos}</span>
          </div>
          <div className="bg-white/5 rounded-xl p-3.5 border border-white/10">
            <span className="text-xs text-slate-400 font-medium block">⚪ Pausados (Manual)</span>
            <span className="text-2xl font-black text-slate-300 mt-1 block">{totalPausados}</span>
          </div>
          <div className="bg-white/5 rounded-xl p-3.5 border border-white/10">
            <span className="text-xs text-blue-300 font-medium block">Hospedagem &amp; Gatilho</span>
            <span className="text-sm font-bold text-white mt-1 block truncate">Vercel Serverless</span>
          </div>
        </div>
      </div>

      {/* 2. LISTA EM CARDS INDIVIDUAIS DOS CRONS */}
      {loading ? (
        <div className="text-center py-12 text-slate-400 text-sm flex items-center justify-center gap-2">
          <RotateCw size={18} className="animate-spin text-blue-600" /> Carregando rotinas agendadas...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {crons.map(cron => {
            const cred = cron.credenciais || {}
            const isAtivo = cron.is_ativo
            const isRodando = executandoId === cron.id

            return (
              <div
                key={cron.id}
                className={`bg-white rounded-2xl p-6 border-2 transition-all duration-300 flex flex-col justify-between shadow-xs ${
                  isAtivo
                    ? 'border-slate-200 hover:border-blue-400 hover:shadow-md'
                    : 'border-slate-200/60 bg-slate-50/50 opacity-80'
                }`}
              >
                <div>
                  {/* Topo do Card */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span
                          className={`text-[11px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${getCorCategoria(
                            cred.categoria
                          )}`}
                        >
                          {cred.categoria || 'Geral'}
                        </span>
                        <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                          {cred.schedule || '0 * * * *'}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 leading-snug">
                        {cred.nome || cron.provedor}
                      </h3>
                    </div>

                    {/* Switch Ativo/Inativo */}
                    <div className="shrink-0 flex items-center gap-2">
                      <span
                        className={`text-xs font-bold ${
                          isAtivo ? 'text-emerald-700' : 'text-slate-400'
                        }`}
                      >
                        {isAtivo ? 'Ativo' : 'Pausado'}
                      </span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={isAtivo}
                          onChange={() => handleToggleCron(cron)}
                        />
                        <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                      </label>
                    </div>
                  </div>

                  {/* Descrição */}
                  <p className="text-xs text-slate-600 leading-relaxed mb-4">
                    {cred.descricao || 'Sem descrição cadastrada.'}
                  </p>

                  {/* Detalhes Técnicos */}
                  <div className="space-y-1.5 bg-slate-50 rounded-xl p-3 border border-slate-100 text-xs text-slate-600 mb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-medium">Horário / Frequência:</span>
                      <span className="font-semibold text-slate-800">
                        {cred.horario_amigavel || cred.schedule || 'Horário agendado'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-medium">Endpoint Rota:</span>
                      <code className="text-[11px] font-mono text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                        {cred.endpoint || '/api/cron/'}
                      </code>
                    </div>
                    {cron.updated_at && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-medium">Última atualização:</span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          {new Date(cron.updated_at).toLocaleString('pt-BR')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Ações Inferiores */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5 text-xs">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isAtivo ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                      }`}
                    />
                    <span className="text-slate-500 text-[11px]">
                      {isAtivo ? 'Execução programada ligada' : 'Ignorará chamadas automáticas'}
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={isRodando}
                    onClick={() => handleExecutarAgora(cron)}
                    className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-2 rounded-xl transition-all shadow-xs hover:shadow-md flex items-center gap-1.5 text-xs disabled:opacity-50 cursor-pointer"
                  >
                    {isRodando ? (
                      <>
                        <RotateCw size={13} className="animate-spin text-blue-400" />
                        <span>Executando...</span>
                      </>
                    ) : (
                      <>
                        <Play size={13} className="fill-current text-emerald-400" />
                        <span>Executar Agora</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 3. MODAL DE CADASTRO DE NOVO CRON */}
      {modalNovoAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
              <Clock className="text-blue-600" size={20} /> Cadastrar Nova Rotina Cron
            </h3>
            <p className="text-xs text-slate-500 mb-5 leading-relaxed">
              Adicione um novo agendamento que será gerenciado e monitorado pelo Hub Paratech.
            </p>

            <form onSubmit={handleCadastrarNovoCron} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nome da Rotina</label>
                <input
                  type="text"
                  required
                  value={novoNome}
                  onChange={e => setNovoNome(e.target.value)}
                  placeholder="Ex: Conciliação Bancária Noturna"
                  className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Categoria</label>
                  <select
                    value={novaCategoria}
                    onChange={e => setNovaCategoria(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                  >
                    <option value="Financeiro">Financeiro</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Fiscal">Fiscal</option>
                    <option value="Contábil ERP">Contábil ERP</option>
                    <option value="SEFAZ">SEFAZ</option>
                    <option value="Tributário">Tributário</option>
                    <option value="Sistema">Sistema</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Schedule (Cron Expr)</label>
                  <input
                    type="text"
                    required
                    value={novoSchedule}
                    onChange={e => setNovoSchedule(e.target.value)}
                    placeholder="0 12 * * *"
                    className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Endpoint (Rota API)</label>
                <input
                  type="text"
                  required
                  value={novoEndpoint}
                  onChange={e => setNovoEndpoint(e.target.value)}
                  placeholder="/api/cron/sua-rotina"
                  className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Horário Amigável</label>
                <input
                  type="text"
                  value={novoHorario}
                  onChange={e => setNovoHorario(e.target.value)}
                  placeholder="Ex: Todo dia às 09:00 (Brasília)"
                  className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Descrição</label>
                <textarea
                  rows={2}
                  value={novaDescricao}
                  onChange={e => setNovaDescricao(e.target.value)}
                  placeholder="O que esta rotina faz quando disparada..."
                  className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalNovoAberto(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoNovo}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2 rounded-xl text-xs transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  {salvandoNovo ? 'Salvando...' : 'Salvar Cron'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
