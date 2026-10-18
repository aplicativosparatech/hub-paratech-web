'use client'

import React, { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { useRouter, usePathname } from 'next/navigation'
import { 
  X, Send, Sparkles, RotateCcw, 
  ArrowRight
} from 'lucide-react'
import { useGlobalClient } from './GlobalClientContext'

interface Message {
  id: string
  role: 'user' | 'robotech'
  content: string
  timestamp: string
  actions?: {
    type: 'navigate' | 'whatsapp'
    url: string
    label: string
  }[]
}

const PERGUNTAS_RAPIDAS = [
  { label: '📊 Relatório de Monofásicos', prompt: 'Como emito os relatórios de monofásicos?' },
  { label: '💰 Vendas no Pix por NFC-e', prompt: 'Quanto emiti de vendas no pix por nfce?' },
  { label: '💳 Valor e Vencimento da Fatura', prompt: 'Qual o valor da minha fatura e qual o vencimento?' },
  { label: '📞 Falar com Suporte Paratech', prompt: 'Como entro em contato com a Paratech?' },
  { label: '🔍 Consultar nota na SEFAZ', prompt: 'Como faço para consultar uma nota fiscal diretamente na SEFAZ?' }
]

export default function RoboTechFloatingWidget() {
  const router = useRouter()
  const pathname = usePathname()
  const { selectedClienteId } = useGlobalClient()

  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Mensagem inicial de boas-vindas do RoboTech
  useEffect(() => {
    const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    setMessages([
      {
        id: 'msg-welcome',
        role: 'robotech',
        content: `Olá! Eu sou o **RoboTech**, seu assistente de inteligência artificial da **Paratech**! 🤖✨\n\nEstou aqui para tirar suas dúvidas, te ensinar o passo a passo da plataforma, consultar dados em tempo real ou te guiar até qualquer tela.\n\nComo posso te ajudar hoje?`,
        timestamp: hora
      }
    ])

    // Exibe balãozinho de dica flutuante por alguns segundos ao carregar
    const timer = setTimeout(() => {
      setShowTooltip(true)
    }, 2500)

    const hideTimer = setTimeout(() => {
      setShowTooltip(false)
    }, 10000)

    return () => {
      clearTimeout(timer)
      clearTimeout(hideTimer)
    }
  }, [])

  // Auto-scroll para a última mensagem
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      setTimeout(() => inputRef.current?.focus(), 150)
    }
  }, [messages, isThinking, isOpen])

  // Parser das ações especiais geradas pelo RoboTech [ACTION:NAVIGATE|url|label]
  const parseActions = (text: string) => {
    const actions: { type: 'navigate' | 'whatsapp', url: string, label: string }[] = []
    let cleanedText = text

    const regex = /\[ACTION:(NAVIGATE|WHATSAPP)\|([^\|]+)\|([^\]]+)\]/g
    let match
    while ((match = regex.exec(text)) !== null) {
      actions.push({
        type: match[1].toLowerCase() as any,
        url: match[2],
        label: match[3]
      })
    }

    cleanedText = cleanedText.replace(/\[ACTION:(NAVIGATE|WHATSAPP)\|[^\|]+\|[^\]]+\]/g, '').trim()

    return { cleanedText, actions }
  }

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim()
    if (!text || isThinking) return

    const now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: now
    }

    setMessages(prev => [...prev, userMsg])
    setInputMessage('')
    setIsThinking(true)

    try {
      const historyPayload = messages.slice(-6).map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        content: m.content
      }))

      let rawResponse = ''
      try {
        const response = await fetch('/api/botech/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            history: historyPayload,
            context: {
              clienteId: selectedClienteId || undefined,
              pathname
            }
          })
        })

        if (response.ok) {
          const data = await response.json().catch(() => null)
          rawResponse = data?.resposta || ''
        }
      } catch (fetchErr) {
        console.warn('Oscilação temporária de conexão com RoboTech:', fetchErr)
      }

      if (!rawResponse) {
        rawResponse = `Desculpe, tive uma oscilação momentânea ao consultar a inteligência artificial, mas estou à disposição!\n\nVocê pode me perguntar novamente ou entrar em contato direto com o suporte:\n\n[ACTION:WHATSAPP|https://wa.me/5537920007857?text=Ola%20RoboTech%20estou%20com%20duvidas%20no%20Hub%20Paratech|📲 Falar com Suporte Técnico no WhatsApp]`
      }

      const { cleanedText, actions } = parseActions(rawResponse)

      const robotechMsg: Message = {
        id: `robotech-${Date.now()}`,
        role: 'robotech',
        content: cleanedText,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        actions: actions.length > 0 ? actions : undefined
      }

      setMessages(prev => [...prev, robotechMsg])
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: `robotech-err-${Date.now()}`,
          role: 'robotech',
          content: 'Desculpe, tive uma instabilidade momentânea. Pode tentar novamente em instantes ou falar com nosso suporte!',
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        }
      ])
    } finally {
      setIsThinking(false)
    }
  }

  const handleResetChat = () => {
    const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    setMessages([
      {
        id: `msg-reset-${Date.now()}`,
        role: 'robotech',
        content: `Conversa reiniciada! Como posso te ajudar agora? 🤖`,
        timestamp: hora
      }
    ])
  }

  const handleExecuteAction = (action: { type: 'navigate' | 'whatsapp', url: string, label: string }) => {
    if (action.type === 'navigate') {
      router.push(action.url)
    } else if (action.type === 'whatsapp') {
      window.open(action.url, '_blank')
    }
  }

  // Renderizador simplificado e seguro de Markdown
  const renderMarkdown = (text: string) => {
    const lines = text.split('\n')
    return (
      <div className="space-y-1.5 text-xs sm:text-sm leading-relaxed">
        {lines.map((line, idx) => {
          let formattedLine = line

          // Cabeçalhos ###
          if (formattedLine.startsWith('### ')) {
            return (
              <h4 key={idx} className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base mt-2 mb-1 flex items-center gap-1.5">
                {formattedLine.replace('### ', '')}
              </h4>
            )
          }

          // Listas com marcadores (-)
          if (formattedLine.startsWith('- ') || formattedLine.startsWith('* ')) {
            return (
              <p key={idx} className="pl-2 flex items-start gap-1.5 text-slate-700 dark:text-slate-300">
                <span className="text-blue-500 font-bold shrink-0">•</span>
                <span>{renderBold(formattedLine.replace(/^[-*]\s+/, ''))}</span>
              </p>
            )
          }

          // Linha em branco
          if (!formattedLine.trim()) {
            return <div key={idx} className="h-1.5" />
          }

          return (
            <p key={idx} className="text-slate-800 dark:text-slate-200">
              {renderBold(formattedLine)}
            </p>
          )
        })}
      </div>
    )
  }

  const renderBold = (str: string) => {
    const parts = str.split(/(\*\*.*?\*\*)/g)
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-bold text-slate-900 dark:text-white">{part.slice(2, -2)}</strong>
      }
      return part
    })
  }

  return (
    <>
      {/* Botão Flutuante (FAB) do RoboTech */}
      <div className="fixed bottom-12 sm:bottom-14 right-4 sm:right-6 z-50 flex items-center gap-3">
        {/* Balãozinho de Dica (Tooltip) com Saudação */}
        {showTooltip && !isOpen && (
          <div 
            onClick={() => { setIsOpen(true); setShowTooltip(false) }}
            className="animate-in fade-in slide-in-from-right-4 duration-300 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-4 py-2.5 rounded-2xl shadow-xl border border-blue-200 dark:border-blue-900/60 cursor-pointer flex items-center gap-2.5 max-w-xs group hover:scale-102 transition"
          >
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
            <p className="text-xs font-medium leading-snug">
              Dúvidas fiscais ou sobre o sistema? <strong className="text-blue-600 dark:text-blue-400 font-bold">Fale com o RoboTech!</strong>
            </p>
            <button 
              onClick={(e) => { e.stopPropagation(); setShowTooltip(false) }}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded-full"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Botão Redondo com a Logo do RoboTech */}
        <button
          onClick={() => { setIsOpen(!isOpen); setShowTooltip(false) }}
          className={`relative p-1 rounded-full transition-all duration-300 transform shadow-2xl focus:outline-none cursor-pointer group ${
            isOpen 
              ? 'scale-90 rotate-90 bg-slate-800' 
              : 'hover:scale-108 active:scale-95 bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-400 hover:shadow-blue-500/50'
          }`}
          title="Abrir Assistente Inteligente RoboTech"
          aria-label="Abrir RoboTech"
        >
          <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden border-2 border-white/80 dark:border-slate-800 shadow-inner bg-[#020b18] flex items-center justify-center p-0.5">
            {isOpen ? (
              <X className="text-white w-7 h-7" />
            ) : (
              <img 
                src="/robotech.png" 
                alt="RoboTech" 
                className="w-full h-full object-cover rounded-full group-hover:scale-108 transition duration-300"
              />
            )}
          </div>

          {/* Badge Online Verde Pulsante */}
          {!isOpen && (
            <span className="absolute top-0 right-0 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-white dark:border-slate-900"></span>
            </span>
          )}
        </button>
      </div>

      {/* Janela de Chat Moderna do RoboTech */}
      {isOpen && (
        <div className="fixed bottom-28 sm:bottom-32 right-3 sm:right-6 w-[94vw] sm:w-[440px] h-[580px] max-h-[80vh] z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-200/90 dark:border-slate-800 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          
          {/* Cabeçalho do Chat */}
          <div className="p-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 text-white flex items-center justify-between shadow-md shrink-0">
            <div className="flex items-center gap-3">
              <div className="relative w-11 h-11 rounded-full overflow-hidden border-2 border-white/90 shadow-md bg-[#020b18] shrink-0 p-0.5">
                <img 
                  src="/robotech.png" 
                  alt="RoboTech" 
                  className="w-full h-full object-cover rounded-full"
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base tracking-wide flex items-center gap-1.5">
                    RoboTech
                  </h3>
                  <span className="text-[10px] uppercase font-black bg-white/20 text-white px-1.5 py-0.5 rounded-md backdrop-blur-xs">
                    IA PARATECH
                  </span>
                </div>
                <p className="text-xs text-blue-100 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                  Assistente Fiscal & Operacional
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button 
                onClick={handleResetChat}
                className="p-1.5 text-blue-100 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
                title="Reiniciar Conversa"
              >
                <RotateCcw size={17} />
              </button>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-blue-100 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
                title="Minimizar Chat"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Área de Histórico de Mensagens em Balõezinhos */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3.5 custom-scrollbar bg-slate-50/60 dark:bg-slate-950/40">
            
            {messages.map((msg) => (
              <div 
                key={msg.id}
                className={`flex gap-2.5 items-end ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {/* Avatar miniatura do RoboTech */}
                {msg.role === 'robotech' && (
                  <div className="relative w-8 h-8 rounded-full overflow-hidden border border-blue-400 shadow-xs bg-[#020b18] shrink-0 mb-1 p-0.5">
                    <img src="/robotech.png" alt="RoboTech" className="w-full h-full object-cover rounded-full" />
                  </div>
                )}

                {/* Balãozinho de Mensagem */}
                <div className={`max-w-[84%] flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div 
                    className={`p-3.5 rounded-2xl shadow-xs transition-all ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white rounded-br-xs'
                        : 'bg-white dark:bg-slate-800/90 text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700/80 rounded-bl-xs'
                    }`}
                  >
                    {msg.role === 'user' ? (
                      <p className="text-xs sm:text-sm font-medium leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    ) : (
                      renderMarkdown(msg.content)
                    )}

                    {/* Botões de Ação Interativa ("Guiar até lá") */}
                    {msg.actions && msg.actions.length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-700/70 space-y-2">
                        {msg.actions.map((act, aIdx) => (
                          <button
                            key={aIdx}
                            onClick={() => handleExecuteAction(act)}
                            className={`w-full py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-between transition cursor-pointer shadow-xs ${
                              act.type === 'whatsapp'
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white'
                            }`}
                          >
                            <span className="flex items-center gap-1.5">{act.label}</span>
                            <ArrowRight size={14} />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 px-1">
                    {msg.timestamp}
                  </span>
                </div>
              </div>
            ))}

            {/* Balãozinho Animado de "Pensando..." */}
            {isThinking && (
              <div className="flex gap-2.5 items-end justify-start animate-in fade-in duration-200">
                <div className="relative w-8 h-8 rounded-full overflow-hidden border border-blue-400 shadow-xs bg-[#020b18] shrink-0 mb-1 p-0.5">
                  <img src="/robotech.png" alt="RoboTech" className="w-full h-full object-cover rounded-full" />
                </div>
                <div className="bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 p-3.5 rounded-2xl rounded-bl-xs shadow-xs max-w-[80%] flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 rounded-full bg-sky-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium italic">
                    RoboTech está pensando e consultando dados...
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Chips de Perguntas Rápidas */}
          <div className="px-3 py-2 bg-slate-100/90 dark:bg-slate-900/90 border-t border-slate-200/70 dark:border-slate-800 shrink-0">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar text-[11px]">
              <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider shrink-0 mr-1 flex items-center gap-1">
                <Sparkles size={11} className="text-blue-500" /> Sugestões:
              </span>
              {PERGUNTAS_RAPIDAS.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(item.prompt)}
                  disabled={isThinking}
                  className="shrink-0 bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-full font-medium transition cursor-pointer disabled:opacity-50"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Barra de Entrada (Input) */}
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSendMessage() }}
            className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2 shrink-0"
          >
            <input 
              ref={inputRef}
              type="text"
              value={inputMessage}
              onChange={e => setInputMessage(e.target.value)}
              placeholder="Pergunte ao RoboTech (ex: emitir monofásicos, vendas pix...)"
              disabled={isThinking}
              className="flex-1 bg-slate-100 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 placeholder-slate-400 text-xs sm:text-sm px-4 py-2.5 rounded-xl border border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition"
            />
            <button
              type="submit"
              disabled={!inputMessage.trim() || isThinking}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white p-2.5 rounded-xl transition shadow-xs hover:shadow-md flex items-center justify-center shrink-0 cursor-pointer"
              title="Enviar mensagem"
            >
              <Send size={16} />
            </button>
          </form>

        </div>
      )}
    </>
  )
}
