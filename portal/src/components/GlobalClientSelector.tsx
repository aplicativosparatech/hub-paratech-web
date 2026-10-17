'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { 
  Building2, Search, X, Check, ChevronDown, 
  Phone, ShieldCheck, AlertCircle, Sparkles, Building, Store
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

  // Normalização de texto: remove acentos e caracteres especiais para busca instantânea e precisa
  const normalizar = (texto?: string | null) => {
    if (!texto) return ''
    return texto
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
  }

  // Filtragem inteligente multi-campo (Omnichannel)
  const clientesFiltrados = useMemo(() => {
    if (!searchTerm.trim()) return clientes

    const termo = normalizar(searchTerm)
    const termoLimpo = limparDocumento(searchTerm)

    return clientes.filter(cli => {
      const razao = normalizar(cli.razao_social)
      const fantasia = normalizar(cli.nome_fantasia)
      const cnpjRaw = (cli.cnpj || '').toLowerCase()
      const cnpjLimpo = limparDocumento(cli.cnpj || '')
      const whatsLimpo = limparDocumento(cli.whatsapp || '')
      const telLimpo = limparDocumento(cli.telefone || '')
      const cidade = normalizar(cli.cidade)
      const uf = normalizar(cli.uf)

      // 1. Busca por Razão Social ou Nome Fantasia (inclusive sem acentos)
      if (razao.includes(termo) || fantasia.includes(termo)) return true

      // 2. Busca por CNPJ (formatado ou apenas dígitos)
      if (cnpjRaw.includes(termo) || (termoLimpo && cnpjLimpo.includes(termoLimpo))) return true

      // 3. Busca por Telefone / WhatsApp
      if (termoLimpo && (whatsLimpo.includes(termoLimpo) || telLimpo.includes(termoLimpo))) return true

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

  // Perfil Cliente: Apenas exibe a sua empresa
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
    <div ref={containerRef} className="relative z-30 flex items-center gap-2">
      
      {/* 1. MOCKUP 1: ESTADO COM CLIENTE SELECIONADO */}
      {selectedCliente ? (
        <div className="flex items-center gap-2">
          {/* Pílula de Cliente Ativo conforme Mockup 1 */}
          <div className="flex items-center gap-2 bg-blue-50/90 hover:bg-blue-100/80 dark:bg-blue-950/50 dark:hover:bg-blue-900/60 border border-blue-200/90 dark:border-blue-800/80 rounded-xl px-3 py-1.5 shadow-2xs transition-all">
            <span className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[140px] sm:max-w-[220px] md:max-w-[300px]">
              {getNomePrincipal(selectedCliente)}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              • CNPJ {formatarCnpjCpf(selectedCliente.cnpj)}
            </span>
            {selectedCliente.regime_tributario && (
              <span className="hidden lg:inline text-[10px] font-bold text-blue-700 dark:text-blue-300">
                • {selectedCliente.regime_tributario.replace('_', ' ')}
              </span>
            )}
            
            {/* Botão X para desmarcar */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                clearSelectedCliente()
              }}
              title="Limpar filtro de cliente"
              className="ml-1 p-0.5 text-slate-400 hover:text-red-500 rounded cursor-pointer transition-colors"
            >
              <X size={13} />
            </button>
          </div>

          {/* Botão 'Trocar Cliente (Ctrl+K)' conforme Mockup 1 */}
          <button
            type="button"
            onClick={() => {
              setIsOpen(prev => !prev)
              setTimeout(() => inputRef.current?.focus(), 50)
            }}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 shadow-2xs cursor-pointer transition-colors"
            title="Trocar cliente (Atalho: Ctrl+K)"
          >
            <Search size={13} className="text-slate-400" />
            <span>Trocar Cliente</span>
            <kbd className="text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-900 px-1 py-0.2 rounded border border-slate-200 dark:border-slate-700">
              Ctrl+K
            </kbd>
          </button>
        </div>
      ) : (
        /* 2. MOCKUP 2: ESTADO SEM CLIENTE SELECIONADO (BARRA DE BUSCA COMPLETA) */
        <div 
          onClick={() => {
            setIsOpen(true)
            setTimeout(() => inputRef.current?.focus(), 50)
          }}
          className="flex items-center gap-2.5 px-3.5 py-1.5 bg-white dark:bg-slate-800 border-2 border-blue-500/80 rounded-xl shadow-xs cursor-pointer min-w-[260px] sm:min-w-[340px] md:min-w-[420px] transition-all"
        >
          <Search size={16} className="text-slate-400 shrink-0" />
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate flex-1">
            Buscar cliente por Nome, Razão Social, CNPJ ou Celular...
          </span>
          <kbd className="hidden sm:inline text-[10px] font-mono font-bold text-slate-400 bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 shrink-0">
            Ctrl+K
          </kbd>
        </div>
      )}

      {/* 3. MOCKUP 2: DROPDOWN FLUTUANTE DE PESQUISA COM CARDS COMPLETOS */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-[340px] sm:w-[480px] md:w-[540px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150 z-50">
          
          {/* Header do Dropdown com Input de Pesquisa Rápida */}
          <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40">
            <div className="relative flex items-center">
              <Search size={16} className="absolute left-3 text-slate-400 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por Nome, Razão Social, CNPJ, Celular..."
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
          </div>

          {/* Opção Topo do Mockup 2: 'Todos os Clientes / Limpar Filtro' */}
          <div className="p-2 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/40 dark:bg-slate-950/20">
            <button
              type="button"
              onClick={() => handleSelect('')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs transition cursor-pointer ${
                !selectedClienteId
                  ? 'bg-blue-600 text-white font-bold shadow-xs'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">≡</span>
                <span>Todos os Clientes / Limpar Filtro</span>
              </div>
              {!selectedClienteId && <Check size={16} className="text-white" />}
            </button>
          </div>

          {/* Lista Rolável de Cards de Clientes (Fiel ao Mockup 2) */}
          <div className="max-h-80 overflow-y-auto p-2 space-y-2 custom-scrollbar">
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
                    className={`w-full flex items-start gap-3 p-3 rounded-2xl text-left transition cursor-pointer border ${
                      isSelected
                        ? 'bg-blue-50/80 dark:bg-blue-950/60 border-blue-400 dark:border-blue-700 shadow-xs'
                        : 'bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-200/90 dark:border-slate-700 shadow-2xs'
                    }`}
                  >
                    {/* Ícone de Loja/Empresa conforme Mockup 2 */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                      isSelected 
                        ? 'bg-blue-600 text-white border-blue-600' 
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600'
                    }`}>
                      <Store size={20} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                          {nomePrincipal}
                        </h4>
                        {isSelected && (
                          <span className="text-[10px] font-bold text-blue-600 bg-blue-100 dark:bg-blue-900/60 px-2 py-0.2 rounded-full shrink-0">
                            Selecionado
                          </span>
                        )}
                      </div>

                      {nomeSecundario && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {nomeSecundario}
                        </p>
                      )}

                      {/* Badges de CNPJ e Regime Tributário conforme Mockup 2 */}
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/80 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-600">
                          CNPJ: {cnpjFormatado}
                        </span>

                        {cli.regime_tributario && (
                          <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/80 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-600">
                            {cli.regime_tributario.replace('_', ' ')}
                          </span>
                        )}
                      </div>

                      {/* Telefone/WhatsApp conforme Mockup 2 */}
                      {(cli.whatsapp || cli.telefone) && (
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-400 mt-1.5 font-medium">
                          <Phone size={11} className="text-emerald-600 dark:text-emerald-400" />
                          <span>{cli.whatsapp || cli.telefone}</span>
                        </div>
                      )}
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
