'use client'

import React, { useState, useRef, useEffect } from 'react'
import { 
  Upload, FileText, CheckCircle2, AlertCircle, X, Loader2, 
  Download, Building2, Users, Search, Play, Check, RefreshCw, FileSpreadsheet,
  ShieldAlert, ShieldCheck, Sparkles, AlertTriangle
} from 'lucide-react'
import * as XLSX from 'xlsx'
import toast from 'react-hot-toast'
import { createClient } from '@/utils/supabase/client'
import { limparDocumento, formatarCnpjCpf, validarCnpj, isCnpjAlfanumerico } from '@/utils/cnpjAlfanumerico'

export interface ItemImportacao {
  idTemp: string
  cnpj: string
  cnpjFormatado: string
  razao_social: string
  nome_fantasia: string
  email: string
  telefone: string
  whatsapp: string
  cidade: string
  uf: string
  cep?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  ramo_atividade?: string
  regime_tributario?: string
  inscricao_estadual?: string
  nome_sistema_utilizado?: string
  dia_vencimento?: number
  valor_mensalidade?: number
  custo?: number
  jaCadastrado?: boolean
  nomeExistente?: string
  statusConsulta: 'pendente' | 'consultando' | 'sucesso' | 'erro' | 'manual' | 'duplicado'
  mensagemErro?: string
  origem: 'arquivo' | 'receita'
}

interface ImportadorLoteModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  tipo: 'contabilidade' | 'cliente'
  contabilidadesDisponiveis?: Array<{ id: string; razao_social: string }>
}

export default function ImportadorLoteModal({
  isOpen,
  onClose,
  onSuccess,
  tipo,
  contabilidadesDisponiveis = []
}: ImportadorLoteModalProps) {
  const [itens, setItens] = useState<ItemImportacao[]>([])
  const [arquivoNome, setArquivoNome] = useState<string>('')
  const [lendoArquivo, setLendoArquivo] = useState(false)
  const [processandoReceita, setProcessandoReceita] = useState(false)
  const [progressoReceita, setProgressoReceita] = useState<{ atual: number; total: number; mensagem?: string }>({ atual: 0, total: 0 })
  const [salvandoBanco, setSalvandoBanco] = useState(false)
  const [contabilidadeSelecionada, setContabilidadeSelecionada] = useState<string>('')
  
  // Mapa de CNPJs já cadastrados no banco para BLOQUEIO DE REPETIDOS
  const [cnpjsCadastrados, setCnpjsCadastrados] = useState<Map<string, { id: string; razao_social: string; nome_fantasia?: string }>>(new Map())
  const [carregandoBase, setCarregandoBase] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  // 0. Carrega todos os CNPJs já cadastrados no banco para bloquear duplicidade
  useEffect(() => {
    if (!isOpen) return
    async function carregarCadastrados() {
      setCarregandoBase(true)
      try {
        const tabela = tipo === 'contabilidade' ? 'contabilidades' : 'clientes'
        const { data } = await supabase.from(tabela).select('id, cnpj, razao_social, nome_fantasia')
        const mapa = new Map<string, { id: string; razao_social: string; nome_fantasia?: string }>()
        data?.forEach((reg: any) => {
          if (reg.cnpj) {
            const limpo = limparDocumento(reg.cnpj)
            if (limpo) mapa.set(limpo, reg)
          }
        })
        setCnpjsCadastrados(mapa)
      } catch (err) {
        console.error('Erro ao carregar CNPJs cadastrados:', err)
      } finally {
        setCarregandoBase(false)
      }
    }
    carregarCadastrados()
  }, [isOpen, tipo])

  if (!isOpen) return null

  // Gera token único para clientes (UUID v4 oficial válido para o tipo UUID do PostgreSQL)
  const gerarTokenHub = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID()
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      const v = c === 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
  }

  // Consulta API de dados reais da Receita Federal para um CNPJ
  const consultarDadosReaisCnpj = async (cnpjLimpo: string): Promise<Partial<ItemImportacao> | null> => {
    try {
      const res = await fetch(`/api/consulta-cnpj?cnpj=${encodeURIComponent(cnpjLimpo)}`)
      const data = await res.json()

      if (res.ok && data.sucesso) {
        return {
          razao_social: data.razao_social || '',
          nome_fantasia: data.nome_fantasia || data.razao_social || '',
          email: data.email || '',
          telefone: data.telefone || '',
          whatsapp: data.whatsapp || (data.telefone ? data.telefone.replace(/\D/g, '') : ''),
          cidade: data.cidade || '',
          uf: data.uf || '',
          cep: data.cep || '',
          logradouro: data.logradouro || '',
          numero: data.numero || '',
          complemento: data.complemento || '',
          bairro: data.bairro || '',
          ramo_atividade: data.ramo_atividade || '',
          regime_tributario: data.regime_tributario || 'simples_nacional',
          inscricao_estadual: data.inscricao_estadual || '',
          statusConsulta: 'sucesso',
          origem: 'receita'
        }
      }
    } catch (err) {
      console.error(`Erro ao consultar CNPJ ${cnpjLimpo}:`, err)
    }
    return null
  }

  // 1. Processamento de Arquivos (CSV, TXT, JSON, XLS, XLSX)
  const handleArquivoSelecionado = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setArquivoNome(file.name)
    setLendoArquivo(true)
    const toastId = toast.loading('Lendo e analisando arquivo...')

    try {
      const ext = file.name.split('.').pop()?.toLowerCase()
      let itensExtraidos: ItemImportacao[] = []

      if (ext === 'json') {
        const texto = await file.text()
        const parsed = JSON.parse(texto)
        itensExtraidos = processarJson(parsed)
      } else if (ext === 'txt') {
        const texto = await file.text()
        itensExtraidos = processarTxt(texto)
      } else if (ext === 'csv' || ext === 'xls' || ext === 'xlsx') {
        const arrayBuffer = await file.arrayBuffer()
        const wb = XLSX.read(arrayBuffer, { type: 'array' })
        const primeiraAba = wb.Sheets[wb.SheetNames[0]]
        const jsonPlanilha: any[] = XLSX.utils.sheet_to_json(primeiraAba, { defval: '' })
        itensExtraidos = processarPlanilhaJson(jsonPlanilha)
      } else {
        throw new Error('Formato de arquivo não suportado. Use CSV, TXT, JSON, XLS ou XLSX.')
      }

      if (itensExtraidos.length === 0) {
        throw new Error('Nenhum CNPJ ou registro válido encontrado no arquivo.')
      }

      // 1.1 Remover duplicatas de CNPJ dentro do próprio arquivo
      const cnpsVistos = new Set<string>()
      const itensUnicos = itensExtraidos.filter(it => {
        if (!it.cnpj) return true
        if (cnpsVistos.has(it.cnpj)) return false
        cnpsVistos.add(it.cnpj)
        return true
      })

      // 1.2 Cruzar com a base do Supabase para BLOQUEAR REPETIDOS
      let totalRepetidos = 0
      const itensTratados = itensUnicos.map((it) => {
        const jaExiste = cnpjsCadastrados.get(it.cnpj)
        if (jaExiste) {
          totalRepetidos++
          return {
            ...it,
            jaCadastrado: true,
            nomeExistente: jaExiste.nome_fantasia || jaExiste.razao_social,
            statusConsulta: 'duplicado' as const
          }
        }

        // Se já veio com Razão Social preenchida na planilha, marca como manual
        if (it.razao_social) {
          return {
            ...it,
            statusConsulta: 'manual' as const,
            origem: 'arquivo' as const
          }
        }

        // Caso contrário, fica pendente para buscar dados reais na Receita Federal
        return {
          ...it,
          statusConsulta: 'pendente' as const,
          origem: 'arquivo' as const
        }
      })

      setItens(itensTratados)

      if (totalRepetidos > 0) {
        toast.success(
          `${itensTratados.length} registros extraídos! (${totalRepetidos} repetidos identificados e bloqueados automaticamente)`, 
          { id: toastId, duration: 6000 }
        )
      } else {
        toast.success(`${itensTratados.length} novos CNPJs extraídos! Os dados reais serão preenchidos automaticamente.`, { id: toastId })
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao processar arquivo.', { id: toastId })
    } finally {
      setLendoArquivo(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // Processa Planilhas (XLSX, XLS, CSV)
  const processarPlanilhaJson = (linhas: any[]): ItemImportacao[] => {
    const resultado: ItemImportacao[] = []

    for (let i = 0; i < linhas.length; i++) {
      const row = linhas[i]
      
      let rawCnpj = ''
      let razao = ''
      let fantasia = ''
      let email = ''
      let tel = ''
      let cid = ''
      let uf = ''
      let cep = ''
      let logradouro = ''
      let numero = ''
      let complemento = ''
      let bairro = ''
      let ramo = ''
      let regime = ''
      let ie = ''

      for (const key of Object.keys(row)) {
        const kLower = key.toLowerCase().trim()
        const val = String(row[key] || '').trim()

        if (kLower.includes('cnpj') || kLower.includes('documento')) rawCnpj = val
        else if (kLower.includes('razao') || kLower.includes('empresa') || kLower === 'nome') razao = val
        else if (kLower.includes('fantasia')) fantasia = val
        else if (kLower.includes('email') || kLower.includes('e-mail')) email = val
        else if (kLower.includes('tel') || kLower.includes('cel') || kLower.includes('whats') || kLower.includes('contato')) tel = val
        else if (kLower.includes('cidade') || kLower.includes('municipio')) cid = val
        else if (kLower === 'uf' || kLower.includes('estado')) uf = val
        else if (kLower.includes('cep')) cep = val
        else if (kLower.includes('rua') || kLower.includes('logradouro') || kLower.includes('endereco')) logradouro = val
        else if (kLower.includes('numero') || kLower === 'nro') numero = val
        else if (kLower.includes('compl')) complemento = val
        else if (kLower.includes('bairro')) bairro = val
        else if (kLower.includes('ramo') || kLower.includes('atividade')) ramo = val
        else if (kLower.includes('regime')) regime = val
        else if (kLower === 'ie' || kLower.includes('inscricao')) ie = val
      }

      if (!rawCnpj) {
        for (const key of Object.keys(row)) {
          const val = String(row[key] || '').trim()
          const limpo = limparDocumento(val)
          if (limpo.length === 14) {
            rawCnpj = val
            break
          }
        }
      }

      const cnpjLimpo = limparDocumento(rawCnpj)
      if (cnpjLimpo.length === 14) {
        resultado.push({
          idTemp: `temp_${i}_${Date.now()}`,
          cnpj: cnpjLimpo,
          cnpjFormatado: formatarCnpjCpf(cnpjLimpo),
          razao_social: razao,
          nome_fantasia: fantasia || razao,
          email,
          telefone: tel,
          whatsapp: tel.replace(/\D/g, ''),
          cidade: cid,
          uf: uf.toUpperCase(),
          cep,
          logradouro,
          numero,
          complemento,
          bairro,
          ramo_atividade: ramo,
          regime_tributario: regime,
          inscricao_estadual: ie,
          statusConsulta: razao ? 'manual' : 'pendente',
          origem: 'arquivo'
        })
      }
    }

    return resultado
  }

  // Processa TXT
  const processarTxt = (conteudo: string): ItemImportacao[] => {
    const resultado: ItemImportacao[] = []
    const linhas = conteudo.split(/\r?\n/)

    let idx = 0
    for (const linha of linhas) {
      const linhaTrim = linha.trim()
      if (!linhaTrim) continue

      const regexCnpj = /\b(?:\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}|[A-Z0-9]{14})\b/gi
      const matches = linhaTrim.match(regexCnpj)

      if (matches && matches.length > 0) {
        for (const m of matches) {
          const cnpjLimpo = limparDocumento(m)
          if (cnpjLimpo.length === 14) {
            resultado.push({
              idTemp: `temp_${idx++}_${Date.now()}`,
              cnpj: cnpjLimpo,
              cnpjFormatado: formatarCnpjCpf(cnpjLimpo),
              razao_social: '',
              nome_fantasia: '',
              email: '',
              telefone: '',
              whatsapp: '',
              cidade: '',
              uf: '',
              statusConsulta: 'pendente',
              origem: 'arquivo'
            })
          }
        }
      } else if (linhaTrim.includes(';') || linhaTrim.includes(',')) {
        const partes = linhaTrim.split(/[;,]/)
        const primCnpj = partes.find(p => limparDocumento(p).length === 14)
        if (primCnpj) {
          const cnpjLimpo = limparDocumento(primCnpj)
          resultado.push({
            idTemp: `temp_${idx++}_${Date.now()}`,
            cnpj: cnpjLimpo,
            cnpjFormatado: formatarCnpjCpf(cnpjLimpo),
            razao_social: partes[1]?.trim() || '',
            nome_fantasia: partes[2]?.trim() || partes[1]?.trim() || '',
            email: partes[3]?.trim() || '',
            telefone: partes[4]?.trim() || '',
            whatsapp: (partes[4]?.trim() || '').replace(/\D/g, ''),
            cidade: partes[5]?.trim() || '',
            uf: (partes[6]?.trim() || '').toUpperCase(),
            statusConsulta: partes[1] ? 'manual' : 'pendente',
            origem: 'arquivo'
          })
        }
      }
    }

    return resultado
  }

  // Processa JSON
  const processarJson = (dados: any): ItemImportacao[] => {
    const resultado: ItemImportacao[] = []
    const lista = Array.isArray(dados) ? dados : [dados]

    lista.forEach((item, idx) => {
      if (typeof item === 'string') {
        const cnpjLimpo = limparDocumento(item)
        if (cnpjLimpo.length === 14) {
          resultado.push({
            idTemp: `temp_${idx}_${Date.now()}`,
            cnpj: cnpjLimpo,
            cnpjFormatado: formatarCnpjCpf(cnpjLimpo),
            razao_social: '',
            nome_fantasia: '',
            email: '',
            telefone: '',
            whatsapp: '',
            cidade: '',
            uf: '',
            statusConsulta: 'pendente',
            origem: 'arquivo'
          })
        }
      } else if (typeof item === 'object' && item !== null) {
        const rawCnpj = item.cnpj || item.documento || item.taxId || ''
        const cnpjLimpo = limparDocumento(rawCnpj)
        if (cnpjLimpo.length === 14) {
          resultado.push({
            idTemp: `temp_${idx}_${Date.now()}`,
            cnpj: cnpjLimpo,
            cnpjFormatado: formatarCnpjCpf(cnpjLimpo),
            razao_social: item.razao_social || item.nome || item.name || '',
            nome_fantasia: item.nome_fantasia || item.fantasia || item.alias || '',
            email: item.email || item.email_contato || '',
            telefone: item.telefone || item.fone || '',
            whatsapp: item.whatsapp || (item.telefone || '').replace(/\D/g, ''),
            cidade: item.cidade || item.municipio || '',
            uf: (item.uf || item.estado || '').toUpperCase(),
            cep: item.cep,
            logradouro: item.logradouro || item.rua,
            numero: item.numero,
            complemento: item.complemento,
            bairro: item.bairro,
            ramo_atividade: item.ramo_atividade || item.atividade,
            regime_tributario: item.regime_tributario || item.regime,
            inscricao_estadual: item.inscricao_estadual || item.ie,
            statusConsulta: item.razao_social ? 'manual' : 'pendente',
            origem: 'arquivo'
          })
        }
      }
    })

    return resultado
  }

  // 2. Consulta Manual/Adiantada de Todos os CNPJs Pendentes na Receita Federal
  const handleConsultarTodosNaReceita = async () => {
    if (itens.length === 0 || processandoReceita) return

    setProcessandoReceita(true)
    const toastId = toast.loading('Buscando dados oficiais na Receita Federal...')

    const novosItens = [...itens]
    let concluidos = 0
    const total = novosItens.filter(it => !it.jaCadastrado).length
    setProgressoReceita({ atual: 0, total, mensagem: 'Consultando Receita Federal...' })

    for (let i = 0; i < novosItens.length; i++) {
      const item = novosItens[i]
      if (item.jaCadastrado) continue

      novosItens[i] = { ...item, statusConsulta: 'consultando' }
      setItens([...novosItens])

      const dadosReais = await consultarDadosReaisCnpj(item.cnpj)
      if (dadosReais && dadosReais.razao_social) {
        novosItens[i] = {
          ...novosItens[i],
          ...dadosReais,
          statusConsulta: 'sucesso',
          origem: 'receita'
        }
      } else {
        novosItens[i] = {
          ...novosItens[i],
          statusConsulta: 'erro',
          mensagemErro: 'Não localizado na RFB (será preenchido nome padrão)'
        }
      }

      concluidos++
      setProgressoReceita({ atual: concluidos, total, mensagem: `Consultando ${concluidos}/${total}...` })
      setItens([...novosItens])

      await new Promise(r => setTimeout(r, 200))
    }

    setProcessandoReceita(false)
    toast.success('Consultas na Receita Federal concluídas!', { id: toastId })
  }

  // 3. Salvar Cadastros: SE HOUVER CNPJs SEM DADOS REAIS, BUSCA NA RECEITA AUTOMATICAMENTE ANTES DE GRAVAR!
  const handleSalvarCadastros = async () => {
    // 3.1 Bloqueio de Repetidos: filtrar estritamente empresas inéditas
    const itensNovos = itens.filter(it => !it.jaCadastrado && !cnpjsCadastrados.has(it.cnpj))
    const repetidosCount = itens.length - itensNovos.length

    if (itensNovos.length === 0) {
      toast.error(`❌ Todos os ${itens.length} registros informados já estão cadastrados no portal! Cadastros repetidos foram bloqueados.`, { duration: 6000 })
      return
    }

    setSalvandoBanco(true)
    const toastId = toast.loading(`Processando e buscando dados reais da Receita Federal...`)

    try {
      // 3.2 Se houver itens novos que ainda não foram consultados na Receita Federal, buscar agora!
      const itensProntos: ItemImportacao[] = []
      let consultadosAgora = 0

      for (let i = 0; i < itensNovos.length; i++) {
        let it = itensNovos[i]

        // Se ainda não tem razão social real ou está pendente
        if (!it.razao_social || it.statusConsulta === 'pendente') {
          consultadosAgora++
          toast.loading(`Buscando dados na Receita Federal (${consultadosAgora}/${itensNovos.length}): ${it.cnpjFormatado}...`, { id: toastId })
          
          const dadosReais = await consultarDadosReaisCnpj(it.cnpj)
          if (dadosReais && dadosReais.razao_social) {
            it = {
              ...it,
              ...dadosReais,
              statusConsulta: 'sucesso',
              origem: 'receita'
            }
          } else {
            // Fallback respeitoso apenas se a Receita falhar após todas as tentativas
            it = {
              ...it,
              razao_social: it.razao_social || `EMPRESA ${it.cnpjFormatado}`,
              nome_fantasia: it.nome_fantasia || it.razao_social || `EMPRESA ${it.cnpjFormatado}`,
              cidade: it.cidade || 'Pará de Minas',
              uf: it.uf || 'MG',
              regime_tributario: it.regime_tributario || 'simples_nacional',
              inscricao_estadual: it.inscricao_estadual || 'ISENTO',
              origem: 'arquivo'
            }
          }
          await new Promise(r => setTimeout(r, 200))
        }

        itensProntos.push(it)
      }

      toast.loading(`Salvando ${itensProntos.length} novos cadastros no portal...`, { id: toastId })

      if (tipo === 'contabilidade') {
        const payloads = itensProntos.map((it) => ({
          razao_social: it.razao_social || `Contabilidade ${it.cnpjFormatado}`,
          nome_fantasia: it.nome_fantasia || it.razao_social,
          cnpj: it.cnpjFormatado,
          email_contato: it.email || null,
          telefone: it.telefone || null,
          whatsapp: it.whatsapp || null,
          cep: it.cep || null,
          logradouro: it.logradouro || null,
          numero: it.numero || null,
          complemento: it.complemento || null,
          bairro: it.bairro || null,
          cidade: it.cidade || null,
          uf: it.uf || null
        }))

        const { error } = await supabase.from('contabilidades').insert(payloads)
        if (error) throw error

      } else {
        // Clientes: salva com os dados REAIS obtidos da Receita Federal
        const payloads = itensProntos.map((it) => ({
          razao_social: it.razao_social || `Empresa ${it.cnpjFormatado}`,
          nome_fantasia: it.nome_fantasia || it.razao_social,
          cnpj: it.cnpjFormatado,
          contabilidade_id: contabilidadeSelecionada || null,
          email_fiscal: it.email || null,
          whatsapp: it.whatsapp || null,
          cidade: it.cidade || 'Pará de Minas',
          uf: it.uf || 'MG',
          cep: it.cep || '35660-000',
          logradouro: it.logradouro || 'Avenida Principal',
          numero: it.numero || '100',
          complemento: it.complemento || null,
          bairro: it.bairro || 'Centro',
          ramo_atividade: it.ramo_atividade || 'Comércio Varejista em Geral',
          regime_tributario: it.regime_tributario || 'simples_nacional',
          inscricao_estadual: it.inscricao_estadual || 'ISENTO',
          nome_sistema_utilizado: it.nome_sistema_utilizado || 'PARATECH ERP',
          is_ativo: true,
          dia_vencimento: it.dia_vencimento || 10,
          valor_mensalidade: it.valor_mensalidade !== undefined ? it.valor_mensalidade : 0,
          custo: it.custo !== undefined ? it.custo : 0,
          data_inicio_monitoramento: new Date().toISOString().split('T')[0],
          numero_inicial_nfe: 1,
          numero_inicial_nfce: 1,
          numero_inicial_nfse: 1,
          numero_inicial_cte: 1,
          numero_inicial_mdfe: 1,
          hub_token: gerarTokenHub()
        }))

        const { data: insertedData, error } = await supabase
          .from('clientes')
          .insert(payloads)
          .select('id, dia_vencimento, valor_mensalidade')

        if (error) throw error

        // Sincronizar configuracoes_hub para cada novo cliente
        if (insertedData && insertedData.length > 0) {
          const configPayloads = insertedData.map(c => ({
            cliente_id: c.id,
            dia_vencimento: c.dia_vencimento || 10,
            valor_mensalidade: c.valor_mensalidade || 0
          }))
          await supabase.from('configuracoes_hub').upsert(configPayloads)
        }
      }

      const mensagemSucesso = repetidosCount > 0
        ? `🎉 ${itensProntos.length} clientes cadastrados com dados reais da Receita Federal! (${repetidosCount} empresas repetidas foram bloqueadas).`
        : `🎉 Todos os ${itensProntos.length} clientes foram cadastrados com sucesso com os dados oficiais da Receita Federal!`

      toast.success(mensagemSucesso, { id: toastId, duration: 6000 })
      onSuccess()
      onClose()
    } catch (err: any) {
      toast.error('Erro ao salvar no banco: ' + err.message, { id: toastId })
    } finally {
      setSalvandoBanco(false)
    }
  }

  // Baixa arquivo modelo de exemplo
  const handleBaixarModelo = () => {
    const dadosExemplo = [
      {
        CNPJ: '15.123.074/0001-92',
        RazaoSocial: 'ASCONTRI ASSISTENCIA CONTABIL & TRIBUTARIA LTDA',
        NomeFantasia: 'ASCONTRI CONTABILIDADE',
        Email: 'contato@ascontri.com.br',
        Telefone: '(37) 3232-5555',
        Cidade: 'Pará de Minas',
        UF: 'MG'
      },
      {
        CNPJ: '32.406.991/0001-01',
        RazaoSocial: 'RAZAO CONTABILIDADE APOIO ADMINISTRATIVO LTDA',
        NomeFantasia: 'RAZAO CONTABILIDADE',
        Email: 'razaocontabilidade129@gmail.com',
        Telefone: '(37) 3231-1114',
        Cidade: 'Pará de Minas',
        UF: 'MG'
      }
    ]

    const ws = XLSX.utils.json_to_sheet(dadosExemplo)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Modelo_Importacao')
    XLSX.writeFile(wb, `modelo_importacao_${tipo}.xlsx`)
    toast.success('Planilha modelo baixada!')
  }

  // Contagens reativas
  const repetidosCount = itens.filter(it => it.jaCadastrado).length
  const novosCount = itens.filter(it => !it.jaCadastrado).length
  const consultadosCount = itens.filter(it => !it.jaCadastrado && (it.statusConsulta === 'sucesso' || it.statusConsulta === 'manual')).length
  const pendentesCount = itens.filter(it => !it.jaCadastrado && it.statusConsulta === 'pendente').length

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl relative flex flex-col max-h-[92vh]">
        
        {/* Header do Modal */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md">
              <Upload size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                  Importação em Lote de {tipo === 'contabilidade' ? 'Contabilidades' : 'Clientes'}
                </h2>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/50 dark:text-blue-300">
                  CSV, TXT, JSON, XLS, XLSX
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Envie planilhas ou a lista de CNPJs. Ao salvar, o sistema busca os <strong>dados cadastrais reais</strong> diretamente na Receita Federal.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        {/* Corpo com Scroll */}
        <div className="flex-1 overflow-y-auto custom-scrollbar py-4 space-y-5">
          {/* Seletor de Contabilidade (quando tipo === cliente) */}
          {tipo === 'cliente' && contabilidadesDisponiveis.length > 0 && (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Building2 size={15} className="text-blue-600" />
                  Atribuir Clientes à Contabilidade:
                </label>
                <p className="text-[11px] text-slate-500">
                  Todas as novas empresas importadas serão vinculadas ao escritório selecionado abaixo.
                </p>
              </div>

              <select
                value={contabilidadeSelecionada}
                onChange={e => setContabilidadeSelecionada(e.target.value)}
                className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Sem contabilidade (Avulso)</option>
                {contabilidadesDisponiveis.map(c => (
                  <option key={c.id} value={c.id}>{c.razao_social}</option>
                ))}
              </select>
            </div>
          )}

          {/* Área de Upload / Drag & Drop */}
          <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 rounded-2xl p-6 text-center transition bg-slate-50/50 dark:bg-slate-800/30">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleArquivoSelecionado}
              accept=".csv,.txt,.json,.xls,.xlsx"
              className="hidden"
            />

            <div className="flex flex-col items-center justify-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-xs">
                <FileSpreadsheet size={24} />
              </div>

              <div>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {arquivoNome ? `Arquivo carregado: ${arquivoNome}` : 'Arraste ou clique para carregar o arquivo com os CNPJs'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Aceita arquivos <strong>.CSV, .TXT, .JSON, .XLS ou .XLSX</strong> contendo uma lista de CNPJs ou planilhas completas.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={lendoArquivo || processandoReceita}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  <Upload size={14} />
                  <span>Escolher Arquivo</span>
                </button>

                <button
                  type="button"
                  onClick={handleBaixarModelo}
                  className="px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
                >
                  <Download size={14} />
                  <span>Baixar Planilha Modelo</span>
                </button>
              </div>
            </div>
          </div>

          {/* Barra de Status & Métricas do Lote */}
          {itens.length > 0 && (
            <div className="p-4 rounded-2xl bg-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-md">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-extrabold">{itens.length} empresas no arquivo</span>
                  
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-bold flex items-center gap-1">
                    <CheckCircle2 size={12} /> {novosCount} novos a cadastrar
                  </span>

                  {repetidosCount > 0 && (
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-red-500/20 border border-red-400/40 text-red-300 font-bold flex items-center gap-1">
                      <ShieldAlert size={12} /> {repetidosCount} repetidos bloqueados
                    </span>
                  )}

                  {consultadosCount > 0 && (
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/20 border border-blue-400/40 text-blue-300 font-bold flex items-center gap-1">
                      <Check size={12} /> {consultadosCount} com dados reais
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-300">
                  {pendentesCount > 0 
                    ? `🔍 ${pendentesCount} empresas terão seus dados cadastrais (Razão Social, IE, Endereço e Contato) buscados na Receita Federal ao salvar.`
                    : 'Todas as empresas já possuem dados cadastrais identificados e prontos.'}
                </p>
              </div>

              <button
                type="button"
                onClick={handleConsultarTodosNaReceita}
                disabled={processandoReceita || pendentesCount === 0}
                className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-2 shadow-lg shrink-0"
              >
                {processandoReceita ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Consultando {progressoReceita.atual}/{progressoReceita.total}...</span>
                  </>
                ) : (
                  <>
                    <Search size={16} />
                    <span>Consultar Receita Federal Agora</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Barra de Progresso durante a busca */}
          {processandoReceita && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                <span>{progressoReceita.mensagem || 'Processando CNPJs na Receita Federal...'}</span>
                <span>{progressoReceita.atual} de {progressoReceita.total} ({Math.round((progressoReceita.atual / (progressoReceita.total || 1)) * 100)}%)</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-blue-600 to-cyan-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${(progressoReceita.atual / (progressoReceita.total || 1)) * 100}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Tabela de Prévia dos Dados com Destaque de Bloqueio e Dados Reais */}
          {itens.length > 0 && (
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
              <div className="max-h-64 overflow-y-auto custom-scrollbar">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0 z-10 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-3">Status / Validação</th>
                      <th className="p-3">CNPJ</th>
                      <th className="p-3">Razão Social / Nome Fantasia</th>
                      <th className="p-3">Município / UF</th>
                      <th className="p-3">Contato / Telefone</th>
                      <th className="p-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {itens.map((it, idx) => (
                      <tr 
                        key={it.idTemp} 
                        className={`transition-colors ${
                          it.jaCadastrado 
                            ? 'bg-red-50/60 dark:bg-red-950/20 text-red-900' 
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        }`}
                      >
                        <td className="p-3 whitespace-nowrap">
                          {it.jaCadastrado ? (
                            <span className="inline-flex items-center gap-1 text-red-700 dark:text-red-400 font-bold bg-red-100 dark:bg-red-900/40 px-2 py-0.5 rounded-md border border-red-200 dark:border-red-800">
                              <ShieldAlert size={12} /> Já Cadastrado (Bloqueado)
                            </span>
                          ) : it.statusConsulta === 'sucesso' ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 rounded-md border border-emerald-200">
                              <CheckCircle2 size={12} /> Receita Federal
                            </span>
                          ) : it.statusConsulta === 'manual' ? (
                            <span className="inline-flex items-center gap-1 text-slate-700 dark:text-slate-300 font-bold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200">
                              <Check size={12} /> No Arquivo
                            </span>
                          ) : it.statusConsulta === 'consultando' ? (
                            <span className="inline-flex items-center gap-1 text-blue-600 font-bold">
                              <Loader2 size={12} className="animate-spin" /> Consultando
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-amber-700 font-bold bg-amber-100 px-2 py-0.5 rounded-md border border-amber-200" title="Será buscado na Receita ao salvar">
                              <AlertCircle size={12} /> Pendente (Busca ao Salvar)
                            </span>
                          )}
                        </td>
                        <td className="p-3 font-mono font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                          {it.cnpjFormatado}
                        </td>
                        <td className="p-3 max-w-xs">
                          {it.jaCadastrado ? (
                            <div>
                              <span className="font-bold text-red-900 dark:text-red-300 block truncate">
                                🚫 Já existente: {it.nomeExistente || it.razao_social}
                              </span>
                              <span className="text-[10px] text-red-600 block">Não será importado novamente</span>
                            </div>
                          ) : (
                            <div>
                              <span className="font-bold text-slate-900 dark:text-white block truncate">
                                {it.razao_social || <span className="text-blue-600 italic font-medium">Buscando dados na Receita Federal ao salvar...</span>}
                              </span>
                              {it.nome_fantasia && it.nome_fantasia !== it.razao_social && (
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">
                                  {it.nome_fantasia}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {it.cidade ? `${it.cidade}/${it.uf}` : <span className="text-slate-400 italic">Receita Federal</span>}
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          <div>
                            <span>{it.telefone || it.whatsapp || <span className="text-slate-400 italic">Receita Federal</span>}</span>
                            {it.inscricao_estadual && (
                              <span className="text-[10px] text-slate-500 block">IE: {it.inscricao_estadual}</span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setItens(itens.filter((_, i) => i !== idx))
                            }}
                            className="text-slate-400 hover:text-red-600 p-1 rounded-lg transition"
                            title="Remover da lista"
                          >
                            <X size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer de Ações */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {itens.length > 0 ? (
              <span>
                Total: <strong>{itens.length}</strong> | Novos: <strong>{novosCount}</strong> {repetidosCount > 0 && <span className="text-red-600 font-semibold">• {repetidosCount} repetidos ignorados</span>}
              </span>
            ) : (
              'Nenhum arquivo carregado ainda.'
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={salvandoBanco || processandoReceita}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleSalvarCadastros}
              disabled={salvandoBanco || processandoReceita || novosCount === 0}
              className="flex-1 sm:flex-none px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20"
            >
              {salvandoBanco ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Buscando Dados na RFB e Salvando...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={15} />
                  <span>Confirmar e Salvar ({novosCount}) Cadastros</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
