'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Pencil, Trash2, X } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import toast from 'react-hot-toast'

export default function ContabilidadesPage() {
  const [contabilidades, setContabilidades] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; id: string; nome: string }>({ open: false, id: '', nome: '' })
  const [deleting, setDeleting] = useState(false)
  const supabase = createClient()

  async function fetchContabilidades() {
    const { data } = await supabase.from('contabilidades').select('*').order('created_at', { ascending: false })
    if (data) setContabilidades(data)
    setLoading(false)
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
          <p className="text-slate-500 mt-1">Escritórios contábeis vinculados aos clientes.</p>
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
              <th className="p-4 font-semibold text-slate-600 text-sm">Razão Social</th>
              <th className="p-4 font-semibold text-slate-600 text-sm">CNPJ</th>
              <th className="p-4 font-semibold text-slate-600 text-sm">E-mail</th>
              <th className="p-4 font-semibold text-slate-600 text-sm">Login</th>
              <th className="p-4 font-semibold text-slate-600 text-sm text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="p-8 text-center text-slate-500">Carregando...</td></tr>
            ) : contabilidades.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-slate-500">Nenhuma contabilidade cadastrada ainda.</td></tr>
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
                  <td className="p-4 text-slate-800 font-medium">{c.razao_social}</td>
                  <td className="p-4 text-slate-600">{c.cnpj}</td>
                  <td className="p-4 text-slate-600">{c.email_contato}</td>
                  <td className="p-4 text-slate-600 text-xs">{c.login_email || '—'}</td>
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
