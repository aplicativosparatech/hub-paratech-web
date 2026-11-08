'use client'

import React, { useState, useRef, useEffect, useMemo } from 'react'
import { Search, ChevronDown, Check, X, Building2 } from 'lucide-react'

export interface ClienteOption {
  id: string
  razao_social: string
  nome_fantasia?: string | null
  cnpj?: string | null
}

interface ClienteAutocompleteInputProps {
  clientes: ClienteOption[]
  selectedId: string
  onSelect: (id: string) => void
  placeholder?: string
  label?: string
  disabled?: boolean
}

export function ClienteAutocompleteInput({
  clientes,
  selectedId,
  onSelect,
  placeholder = 'Digite Razão Social, Nome Fantasia ou CNPJ...',
  label = 'Selecione o Cliente para Configurar',
  disabled = false
}: ClienteAutocompleteInputProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selectedCliente = useMemo(() => {
    return clientes.find(c => c.id === selectedId) || null
  }, [clientes, selectedId])

  // Fecha o dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Filtragem flexível em tempo real por Razão Social, Nome Fantasia e CNPJ
  const sugestoes = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return clientes

    const qDigits = q.replace(/\D/g, '')

    return clientes.filter(c => {
      const razao = (c.razao_social || '').toLowerCase()
      const fantasia = (c.nome_fantasia || '').toLowerCase()
      const cnpj = (c.cnpj || '').toLowerCase()
      const cnpjDigits = (c.cnpj || '').replace(/\D/g, '')

      return (
        razao.includes(q) ||
        fantasia.includes(q) ||
        cnpj.includes(q) ||
        (qDigits.length > 0 && cnpjDigits.includes(qDigits))
      )
    })
  }, [clientes, query])

  const handleSelect = (c: ClienteOption) => {
    onSelect(c.id)
    setIsOpen(false)
    setQuery('')
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onSelect('')
    setQuery('')
    setIsOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setIsOpen(true)
      return
    }

    if (isOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setHighlightedIndex(prev => (prev + 1) % Math.max(1, sugestoes.length))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setHighlightedIndex(prev => (prev - 1 + sugestoes.length) % Math.max(1, sugestoes.length))
      } else if (e.key === 'Enter') {
        if (sugestoes[highlightedIndex]) {
          e.preventDefault()
          handleSelect(sugestoes[highlightedIndex])
        }
      } else if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }
  }

  return (
    <div className="relative w-full" ref={containerRef}>
      {label && (
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-semibold text-slate-700">{label}</label>
          <span className="text-xs text-slate-400 font-medium">
            {clientes.length} empresa(s) cadastrada(s)
          </span>
        </div>
      )}

      {/* Caixa do Campo com Modo Selecionado ou Modo de Digitação */}
      <div className="relative">
        {selectedCliente && !isOpen ? (
          <div
            onClick={() => {
              if (disabled) return
              setIsOpen(true)
              setTimeout(() => inputRef.current?.focus(), 50)
            }}
            className={`w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 hover:border-blue-400 transition cursor-pointer flex items-center justify-between gap-3 shadow-2xs ${
              disabled ? 'opacity-60 cursor-not-allowed' : ''
            }`}
          >
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                <Building2 size={18} />
              </div>
              <div className="truncate">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-slate-900 text-sm truncate">
                    {selectedCliente.razao_social}
                  </span>
                  {selectedCliente.nome_fantasia && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                      {selectedCliente.nome_fantasia}
                    </span>
                  )}
                </div>
                {selectedCliente.cnpj && (
                  <span className="text-xs text-slate-400 block font-mono">
                    CNPJ: {selectedCliente.cnpj}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={handleClear}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                title="Limpar seleção"
              >
                <X size={16} />
              </button>
              <button
                type="button"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 transition cursor-pointer"
                title="Trocar cliente"
              >
                <ChevronDown size={16} />
              </button>
            </div>
          </div>
        ) : (
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              ref={inputRef}
              type="text"
              autoComplete="off"
              disabled={disabled}
              placeholder={placeholder}
              value={query}
              onChange={e => {
                setQuery(e.target.value)
                setIsOpen(true)
                setHighlightedIndex(0)
              }}
              onFocus={() => setIsOpen(true)}
              onKeyDown={handleKeyDown}
              className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-medium text-slate-900 placeholder:text-slate-400 text-sm transition shadow-2xs"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                title="Limpar texto"
              >
                <X size={16} />
              </button>
            ) : (
              <ChevronDown
                className={`absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition-transform ${
                  isOpen ? 'rotate-180' : ''
                }`}
                size={16}
              />
            )}
          </div>
        )}
      </div>

      {/* Dropdown de Autocomplete com Resultados Instantâneos */}
      {isOpen && (
        <div 
          className="absolute z-[999] left-0 right-0 mt-2 max-h-96 overflow-y-auto bg-white rounded-2xl shadow-2xl border border-slate-200 py-2"
          style={{ minHeight: sugestoes.length > 0 ? '140px' : 'auto' }}
        >
          <div className="px-4 py-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between border-b border-slate-100 mb-1">
            <span>Resultados ({sugestoes.length})</span>
            <span className="font-normal text-slate-400">Pressione Enter ou clique na empresa</span>
          </div>

          {sugestoes.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-slate-500">
              Nenhuma empresa encontrada para <span className="font-bold text-slate-700">"{query}"</span>
            </div>
          ) : (
            sugestoes.map((c, idx) => {
              const isSelected = c.id === selectedId
              const isHighlighted = idx === highlightedIndex

              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleSelect(c)}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  className={`w-full text-left px-4 py-3 text-sm flex items-center justify-between transition cursor-pointer border-b border-slate-50 last:border-b-0 ${
                    isHighlighted ? 'bg-indigo-50/80 text-indigo-950' : 'text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      isHighlighted ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                      <Building2 size={16} />
                    </div>
                    <div className="truncate">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-sm">
                          {c.razao_social}
                        </span>
                        {c.nome_fantasia && (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                            {c.nome_fantasia}
                          </span>
                        )}
                      </div>
                      {c.cnpj && (
                        <span className="text-xs text-slate-500 block font-mono mt-0.5">
                          CNPJ: {c.cnpj}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md hidden sm:inline">
                      Selecionar
                    </span>
                    {isSelected && (
                      <Check size={18} className="text-emerald-600 shrink-0" />
                    )}
                  </div>
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
