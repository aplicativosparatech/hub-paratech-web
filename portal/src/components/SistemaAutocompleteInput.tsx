'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Check, ChevronDown, Laptop, Sparkles, X, Plus } from 'lucide-react'

export const ERP_PADRAO = [
  'MEI_SIMPLES',
  'SANEADOR_TRIBUTARIO',
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
  'MEI_SIMPLES',
  'SANEADOR_TRIBUTARIO',
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

/**
 * Converte a string armazenada no banco (ex: "BARTECH + SANEADOR_TRIBUTARIO") em lista de nomes
 */
export function parseSistemas(val: string): string[] {
  if (!val) return []
  return val
    .split(/[+,;]/)
    .map(s => s.trim())
    .filter(Boolean)
}

/**
 * Converte a lista de nomes de volta para a string formatada do banco
 */
export function formatSistemas(sistemas: string[]): string {
  // Remove duplicados preservando ordem e formata com " + "
  const unicos = Array.from(new Set(sistemas.map(s => s.trim()).filter(Boolean)))
  return unicos.join(' + ')
}

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
  placeholder = 'Digite ou selecione: BARTECH, SANEADOR, GDOOR...'
}: SistemaAutocompleteInputProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const [inputValue, setInputValue] = useState('')
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Mescla sistemas disponíveis com a lista padrão garantindo unicidade
  const todosSistemas = Array.from(new Set([...sistemasDisponiveis, ...ERP_PADRAO]))

  // Lista atual de sistemas selecionados
  const sistemasSelecionados = parseSistemas(value)

  // Filtra as sugestões conforme o usuário digita no input interno
  const query = inputValue.trim().toLowerCase()
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

  // Alterna a seleção de um sistema (adiciona se não tiver, remove se já tiver)
  const toggleSistema = (sis: string) => {
    const nomeLimpo = sis.trim()
    if (!nomeLimpo) return

    const existe = sistemasSelecionados.some(s => s.toUpperCase() === nomeLimpo.toUpperCase())
    let novaLista: string[]

    if (existe) {
      novaLista = sistemasSelecionados.filter(s => s.toUpperCase() !== nomeLimpo.toUpperCase())
    } else {
      novaLista = [...sistemasSelecionados, nomeLimpo]
    }

    onChange(formatSistemas(novaLista))
    setInputValue('')
    inputRef.current?.focus()
  }

  // Remove um sistema específico
  const removerSistema = (sisParaRemover: string) => {
    const novaLista = sistemasSelecionados.filter(
      s => s.toUpperCase() !== sisParaRemover.trim().toUpperCase()
    )
    onChange(formatSistemas(novaLista))
  }

  // Adiciona o texto que está digitado no input
  const adicionarInputAtual = () => {
    const texto = inputValue.trim()
    if (!texto) return
    toggleSistema(texto)
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
        e.preventDefault()
        if (sugestoesFiltradas[highlightedIndex]) {
          toggleSistema(sugestoesFiltradas[highlightedIndex])
        } else if (inputValue.trim()) {
          adicionarInputAtual()
        }
      } else if (e.key === ',' || e.key === ';') {
        e.preventDefault()
        if (inputValue.trim()) {
          adicionarInputAtual()
        }
      } else if (e.key === 'Escape') {
        setIsOpen(false)
      }
    } else {
      if (e.key === 'Enter' || e.key === ',' || e.key === ';') {
        e.preventDefault()
        if (inputValue.trim()) {
          adicionarInputAtual()
        }
      } else if (e.key === 'Backspace' && !inputValue && sistemasSelecionados.length > 0) {
        // Remove a última tag se o input estiver vazio e pressionar backspace
        removerSistema(sistemasSelecionados[sistemasSelecionados.length - 1])
      }
    }
  }

  return (
    <div className="relative" ref={wrapperRef}>
      {/* Container Principal com Chips + Campo de Digitação */}
      <div 
        onClick={() => inputRef.current?.focus()}
        className="w-full min-h-[46px] p-1.5 px-3 rounded-xl border border-slate-200 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 bg-slate-50/50 flex flex-wrap items-center gap-1.5 transition cursor-text"
      >
        {/* Chips dos Sistemas Já Selecionados */}
        {sistemasSelecionados.map(sis => (
          <span
            key={sis}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 text-white text-xs font-semibold shadow-xs animate-in fade-in zoom-in-95 duration-150"
          >
            <Laptop className="w-3.5 h-3.5 text-blue-200" />
            <span>{sis}</span>
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation()
                removerSistema(sis)
              }}
              className="p-0.5 hover:bg-blue-700 rounded-md transition text-blue-100 hover:text-white"
              title={`Remover ${sis}`}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}

        {/* Input Interno de Digitação / Busca */}
        <input
          ref={inputRef}
          id={id}
          required={required && sistemasSelecionados.length === 0}
          type="text"
          autoComplete="off"
          className="flex-1 min-w-[140px] bg-transparent border-none outline-none text-sm font-medium text-slate-800 placeholder:text-slate-400 py-1"
          placeholder={sistemasSelecionados.length === 0 ? placeholder : 'Adicionar outro sistema (+)...'}
          value={inputValue}
          onChange={e => {
            setInputValue(e.target.value)
            setIsOpen(true)
            setHighlightedIndex(0)
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
        />

        {/* Botão de Toggle do Dropdown */}
        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.stopPropagation()
            setIsOpen(prev => !prev)
          }}
          className="text-slate-400 hover:text-slate-600 transition p-1 ml-auto"
          title="Ver todos os sistemas"
        >
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Dropdown de Autocomplete Flutuante ao Começar a Digitar */}
      {isOpen && sugestoesFiltradas.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between border-b border-slate-100 mb-1">
            <span>Sistemas Sugeridos (Clique para Alternar)</span>
            <span className="text-[10px] text-slate-400 font-normal">Pressione Enter ou clique</span>
          </div>
          {sugestoesFiltradas.map((sis, idx) => {
            const isSelected = sistemasSelecionados.some(s => s.toUpperCase() === sis.toUpperCase())
            const isHighlighted = idx === highlightedIndex

            return (
              <button
                key={sis}
                type="button"
                onClick={() => toggleSistema(sis)}
                onMouseEnter={() => setHighlightedIndex(idx)}
                className={`w-full text-left px-3.5 py-2 text-sm flex items-center justify-between transition ${
                  isHighlighted ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Laptop className={`w-4 h-4 ${isSelected ? 'text-blue-600' : isHighlighted ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span className={`font-medium ${isSelected ? 'text-blue-700 font-semibold' : ''}`}>{sis}</span>
                </div>
                {isSelected ? (
                  <span className="flex items-center gap-1 text-[11px] text-blue-600 font-bold bg-blue-100 px-2 py-0.5 rounded-md">
                    <Check className="w-3.5 h-3.5" /> Selecionado
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-400 flex items-center gap-0.5">
                    <Plus className="w-3 h-3" /> Adicionar
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Atalhos Rápidos com os Sistemas Mais Usados (Toggle On/Off ao clicar) */}
      <div className="flex flex-wrap items-center gap-1.5 mt-2">
        <span className="text-[11px] text-slate-400 mr-1 flex items-center gap-1 font-medium">
          <Sparkles className="w-3 h-3 text-amber-500" />
          Sugestões rápidas:
        </span>
        {ATALHOS_PRIORITARIOS.map(sis => {
          const isAtivo = sistemasSelecionados.some(s => s.toUpperCase() === sis.toUpperCase())
          return (
            <button
              key={sis}
              type="button"
              onClick={() => toggleSistema(sis)}
              className={`text-[11px] px-2.5 py-1 rounded-lg border transition font-semibold flex items-center gap-1 cursor-pointer ${
                isAtivo
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 hover:border-slate-300'
              }`}
              title={isAtivo ? `Clique para remover ${sis}` : `Clique para adicionar ${sis}`}
            >
              {isAtivo && <Check className="w-3 h-3 text-white" />}
              {sis}
            </button>
          )
        })}
      </div>

      {/* Resumo quando múltiplos sistemas estão selecionados */}
      {sistemasSelecionados.length > 1 && (
        <div className="mt-2 p-2 px-3 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-between text-xs text-blue-800">
          <div className="flex items-center gap-1.5 font-medium">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
            <span><strong>{sistemasSelecionados.length} Sistemas Contratados:</strong> {sistemasSelecionados.join(' + ')}</span>
          </div>
          <span className="text-[11px] text-blue-600 font-semibold">Mensalidade combinada</span>
        </div>
      )}

      <p className="text-[11px] text-slate-400 mt-1">
        Clique nas sugestões para adicionar ou remover sistemas. Digite para adicionar outros. Suporta múltiplos sistemas por cliente.
      </p>
    </div>
  )
}
