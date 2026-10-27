'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import toast from 'react-hot-toast'
import { 
  User, 
  Save, 
  Building2, 
  MapPin, 
  Phone, 
  Mail, 
  FolderArchive, 
  UserCheck, 
  Shield, 
  Eye, 
  EyeOff, 
  Search, 
  FileBadge, 
  Layers, 
  Lock, 
  ChevronsUpDown, 
  CheckCircle2, 
  AlertTriangle 
} from 'lucide-react'
import CertificadoAlertaBanner from '@/components/CertificadoAlertaBanner'
import { FormAccordionCard } from '@/components/ui/FormAccordionCard'
import { SistemaAutocompleteInput } from '@/components/SistemaAutocompleteInput'
import { sanitizarNomeArquivoStorage } from '@/utils/storageUtils'

export default function MeuPerfilPage() {
  const supabase = createClient()
  const [role, setRole] = useState<'cliente' | 'contabilidade' | 'admin' | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [searchingCep, setSearchingCep] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [novaSenha, setNovaSenha] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [currentLogo, setCurrentLogo] = useState('')
  const [entityId, setEntityId] = useState<string | null>(null)
  const [certAlerta, setCertAlerta] = useState<any>(null)
  const [contabilidadeVinculada, setContabilidadeVinculada] = useState<any>(null)

  // Controle de sanfona para os cards
  const [openCards, setOpenCards] = useState<Record<string, boolean>>({
    empresa: true,
    endereco: true,
    contato: true,
    fiscal_despacho: true,
    certificado: true,
    acesso: true
  })

  const toggleCard = (card: string) => {
    setOpenCards(prev => ({ ...prev, [card]: !prev[card] }))
  }

  const expandAll = () => {
    setOpenCards({
      empresa: true,
      endereco: true,
      contato: true,
      fiscal_despacho: true,
      certificado: true,
      acesso: true
    })
  }

  const collapseAll = () => {
    setOpenCards({
      empresa: false,
      endereco: false,
      contato: false,
      fiscal_despacho: false,
      certificado: false,
      acesso: false
    })
  }

  const [formData, setFormData] = useState<any>({
    // Cliente & Contabilidade comuns
    razao_social: '',
    nome_fantasia: '',
    cnpj: '',
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    uf: '',
    login_email: '',
    logo_url: '',

    // Específicos Cliente
    inscricao_estadual: '',
    regime_tributario: 'simples_nacional',
    ramo_atividade: '',
    nome_sistema_utilizado: '',
    nome_contato: '',
    cpf_contato: '',
    whatsapp: '',
    whatsapp_cobranca: '',
    email_fiscal: '',
    certificado_validade: '',

    // Específicos Contabilidade
    email_contato: '',
    telefone: '',
    nome_responsavel: '',
    cpf_responsavel: '',
    crc: '',
    whatsapp_arquivos_fiscais: '',
    email_arquivos_fiscais: '',
    receber_arquivos_whatsapp: false,
    receber_arquivos_email: false,
    admin_permite_envio_whatsapp: true,
    admin_permite_envio_email: true
  })

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (!roleData) {
        setLoading(false)
        return
      }

      setRole(roleData.role)

      if (roleData.role === 'cliente' && roleData.cliente_id) {
        setEntityId(roleData.cliente_id)
        const { data, error } = await supabase
          .from('clientes')
          .select(`
            *,
            configuracoes_hub(exibir_faixa_topo_certificado, exibir_certificados_cliente),
            contabilidades(id, razao_social, nome_fantasia, email_contato, telefone, whatsapp)
          `)
          .eq('id', roleData.cliente_id)
          .single()

        if (error) console.error('Erro ao buscar dados do cliente:', error)
        if (data) {
          const { configuracoes_hub, contabilidades, ...rest } = data as any
          setFormData((prev: any) => ({ ...prev, ...rest }))
          if (data.logo_url) setCurrentLogo(data.logo_url)
          if (contabilidades) setContabilidadeVinculada(contabilidades)

          const cfg = Array.isArray(configuracoes_hub) ? configuracoes_hub[0] : configuracoes_hub
          if (data.certificado_validade) {
            setCertAlerta({
              validade: data.certificado_validade,
              razaoSocial: data.nome_fantasia || data.razao_social,
              documento: data.cnpj,
              config: cfg
            })
          }
        }
      } else if (roleData.role === 'contabilidade' && roleData.contabilidade_id) {
        setEntityId(roleData.contabilidade_id)
        const { data, error } = await supabase
          .from('contabilidades')
          .select('*')
          .eq('id', roleData.contabilidade_id)
          .single()

        if (error) console.error('Erro ao buscar dados da contabilidade:', error)
        if (data) {
          setFormData((prev: any) => ({
            ...prev,
            ...data,
            receber_arquivos_whatsapp: data.receber_arquivos_whatsapp ?? false,
            receber_arquivos_email: data.receber_arquivos_email ?? false,
            admin_permite_envio_whatsapp: data.admin_permite_envio_whatsapp ?? true,
            admin_permite_envio_email: data.admin_permite_envio_email ?? true
          }))
          if (data.logo_url) setCurrentLogo(data.logo_url)
        }
      } else if (roleData.role === 'admin') {
        setFormData((prev: any) => ({
          ...prev,
          login_email: user.email || ''
        }))
      }
      setLoading(false)
    }

    loadProfile()
  }, [])

  // Consulta automática de CEP via ViaCEP
  const handleConsultarCep = async () => {
    const rawCep = (formData.cep || '').replace(/\D/g, '')
    if (rawCep.length !== 8) {
      toast.error('Informe um CEP válido com 8 dígitos.')
      return
    }

    setSearchingCep(true)
    const toastId = toast.loading('Buscando CEP no ViaCEP...')
    try {
      const res = await fetch(`https://viacep.com.br/ws/${rawCep}/json/`)
      const data = await res.json()
      if (data.erro) {
        throw new Error('CEP não encontrado na base do ViaCEP.')
      }

      setFormData((prev: any) => ({
        ...prev,
        cep: `${rawCep.slice(0, 5)}-${rawCep.slice(5)}`,
        logradouro: data.logradouro || prev.logradouro,
        bairro: data.bairro || prev.bairro,
        cidade: data.localidade || prev.cidade,
        uf: data.uf || prev.uf,
        complemento: data.complemento || prev.complemento
      }))
      toast.success('Endereço preenchido com sucesso!', { id: toastId })
    } catch (err: any) {
      toast.error(err.message || 'Erro ao consultar CEP.', { id: toastId })
    } finally {
      setSearchingCep(false)
    }
  }

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setSaving(true)

    try {
      // 1. Upload de Logo se alterado
      let finalLogoUrl = formData.logo_url
      if (logoFile) {
        const fileName = sanitizarNomeArquivoStorage(logoFile.name, `perfil_${entityId || 'user'}`)
        const { error: uploadError } = await supabase.storage.from('logos').upload(fileName, logoFile, {
          upsert: true,
          contentType: logoFile.type || 'image/png'
        })
        if (uploadError) {
          toast.error('Erro ao enviar logomarca: ' + uploadError.message)
          setSaving(false)
          return
        }
        finalLogoUrl = supabase.storage.from('logos').getPublicUrl(fileName).data.publicUrl
        setCurrentLogo(finalLogoUrl)
      }

      // 2. Salvar Dados da Entidade no Banco
      if (role === 'cliente' && entityId) {
        const payload = {
          razao_social: formData.razao_social,
          nome_fantasia: formData.nome_fantasia,
          inscricao_estadual: formData.inscricao_estadual,
          regime_tributario: formData.regime_tributario,
          ramo_atividade: formData.ramo_atividade,
          nome_sistema_utilizado: formData.nome_sistema_utilizado,
          nome_contato: formData.nome_contato,
          cpf_contato: formData.cpf_contato,
          whatsapp: formData.whatsapp,
          whatsapp_cobranca: formData.whatsapp_cobranca?.trim() || null,
          email_fiscal: formData.email_fiscal?.trim().toLowerCase() || null,
          cep: formData.cep,
          logradouro: formData.logradouro,
          numero: formData.numero,
          complemento: formData.complemento,
          bairro: formData.bairro,
          cidade: formData.cidade,
          uf: formData.uf,
          logo_url: finalLogoUrl
        }

        const { error } = await supabase.from('clientes').update(payload).eq('id', entityId)
        if (error) throw new Error(error.message)

      } else if (role === 'contabilidade' && entityId) {
        const payload = {
          razao_social: formData.razao_social,
          nome_fantasia: formData.nome_fantasia,
          email_contato: formData.email_contato?.trim().toLowerCase() || null,
          telefone: formData.telefone,
          whatsapp: formData.whatsapp,
          nome_responsavel: formData.nome_responsavel,
          cpf_responsavel: formData.cpf_responsavel,
          crc: formData.crc,
          cep: formData.cep,
          logradouro: formData.logradouro,
          numero: formData.numero,
          complemento: formData.complemento,
          bairro: formData.bairro,
          cidade: formData.cidade,
          uf: formData.uf,
          whatsapp_arquivos_fiscais: formData.whatsapp_arquivos_fiscais?.trim() || null,
          email_arquivos_fiscais: formData.email_arquivos_fiscais?.trim().toLowerCase() || null,
          receber_arquivos_whatsapp: formData.admin_permite_envio_whatsapp ? Boolean(formData.receber_arquivos_whatsapp) : false,
          receber_arquivos_email: formData.admin_permite_envio_email ? Boolean(formData.receber_arquivos_email) : false,
          logo_url: finalLogoUrl
        }

        const { error } = await supabase.from('contabilidades').update(payload).eq('id', entityId)
        if (error) throw new Error(error.message)
      }

      // 3. Atualizar Senha ou E-mail se necessário
      if (novaSenha && novaSenha.trim() !== '') {
        if (role === 'admin') {
          const { error: pwdErr } = await supabase.auth.updateUser({ password: novaSenha.trim() })
          if (pwdErr) throw new Error(pwdErr.message)
        } else if (entityId && role) {
          const res = await fetch('/api/admin/update-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              password: novaSenha.trim(),
              role,
              entity_id: entityId
            })
          })
          if (!res.ok) {
            const errData = await res.json()
            throw new Error(errData.error || 'Erro ao atualizar senha.')
          }
        }
        setNovaSenha('')
      }

      toast.success('Seu perfil foi atualizado com sucesso!')
    } catch (err: any) {
      toast.error('Erro ao salvar alterações: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-500 font-medium text-sm">Carregando dados do seu perfil...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-300 pb-16">
      
      {/* Cabeçalho da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <User className="text-blue-600" size={32} />
            Meu Perfil
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {role === 'cliente' && 'Gerencie os dados cadastrais, endereço, contatos e credenciais da sua empresa.'}
            {role === 'contabilidade' && 'Gerencie as informações do seu escritório, parâmetros de recepção fiscal e credenciais.'}
            {role === 'admin' && 'Gerencie suas credenciais de administrador da plataforma.'}
          </p>
        </div>

        {/* Ações Rápidas: Expandir / Recolher */}
        {(role === 'cliente' || role === 'contabilidade') && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={expandAll}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs transition flex items-center gap-1.5"
            >
              <ChevronsUpDown size={14} />
              Expandir Todos
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs transition"
            >
              Recolher
            </button>
          </div>
        )}
      </div>

      {/* Faixa Vermelha de Alerta de Certificado Digital (Apenas Cliente) */}
      {certAlerta && role === 'cliente' && (
        <CertificadoAlertaBanner 
          validade={certAlerta.validade}
          razaoSocial={certAlerta.razaoSocial}
          documento={certAlerta.documento}
          userRole="cliente"
          config={certAlerta.config}
        />
      )}

      {/* Formulário Principal */}
      <form onSubmit={handleSave} className="space-y-5">

        {/* ========================================================================= */}
        {/* PERFIL: CLIENTE                                                          */}
        {/* ========================================================================= */}
        {role === 'cliente' && (
          <>
            {/* Card 1: Dados Cadastrais & Identificação */}
            <FormAccordionCard
              id="empresa"
              title="Dados Cadastrais & Identificação"
              subtitle="Razão Social, Nome Fantasia, CNPJ/CPF, Inscrição Estadual, Regime e Sistema ERP"
              icon={<Building2 size={20} />}
              iconBgColor="bg-blue-50 text-blue-600 border border-blue-100"
              isOpen={openCards.empresa}
              onToggle={() => toggleCard('empresa')}
            >
              <div className="space-y-6">
                
                {/* Visualização de Logomarca */}
                <div className="flex flex-col sm:flex-row items-center gap-5 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="w-20 h-20 rounded-2xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden shadow-2xs shrink-0">
                    {currentLogo ? (
                      <img src={currentLogo} alt="Logo da Empresa" className="w-full h-full object-contain" />
                    ) : (
                      <Building2 className="text-slate-300" size={32} />
                    )}
                  </div>
                  <div className="flex-1 text-center sm:text-left space-y-1">
                    <p className="text-sm font-bold text-slate-800">Logomarca da Empresa</p>
                    <p className="text-xs text-slate-500">Substitua ou envie uma nova imagem para exibição no portal (PNG, JPG ou WEBP)</p>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer pt-2"
                      onChange={e => {
                        if (e.target.files && e.target.files.length > 0) {
                          setLogoFile(e.target.files[0])
                        }
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Razão Social</label>
                    <input 
                      required 
                      type="text" 
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm font-medium"
                      value={formData.razao_social || ''} 
                      onChange={e => setFormData({ ...formData, razao_social: e.target.value })} 
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Nome Fantasia</label>
                    <input 
                      type="text" 
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm font-medium"
                      value={formData.nome_fantasia || ''} 
                      onChange={e => setFormData({ ...formData, nome_fantasia: e.target.value })} 
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      CNPJ / CPF
                      <span className="text-[10px] text-slate-400 font-normal ml-1.5">(Fixo no cadastro)</span>
                    </label>
                    <input 
                      disabled
                      type="text" 
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-slate-500 font-mono text-sm cursor-not-allowed"
                      value={formData.cnpj || ''} 
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Inscrição Estadual (IE)</label>
                    <input 
                      type="text" 
                      placeholder="Ex: 123.456.789.000 ou ISENTO"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm font-medium"
                      value={formData.inscricao_estadual || ''} 
                      onChange={e => setFormData({ ...formData, inscricao_estadual: e.target.value })} 
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Regime Tributário</label>
                    <select
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm font-medium"
                      value={formData.regime_tributario || 'simples_nacional'}
                      onChange={e => setFormData({ ...formData, regime_tributario: e.target.value })}
                    >
                      <option value="simples_nacional">Simples Nacional</option>
                      <option value="lucro_presumido">Lucro Presumido</option>
                      <option value="lucro_real">Lucro Real</option>
                      <option value="mei">MEI - Microempreendedor Individual</option>
                      <option value="isento">Isento / Imune</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Ramo de Atividade</label>
                    <input 
                      type="text" 
                      placeholder="Ex: Comércio Varejista, Restaurante, etc."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm font-medium"
                      value={formData.ramo_atividade || ''} 
                      onChange={e => setFormData({ ...formData, ramo_atividade: e.target.value })} 
                    />
                  </div>

                  <div className="md:col-span-2 lg:col-span-3">
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Sistema ERP / Emissor Utilizado</label>
                    <SistemaAutocompleteInput
                      value={formData.nome_sistema_utilizado || ''}
                      onChange={val => setFormData({ ...formData, nome_sistema_utilizado: val })}
                      placeholder="Selecione ou digite o nome do sistema emissor..."
                    />
                  </div>
                </div>

                {/* Contabilidade Vinculada (Informativo) */}
                {contabilidadeVinculada && (
                  <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-100 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-600 text-white rounded-lg shadow-2xs">
                        <Building2 size={18} />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-blue-900">Escritório Contábil Vinculado</p>
                        <p className="text-sm font-bold text-slate-800">
                          {contabilidadeVinculada.nome_fantasia || contabilidadeVinculada.razao_social}
                        </p>
                      </div>
                    </div>
                    {contabilidadeVinculada.email_contato && (
                      <span className="text-xs text-blue-700 font-medium hidden sm:inline-block">
                        {contabilidadeVinculada.email_contato}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </FormAccordionCard>

            {/* Card 2: Endereço & Localização */}
            <FormAccordionCard
              id="endereco"
              title="Endereço & Localização"
              subtitle="CEP com preenchimento automático, Logradouro, Bairro e Cidade"
              icon={<MapPin size={20} />}
              iconBgColor="bg-amber-50 text-amber-600 border border-amber-100"
              isOpen={openCards.endereco}
              onToggle={() => toggleCard('endereco')}
            >
              <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">CEP</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="00000-000" 
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm font-medium"
                      value={formData.cep || ''} 
                      onChange={e => setFormData({ ...formData, cep: e.target.value })} 
                    />
                    <button
                      type="button"
                      onClick={handleConsultarCep}
                      disabled={searchingCep}
                      title="Buscar endereço via ViaCEP"
                      className="px-3.5 py-2.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl font-semibold flex items-center justify-center transition border border-blue-200 disabled:opacity-50"
                    >
                      <Search size={18} className={searchingCep ? 'animate-spin' : ''} />
                    </button>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Logradouro (Rua, Avenida)</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Rua das Flores" 
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm font-medium"
                    value={formData.logradouro || ''} 
                    onChange={e => setFormData({ ...formData, logradouro: e.target.value })} 
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Número</label>
                  <input 
                    type="text" 
                    placeholder="123" 
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm font-medium"
                    value={formData.numero || ''} 
                    onChange={e => setFormData({ ...formData, numero: e.target.value })} 
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Bairro</label>
                  <input 
                    type="text" 
                    placeholder="Centro" 
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm font-medium"
                    value={formData.bairro || ''} 
                    onChange={e => setFormData({ ...formData, bairro: e.target.value })} 
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Cidade</label>
                  <input 
                    type="text" 
                    placeholder="São Paulo" 
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm font-medium"
                    value={formData.cidade || ''} 
                    onChange={e => setFormData({ ...formData, cidade: e.target.value })} 
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">UF (Estado)</label>
                  <input 
                    type="text" 
                    placeholder="SP" 
                    maxLength={2} 
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm font-medium uppercase"
                    value={formData.uf || ''} 
                    onChange={e => setFormData({ ...formData, uf: e.target.value.toUpperCase() })} 
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Complemento</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Sala 102, Bloco B" 
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm font-medium"
                    value={formData.complemento || ''} 
                    onChange={e => setFormData({ ...formData, complemento: e.target.value })} 
                  />
                </div>
              </div>
            </FormAccordionCard>

            {/* Card 3: Contatos & Responsável */}
            <FormAccordionCard
              id="contato"
              title="Contatos & Responsável"
              subtitle="Responsável pela empresa, WhatsApp Principal, WhatsApp de Cobrança e E-mail"
              icon={<Phone size={20} />}
              iconBgColor="bg-emerald-50 text-emerald-600 border border-emerald-100"
              isOpen={openCards.contato}
              onToggle={() => toggleCard('contato')}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Nome do Contato / Responsável</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Carlos Alberto" 
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm font-medium"
                    value={formData.nome_contato || ''} 
                    onChange={e => setFormData({ ...formData, nome_contato: e.target.value })} 
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">CPF do Responsável</label>
                  <input 
                    type="text" 
                    placeholder="000.000.000-00" 
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm font-medium"
                    value={formData.cpf_contato || ''} 
                    onChange={e => setFormData({ ...formData, cpf_contato: e.target.value })} 
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">WhatsApp Principal (Notificações)</label>
                  <input 
                    type="text" 
                    placeholder="5511999999999" 
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm font-medium"
                    value={formData.whatsapp || ''} 
                    onChange={e => setFormData({ ...formData, whatsapp: e.target.value })} 
                  />
                </div>

                {/* Campo Novo: WhatsApp de Cobrança */}
                <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100">
                  <label className="block text-xs font-bold text-emerald-900 mb-1">
                    WhatsApp para Cobrança / Financeiro
                  </label>
                  <input 
                    type="text" 
                    placeholder="5511999999999 (Se vazio, usa o principal)" 
                    className="w-full px-3.5 py-2 rounded-lg border border-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-sm font-medium"
                    value={formData.whatsapp_cobranca || ''} 
                    onChange={e => setFormData({ ...formData, whatsapp_cobranca: e.target.value })} 
                  />
                  <p className="text-[11px] text-emerald-700 mt-1">
                    Utilizado para envio de faturas, links Pix e avisos de vencimento.
                  </p>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">E-mail Fiscal / Contato</label>
                  <input 
                    type="email" 
                    placeholder="financeiro@empresa.com" 
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm font-medium lowercase"
                    value={formData.email_fiscal || ''} 
                    onChange={e => setFormData({ ...formData, email_fiscal: e.target.value.toLowerCase() })} 
                    onBlur={e => setFormData({ ...formData, email_fiscal: e.target.value.trim().toLowerCase() })}
                    autoCapitalize="none"
                    spellCheck={false}
                  />
                </div>
              </div>
            </FormAccordionCard>

            {/* Card 4: Certificado Digital A1 (Status) */}
            <FormAccordionCard
              id="certificado"
              title="Certificado Digital A1"
              subtitle="Status de validade e titularidade do certificado digital"
              icon={<FileBadge size={20} />}
              iconBgColor="bg-purple-50 text-purple-600 border border-purple-100"
              isOpen={openCards.certificado}
              onToggle={() => toggleCard('certificado')}
            >
              <div className="p-5 bg-purple-50/40 rounded-2xl border border-purple-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="p-3 bg-purple-600 text-white rounded-xl shadow-xs">
                    <FileBadge size={24} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      {formData.certificado_validade ? 'Certificado Digital Configurado' : 'Nenhum Certificado A1 Vinculado'}
                    </h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {formData.certificado_validade 
                        ? `Data de Validade: ${new Date(formData.certificado_validade).toLocaleDateString('pt-BR')}`
                        : 'Para atualizar ou instalar um novo Certificado Digital A1 (.pfx), entre em contato com o suporte da Paratech.'}
                    </p>
                  </div>
                </div>
                {formData.certificado_validade && (
                  <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-3 py-1.5 rounded-xl border border-emerald-200 self-start sm:self-auto flex items-center gap-1.5">
                    <CheckCircle2 size={14} /> Ativo no Sistema
                  </span>
                )}
              </div>
            </FormAccordionCard>
          </>
        )}

        {/* ========================================================================= */}
        {/* PERFIL: CONTABILIDADE                                                    */}
        {/* ========================================================================= */}
        {role === 'contabilidade' && (
          <>
            {/* Card 1: Dados do Escritório */}
            <FormAccordionCard
              id="empresa"
              title="Dados do Escritório Contábil"
              subtitle="Razão Social, Nome Fantasia, CNPJ, Contatos e Logomarca do Escritório"
              icon={<Building2 size={20} />}
              iconBgColor="bg-blue-50 text-blue-600 border border-blue-100"
              isOpen={openCards.empresa}
              onToggle={() => toggleCard('empresa')}
            >
              <div className="space-y-6">
                
                {/* Visualização de Logomarca */}
                <div className="flex flex-col sm:flex-row items-center gap-5 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="w-20 h-20 rounded-2xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden shadow-2xs shrink-0">
                    {currentLogo ? (
                      <img src={currentLogo} alt="Logo da Contabilidade" className="w-full h-full object-contain" />
                    ) : (
                      <Building2 className="text-slate-300" size={32} />
                    )}
                  </div>
                  <div className="flex-1 text-center sm:text-left space-y-1">
                    <p className="text-sm font-bold text-slate-800">Logomarca do Escritório</p>
                    <p className="text-xs text-slate-500">Exibida no portal e nos relatórios de fechamento enviados aos clientes</p>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer pt-2"
                      onChange={e => {
                        if (e.target.files && e.target.files.length > 0) {
                          setLogoFile(e.target.files[0])
                        }
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Razão Social</label>
                    <input 
                      required 
                      type="text" 
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm font-medium"
                      value={formData.razao_social || ''} 
                      onChange={e => setFormData({ ...formData, razao_social: e.target.value })} 
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Nome Fantasia</label>
                    <input 
                      type="text" 
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm font-medium"
                      value={formData.nome_fantasia || ''} 
                      onChange={e => setFormData({ ...formData, nome_fantasia: e.target.value })} 
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      CNPJ
                      <span className="text-[10px] text-slate-400 font-normal ml-1.5">(Fixo)</span>
                    </label>
                    <input 
                      disabled
                      type="text" 
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-slate-500 font-mono text-sm cursor-not-allowed"
                      value={formData.cnpj || ''} 
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">E-mail Comercial</label>
                    <input 
                      type="email" 
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm font-medium lowercase"
                      value={formData.email_contato || ''} 
                      onChange={e => setFormData({ ...formData, email_contato: e.target.value.toLowerCase() })} 
                      onBlur={e => setFormData({ ...formData, email_contato: e.target.value.trim().toLowerCase() })}
                      autoCapitalize="none"
                      spellCheck={false}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Telefone Fixo</label>
                    <input 
                      type="text" 
                      placeholder="(00) 0000-0000"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm font-medium"
                      value={formData.telefone || ''} 
                      onChange={e => setFormData({ ...formData, telefone: e.target.value })} 
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">WhatsApp de Contato</label>
                    <input 
                      type="text" 
                      placeholder="5511999999999"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm font-medium"
                      value={formData.whatsapp || ''} 
                      onChange={e => setFormData({ ...formData, whatsapp: e.target.value })} 
                    />
                  </div>
                </div>
              </div>
            </FormAccordionCard>

            {/* Card 2: Recepção de Arquivos Fiscais & Relatórios dos Clientes */}
            <FormAccordionCard
              id="fiscal_despacho"
              title="Recepção de Arquivos Fiscais & Relatórios dos Clientes"
              subtitle="Configure o recebimento automático de XMLs e DANFEs via WhatsApp e E-mail"
              icon={<FolderArchive size={20} />}
              iconBgColor="bg-indigo-50 text-indigo-600 border border-indigo-100"
              isOpen={openCards.fiscal_despacho}
              onToggle={() => toggleCard('fiscal_despacho')}
            >
              <div className="space-y-6">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Gerencie se o seu escritório deseja receber automaticamente os pacotes de arquivos fiscais (XMLs, DANFEs e relatórios de fechamento mensal) dos clientes vinculados diretamente nos seus canais de comunicação.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Canal WhatsApp */}
                  <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
                          <Phone size={18} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800">Canal WhatsApp</p>
                          <p className="text-[11px] text-slate-500">Envio automático do pacote fiscal via WhatsApp</p>
                        </div>
                      </div>

                      {formData.admin_permite_envio_whatsapp ? (
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={formData.receber_arquivos_whatsapp} 
                            onChange={e => setFormData({ ...formData, receber_arquivos_whatsapp: e.target.checked })} 
                            className="sr-only peer" 
                          />
                          <div className="w-10 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                        </label>
                      ) : (
                        <span className="text-[10px] font-black uppercase bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-200">
                          Bloqueado no Admin
                        </span>
                      )}
                    </div>

                    {formData.admin_permite_envio_whatsapp ? (
                      <div className="space-y-2 pt-2 border-t border-slate-100">
                        <label className="block text-xs font-bold text-slate-700">
                          Número do WhatsApp para Arquivos Fiscais
                        </label>
                        <input 
                          type="text" 
                          placeholder="Ex: 5511999999999 (Se vazio, usa o principal)" 
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50 text-sm font-medium"
                          value={formData.whatsapp_arquivos_fiscais || ''} 
                          onChange={e => setFormData({ ...formData, whatsapp_arquivos_fiscais: e.target.value })} 
                        />
                        <p className="text-[11px] text-slate-500">
                          Status atual: <strong className={formData.receber_arquivos_whatsapp ? 'text-emerald-600' : 'text-slate-500'}>
                            {formData.receber_arquivos_whatsapp ? 'Ativado para envio' : 'Desativado'}
                          </strong>
                        </p>
                      </div>
                    ) : (
                      <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 flex items-start gap-2 text-xs text-amber-800">
                        <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                        <span>O envio via WhatsApp foi desabilitado para este escritório pelo Administrador da plataforma.</span>
                      </div>
                    )}
                  </div>

                  {/* Canal E-mail */}
                  <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
                          <Mail size={18} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800">Canal E-mail Fiscal</p>
                          <p className="text-[11px] text-slate-500">Envio automático do arquivo ZIP de notas fiscais</p>
                        </div>
                      </div>

                      {formData.admin_permite_envio_email ? (
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={formData.receber_arquivos_email} 
                            onChange={e => setFormData({ ...formData, receber_arquivos_email: e.target.checked })} 
                            className="sr-only peer" 
                          />
                          <div className="w-10 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      ) : (
                        <span className="text-[10px] font-black uppercase bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-200">
                          Bloqueado no Admin
                        </span>
                      )}
                    </div>

                    {formData.admin_permite_envio_email ? (
                      <div className="space-y-2 pt-2 border-t border-slate-100">
                        <label className="block text-xs font-bold text-slate-700">
                          E-mail para Recebimento de Arquivos Fiscais
                        </label>
                        <input 
                          type="email" 
                          placeholder="Ex: fiscal@escritorio.com (Se vazio, usa o principal)" 
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50 text-sm font-medium lowercase"
                          value={formData.email_arquivos_fiscais || ''} 
                          onChange={e => setFormData({ ...formData, email_arquivos_fiscais: e.target.value.toLowerCase() })} 
                          onBlur={e => setFormData({ ...formData, email_arquivos_fiscais: e.target.value.trim().toLowerCase() })}
                          autoCapitalize="none"
                          spellCheck={false}
                        />
                        <p className="text-[11px] text-slate-500">
                          Status atual: <strong className={formData.receber_arquivos_email ? 'text-blue-600' : 'text-slate-500'}>
                            {formData.receber_arquivos_email ? 'Ativado para envio' : 'Desativado'}
                          </strong>
                        </p>
                      </div>
                    ) : (
                      <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 flex items-start gap-2 text-xs text-amber-800">
                        <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                        <span>O envio via E-mail foi desabilitado para este escritório pelo Administrador da plataforma.</span>
                      </div>
                    )}
                  </div>

                </div>
              </div>
            </FormAccordionCard>

            {/* Card 3: Contador / Responsável Técnico */}
            <FormAccordionCard
              id="contato"
              title="Contador / Responsável Técnico"
              subtitle="Dados do profissional de contabilidade e registro no CRC"
              icon={<UserCheck size={20} />}
              iconBgColor="bg-emerald-50 text-emerald-600 border border-emerald-100"
              isOpen={openCards.contato}
              onToggle={() => toggleCard('contato')}
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Nome do Contador Responsável</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Carlos Alberto" 
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm font-medium"
                    value={formData.nome_responsavel || ''} 
                    onChange={e => setFormData({ ...formData, nome_responsavel: e.target.value })} 
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">CPF do Contador</label>
                  <input 
                    type="text" 
                    placeholder="000.000.000-00" 
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm font-medium"
                    value={formData.cpf_responsavel || ''} 
                    onChange={e => setFormData({ ...formData, cpf_responsavel: e.target.value })} 
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Registro CRC</label>
                  <input 
                    type="text" 
                    placeholder="Ex: CRC-SP 123456/O" 
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm font-medium"
                    value={formData.crc || ''} 
                    onChange={e => setFormData({ ...formData, crc: e.target.value })} 
                  />
                </div>
              </div>
            </FormAccordionCard>

            {/* Card 4: Endereço do Escritório */}
            <FormAccordionCard
              id="endereco"
              title="Endereço do Escritório"
              subtitle="CEP com consulta automática ViaCEP, Logradouro, Bairro e Cidade"
              icon={<MapPin size={20} />}
              iconBgColor="bg-amber-50 text-amber-600 border border-amber-100"
              isOpen={openCards.endereco}
              onToggle={() => toggleCard('endereco')}
            >
              <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">CEP</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="00000-000" 
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm font-medium"
                      value={formData.cep || ''} 
                      onChange={e => setFormData({ ...formData, cep: e.target.value })} 
                    />
                    <button
                      type="button"
                      onClick={handleConsultarCep}
                      disabled={searchingCep}
                      title="Buscar endereço via ViaCEP"
                      className="px-3.5 py-2.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl font-semibold flex items-center justify-center transition border border-blue-200 disabled:opacity-50"
                    >
                      <Search size={18} className={searchingCep ? 'animate-spin' : ''} />
                    </button>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Logradouro (Rua, Avenida)</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Av. Paulista" 
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm font-medium"
                    value={formData.logradouro || ''} 
                    onChange={e => setFormData({ ...formData, logradouro: e.target.value })} 
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Número</label>
                  <input 
                    type="text" 
                    placeholder="123" 
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm font-medium"
                    value={formData.numero || ''} 
                    onChange={e => setFormData({ ...formData, numero: e.target.value })} 
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Bairro</label>
                  <input 
                    type="text" 
                    placeholder="Bela Vista" 
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm font-medium"
                    value={formData.bairro || ''} 
                    onChange={e => setFormData({ ...formData, bairro: e.target.value })} 
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Cidade</label>
                  <input 
                    type="text" 
                    placeholder="São Paulo" 
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm font-medium"
                    value={formData.cidade || ''} 
                    onChange={e => setFormData({ ...formData, cidade: e.target.value })} 
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">UF (Estado)</label>
                  <input 
                    type="text" 
                    placeholder="SP" 
                    maxLength={2} 
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm font-medium uppercase"
                    value={formData.uf || ''} 
                    onChange={e => setFormData({ ...formData, uf: e.target.value.toUpperCase() })} 
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Complemento</label>
                  <input 
                    type="text" 
                    placeholder="Conjunto 501" 
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm font-medium"
                    value={formData.complemento || ''} 
                    onChange={e => setFormData({ ...formData, complemento: e.target.value })} 
                  />
                </div>
              </div>
            </FormAccordionCard>
          </>
        )}

        {/* ========================================================================= */}
        {/* CARD COMUM: SEGURANÇA & CREDENCIAIS DE ACESSO                            */}
        {/* ========================================================================= */}
        <FormAccordionCard
          id="acesso"
          title="Segurança & Credenciais de Acesso"
          subtitle="E-mail de autenticação e alteração de senha de login no portal"
          icon={<Shield size={20} />}
          iconBgColor="bg-slate-100 text-slate-700 border border-slate-200"
          isOpen={openCards.acesso}
          onToggle={() => toggleCard('acesso')}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                E-mail de Login
                <span className="text-[10px] text-slate-400 font-normal ml-1.5">(Autenticação)</span>
              </label>
              <input 
                disabled
                type="email" 
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-slate-500 font-medium text-sm cursor-not-allowed"
                value={formData.login_email || ''} 
              />
              <p className="text-[11px] text-slate-400 mt-1">Para alterar o e-mail de acesso, contate o administrador da plataforma.</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Nova Senha de Acesso
                <span className="text-[10px] text-slate-400 font-normal ml-1.5">(Preencha apenas se desejar trocar)</span>
              </label>
              <div className="relative">
                <input 
                  type={showPassword ? 'text' : 'password'} 
                  placeholder="Mínimo de 6 caracteres" 
                  className="w-full px-3.5 py-2.5 pr-11 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm font-medium"
                  value={novaSenha} 
                  onChange={e => setNovaSenha(e.target.value)} 
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
        </FormAccordionCard>

        {/* Rodapé com Botão Flutuante / Salvar */}
        <div className="pt-4 flex justify-end">
          <button 
            type="submit" 
            disabled={saving}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 py-3.5 rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 text-sm disabled:opacity-50 cursor-pointer"
          >
            <Save size={18} />
            {saving ? 'Salvando Alterações...' : 'Salvar Alterações'}
          </button>
        </div>

      </form>
    </div>
  )
}
