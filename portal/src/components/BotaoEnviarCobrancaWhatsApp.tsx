'use client'

import { useState, useEffect } from 'react'
import {
  Send,
  MessageCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Sparkles,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  SlidersHorizontal,
  RotateCcw,
  ExternalLink,
  Edit3
} from 'lucide-react'
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
  const [situacaoSelecionada, setSituacaoSelecionada] = useState<string>('auto')
  const [mensagemEditavel, setMensagemEditavel] = useState<string>('')
  const [mensagemOriginal, setMensagemOriginal] = useState<string>('')
  const [mostrarPrevia, setMostrarPrevia] = useState(true) // aberta por padrão para conferência
  const [enviarImagemQrCode, setEnviarImagemQrCode] = useState(true)
  const [ultimoDisparo, setUltimoDisparo] = useState<string | null>(null)

  const carregarCondicao = async (situacao = situacaoSelecionada) => {
    if (!clienteId) return
    setLoading(true)
    try {
      const url = `/api/clientes/${clienteId}/enviar-whatsapp?situacao=${situacao}`
      const res = await fetch(url)
      const data = await res.json()
      if (res.ok && data.success) {
        setDadosCondicao(data)
        setMensagemEditavel(data.mensagem || '')
        setMensagemOriginal(data.mensagem || '')
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
    carregarCondicao('auto')
  }, [clienteId])

  const handleMudarSituacao = (novaSituacao: string) => {
    setSituacaoSelecionada(novaSituacao)
    carregarCondicao(novaSituacao)
  }

  const handleRestaurarMensagem = () => {
    setMensagemEditavel(mensagemOriginal)
    toast.success('Mensagem restaurada para o modelo padrão!')
  }

  const handleEnviarAgora = async () => {
    const telefoneDestino = (telefonePrincipal || dadosCondicao?.telefone || '').replace(/\D/g, '')

    if (!telefoneDestino || telefoneDestino.length < 10) {
      toast.error('Informe um WhatsApp válido no campo de contato antes de enviar.', { duration: 4000 })
      return
    }

    if (!mensagemEditavel.trim()) {
      toast.error('O texto da mensagem não pode estar vazio.', { duration: 3000 })
      return
    }

    setEnviando(true)
    const tId = toast.loading(`Enviando mensagem via WhatsApp (${dadosCondicao?.tituloCondicao || 'Cobrança'})...`)

    try {
      const res = await fetch(`/api/clientes/${clienteId}/enviar-whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telefone: telefoneDestino,
          mensagem: mensagemEditavel,
          situacao: situacaoSelecionada,
          enviarImagemQrCode,
          destinatarioNome: nomeCliente || dadosCondicao?.clienteNome || dadosCondicao?.empresaNome
        })
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Falha ao disparar WhatsApp')
      }

      const agoraFormatado = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      setUltimoDisparo(agoraFormatado)
      toast.success(`Mensagem enviada com sucesso para ${telefoneDestino}! (${data.tituloCondicao})`, { id: tId, duration: 5000 })
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
      case 'no_vencimento':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-900 border border-yellow-300">
            <Clock size={14} className="text-yellow-700" />
            Vence Hoje (Lembrete)
          </span>
        )
      case 'pre_vencimento':
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
      case 'abandono_pix':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-900 border border-purple-300">
            <MessageCircle size={14} className="text-purple-600" />
            Abandono de Pix
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
    <div className="md:col-span-2 lg:col-span-3 mt-4 p-5 rounded-2xl bg-gradient-to-br from-emerald-50/70 via-slate-50 to-blue-50/50 border-2 border-emerald-200 shadow-xs space-y-4">
      {/* Topo do Card */}
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
                onClick={() => carregarCondicao(situacaoSelecionada)}
                disabled={loading}
                title="Recarregar mensagem e condição da fatura"
                className="text-slate-400 hover:text-emerald-700 transition"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Personalize variáveis, simule qualquer situação da régua e envie imediatamente com link web e Pix Bacen oficial.
            </p>
          </div>
        </div>

        {/* Badge da Condição Real */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">Status Real:</span>
          {loading ? (
            <span className="text-xs text-slate-400 animate-pulse">Identificando fatura...</span>
          ) : (
            getCondicaoBadge(dadosCondicao?.condicaoReal || dadosCondicao?.condicao || '')
          )}
        </div>
      </div>

      {/* Seletor Interativo de Situação (Simular / Forçar Modelo) */}
      <div className="bg-white p-3.5 rounded-xl border border-emerald-200 shadow-2xs space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <SlidersHorizontal size={14} className="text-emerald-600" />
            Situação da Mensagem a Simular / Enviar:
          </label>
          <span className="text-[11px] text-slate-400">
            Alterne para testar qualquer situação ou modelo da régua
          </span>
        </div>

        <select
          value={situacaoSelecionada}
          onChange={(e) => handleMudarSituacao(e.target.value)}
          disabled={loading || enviando}
          className="w-full text-xs font-medium px-3 py-2 rounded-lg border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800"
        >
          <option value="auto">⚡ Condição Real Detectada (Automático conforme Vencimento)</option>
          <option value="pre_vencimento">1. Pré-Vencimento — Fatura Disponível (5 dias antes)</option>
          <option value="no_vencimento">2. No Vencimento — Lembrete de Vencimento (Hoje)</option>
          <option value="atrasado_tolerancia">3. Atraso & Regressiva — Cobrança Progressiva (Tolerância)</option>
          <option value="bloqueado">4. Bloqueio por Inadimplência — Sistema Bloqueado</option>
          <option value="pago">5. Ao Pagar (Cliente) — Confirmação de Quitação</option>
          <option value="abandono_pix">6. Abandono de Pix — Recuperação de Pagamento</option>
        </select>
      </div>

      {/* Resumo da Fatura & Variáveis Extraídas */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs bg-white p-3.5 rounded-xl border border-emerald-100">
        <div>
          <span className="text-slate-400 block font-medium">WhatsApp de Destino:</span>
          <span className="font-bold text-slate-800 font-mono text-sm">
            {telAtual ? telAtual : <span className="text-amber-600 font-normal">Preencha o WhatsApp acima</span>}
          </span>
        </div>
        <div>
          <span className="text-slate-400 block font-medium">[Cliente] / [Empresa]:</span>
          <span className="font-semibold text-slate-800 truncate block" title={`${dadosCondicao?.clienteNome || 'Cliente'} (${dadosCondicao?.empresaNome || ''})`}>
            {dadosCondicao?.clienteNome || 'Cliente'}
          </span>
          <span className="text-[10px] text-slate-400 truncate block">
            {dadosCondicao?.empresaNome || ''}
          </span>
        </div>
        <div>
          <span className="text-slate-400 block font-medium">[Fatura] / Valor:</span>
          <span className="font-bold text-slate-800 block">
            {dadosCondicao?.faturaCodigo || 'FAT-001'} • <span className="text-emerald-700">{dadosCondicao?.valorFormatado || 'R$ 0,00'}</span>
          </span>
          <span className="text-[10px] text-slate-400 block">
            Ref: {dadosCondicao?.competencia || '—'}
          </span>
        </div>
        <div>
          <span className="text-slate-400 block font-medium">Vencimento / Bloqueio:</span>
          <span className="font-bold text-slate-800 block">
            {dadosCondicao?.dataVencimento || '—'}
          </span>
          <span className="text-[10px] text-red-600 block">
            Bloqueio: {dadosCondicao?.dataBloqueio || '—'}
          </span>
        </div>
      </div>

      {/* Opção de Enviar Imagem do QR Code Anexa */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-white rounded-xl border border-emerald-100 text-xs">
        <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
          <input
            type="checkbox"
            checked={enviarImagemQrCode}
            onChange={(e) => setEnviarImagemQrCode(e.target.checked)}
            className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
          />
          <span>📸 Anexar imagem do QR Code Pix no WhatsApp (envio de mídia com legenda)</span>
        </label>
        <div className="flex items-center gap-2">
          {dadosCondicao?.linkQrCode && (
            <a
              href={dadosCondicao.linkQrCode}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200 transition"
            >
              <span>🖼️ Ver Imagem do QR Code</span>
              <ExternalLink size={10} />
            </a>
          )}
          {dadosCondicao?.linkFatura && (
            <a
              href={dadosCondicao.linkFatura}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 hover:text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 transition"
            >
              <span>📄 Ver Fatura Online</span>
              <ExternalLink size={10} />
            </a>
          )}
        </div>
      </div>

      {/* Controles da Prévia & Botão de Envio */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMostrarPrevia(!mostrarPrevia)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-emerald-700 transition px-2 py-1 cursor-pointer"
          >
            {mostrarPrevia ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            <span>{mostrarPrevia ? 'Ocultar editor de mensagem' : 'Ver e editar mensagem'}</span>
          </button>

          {mostrarPrevia && (
            <button
              type="button"
              onClick={handleRestaurarMensagem}
              title="Restaurar o texto padrão do modelo"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-emerald-600 transition"
            >
              <RotateCcw size={12} />
              <span>Restaurar Padrão</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {ultimoDisparo && (
            <span className="text-[11px] text-emerald-700 font-medium">
              ✓ Enviado às {ultimoDisparo}
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

      {/* Editor & Prévia da Mensagem (Editável) */}
      {mostrarPrevia && (
        <div className="p-4 bg-slate-900 text-slate-100 rounded-xl border border-slate-800 shadow-inner space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-emerald-400 border-b border-slate-800 pb-2">
            <span className="font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Edit3 size={12} />
              Modelo Ativo: {dadosCondicao?.modelo || 'Cobrança'} ({dadosCondicao?.motivo || 'Manual'})
            </span>
            <span className="text-slate-400 font-mono text-[10px]">
              Você pode editar o texto abaixo livremente antes do envio
            </span>
          </div>

          <textarea
            rows={10}
            value={mensagemEditavel}
            onChange={(e) => setMensagemEditavel(e.target.value)}
            disabled={loading || enviando}
            placeholder="A mensagem gerada aparecerá aqui..."
            className="w-full bg-slate-950 text-slate-100 p-3 rounded-lg border border-slate-800 text-xs font-mono leading-relaxed focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-y"
          />

          <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
            <span>{mensagemEditavel.length} caracteres • {mensagemEditavel.split('\n').length} linhas</span>
            <div className="flex items-center gap-3">
              {dadosCondicao?.linkQrCode && (
                <a
                  href={dadosCondicao.linkQrCode}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-emerald-400 hover:underline"
                >
                  <span>Ver Imagem QR Code</span>
                  <ExternalLink size={10} />
                </a>
              )}
              {dadosCondicao?.linkFatura && (
                <a
                  href={dadosCondicao.linkFatura}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-blue-400 hover:underline"
                >
                  <span>Testar Fatura Web</span>
                  <ExternalLink size={10} />
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
