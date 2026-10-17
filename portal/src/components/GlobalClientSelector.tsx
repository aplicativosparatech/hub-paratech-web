'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { 
  Building2, Search, X, Check, ChevronDown, 
  Phone, ShieldCheck, AlertCircle, Sparkles, Building
} from 'lucide-react'
import { useGlobalClient, ClienteItem } from './GlobalClientContext'
import { formatarCnpjCpf, limparDocumento } from '@/utils/cnpjAlfanumerico'

export default function GlobalClientSelector() {
  const { 
    userRole,
    clientes, 
    loadingClientes, 
    selectedClienteId, 
    selectedCliente, 
    setSelectedClienteId, 
    clearSelectedCliente,
    priorizarNomeFantasia
  } = useGlobalClient()

  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Atalho de Teclado Global: Ctrl + K ou Cmd + K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setIsOpen(prev => {
          const next = !prev
          if (next) {
            setTimeout(() => inputRef.current?.focus(), 50)
          }
          return next
        })
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  // Fecha o dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Filtragem inteligente multi-campo (Omnichannel)
  const clientesFiltrados = useMemo(() => {
    if (!searchTerm.trim()) return clientes

    const termo = searchTerm.toLowerCase().trim()
    const termoLimpo = limparDocumento(termo)

    return clientes.filter(cli => {
      const razao = (cli.razao_social || '').toLowerCase()
      const fantasia = (cli.nome_fantasia || '').toLowerCase()
      const cnpjRaw = (cli.cnpj || '').toLowerCase()
      const cnpjLimpo = limparDocumento(cli.cnpj || '')
      const whatsLimpo = limparDocumento(cli.whatsapp || '')
      const celLimpo = limparDocumento(cli.celular || '')
      const telLimpo = limparDocumento(cli.telefone || '')
      const cidade = (cli.cidade || '').toLowerCase()
      const uf = (cli.uf || '').toLowerCase()

      // 1. Busca por Razão Social ou Nome Fantasia
      if (razao.includes(termo) || fantasia.includes(termo)) return true

      // 2. Busca por CNPJ (formatado ou apenas dígitos)
      if (cnpjRaw.includes(termo) || (termoLimpo && cnpjLimpo.includes(termoLimpo))) return true

      // 3. Busca por Telefone / Celular / WhatsApp
      if (termoLimpo && (whatsLimpo.includes(termoLimpo) || celLimpo.includes(termoLimpo) || telLimpo.includes(termoLimpo))) return true

      // 4. Busca por Cidade ou Estado
      if (cidade.includes(termo) || uf.includes(termo)) return true

      return false
    })
  }, [clientes, searchTerm])

  const handleSelect = (id: string) => {
    setSelectedClienteId(id)
    setIsOpen(false)
    setSearchTerm('')
  }

  const getNomePrincipal = (cli: ClienteItem) => {
    if (priorizarNomeFantasia && cli.nome_fantasia) return cli.nome_fantasia
    return cli.razao_social || 'Sem Nome'
  }

  const getNomeSecundario = (cli: ClienteItem) => {
    if (priorizarNomeFantasia && cli.nome_fantasia) return cli.razao_social
    return cli.nome_fantasia || null
  }

  // Perfil Cliente: Apenas exibe o nome da sua própria empresa (travado e seguro)
  if (userRole === 'cliente') {
    return (
      <div className="flex items-center gap-2 bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 px-3 py-1.5 rounded-xl shadow-2xs">
        <Building2 size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />
        <div className="flex flex-col min-w-0">
          <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate max-w-[200px] sm:max-w-[280px]">
            {selectedCliente ? getNomePrincipal(selectedCliente) : 'Minha Empresa'}
          </span>
          {selectedCliente?.cnpj && (
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
              {formatarCnpjCpf(selectedCliente.cnpj)}
            </span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative z-30 flex items-center">
      
      {/* 1. ESTADO: CLIENTE SELECIONADO (PÍLULA COMPACTA E ELEGANTE) */}
      {selectedCliente ? (
        <div className="flex items-center gap-1.5 bg-blue-50/90 hover:bg-blue-100/70 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 border border-blue-200/90 dark:border-blue-800/70 rounded-xl p-1 pl-2.5 transition-all shadow-2xs group">
          <button
            type="button"
            onClick={() => {
              setIsOpen(prev => !prev)
              setTimeout(() => inputRef.current?.focus(), 50)
            }}
            className="flex items-center gap-2 text-left cursor-pointer outline-none"
            title="Clique para trocar de empresa (ou use Ctrl+K)"
          >
            <div className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
              <Building2 size={13} />
            </div>
            
            <div className="flex flex-col min-w-0 pr-1 max-w-[180px] sm:max-w-[260px] md:max-w-[320px]">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {getNomePrincipal(selectedCliente)}
                </span>
                {selectedCliente.regime_tributario && (
                  <span className="hidden xl:inline-block text-[9px] uppercase font-bold px-1.5 py-0.2 bg-blue-200/60 dark:bg-blue-900/80 text-blue-800 dark:text-blue-300 rounded border border-blue-300/40 dark:border-blue-700/50 shrink-0">
                    {selectedCliente.regime_tributario.replace('_', ' ')}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate">
                CNPJ: {formatarCnpjCpf(selectedCliente.cnpj)}
              </span>
            </div>

            <ChevronDown size={14} className="text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors ml-0.5" />
          </button>

          {/* Botão Limpar Filtro (Voltar para Todos / Nenhum) */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              clearSelectedCliente()
            }}
            title="Limpar filtro e voltar para Todos os Clientes"
            className="p-1 text-slate-400 hover:text-red-500 hover:bg-white dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        /* 2. ESTADO: NENHUM CLIENTE SELECIONADO (BARRA DE BUSCA RÁPIDA) */
        <button
          type="button"
          onClick={() => {
            setIsOpen(true)
            setTimeout(() => inputRef.current?.focus(), 50)
          }}
          className="flex items-center gap-2.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700/80 rounded-xl transition-all shadow-2xs cursor-pointer group text-xs font-medium"
          title="Pesquise por Nome Fantasia, Razão Social, CNPJ, Telefone ou Cidade (Atalho: Ctrl + K)"
        >
          <Search size={15} className="text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
          <span className="hidden sm:inline text-slate-700 dark:text-slate-300 font-medium">
            Filtrar Cliente <span className="text-slate-400 text-[11px] font-normal">(Razão, Fantasia, CNPJ, Celular...)</span>
          </span>
          <span className="sm:hidden text-slate-700 dark:text-slate-300 font-medium">
            Filtrar Cliente
          </span>
          
          <kbd className="hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-bold text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded shadow-2xs">
            Ctrl K
          </kbd>
        </button>
      )}

      {/* 3. DROPDOWN FLUTUANTE DE PESQUISA RÁPIDA */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-[340px] sm:w-[480px] md:w-[540px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          
          {/* Header do Dropdown com Input de Pesquisa */}
          <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40">
            <div className="relative flex items-center">
              <Search size={16} className="absolute left-3 text-slate-400 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por Razão, Fantasia, CNPJ, Celular, Cidade..."
                className="w-full pl-9 pr-8 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                autoFocus
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-0.5"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium mt-2 px-1">
              <span>{clientesFiltrados.length} empresas disponíveis</span>
              <span>Pressione <kbd className="bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded text-[9px] font-bold text-slate-600 dark:text-slate-300">Esc</kbd> para fechar</span>
            </div>
          </div>

          {/* Opção Rápida: Nenhum / Todos os Clientes */}
          <div className="p-2 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/30 dark:bg-slate-950/20">
            <button
              type="button"
              onClick={() => handleSelect('')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs transition cursor-pointer ${
                !selectedClienteId
                  ? 'bg-blue-600 text-white font-bold shadow-xs'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className={`p-1.5 rounded-lg ${!selectedClienteId ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}`}>
                  <Building size={14} />
                </div>
                <div>
                  <p className="font-bold">Nenhum Cliente (Visão Geral / Todos)</p>
                  <p className={`text-[10px] ${!selectedClienteId ? 'text-blue-100' : 'text-slate-400'}`}>
                    Exibe dados agregados de todas as empresas
                  </p>
                </div>
              </div>
              {!selectedClienteId && <Check size={16} className="text-white" />}
            </button>
          </div>

          {/* Lista Rolável de Clientes */}
          <div className="max-h-72 overflow-y-auto p-1.5 space-y-1 custom-scrollbar">
            {loadingClientes ? (
              <div className="py-8 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                Carregando lista de clientes...
              </div>
            ) : clientesFiltrados.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                <AlertCircle size={20} className="mx-auto mb-1.5 text-slate-300 dark:text-slate-600" />
                Nenhum cliente encontrado para <strong className="text-slate-600 dark:text-slate-300">&ldquo;{searchTerm}&rdquo;</strong>
              </div>
            ) : (
              clientesFiltrados.map((cli) => {
                const isSelected = selectedClienteId === cli.id
                const nomePrincipal = getNomePrincipal(cli)
                const nomeSecundario = getNomeSecundario(cli)
                const cnpjFormatado = formatarCnpjCpf(cli.cnpj)

                return (
                  <button
                    key={cli.id}
                    type="button"
                    onClick={() => handleSelect(cli.id)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition cursor-pointer group ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-950/60 border border-blue-300 dark:border-blue-800'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800/70 border border-transparent'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0 pr-2">
                      <div className={`mt-0.5 p-1.5 rounded-lg shrink-0 ${
                        isSelected 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:text-blue-600'
                      }`}>
                        <Building2 size={15} />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-xs font-bold truncate ${isSelected ? 'text-blue-900 dark:text-blue-200' : 'text-slate-900 dark:text-slate-100'}`}>
                            {nomePrincipal}
                          </p>
                          {cli.uf && (
                            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded shrink-0">
                              {cli.uf}
                            </span>
                          )}
                        </div>

                        {nomeSecundario && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            {nomeSecundario}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700/80">
                            {cnpjFormatado}
                          </span>

                          {cli.regime_tributario && (
                            <span className="text-[9px] uppercase font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/40 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                              {cli.regime_tributario.replace('_', ' ')}
                            </span>
                          )}

                          {(cli.whatsapp || cli.celular || cli.telefone) && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400">
                              <Phone size={10} />
                              {cli.whatsapp || cli.celular || cli.telefone}
                            </span>
                          )}

                          {cli.certificado_url && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-cyan-600 dark:text-cyan-400 font-medium" title="Certificado A1 Configurado">
                              <ShieldCheck size={11} />
                              A1
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {isSelected && (
                      <div className="shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xs">
                        <Check size={14} />
                      </div>
                    )}
                  </button>
                )
              })
            )}
          </div>

          {/* Footer Informativo */}
          <div className="p-2.5 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400 px-3">
            <span className="flex items-center gap-1">
              <Sparkles size={12} className="text-amber-500" />
              O cliente escolhido permanece ativo em todas as abas.
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
