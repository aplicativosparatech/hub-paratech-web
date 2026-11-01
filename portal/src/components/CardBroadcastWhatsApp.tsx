'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import {
  Send,
  Image as ImageIcon,
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Trash2,
  Upload,
  Search,
  CheckSquare,
  Square,
  StopCircle,
  RefreshCw,
  Sparkles,
  Info
} from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/utils/supabase/client'

interface ClienteDestinatario {
  id: string
  nome_fantasia: string | null
  razao_social: string
  nome_contato: string | null
  whatsapp: string | null
  whatsapp_cobranca: string | null
  nome_sistema_utilizado: string | null
  is_ativo: boolean
}

interface CardBroadcastWhatsAppProps {
  onDisparoConcluido?: () => void
}

export default function CardBroadcastWhatsApp({ onDisparoConcluido }: CardBroadcastWhatsAppProps) {
  const supabase = createClient()

  // Estados principais
  const [clientes, setClientes] = useState<ClienteDestinatario[]>([])
  const [loadingClientes, setLoadingClientes] = useState(true)
  const [busca, setBusca] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  // Conteúdo da mensagem
  const [mensagem, setMensagem] = useState('')
  const [imagemBase64, setImagemBase64] = useState<string | null>(null)
  const [imagemNome, setImagemNome] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Intervalo em segundos (5, 10, 15, 30)
  const [intervaloSegundos, setIntervaloSegundos] = useState<5 | 10 | 15 | 30>(15)

  // Execução e progresso
  const [isEnviando, setIsEnviando] = useState(false)
  const [cancelarEnvio, setCancelarEnvio] = useState(false)
  const cancelarRef = useRef(false)
  const [progresso, setProgresso] = useState<{
    total: number
    atual: number
    sucessos: number
    falhas: number
    clienteAtualNome: string
    tempoRestante: number
  }>({
    total: 0,
    atual: 0,
    sucessos: 0,
    falhas: 0,
    clienteAtualNome: '',
    tempoRestante: 0
  })

  // Carrega lista de clientes ativos
  const carregarClientes = async () => {
    setLoadingClientes(true)
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('id, razao_social, nome_fantasia, nome_contato, whatsapp, whatsapp_cobranca, nome_sistema_utilizado, is_ativo')
        .eq('is_ativo', true)
        .order('nome_fantasia', { ascending: true })

      if (error) throw error
      setClientes(data || [])
    } catch (err: any) {
      toast.error('Erro ao carregar clientes: ' + err.message)
    } finally {
      setLoadingClientes(false)
    }
  }

  useEffect(() => {
    carregarClientes()
  }, [])

  // Filtra clientes pelo Nome Fantasia ou Razão Social
  const clientesFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return clientes
    return clientes.filter(c => {
      const fant = (c.nome_fantasia || '').toLowerCase()
      const raz = (c.razao_social || '').toLowerCase()
      const sis = (c.nome_sistema_utilizado || '').toLowerCase()
      return fant.includes(termo) || raz.includes(termo) || sis.includes(termo)
    })
  }, [clientes, busca])

  // Obtém o número de WhatsApp válido do cliente
  const obterWhatsappCliente = (c: ClienteDestinatario): string => {
    const num = (c.whatsapp_cobranca || c.whatsapp || '').replace(/\D/g, '')
    return num
  }

  // Clientes selecionados com WhatsApp válido
  const clientesValidosSelecionados = useMemo(() => {
    return clientes.filter(c => selectedIds.includes(c.id) && obterWhatsappCliente(c).length >= 10)
  }, [clientes, selectedIds])

  // Manipulação de seleção
  const handleToggleCliente = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    )
  }

  const handleSelecionarTodos = () => {
    // Seleciona todos os clientes ativos que possuem WhatsApp cadastrado
    const idsComWpp = clientes
      .filter(c => obterWhatsappCliente(c).length >= 10)
      .map(c => c.id)
    setSelectedIds(idsComWpp)
    toast.success(`${idsComWpp.length} empresas com WhatsApp válido selecionadas!`)
  }

  const handleLimparSelecao = () => {
    setSelectedIds([])
  }

  // Upload e conversão de imagem para Base64
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione um arquivo de imagem válido (PNG, JPG, JPEG, WebP).')
      return
    }

    if (file.size > 8 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 8 MB.')
      return
    }

    setImagemNome(file.name)
    const reader = new FileReader()
    reader.onload = () => {
      setImagemBase64(reader.result as string)
      toast.success('Imagem carregada com sucesso!')
    }
    reader.onerror = () => {
      toast.error('Falha ao processar arquivo de imagem.')
    }
    reader.readAsDataURL(file)
  }

  const handleRemoverImagem = () => {
    setImagemBase64(null)
    setImagemNome('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Inserção de tags dinâmicas no texto
  const inserirTag = (tag: string) => {
    setMensagem(prev => prev + tag)
  }

  // Delay utilitário
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

  // Ação de Disparo em Massa
  const handleIniciarDisparo = async () => {
    if (clientesValidosSelecionados.length === 0) {
      toast.error('Selecione ao menos uma empresa com número de WhatsApp válido.')
      return
    }

    if (!mensagem.trim() && !imagemBase64) {
      toast.error('Informe uma mensagem de texto ou anexe uma imagem para o disparo.')
      return
    }

    const confirmar = window.confirm(
      `Deseja iniciar o envio em massa para ${clientesValidosSelecionados.length} empresa(s) com intervalo de ${intervaloSegundos}s entre cada mensagem?`
    )
    if (!confirmar) return

    setIsEnviando(true)
    setCancelarEnvio(false)
    cancelarRef.current = false

    const total = clientesValidosSelecionados.length
    let sucessos = 0
    let falhas = 0

    setProgresso({
      total,
      atual: 0,
      sucessos: 0,
      falhas: 0,
      clienteAtualNome: '',
      tempoRestante: total * intervaloSegundos
    })

    const toastId = toast.loading(`Iniciando envio para ${total} empresas...`)

    for (let i = 0; i < total; i++) {
      if (cancelarRef.current) {
        toast.error('Disparo em massa interrompido pelo Administrador.', { id: toastId })
        break
      }

      const cliente = clientesValidosSelecionados[i]
      const nomeFantasia = cliente.nome_fantasia || cliente.razao_social
      const nomeContato = cliente.nome_contato || nomeFantasia
      const nomeSistema = cliente.nome_sistema_utilizado || 'MEI Simples'
      const whatsapp = obterWhatsappCliente(cliente)

      setProgresso(prev => ({
        ...prev,
        atual: i + 1,
        clienteAtualNome: nomeFantasia,
        tempoRestante: (total - i) * intervaloSegundos
      }))

      // Substituição de variáveis dinâmicas no texto
      let textoFormatado = mensagem
        .replace(/\{fantasia\}/gi, nomeFantasia)
        .replace(/\{nome\}/gi, nomeContato)
        .replace(/\{empresa\}/gi, nomeFantasia)
        .replace(/\{sistema\}/gi, nomeSistema)

      try {
        const res = await fetch('/api/whatsapp/broadcast/enviar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clienteId: cliente.id,
            to: whatsapp,
            message: textoFormatado,
            mediaUrl: imagemBase64 || undefined,
            destinatarioNome: nomeFantasia
          })
        })

        const resData = await res.json()
        if (res.ok && resData.success) {
          sucessos++
        } else {
          falhas++
        }
      } catch (err) {
        falhas++
      }

      setProgresso(prev => ({
        ...prev,
        sucessos,
        falhas
      }))

      // Intervalo antes da próxima mensagem (exceto no último item)
      if (i < total - 1 && !cancelarRef.current) {
        await delay(intervaloSegundos * 1000)
      }
    }

    setIsEnviando(false)
    toast.success(
      `Disparo concluído! ${sucessos} mensagem(ns) enviada(s) com sucesso. ${falhas > 0 ? `${falhas} falha(s).` : ''}`,
      { id: toastId, duration: 6000 }
    )

    if (onDisparoConcluido) {
      onDisparoConcluido()
    }
  }

  const handlePararDisparo = () => {
    cancelarRef.current = true
    setCancelarEnvio(true)
    toast('Cancelando disparo após a mensagem atual...', { icon: '🛑' })
  }

  return (
    <div className="bg-gradient-to-r from-emerald-50/90 via-white to-teal-50/90 border-2 border-emerald-300 rounded-2xl p-6 sm:p-7 shadow-md flex flex-col justify-between">
      <div>
        {/* Cabeçalho */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs uppercase tracking-wide mb-2">
              <Sparkles size={14} /> Campanha &amp; Comunicados aos Clientes
            </div>
            <h3 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
              📢 Envio em Massa de Mensagens (WhatsApp)
            </h3>
            <p className="text-xs text-slate-600 mt-1 max-w-xl leading-relaxed">
              Dispare avisos, informativos e promoções para os clientes selecionados com texto personalizado, imagem anexa e intervalo anti-bloqueio.
            </p>
          </div>
        </div>

        {/* 1. SELEÇÃO DE EMPRESAS POR NOME FANTASIA */}
        <div className="bg-white/80 border border-emerald-200 rounded-xl p-4 mb-4 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
              <Users size={15} className="text-emerald-600" />
              Destinatários (Nome Fantasia da Empresa)
            </label>
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={handleSelecionarTodos}
                className="text-emerald-700 hover:text-emerald-800 font-bold hover:underline cursor-pointer flex items-center gap-1"
              >
                <CheckSquare size={13} /> Marcar Todos
              </button>
              <span className="text-slate-300">•</span>
              <button
                type="button"
                onClick={handleLimparSelecao}
                className="text-slate-500 hover:text-slate-700 font-medium hover:underline cursor-pointer flex items-center gap-1"
              >
                <Square size={13} /> Limpar
              </button>
            </div>
          </div>

          {/* Barra de busca de empresa */}
          <div className="relative mb-2.5">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Pesquisar por Nome Fantasia, Razão Social ou Sistema..."
              className="w-full bg-slate-50 border border-slate-200 pl-8.5 pr-3 py-1.5 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Lista com Scroll dos Clientes */}
          <div className="max-h-40 overflow-y-auto space-y-1 pr-1 border border-slate-100 rounded-lg p-1.5 bg-slate-50/50">
            {loadingClientes ? (
              <div className="text-center py-4 text-xs text-slate-400 flex items-center justify-center gap-2">
                <RefreshCw size={14} className="animate-spin text-emerald-600" /> Carregando lista de empresas...
              </div>
            ) : clientesFiltrados.length === 0 ? (
              <div className="text-center py-4 text-xs text-slate-400">
                Nenhuma empresa encontrada com o termo pesquisado.
              </div>
            ) : (
              clientesFiltrados.map(c => {
                const wpp = obterWhatsappCliente(c)
                const temWpp = wpp.length >= 10
                const isSelected = selectedIds.includes(c.id)

                return (
                  <div
                    key={c.id}
                    onClick={() => temWpp && handleToggleCliente(c.id)}
                    className={`flex items-center justify-between p-2 rounded-lg text-xs transition-all cursor-pointer select-none ${
                      isSelected
                        ? 'bg-emerald-100/90 border border-emerald-300 text-emerald-950 font-semibold'
                        : 'bg-white hover:bg-slate-100 border border-slate-200/60 text-slate-700'
                    } ${!temWpp ? 'opacity-50 cursor-not-allowed bg-slate-50' : ''}`}
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={!temWpp}
                        onChange={() => {}}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 shrink-0 pointer-events-none"
                      />
                      <div className="truncate">
                        <span className="font-bold text-slate-900">
                          {c.nome_fantasia || c.razao_social}
                        </span>
                        {c.nome_fantasia && c.razao_social && (
                          <span className="text-[10px] text-slate-500 ml-1.5 truncate">
                            ({c.razao_social})
                          </span>
                        )}
                        {c.nome_sistema_utilizado && (
                          <span className="ml-1.5 text-[9px] bg-indigo-50 text-indigo-700 font-semibold px-1.5 py-0.2 rounded border border-indigo-200">
                            {c.nome_sistema_utilizado}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      {temWpp ? (
                        <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                          {wpp}
                        </span>
                      ) : (
                        <span className="text-[9px] text-rose-500 bg-rose-50 px-1 py-0.5 rounded">
                          Sem WhatsApp
                        </span>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 px-1">
            <span>
              Total cadastrado: <strong>{clientes.length}</strong> empresas
            </span>
            <span className="font-semibold text-emerald-700">
              {selectedIds.length} selecionada(s) ({clientesValidosSelecionados.length} prontas para envio)
            </span>
          </div>
        </div>

        {/* 2. TEXTO DA MENSAGEM */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Mensagem de Texto
            </label>
            <div className="flex items-center gap-1 text-[11px]">
              <span className="text-slate-400">Variáveis:</span>
              <button
                type="button"
                onClick={() => inserirTag('{fantasia}')}
                className="bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer"
                title="Insere o Nome Fantasia da empresa"
              >
                +&#123;fantasia&#125;
              </button>
              <button
                type="button"
                onClick={() => inserirTag('{nome}')}
                className="bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer"
                title="Insere o Nome do Contato"
              >
                +&#123;nome&#125;
              </button>
              <button
                type="button"
                onClick={() => inserirTag('{sistema}')}
                className="bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer"
                title="Insere o Sistema Utilizado (Ex: MEI Simples)"
              >
                +&#123;sistema&#125;
              </button>
            </div>
          </div>
          <textarea
            rows={4}
            value={mensagem}
            onChange={e => setMensagem(e.target.value)}
            placeholder="Digite a mensagem que será enviada aos clientes... Use *negrito*, _itálico_ e as variáveis acima para personalizar cada envio."
            className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-sans shadow-2xs leading-relaxed"
          />
        </div>

        {/* 3. UPLOAD DE IMAGEM */}
        <div className="mb-4">
          <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block mb-1.5">
            Imagem em Anexo (Opcional)
          </label>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/png,image/jpeg,image/jpg,image/webp"
            className="hidden"
          />

          {imagemBase64 ? (
            <div className="flex items-center gap-3 p-2.5 bg-white border border-emerald-300 rounded-xl shadow-2xs">
              <img
                src={imagemBase64}
                alt="Preview do anexo"
                className="w-14 h-14 object-cover rounded-lg border border-slate-200 shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-800 truncate">{imagemNome || 'imagem_anexo.png'}</p>
                <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">✓ Imagem carregada e pronta para envio com legenda</p>
              </div>
              <button
                type="button"
                onClick={handleRemoverImagem}
                className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-all cursor-pointer shrink-0"
                title="Remover imagem"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-white/70 hover:bg-white rounded-xl p-3 flex items-center justify-center gap-2 text-xs font-semibold text-emerald-800 transition-all cursor-pointer"
            >
              <Upload size={16} className="text-emerald-600" />
              <span>Clique para anexar imagem da campanha (PNG, JPG, WebP até 8MB)</span>
            </button>
          )}
        </div>

        {/* 4. INTERVALO ENTRE OS ENVIOS (5, 10, 15, 30 segundos) */}
        <div className="mb-5 bg-white/90 border border-emerald-200 rounded-xl p-3.5 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
                <Clock size={15} className="text-emerald-600" />
                Intervalo entre os Envios
              </label>
              <span className="text-[11px] text-slate-500 block mt-0.5">
                Pausa anti-bloqueio entre cada mensagem enviada:
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {([5, 10, 15, 30] as const).map(seg => {
                const isSelected = intervaloSegundos === seg
                return (
                  <button
                    key={seg}
                    type="button"
                    disabled={isEnviando}
                    onClick={() => setIntervaloSegundos(seg)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-600 ring-offset-1'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                    }`}
                  >
                    {seg}s
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 5. BARRA DE PROGRESSO & BOTÃO DE DISPARO */}
      <div className="pt-2 border-t border-emerald-200/60">
        {isEnviando && (
          <div className="mb-3.5 p-3 bg-white rounded-xl border border-emerald-300 shadow-xs">
            <div className="flex items-center justify-between text-xs font-bold text-slate-800 mb-1.5">
              <span>
                Enviando: {progresso.atual} de {progresso.total} ({Math.round((progresso.atual / (progresso.total || 1)) * 100)}%)
              </span>
              <span className="text-emerald-700 flex items-center gap-1 font-mono">
                <Clock size={12} /> ~{progresso.tempoRestante}s restantes
              </span>
            </div>

            {/* Barra */}
            <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden mb-2">
              <div
                className="bg-emerald-600 h-full transition-all duration-300 rounded-full"
                style={{ width: `${Math.round((progresso.atual / (progresso.total || 1)) * 100)}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-600">
              <span className="truncate max-w-[240px]">
                Atual: <strong>{progresso.clienteAtualNome || 'Processando...'}</strong>
              </span>
              <div className="flex items-center gap-2">
                <span className="text-emerald-700 font-semibold">✓ {progresso.sucessos} sucesso(s)</span>
                {progresso.falhas > 0 && (
                  <span className="text-rose-600 font-semibold">✕ {progresso.falhas} falha(s)</span>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center gap-3">
          {isEnviando ? (
            <button
              type="button"
              onClick={handlePararDisparo}
              disabled={cancelarEnvio}
              className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold px-6 py-2.5 rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 text-sm cursor-pointer disabled:opacity-50"
            >
              <StopCircle size={18} /> {cancelarEnvio ? 'Interrompendo...' : 'Parar Disparo em Massa'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleIniciarDisparo}
              disabled={clientesValidosSelecionados.length === 0}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3 rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <Send size={18} />
              <span>
                Disparar Mensagem para {clientesValidosSelecionados.length} Empresa(s)
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
