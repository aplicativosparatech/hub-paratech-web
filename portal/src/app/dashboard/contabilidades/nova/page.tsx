'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import toast from 'react-hot-toast'

export default function NovaContabilidadePage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  const [formData, setFormData] = useState({
    razao_social: '',
    cnpj: '',
    email_contato: '',
    login_email: '',
    login_senha: '',
    logo_url: ''
  })
  const [logoFile, setLogoFile] = useState<File | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    let finalLogoUrl = ''
    if (logoFile) {
      const fileName = `${Date.now()}_${logoFile.name}`
      const { data: uploadData, error: uploadError } = await supabase.storage.from('logos').upload(fileName, logoFile)
      if (uploadError) {
        toast.error('Erro ao enviar logo: ' + uploadError.message)
        setLoading(false)
        return
      }
      finalLogoUrl = supabase.storage.from('logos').getPublicUrl(fileName).data.publicUrl
    }

    // Remover os campos virtuais de login antes de inserir no DB
    const { login_email, login_senha, ...contabilidadeData } = formData
    const payload = { ...contabilidadeData, logo_url: finalLogoUrl }
    
    // 1. Criar contabilidade
    const { data: contResult, error } = await supabase.from('contabilidades').insert([payload]).select().single()
    
    if (error) {
      toast.error('Erro ao salvar contabilidade: ' + error.message)
      setLoading(false)
      return
    }

    // 2. Criar usuário de acesso
    if (login_email && login_senha) {
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: login_email,
          password: login_senha,
          role: 'contabilidade',
          entity_id: contResult.id
        })
      })

      if (!res.ok) {
        const errorData = await res.json()
        toast.error('Criada, mas erro no Acesso: ' + errorData.error)
        setLoading(false)
        return
      }
    }

    toast.success('Contabilidade salva com sucesso!')
    router.push('/dashboard/contabilidades')
  }

  return (
    <div className="p-8 max-w-2xl">
      <Link href="/dashboard/contabilidades" className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900 mb-6 transition">
        <ArrowLeft size={16} /> Voltar
      </Link>
      
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Nova Contabilidade</h1>
      </header>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Razão Social</label>
            <input 
              required type="text" 
              className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.razao_social} onChange={e => setFormData({...formData, razao_social: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">CNPJ</label>
            <input 
              required type="text" 
              className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.cnpj} onChange={e => setFormData({...formData, cnpj: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">E-mail de Contato</label>
            <input 
              type="email" 
              className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.email_contato} onChange={e => setFormData({...formData, email_contato: e.target.value})}
            />
          </div>

          <div className="border-t border-slate-200 pt-4 mt-4">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Dados de Acesso e Marca</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">E-mail de Login</label>
                <input 
                  type="email" 
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={formData.login_email} onChange={e => setFormData({...formData, login_email: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Senha de Login</label>
                <input 
                  type="password" 
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={formData.login_senha} onChange={e => setFormData({...formData, login_senha: e.target.value})}
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Logomarca (opcional)</label>
              <input 
                type="file" accept="image/*"
                className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                onChange={e => {
                  if (e.target.files && e.target.files.length > 0) {
                    setLogoFile(e.target.files[0])
                  }
                }}
              />
            </div>
          </div>

          <div className="pt-4">
            <button 
              type="submit" disabled={loading}
              className="w-full bg-blue-600 text-white font-medium py-3 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              {loading ? 'Salvando...' : 'Salvar Contabilidade'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
