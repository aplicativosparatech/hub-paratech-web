'use client'

import React, { useState, useEffect } from 'react'
import { Sparkles, LayoutGrid } from 'lucide-react'
import { useGlobalClient } from './GlobalClientContext'

export default function InterfaceModeToggle({ 
  variant = 'topbar', 
  isCollapsed = false 
}: { 
  variant?: 'topbar' | 'sidebar'
  isCollapsed?: boolean 
}) {
  const { interfaceMode, toggleInterfaceMode, setInterfaceMode, userRole, permitirTrocaInterface } = useGlobalClient()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Se o usuário não for admin e a alternância estiver desabilitada pelo administrador, oculta o controle
  if (userRole !== 'admin' && !permitirTrocaInterface) {
    return null
  }

  if (!mounted) {
    return (
      <div className={variant === 'topbar' ? 'h-8 w-28 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse' : 'h-10 w-full bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse'} />
    )
  }

  const isClean = interfaceMode === 'clean'

  // Variante para exibição no Menu Lateral (Sidebar)
  if (variant === 'sidebar') {
    if (isCollapsed) {
      return (
        <button
          type="button"
          onClick={toggleInterfaceMode}
          title={isClean ? 'Modo Clean Ativo (Clique para Modo Clássico)' : 'Modo Clássico Ativo (Clique para Modo Clean)'}
          className={`w-full flex items-center justify-center p-2 mb-2 rounded-xl text-xs font-bold transition-all border shadow-2xs cursor-pointer ${
            isClean
              ? 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
              : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
          }`}
        >
          {isClean ? <Sparkles size={16} className="text-blue-600 dark:text-blue-400" /> : <LayoutGrid size={16} className="text-amber-600 dark:text-amber-400" />}
        </button>
      )
    }

    return (
      <div className="mb-2 p-2 bg-slate-100/90 dark:bg-slate-800/70 rounded-xl border border-slate-200/90 dark:border-slate-700/80">
        <div className="flex items-center justify-between mb-1.5 px-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Interface</span>
          <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded ${isClean ? 'bg-blue-600 text-white' : 'bg-amber-600 text-white'}`}>
            {isClean ? 'Clean' : 'Clássico'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1 bg-white dark:bg-slate-900 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setInterfaceMode('clean')}
            className={`flex items-center justify-center gap-1 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
              isClean 
                ? 'bg-blue-600 text-white shadow-2xs' 
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <Sparkles size={11} />
            <span>Clean</span>
          </button>
          <button
            type="button"
            onClick={() => setInterfaceMode('classico')}
            className={`flex items-center justify-center gap-1 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
              !isClean 
                ? 'bg-amber-600 text-white shadow-2xs' 
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <LayoutGrid size={11} />
            <span>Clássico</span>
          </button>
        </div>
      </div>
    )
  }

  // Variante para exibição na Barra Superior (Topbar)
  return (
    <button
      type="button"
      onClick={toggleInterfaceMode}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all border shadow-2xs cursor-pointer ${
        isClean
          ? 'bg-blue-50/90 hover:bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:hover:bg-blue-900/60 dark:text-blue-300 dark:border-blue-800/80'
          : 'bg-amber-50/90 hover:bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:hover:bg-amber-900/60 dark:text-amber-300 dark:border-amber-800/80'
      }`}
      title={
        isClean 
          ? 'Interface: Modo Clean ativo (foco em dados e busca global). Clique para alternar para o Modo Clássico.'
          : 'Interface: Modo Clássico ativo (banners ilustrados e visual tradicional). Clique para alternar para o Modo Clean.'
      }
    >
      {isClean ? (
        <>
          <Sparkles size={14} className="text-blue-600 dark:text-blue-400 shrink-0" />
          <span className="font-extrabold">Modo Clean</span>
          <span className="text-[9px] uppercase tracking-wider font-extrabold bg-blue-600 text-white dark:bg-blue-500 px-1.5 py-0.2 rounded-xs ml-0.5">
            Ativo
          </span>
        </>
      ) : (
        <>
          <LayoutGrid size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="font-extrabold">Modo Clássico</span>
          <span className="text-[9px] uppercase tracking-wider font-extrabold bg-amber-600 text-white dark:bg-amber-500 px-1.5 py-0.2 rounded-xs ml-0.5">
            Ativo
          </span>
        </>
      )}
    </button>
  )
}
