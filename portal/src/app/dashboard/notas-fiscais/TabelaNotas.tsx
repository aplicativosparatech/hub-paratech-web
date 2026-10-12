'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useSearchParams } from 'next/navigation'
import { RefreshCw } from 'lucide-react'

function AssinaturaChip({ ok }: { ok: boolean }) {
  return ok
    ? <span className="text-green-600 font-bold">✅</span>
    : <span className="text-red-500">❌</span>
}

function TabelaNotas({ tabela, label }: { tabela: string, label: string }) {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const clienteIdParam = searchParams.get('cliente_id')
  const [notas, setNotas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Controle de Papel e Filtro de Cliente
  const [userRole, setUserRole] = useState<'admin' | 'contabilidade' | 'cliente'>('admin')
  const [clientes, setClientes] = useState<any[]>([])
  const [selectedCliente, setSelectedCliente] = useState<string>(clienteIdParam || '')
  const [clientSearchTerm, setClientSearchTerm] = useState('')

  // Carrega Clientes disponíveis de acordo com o perfil
  useEffect(() => {
    async function loadUserAndClients() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role, cliente_id, contabilidade_id')
        .eq('user_id', user.id)
        .single()

      const role = (roleData?.role as any) || 'admin'
      setUserRole(role)

      if (role === 'cliente' && roleData?.cliente_id) {
        setSelectedCliente(roleData.cliente_id)
        const { data: cli } = await supabase
          .from('clientes')
          .select('id, razao_social, nome_fantasia, cnpj')
          .eq('id', roleData.cliente_id)
          .single()
        if (cli) setClientes([cli])
      } else if (role === 'contabilidade' && roleData?.contabilidade_id) {
        const { data: clis } = await supabase
          .from('clientes')
          .select('id, razao_social, nome_fantasia, cnpj')
          .eq('contabilidade_id', roleData.contabilidade_id)
          .order('razao_social')
        if (clis) {
          setClientes(clis)
          if (!clienteIdParam && clis.length > 0) {
            setSelectedCliente(clis[0].id)
          }
        }
      } else {
        // Admin: busca todos os clientes
        const { data: clis } = await supabase
          .from('clientes')
          .select('id, razao_social, nome_fantasia, cnpj')
          .order('razao_social')
        if (clis) {
          setClientes(clis)
          if (!clienteIdParam && clis.length > 0) {
            setSelectedCliente('') // vazio = Todos os clientes ou pode escolher um específico
          }
        }
      }
    }
    loadUserAndClients()
  }, [])

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role, cliente_id, contabilidade_id')
      .eq('user_id', user.id)
      .single()

    let query = supabase.from(tabela).select('*').order('data_emissao', { ascending: false })

    if (roleData?.role === 'cliente') {
      query = query.eq('cliente_id', roleData.cliente_id)
    } else if (roleData?.role === 'contabilidade') {
      if (selectedCliente) {
        query = query.eq('cliente_id', selectedCliente)
      } else {
        const { data: clis } = await supabase
          .from('clientes')
          .select('id')
          .eq('contabilidade_id', roleData.contabilidade_id)
        const ids = clis?.map((c: any) => c.id) || []
        if (ids.length === 0) { setNotas([]); setLoading(false); return }
        query = query.in('cliente_id', ids)
      }
    } else {
      // Admin: se escolheu um cliente específico, filtra por ele. Senão, mostra todos!
      if (selectedCliente) {
        query = query.eq('cliente_id', selectedCliente)
      }
    }

    const { data } = await query
    setNotas(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [tabela, selectedCliente])

  async function handleDeleteNota(id: string, numero: string) {
    if (!confirm(`Deseja realmente excluir a nota número ${numero || id}?`)) return
    const { error } = await supabase.from(tabela).delete().eq('id', id)
    if (error) {
      alert('Erro ao excluir: ' + error.message)
    } else {
      setNotas(prev => prev.filter(n => n.id !== id))
    }
  }

  return (
    <div className="space-y-4">
      {/* Barra de Filtro de Clientes para Admin e Contabilidade */}
      {userRole !== 'cliente' && clientes.length > 0 && (
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex-1 max-w-lg space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                {userRole === 'admin' ? '🔍 Localizar Cliente (Admin)' : '🏢 Empresa Selecionada'}
              </span>
              {userRole === 'admin' && (
                <span className="text-[11px] text-blue-600 font-medium">
                  {selectedCliente ? 'Filtrado por empresa' : 'Exibindo todas as empresas'}
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              {userRole === 'admin' && (
                <input
                  type="text"
                  placeholder="Buscar por nome ou CNPJ..."
                  value={clientSearchTerm}
                  onChange={e => setClientSearchTerm(e.target.value)}
                  className="w-full sm:w-1/2 bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}

              <select
                value={selectedCliente}
                onChange={e => setSelectedCliente(e.target.value)}
                className={`w-full ${userRole === 'admin' ? 'sm:w-1/2' : ''} bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium`}
              >
                {userRole === 'admin' && (
                  <option value="">-- Todos os Clientes --</option>
                )}
                {clientes
                  .filter(c => {
                    if (!clientSearchTerm) return true
                    const term = clientSearchTerm.toLowerCase()
                    return (
                      (c.razao_social && c.razao_social.toLowerCase().includes(term)) ||
                      (c.nome_fantasia && c.nome_fantasia.toLowerCase().includes(term)) ||
                      (c.cnpj && c.cnpj.includes(term))
                    )
                  })
                  .map(c => (
                    <option key={c.id} value={c.id}>
                      {c.razao_social} {c.nome_fantasia ? `(${c.nome_fantasia})` : ''}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="text-xs text-slate-500 text-right sm:self-end">
            <span className="font-semibold text-slate-700">{notas.length}</span> notas carregadas
          </div>
        </div>
      )}

      {/* Identificação de Empresa para o perfil Cliente */}
      {userRole === 'cliente' && clientes.length > 0 && (
        <div className="bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-700 font-medium">
          Empresa Titular: <strong className="text-slate-900">{clientes[0].razao_social}</strong> ({clientes[0].cnpj})
        </div>
      )}

      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-800">{label}</h2>
        <button onClick={load} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition">
          <RefreshCw size={16} /> Atualizar
        </button>
      </div>

      {loading ? (
        <div className="text-slate-400 py-8 text-center animate-pulse">Carregando notas...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
              <tr>
                <th className="p-4">Número</th>
                <th className="p-4">Chave de Acesso</th>
                <th className="p-4">Emitente (CNPJ)</th>
                <th className="p-4">Valor (R$)</th>
                <th className="p-4">Emissão</th>
                <th className="p-4">Transmissão</th>
                <th className="p-4 text-center">Assinatura</th>
                <th className="p-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {notas.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    Nenhuma nota encontrada. O Hub ainda não enviou dados para esta seção.
                  </td>
                </tr>
              ) : notas.map(n => {
                const isDivergente = Boolean(n.cnpj_divergente)
                return (
                  <tr 
                    key={n.id} 
                    className={`border-b transition ${isDivergente ? 'bg-red-50 hover:bg-red-100/80 text-red-900 border-red-200' : 'border-slate-100 hover:bg-slate-50'}`}
                  >
                    <td className="p-4 font-mono">
                      <div className="flex items-center gap-2">
                        {n.numero || '—'}
                        {isDivergente && (
                          <span className="bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded uppercase">
                            CNPJ Não Pertence à Empresa
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 font-mono text-xs text-slate-500" title={n.chave}>
                      {n.chave ? n.chave.substring(0, 22) + '...' : '—'}
                    </td>
                    <td className="p-4 font-mono text-xs">
                      {n.cnpj_emitente || '—'}
                    </td>
                    <td className="p-4 font-medium">R$ {Number(n.valor || 0).toFixed(2)}</td>
                    <td className="p-4">{n.data_emissao ? new Date(n.data_emissao).toLocaleDateString('pt-BR') : '—'}</td>
                    <td className="p-4">{n.data_transmissao ? new Date(n.data_transmissao).toLocaleDateString('pt-BR') : '—'}</td>
                    <td className="p-4 text-center"><AssinaturaChip ok={n.tem_assinatura} /></td>
                    <td className="p-4 text-center">
                      <button 
                        onClick={() => handleDeleteNota(n.id, n.numero)}
                        className="p-1.5 rounded-lg text-red-500 hover:bg-red-100 hover:text-red-700 transition" 
                        title="Excluir XML"
                      >
                        <span className="font-bold text-sm">✕</span>
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default TabelaNotas
