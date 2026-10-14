'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Building2, Save, Search, Eye, EyeOff, UserCheck, MapPin } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import toast from 'react-hot-toast'
import { limparDocumento, formatarCnpjCpf, validarCnpj, isCnpjAlfanumerico } from '@/utils/cnpjAlfanumerico'

export default function EditarContabilidadePage() {
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [searchingCnpj, setSearchingCnpj] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [currentLogo, setCurrentLogo] = useState('')

  const [formData, setFormData] = useState({
    razao_social: '',
    nome_fantasia: '',
    cnpj: '',
    email_contato: '',
    telefone: '',
    whatsapp: '',
    nome_responsavel: '',
    cpf_responsavel: '',
    crc: '',
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    uf: '',
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
          nome_fantasia: data.nome_fantasia || '',
          cnpj: data.cnpj || '',
          email_contato: data.email_contato || '',
          telefone: data.telefone || '',
          whatsapp: data.whatsapp || '',
          nome_responsavel: data.nome_responsavel || '',
          cpf_responsavel: data.cpf_responsavel || '',
          crc: data.crc || '',
          cep: data.cep || '',
          logradouro: data.logradouro || '',
          numero: data.numero || '',
          complemento: data.complemento || '',
          bairro: data.bairro || '',
          cidade: data.cidade || '',
          uf: data.uf || '',
          login_email: data.login_email || '',
          login_senha: '',
          logo_url: data.logo_url || ''
        })
        if (data.logo_url) setCurrentLogo(data.logo_url)
      }
      setLoading(false)
    }
    loadData()
  }, [params.id])

  // Consulta automática de CNPJ (com suporte a CNPJ Alfanumérico)
  const handleConsultarCnpj = async () => {
    const rawCnpj = limparDocumento(formData.cnpj)
    if (rawCnpj.length !== 14) {
      toast.error('Informe um CNPJ válido com 14 caracteres.')
      return
    }

    if (!validarCnpj(rawCnpj)) {
      toast.error('CNPJ inválido de acordo com as regras de dígito verificador da Receita Federal.')
      return
    }

    const cnpjFormatado = formatarCnpjCpf(rawCnpj)

    if (isCnpjAlfanumerico(rawCnpj)) {
      setFormData(prev => ({
        ...prev,
        cnpj: cnpjFormatado
      }))
      toast.success('CNPJ Alfanumérico validado com sucesso (IN RFB nº 2.229/2024)! Complete os dados cadastrais.')
      return
    }

    setSearchingCnpj(true)
    const toastId = toast.loading('Consultando escritório contábil na Receita Federal...')
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${rawCnpj}`)
      if (!res.ok) throw new Error('Não foi possível obter dados para este CNPJ.')
      const data = await res.json()

      const tel = data.ddd_telefone_1 ? `(${data.ddd_telefone_1.substring(0, 2)}) ${data.ddd_telefone_1.substring(2)}` : ''
      const wpp = data.ddd_telefone_1 ? `55${data.ddd_telefone_1.replace(/\D/g, '')}` : ''

      setFormData(prev => ({
        ...prev,
        cnpj: cnpjFormatado,
        razao_social: data.razao_social || prev.razao_social,
        nome_fantasia: data.nome_fantasia || data.razao_social || prev.nome_fantasia,
        email_contato: data.email || prev.email_contato,
        telefone: tel || prev.telefone,
        whatsapp: wpp || prev.whatsapp,
        cep: data.cep ? data.cep.replace(/\D/g, '') : prev.cep,
        logradouro: data.logradouro || prev.logradouro,
        numero: data.numero || prev.numero,
        complemento: data.complemento || prev.complemento,
        bairro: data.bairro || prev.bairro,
        cidade: data.municipio || prev.cidade,
        uf: data.uf || prev.uf
      }))

      toast.success('Dados preenchidos com sucesso!', { id: toastId })
    } catch (err: any) {
      setFormData(prev => ({ ...prev, cnpj: cnpjFormatado }))
      toast.error(err.message || 'Erro ao consultar CNPJ. Preencha os campos manualmente.', { id: toastId })
    } finally {
      setSearchingCnpj(false)
    }
  }

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

    const { login_email, login_senha, ...contabData } = formData

    const payload = {
      ...contabData,
      logo_url: finalLogoUrl
    }

    const { error } = await supabase.from('contabilidades').update(payload).eq('id', params.id)
    
    if (error) {
      toast.error('Erro ao salvar: ' + error.message)
      setSaving(false)
      return
    }

    // Atualizar o acesso do usuário
    if (login_email && login_email.trim() !== '') {
      const res = await fetch('/api/admin/update-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: login_email,
          password: login_senha && login_senha.trim() !== '' ? login_senha : undefined,
          role: 'contabilidade',
          entity_id: params.id
        })
      })

      if (!res.ok) {
        const errorData = await res.json()
        toast.error('Erro ao configurar Acesso: ' + errorData.error)
      }
    }

    toast.success('Contabilidade atualizada com sucesso!')
    router.push('/dashboard/contabilidades')
  }

  if (loading) return <div className="p-8 text-slate-500">Carregando escritório contábil...</div>

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <Link href="/dashboard/contabilidades" className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900 transition font-medium">
          <ArrowLeft size={18} /> Voltar para lista de contabilidades
        </Link>
      </div>
      
      <header className="mb-2">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
          <Building2 className="text-blue-600" size={30} />
          Editar Contabilidade
        </h1>
        <p className="text-slate-500 text-sm mt-1">Atualize os dados cadastrais, endereço e o acesso dos contadores aos XMLs dos clientes vinculados.</p>
      </header>

      {/* Card Expandido */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 w-full">
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {currentLogo && (
            <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
              <img src={currentLogo} alt="Logo atual" className="w-16 h-16 rounded-xl object-cover border border-slate-200 shadow-sm" />
              <div>
                <p className="text-sm font-semibold text-slate-800">Logomarca Atual do Escritório</p>
                <p className="text-xs text-slate-400">Exibida no portal da contabilidade</p>
              </div>
            </div>
          )}

          {/* Dados do Escritório */}
          <div>
            <h3 className="text-base font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100 flex items-center gap-2">
              <Building2 className="text-blue-600" size={20} />
              Dados do Escritório Contábil
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              
              {/* CNPJ com Consulta */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">CNPJ</label>
                <div className="flex gap-2">
                  <input 
                    required 
                    type="text" 
                    placeholder="00.000.000/0000-00"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
                    value={formData.cnpj} 
                    onChange={e => setFormData({...formData, cnpj: e.target.value})} 
                  />
                  <button
                    type="button"
                    onClick={handleConsultarCnpj}
                    disabled={searchingCnpj}
                    title="Buscar dados do CNPJ na Receita Federal via BrasilAPI"
                    className="px-3.5 py-2.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl font-semibold flex items-center justify-center transition border border-blue-200 disabled:opacity-50"
                  >
                    <Search size={18} className={searchingCnpj ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Razão Social</label>
                <input required type="text" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
                  value={formData.razao_social} onChange={e => setFormData({...formData, razao_social: e.target.value})} />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Nome Fantasia</label>
                <input type="text" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
                  value={formData.nome_fantasia} onChange={e => setFormData({...formData, nome_fantasia: e.target.value})} />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">E-mail Comercial</label>
                <input type="email" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
                  value={formData.email_contato} onChange={e => setFormData({...formData, email_contato: e.target.value})} />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Telefone Fixo</label>
                <input type="text" placeholder="(00) 0000-0000" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
                  value={formData.telefone} onChange={e => setFormData({...formData, telefone: e.target.value})} />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">WhatsApp de Contato</label>
                <input type="text" placeholder="5511999999999" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
                  value={formData.whatsapp} onChange={e => setFormData({...formData, whatsapp: e.target.value})} />
              </div>

              <div className="md:col-span-3">
                <label className="block text-sm font-semibold text-slate-700 mb-1">Alterar Logomarca</label>
                <input type="file" accept="image/*" className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50 text-sm"
                  onChange={e => { if (e.target.files && e.target.files.length > 0) setLogoFile(e.target.files[0]) }} />
              </div>
            </div>
          </div>

          {/* Dados do Contador Responsável */}
          <div className="pt-4 border-t border-slate-100">
            <h3 className="text-base font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100 flex items-center gap-2">
              <UserCheck className="text-emerald-600" size={20} />
              Contador / Responsável Técnico
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Nome do Contador / Responsável</label>
                <input type="text" placeholder="Ex: Carlos Alberto" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
                  value={formData.nome_responsavel} onChange={e => setFormData({...formData, nome_responsavel: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">CPF do Contador</label>
                <input type="text" placeholder="000.000.000-00" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
                  value={formData.cpf_responsavel} onChange={e => setFormData({...formData, cpf_responsavel: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Registro CRC</label>
                <input type="text" placeholder="Ex: CRC-SP 123456/O" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
                  value={formData.crc} onChange={e => setFormData({...formData, crc: e.target.value})} />
              </div>
            </div>
          </div>

          {/* Endereço */}
          <div className="pt-4 border-t border-slate-100">
            <h3 className="text-base font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100 flex items-center gap-2">
              <MapPin className="text-amber-600" size={20} />
              Endereço do Escritório
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">CEP</label>
                <input type="text" placeholder="00000-000" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
                  value={formData.cep} onChange={e => setFormData({...formData, cep: e.target.value})} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-1">Logradouro (Rua / Av.)</label>
                <input type="text" placeholder="Rua das Flores" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
                  value={formData.logradouro} onChange={e => setFormData({...formData, logradouro: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Número</label>
                <input type="text" placeholder="123" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
                  value={formData.numero} onChange={e => setFormData({...formData, numero: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Bairro</label>
                <input type="text" placeholder="Centro" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
                  value={formData.bairro} onChange={e => setFormData({...formData, bairro: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Cidade</label>
                <input type="text" placeholder="São Paulo" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
                  value={formData.cidade} onChange={e => setFormData({...formData, cidade: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">UF (Estado)</label>
                <input type="text" placeholder="SP" maxLength={2} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50 uppercase"
                  value={formData.uf} onChange={e => setFormData({...formData, uf: e.target.value.toUpperCase()})} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Complemento</label>
                <input type="text" placeholder="Sala 101" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
                  value={formData.complemento} onChange={e => setFormData({...formData, complemento: e.target.value})} />
              </div>
            </div>
          </div>

          {/* Credenciais de Acesso */}
          <div className="pt-4 border-t border-slate-100">
            <h3 className="text-base font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100">
              Credenciais de Acesso ao Portal do Contador
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">E-mail de Login</label>
                <input type="email" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
                  value={formData.login_email} onChange={e => setFormData({...formData, login_email: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Nova Senha de Login (deixe vazio para manter a atual)</label>
                <div className="relative">
                  <input 
                    type={showPassword ? 'text' : 'password'} 
                    placeholder="Mínimo 6 caracteres" 
                    className="w-full px-4 py-2.5 pr-11 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
                    value={formData.login_senha} 
                    onChange={e => setFormData({...formData, login_senha: e.target.value})} 
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    title={showPassword ? 'Ocultar senha' : 'Ver senha'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 flex justify-end">
            <button 
              type="submit" 
              disabled={saving}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
            >
              <Save size={18} />
              {saving ? 'Salvando alterações...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
