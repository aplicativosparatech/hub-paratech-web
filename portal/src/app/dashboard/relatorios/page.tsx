import { BarChart3 } from 'lucide-react'

export default function RelatoriosPage() {
  return (
    <div className="p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Relatórios</h1>
        <p className="text-slate-500 mt-1">Métricas, faturamento e análise de clientes.</p>
      </header>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center flex flex-col items-center">
        <BarChart3 size={48} className="text-slate-300 mb-4" />
        <h2 className="text-xl font-medium text-slate-700">Módulo de Relatórios em Desenvolvimento</h2>
        <p className="text-slate-500 mt-2 max-w-md">
          Em breve você terá acesso a gráficos de faturamento, inadimplência e status geral dos hubs conectados.
        </p>
      </div>
    </div>
  )
}
