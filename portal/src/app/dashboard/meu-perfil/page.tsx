'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import toast from 'react-hot-toast'
import { Save } from 'lucide-react'

export default function MeuPerfilPage() {
  const supabase = createClient()
  const [role, setRole] = useState<string | null>(null)
  const [entityId, setEntityId] = useState<string | null>(null)
  const [formData, setFormData] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role, cliente_id, contabilidade_id')
        .eq('user_id', user.id)
        .single()

      if (!roleData) return
      setRole(roleData.role)

      if (roleData.role === 'cliente' && roleData.cliente_id) {
        setEntityId(roleData.cliente_id)
        const { data } = await supabase.from('clientes').select('nome_fantasia, cnpj, telefone, email, endereco').eq('id', roleData.cliente_id).single()
        if (data) setFormData(data)
      } else if (roleData.role === 'contabilidade' && roleData.contabilidade_id) {
        setEntityId(roleData.contabilidade_id)
        const { data } = await supabase.from('contabilidades').select('razao_social, cnpj, email_contato').eq('id', roleData.contabilidade_id).single()
        if (data) setFormData(data)
      }
      setLoading(false)
    }
    load()
  }, [])

  async function handleSave() {
    if (!entityId || !role) return
    setSaving(true)
    const table = role === 'cliente' ? 'clientes' : 'contabilidades'
    const { error } = await supabase.from(table).update(formData).eq('id', entityId)
    if (error) toast.error('Erro ao salvar: ' + error.message)
    else toast.success('Perfil atualizado com sucesso!')
    setSaving(false)
  }

  if (loading) return <div className="p-8 text-slate-500">Carregando...</div>

  const fields = role === 'cliente'
    ? [
        { key: 'nome_fantasia', label: 'Nome Fantasia' },
        { key: 'cnpj', label: 'CNPJ' },
        { key: 'telefone', label: 'Telefone' },
        { key: 'email', label: 'E-mail' },
        { key: 'endereco', label: 'Endereço' },
      ]
    : [
        { key: 'razao_social', label: 'Razão Social' },
        { key: 'cnpj', label: 'CNPJ' },
        { key: 'email_contato', label: 'E-mail de Contato' },
      ]

  return (
    <div className="p-8 max-w-2xl">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Meu Perfil</h1>
        <p className="text-slate-500 mt-1">Atualize seus dados cadastrais.</p>
      </header>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-5">
        {fields.map(f => (
          <div key={f.key}>
            <label className="block text-sm font-medium text-slate-700 mb-1">{f.label}</label>
            <input
              type="text"
              value={formData[f.key] || ''}
              onChange={e => setFormData({ ...formData, [f.key]: e.target.value })}
              className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        ))}

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50"
        >
          <Save size={18} /> {saving ? 'Salvando...' : 'Salvar Alterações'}
        </button>
      </div>
    </div>
  )
}
