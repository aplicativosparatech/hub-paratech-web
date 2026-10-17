'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, UserPlus, Save, Search, Eye, EyeOff, ShieldCheck, ShieldAlert, FileKey, FileCode, Upload, MapPin, Calendar } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import toast from 'react-hot-toast'
import { limparDocumento, formatarCnpjCpf, validarCnpj, validarCpf, isCnpjAlfanumerico } from '@/utils/cnpjAlfanumerico'
import { SistemaAutocompleteInput, ERP_PADRAO } from '@/components/SistemaAutocompleteInput'

export default function NovoClientePage() {
  const router = useRouter()
  const supabase = createClient()
  const xmlSampleRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [searchingCnpj, setSearchingCnpj] = useState(false)
  const [searchingCep, setSearchingCep] = useState(false)
  const [showPassword, setShowPassword] = useState(true)
  const [showCertPassword, setShowCertPassword] = useState(false)
  const [contabilidades, setContabilidades] = useState<any[]>([])
  const [sistemasSugeridos, setSistemasSugeridos] = useState<string[]>(ERP_PADRAO)
  const [clienteExistente, setClienteExistente] = useState<{ id: string; razao_social: string; nome_fantasia?: string; cnpj: string } | null>(null)
  const [checkingDuplicidade, setCheckingDuplicidade] = useState(false)
  const [userRole, setUserRole] = useState<'admin' | 'contabilidade' | 'cliente'>('admin')

  const [formData, setFormData] = useState({
    razao_social: '',
    nome_fantasia: '',
    cnpj: '',
    inscricao_estadual: '',
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
    custo: '',
    dia_vencimento: '10',
    is_ativo: true,
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    uf: '',
    data_inicio_monitoramento: '',
    numero_inicial_nfe: 1,
    numero_inicial_nfce: 1,
    numero_inicial_nfse: 1,
    numero_inicial_cte: 1,
    numero_inicial_mdfe: 1,
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
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      const role = (roleData?.role as 'admin' | 'contabilidade' | 'cliente') || 'admin'
      setUserRole(role)

      if (role !== 'admin') {
        toast.error('Apenas administradores podem cadastrar novos clientes.')
        router.push('/dashboard/clientes')
        return
      }

      const [contasRes, sistemasRes] = await Promise.all([
        supabase.from('contabilidades').select('id, razao_social'),
        supabase.from('clientes').select('nome_sistema_utilizado').not('nome_sistema_utilizado', 'is', null)
      ])
      if (contasRes.data) setContabilidades(contasRes.data)
      if (sistemasRes.data) {
        const salvos = sistemasRes.data
          .map((c: any) => c.nome_sistema_utilizado?.trim())
          .filter((s: any): s is string => Boolean(s && s.length > 0))
        const unicos = Array.from(new Set([...salvos, ...ERP_PADRAO]))
        setSistemasSugeridos(unicos)
      }
    }
    fetchData()
  }, [])

  // Busca rápida de endereço pelo CEP (ViaCEP)
  const handleConsultarCep = async () => {
    const rawCep = (formData.cep || '').replace(/\D/g, '')
    if (rawCep.length !== 8) {
      toast.error('Informe um CEP válido com 8 dígitos.')
      return
    }
    setSearchingCep(true)
    const toastId = toast.loading('Consultando CEP nos Correios...')
    try {
      const res = await fetch(`https://viacep.com.br/ws/${rawCep}/json/`)
      const data = await res.json()
      if (data.erro) {
        throw new Error('CEP não encontrado na base pública dos Correios.')
      }
      setFormData(prev => ({
        ...prev,
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

  // Verificação em tempo real de cadastro duplicado (Bloqueio de Clientes Repetidos)
  const checarCnpjDuplicado = async (documento: string) => {
    const raw = limparDocumento(documento)
    if (!raw || (raw.length !== 11 && raw.length !== 14)) {
      setClienteExistente(null)
      return null
    }
    setCheckingDuplicidade(true)
    try {
      const formatted = formatarCnpjCpf(raw)
      const { data } = await supabase
        .from('clientes')
        .select('id, razao_social, nome_fantasia, cnpj')
        .or(`cnpj.eq.${formatted},cnpj.eq.${raw}`)
        .maybeSingle()

      if (data) {
        setClienteExistente(data)
        toast.error(`⚠️ Documento já cadastrado para: "${data.nome_fantasia || data.razao_social}". Não é permitido cadastrar clientes repetidos.`, { duration: 6000 })
        return data
      } else {
        setClienteExistente(null)
        return null
      }
    } catch (err) {
      console.error('Erro ao checar duplicidade:', err)
      return null
    } finally {
      setCheckingDuplicidade(false)
    }
  }

  // Busca de CNPJ via Open CNPJa / ReceitaWS com Inscrição Estadual e Endereço Completo
  const handleConsultarCnpj = async () => {
    const rawDoc = limparDocumento(formData.cnpj)

    if (!rawDoc) {
      toast.error('Digite o CNPJ ou CPF para consultar.')
      return
    }

    // 0. Bloqueio imediato de cadastro repetido
    const jaExiste = await checarCnpjDuplicado(rawDoc)
    if (jaExiste) {
      toast.error(`❌ O cliente "${jaExiste.nome_fantasia || jaExiste.razao_social}" já está cadastrado com este documento (${jaExiste.cnpj}). Cadastros repetidos são bloqueados.`, { duration: 7000 })
      return
    }

    if (rawDoc.length === 11) {
      // É CPF (Pessoa Física / Produtor Rural)
      if (!validarCpf(rawDoc)) {
        toast.error('CPF inválido. Verifique os números digitados.')
        return
      }
      const cpfFormatado = formatarCnpjCpf(rawDoc)
      setFormData(prev => ({
        ...prev,
        cnpj: cpfFormatado,
        regime_tributario: prev.regime_tributario || 'simples_nacional'
      }))
      toast.success('CPF validado e formatado com sucesso! Preencha a Razão Social/Nome.')
      return
    }

    if (rawDoc.length !== 14) {
      toast.error('Informe um CNPJ válido com 14 caracteres ou CPF com 11 dígitos.')
      return
    }

    // Validação matemática oficial da RFB (Módulo 11 com suporte a alfanumérico)
    if (!validarCnpj(rawDoc)) {
      toast.error('CNPJ inválido de acordo com as regras de dígito verificador da Receita Federal.')
      return
    }

    const cnpjFormatado = formatarCnpjCpf(rawDoc)

    // Se for CNPJ Alfanumérico (IN RFB 2.229/2024)
    if (isCnpjAlfanumerico(rawDoc)) {
      setFormData(prev => ({
        ...prev,
        cnpj: cnpjFormatado
      }))
      toast.success('CNPJ Alfanumérico validado com sucesso (IN RFB nº 2.229/2024)! Complete os dados cadastrais.')
      return
    }

    setSearchingCnpj(true)
    const toastId = toast.loading('Consultando dados da empresa e Inscrição Estadual...')
    try {
      const res = await fetch(`/api/consulta-cnpj?cnpj=${encodeURIComponent(rawDoc)}`)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Não foi possível obter dados para este CNPJ.')
      }

      setFormData(prev => ({
        ...prev,
        cnpj: data.cnpj_formatado || cnpjFormatado,
        inscricao_estadual: data.inscricao_estadual || prev.inscricao_estadual,
        razao_social: data.razao_social || prev.razao_social,
        nome_fantasia: data.nome_fantasia || data.razao_social || prev.nome_fantasia,
        whatsapp: prev.whatsapp || data.whatsapp || '',
        email_fiscal: prev.email_fiscal || data.email || '',
        ramo_atividade: prev.ramo_atividade || data.ramo_atividade || '',
        cep: data.cep || prev.cep || '',
        logradouro: data.logradouro || prev.logradouro || '',
        numero: data.numero || prev.numero || '',
        complemento: data.complemento || prev.complemento || '',
        bairro: data.bairro || prev.bairro || '',
        cidade: data.cidade || prev.cidade || '',
        uf: data.uf || prev.uf || '',
        regime_tributario: data.regime_tributario || prev.regime_tributario || 'simples_nacional'
      }))

      if (data.aviso) {
        toast.success(data.aviso, { id: toastId, duration: 6000 })
      } else {
        toast.success(`Dados preenchidos via ${data.provedor?.toUpperCase() || 'Receita Federal'} com IE: ${data.inscricao_estadual || 'Não encontrada'}!`, { id: toastId })
      }
    } catch (err: any) {
      setFormData(prev => ({ ...prev, cnpj: cnpjFormatado }))
      toast.error(err.message || 'Erro ao consultar CNPJ. Preencha os campos manualmente.', { id: toastId })
    } finally {
      setSearchingCnpj(false)
    }
  }

  // Leitura inteligente de um XML de Amostra / Gabarito da Empresa
  const handleCarregarXmlAmostra = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const xmlText = event.target?.result as string
        if (!xmlText) throw new Error('Arquivo XML vazio')

        const extractTag = (xml: string, tag: string) => {
          const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`))
          return match ? match[1].trim() : ''
        }

        const emitMatch = xmlText.match(/<emit[^>]*>([\s\S]*?)<\/emit>/)
        const emitXml = emitMatch ? emitMatch[1] : ''

        const cnpj = extractTag(emitXml, 'CNPJ')
        const cpf = extractTag(emitXml, 'CPF')
        const doc = cnpj || cpf
        const xNome = extractTag(emitXml, 'xNome')
        const xFant = extractTag(emitXml, 'xFant')
        const ie = extractTag(emitXml, 'IE')
        const crt = extractTag(emitXml, 'CRT')

        const enderEmitMatch = emitXml.match(/<enderEmit[^>]*>([\s\S]*?)<\/enderEmit>/)
        const enderXml = enderEmitMatch ? enderEmitMatch[1] : ''
        const xLgr = extractTag(enderXml, 'xLgr')
        const nro = extractTag(enderXml, 'nro')
        const xCpl = extractTag(enderXml, 'xCpl')
        const xBairro = extractTag(enderXml, 'xBairro')
        const xMun = extractTag(enderXml, 'xMun')
        const uf = extractTag(enderXml, 'UF')
        const cepXml = extractTag(enderXml, 'CEP')

        if (!doc && !xNome) {
          throw new Error('Não foi possível identificar a tag <emit> com os dados da empresa neste XML.')
        }

        const formattedDoc = formatarCnpjCpf(doc) || doc

        let autoRegime = formData.regime_tributario
        if (crt === '1') autoRegime = 'simples_nacional'
        else if (crt === '2') autoRegime = 'simples_nacional_excesso'
        else if (crt === '3') autoRegime = 'lucro_presumido'
        else if (crt === '4') autoRegime = 'mei'

        setFormData(prev => ({
          ...prev,
          cnpj: formattedDoc || prev.cnpj,
          razao_social: xNome || prev.razao_social,
          nome_fantasia: xFant || xNome || prev.nome_fantasia,
          inscricao_estadual: ie || prev.inscricao_estadual,
          cep: cepXml || prev.cep,
          logradouro: xLgr || prev.logradouro,
          numero: nro || prev.numero,
          complemento: xCpl || prev.complemento,
          bairro: xBairro || prev.bairro,
          cidade: xMun || prev.cidade,
          uf: uf || prev.uf,
          regime_tributario: autoRegime || prev.regime_tributario
        }))

        toast.success(`XML de amostra lido com sucesso! Emitente: ${xNome || formattedDoc}`)
      } catch (err: any) {
        toast.error(err.message || 'Erro ao processar XML de amostra')
      }
    }
    reader.readAsText(file)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    // Bloqueio rigoroso de cadastro repetido
    const rawDoc = limparDocumento(formData.cnpj)
    if (rawDoc) {
      const duplicado = await checarCnpjDuplicado(rawDoc)
      if (duplicado) {
        toast.error(`❌ Cadastro bloqueado! O cliente "${duplicado.nome_fantasia || duplicado.razao_social}" já utiliza este CNPJ/CPF (${duplicado.cnpj}). Não é permitido cadastros repetidos no sistema.`, { duration: 7000 })
        setLoading(false)
        return
      }
    }

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
      custo: clienteData.custo ? parseFloat(String(clienteData.custo).replace(',', '.')) : 0,
      data_inicio_monitoramento: formData.data_inicio_monitoramento || null,
      numero_inicial_nfe: parseInt(String(formData.numero_inicial_nfe)) || 1,
      numero_inicial_nfce: parseInt(String(formData.numero_inicial_nfce)) || 1,
      numero_inicial_nfse: parseInt(String(formData.numero_inicial_nfse)) || 1,
      numero_inicial_cte: parseInt(String(formData.numero_inicial_cte)) || 1,
      numero_inicial_mdfe: parseInt(String(formData.numero_inicial_mdfe)) || 1,
      contabilidade_id: clienteData.contabilidade_id || null,
      certificado_validade: clienteData.certificado_validade || null,
      certificado_url: finalCertUrl,
      logo_url: finalLogoUrl,
      login_email: login_email && login_email.trim() !== '' ? login_email.trim() : null,
      login_senha: login_senha && login_senha.trim() !== '' ? login_senha.trim() : null
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
    window.dispatchEvent(new CustomEvent('hub_client_updated', { detail: { id: clienteResult.id } }))
    window.dispatchEvent(new Event('hub_settings_changed'))
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-4 border-b border-slate-100 gap-3">
              <h3 className="text-base font-bold text-slate-900">
                Dados da Empresa
              </h3>
              <div>
                <button
                  type="button"
                  onClick={() => xmlSampleRef.current?.click()}
                  title="Carregar um XML emitido pela empresa para preencher automaticamente CNPJ/CPF, Razão Social, IE e endereço"
                  className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl text-xs font-semibold border border-emerald-200 transition"
                >
                  <FileCode size={15} />
                  <span>Importar XML de Amostra da Empresa</span>
                </button>
                <input
                  ref={xmlSampleRef}
                  type="file"
                  accept=".xml"
                  className="hidden"
                  onChange={handleCarregarXmlAmostra}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              
              {/* Campo CNPJ / CPF com Botão de Consulta Automática */}
              <div className="md:col-span-1">
                <label className="block text-sm font-semibold text-slate-700 mb-1">CNPJ / CPF</label>
                <div className="flex gap-2">
                  <input 
                    required 
                    type="text" 
                    placeholder="00.000.000/0000-00 ou 000.000.000-00"
                    className={`w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 bg-slate-50/50 ${
                      clienteExistente 
                        ? 'border-red-400 focus:ring-red-500 text-red-900 bg-red-50/30' 
                        : 'border-slate-200 focus:ring-blue-500'
                    }`}
                    value={formData.cnpj} 
                    onChange={e => {
                      setFormData({...formData, cnpj: e.target.value})
                      if (clienteExistente) setClienteExistente(null)
                    }} 
                    onBlur={() => checarCnpjDuplicado(formData.cnpj)}
                  />
                  <button
                    type="button"
                    onClick={handleConsultarCnpj}
                    disabled={searchingCnpj || checkingDuplicidade}
                    title="Buscar dados do CNPJ na Receita Federal ou validar CPF"
                    className="px-3.5 py-2.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl font-semibold flex items-center justify-center transition border border-blue-200 disabled:opacity-50"
                  >
                    <Search size={18} className={(searchingCnpj || checkingDuplicidade) ? 'animate-spin' : ''} />
                  </button>
                </div>
                {clienteExistente ? (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-start gap-2 mt-2 font-medium animate-in fade-in">
                    <ShieldAlert size={16} className="text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-red-900 font-bold">Cadastro Repetido Bloqueado</strong>
                      Já existe um cliente cadastrado com este documento:
                      <span className="font-bold text-red-950 block mt-0.5">
                        {clienteExistente.nome_fantasia || clienteExistente.razao_social} ({clienteExistente.cnpj})
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 mt-1">Aceita CNPJ de Pessoa Jurídica ou CPF de Pessoa Física (Cadastros repetidos são bloqueados)</p>
                )}
              </div>

              {/* Inscrição Estadual (IE) */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Inscrição Estadual (IE)</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
                  placeholder="Ex: 151234567 ou ISENTO"
                  value={formData.inscricao_estadual} 
                  onChange={e => setFormData({...formData, inscricao_estadual: e.target.value})} 
                />
                <p className="text-[11px] text-slate-400 mt-1">Utilizada na validação de titularidade dos XMLs de vendas</p>
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
                <SistemaAutocompleteInput
                  required
                  id="sistema-novo"
                  value={formData.nome_sistema_utilizado}
                  onChange={val => setFormData({ ...formData, nome_sistema_utilizado: val })}
                  sistemasDisponiveis={sistemasSugeridos}
                />
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

              {userRole === 'admin' && (
                <>
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
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Custo do Cliente (R$)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      min="0"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 bg-slate-50/50 font-semibold text-rose-700"
                      placeholder="0.00"
                      value={formData.custo} 
                      onChange={e => setFormData({...formData, custo: e.target.value})} 
                    />
                    <div className="flex items-center justify-between text-[11px] mt-1">
                      <span className="text-slate-500">Custo operacional / licença</span>
                      {(formData.valor_mensalidade || formData.custo) && (
                        <span className="font-semibold text-blue-700 font-mono">
                          Lucro: {((parseFloat(String(formData.valor_mensalidade || 0).replace(',', '.')) || 0) - (parseFloat(String(formData.custo || 0).replace(',', '.')) || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Dia de Vencimento da Fatura</label>
                    <input 
                      type="number" 
                      min="1" 
                      max="31"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50 font-semibold"
                      placeholder="10"
                      value={formData.dia_vencimento} 
                      onChange={e => setFormData({...formData, dia_vencimento: e.target.value})} 
                    />
                    <p className="text-[11px] text-slate-500 mt-1">Gera fatura automática todo dia 01</p>
                  </div>
                </>
              )}

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

          {/* Endereço & Localização da Empresa */}
          <div className="pt-4 border-t border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 mb-4 border-b border-slate-100 gap-2">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <MapPin className="text-blue-600" size={20} />
                Endereço & Localização da Empresa
              </h3>
              <span className="text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full font-medium">
                Preenchido automaticamente pelo CNPJ ou pelo CEP (ViaCEP)
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* CEP */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">CEP</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="00000-000"
                    maxLength={9}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50 font-mono"
                    value={formData.cep} 
                    onChange={e => setFormData({...formData, cep: e.target.value})} 
                    onBlur={() => {
                      const raw = (formData.cep || '').replace(/\D/g, '')
                      if (raw.length === 8 && !formData.logradouro) {
                        handleConsultarCep()
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleConsultarCep}
                    disabled={searchingCep}
                    title="Buscar endereço pelo CEP no ViaCEP"
                    className="px-3.5 py-2.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl font-semibold flex items-center justify-center transition border border-blue-200 disabled:opacity-50"
                  >
                    <Search size={18} className={searchingCep ? 'animate-spin' : ''} />
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Busca automática nos Correios</p>
              </div>

              {/* Logradouro / Rua */}
              <div className="lg:col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-1">Logradouro / Rua / Avenida</label>
                <input 
                  type="text" 
                  placeholder="Ex: Av. Afonso Pena"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
                  value={formData.logradouro} 
                  onChange={e => setFormData({...formData, logradouro: e.target.value})} 
                />
              </div>

              {/* Número */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Número</label>
                <input 
                  type="text" 
                  placeholder="Ex: 1500 ou S/N"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
                  value={formData.numero} 
                  onChange={e => setFormData({...formData, numero: e.target.value})} 
                />
              </div>

              {/* Complemento */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Complemento</label>
                <input 
                  type="text" 
                  placeholder="Ex: Sala 201, Bloco B"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
                  value={formData.complemento} 
                  onChange={e => setFormData({...formData, complemento: e.target.value})} 
                />
              </div>

              {/* Bairro */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Bairro</label>
                <input 
                  type="text" 
                  placeholder="Ex: Centro"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
                  value={formData.bairro} 
                  onChange={e => setFormData({...formData, bairro: e.target.value})} 
                />
              </div>

              {/* Cidade */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Cidade</label>
                <input 
                  type="text" 
                  placeholder="Ex: Belo Horizonte"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
                  value={formData.cidade} 
                  onChange={e => setFormData({...formData, cidade: e.target.value})} 
                />
              </div>

              {/* UF / Estado */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">UF (Estado)</label>
                <input 
                  type="text" 
                  maxLength={2}
                  placeholder="Ex: MG"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50 uppercase font-semibold"
                  value={formData.uf} 
                  onChange={e => setFormData({...formData, uf: e.target.value.toUpperCase()})} 
                />
              </div>
            </div>
          </div>

          {/* Ponto de Partida Fiscal & Competência Inicial */}
          <div className="pt-4 border-t border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 mb-4 border-b border-slate-100 gap-2">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="text-blue-600" size={20} />
                Ponto de Partida Fiscal & Competência Inicial
              </h3>
              <span className="text-xs text-slate-500 font-normal">
                Define o mês e números iniciais a partir dos quais os XMLs serão enviados ao Portal
              </span>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1 flex items-center gap-1.5">
                    <span>Mês / Ano de Início das Atividades</span>
                    <span className="text-xs text-blue-600 font-bold">*</span>
                  </label>
                  <input 
                    type="month" 
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-semibold text-slate-800"
                    value={formData.data_inicio_monitoramento ? formData.data_inicio_monitoramento.substring(0, 7) : ''} 
                    onChange={e => {
                      const val = e.target.value
                      setFormData({ ...formData, data_inicio_monitoramento: val ? `${val}-01` : '' })
                    }} 
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Ex: <strong>09/2026</strong>. XMLs emitidos antes desta competência serão ignorados pelo Hub.
                  </p>
                </div>

                <div className="md:col-span-2 flex items-center bg-blue-50/70 border border-blue-100 rounded-xl p-3 text-xs text-blue-900 leading-relaxed">
                  <p>
                    <strong>💡 Controle Anti-Poluição & Inutilizações:</strong> Configurar a data e número de início impede o envio de notas de anos passados e garante que a auditoria de <strong>inutilizações e numerações faltantes</strong> conte apenas as notas legítimas a partir do início do contrato.
                  </p>
                </div>
              </div>

              {/* Grid com Numerações Iniciais de Cada Documento Fiscal */}
              <div className="pt-2 border-t border-slate-200/60">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Primeiro Número de Cada Documento Fiscal (Início da Contagem / Envio)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {/* NF-e Modelo 55 */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                    <span className="text-[11px] font-bold text-blue-700 block mb-1">NF-e (Mod. 55)</span>
                    <input 
                      type="number" 
                      min={1}
                      placeholder="Ex: 1"
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono font-bold text-slate-900 text-sm"
                      value={formData.numero_inicial_nfe}
                      onChange={e => setFormData({ ...formData, numero_inicial_nfe: parseInt(e.target.value) || 1 })}
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Nota Fiscal Eletrônica</span>
                  </div>

                  {/* NFC-e Modelo 65 */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                    <span className="text-[11px] font-bold text-emerald-700 block mb-1">NFC-e (Mod. 65)</span>
                    <input 
                      type="number" 
                      min={1}
                      placeholder="Ex: 1"
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono font-bold text-slate-900 text-sm"
                      value={formData.numero_inicial_nfce}
                      onChange={e => setFormData({ ...formData, numero_inicial_nfce: parseInt(e.target.value) || 1 })}
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Cupom Fiscal / Varejo</span>
                  </div>

                  {/* NFS-e Serviço */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                    <span className="text-[11px] font-bold text-indigo-700 block mb-1">NFS-e (Serviço)</span>
                    <input 
                      type="number" 
                      min={1}
                      placeholder="Ex: 1"
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono font-bold text-slate-900 text-sm"
                      value={formData.numero_inicial_nfse}
                      onChange={e => setFormData({ ...formData, numero_inicial_nfse: parseInt(e.target.value) || 1 })}
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Nota Fiscal de Serviços</span>
                  </div>

                  {/* CT-e Modelo 57 */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                    <span className="text-[11px] font-bold text-amber-700 block mb-1">CT-e (Mod. 57)</span>
                    <input 
                      type="number" 
                      min={1}
                      placeholder="Ex: 1"
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono font-bold text-slate-900 text-sm"
                      value={formData.numero_inicial_cte}
                      onChange={e => setFormData({ ...formData, numero_inicial_cte: parseInt(e.target.value) || 1 })}
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Transporte / Cargas</span>
                  </div>

                  {/* MDF-e Modelo 58 */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                    <span className="text-[11px] font-bold text-purple-700 block mb-1">MDF-e (Mod. 58)</span>
                    <input 
                      type="number" 
                      min={1}
                      placeholder="Ex: 1"
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono font-bold text-slate-900 text-sm"
                      value={formData.numero_inicial_mdfe}
                      onChange={e => setFormData({ ...formData, numero_inicial_mdfe: parseInt(e.target.value) || 1 })}
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Manifesto de Carga</span>
                  </div>
                </div>
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
