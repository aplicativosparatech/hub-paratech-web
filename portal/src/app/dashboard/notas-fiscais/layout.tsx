'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { FileDown, FileUp, Receipt } from 'lucide-react'

export default function NotasFiscaisLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  const isActive = (path: string) => pathname.includes(path)

  return (
    <div className="p-8 h-full flex flex-col">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900">Portal de Notas Fiscais</h1>
        <p className="text-slate-500 mt-1">Gerenciamento e download de XMLs armazenados pelos Hubs.</p>
      </header>

      {/* Navegação Principal: Entradas e Saídas */}
      <div className="flex border-b border-slate-200 mb-6">
        <Link 
          href="/dashboard/notas-fiscais/entradas/nfe" 
          className={`flex items-center gap-2 px-6 py-3 font-medium text-sm border-b-2 transition ${isActive('/entradas') ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
        >
          <FileDown size={18} />
          Entradas
        </Link>
        <Link 
          href="/dashboard/notas-fiscais/saidas/nfe" 
          className={`flex items-center gap-2 px-6 py-3 font-medium text-sm border-b-2 transition ${isActive('/saidas') ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
        >
          <FileUp size={18} />
          Saídas
        </Link>
      </div>

      {/* Sub-abas de Saídas (Mostrado apenas se estiver em Saídas) */}
      {isActive('/saidas') && (
        <div className="flex gap-2 mb-6">
          <Link 
            href="/dashboard/notas-fiscais/saidas/nfe"
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${pathname.endsWith('/saidas/nfe') ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            NF-e (Mod 55)
          </Link>
          <Link 
            href="/dashboard/notas-fiscais/saidas/nfce"
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${pathname.endsWith('/saidas/nfce') ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            NFC-e (Mod 65)
          </Link>
        </div>
      )}

      {/* Conteúdo da Tabela */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 p-6 overflow-auto">
        {children}
      </div>
    </div>
  )
}
