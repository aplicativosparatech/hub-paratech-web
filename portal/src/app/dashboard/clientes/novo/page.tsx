'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  ArrowLeft, 
  UserPlus, 
  Save, 
  Search, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  ShieldAlert, 
  FileKey, 
  FileCode, 
  MapPin, 
  Calendar, 
  DollarSign, 
  Sparkles, 
  ExternalLink,
  Building2,
  Phone,
  KeyRound,
  ChevronsDown,
  ChevronsUp,
  Layers,
  Store
} from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import toast from 'react-hot-toast'
import { limparDocumento, formatarCnpjCpf, validarCnpj, validarCpf, isCnpjAlfanumerico } from '@/utils/cnpjAlfanumerico'
import { formatarDuasCasasDecimais, parseValorDecimal } from '@/utils/money'
import { SistemaAutocompleteInput, ERP_PADRAO } from '@/components/SistemaAutocompleteInput'
import { FormAccordionCard } from '@/components/ui/FormAccordionCard'

export default function NovoClientePage() {
  const router = useRouter()
  const supabase = createClient()
  const xmlSampleRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [searchingCnpj, setSearchingCnpj] = useState(false)
  const [searchingCep, setSearchingCep] = useState(false)
  const [showPassword, setShowPassword] = useState(true)
  const [showCertPassword, setShowCertPassword] = useState(false)
  const [showGeminiKey, setShowGeminiKey] = useState(false)
  const [testingGemini, setTestingGemini] = useState(false)
  const [contabilidades, setContabilidades] = useState<any[]>([])
  const [sistemasSugeridos, setSistemasSugeridos] = useState<string[]>(ERP_PADRAO)
  const [clienteExistente, setClienteExistente] = useState<{ id: string; razao_social: string; nome_fantasia?: string; cnpj: string } | null>(null)
  const [checkingDuplicidade, setCheckingDuplicidade] = useState(false)
  const [userRole, setUserRole] = useState<'admin' | 'contabilidade' | 'cliente'>('admin')

  // Controle dos cards sanfona - padrão fechado (todos false)
  const [openCards, setOpenCards] = useState<Record<string, boolean>>({
    empresa: false,
    endereco: false,
    cobranca: false,
    contato: false,
    fiscal: false,
    certificado: false,
    ia: false,
    acesso: false
  })

  const toggleCard = (card: string) => {
    setOpenCards(prev => ({ ...prev, [card]: !prev[card] }))
  }

  const expandAll = () => {
    setOpenCards({
      empresa: true,
      endereco: true,
      cobranca: true,
      contato: true,
      fiscal: true,
      certificado: true,
      ia: true,
      acesso: true
    })
  }

  const collapseAll = () => {
    setOpenCards({
      empresa: false,
      endereco: false,
      cobranca: false,
      contato: false,
      fiscal: false,
      certificado: false,
      ia: false,
      acesso: false
    })
  }

  const [formData, setFormData] = useState({
    razao_social: '',
    nome_fantasia: '',
    cnpj: '',
    inscricao_estadual: '',
    nome_sistema_utilizado: '',
    contabilidade_id: '',
    whatsapp: '',
    whatsapp_cobranca: '',
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
    multa_atraso_percentual: '',
    juros_mora_mensal_percentual: '',
    dias_carencia: '',
    is_ativo: true,
    is_associacao: false,
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
    logo_url: '',
    plano_auditoria_tributaria: false,
    gemini_api_key: '',
    gemini_modelo: 'gemini-1.5-flash'
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
      setOpenCards(prev => ({ ...prev, certificado: true }))
      toast.success(`Certificado lido com sucesso! Titular: ${data.titular}`, { id: toastId })
    } catch (err: any) {
      setCertError(err.message)
      toast.error(err.message, { id: toastId })
    } finally {
      setReadingCert(false)
    }
  }

  // Teste de conexão do API Token do Google Gemini do Cliente
  const handleTestarGemini = async () => {
    const key = formData.gemini_api_key?.trim()
    if (!key || key.length < 10) {
      toast.error('Informe um API Token válido do Google Gemini para testar.')
      return
    }

    setTestingGemini(true)
    const toastId = toast.loading('Testando conexão com o Google AI Studio...')
    try {
      const res = await fetch('/api/tributario/testar-token-cliente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: key,
          modelo: formData.gemini_modelo || 'gemini-1.5-flash'
        })
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Token rejeitado pela API do Google.')
      }

      toast.success(data.mensagem || 'Token do Google Gemini validado com sucesso!', { id: toastId, duration: 5000 })
    } catch (err: any) {
      toast.error(err.message || 'Falha ao testar token.', { id: toastId })
    } finally {
      setTestingGemini(false)
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
      setOpenCards(prev => ({ ...prev, endereco: true }))
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
        setOpenCards(prev => ({ ...prev, empresa: true }))
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
      setOpenCards(prev => ({ ...prev, empresa: true }))
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
      setOpenCards(prev => ({ ...prev, empresa: true }))
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
        whatsapp_cobranca: prev.whatsapp_cobranca || data.whatsapp || '',
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

      setOpenCards(prev => ({ ...prev, empresa: true, endereco: true }))

      if (data.aviso) {
        toast.success(data.aviso, { id: toastId, duration: 6000 })
      } else {
        toast.success(`Dados preenchidos via ${data.provedor?.toUpperCase() || 'Receita Federal'} com IE: ${data.inscricao_estadual || 'Não encontrada'}!`, { id: toastId })
      }
    } catch (err: any) {
      setFormData(prev => ({ ...prev, cnpj: cnpjFormatado }))
      setOpenCards(prev => ({ ...prev, empresa: true }))
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

        setOpenCards(prev => ({ ...prev, empresa: true, endereco: true }))
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

    // Validações com expansão automática do card correspondente
    if (!formData.cnpj?.trim()) {
      setOpenCards(prev => ({ ...prev, empresa: true }))
      toast.error('Informe o CNPJ ou CPF da empresa.')
      setLoading(false)
      return
    }

    if (!formData.razao_social?.trim()) {
      setOpenCards(prev => ({ ...prev, empresa: true }))
      toast.error('Informe a Razão Social da empresa.')
      setLoading(false)
      return
    }

    if (!formData.nome_sistema_utilizado?.trim()) {
      setOpenCards(prev => ({ ...prev, empresa: true }))
      toast.error('Informe o Nome do Sistema Monitorado (ERP/PDV).')
      setLoading(false)
      return
    }

    // Bloqueio rigoroso de cadastro repetido
    const rawDoc = limparDocumento(formData.cnpj)
    if (rawDoc) {
      const duplicado = await checarCnpjDuplicado(rawDoc)
      if (duplicado) {
        setOpenCards(prev => ({ ...prev, empresa: true }))
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
        setOpenCards(prev => ({ ...prev, certificado: true }))
        toast.error('Erro ao enviar certificado: ' + (certUploadData.error || 'Falha no envio'))
        setLoading(false)
        return
      }
      finalCertUrl = certUploadData.storagePath
    }

    const { login_email, login_senha, plano_auditoria_tributaria, gemini_api_key, gemini_modelo, ...clienteData } = formData
    
    const payload = {
      ...clienteData,
      whatsapp_cobranca: formData.whatsapp_cobranca?.trim() || null,
      is_ativo: formData.is_ativo,
      is_associacao: Boolean(formData.is_associacao),
      dia_vencimento: parseInt(String(formData.dia_vencimento)) || 10,
      valor_mensalidade: parseValorDecimal(clienteData.valor_mensalidade),
      custo: parseValorDecimal(clienteData.custo),
      multa_atraso_percentual: formData.multa_atraso_percentual !== '' && formData.multa_atraso_percentual !== null ? parseValorDecimal(formData.multa_atraso_percentual) : null,
      juros_mora_mensal_percentual: formData.juros_mora_mensal_percentual !== '' && formData.juros_mora_mensal_percentual !== null ? parseValorDecimal(formData.juros_mora_mensal_percentual) : null,
      dias_carencia: formData.dias_carencia !== '' && formData.dias_carencia !== null ? parseInt(String(formData.dias_carencia)) : null,
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

    // 1.1 Sincronizar configuracoes_hub com vencimento, valor e status da IA
    if (clienteResult?.id) {
      await supabase.from('configuracoes_hub').upsert({
        cliente_id: clienteResult.id,
        dia_vencimento: payload.dia_vencimento,
        valor_mensalidade: payload.valor_mensalidade,
        analise_ia_xmls_ativa: Boolean(formData.plano_auditoria_tributaria)
      })

      // Sincronizar token do Gemini nas integrações se informado
      if (formData.plano_auditoria_tributaria && formData.gemini_api_key?.trim()) {
        await supabase.from('integracoes').insert([{
          tipo: 'ia_cliente',
          provedor: `gemini_${clienteResult.id}`,
          credenciais: {
            cliente_id: clienteResult.id,
            api_key: formData.gemini_api_key.trim(),
            modelo: formData.gemini_modelo || 'gemini-1.5-flash',
            plano_auditoria_tributaria: true
          },
          is_ativo: true
        }])
      }
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
        <p className="text-slate-500 text-sm mt-1">
          Cadastre uma nova empresa cliente com perfil fiscal completo para gerar o Token do Hub e vincular à contabilidade.
        </p>
      </header>

      {/* Barra Superior de Ações do Accordion */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-100/70 border border-slate-200/80 rounded-2xl">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
          <Layers size={17} className="text-blue-600" />
          <span>Cadastro organizado em cards contextuais</span>
          <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-500 font-normal">
            Padrão sanfona fechado
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={expandAll}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-2xs transition"
          >
            <ChevronsDown size={14} className="text-blue-600" />
            <span>Expandir Todos</span>
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-2xs transition"
          >
            <ChevronsUp size={14} className="text-slate-500" />
            <span>Recolher Todos</span>
          </button>
        </div>
      </div>

      {/* Formulário com Cards de Efeito Sanfona */}
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        
        {/* CARD 1: DADOS CADASTRAIS & IDENTIFICAÇÃO */}
        <FormAccordionCard
          id="empresa"
          title="Dados Cadastrais & Identificação"
          subtitle="CNPJ/CPF, Razão Social, Nome Fantasia, Regime Tributário, ERP e Logomarca"
          icon={<Building2 size={22} />}
          iconBgColor="bg-blue-50 text-blue-600 border border-blue-100"
          isOpen={openCards.empresa}
          onToggle={() => toggleCard('empresa')}
          headerAction={
            <div>
              <button
                type="button"
                onClick={() => xmlSampleRef.current?.click()}
                title="Carregar um XML emitido pela empresa para preencher automaticamente CNPJ/CPF, Razão Social, IE e endereço"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl text-xs font-semibold border border-emerald-200 transition"
              >
                <FileCode size={14} />
                <span className="hidden sm:inline">Importar XML Amostra</span>
                <span className="sm:hidden">XML Amostra</span>
              </button>
              <input
                ref={xmlSampleRef}
                type="file"
                accept=".xml"
                className="hidden"
                onChange={handleCarregarXmlAmostra}
              />
            </div>
          }
          badge={
            formData.cnpj ? (
              <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 font-mono">
                {formData.cnpj}
              </span>
            ) : (
              <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                Obrigatório
              </span>
            )
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Campo CNPJ / CPF com Botão de Consulta Automática */}
            <div className="md:col-span-1">
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                CNPJ / CPF <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <input 
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

            {/* Regime Tributário (CRT) */}
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

            {/* Razão Social */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Razão Social <span className="text-red-500">*</span>
              </label>
              <input 
                type="text" 
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
                placeholder="Nome oficial da empresa"
                value={formData.razao_social} 
                onChange={e => setFormData({...formData, razao_social: e.target.value})} 
              />
            </div>

            {/* Nome Fantasia */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Nome Fantasia</label>
              <input 
                type="text" 
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
                placeholder="Nome comercial"
                value={formData.nome_fantasia} 
                onChange={e => setFormData({...formData, nome_fantasia: e.target.value})} 
              />
            </div>

            {/* Ramo de Atividade */}
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

            {/* Nome do Sistema Monitorado (ERP/PDV) */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Nome do Sistema Monitorado (ERP/PDV) <span className="text-red-500">*</span>
              </label>
              <SistemaAutocompleteInput
                required
                id="sistema-novo"
                value={formData.nome_sistema_utilizado}
                onChange={val => setFormData({ ...formData, nome_sistema_utilizado: val })}
                sistemasDisponiveis={sistemasSugeridos}
              />
            </div>

            {/* Vincular a Contabilidade */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Vincular a uma Contabilidade</label>
              <select 
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
                value={formData.contabilidade_id} 
                onChange={e => setFormData({...formData, contabilidade_id: e.target.value})}
              >
                <option value="">Nenhuma</option>
                {contabilidades.map(c => (
                  <option key={c.id} value={c.id}>{c.razao_social}</option>
                ))}
              </select>
            </div>

            {/* Status no Sistema */}
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

            {/* Toggle MEI Simples */}
            <div className="md:col-span-2 lg:col-span-3 p-4 bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 rounded-2xl flex items-start sm:items-center justify-between gap-4">
              <div className="space-y-0.5">
                <label className="text-sm font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-2 cursor-pointer">
                  <Store className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  Aplicativo MEI Simples (SaaS Nativo)
                </label>
                <p className="text-xs text-indigo-800/80 dark:text-indigo-300/80 leading-relaxed">
                  Marque esta opção caso este cliente utilize o aplicativo <strong>MEI Simples</strong>. Isso define o sistema em uso como <code>MEI_SIMPLES</code> e inclui a empresa na aba de gestão <strong>MEI Simples</strong> do Hub com controle nativo de assinaturas, bloqueios e pagamentos PIX sem necessidade de executável desktop instalado.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input 
                  type="checkbox" 
                  checked={Boolean(formData.nome_sistema_utilizado?.toUpperCase().includes('MEI'))} 
                  onChange={e => {
                    const checked = e.target.checked
                    setFormData({ 
                      ...formData, 
                      nome_sistema_utilizado: checked ? 'MEI_SIMPLES' : '' 
                    })
                  }} 
                  className="sr-only peer" 
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            {/* Associação / Cooperativa toggle */}
            <div className="md:col-span-2 lg:col-span-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-start sm:items-center justify-between gap-4">
              <div className="space-y-0.5">
                <label className="text-sm font-bold text-slate-900 flex items-center gap-2 cursor-pointer">
                  Associação / Cooperativa
                </label>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Marque esta opção caso a empresa seja uma <strong>Associação, Cooperativa ou Entidade</strong> onde notas fiscais de entrada possam ser emitidas pela própria organização ou associados (mesmo CNPJ). Em empresas convencionais (desmarcado), notas de entrada devem ter obrigatoriamente emitentes terceiros (fornecedores) e emitentes iguais à própria empresa são tratados como divergentes.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input 
                  type="checkbox" 
                  checked={formData.is_associacao} 
                  onChange={e => setFormData({ ...formData, is_associacao: e.target.checked })} 
                  className="sr-only peer" 
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* Logomarca da Empresa */}
            <div className="md:col-span-2 lg:col-span-3">
              <label className="block text-sm font-semibold text-slate-700 mb-1">Logomarca da Empresa</label>
              <input 
                type="file" 
                accept="image/*" 
                className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50 text-sm"
                onChange={e => { if (e.target.files && e.target.files.length > 0) setLogoFile(e.target.files[0]) }} 
              />
            </div>
          </div>
        </FormAccordionCard>

        {/* CARD 2: ENDEREÇO & LOCALIZAÇÃO (Logo após dados cadastrais) */}
        <FormAccordionCard
          id="endereco"
          title="Endereço & Localização"
          subtitle="Logradouro, número, complemento, bairro, cidade e UF com busca ViaCEP"
          icon={<MapPin size={22} />}
          iconBgColor="bg-indigo-50 text-indigo-600 border border-indigo-100"
          isOpen={openCards.endereco}
          onToggle={() => toggleCard('endereco')}
          badge={
            formData.cidade && formData.uf ? (
              <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                {formData.cidade} / {formData.uf}
              </span>
            ) : (
              <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-normal text-slate-400 bg-slate-100">
                ViaCEP
              </span>
            )
          }
        >
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
        </FormAccordionCard>

        {/* CARD 3: FATURAMENTO & PARÂMETROS DE COBRANÇA (Com campo WhatsApp para cobrança) */}
        {userRole === 'admin' && (
          <FormAccordionCard
            id="cobranca"
            title="Faturamento & Parâmetros de Cobrança"
            subtitle="Mensalidade, custo operacional, dia de vencimento, WhatsApp de cobrança e regras individuais de juros"
            icon={<DollarSign size={22} />}
            iconBgColor="bg-teal-50 text-teal-600 border border-teal-100"
            isOpen={openCards.cobranca}
            onToggle={() => toggleCard('cobranca')}
            badge={
              <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200">
                {formData.valor_mensalidade ? `R$ ${formData.valor_mensalidade}/mês` : 'R$ 0,00'} • Dia {formData.dia_vencimento || 10}
              </span>
            }
          >
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Valor da Mensalidade (R$)</label>
                  <input 
                    type="text"
                    inputMode="decimal"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50 font-semibold"
                    placeholder="0,00"
                    value={formData.valor_mensalidade} 
                    onChange={e => setFormData({...formData, valor_mensalidade: e.target.value})} 
                    onBlur={e => {
                      if (e.target.value) {
                        setFormData(prev => ({ ...prev, valor_mensalidade: formatarDuasCasasDecimais(e.target.value) }))
                      }
                    }}
                  />
                  <p className="text-[11px] text-slate-500 mt-1">Valor cobrado mensalmente do cliente</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Custo do Cliente (R$)</label>
                  <input 
                    type="text"
                    inputMode="decimal"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 bg-slate-50/50 font-semibold text-rose-700"
                    placeholder="0,00"
                    value={formData.custo} 
                    onChange={e => setFormData({...formData, custo: e.target.value})} 
                    onBlur={e => {
                      if (e.target.value) {
                        setFormData(prev => ({ ...prev, custo: formatarDuasCasasDecimais(e.target.value) }))
                      }
                    }}
                  />
                  <div className="flex items-center justify-between text-[11px] mt-1">
                    <span className="text-slate-500">Custo operacional</span>
                    {(formData.valor_mensalidade || formData.custo) && (
                      <span className="font-semibold text-blue-700 font-mono">
                        Lucro: {(parseValorDecimal(formData.valor_mensalidade) - parseValorDecimal(formData.custo)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                    <span>WhatsApp de Cobrança / Faturas</span>
                  </label>
                  <input 
                    type="text" 
                    placeholder="5511999999999" 
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white font-medium text-slate-800"
                    value={formData.whatsapp_cobranca} 
                    onChange={e => setFormData({...formData, whatsapp_cobranca: e.target.value})} 
                  />
                  <p className="text-[11px] text-slate-500 mt-1">Recebe links de faturas Pix (se vazio, usa o WhatsApp geral)</p>
                </div>
              </div>

              {/* Seção Destacada: Parâmetros Individuais de Cobrança e Juros */}
              <div className="p-5 bg-gradient-to-br from-emerald-50/70 via-teal-50/40 to-slate-50 border-2 border-emerald-300 rounded-2xl shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-emerald-200">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-xs">
                      <DollarSign size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-slate-900">
                          Parâmetros de Cobrança, Juros e Carência (Desta Empresa)
                        </h4>
                        <span className="text-[10px] uppercase font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md border border-emerald-200">
                          Prioridade Máxima
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Se preenchidos, os valores deste cliente anulam e substituem as taxas globais. Se deixados em branco, assumem automaticamente o padrão global do sistema.
                      </p>
                    </div>
                  </div>
                  <Link 
                    href="/dashboard/configuracoes-portal?aba=cobranca" 
                    target="_blank"
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-900 bg-white border border-emerald-200 px-3 py-1.5 rounded-lg shadow-2xs hover:bg-emerald-50 transition shrink-0 inline-flex items-center gap-1"
                  >
                    Ver Regras Globais ↗
                  </Link>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Multa por Atraso (%)
                    </label>
                    <div className="relative">
                      <input 
                        type="text" 
                        inputMode="decimal"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white font-bold text-slate-900 pr-10 text-sm"
                        placeholder="Padrão Global: 2,00%"
                        value={formData.multa_atraso_percentual} 
                        onChange={e => setFormData({...formData, multa_atraso_percentual: e.target.value})} 
                        onBlur={e => {
                          if (e.target.value) {
                            setFormData(prev => ({ ...prev, multa_atraso_percentual: formatarDuasCasasDecimais(e.target.value) }))
                          }
                        }}
                      />
                      <span className="absolute right-3.5 top-2.5 text-xs text-slate-400 font-bold">%</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">Deixe em branco para usar a regra global (2%)</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Juros de Mora Mensal (%)
                    </label>
                    <div className="relative">
                      <input 
                        type="text" 
                        inputMode="decimal"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white font-bold text-slate-900 pr-16 text-sm"
                        placeholder="Padrão Global: 1,00%"
                        value={formData.juros_mora_mensal_percentual} 
                        onChange={e => setFormData({...formData, juros_mora_mensal_percentual: e.target.value})} 
                        onBlur={e => {
                          if (e.target.value) {
                            setFormData(prev => ({ ...prev, juros_mora_mensal_percentual: formatarDuasCasasDecimais(e.target.value) }))
                          }
                        }}
                      />
                      <span className="absolute right-3.5 top-2.5 text-xs text-slate-400 font-bold">% a.m.</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">Deixe em branco para usar a regra global (1% a.m.)</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Dias de Carência / Tolerância
                    </label>
                    <div className="relative">
                      <input 
                        type="number" 
                        min="0"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white font-bold text-slate-900 pr-14 text-sm"
                        placeholder="Padrão Global: 3 dias"
                        value={formData.dias_carencia} 
                        onChange={e => setFormData({...formData, dias_carencia: e.target.value})} 
                      />
                      <span className="absolute right-3.5 top-2.5 text-xs text-slate-400 font-bold">dias</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">Deixe em branco para usar carência global (3 dias)</p>
                  </div>
                </div>
              </div>
            </div>
          </FormAccordionCard>
        )}

        {/* CARD 4: CONTATOS & RESPONSÁVEL (Renomeado) */}
        <FormAccordionCard
          id="contato"
          title="Contatos & Responsável"
          subtitle="WhatsApp principal de contato, nome do responsável legal, CPF e e-mail fiscal"
          icon={<Phone size={22} />}
          iconBgColor="bg-emerald-50 text-emerald-600 border border-emerald-100"
          isOpen={openCards.contato}
          onToggle={() => toggleCard('contato')}
          badge={
            formData.whatsapp || formData.email_fiscal ? (
              <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                {formData.whatsapp || formData.email_fiscal}
              </span>
            ) : (
              <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-normal text-slate-400 bg-slate-100">
                Opcional
              </span>
            )
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Nome do Contato / Responsável</label>
              <input 
                type="text" 
                placeholder="Ex: João Silva" 
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
                value={formData.nome_contato} 
                onChange={e => setFormData({...formData, nome_contato: e.target.value})} 
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">CPF do Responsável</label>
              <input 
                type="text" 
                placeholder="000.000.000-00" 
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
                value={formData.cpf_contato} 
                onChange={e => setFormData({...formData, cpf_contato: e.target.value})} 
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">WhatsApp Principal / Notificações</label>
              <input 
                type="text" 
                placeholder="5511999999999" 
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
                value={formData.whatsapp} 
                onChange={e => setFormData({...formData, whatsapp: e.target.value})} 
              />
              <p className="text-[11px] text-slate-400 mt-1">Contato geral da empresa e lembretes de certificado digital</p>
            </div>

            <div className="md:col-span-2 lg:col-span-3">
              <label className="block text-sm font-semibold text-slate-700 mb-1">E-mail Fiscal (para envio de guias e relatórios)</label>
              <input 
                type="email" 
                placeholder="fiscal@empresa.com.br" 
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
                value={formData.email_fiscal} 
                onChange={e => setFormData({...formData, email_fiscal: e.target.value})} 
              />
            </div>
          </div>
        </FormAccordionCard>

        {/* CARD 5: PONTO DE PARTIDA FISCAL & NUMERAÇÃO INICIAL */}
        <FormAccordionCard
          id="fiscal"
          title="Ponto de Partida Fiscal & Numeração Inicial"
          subtitle="Mês/ano de início do monitoramento e primeiro número de cada documento fiscal"
          icon={<Calendar size={22} />}
          iconBgColor="bg-cyan-50 text-cyan-600 border border-cyan-100"
          isOpen={openCards.fiscal}
          onToggle={() => toggleCard('fiscal')}
          badge={
            formData.data_inicio_monitoramento ? (
              <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-cyan-50 text-cyan-700 border border-cyan-200 font-mono">
                Início: {formData.data_inicio_monitoramento.substring(0, 7)}
              </span>
            ) : (
              <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-normal text-slate-400 bg-slate-100">
                Recomendado
              </span>
            )
          }
        >
          <div className="space-y-4">
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

              <div className="md:col-span-2 flex items-center bg-blue-50/70 border border-blue-100 rounded-xl p-3.5 text-xs text-blue-900 leading-relaxed">
                <p>
                  <strong>💡 Controle Anti-Poluição & Inutilizações:</strong> Configurar a data e número de início impede o envio de notas de anos passados e garante que a auditoria de <strong>inutilizações e numerações faltantes</strong> conte apenas as notas legítimas a partir do início do contrato.
                </p>
              </div>
            </div>

            {/* Grid com Numerações Iniciais de Cada Documento Fiscal */}
            <div className="pt-3 border-t border-slate-200/60">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
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
        </FormAccordionCard>

        {/* CARD 6: CERTIFICADO DIGITAL A1 */}
        <FormAccordionCard
          id="certificado"
          title="Certificado Digital A1 (.pfx / .p12)"
          subtitle="Upload de arquivo, senha e auditoria de titularidade e validade"
          icon={<FileKey size={22} />}
          iconBgColor="bg-amber-50 text-amber-600 border border-amber-100"
          isOpen={openCards.certificado}
          onToggle={() => toggleCard('certificado')}
          badge={
            certInfo ? (
              <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                ✓ Válido até {certInfo.validade}
              </span>
            ) : formData.certificado_validade ? (
              <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                Vence em {formData.certificado_validade}
              </span>
            ) : (
              <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-normal text-slate-400 bg-slate-100">
                Opcional
              </span>
            )
          }
        >
          <div className="space-y-4">
            <div className="p-3 bg-amber-50/60 border border-amber-200/80 rounded-xl text-xs text-amber-800 flex items-center justify-between">
              <span>🔔 <strong>Aviso Automático:</strong> O cliente receberá lembretes via WhatsApp 45 dias antes do vencimento do Certificado.</span>
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
                <div className="md:col-span-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-emerald-950 animate-in fade-in">
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
                <div className="md:col-span-3 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium animate-in fade-in">
                  ⚠️ {certError}
                </div>
              )}
            </div>
          </div>
        </FormAccordionCard>

        {/* CARD 7: PLANO AUDITORIA TRIBUTÁRIA COM IA (GOOGLE GEMINI) */}
        <FormAccordionCard
          id="ia"
          title="Auditoria Tributária com IA (Google Gemini)"
          subtitle="Habilitar IA tributária própria com chave de API do cliente (Google AI Studio)"
          icon={<Sparkles size={22} />}
          iconBgColor="bg-violet-50 text-violet-600 border border-violet-100"
          isOpen={openCards.ia}
          onToggle={() => toggleCard('ia')}
          badge={
            formData.plano_auditoria_tributaria ? (
              <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                ✓ IA Ativada
              </span>
            ) : (
              <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-normal text-slate-400 bg-slate-100">
                Desativado
              </span>
            )
          }
        >
          <div className="p-5 bg-gradient-to-br from-slate-50 to-amber-50/30 border border-slate-200 rounded-2xl space-y-4">
            {/* Toggle de Ativação do Plano */}
            <div className="flex items-start sm:items-center justify-between gap-4">
              <div className="space-y-0.5">
                <label className="text-sm font-bold text-slate-900 flex items-center gap-2 cursor-pointer">
                  Habilitar Plano de Auditoria Tributária com IA para este Cliente
                </label>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Libera os módulos de Corretor e Auditor Tributário com Inteligência Artificial para conferência automática de NCMs, CSTs, CESTs, produtos monofásicos e enquadramento da Reforma Tributária.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input 
                  type="checkbox" 
                  checked={formData.plano_auditoria_tributaria} 
                  onChange={e => setFormData({ ...formData, plano_auditoria_tributaria: e.target.checked })} 
                  className="sr-only peer" 
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>

            {/* Campo dinâmico do API Token do Gemini */}
            {formData.plano_auditoria_tributaria && (
              <div className="pt-4 border-t border-amber-100/80 space-y-4 animate-in fade-in duration-200">
                <div className="p-3.5 bg-amber-50 border border-amber-200/80 rounded-xl text-xs text-amber-950 flex items-start gap-2.5">
                  <Sparkles size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">
                    <span className="font-bold text-amber-900 block mb-0.5">Token de API Próprio do Cliente (Google AI Studio):</span>
                    <p className="text-amber-900/90 text-[11px]">
                      Insira abaixo a <strong>Chave de API do Google Gemini</strong> do cliente. As consultas tributárias e auditorias fiscais de XMLs desta empresa utilizarão a cota do cliente, sem consumir o saldo de API da sua plataforma.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                  <div className="md:col-span-8">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                        API Token do Google Gemini (Cliente)
                      </label>
                      <a
                        href="https://aistudio.google.com/app/apikey"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
                      >
                        <span>Obter chave no Google AI Studio</span>
                        <ExternalLink size={11} />
                      </a>
                    </div>
                    <div className="relative">
                      <input 
                        type={showGeminiKey ? 'text' : 'password'} 
                        placeholder="AIzaSy... (Chave de API do Google Gemini)" 
                        className="w-full px-4 py-2.5 pr-11 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white font-mono text-xs text-slate-900 shadow-xs"
                        value={formData.gemini_api_key} 
                        onChange={e => setFormData({ ...formData, gemini_api_key: e.target.value })} 
                      />
                      <button
                        type="button"
                        onClick={() => setShowGeminiKey(!showGeminiKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                        title={showGeminiKey ? 'Ocultar token' : 'Ver token'}
                      >
                        {showGeminiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {formData.gemini_api_key ? '✓ Token configurado para esta empresa' : 'Se deixado em branco, utilizará a chave global de IA do sistema.'}
                    </p>
                  </div>

                  <div className="md:col-span-4">
                    <button
                      type="button"
                      onClick={handleTestarGemini}
                      disabled={testingGemini || !formData.gemini_api_key}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-xs"
                    >
                      <Sparkles size={14} className={testingGemini ? 'animate-spin' : ''} />
                      {testingGemini ? 'Testando Conexão...' : 'Testar Token Gemini'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </FormAccordionCard>

        {/* CARD 8: ACESSO AO PORTAL (LOGIN) */}
        <FormAccordionCard
          id="acesso"
          title="Acesso ao Portal (Login do Cliente)"
          subtitle="E-mail e senha de login para a empresa acessar seu painel próprio"
          icon={<KeyRound size={22} />}
          iconBgColor="bg-sky-50 text-sky-600 border border-sky-100"
          isOpen={openCards.acesso}
          onToggle={() => toggleCard('acesso')}
          badge={
            formData.login_email ? (
              <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-sky-50 text-sky-700 border border-sky-200">
                {formData.login_email}
              </span>
            ) : (
              <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-normal text-slate-400 bg-slate-100">
                Opcional
              </span>
            )
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">E-mail de Login</label>
              <input 
                type="email" 
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
                placeholder="cliente@empresa.com"
                value={formData.login_email} 
                onChange={e => setFormData({...formData, login_email: e.target.value})} 
              />
              <p className="text-[11px] text-slate-500 mt-1">E-mail para autenticação no portal do cliente</p>
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
              <p className="text-[11px] text-slate-500 mt-1">Senha temporária ou definitiva do cliente</p>
            </div>
          </div>
        </FormAccordionCard>

        {/* Rodapé com Botão Salvar e Cancelar */}
        <div className="p-4 sm:p-5 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
          <p className="text-xs text-slate-500">
            Preencha ao menos a seção <strong>Dados Cadastrais</strong>. Os demais cards são opcionais e podem ser preenchidos a qualquer momento.
          </p>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Link
              href="/dashboard/clientes"
              className="w-full sm:w-auto px-5 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl font-semibold text-sm transition text-center"
            >
              Cancelar
            </Link>
            <button 
              type="submit" 
              disabled={loading}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold px-7 py-2.5 rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 text-sm disabled:opacity-50"
            >
              <Save size={18} />
              {loading ? 'Cadastrando cliente...' : 'Cadastrar Cliente'}
            </button>
          </div>
        </div>

      </form>
    </div>
  )
}
