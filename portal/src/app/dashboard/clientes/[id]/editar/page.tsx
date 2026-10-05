'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import toast from 'react-hot-toast'

export default function EditarClientePage() {
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [contabilidades, setContabilidades] = useState<any[]>([])
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [currentLogo, setCurrentLogo] = useState('')

  const [formData, setFormData] = useState({
    razao_social: '',
    nome_fantasia: '',
    cnpj: '',
    nome_sistema_utilizado: '',
    contabilidade_id: '',
    login_email: '',
    login_senha: '',
    is_ativo: true,
    logo_url: ''
  })

  useEffect(() => {
    async function loadData() {
      const [clienteRes, contabRes] = await Promise.all([
        supabase.from('clientes').select('*').eq('id', params.id).single(),
        supabase.from('contabilidades').select('id, razao_social')
      ])
      if (clienteRes.data) {
        const d = clienteRes.data
        setFormData({
          razao_social: d.razao_social || '',
          nome_fantasia: d.nome_fantasia || '',
          cnpj: d.cnpj || '',
          nome_sistema_utilizado: d.nome_sistema_utilizado || '',
          contabilidade_id: d.contabilidade_id || '',
          login_email: d.login_email || '',
          login_senha: d.login_senha || '',
          is_ativo: d.is_ativo,
          logo_url: d.logo_url || ''
        })
        setCurrentLogo(d.logo_url || '')
      }
      if (contabRes.data) setContabilidades(contabRes.data)
      setLoading(false)
    }
    loadData()
  }, [params.id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    let finalLogoUrl = formData.logo_url
    if (logoFile) {
      const fileName = `${Date.now()}_${logoFile.name}`
      const { error: uploadError } = await supabase.storage.from('logos').upload(fileName, logoFile)
      if (uploadError) {
        toast.error('Erro ao enviar logo: ' + uploadError.message)
        setSaving(false)
        return
      }
      finalLogoUrl = supabase.storage.from('logos').getPublicUrl(fileName).data.publicUrl
    }

    const { login_email, login_senha, ...clienteData } = formData

    const payload = {
      ...clienteData,
      contabilidade_id: clienteData.contabilidade_id || null,
      logo_url: finalLogoUrl
    }

    const { error } = await supabase.from('clientes').update(payload).eq('id', params.id)
    
    if (error) {
      toast.error('Erro ao salvar: ' + error.message)
      setSaving(false)
      return
    }

    // Atualizar o acesso do usuário
    if (login_email) {
      const res = await fetch('/api/admin/update-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: login_email,
          password: login_senha || undefined, // Se vazio, nao atualiza
          role: 'cliente',
          entity_id: params.id
        })
      })

      if (!res.ok) {
        const errorData = await res.json()
        toast.error('Erro ao configurar Acesso: ' + errorData.error)
      }
    }

    toast.success('Cliente atualizado com sucesso!')
    router.push('/dashboard/clientes')
  }

  if (loading) return <div className="p-8 text-slate-500">Carregando...</div>

  return (
    <div className="p-8 max-w-2xl">
      <Link href="/dashboard/clientes" className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900 mb-6 transition">
        <ArrowLeft size={16} /> Voltar
      </Link>
      
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Editar Cliente</h1>
      </header>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {currentLogo && (
            <div className="flex items-center gap-4 mb-4">
              <img src={currentLogo} alt="Logo atual" className="w-16 h-16 rounded-full object-cover border border-slate-200" />
              <span className="text-sm text-slate-500">Logo atual</span>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Razão Social</label>
            <input required type="text" className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.razao_social} onChange={e => setFormData({...formData, razao_social: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nome Fantasia</label>
            <input type="text" className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.nome_fantasia} onChange={e => setFormData({...formData, nome_fantasia: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">CNPJ</label>
            <input required type="text" className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.cnpj} onChange={e => setFormData({...formData, cnpj: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nome do Sistema Monitorado</label>
            <input required type="text" className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.nome_sistema_utilizado} onChange={e => setFormData({...formData, nome_sistema_utilizado: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Vincular a uma Contabilidade</label>
            <select className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.contabilidade_id} onChange={e => setFormData({...formData, contabilidade_id: e.target.value})}>
              <option value="">Nenhuma</option>
              {contabilidades.map(c => (
                <option key={c.id} value={c.id}>{c.razao_social}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
            <select className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.is_ativo ? 'true' : 'false'} onChange={e => setFormData({...formData, is_ativo: e.target.value === 'true'})}>
              <option value="true">Ativo</option>
              <option value="false">Bloqueado</option>
            </select>
          </div>

          <div className="border-t border-slate-200 pt-4 mt-4">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Dados de Acesso e Marca</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">E-mail de Login</label>
                <input type="email" className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={formData.login_email} onChange={e => setFormData({...formData, login_email: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Senha de Login</label>
                <input type="password" className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={formData.login_senha} onChange={e => setFormData({...formData, login_senha: e.target.value})} />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Alterar Logomarca</label>
              <input type="file" accept="image/*" className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                onChange={e => { if (e.target.files && e.target.files.length > 0) setLogoFile(e.target.files[0]) }} />
            </div>
          </div>

          <div className="pt-4">
            <button type="submit" disabled={saving}
              className="w-full bg-blue-600 text-white font-medium py-3 rounded-lg hover:bg-blue-700 transition disabled:opacity-50">
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
