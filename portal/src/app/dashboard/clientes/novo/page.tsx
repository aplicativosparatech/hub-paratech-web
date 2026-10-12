'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, UserPlus, Save, Search, Eye, EyeOff, ShieldCheck, FileKey } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import toast from 'react-hot-toast'

export default function NovoClientePage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [searchingCnpj, setSearchingCnpj] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showCertPassword, setShowCertPassword] = useState(false)
  const [contabilidades, setContabilidades] = useState<any[]>([])

  const [formData, setFormData] = useState({
    razao_social: '',
    nome_fantasia: '',
    cnpj: '',
    nome_sistema_utilizado: '',
    contabilidade_id: '',
    whatsapp: '',
    nome_contato: '',
    cpf_contato: '',
    email_fiscal: '',
    certificado_url: '',
    certificado_senha: '',
    certificado_validade: '',
    regime_tributario: 'simples_nacional',
    ramo_atividade: '',
    valor_mensalidade: '',
    dia_vencimento: '10',
    is_ativo: true,
    cidade: '',
    uf: '',
    login_email: '',
    login_senha: '',
    logo_url: ''
  })
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [certFile, setCertFile] = useState<File | null>(null)
  const [certInfo, setCertInfo] = useState<{ titular: string; documento: string; validade: string; diasRestantes: number } | null>(null)
  const [readingCert, setReadingCert] = useState(false)
  const [certError, setCertError] = useState<string | null>(null)

  const handleLerCertificado = async (fileToRead = certFile, passToUse = formData.certificado_senha) => {
    if (!fileToRead || !passToUse) return
    setReadingCert(true)
    setCertError(null)
    const toastId = toast.loading('Lendo dados do certificado A1...')
    try {
      const fd = new FormData()
      fd.append('file', fileToRead)
      fd.append('senha', passToUse)
      const res = await fetch('/api/certificados/ler-pfx', {
        method: 'POST',
        body: fd
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erro ao ler certificado')
      }
      setCertInfo({
        titular: data.titular,
        documento: data.documento,
        validade: data.dataValidadeFormatada,
        diasRestantes: data.diasRestantes
      })
      setFormData(prev => ({
        ...prev,
        certificado_validade: data.dataValidade
      }))
      toast.success(`Certificado lido com sucesso! Titular: ${data.titular}`, { id: toastId })
    } catch (err: any) {
      setCertError(err.message)
      toast.error(err.message, { id: toastId })
    } finally {
      setReadingCert(false)
    }
  }

  useEffect(() => {
    async function fetchContas() {
      const { data } = await supabase.from('contabilidades').select('id, razao_social')
      if (data) setContabilidades(data)
    }
    fetchContas()
  }, [])

  // Busca de CNPJ via BrasilAPI
  const handleConsultarCnpj = async () => {
    const rawCnpj = formData.cnpj.replace(/\D/g, '')
    if (rawCnpj.length !== 14) {
      toast.error('Informe um CNPJ válido com 14 dígitos.')
      return
    }

    setSearchingCnpj(true)
    const toastId = toast.loading('Consultando dados do CNPJ...')
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${rawCnpj}`)
      if (!res.ok) throw new Error('Não foi possível obter dados para este CNPJ.')
      const data = await res.json()

      const tel = data.ddd_telefone_1 ? `55${data.ddd_telefone_1.replace(/\D/g, '')}` : formData.whatsapp

      let autoRegime = 'simples_nacional'
      if (data.opcao_pelo_mei) {
        autoRegime = 'mei'
      } else if (data.opcao_pelo_simples) {
        autoRegime = 'simples_nacional'
      } else if (data.opcao_pelo_simples === false) {
        autoRegime = 'lucro_presumido'
      }

      setFormData(prev => ({
        ...prev,
        razao_social: data.razao_social || prev.razao_social,
        nome_fantasia: data.nome_fantasia || data.razao_social || prev.nome_fantasia,
        whatsapp: prev.whatsapp || tel,
        email_fiscal: prev.email_fiscal || data.email || '',
        ramo_atividade: prev.ramo_atividade || data.cnae_fiscal_descricao || '',
        cidade: prev.cidade || data.municipio || '',
        uf: prev.uf || data.uf || '',
        regime_tributario: autoRegime
      }))

      toast.success('Dados preenchidos com sucesso!', { id: toastId })
    } catch (err: any) {
      toast.error(err.message || 'Erro ao consultar CNPJ', { id: toastId })
    } finally {
      setSearchingCnpj(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    let finalLogoUrl = ''
    if (logoFile) {
      const fileName = `${Date.now()}_${logoFile.name}`
      const { error: uploadError } = await supabase.storage.from('logos').upload(fileName, logoFile)
      if (uploadError) {
        toast.error('Erro ao enviar logo: ' + uploadError.message)
        setLoading(false)
        return
      }
      finalLogoUrl = supabase.storage.from('logos').getPublicUrl(fileName).data.publicUrl
    }

    let finalCertUrl = ''
    if (certFile) {
      const certFd = new FormData()
      certFd.append('file', certFile)
      certFd.append('senha', formData.certificado_senha)
      certFd.append('clienteId', 'novo')

      const certUploadRes = await fetch('/api/certificados/upload', {
        method: 'POST',
        body: certFd
      })
      const certUploadData = await certUploadRes.json()
      if (!certUploadRes.ok || !certUploadData.success) {
        toast.error('Erro ao enviar certificado: ' + (certUploadData.error || 'Falha no envio'))
        setLoading(false)
        return
      }
      finalCertUrl = certUploadData.storagePath
    }

    const { login_email, login_senha, ...clienteData } = formData
    
    const payload = {
      ...clienteData,
      is_ativo: formData.is_ativo,
      dia_vencimento: parseInt(String(formData.dia_vencimento)) || 10,
      valor_mensalidade: clienteData.valor_mensalidade ? parseFloat(String(clienteData.valor_mensalidade).replace(',', '.')) : 0,
      contabilidade_id: clienteData.contabilidade_id || null,
      certificado_validade: clienteData.certificado_validade || null,
      certificado_url: finalCertUrl,
      logo_url: finalLogoUrl
    }

    // 1. Criar o Cliente no banco
    const { data: clienteResult, error } = await supabase.from('clientes').insert([payload]).select().single()
    
    if (error) {
      toast.error('Erro ao salvar cliente: ' + error.message)
      setLoading(false)
      return
    }

    // 1.1 Sincronizar configuracoes_hub com vencimento e valor da mensalidade
    if (clienteResult?.id) {
      await supabase.from('configuracoes_hub').upsert({
        cliente_id: clienteResult.id,
        dia_vencimento: payload.dia_vencimento,
        valor_mensalidade: payload.valor_mensalidade
      })
    }

    // 2. Criar a Conta de Usuário (se preencheu e-mail e senha)
    if (login_email && login_senha) {
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: login_email,
          password: login_senha,
          role: 'cliente',
          entity_id: clienteResult.id
        })
      })

      if (!res.ok) {
        const errorData = await res.json()
        toast.error('Cliente criado, mas falha ao criar Acesso: ' + errorData.error)
        setLoading(false)
        return
      }
    }

    toast.success('Cliente cadastrado com sucesso!')
    router.push('/dashboard/clientes')
  }

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <Link href="/dashboard/clientes" className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900 transition font-medium">
          <ArrowLeft size={18} /> Voltar para lista de clientes
        </Link>
      </div>
      
      <header className="mb-2">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
          <UserPlus className="text-blue-600" size={30} />
          Novo Cliente
        </h1>
        <p className="text-slate-500 text-sm mt-1">Cadastre uma nova empresa cliente com perfil fiscal completo para gerar o Token do Hub e vincular à contabilidade.</p>
      </header>

      {/* Formulário Expandido em Grid */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 w-full">
        <form onSubmit={handleSubmit} className="space-y-6">
          
          <div>
            <h3 className="text-base font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100">
              Dados da Empresa
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              
              {/* Campo CNPJ com Botão de Consulta Automática */}
              <div className="md:col-span-1">
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
                  placeholder="Nome oficial da empresa"
                  value={formData.razao_social} onChange={e => setFormData({...formData, razao_social: e.target.value})} />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Nome Fantasia</label>
                <input type="text" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
                  placeholder="Nome comercial"
                  value={formData.nome_fantasia} onChange={e => setFormData({...formData, nome_fantasia: e.target.value})} />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">WhatsApp (Cobranças / Notificações)</label>
                <input type="text" placeholder="5511999999999" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
                  value={formData.whatsapp} onChange={e => setFormData({...formData, whatsapp: e.target.value})} />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Nome do Sistema Monitorado (ERP/PDV)</label>
                <input required type="text" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
                  placeholder="Ex: GdoorSlim, SysPDV"
                  value={formData.nome_sistema_utilizado} onChange={e => setFormData({...formData, nome_sistema_utilizado: e.target.value})} />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Vincular a uma Contabilidade</label>
                <select className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
                  value={formData.contabilidade_id} onChange={e => setFormData({...formData, contabilidade_id: e.target.value})}>
                  <option value="">Nenhuma</option>
                  {contabilidades.map(c => (
                    <option key={c.id} value={c.id}>{c.razao_social}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Regime Tributário (CRT)</label>
                <select 
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50 font-medium"
                  value={formData.regime_tributario} 
                  onChange={e => setFormData({...formData, regime_tributario: e.target.value})}
                >
                  <option value="simples_nacional">Simples Nacional (CRT 1)</option>
                  <option value="simples_nacional_excesso">Simples Nacional - Excesso de Sublimite (CRT 2)</option>
                  <option value="lucro_presumido">Regime Normal - Lucro Presumido (CRT 3)</option>
                  <option value="lucro_real">Regime Normal - Lucro Real (CRT 3)</option>
                  <option value="mei">MEI - Microempreendedor Individual (CRT 4)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Ramo de Atividade</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
                  placeholder="Ex: Supermercado, Depósito, Farmácia"
                  value={formData.ramo_atividade} 
                  onChange={e => setFormData({...formData, ramo_atividade: e.target.value})} 
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Valor da Mensalidade (R$)</label>
                <input 
                  type="number" 
                  step="0.01"
                  min="0"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50 font-semibold"
                  placeholder="0.00"
                  value={formData.valor_mensalidade} 
                  onChange={e => setFormData({...formData, valor_mensalidade: e.target.value})} 
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Dia de Vencimento da Fatura</label>
                <input 
                  type="number" 
                  min="1"
                  max="31"
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50 font-semibold"
                  placeholder="10"
                  value={formData.dia_vencimento} 
                  onChange={e => setFormData({...formData, dia_vencimento: e.target.value})} 
                />
                <p className="text-[11px] text-slate-500 mt-1">Gera fatura automática todo dia 01</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Status no Sistema</label>
                <select 
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50 font-medium"
                  value={formData.is_ativo ? 'true' : 'false'} 
                  onChange={e => setFormData({...formData, is_ativo: e.target.value === 'true'})}
                >
                  <option value="true">Ativo (Acesso Liberado)</option>
                  <option value="false">Inativo / Bloqueado</option>
                </select>
                <p className="text-[11px] text-slate-500 mt-1">Ativa/desativa cliente e faturamento</p>
              </div>

              <div className="md:col-span-3">
                <label className="block text-sm font-semibold text-slate-700 mb-1">Logomarca da Empresa</label>
                <input type="file" accept="image/*" className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50 text-sm"
                  onChange={e => { if (e.target.files && e.target.files.length > 0) setLogoFile(e.target.files[0]) }} />
              </div>
            </div>
          </div>

          {/* Cadastro Fiscal & Responsável */}
          <div className="pt-4 border-t border-slate-100">
            <h3 className="text-base font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100 flex items-center gap-2">
              <ShieldCheck className="text-blue-600" size={20} />
              Cadastro Fiscal & Contato Responsável
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Nome do Contato / Responsável</label>
                <input type="text" placeholder="Ex: João Silva" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
                  value={formData.nome_contato} onChange={e => setFormData({...formData, nome_contato: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">CPF do Responsável</label>
                <input type="text" placeholder="000.000.000-00" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
                  value={formData.cpf_contato} onChange={e => setFormData({...formData, cpf_contato: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">E-mail Fiscal (para envio de guias e relatórios)</label>
                <input type="email" placeholder="fiscal@empresa.com.br" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
                  value={formData.email_fiscal} onChange={e => setFormData({...formData, email_fiscal: e.target.value})} />
              </div>
            </div>
          </div>

          {/* Certificado Digital A1 */}
          <div className="pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileKey className="text-indigo-600" size={20} />
                Certificado Digital A1 (.pfx / .p12)
              </h3>
              <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full font-medium">
                Aviso automático via WhatsApp 45 dias antes do vencimento
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Arquivo do Certificado (.pfx / .p12)</label>
                <input 
                  type="file" 
                  accept=".pfx,.p12" 
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50 text-sm"
                  onChange={e => { 
                    if (e.target.files && e.target.files.length > 0) {
                      const f = e.target.files[0]
                      setCertFile(f)
                      if (formData.certificado_senha) {
                        handleLerCertificado(f, formData.certificado_senha)
                      }
                    } 
                  }} 
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-semibold text-slate-700">Senha do Certificado Digital</label>
                  {certFile && formData.certificado_senha && (
                    <button
                      type="button"
                      onClick={() => handleLerCertificado(certFile, formData.certificado_senha)}
                      disabled={readingCert}
                      className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold"
                    >
                      {readingCert ? 'Lendo...' : 'Ler Certificado'}
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input 
                    type={showCertPassword ? 'text' : 'password'} 
                    placeholder="Senha do arquivo .pfx" 
                    className="w-full px-4 py-2.5 pr-11 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50 font-mono"
                    value={formData.certificado_senha} 
                    onChange={e => setFormData({...formData, certificado_senha: e.target.value})} 
                    onBlur={() => {
                      if (certFile && formData.certificado_senha) {
                        handleLerCertificado(certFile, formData.certificado_senha)
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCertPassword(!showCertPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    title={showCertPassword ? 'Ocultar senha' : 'Ver senha'}
                  >
                    {showCertPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Data de Vencimento do Certificado</label>
                <div className="relative">
                  <input 
                    type="date" 
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50 font-medium"
                    value={formData.certificado_validade} 
                    onChange={e => setFormData({...formData, certificado_validade: e.target.value})} 
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Preenchida automaticamente ao ler o certificado</p>
              </div>

              {/* Informações extraídas do certificado digital */}
              {certInfo && (
                <div className="md:col-span-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-emerald-950">
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-emerald-900">Titular:</span>
                      <span className="font-semibold text-slate-900 bg-white px-2 py-0.5 rounded border border-emerald-200">{certInfo.titular}</span>
                    </div>
                    {certInfo.documento && (
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-emerald-900">CNPJ / CPF:</span>
                        <span className="font-mono font-bold text-blue-700 bg-white px-2 py-0.5 rounded border border-emerald-200">{certInfo.documento}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-emerald-900">Vencimento:</span>
                      <span className="font-medium text-slate-800">{certInfo.validade} ({certInfo.diasRestantes < 0 ? 'Vencido' : `Vence em ${certInfo.diasRestantes} dias`})</span>
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-emerald-600 text-white rounded-full font-bold uppercase text-[10px] tracking-wider shrink-0 self-start sm:self-auto">
                    ✓ Certificado Válido
                  </span>
                </div>
              )}

              {/* Mensagem de Erro de Senha */}
              {certError && (
                <div className="md:col-span-3 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium">
                  ⚠️ {certError}
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <h3 className="text-base font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100">
              Acesso ao Portal (Login)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">E-mail de Login</label>
                <input type="email" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
                  placeholder="cliente@empresa.com"
                  value={formData.login_email} onChange={e => setFormData({...formData, login_email: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Senha de Login</label>
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
              disabled={loading}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
            >
              <Save size={18} />
              {loading ? 'Cadastrando cliente...' : 'Cadastrar Cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
