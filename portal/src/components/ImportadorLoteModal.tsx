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
  jaCadastrado?: boolean
  nomeExistente?: string
  dadosFicticiosAplicados?: boolean
  statusConsulta: 'pendente' | 'consultando' | 'sucesso' | 'erro' | 'manual' | 'duplicado' | 'ficticio'
  mensagemErro?: string
  origem: 'arquivo' | 'receita' | 'ficticio'
}

interface ImportadorLoteModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  tipo: 'contabilidade' | 'cliente'
  contabilidadesDisponiveis?: Array<{ id: string; razao_social: string }>
}

// Conjunto de dados fictícios realistas e profissionais para auto-completar campos obrigatórios
const NOMES_FANTASIA_FICTICIOS = [
  'SUPERMERCADO & CONVENIENCIA',
  'RESTAURANTE & CHURRASCARIA',
  'PADARIA & CONFEITARIA CENTRAL',
  'AUTO POSTO & CONVENIENCIA',
  'DISTRIBUIDORA DE BEBIDAS',
  'DROGARIA & FARMACIA POPULAR',
  'LOJA DE MATERIAIS DE CONSTRUCAO',
  'BOUTIQUE & MODAS BRASIL',
  'HAMBURGUERIA & BEER ARTESANAL',
  'MERCADO & ACOUGUE MINAS',
  'LANCHONETE & CAFE EXPRESSO',
  'COMERCIAL & ATACADO REGIONAL'
]

const RAMOS_ATIVIDADE_FICTICIOS = [
  'Comércio Varejista de Mercadorias em Geral',
  'Restaurantes e Similares',
  'Comércio Varejista de Bebidas',
  'Comércio Varejista de Produtos Farmacêuticos',
  'Comércio Varejista de Materiais de Construção',
  'Lanchonetes, Casas de Chá e Sucos',
  'Comércio Varejista de Carnes - Açougues',
  'Comércio Varejista de Artigos do Vestuário e Acessórios'
]

export const gerarDadosFicticiosItem = (cnpjLimpo: string, index: number, cidadePadrao = 'Pará de Minas', ufPadrao = 'MG'): Partial<ItemImportacao> => {
  const sufixo = cnpjLimpo.slice(-4) || String(1000 + index).slice(-4)
  const idx = Math.abs(index) % NOMES_FANTASIA_FICTICIOS.length
  const fantasia = `${NOMES_FANTASIA_FICTICIOS[idx]} ${sufixo}`
  const razao = `${fantasia} LTDA`
  const ramo = RAMOS_ATIVIDADE_FICTICIOS[idx % RAMOS_ATIVIDADE_FICTICIOS.length]
  const telefone = `(37) 3232-${String(1000 + (index % 8999)).padStart(4, '0')}`
  const whatsapp = `(37) 99876-${String(1000 + (index % 8999)).padStart(4, '0')}`
  const email = `fiscal.${cnpjLimpo.slice(0, 8)}@hubparatech.com.br`

  return {
    razao_social: razao,
    nome_fantasia: fantasia,
    inscricao_estadual: 'ISENTO',
    nome_sistema_utilizado: 'PARATECH ERP',
    ramo_atividade: ramo,
    regime_tributario: 'simples_nacional',
    email,
    telefone,
    whatsapp,
    cidade: cidadePadrao,
    uf: ufPadrao,
    cep: '35660-000',
    logradouro: 'Avenida Principal do Comércio',
    numero: String(100 + (index * 12)),
    complemento: `Sala ${((index % 8) + 1)}`,
    bairro: 'Centro',
    dia_vencimento: 10,
    valor_mensalidade: 0,
    dadosFicticiosAplicados: true,
    origem: 'ficticio'
  }
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
  const [progressoReceita, setProgressoReceita] = useState<{ atual: number; total: number }>({ atual: 0, total: 0 })
  const [salvandoBanco, setSalvandoBanco] = useState(false)
  const [contabilidadeSelecionada, setContabilidadeSelecionada] = useState<string>('')
  
  // Preferência para preenchimento de dados fictícios nos campos obrigatórios
  const [preencherFicticios, setPreencherFicticios] = useState<boolean>(true)
  
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

  // Gera token único para clientes
  const gerarTokenHub = () => {
    return 'hub_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36)
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

      // 1.2 Cruzar com a base do Supabase para BLOQUEAR REPETIDOS e aplicar dados fictícios se solicitado
      let totalRepetidos = 0
      const itensTratados = itensUnicos.map((it, idx) => {
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

        // Se for novo e a opção de preencher dados fictícios estiver ativa
        if (preencherFicticios && !it.razao_social) {
          const ficticio = gerarDadosFicticiosItem(it.cnpj, idx)
          return {
            ...it,
            ...ficticio,
            statusConsulta: 'ficticio' as const,
            origem: 'ficticio' as const
          }
        }

        return it
      })

      setItens(itensTratados)

      if (totalRepetidos > 0) {
        toast.success(
          `${itensTratados.length} registros extraídos! (${totalRepetidos} repetidos identificados e bloqueados automaticamente)`, 
          { id: toastId, duration: 6000 }
        )
      } else {
        toast.success(`${itensTratados.length} registros novos extraídos com sucesso!`, { id: toastId })
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

  // 2. Ação Rápida: Aplicar Dados Fictícios a Todos os Itens Vazios
  const handleAplicarDadosFicticiosEmTodos = () => {
    if (itens.length === 0) return

    let alterados = 0
    const atualizados = itens.map((it, idx) => {
      // Ignora os que já existem no banco
      if (it.jaCadastrado) return it

      // Se não tem razão social ou está pendente, preenche
      if (!it.razao_social || it.statusConsulta === 'pendente' || it.statusConsulta === 'erro') {
        alterados++
        const ficticio = gerarDadosFicticiosItem(it.cnpj, idx)
        return {
          ...it,
          ...ficticio,
          statusConsulta: 'ficticio' as const,
          origem: 'ficticio' as const
        }
      }
      return it
    })

    setItens(atualizados)
    toast.success(`✨ Dados fictícios preenchidos em ${alterados} empresas! Todas estão prontas para cadastro imediato.`)
  }

  // 3. Consulta Automática na Receita Federal para todos os CNPJs pendentes
  const handleConsultarTodosNaReceita = async () => {
    if (itens.length === 0 || processandoReceita) return

    setProcessandoReceita(true)
    const toastId = toast.loading('Iniciando busca em lote na Receita Federal...')

    const novosItens = [...itens]
    let concluidos = 0
    const total = novosItens.filter(it => !it.jaCadastrado).length
    setProgressoReceita({ atual: 0, total })

    for (let i = 0; i < novosItens.length; i++) {
      const item = novosItens[i]
      
      // Pula repetidos já existentes
      if (item.jaCadastrado) continue

      novosItens[i] = { ...item, statusConsulta: 'consultando' }
      setItens([...novosItens])

      try {
        const res = await fetch(`/api/consulta-cnpj?cnpj=${encodeURIComponent(item.cnpj)}`)
        const data = await res.json()

        if (res.ok && data.sucesso) {
          novosItens[i] = {
            ...novosItens[i],
            razao_social: data.razao_social || item.razao_social || 'EMPRESA SEM NOME',
            nome_fantasia: data.nome_fantasia || data.razao_social || item.nome_fantasia,
            email: data.email || item.email,
            telefone: data.telefone || item.telefone,
            whatsapp: data.whatsapp || item.whatsapp,
            cidade: data.cidade || item.cidade,
            uf: data.uf || item.uf,
            cep: data.cep || item.cep,
            logradouro: data.logradouro || item.logradouro,
            numero: data.numero || item.numero,
            complemento: data.complemento || item.complemento,
            bairro: data.bairro || item.bairro,
            ramo_atividade: data.ramo_atividade || item.ramo_atividade,
            regime_tributario: data.regime_tributario || item.regime_tributario || 'simples_nacional',
            inscricao_estadual: data.inscricao_estadual || item.inscricao_estadual,
            statusConsulta: 'sucesso',
            origem: 'receita'
          }
        } else {
          // Se falhou na Receita e a opção de dados fictícios está ativa, preenche dados fictícios!
          if (preencherFicticios) {
            const ficticio = gerarDadosFicticiosItem(item.cnpj, i)
            novosItens[i] = {
              ...novosItens[i],
              ...ficticio,
              statusConsulta: 'ficticio',
              mensagemErro: `${data.error || 'RFB indisponível'} — Dados fictícios aplicados`
            }
          } else {
            novosItens[i] = {
              ...novosItens[i],
              statusConsulta: 'erro',
              mensagemErro: data.error || 'Não localizado na RFB'
            }
          }
        }
      } catch (err: any) {
        if (preencherFicticios) {
          const ficticio = gerarDadosFicticiosItem(item.cnpj, i)
          novosItens[i] = {
            ...novosItens[i],
            ...ficticio,
            statusConsulta: 'ficticio',
            mensagemErro: 'Falha na rede — Dados fictícios aplicados'
          }
        } else {
          novosItens[i] = {
            ...novosItens[i],
            statusConsulta: 'erro',
            mensagemErro: err.message || 'Falha na requisição'
          }
        }
      }

      concluidos++
      setProgressoReceita({ atual: concluidos, total })
      setItens([...novosItens])

      await new Promise(r => setTimeout(r, 200))
    }

    setProcessandoReceita(false)
    toast.success('Consultas concluídas!', { id: toastId })
  }

  // 4. Salvar Cadastros em Lote com Bloqueio de Repetidos e Dados Fictícios
  const handleSalvarCadastros = async () => {
    // 4.1 Bloqueio de Repetidos: filtrar apenas empresas que NÃO estão cadastradas
    const itensNovos = itens.filter(it => !it.jaCadastrado && !cnpjsCadastrados.has(it.cnpj))
    const repetidosCount = itens.length - itensNovos.length

    if (itensNovos.length === 0) {
      toast.error(`❌ Todos os ${itens.length} registros informados já estão cadastrados no portal! Cadastros repetidos foram bloqueados.`, { duration: 6000 })
      return
    }

    setSalvandoBanco(true)
    const toastId = toast.loading(`Cadastrando ${itensNovos.length} ${tipo === 'contabilidade' ? 'escritórios' : 'clientes'} no portal...`)

    try {
      if (tipo === 'contabilidade') {
        const payloads = itensNovos.map((it, idx) => {
          const ficticio = gerarDadosFicticiosItem(it.cnpj, idx)
          return {
            razao_social: it.razao_social || ficticio.razao_social || `Contabilidade ${it.cnpjFormatado}`,
            nome_fantasia: it.nome_fantasia || it.razao_social || ficticio.nome_fantasia,
            cnpj: it.cnpjFormatado,
            email_contato: it.email || ficticio.email || null,
            telefone: it.telefone || ficticio.telefone || null,
            whatsapp: it.whatsapp || ficticio.whatsapp || null,
            cep: it.cep || ficticio.cep || null,
            logradouro: it.logradouro || ficticio.logradouro || null,
            numero: it.numero || ficticio.numero || null,
            complemento: it.complemento || ficticio.complemento || null,
            bairro: it.bairro || ficticio.bairro || null,
            cidade: it.cidade || ficticio.cidade || null,
            uf: it.uf || ficticio.uf || null
          }
        })

        const { error } = await supabase.from('contabilidades').insert(payloads)
        if (error) throw error

      } else {
        // Clientes: aplicar dados fictícios completos em todos os campos obrigatórios vazios
        const payloads = itensNovos.map((it, idx) => {
          const ficticio = gerarDadosFicticiosItem(it.cnpj, idx)
          return {
            razao_social: it.razao_social || ficticio.razao_social || `Empresa ${it.cnpjFormatado}`,
            nome_fantasia: it.nome_fantasia || it.razao_social || ficticio.nome_fantasia,
            cnpj: it.cnpjFormatado,
            contabilidade_id: contabilidadeSelecionada || null,
            email_fiscal: it.email || ficticio.email || null,
            whatsapp: it.whatsapp || ficticio.whatsapp || null,
            cidade: it.cidade || ficticio.cidade || 'Pará de Minas',
            uf: it.uf || ficticio.uf || 'MG',
            cep: it.cep || ficticio.cep || '35660-000',
            logradouro: it.logradouro || ficticio.logradouro || 'Avenida Principal',
            numero: it.numero || ficticio.numero || '100',
            complemento: it.complemento || ficticio.complemento || null,
            bairro: it.bairro || ficticio.bairro || 'Centro',
            ramo_atividade: it.ramo_atividade || ficticio.ramo_atividade || 'Comércio Varejista em Geral',
            regime_tributario: it.regime_tributario || ficticio.regime_tributario || 'simples_nacional',
            inscricao_estadual: it.inscricao_estadual || ficticio.inscricao_estadual || 'ISENTO',
            nome_sistema_utilizado: it.nome_sistema_utilizado || ficticio.nome_sistema_utilizado || 'PARATECH ERP',
            is_ativo: true,
            dia_vencimento: it.dia_vencimento || 10,
            valor_mensalidade: it.valor_mensalidade !== undefined ? it.valor_mensalidade : 0,
            data_inicio_monitoramento: new Date().toISOString().split('T')[0],
            numero_inicial_nfe: 1,
            numero_inicial_nfce: 1,
            numero_inicial_nfse: 1,
            numero_inicial_cte: 1,
            numero_inicial_mdfe: 1,
            hub_token: gerarTokenHub()
          }
        })

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
        ? `🎉 ${itensNovos.length} novos clientes cadastrados com sucesso! (${repetidosCount} empresas repetidas foram bloqueadas e ignoradas).`
        : `🎉 Todos os ${itensNovos.length} clientes foram cadastrados com sucesso!`

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
  const ficticiosCount = itens.filter(it => it.statusConsulta === 'ficticio').length
  const prontasParaSalvar = itens.filter(it => !it.jaCadastrado && (it.razao_social || preencherFicticios)).length

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
                Bloqueia automaticamente cadastros repetidos e preenche dados fictícios nos campos obrigatórios para importação instantânea.
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
                  Aceita arquivos <strong>.CSV, .TXT, .JSON, .XLS ou .XLSX</strong> contendo uma lista simples de CNPJs ou planilhas completas.
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

          {/* Configuração de Dados Fictícios & Bloqueio */}
          {itens.length > 0 && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 dark:from-slate-800 dark:to-slate-800 border border-emerald-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-xs shrink-0 mt-0.5">
                  <Sparkles size={18} />
                </div>
                <div>
                  <label htmlFor="toggle_ficticios" className="text-xs font-bold text-slate-900 dark:text-white block cursor-pointer select-none">
                    Completar Campos Obrigatórios com Dados Fictícios
                  </label>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                    Gera automaticamente Razão Social, Fantasia, Inscrição Estadual (ISENTO), ERP padrão, telefone e endereço para qualquer CNPJ sem consulta à Receita Federal.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                <button
                  type="button"
                  onClick={handleAplicarDadosFicticiosEmTodos}
                  className="px-3 py-1.5 bg-white dark:bg-slate-700 border border-emerald-300 dark:border-slate-600 hover:bg-emerald-50 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
                  title="Aplica dados fictícios em todas as empresas sem cadastro completo"
                >
                  <Sparkles size={13} />
                  <span>Preencher Fictícios Agora</span>
                </button>

                <input
                  type="checkbox"
                  id="toggle_ficticios"
                  checked={preencherFicticios}
                  onChange={e => setPreencherFicticios(e.target.checked)}
                  className="h-5 w-5 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
              </div>
            </div>
          )}

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

                  {ficticiosCount > 0 && (
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-400/40 text-indigo-300 font-bold flex items-center gap-1">
                      <Sparkles size={12} /> {ficticiosCount} com dados fictícios
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-300">
                  {repetidosCount > 0
                    ? `⚠️ ${repetidosCount} empresas já existem no portal e serão bloqueadas automaticamente para evitar duplicidade.`
                    : 'Todos os CNPJs do arquivo são novos e válidos para inclusão no sistema.'}
                </p>
              </div>

              <button
                type="button"
                onClick={handleConsultarTodosNaReceita}
                disabled={processandoReceita || novosCount === 0}
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
                    <span>Consultar na Receita Federal (Opcional)</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Barra de Progresso durante a busca */}
          {processandoReceita && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                <span>Processando CNPJs na Receita Federal...</span>
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

          {/* Tabela de Prévia dos Dados com Destaque de Bloqueio e Fictícios */}
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
                      <th className="p-3">Contato / ERP</th>
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
                          ) : it.statusConsulta === 'ficticio' ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 rounded-md border border-emerald-200">
                              <Sparkles size={12} /> Dados Fictícios
                            </span>
                          ) : it.statusConsulta === 'sucesso' ? (
                            <span className="inline-flex items-center gap-1 text-blue-700 dark:text-blue-400 font-bold bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 rounded-md border border-blue-200">
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
                            <span className="inline-flex items-center gap-1 text-amber-700 font-bold bg-amber-100 px-2 py-0.5 rounded-md border border-amber-200">
                              <AlertCircle size={12} /> Pendente
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
                                🚫 Empresa já existente: {it.nomeExistente || it.razao_social}
                              </span>
                              <span className="text-[10px] text-red-600 block">Não será importada novamente</span>
                            </div>
                          ) : (
                            <div>
                              <span className="font-bold text-slate-900 dark:text-white block truncate">
                                {it.razao_social || <span className="text-slate-400 italic font-normal">Pendente (será gerado fictício)</span>}
                              </span>
                              {it.nome_fantasia && (
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">
                                  {it.nome_fantasia}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {it.cidade ? `${it.cidade}/${it.uf}` : <span className="text-slate-400">Pará de Minas/MG</span>}
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          <div>
                            <span>{it.telefone || it.whatsapp || '(37) 3232-1000'}</span>
                            <span className="text-[10px] text-slate-400 block">ERP: {it.nome_sistema_utilizado || 'PARATECH'}</span>
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
                  <span>Salvando no Banco...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={15} />
                  <span>Confirmar e Salvar ({novosCount}) Novos Cadastros</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
