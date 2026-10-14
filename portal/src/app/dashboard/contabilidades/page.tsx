'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Pencil, Trash2, X, Users, Building2 } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import toast from 'react-hot-toast'

export default function ContabilidadesPage() {
  const [contabilidades, setContabilidades] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; id: string; nome: string }>({ open: false, id: '', nome: '' })
  const [deleting, setDeleting] = useState(false)
  const supabase = createClient()

  async function fetchContabilidades() {
    try {
      // 1. Busca contabilidades com join em clientes
      const { data: contabsData, error: errContabs } = await supabase
        .from('contabilidades')
        .select('*, clientes ( count )')
        .order('created_at', { ascending: false })

      // 2. Busca direta para garantir a contagem exata independente de RLS
      const { data: clientesData } = await supabase
        .from('clientes')
        .select('id, contabilidade_id')

      const countsMap: Record<string, number> = {}
      if (clientesData) {
        clientesData.forEach((cli: any) => {
          if (cli.contabilidade_id) {
            countsMap[cli.contabilidade_id] = (countsMap[cli.contabilidade_id] || 0) + 1
          }
        })
      }

      if (contabsData) {
        const lista = contabsData.map((c: any) => {
          const countFromJoin = c.clientes?.[0]?.count ?? 0
          const countFromMap = countsMap[c.id] ?? 0
          return {
            ...c,
            total_clientes: Math.max(countFromJoin, countFromMap)
          }
        })
        setContabilidades(lista)
      } else {
        const { data: contabsSimples } = await supabase
          .from('contabilidades')
          .select('*')
          .order('created_at', { ascending: false })

        if (contabsSimples) {
          const lista = contabsSimples.map((c: any) => ({
            ...c,
            total_clientes: countsMap[c.id] ?? 0
          }))
          setContabilidades(lista)
        }
      }
    } catch (err: any) {
      console.error('Erro ao buscar contabilidades e clientes:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchContabilidades() }, [])

  const handleDelete = async () => {
    setDeleting(true)
    const { error } = await supabase.from('contabilidades').delete().eq('id', deleteModal.id)
    if (error) {
      toast.error('Erro ao excluir: ' + error.message)
    } else {
      toast.success('Contabilidade excluída com sucesso!')
      fetchContabilidades()
    }
    setDeleting(false)
    setDeleteModal({ open: false, id: '', nome: '' })
  }

  return (
    <div className="p-8">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Contabilidades</h1>
          <p className="text-slate-500 mt-1">Escritórios contábeis vinculados aos clientes do portal.</p>
        </div>
        
        <Link href="/dashboard/contabilidades/nova" className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition flex items-center gap-2">
          <Plus size={20} />
          Nova Contabilidade
        </Link>
      </header>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="p-4 font-semibold text-slate-600 text-sm">Logo</th>
              <th className="p-4 font-semibold text-slate-600 text-sm">Escritório / Fantasia</th>
              <th className="p-4 font-semibold text-slate-600 text-sm text-center">Clientes Atribuídos</th>
              <th className="p-4 font-semibold text-slate-600 text-sm">CNPJ</th>
              <th className="p-4 font-semibold text-slate-600 text-sm">Contato / WhatsApp</th>
              <th className="p-4 font-semibold text-slate-600 text-sm">Contador / CRC</th>
              <th className="p-4 font-semibold text-slate-600 text-sm">Login de Acesso</th>
              <th className="p-4 font-semibold text-slate-600 text-sm text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="p-8 text-center text-slate-500">Carregando contabilidades e contagem de clientes...</td></tr>
            ) : contabilidades.length === 0 ? (
              <tr><td colSpan={8} className="p-8 text-center text-slate-500">Nenhuma contabilidade cadastrada ainda.</td></tr>
            ) : (
              contabilidades.map(c => (
                <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="p-4">
                    {c.logo_url ? (
                      <img src={c.logo_url} alt="Logo" className="w-10 h-10 rounded-full object-cover border border-slate-200" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-400 text-xs font-bold">
                        {c.razao_social?.charAt(0)}
                      </div>
                    )}
                  </td>
                  <td className="p-4 text-slate-800">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900">{c.razao_social}</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold ${
                        (c.total_clientes || 0) > 0
                          ? 'bg-blue-100 text-blue-700 border border-blue-200'
                          : 'bg-slate-100 text-slate-500 border border-slate-200'
                      }`}>
                        <Users size={11} />
                        {c.total_clientes || 0} {c.total_clientes === 1 ? 'cliente' : 'clientes'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">{c.nome_fantasia || '—'}</div>
                  </td>

                  {/* Coluna de Clientes Atribuídos com Badge em Destaque */}
                  <td className="p-4 text-center">
                    <Link
                      href={`/dashboard/clientes?busca=${encodeURIComponent(c.razao_social)}`}
                      className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition border ${
                        (c.total_clientes || 0) > 0
                          ? 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200 shadow-xs'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-500 border-slate-200'
                      }`}
                      title={`Ver clientes atendidos por ${c.razao_social}`}
                    >
                      <Users size={14} className={c.total_clientes > 0 ? 'text-blue-600' : 'text-slate-400'} />
                      <span>{c.total_clientes || 0}</span>
                      <span className="text-[10px] font-semibold text-slate-400">
                        {c.total_clientes === 1 ? 'cliente' : 'clientes'}
                      </span>
                    </Link>
                  </td>

                  <td className="p-4 text-slate-700 font-mono text-xs">{c.cnpj || '—'}</td>
                  <td className="p-4 text-slate-600 text-xs">
                    <div>{c.whatsapp || c.telefone || '—'}</div>
                    <div className="text-slate-400">{c.email_contato}</div>
                  </td>
                  <td className="p-4 text-slate-600 text-xs">
                    <div className="font-medium text-slate-800">{c.nome_responsavel || '—'}</div>
                    {c.crc && <div className="text-emerald-700 font-semibold">{c.crc}</div>}
                  </td>
                  <td className="p-4 text-slate-600 text-xs font-mono">{c.login_email || '—'}</td>
                  <td className="p-4 text-right">
                    <div className="flex gap-2 justify-end">
                      <Link href={`/dashboard/contabilidades/${c.id}/editar`} className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition" title="Editar">
                        <Pencil size={16} />
                      </Link>
                      <button onClick={() => setDeleteModal({ open: true, id: c.id, nome: c.razao_social })} className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition" title="Excluir">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de Confirmação de Exclusão */}
      {deleteModal.open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold text-slate-900">Confirmar Exclusão</h3>
              <button onClick={() => setDeleteModal({ open: false, id: '', nome: '' })} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <p className="text-slate-600 mb-6">
              Tem certeza que deseja excluir a contabilidade <strong className="text-red-600">{deleteModal.nome}</strong>? 
              Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteModal({ open: false, id: '', nome: '' })} className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition font-medium">
                Cancelar
              </button>
              <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition font-medium disabled:opacity-50">
                {deleting ? 'Excluindo...' : 'Sim, Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
