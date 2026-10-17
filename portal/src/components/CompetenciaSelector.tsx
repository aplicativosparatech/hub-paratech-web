'use client'

import React, { useState, useRef, useEffect, useMemo } from 'react'
import { Calendar, Search, X, Check, Clock, ChevronDown, Sparkles } from 'lucide-react'
import { extrairCompetenciaBrasil } from '@/utils/dateBrasil'

export interface CompetenciaItem {
  valor: string // 'YYYY-MM'
  nomeMes: string // 'Outubro'
  ano: string // '2026'
  labelFormatado: string // 'Outubro de 2026'
  labelCurto: string // 'Out/2026'
  qtdNotas: number
  isAtual: boolean
  isAnterior: boolean
}

interface CompetenciaSelectorProps {
  value: string // 'YYYY-MM' ou ''
  onChange: (value: string) => void
  notas?: any[] // Lista de notas para extração de competências reais e contagem
  placeholder?: string
  className?: string
}

const MESES_NOMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

const MESES_ABREV = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
]

export default function CompetenciaSelector({
  value,
  onChange,
  notas = [],
  placeholder = 'Buscar mês (ex: Outubro, 10/2026)...',
  className = ''
}: CompetenciaSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [termoBusca, setTermoBusca] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputBuscaRef = useRef<HTMLInputElement>(null)

  // Identificar mês atual e mês anterior no fuso de Brasília
  const { mesAtualStr, mesAnteriorStr } = useMemo(() => {
    const hoje = new Date()
    const anoAtual = hoje.getFullYear()
    const mesAtual = hoje.getMonth() + 1 // 1 a 12
    const strAtual = `${anoAtual}-${String(mesAtual).padStart(2, '0')}`

    const dataAnt = new Date(anoAtual, mesAtual - 2, 1)
    const anoAnt = dataAnt.getFullYear()
    const mesAnt = dataAnt.getMonth() + 1
    const strAnt = `${anoAnt}-${String(mesAnt).padStart(2, '0')}`

    return { mesAtualStr: strAtual, mesAnteriorStr: strAnt }
  }, [])

  // Extrair contagem real de notas por competência
  const contagemPorCompetencia = useMemo(() => {
    const mapa = new Map<string, number>()
    if (!notas || !notas.length) return mapa

    for (const nota of notas) {
      try {
        const comp = extrairCompetenciaBrasil(nota.data_emissao, nota.chave)
        if (comp && /^\d{4}-\d{2}$/.test(comp)) {
          mapa.set(comp, (mapa.get(comp) || 0) + 1)
        }
      } catch {
        // ignora notas com datas corrompidas
      }
    }
    return mapa
  }, [notas])

  // Gerar lista de competências disponíveis
  const listaCompetencias = useMemo(() => {
    const todasComps = new Set<string>()

    // 1. Competências presentes nas notas
    for (const comp of contagemPorCompetencia.keys()) {
      todasComps.add(comp)
    }

    // 2. Garantir mês atual e anterior
    todasComps.add(mesAtualStr)
    todasComps.add(mesAnteriorStr)

    // 3. Garantir os últimos 24 meses do calendário
    const hoje = new Date()
    for (let i = 0; i < 24; i++) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
      const a = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      todasComps.add(`${a}-${m}`)
    }

    // 4. Se houver um valor selecionado que não está no set, adiciona
    if (value && /^\d{4}-\d{2}$/.test(value)) {
      todasComps.add(value)
    }

    // Converter para array ordenado cronologicamente decrescente (mais recente primeiro)
    const array = Array.from(todasComps).sort((a, b) => b.localeCompare(a))

    return array.map((comp): CompetenciaItem => {
      const [ano, mes] = comp.split('-')
      const mesNum = parseInt(mes, 10) - 1
      const nomeMes = MESES_NOMES[mesNum] || mes
      const abrev = MESES_ABREV[mesNum] || mes
      const qtd = contagemPorCompetencia.get(comp) || 0

      return {
        valor: comp,
        nomeMes,
        ano,
        labelFormatado: `${nomeMes} de ${ano}`,
        labelCurto: `${abrev}/${ano}`,
        qtdNotas: qtd,
        isAtual: comp === mesAtualStr,
        isAnterior: comp === mesAnteriorStr
      }
    })
  }, [contagemPorCompetencia, mesAtualStr, mesAnteriorStr, value])

  // Filtragem da lista pelo termo de busca digitado
  const competenciasFiltradas = useMemo(() => {
    if (!termoBusca.trim()) return listaCompetencias

    const t = termoBusca.toLowerCase().trim()
    const tLimpo = t.replace(/\D/g, '')

    return listaCompetencias.filter(item => {
      const nome = item.nomeMes.toLowerCase()
      const formatado = item.labelFormatado.toLowerCase()
      const curto = item.labelCurto.toLowerCase()
      const val = item.valor.toLowerCase() // "2026-10"
      const [ano, mes] = item.valor.split('-')
      const mesSemZero = String(parseInt(mes, 10))

      // Busca por nome do mês (ex: "out", "outubro")
      if (nome.includes(t) || formatado.includes(t) || curto.includes(t)) return true

      // Busca por formato numérico (ex: "10/2026", "2026-10", "10", "2026")
      if (val.includes(t)) return true
      if (`${mes}/${ano}`.includes(t)) return true
      if (`${mesSemZero}/${ano}`.includes(t)) return true
      if (ano.includes(t)) return true
      if (tLimpo && (mes.includes(tLimpo) || ano.includes(tLimpo))) return true

      return false
    })
  }, [listaCompetencias, termoBusca])

  // Obter texto do valor atual para exibição
  const itemSelecionado = useMemo(() => {
    if (!value) return null
    return listaCompetencias.find(i => i.valor === value) || null
  }, [value, listaCompetencias])

  // Fecha ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setTermoBusca('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Foco no input ao abrir
  useEffect(() => {
    if (isOpen && inputBuscaRef.current) {
      inputBuscaRef.current.focus()
    }
  }, [isOpen])

  // Processa texto livre caso o usuário pressione Enter no input
  const handleKeyDownBusca = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (competenciasFiltradas.length > 0) {
        selecionarCompetencia(competenciasFiltradas[0].valor)
      } else {
        // Tentar interpretar formato digitado (ex: "10/2026" ou "2026-10")
        const matchIso = termoBusca.match(/^(\d{4})-(\d{1,2})$/)
        if (matchIso) {
          const v = `${matchIso[1]}-${matchIso[2].padStart(2, '0')}`
          selecionarCompetencia(v)
          return
        }
        const matchBr = termoBusca.match(/^(\d{1,2})\/(\d{4})$/)
        if (matchBr) {
          const v = `${matchBr[2]}-${matchBr[1].padStart(2, '0')}`
          selecionarCompetencia(v)
          return
        }
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false)
      setTermoBusca('')
    }
  }

  const selecionarCompetencia = (comp: string) => {
    onChange(comp)
    setIsOpen(false)
    setTermoBusca('')
  }

  const limparCompetencia = (e?: React.MouseEvent) => {
    e?.stopPropagation()
    onChange('')
    setTermoBusca('')
  }

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Botão de Disparo / Exibição */}
      <div className="flex items-center gap-1 w-full">
        <button
          type="button"
          onClick={() => setIsOpen(prev => !prev)}
          className={`flex items-center justify-between w-full bg-white dark:bg-slate-800 border px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer text-left shadow-2xs ${
            isOpen 
              ? 'ring-2 ring-blue-500 border-blue-500 dark:border-blue-500' 
              : value 
                ? 'border-blue-300 dark:border-blue-700 bg-blue-50/40 dark:bg-blue-950/20 text-blue-900 dark:text-blue-100' 
                : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-slate-300'
          }`}
          title="Clique para buscar e selecionar o mês de competência"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Calendar 
              size={15} 
              className={value ? 'text-blue-600 dark:text-blue-400 shrink-0' : 'text-slate-400 shrink-0'} 
            />
            {itemSelecionado ? (
              <div className="flex items-center gap-1.5 truncate">
                <span className="font-bold text-slate-900 dark:text-white truncate">
                  {itemSelecionado.labelFormatado}
                </span>
                {itemSelecionado.qtdNotas > 0 && (
                  <span className="text-[10px] bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 px-1.5 py-0.2 rounded-full font-bold shrink-0">
                    {itemSelecionado.qtdNotas} {itemSelecionado.qtdNotas === 1 ? 'nota' : 'notas'}
                  </span>
                )}
              </div>
            ) : (
              <span className="text-slate-400 truncate">
                {placeholder}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0 ml-1">
            <ChevronDown 
              size={14} 
              className={`text-slate-400 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} 
            />
          </div>
        </button>

        {/* Botão Limpar Rápido (X) */}
        {value && (
          <button
            type="button"
            onClick={limparCompetencia}
            title="Limpar filtro de mês (Ver todas as notas)"
            className="p-2 text-slate-400 hover:text-rose-600 bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl border border-slate-200 dark:border-slate-700 transition cursor-pointer shrink-0 shadow-2xs"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Dropdown Flutuante de Busca de Mês */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 w-full min-w-[280px] sm:min-w-[320px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          
          {/* Campo de Busca Interno */}
          <div className="p-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40">
            <div className="relative flex items-center">
              <Search size={14} className="absolute left-3 text-slate-400 pointer-events-none" />
              <input
                ref={inputBuscaRef}
                type="text"
                value={termoBusca}
                onChange={e => setTermoBusca(e.target.value)}
                onKeyDown={handleKeyDownBusca}
                placeholder="Digitar mês (ex: Outubro, 10/2026)..."
                className="w-full pl-8 pr-7 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
              />
              {termoBusca && (
                <button
                  type="button"
                  onClick={() => setTermoBusca('')}
                  className="absolute right-2.5 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Atalhos Rápidos */}
            <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-800 text-[10px]">
              <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px] mr-1">Atalhos:</span>
              
              <button
                type="button"
                onClick={() => selecionarCompetencia(mesAtualStr)}
                className={`px-2 py-1 rounded-lg font-bold border transition cursor-pointer ${
                  value === mesAtualStr
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-blue-950/40'
                }`}
              >
                Mês Atual
              </button>

              <button
                type="button"
                onClick={() => selecionarCompetencia(mesAnteriorStr)}
                className={`px-2 py-1 rounded-lg font-bold border transition cursor-pointer ${
                  value === mesAnteriorStr
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-blue-950/40'
                }`}
              >
                Mês Anterior
              </button>

              <button
                type="button"
                onClick={() => selecionarCompetencia('')}
                className={`px-2 py-1 rounded-lg font-bold border transition cursor-pointer ${
                  !value
                    ? 'bg-slate-800 text-white border-slate-800'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                Todas
              </button>
            </div>
          </div>

          {/* Lista com Scroll dos Meses */}
          <div className="max-h-64 overflow-y-auto p-1.5 space-y-0.5 custom-scrollbar">
            {competenciasFiltradas.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                Nenhum mês encontrado para &quot;{termoBusca}&quot;.
                <p className="text-[11px] text-slate-400 mt-1">Pressione Enter para buscar mesmo assim.</p>
              </div>
            ) : (
              competenciasFiltradas.map(comp => {
                const isSelected = comp.valor === value
                const temNotas = comp.qtdNotas > 0

                return (
                  <button
                    key={comp.valor}
                    type="button"
                    onClick={() => selecionarCompetencia(comp.valor)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {isSelected ? (
                        <Check size={14} className="text-blue-600 dark:text-blue-400 shrink-0" />
                      ) : (
                        <div className="w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-slate-600 shrink-0" />
                      )}
                      <span className="truncate">
                        {comp.labelFormatado}
                      </span>
                      {comp.isAtual && (
                        <span className="text-[9px] uppercase font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 px-1.5 py-0.2 rounded border border-amber-300 dark:border-amber-800">
                          Atual
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {temNotas ? (
                        <span className="text-[11px] font-bold font-mono px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          {comp.qtdNotas} {comp.qtdNotas === 1 ? 'nota' : 'notas'}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">
                          Sem notas
                        </span>
                      )}
                    </div>
                  </button>
                )
              })
            )}
          </div>

          {/* Rodapé informativo */}
          <div className="p-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between text-[10px] text-slate-400 px-3">
            <span>Dica: digite o mês ou número (ex: 10)</span>
            <kbd className="font-mono bg-white dark:bg-slate-800 px-1 py-0.2 rounded border border-slate-200 dark:border-slate-700">
              ESC para fechar
            </kbd>
          </div>

        </div>
      )}
    </div>
  )
}
