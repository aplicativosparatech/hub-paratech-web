'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Check, ChevronDown, Laptop, Sparkles } from 'lucide-react'

export const ERP_PADRAO = [
  'BARTECH',
  'SIEDFOOD',
  'GDOOR SLIM',
  'GDOOR PRO',
  'PDV+',
  'NAVI VENDAS',
  'GWEB',
  'ZWEB',
  'BARZIN',
  'GASTRO',
  'Gdoor',
  'SysPDV',
  'Hiper',
  'Bling',
  'Tiny ERP',
  'Totvs Protheus',
  'Linx',
  'Sankhya',
  'Alterdata',
  'ContaAzul',
  'Omie',
  'Digisat',
  'VR Software',
  'Zanthus',
  'Clipp Fácil'
]

// Lista prioritária exibida nos atalhos rápidos (badges)
export const ATALHOS_PRIORITARIOS = [
  'BARTECH',
  'SIEDFOOD',
  'GDOOR SLIM',
  'GDOOR PRO',
  'PDV+',
  'NAVI VENDAS',
  'GWEB',
  'ZWEB',
  'BARZIN',
  'GASTRO'
]

interface SistemaAutocompleteInputProps {
  value: string
  onChange: (val: string) => void
  sistemasDisponiveis?: string[]
  required?: boolean
  id?: string
  placeholder?: string
}

export function SistemaAutocompleteInput({
  value,
  onChange,
  sistemasDisponiveis = ERP_PADRAO,
  required = false,
  id = 'sistema-input',
  placeholder = 'Digite ou selecione: BARTECH, SIEDFOOD, GDOOR...'
}: SistemaAutocompleteInputProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Mescla sistemas disponíveis com a lista padrão garantindo unicidade
  const todosSistemas = Array.from(new Set([...sistemasDisponiveis, ...ERP_PADRAO]))

  // Filtra as sugestões conforme o usuário digita
  const query = (value || '').trim().toLowerCase()
  const sugestoesFiltradas = query
    ? todosSistemas.filter(s => s.toLowerCase().includes(query))
    : todosSistemas

  // Fecha o dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (sis: string) => {
    onChange(sis)
    setIsOpen(false)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setIsOpen(true)
      return
    }

    if (isOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setHighlightedIndex(prev => (prev + 1) % Math.max(1, sugestoesFiltradas.length))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setHighlightedIndex(prev => (prev - 1 + sugestoesFiltradas.length) % Math.max(1, sugestoesFiltradas.length))
      } else if (e.key === 'Enter') {
        if (sugestoesFiltradas[highlightedIndex]) {
          e.preventDefault()
          handleSelect(sugestoesFiltradas[highlightedIndex])
        }
      } else if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }
  }

  return (
    <div className="relative" ref={wrapperRef}>
      {/* Campo de Entrada com Autocomplete Interativo */}
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          required={required}
          type="text"
          autoComplete="off"
          className="w-full px-4 py-2.5 pr-10 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50 font-medium text-slate-800 transition"
          placeholder={placeholder}
          value={value}
          onChange={e => {
            onChange(e.target.value)
            setIsOpen(true)
            setHighlightedIndex(0)
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setIsOpen(prev => !prev)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition p-1"
          title="Ver todos os sistemas"
        >
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Dropdown de Autocomplete Flutuante ao Começar a Digitar */}
      {isOpen && sugestoesFiltradas.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between border-b border-slate-100 mb-1">
            <span>Sistemas Sugeridos</span>
            <span className="text-[10px] text-slate-400 font-normal">Pressione Enter ou clique</span>
          </div>
          {sugestoesFiltradas.map((sis, idx) => {
            const isSelected = value.trim().toLowerCase() === sis.toLowerCase()
            const isHighlighted = idx === highlightedIndex

            return (
              <button
                key={sis}
                type="button"
                onClick={() => handleSelect(sis)}
                onMouseEnter={() => setHighlightedIndex(idx)}
                className={`w-full text-left px-3.5 py-2 text-sm flex items-center justify-between transition ${
                  isHighlighted ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Laptop className={`w-4 h-4 ${isHighlighted ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span className="font-medium">{sis}</span>
                </div>
                {isSelected && (
                  <Check className="w-4 h-4 text-blue-600 shrink-0" />
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Atalhos Rápidos com os 10 Sistemas Mais Usados solicitados pelo usuário */}
      <div className="flex flex-wrap items-center gap-1.5 mt-2">
        <span className="text-[11px] text-slate-400 mr-1 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-amber-500" />
          Sugestões rápidas:
        </span>
        {ATALHOS_PRIORITARIOS.map(sis => {
          const isAtivo = (value || '').trim().toUpperCase() === sis.toUpperCase()
          return (
            <button
              key={sis}
              type="button"
              onClick={() => handleSelect(sis)}
              className={`text-[11px] px-2.5 py-0.5 rounded-lg border transition font-medium cursor-pointer ${
                isAtivo
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs scale-105'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 hover:border-slate-300'
              }`}
            >
              {sis}
            </button>
          )
        })}
      </div>
      <p className="text-[11px] text-slate-400 mt-1">
        Comece a digitar para autocompletar ou clique nas sugestões acima. Novos nomes são aprendidos automaticamente.
      </p>
    </div>
  )
}
