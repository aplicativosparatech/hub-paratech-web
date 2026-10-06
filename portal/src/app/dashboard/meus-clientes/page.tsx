'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'
import { FileDown } from 'lucide-react'

export default function MeusClientesPage() {
  const supabase = createClient()
  const [clientes, setClientes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('contabilidade_id')
        .eq('user_id', user.id)
        .single()

      if (!roleData?.contabilidade_id) return

      const { data } = await supabase
        .from('clientes')
        .select('id, razao_social, nome_fantasia, cnpj, login_email')
        .eq('contabilidade_id', roleData.contabilidade_id)
        .order('nome_fantasia')

      setClientes(data || [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="p-8 text-slate-500">Carregando...</div>

  return (
    <div className="p-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900">Meus Clientes</h1>
        <p className="text-slate-500 mt-1">Empresas vinculadas ao seu escritório de contabilidade.</p>
      </header>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
            <tr>
              <th className="p-4">Empresa (Nome Fantasia)</th>
              <th className="p-4">Razão Social</th>
              <th className="p-4">CNPJ</th>
              <th className="p-4">Login (E-mail)</th>
              <th className="p-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {clientes.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-slate-400">Nenhum cliente vinculado à sua contabilidade.</td></tr>
            ) : clientes.map(c => (
              <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="p-4 font-medium text-slate-900">{c.nome_fantasia}</td>
                <td className="p-4">{c.razao_social || '—'}</td>
                <td className="p-4">{c.cnpj || '—'}</td>
                <td className="p-4">{c.login_email || '—'}</td>
                <td className="p-4 text-right">
                  <Link
                    href={`/dashboard/notas-fiscais?cliente_id=${c.id}`}
                    className="inline-flex items-center gap-1.5 text-xs bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition font-medium"
                  >
                    <FileDown size={14} /> Ver Notas Fiscais
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
