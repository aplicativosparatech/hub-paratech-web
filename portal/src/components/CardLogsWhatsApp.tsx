'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { 
  MessageCircle, Send, CheckCircle2, AlertTriangle, Calendar, 
  Search, RefreshCw, Eye, ExternalLink, Copy, Check, Bot, Zap, User,
  Building2, Users, ShieldAlert, ArrowUpDown, X, Filter
} from 'lucide-react'
import toast from 'react-hot-toast'

interface WhatsAppLog {
  id: string
  created_at: string
  remetente: string
  destinatario_tipo: 'cliente' | 'contabilidade' | 'admin' | 'outro'
  destinatario_nome?: string | null
  destinatario_numero: string
  motivo: string
  modelo: string
  mensagem: string
  provedor?: string | null
  status: 'sucesso' | 'falha'
  erro?: string | null
  resposta_api?: any
  cliente_id?: string | null
  contabilidade_id?: string | null
  fatura_id?: string | null
}

interface Stats {
  total: number
  sucesso: number
  falha: number
  hoje: number
}

interface CardLogsWhatsAppProps {
  onDataLoaded?: (stats: Stats, cronAtivo: boolean) => void
}

export default function CardLogsWhatsApp({ onDataLoaded }: CardLogsWhatsAppProps) {
  const [logs, setLogs] = useState<WhatsAppLog[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, sucesso: 0, falha: 0, hoje: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<string>('todos')
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')
  const [selectedLog, setSelectedLog] = useState<WhatsAppLog | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const fetchLogs = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/whatsapp/logs?limit=200')
      const data = await res.json()
      if (data.success) {
        setLogs(data.logs || [])
        setStats(data.stats || { total: 0, sucesso: 0, falha: 0, hoje: 0 })
        if (onDataLoaded) {
          onDataLoaded(data.stats, data.cron_ativo)
        }
      } else {
        toast.error('Erro ao carregar registros de mensagens')
      }
    } catch (err: any) {
      toast.error('Falha na comunicação com o servidor: ' + err.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [])

  const copyToClipboard = (text: string, key: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    toast.success(`${label} copiado!`, { icon: '📋' })
    setTimeout(() => setCopiedKey(null), 2000)
  }

  const formatarTelefone = (numero: string) => {
    const limpo = numero.replace(/\D/g, '')
    if (limpo.length === 13 && limpo.startsWith('55')) {
      const ddd = limpo.substring(2, 4)
      const parte1 = limpo.substring(4, 9)
      const parte2 = limpo.substring(9)
      return `+55 (${ddd}) ${parte1}-${parte2}`
    }
    if (limpo.length === 11) {
      const ddd = limpo.substring(0, 2)
      const parte1 = limpo.substring(2, 7)
      const parte2 = limpo.substring(7)
      return `(${ddd}) ${parte1}-${parte2}`
    }
    return numero
  }

  const formatarData = (iso: string) => {
    try {
      const d = new Date(iso)
      return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    } catch {
      return iso
    }
  }

  const logsFiltrados = useMemo(() => {
    return logs.filter(log => {
      // Filtro tipo
      if (filtroTipo !== 'todos' && log.destinatario_tipo !== filtroTipo) {
        return false
      }
      // Filtro status
      if (filtroStatus !== 'todos' && log.status !== filtroStatus) {
        return false
      }
      // Busca texto
      if (searchTerm.trim()) {
        const termo = searchTerm.toLowerCase()
        const matchNome = (log.destinatario_nome || '').toLowerCase().includes(termo)
        const matchNum = (log.destinatario_numero || '').includes(termo)
        const matchMotivo = (log.motivo || '').toLowerCase().includes(termo)
        const matchModelo = (log.modelo || '').toLowerCase().includes(termo)
        const matchMsg = (log.mensagem || '').toLowerCase().includes(termo)
        if (!matchNome && !matchNum && !matchMotivo && !matchModelo && !matchMsg) {
          return false
        }
      }
      return true
    })
  }, [logs, filtroTipo, filtroStatus, searchTerm])

  const renderBadgeRemetente = (remetente: string) => {
    if (remetente.includes('Cron') || remetente.includes('Robô')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 text-purple-700 border border-purple-100 rounded-md text-xs font-semibold">
          <Bot size={13} className="text-purple-600" />
          Robô (Cron)
        </span>
      )
    }
    if (remetente.includes('Webhook') || remetente.includes('Sistema')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-100 rounded-md text-xs font-semibold">
          <Zap size={13} className="text-amber-600" />
          Webhook Pix
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-md text-xs font-semibold">
        <User size={13} className="text-blue-600" />
        Admin (Manual)
      </span>
    )
  }

  const renderBadgeDestinatario = (tipo: string, nome?: string | null) => {
    const isContab = tipo === 'contabilidade'
    const isAdmin = tipo === 'admin'
    return (
      <div className="flex flex-col">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-slate-900 text-sm truncate max-w-[220px]">
            {nome || 'Não identificado'}
          </span>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
            isContab 
              ? 'bg-indigo-100 text-indigo-700' 
              : isAdmin 
                ? 'bg-emerald-100 text-emerald-700' 
                : 'bg-blue-100 text-blue-700'
          }`}>
            {isContab ? 'Contabilidade' : isAdmin ? 'Admin' : 'Cliente'}
          </span>
        </div>
      </div>
    )
  }

  const renderBadgeMotivo = (motivo: string) => {
    let color = 'bg-slate-100 text-slate-700 border-slate-200'
    if (motivo.includes('Pré-Vencimento')) color = 'bg-blue-50 text-blue-700 border-blue-200'
    else if (motivo.includes('No Vencimento')) color = 'bg-amber-50 text-amber-700 border-amber-200'
    else if (motivo.includes('Atraso') || motivo.includes('Regressiva')) color = 'bg-red-50 text-red-700 border-red-200'
    else if (motivo.includes('Bloqueio')) color = 'bg-rose-100 text-rose-800 border-rose-300 font-bold'
    else if (motivo.includes('Certificado')) color = 'bg-teal-50 text-teal-700 border-teal-200'
    else if (motivo.includes('Pagamento')) color = 'bg-emerald-50 text-emerald-700 border-emerald-200'
    else if (motivo.includes('Fiscal')) color = 'bg-purple-50 text-purple-700 border-purple-200'

    return (
      <span className={`px-2 py-0.5 text-xs rounded-md border font-medium inline-block max-w-[180px] truncate ${color}`}>
        {motivo}
      </span>
    )
  }

  return (
    <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
      {/* Cabeçalho da Seção */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-sm">
            <MessageCircle size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              Registro de Mensagens Enviadas (WhatsApp Logs)
            </h3>
            <p className="text-sm text-slate-500 mt-0.5">
              Histórico em tempo real de todas as notificações enviadas para clientes e contabilidades.
            </p>
          </div>
        </div>

        <button
          onClick={fetchLogs}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
        >
          <RefreshCw size={16} className={isLoading ? 'animate-spin text-emerald-600' : ''} />
          Atualizar Lista
        </button>
      </div>

      {/* Cards de Contadores e Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total */}
        <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/80 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-blue-100/70 text-blue-600 flex items-center justify-center">
            <Send size={20} />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium block">Total Enviadas</span>
            <span className="text-2xl font-black text-slate-900">{stats.total}</span>
          </div>
        </div>

        {/* Sucessos */}
        <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/80 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-emerald-100/70 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium block">Entregues com Sucesso</span>
            <span className="text-2xl font-black text-emerald-600">{stats.sucesso}</span>
          </div>
        </div>

        {/* Falhas */}
        <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/80 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-rose-100/70 text-rose-600 flex items-center justify-center">
            <AlertTriangle size={20} />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium block">Falhas de Envio</span>
            <span className={`text-2xl font-black ${stats.falha > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
              {stats.falha}
            </span>
          </div>
        </div>

        {/* Hoje */}
        <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/80 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-purple-100/70 text-purple-600 flex items-center justify-center">
            <Calendar size={20} />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium block">Disparadas Hoje</span>
            <span className="text-2xl font-black text-purple-600">{stats.hoje}</span>
          </div>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-2">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por cliente, contabilidade, número ou motivo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Filtro Tipo */}
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className="px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          >
            <option value="todos">Todos os Destinatários</option>
            <option value="cliente">Apenas Clientes</option>
            <option value="contabilidade">Apenas Contabilidades</option>
            <option value="admin">Apenas Admin</option>
          </select>

          {/* Filtro Status */}
          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            className="px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          >
            <option value="todos">Todos os Status</option>
            <option value="sucesso">Somente Sucesso</option>
            <option value="falha">Somente Falhas</option>
          </select>
        </div>
      </div>

      {/* Tabela de Logs */}
      <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 font-semibold text-xs border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Data / Hora</th>
                <th className="py-3 px-4">Quem Enviou</th>
                <th className="py-3 px-4">Para Quem</th>
                <th className="py-3 px-4">Número WhatsApp</th>
                <th className="py-3 px-4">Motivo</th>
                <th className="py-3 px-4">Modelo</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-center">Mensagem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading && logs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-emerald-600" />
                    Carregando registro de mensagens...
                  </td>
                </tr>
              ) : logsFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <MessageCircle size={32} className="mx-auto mb-2 text-slate-300" />
                    Nenhuma mensagem encontrada para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                logsFiltrados.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Data/Hora */}
                    <td className="py-3.5 px-4 text-xs font-mono text-slate-500 whitespace-nowrap">
                      {formatarData(log.created_at)}
                    </td>

                    {/* Quem Enviou */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {renderBadgeRemetente(log.remetente)}
                    </td>

                    {/* Para Quem */}
                    <td className="py-3.5 px-4">
                      {renderBadgeDestinatario(log.destinatario_tipo, log.destinatario_nome)}
                    </td>

                    {/* Número */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 font-mono text-xs text-slate-700">
                        <span>{formatarTelefone(log.destinatario_numero)}</span>
                        <a
                          href={`https://wa.me/${log.destinatario_numero.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Abrir WhatsApp"
                          className="text-emerald-600 hover:text-emerald-700 p-0.5"
                        >
                          <ExternalLink size={13} />
                        </a>
                      </div>
                    </td>

                    {/* Motivo */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {renderBadgeMotivo(log.motivo)}
                    </td>

                    {/* Modelo */}
                    <td className="py-3.5 px-4 text-xs text-slate-700 font-medium whitespace-nowrap">
                      {log.modelo}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {log.status === 'sucesso' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-xs font-bold">
                          <CheckCircle2 size={13} />
                          Sucesso
                        </span>
                      ) : (
                        <span 
                          title={log.erro || 'Falha no disparo'}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-md text-xs font-bold cursor-help"
                        >
                          <AlertTriangle size={13} />
                          Falha
                        </span>
                      )}
                    </td>

                    {/* Ação Mensagem */}
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold shadow-2xs transition-all hover:scale-105"
                      >
                        <Eye size={13} className="text-emerald-600" />
                        Ver Texto
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Rodapé da Tabela com Contador */}
        <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 text-xs text-slate-500 flex justify-between items-center">
          <span>
            Exibindo <strong>{logsFiltrados.length}</strong> de <strong>{logs.length}</strong> registros carregados
          </span>
          <span className="text-[11px] text-slate-400">
            Atualizado automaticamente a cada envio
          </span>
        </div>
      </div>

      {/* Modal de Detalhes da Mensagem Enviada */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header do Modal */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <MessageCircle size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-base">Detalhes da Mensagem WhatsApp</h4>
                  <span className="text-xs text-slate-500">
                    {formatarData(selectedLog.created_at)} · {selectedLog.modelo}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Conteúdo do Modal */}
            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              {/* Metadados */}
              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                <div>
                  <span className="text-slate-400 block font-medium">Quem Enviou (Remetente):</span>
                  <span className="font-bold text-slate-800 mt-0.5 block">{selectedLog.remetente}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Destinatário:</span>
                  <span className="font-bold text-slate-800 mt-0.5 block">
                    {selectedLog.destinatario_nome || 'Não informado'} ({selectedLog.destinatario_tipo})
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Telefone / WhatsApp:</span>
                  <span className="font-bold text-slate-800 font-mono mt-0.5 block">
                    {formatarTelefone(selectedLog.destinatario_numero)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Motivo do Disparo:</span>
                  <span className="font-bold text-slate-800 mt-0.5 block">{selectedLog.motivo}</span>
                </div>
              </div>

              {/* Balão de Mensagem Estilo WhatsApp */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Texto Enviado ao Destinatário
                  </span>
                  <button
                    onClick={() => copyToClipboard(selectedLog.mensagem, 'modal_msg', 'Texto da mensagem')}
                    className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-semibold"
                  >
                    {copiedKey === 'modal_msg' ? <Check size={14} /> : <Copy size={14} />}
                    Copiar
                  </button>
                </div>

                <div className="bg-[#EFEAE2] p-4 rounded-xl border border-slate-200 shadow-inner">
                  <div className="bg-white p-3.5 rounded-lg rounded-tl-none shadow-xs border border-slate-200/60 max-w-lg">
                    <p className="text-xs text-slate-800 whitespace-pre-wrap font-sans leading-relaxed">
                      {selectedLog.mensagem}
                    </p>
                    <div className="text-[10px] text-slate-400 text-right mt-2 flex items-center justify-end gap-1 font-mono">
                      <span>{new Date(selectedLog.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                      <CheckCircle2 size={12} className={selectedLog.status === 'sucesso' ? 'text-emerald-600' : 'text-slate-400'} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Erro técnico caso tenha falhado */}
              {selectedLog.status === 'falha' && selectedLog.erro && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                  <div className="flex items-center gap-1.5 font-bold mb-1 text-rose-800">
                    <AlertTriangle size={15} />
                    Detalhes da Falha na API:
                  </div>
                  <pre className="font-mono text-[11px] bg-white p-2.5 rounded border border-rose-200 overflow-x-auto whitespace-pre-wrap">
                    {selectedLog.erro}
                  </pre>
                </div>
              )}
            </div>

            {/* Rodapé do Modal */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
              <a
                href={`https://wa.me/${selectedLog.destinatario_numero.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
              >
                <ExternalLink size={14} />
                Conversar no WhatsApp
              </a>
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
