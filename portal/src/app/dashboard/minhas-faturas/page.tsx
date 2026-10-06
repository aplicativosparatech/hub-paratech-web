'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

export default function MinhasFaturasPage() {
  const supabase = createClient()
  const [faturas, setFaturas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('cliente_id')
        .eq('user_id', user.id)
        .single()

      if (!roleData?.cliente_id) return

      const { data } = await supabase
        .from('faturas')
        .select('*')
        .eq('cliente_id', roleData.cliente_id)
        .order('data_vencimento', { ascending: false })

      setFaturas(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const statusStyle = (s: string) => {
    if (s === 'pago') return 'bg-green-100 text-green-700'
    if (s === 'pendente') return 'bg-yellow-100 text-yellow-700'
    return 'bg-red-100 text-red-700'
  }

  if (loading) return <div className="p-8 text-slate-500">Carregando...</div>

  return (
    <div className="p-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900">Minhas Faturas</h1>
        <p className="text-slate-500 mt-1">Histórico de cobranças da sua conta.</p>
      </header>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
            <tr>
              <th className="p-4">Vencimento</th>
              <th className="p-4">Valor</th>
              <th className="p-4">Status</th>
              <th className="p-4">Pagamento</th>
            </tr>
          </thead>
          <tbody>
            {faturas.length === 0 ? (
              <tr><td colSpan={4} className="p-8 text-center text-slate-400">Nenhuma fatura encontrada.</td></tr>
            ) : faturas.map(f => (
              <tr key={f.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="p-4">{f.data_vencimento ? new Date(f.data_vencimento).toLocaleDateString('pt-BR') : '-'}</td>
                <td className="p-4 font-medium">R$ {Number(f.valor).toFixed(2)}</td>
                <td className="p-4">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${statusStyle(f.status)}`}>
                    {f.status}
                  </span>
                </td>
                <td className="p-4 text-slate-400">{f.data_pagamento ? new Date(f.data_pagamento).toLocaleDateString('pt-BR') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
