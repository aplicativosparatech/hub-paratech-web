'use client'

import React, { useRef, useState } from 'react'
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import { SortDirection } from '@/hooks/useTableFeatures'

export interface ResizableSortableThProps {
  columnId: string
  label: React.ReactNode
  sortKey?: string
  currentSortKey?: string | null
  currentSortDirection?: SortDirection
  onSort?: (sortKey: string) => void
  width?: number
  onResize?: (columnId: string, newWidth: number) => void
  minWidth?: number
  align?: 'left' | 'center' | 'right'
  className?: string
  children?: React.ReactNode
  disableSort?: boolean
  disableResize?: boolean
}

export function ResizableSortableTh({
  columnId,
  label,
  sortKey,
  currentSortKey,
  currentSortDirection,
  onSort,
  width,
  onResize,
  minWidth = 60,
  align = 'left',
  className = '',
  children,
  disableSort = false,
  disableResize = false
}: ResizableSortableThProps) {
  const thRef = useRef<HTMLTableCellElement>(null)
  const [isResizing, setIsResizing] = useState(false)

  const isSorted = sortKey && currentSortKey === sortKey
  const activeDirection = isSorted ? currentSortDirection : null

  const handleHeaderClick = (e: React.MouseEvent) => {
    if (disableSort || !sortKey || !onSort || isResizing) return
    onSort(sortKey)
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (disableResize || !onResize) return
    e.preventDefault()
    e.stopPropagation()

    setIsResizing(true)
    const startX = e.clientX
    const thEl = thRef.current
    const startWidth = width || (thEl ? thEl.getBoundingClientRect().width : 120)

    const onMouseMove = (moveEvent: MouseEvent) => {
      const currentX = moveEvent.clientX
      const diff = currentX - startX
      const calculatedWidth = Math.max(minWidth, Math.round(startWidth + diff))
      onResize(columnId, calculatedWidth)
    }

    const onMouseUp = () => {
      setIsResizing(false)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  // Double click resets column width
  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!disableResize && onResize) {
      onResize(columnId, minWidth)
    }
  }

  const alignClass = 
    align === 'center' ? 'text-center justify-center' :
    align === 'right' ? 'text-right justify-end' : 'text-left justify-start'

  return (
    <th
      ref={thRef}
      style={{
        width: width ? `${width}px` : undefined,
        minWidth: `${minWidth}px`,
        maxWidth: width ? `${width}px` : undefined
      }}
      className={`relative group select-none py-3 px-3.5 transition-colors ${
        !disableSort && sortKey ? 'cursor-pointer hover:bg-slate-100/80' : ''
      } ${className}`}
      onClick={handleHeaderClick}
      title={
        !disableSort && sortKey
          ? 'Clique para ordenar (A-Z / 0-9) • Arraste a borda direita para redimensionar'
          : 'Arraste a borda direita para redimensionar'
      }
    >
      <div className={`flex items-center gap-1.5 overflow-hidden ${alignClass}`}>
        <span className="font-semibold text-slate-700 text-xs tracking-tight truncate">
          {label || children}
        </span>

        {/* Indicador de Ordenação */}
        {!disableSort && sortKey && (
          <span className="flex-shrink-0 flex items-center justify-center ml-0.5">
            {activeDirection === 'asc' ? (
              <span className="p-0.5 rounded bg-blue-100 text-blue-700 font-bold" title="Ordenado: Menor para Maior / A-Z">
                <ArrowUp size={13} className="stroke-[2.5]" />
              </span>
            ) : activeDirection === 'desc' ? (
              <span className="p-0.5 rounded bg-blue-100 text-blue-700 font-bold" title="Ordenado: Maior para Menor / Z-A">
                <ArrowDown size={13} className="stroke-[2.5]" />
              </span>
            ) : (
              <span className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity">
                <ArrowUpDown size={12} />
              </span>
            )}
          </span>
        )}
      </div>

      {/* Puxador de Redimensionamento da Coluna (Borda Direita) */}
      {!disableResize && onResize && (
        <div
          onMouseDown={handleMouseDown}
          onDoubleClick={handleDoubleClick}
          onClick={(e) => e.stopPropagation()}
          className={`absolute top-0 right-0 bottom-0 w-2.5 cursor-col-resize z-10 flex items-center justify-center group-hover:opacity-100 ${
            isResizing ? 'opacity-100' : 'opacity-0'
          }`}
          title="Arraste para redimensionar a largura da coluna"
        >
          <div
            className={`w-[2px] h-4/5 rounded-full transition-all ${
              isResizing ? 'bg-blue-600 scale-x-150' : 'bg-slate-300 group-hover:bg-blue-400'
            }`}
          />
        </div>
      )}
    </th>
  )
}

export default ResizableSortableTh
