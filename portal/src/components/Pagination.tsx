'use client'

import React from 'react'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'

interface PaginationProps {
  currentPage: number
  totalItems: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  pageSizeOptions?: number[]
  itemLabel?: string
}

export default function Pagination({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  itemLabel = 'registros'
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endItem = Math.min(totalItems, currentPage * pageSize)

  // Gerar lista de números de páginas visíveis
  const getPageNumbers = () => {
    const pages: (number | string)[] = []
    const maxVisible = 5

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      let start = Math.max(1, currentPage - 1)
      let end = Math.min(totalPages, currentPage + 1)

      if (currentPage <= 2) {
        start = 1
        end = 3
      } else if (currentPage >= totalPages - 1) {
        start = totalPages - 2
        end = totalPages
      }

      if (start > 1) {
        pages.push(1)
        if (start > 2) pages.push('...')
      }

      for (let i = start; i <= end; i++) {
        pages.push(i)
      }

      if (end < totalPages) {
        if (end < totalPages - 1) pages.push('...')
        pages.push(totalPages)
      }
    }

    return pages
  }

  if (totalItems === 0) return null

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-3 px-2 border-t border-slate-200 text-xs text-slate-600 bg-white rounded-b-2xl">
      {/* Lado Esquerdo: Seletor de registros por página e totalizador */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500 font-medium">Exibir</span>
          <select
            value={pageSize}
            onChange={e => {
              const newSize = Number(e.target.value)
              onPageSizeChange(newSize)
              onPageChange(1) // Volta para página 1
            }}
            className="bg-slate-50 border border-slate-200 text-slate-800 font-bold rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            {pageSizeOptions.map(opt => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <span className="text-slate-500 font-medium">por página</span>
        </div>

        <div className="text-slate-500 font-medium border-l border-slate-200 pl-3">
          Mostrando <strong className="text-slate-900 font-bold">{startItem}</strong> a <strong className="text-slate-900 font-bold">{endItem}</strong> de <strong className="text-slate-900 font-bold">{totalItems}</strong> {itemLabel}
        </div>
      </div>

      {/* Lado Direito: Navegação entre páginas */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          title="Primeira Página"
          className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
        >
          <ChevronsLeft size={15} />
        </button>

        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          title="Página Anterior"
          className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
        >
          <ChevronLeft size={15} />
        </button>

        <div className="flex items-center gap-1 px-1">
          {getPageNumbers().map((p, idx) => {
            if (typeof p === 'string') {
              return (
                <span key={`dots-${idx}`} className="px-1 text-slate-400 font-bold">
                  ...
                </span>
              )
            }
            const isActive = p === currentPage
            return (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                className={`min-w-[28px] h-7 px-2 rounded-lg font-bold text-xs transition ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {p}
              </button>
            )
          })}
        </div>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          title="Próxima Página"
          className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
        >
          <ChevronRight size={15} />
        </button>

        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage >= totalPages}
          title="Última Página"
          className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
        >
          <ChevronsRight size={15} />
        </button>
      </div>
    </div>
  )
}
