'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import toast from 'react-hot-toast'

export default function EditarContabilidadePage() {
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [currentLogo, setCurrentLogo] = useState('')

  const [formData, setFormData] = useState({
    razao_social: '',
    cnpj: '',
    email_contato: '',
    login_email: '',
    login_senha: '',
    logo_url: ''
  })

  useEffect(() => {
    async function loadData() {
      const { data } = await supabase.from('contabilidades').select('*').eq('id', params.id).single()
      if (data) {
        setFormData({
          razao_social: data.razao_social || '',
          cnpj: data.cnpj || '',
          email_contato: data.email_contato || '',
          login_email: data.login_email || '',
          login_senha: data.login_senha || '',
          logo_url: data.logo_url || ''
        })
        setCurrentLogo(data.logo_url || '')
      }
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

    const payload = { ...formData, logo_url: finalLogoUrl }
    const { error } = await supabase.from('contabilidades').update(payload).eq('id', params.id)
    
    if (error) {
      toast.error('Erro ao salvar: ' + error.message)
      setSaving(false)
      return
    }

    toast.success('Contabilidade atualizada com sucesso!')
    router.push('/dashboard/contabilidades')
  }

  if (loading) return <div className="p-8 text-slate-500">Carregando...</div>

  return (
    <div className="p-8 max-w-2xl">
      <Link href="/dashboard/contabilidades" className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900 mb-6 transition">
        <ArrowLeft size={16} /> Voltar
      </Link>
      
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Editar Contabilidade</h1>
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
            <label className="block text-sm font-medium text-slate-700 mb-1">CNPJ</label>
            <input required type="text" className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.cnpj} onChange={e => setFormData({...formData, cnpj: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">E-mail de Contato</label>
            <input type="email" className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.email_contato} onChange={e => setFormData({...formData, email_contato: e.target.value})} />
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
