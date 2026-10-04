'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

export default function DashboardPage() {
  const supabase = createClient()
  const [totalClientes, setTotalClientes] = useState(0)
  const [totalContabilidades, setTotalContabilidades] = useState(0)
  const [totalFaturasAtrasadas, setTotalFaturasAtrasadas] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchCounts() {
      const [clientesRes, contabRes, faturasRes] = await Promise.all([
        supabase.from('clientes').select('id', { count: 'exact', head: true }),
        supabase.from('contabilidades').select('id', { count: 'exact', head: true }),
        supabase.from('faturas').select('id', { count: 'exact', head: true }).eq('status', 'pendente').lt('data_vencimento', new Date().toISOString().split('T')[0])
      ])
      setTotalClientes(clientesRes.count || 0)
      setTotalContabilidades(contabRes.count || 0)
      setTotalFaturasAtrasadas(faturasRes.count || 0)
      setLoading(false)
    }
    fetchCounts()
  }, [])

  return (
    <div className="p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Visão Geral</h1>
        <p className="text-slate-500 mt-1">Bem-vindo ao painel administrativo do Hub Paratech.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Total de Clientes</h2>
          <p className="text-4xl font-bold text-slate-800">{loading ? '...' : totalClientes}</p>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Contabilidades</h2>
          <p className="text-4xl font-bold text-slate-800">{loading ? '...' : totalContabilidades}</p>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h2 className="text-sm font-semibold text-red-500 uppercase tracking-wider mb-2">Faturas Atrasadas</h2>
          <p className="text-4xl font-bold text-red-600">{loading ? '...' : totalFaturasAtrasadas}</p>
        </div>
      </div>
    </div>
  )
}
