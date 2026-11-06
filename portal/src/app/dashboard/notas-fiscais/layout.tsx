'use client'

import { NotasFiscaisFilterProvider } from './NotasFiscaisFilterContext'
import NotasFiscaisNavTabs from './NotasFiscaisNavTabs'

export default function NotasFiscaisLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <NotasFiscaisFilterProvider>
      <div className="p-8 h-full flex flex-col">
        <header className="mb-4">
          <h1 className="text-3xl font-bold text-slate-900">Portal de Notas Fiscais</h1>
          <p className="text-slate-500 mt-1">Gerenciamento e download de XMLs armazenados pelos Hubs.</p>
        </header>

        {/* Navegação de Guias com Contadores Dinâmicos e Botão de Importação */}
        <NotasFiscaisNavTabs />

        {/* Conteúdo da Tabela */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 p-6 overflow-auto">
          {children}
        </div>
      </div>
    </NotasFiscaisFilterProvider>
  )
}
