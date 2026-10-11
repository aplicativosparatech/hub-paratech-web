'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import toast from 'react-hot-toast'
import { User, Save } from 'lucide-react'

export default function MeuPerfilPage() {
  const supabase = createClient()
  const [role, setRole] = useState<'cliente' | 'contabilidade' | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState<any>({})
  const [entityId, setEntityId] = useState<string | null>(null)

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (!roleData) return
      setRole(roleData.role)

      if (roleData.role === 'cliente' && roleData.cliente_id) {
        setEntityId(roleData.cliente_id)
        const { data, error } = await supabase.from('clientes').select('nome_fantasia, razao_social, cnpj, whatsapp, login_email').eq('id', roleData.cliente_id).single()
        if (error) console.error('Erro ao buscar cliente:', error)
        if (data) setFormData(data)
      } else if (roleData.role === 'contabilidade' && roleData.contabilidade_id) {
        setEntityId(roleData.contabilidade_id)
        const { data, error } = await supabase.from('contabilidades').select('razao_social, cnpj, email_contato, login_email').eq('id', roleData.contabilidade_id).single()
        if (error) console.error('Erro ao buscar contab:', error)
        if (data) setFormData(data)
      }
      setLoading(false)
    }
    loadProfile()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    const table = role === 'cliente' ? 'clientes' : 'contabilidades'
    const { error } = await supabase
      .from(table)
      .update(formData)
      .eq('id', entityId)

    if (error) {
      toast.error('Erro ao salvar perfil: ' + error.message)
    } else {
      toast.success('Perfil atualizado com sucesso!')
    }
    setSaving(false)
  }

  if (loading) return <div className="p-8 text-slate-500">Carregando perfil...</div>

  const fields = role === 'cliente'
    ? [
        { key: 'razao_social', label: 'Razão Social' },
        { key: 'nome_fantasia', label: 'Nome Fantasia' },
        { key: 'cnpj', label: 'CNPJ' },
        { key: 'whatsapp', label: 'WhatsApp' },
        { key: 'login_email', label: 'E-mail de Login' },
      ]
    : [
        { key: 'razao_social', label: 'Razão Social' },
        { key: 'cnpj', label: 'CNPJ' },
        { key: 'email_contato', label: 'E-mail de Contato' },
        { key: 'login_email', label: 'E-mail de Login' },
      ]

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-300">
      <header className="mb-2">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
          <User className="text-blue-600" size={30} />
          Meu Perfil
        </h1>
        <p className="text-slate-500 text-sm mt-1">Atualize e gerencie os dados cadastrais da sua empresa no portal.</p>
      </header>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 w-full space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {fields.map(f => (
            <div key={f.key}>
              <label className="block text-sm font-semibold text-slate-700 mb-1">{f.label}</label>
              <input
                type="text"
                disabled={f.key === 'login_email' || f.key === 'cnpj'}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-500 bg-slate-50/50"
                value={formData[f.key] || ''}
                onChange={e => setFormData({ ...formData, [f.key]: e.target.value })}
              />
            </div>
          ))}
        </div>

        <div className="pt-4 border-t border-slate-100 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
          >
            <Save size={18} />
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </div>
    </div>
  )
}
