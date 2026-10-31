'use client'

import { useState, useEffect } from 'react'
import { Send, MessageCircle, AlertTriangle, CheckCircle2, Clock, ShieldAlert, Sparkles, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'

interface BotaoEnviarCobrancaWhatsAppProps {
  clienteId: string
  telefonePrincipal?: string
  nomeCliente?: string
}

export default function BotaoEnviarCobrancaWhatsApp({
  clienteId,
  telefonePrincipal,
  nomeCliente
}: BotaoEnviarCobrancaWhatsAppProps) {
  const [loading, setLoading] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [dadosCondicao, setDadosCondicao] = useState<any>(null)
  const [mostrarPrevia, setMostrarPrevia] = useState(false)
  const [ultimoDisparo, setUltimoDisparo] = useState<string | null>(null)

  const carregarCondicao = async () => {
    if (!clienteId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/clientes/${clienteId}/enviar-whatsapp`)
      const data = await res.json()
      if (res.ok && data.success) {
        setDadosCondicao(data)
      } else {
        console.warn('Aviso ao carregar condição da fatura:', data.error)
      }
    } catch (err) {
      console.error('Erro ao buscar condição da fatura:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarCondicao()
  }, [clienteId])

  const handleEnviarAgora = async () => {
    const telefoneDestino = (telefonePrincipal || dadosCondicao?.telefone || '').replace(/\D/g, '')

    if (!telefoneDestino || telefoneDestino.length < 10) {
      toast.error('Informe um WhatsApp válido no campo acima antes de enviar.', { duration: 4000 })
      return
    }

    setEnviando(true)
    const tId = toast.loading(`Enviando mensagem de cobrança (${dadosCondicao?.tituloCondicao || 'Cobrança'})...`)

    try {
      const res = await fetch(`/api/clientes/${clienteId}/enviar-whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telefone: telefoneDestino,
          destinatarioNome: nomeCliente
        })
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Falha ao disparar WhatsApp')
      }

      const agoraFormatado = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      setUltimoDisparo(agoraFormatado)
      toast.success(`Mensagem enviada com sucesso para ${telefoneDestino}! (${data.tituloCondicao})`, { id: tId, duration: 5000 })
      
      // Atualiza os dados
      carregarCondicao()
    } catch (err: any) {
      toast.error(`Erro no disparo: ${err.message}`, { id: tId, duration: 5000 })
    } finally {
      setEnviando(false)
    }
  }

  const getCondicaoBadge = (condicao: string) => {
    switch (condicao) {
      case 'bloqueado':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300">
            <ShieldAlert size={14} className="text-red-600" />
            Bloqueado por Inadimplência
          </span>
        )
      case 'atrasado_tolerancia':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
            <AlertTriangle size={14} className="text-amber-600" />
            Em Atraso (Na Tolerância)
          </span>
        )
      case 'vence_hoje':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-900 border border-yellow-300">
            <Clock size={14} className="text-yellow-700" />
            Vence Hoje (Lembrete)
          </span>
        )
      case 'a_vencer':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-900 border border-blue-300">
            <Sparkles size={14} className="text-blue-600" />
            Fatura Disponível (Pré-Vencimento)
          </span>
        )
      case 'pago':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
            <CheckCircle2 size={14} className="text-emerald-600" />
            Fatura Quitada (Em Dia)
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-300">
            Sem pendências
          </span>
        )
    }
  }

  const telAtual = telefonePrincipal || dadosCondicao?.telefone || ''

  return (
    <div className="md:col-span-2 lg:col-span-3 mt-4 p-5 rounded-2xl bg-gradient-to-br from-emerald-50/60 via-slate-50 to-blue-50/40 border-2 border-emerald-200 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-emerald-200/80">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-xs">
            <MessageCircle size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-slate-900">
                Disparo Instantâneo via WhatsApp (Régua de Cobrança)
              </h4>
              <button 
                type="button" 
                onClick={carregarCondicao} 
                disabled={loading}
                title="Recarregar condição da fatura"
                className="text-slate-400 hover:text-emerald-700 transition"
              >
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Envia imediatamente a mensagem personalizada correspondente à situação financeira atual do cliente.
            </p>
          </div>
        </div>

        {/* Badge da Condição Atual */}
        <div>
          {loading ? (
            <span className="text-xs text-slate-400 animate-pulse">Identificando fatura...</span>
          ) : (
            getCondicaoBadge(dadosCondicao?.condicao || '')
          )}
        </div>
      </div>

      {/* Resumo da Fatura & Destino */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-white p-3.5 rounded-xl border border-emerald-100">
        <div>
          <span className="text-slate-400 block font-medium">WhatsApp de Destino:</span>
          <span className="font-bold text-slate-800 font-mono text-sm">
            {telAtual ? telAtual : <span className="text-amber-600 font-normal">Preencha o WhatsApp acima</span>}
          </span>
        </div>
        <div>
          <span className="text-slate-400 block font-medium">Referência / Valor:</span>
          <span className="font-bold text-slate-800">
            {dadosCondicao?.competencia ? `Ref ${dadosCondicao.competencia} • ` : ''}
            <span className="text-emerald-700">{dadosCondicao?.valorFormatado || 'R$ 0,00'}</span>
          </span>
        </div>
        <div>
          <span className="text-slate-400 block font-medium">Vencimento Original:</span>
          <span className="font-bold text-slate-800">
            {dadosCondicao?.dataVencimento || '—'}
          </span>
        </div>
      </div>

      {/* Ações: Botão ENVIAR AGORA + Ver Prévia */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
        <button
          type="button"
          onClick={() => setMostrarPrevia(!mostrarPrevia)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-emerald-700 transition px-2 py-1 cursor-pointer"
        >
          {mostrarPrevia ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          <span>{mostrarPrevia ? 'Ocultar prévia da mensagem' : 'Ver prévia da mensagem com Pix'}</span>
        </button>

        <div className="flex items-center gap-3">
          {ultimoDisparo && (
            <span className="text-[11px] text-emerald-700 font-medium">
              ✓ Enviado hoje às {ultimoDisparo}
            </span>
          )}

          <button
            type="button"
            onClick={handleEnviarAgora}
            disabled={enviando || loading}
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-sm hover:shadow transition disabled:opacity-50 cursor-pointer"
          >
            {enviando ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                <span>Enviando...</span>
              </>
            ) : (
              <>
                <Send size={16} />
                <span>ENVIAR AGORA</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Caixa de Prévia da Mensagem (Expansível) */}
      {mostrarPrevia && dadosCondicao?.mensagem && (
        <div className="p-4 bg-slate-900 text-slate-100 rounded-xl text-xs font-mono whitespace-pre-wrap leading-relaxed border border-slate-800 shadow-inner">
          <div className="text-[10px] uppercase font-bold text-emerald-400 mb-2 border-b border-slate-800 pb-1">
            Modelo: {dadosCondicao.modelo} ({dadosCondicao.motivo})
          </div>
          {dadosCondicao.mensagem}
        </div>
      )}
    </div>
  )
}
