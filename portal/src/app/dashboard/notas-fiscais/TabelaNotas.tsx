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
      if (clienteIdParam) {
        query = query.eq('cliente_id', clienteIdParam)
      } else {
        // Buscar todos os clientes vinculados
        const { data: clientes } = await supabase
          .from('clientes')
          .select('id')
          .eq('contabilidade_id', roleData.contabilidade_id)
        const ids = clientes?.map((c: any) => c.id) || []
        if (ids.length === 0) { setNotas([]); setLoading(false); return }
        query = query.in('cliente_id', ids)
      }
    }
    // admin: sem filtro, busca tudo

    const { data } = await query
    setNotas(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [tabela, clienteIdParam])

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
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
                <th className="p-4">Valor (R$)</th>
                <th className="p-4">Emissão</th>
                <th className="p-4">Transmissão</th>
                <th className="p-4 text-center">Assinatura</th>
              </tr>
            </thead>
            <tbody>
              {notas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    Nenhuma nota encontrada. O Hub ainda não enviou dados para esta seção.
                  </td>
                </tr>
              ) : notas.map(n => (
                <tr key={n.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="p-4 font-mono">{n.numero || '—'}</td>
                  <td className="p-4 font-mono text-xs text-slate-500" title={n.chave}>
                    {n.chave ? n.chave.substring(0, 22) + '...' : '—'}
                  </td>
                  <td className="p-4 font-medium">R$ {Number(n.valor || 0).toFixed(2)}</td>
                  <td className="p-4">{n.data_emissao ? new Date(n.data_emissao).toLocaleDateString('pt-BR') : '—'}</td>
                  <td className="p-4">{n.data_transmissao ? new Date(n.data_transmissao).toLocaleDateString('pt-BR') : '—'}</td>
                  <td className="p-4 text-center"><AssinaturaChip ok={n.tem_assinatura} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default TabelaNotas
