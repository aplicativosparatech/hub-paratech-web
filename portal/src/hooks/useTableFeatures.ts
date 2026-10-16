'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'

export type SortDirection = 'asc' | 'desc' | null

export interface UseTableFeaturesOptions<T> {
  data: T[]
  tableId?: string // Identificador único para salvar larguras no localStorage
  defaultSortKey?: string
  defaultSortDirection?: SortDirection
  initialWidths?: Record<string, number>
  customExtractors?: Record<string, (item: T) => any>
}

/**
 * Comparador inteligente para ordenação:
 * - Números (1, 2, 10...)
 * - Moedas brasileiras (R$ 50,00 -> 50.00)
 * - Datas brasileiras (DD/MM/YYYY HH:mm) e ISO
 * - Textos com acentuação e case-insensitive (pt-BR)
 */
export function smartCompare(a: any, b: any, direction: 'asc' | 'desc'): number {
  if (a === b) return 0
  if (a === null || a === undefined || a === '') return 1
  if (b === null || b === undefined || b === '') return -1

  // Números puros
  if (typeof a === 'number' && typeof b === 'number') {
    return direction === 'asc' ? a - b : b - a
  }

  // Booleanos
  if (typeof a === 'boolean' && typeof b === 'boolean') {
    return direction === 'asc' ? (a === b ? 0 : a ? -1 : 1) : (a === b ? 0 : a ? 1 : -1)
  }

  const strA = String(a).trim()
  const strB = String(b).trim()

  // Formato monetário brasileiro (ex: "R$ 1.250,50" ou "50,00")
  const isCurrencyA = /^(R\$\s*)?-?\d{1,3}(\.\d{3})*,\d{2}$/.test(strA)
  const isCurrencyB = /^(R\$\s*)?-?\d{1,3}(\.\d{3})*,\d{2}$/.test(strB)
  if (isCurrencyA && isCurrencyB) {
    const numA = parseFloat(strA.replace(/[^\d,-]/g, '').replace(',', '.'))
    const numB = parseFloat(strB.replace(/[^\d,-]/g, '').replace(',', '.'))
    return direction === 'asc' ? numA - numB : numB - numA
  }

  // Strings numéricas puras (ex: "44161", "10", "2")
  if (/^-?\d+(\.\d+)?$/.test(strA) && /^-?\d+(\.\d+)?$/.test(strB)) {
    const numA = Number(strA)
    const numB = Number(strB)
    return direction === 'asc' ? numA - numB : numB - numA
  }

  // Datas no padrão brasileiro (DD/MM/YYYY ou DD/MM/YYYY HH:mm:ss)
  const dateRegexBr = /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/
  const matchBrA = strA.match(dateRegexBr)
  const matchBrB = strB.match(dateRegexBr)
  if (matchBrA && matchBrB) {
    const timeA = new Date(
      Number(matchBrA[3]),
      Number(matchBrA[2]) - 1,
      Number(matchBrA[1]),
      Number(matchBrA[4] || 0),
      Number(matchBrA[5] || 0),
      Number(matchBrA[6] || 0)
    ).getTime()
    const timeB = new Date(
      Number(matchBrB[3]),
      Number(matchBrB[2]) - 1,
      Number(matchBrB[1]),
      Number(matchBrB[4] || 0),
      Number(matchBrB[5] || 0),
      Number(matchBrB[6] || 0)
    ).getTime()
    return direction === 'asc' ? timeA - timeB : timeB - timeA
  }

  // Datas ISO ou padrão Date.parse
  const timeA = Date.parse(strA)
  const timeB = Date.parse(strB)
  if (!isNaN(timeA) && !isNaN(timeB) && (strA.includes('-') || strA.includes('/'))) {
    return direction === 'asc' ? timeA - timeB : timeB - timeA
  }

  // Texto comum com ordenação alfabética em pt-BR (A-Z ou Z-A)
  const comp = strA.localeCompare(strB, 'pt-BR', { numeric: true, sensitivity: 'base' })
  return direction === 'asc' ? comp : -comp
}

export function useTableFeatures<T>({
  data,
  tableId,
  defaultSortKey = null as any,
  defaultSortDirection = null,
  initialWidths = {},
  customExtractors = {}
}: UseTableFeaturesOptions<T>) {
  // Estado de Ordenação
  const [sortKey, setSortKey] = useState<string | null>(defaultSortKey)
  const [sortDirection, setSortDirection] = useState<SortDirection>(defaultSortDirection)

  // Estado de Larguras de Colunas
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(initialWidths)

  // Carrega larguras salvas do localStorage se tableId fornecido
  useEffect(() => {
    if (!tableId || typeof window === 'undefined') return
    try {
      const saved = localStorage.getItem(`hub_table_widths_${tableId}`)
      if (saved) {
        const parsed = JSON.parse(saved)
        setColumnWidths(prev => ({ ...initialWidths, ...parsed }))
      }
    } catch (e) {
      console.warn('Falha ao carregar larguras salvas da tabela:', e)
    }
  }, [tableId])

  // Alterna ordenação: asc -> desc -> null -> asc
  const handleSort = useCallback((key: string) => {
    setSortKey(prevKey => {
      if (prevKey !== key) {
        setSortDirection('asc')
        return key
      }
      setSortDirection(prevDir => {
        if (prevDir === 'asc') return 'desc'
        if (prevDir === 'desc') return null
        return 'asc'
      })
      return key
    })
  }, [])

  // Atualiza largura da coluna e persiste
  const handleResizeColumn = useCallback((columnId: string, newWidth: number) => {
    setColumnWidths(prev => {
      const updated = { ...prev, [columnId]: Math.max(50, Math.round(newWidth)) }
      if (tableId && typeof window !== 'undefined') {
        try {
          localStorage.setItem(`hub_table_widths_${tableId}`, JSON.stringify(updated))
        } catch (e) {
          // ignore quota error
        }
      }
      return updated
    })
  }, [tableId])

  // Reseta larguras para padrão
  const handleResetWidths = useCallback(() => {
    setColumnWidths(initialWidths)
    if (tableId && typeof window !== 'undefined') {
      try {
        localStorage.removeItem(`hub_table_widths_${tableId}`)
      } catch (e) {
        // ignore
      }
    }
  }, [tableId, initialWidths])

  // Aplica ordenação sobre a lista de dados
  const sortedData = useMemo(() => {
    if (!sortKey || !sortDirection || !Array.isArray(data)) {
      return data
    }

    const extractor = customExtractors[sortKey] || ((item: any) => item[sortKey])

    return [...data].sort((itemA, itemB) => {
      const valA = extractor(itemA)
      const valB = extractor(itemB)
      return smartCompare(valA, valB, sortDirection)
    })
  }, [data, sortKey, sortDirection, customExtractors])

  return {
    sortedData,
    sortKey,
    sortDirection,
    handleSort,
    columnWidths,
    handleResizeColumn,
    handleResetWidths
  }
}
