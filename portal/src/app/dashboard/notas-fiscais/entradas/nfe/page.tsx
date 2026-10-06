'use client'

import { Search, Download } from 'lucide-react'

export default function NfeEntradasPage() {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-slate-800">NF-e de Entradas</h2>
        <div className="flex gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input type="text" placeholder="Buscar chave ou número..." className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <button className="flex items-center gap-2 bg-slate-100 text-slate-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-200 transition">
            <Download size={16} /> Baixar XMLs
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
            <tr>
              <th className="p-4">Número</th>
              <th className="p-4">Chave de Acesso</th>
              <th className="p-4">Valor (R$)</th>
              <th className="p-4">Emissão</th>
              <th className="p-4">Transmissão</th>
              <th className="p-4 text-center">Assinatura</th>
              <th className="p-4 text-right">Ação</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={7} className="p-8 text-center text-slate-500 bg-slate-50 border-b border-slate-100">
                Nenhuma nota fiscal encontrada no período. O Hub ainda não enviou dados.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
