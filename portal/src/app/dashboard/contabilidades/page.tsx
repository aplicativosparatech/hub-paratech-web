'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Pencil, Trash2, X, Users, Building2, Upload } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import toast from 'react-hot-toast'
import ImportadorLoteModal from '@/components/ImportadorLoteModal'
import { useTableFeatures } from '@/hooks/useTableFeatures'
import { ResizableSortableTh } from '@/components/ui/ResizableSortableTh'

export default function ContabilidadesPage() {
  const [contabilidades, setContabilidades] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; id: string; nome: string }>({ open: false, id: '', nome: '' })
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const supabase = createClient()

  const {
    sortedData: contabilidadesOrdenadas,
    sortKey,
    sortDirection,
    handleSort,
    columnWidths,
    handleResizeColumn
  } = useTableFeatures({
    data: contabilidades,
    tableId: 'tabela_contabilidades',
    defaultSortKey: 'razao_social',
    defaultSortDirection: 'asc',
    initialWidths: {
      logo: 70,
      escritorio: 260,
      clientes: 150,
      cnpj: 160,
      contato: 190,
      contador: 170,
      login: 180,
      acoes: 100
    },
    customExtractors: {
      escritorio: (c: any) => c.razao_social || '',
      clientes: (c: any) => Number(c.total_clientes || 0),
      cnpj: (c: any) => c.cnpj || '',
      contato: (c: any) => c.whatsapp || c.telefone || '',
      contador: (c: any) => c.nome_responsavel || '',
      login: (c: any) => c.login_email || ''
    }
  })

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
        
        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={() => setImportModalOpen(true)}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg font-medium transition flex items-center gap-2 border border-slate-300"
            title="Importar arquivo CSV, TXT, JSON, XLS ou XLSX de CNPJs ou contabilidades"
          >
            <Upload size={18} />
            <span>Importar Arquivo / CNPJs</span>
          </button>
          <Link href="/dashboard/contabilidades/nova" className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition flex items-center gap-2">
            <Plus size={20} />
            Nova Contabilidade
          </Link>
        </div>
      </header>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse" style={{ tableLayout: 'fixed' }}>
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <ResizableSortableTh
                  columnId="logo"
                  label="Logo"
                  disableSort
                  width={columnWidths.logo}
                  onResize={handleResizeColumn}
                  minWidth={60}
                />
                <ResizableSortableTh
                  columnId="escritorio"
                  label="Escritório / Fantasia"
                  sortKey="escritorio"
                  currentSortKey={sortKey}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                  width={columnWidths.escritorio}
                  onResize={handleResizeColumn}
                  minWidth={180}
                />
                <ResizableSortableTh
                  columnId="clientes"
                  label="Clientes Atribuídos"
                  sortKey="clientes"
                  currentSortKey={sortKey}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                  width={columnWidths.clientes}
                  onResize={handleResizeColumn}
                  minWidth={130}
                  align="center"
                />
                <ResizableSortableTh
                  columnId="cnpj"
                  label="CNPJ"
                  sortKey="cnpj"
                  currentSortKey={sortKey}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                  width={columnWidths.cnpj}
                  onResize={handleResizeColumn}
                  minWidth={130}
                />
                <ResizableSortableTh
                  columnId="contato"
                  label="Contato / WhatsApp"
                  sortKey="contato"
                  currentSortKey={sortKey}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                  width={columnWidths.contato}
                  onResize={handleResizeColumn}
                  minWidth={140}
                />
                <ResizableSortableTh
                  columnId="contador"
                  label="Contador / CRC"
                  sortKey="contador"
                  currentSortKey={sortKey}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                  width={columnWidths.contador}
                  onResize={handleResizeColumn}
                  minWidth={130}
                />
                <ResizableSortableTh
                  columnId="login"
                  label="Login de Acesso"
                  sortKey="login"
                  currentSortKey={sortKey}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                  width={columnWidths.login}
                  onResize={handleResizeColumn}
                  minWidth={140}
                />
                <ResizableSortableTh
                  columnId="acoes"
                  label="Ações"
                  disableSort
                  width={columnWidths.acoes}
                  onResize={handleResizeColumn}
                  minWidth={90}
                  align="right"
                />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="p-8 text-center text-slate-500">Carregando contabilidades e contagem de clientes...</td></tr>
              ) : contabilidadesOrdenadas.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center text-slate-500">Nenhuma contabilidade cadastrada ainda.</td></tr>
              ) : (
                contabilidadesOrdenadas.map(c => (
                  <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="p-4 truncate">
                      {c.logo_url ? (
                        <img src={c.logo_url} alt="Logo" className="w-10 h-10 rounded-full object-cover border border-slate-200" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-400 text-xs font-bold">
                          {c.razao_social?.charAt(0)}
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-slate-800 truncate">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 truncate">{c.razao_social}</span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold ${
                          (c.total_clientes || 0) > 0
                            ? 'bg-blue-100 text-blue-700 border border-blue-200'
                            : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}>
                          <Users size={11} />
                          {c.total_clientes || 0} {c.total_clientes === 1 ? 'cliente' : 'clientes'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 truncate">{c.nome_fantasia || '—'}</div>
                    </td>

                    {/* Coluna de Clientes Atribuídos com Badge em Destaque */}
                    <td className="p-4 text-center truncate">
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

                    <td className="p-4 text-slate-700 font-mono text-xs truncate">{c.cnpj || '—'}</td>
                    <td className="p-4 text-slate-600 text-xs truncate">
                      <div>{c.whatsapp || c.telefone || '—'}</div>
                      <div className="text-slate-400 truncate">{c.email_contato}</div>
                    </td>
                    <td className="p-4 text-slate-600 text-xs truncate">
                      <div className="font-medium text-slate-800 truncate">{c.nome_responsavel || '—'}</div>
                      {c.crc && <div className="text-emerald-700 font-semibold truncate">{c.crc}</div>}
                    </td>
                    <td className="p-4 text-slate-600 text-xs font-mono truncate">{c.login_email || '—'}</td>
                    <td className="p-4 text-right whitespace-nowrap">
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
      {/* Modal de Importação em Lote */}
      <ImportadorLoteModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onSuccess={() => fetchContabilidades()}
        tipo="contabilidade"
      />
    </div>
  )
}
