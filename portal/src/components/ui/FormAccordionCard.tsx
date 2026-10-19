'use client'

import React from 'react'
import { ChevronDown } from 'lucide-react'

interface FormAccordionCardProps {
  id: string
  title: string
  subtitle?: string
  icon: React.ReactNode
  iconBgColor?: string
  isOpen: boolean
  onToggle: () => void
  badge?: React.ReactNode
  headerAction?: React.ReactNode
  children: React.ReactNode
  className?: string
}

export function FormAccordionCard({
  id,
  title,
  subtitle,
  icon,
  iconBgColor = 'bg-blue-50 text-blue-600 border border-blue-100',
  isOpen,
  onToggle,
  badge,
  headerAction,
  children,
  className = ''
}: FormAccordionCardProps) {
  return (
    <div 
      id={`card-${id}`}
      className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden ${
        isOpen 
          ? 'border-blue-200 shadow-sm ring-1 ring-blue-50/50' 
          : 'border-slate-200 shadow-xs hover:border-slate-300'
      } ${className}`}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onToggle()
          }
        }}
        aria-expanded={isOpen}
        className="w-full text-left p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer select-none hover:bg-slate-50/70 transition-colors"
      >
        <div className="flex items-center gap-3.5 min-w-0">
          <div className={`p-2.5 rounded-xl shrink-0 flex items-center justify-center shadow-2xs ${iconBgColor}`}>
            {icon}
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              {title}
            </h3>
            {subtitle && (
              <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto" onClick={(e) => e.stopPropagation()}>
          {headerAction}
          {badge}
          <button
            type="button"
            onClick={onToggle}
            aria-label={isOpen ? `Recolher seção ${title}` : `Expandir seção ${title}`}
            className={`p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all cursor-pointer ${
              isOpen ? 'rotate-180 text-blue-600 bg-blue-50/60' : ''
            }`}
          >
            <ChevronDown size={20} className="transition-transform duration-200" />
          </button>
        </div>
      </div>

      <div className={`p-6 sm:p-7 border-t border-slate-100 bg-slate-50/20 ${isOpen ? 'block animate-in fade-in duration-200' : 'hidden'}`}>
        {children}
      </div>
    </div>
  )
}
