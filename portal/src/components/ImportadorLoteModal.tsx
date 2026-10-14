'use client'

import React, { useState, useRef } from 'react'
import { 
  Upload, FileText, CheckCircle2, AlertCircle, X, Loader2, 
  Download, Building2, Users, Search, Play, Check, RefreshCw, FileSpreadsheet
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
  statusConsulta: 'pendente' | 'consultando' | 'sucesso' | 'erro' | 'manual'
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
  const [progressoReceita, setProgressoReceita] = useState<{ atual: number; total: number }>({ atual: 0, total: 0 })
  const [salvandoBanco, setSalvandoBanco] = useState(false)
  const [contabilidadeSelecionada, setContabilidadeSelecionada] = useState<string>('')
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

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
    const toastId = toast.loading('Lendo arquivo...')

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

      // Remover duplicatas de CNPJ no próprio arquivo
      const cnpsVistos = new Set<string>()
      const itensUnicos = itensExtraidos.filter(it => {
        if (!it.cnpj) return true
        if (cnpsVistos.has(it.cnpj)) return false
        cnpsVistos.add(it.cnpj)
        return true
      })

      setItens(itensUnicos)
      toast.success(`${itensUnicos.length} registros extraídos do arquivo com sucesso!`, { id: toastId })
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
      
      // Procura chaves flexíveis (case-insensitive)
      let rawCnpj = ''
      let razao = ''
      let fantasia = ''
      let email = ''
      let tel = ''
      let cid = ''
      let uf = ''

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
      }

      // Se não achou por chave de CNPJ, verifica se o valor da primeira coluna é um CNPJ
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
          statusConsulta: razao ? 'manual' : 'pendente',
          origem: 'arquivo'
        })
      }
    }

    return resultado
  }

  // Processa TXT (pode ser linha por linha de CNPJ ou separado por vírgula/ponto-e-vírgula)
  const processarTxt = (conteudo: string): ItemImportacao[] => {
    const resultado: ItemImportacao[] = []
    const linhas = conteudo.split(/\r?\n/)

    let idx = 0
    for (const linha of linhas) {
      const linhaTrim = linha.trim()
      if (!linhaTrim) continue

      // Extrair todos os CNPJs encontrados na linha
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
        // Formato CSV simples no TXT
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
            statusConsulta: item.razao_social ? 'manual' : 'pendente',
            origem: 'arquivo'
          })
        }
      }
    })

    return resultado
  }

  // 2. Consulta Automática na Receita Federal para todos os CNPJs pendentes
  const handleConsultarTodosNaReceita = async () => {
    if (itens.length === 0 || processandoReceita) return

    setProcessandoReceita(true)
    const toastId = toast.loading('Iniciando busca em lote na Receita Federal...')

    const novosItens = [...itens]
    let concluidos = 0
    const total = novosItens.length
    setProgressoReceita({ atual: 0, total })

    for (let i = 0; i < novosItens.length; i++) {
      const item = novosItens[i]
      
      // Atualiza status para consultando
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
            statusConsulta: 'sucesso',
            origem: 'receita'
          }
        } else {
          novosItens[i] = {
            ...novosItens[i],
            statusConsulta: 'erro',
            mensagemErro: data.error || 'Não localizado na RFB'
          }
        }
      } catch (err: any) {
        novosItens[i] = {
          ...novosItens[i],
          statusConsulta: 'erro',
          mensagemErro: err.message || 'Falha na requisição'
        }
      }

      concluidos++
      setProgressoReceita({ atual: concluidos, total })
      setItens([...novosItens])

      // Pequena pausa para evitar flood de requisições
      await new Promise(r => setTimeout(r, 200))
    }

    setProcessandoReceita(false)
    toast.success('Consultas na Receita Federal concluídas!', { id: toastId })
  }

  // 3. Salvar Cadastros em Lote no Supabase
  const handleSalvarCadastros = async () => {
    // Filtra itens com dados mínimos válidos
    const itensValidos = itens.filter(it => it.cnpj && (it.razao_social || it.statusConsulta === 'sucesso'))

    if (itensValidos.length === 0) {
      toast.error('Nenhum cadastro com dados completos para salvar. Execute a busca na Receita Federal primeiro.')
      return
    }

    setSalvandoBanco(true)
    const toastId = toast.loading(`Cadastrando ${itensValidos.length} ${tipo === 'contabilidade' ? 'escritórios' : 'clientes'} no portal...`)

    try {
      if (tipo === 'contabilidade') {
        const payloads = itensValidos.map(it => ({
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
        // Clientes
        const payloads = itensValidos.map(it => ({
          razao_social: it.razao_social || `Empresa ${it.cnpjFormatado}`,
          nome_fantasia: it.nome_fantasia || it.razao_social,
          cnpj: it.cnpjFormatado,
          contabilidade_id: contabilidadeSelecionada || null,
          email_fiscal: it.email || null,
          whatsapp: it.whatsapp || null,
          cidade: it.cidade || null,
          uf: it.uf || null,
          ramo_atividade: it.ramo_atividade || null,
          regime_tributario: it.regime_tributario || 'simples_nacional',
          is_ativo: true,
          dia_vencimento: 10,
          valor_mensalidade: 0,
          hub_token: gerarTokenHub()
        }))

        const { error } = await supabase.from('clientes').insert(payloads)
        if (error) throw error
      }

      toast.success(`🎉 ${itensValidos.length} ${tipo === 'contabilidade' ? 'contabilidades' : 'clientes'} cadastrados com sucesso!`, { id: toastId, duration: 5000 })
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

  const pendentesCount = itens.filter(it => it.statusConsulta === 'pendente' || it.statusConsulta === 'erro').length
  const prontosCount = itens.filter(it => it.razao_social || it.statusConsulta === 'sucesso').length

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
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                Importação em Lote de {tipo === 'contabilidade' ? 'Contabilidades' : 'Clientes'}
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/50 dark:text-blue-300">
                  CSV, TXT, JSON, XLS, XLSX
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Envie planilhas completas ou apenas a lista de CNPJs. O sistema busca os dados cadastrais completos na Receita Federal automaticamente.
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
                  Todas as empresas importadas serão vinculadas ao escritório selecionado abaixo.
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
                  {arquivoNome ? `Arquivo: ${arquivoNome}` : 'Arraste ou clique para carregar o arquivo'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Aceita arquivos <strong>.CSV, .TXT, .JSON, .XLS ou .XLSX</strong> contendo uma lista de CNPJs ou planilhas de cadastros.
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

          {/* Barra de Ações Rápidas & Busca Automática na Receita */}
          {itens.length > 0 && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-md">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-base font-extrabold">{itens.length} empresas identificadas</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 font-bold">
                    {prontosCount} prontas • {pendentesCount} sem consulta
                  </span>
                </div>
                <p className="text-xs text-slate-300">
                  Se o arquivo continha apenas CNPJs, clique no botão ao lado para preencher Razão Social, Fantasia, Endereço e Regime diretamente da Receita Federal.
                </p>
              </div>

              <button
                type="button"
                onClick={handleConsultarTodosNaReceita}
                disabled={processandoReceita || pendentesCount === 0}
                className="px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-2 shadow-lg flex-shrink-0"
              >
                {processandoReceita ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Consultando {progressoReceita.atual}/{progressoReceita.total}...</span>
                  </>
                ) : (
                  <>
                    <Search size={16} />
                    <span>Buscar Dados na Receita Federal</span>
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
                <span>{progressoReceita.atual} de {progressoReceita.total} ({Math.round((progressoReceita.atual / progressoReceita.total) * 100)}%)</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-blue-600 to-cyan-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${(progressoReceita.atual / progressoReceita.total) * 100}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Tabela de Prévia dos Dados */}
          {itens.length > 0 && (
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
              <div className="max-h-60 overflow-y-auto custom-scrollbar">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0 z-10 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-3">Status</th>
                      <th className="p-3">CNPJ</th>
                      <th className="p-3">Razão Social</th>
                      <th className="p-3">Município / UF</th>
                      <th className="p-3">Contato / Telefone</th>
                      <th className="p-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {itens.map((it, idx) => (
                      <tr key={it.idTemp} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="p-3">
                          {it.statusConsulta === 'consultando' && (
                            <span className="inline-flex items-center gap-1 text-blue-600 font-bold">
                              <Loader2 size={12} className="animate-spin" /> Buscando
                            </span>
                          )}
                          {it.statusConsulta === 'sucesso' && (
                            <span className="inline-flex items-center gap-1 text-emerald-600 font-bold">
                              <CheckCircle2 size={12} /> Localizado
                            </span>
                          )}
                          {it.statusConsulta === 'manual' && (
                            <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-400 font-bold">
                              <Check size={12} /> No Arquivo
                            </span>
                          )}
                          {it.statusConsulta === 'pendente' && (
                            <span className="inline-flex items-center gap-1 text-amber-600 font-bold">
                              <AlertCircle size={12} /> Pendente
                            </span>
                          )}
                          {it.statusConsulta === 'erro' && (
                            <span className="inline-flex items-center gap-1 text-red-600 font-bold" title={it.mensagemErro}>
                              <AlertCircle size={12} /> Erro
                            </span>
                          )}
                        </td>
                        <td className="p-3 font-mono font-semibold text-slate-800 dark:text-slate-200">
                          {it.cnpjFormatado}
                        </td>
                        <td className="p-3 font-bold text-slate-900 dark:text-white max-w-xs truncate">
                          {it.razao_social || <span className="text-slate-400 italic">Pendente de consulta</span>}
                          {it.nome_fantasia && it.nome_fantasia !== it.razao_social && (
                            <div className="text-[10px] text-slate-400 font-normal truncate">{it.nome_fantasia}</div>
                          )}
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-400">
                          {it.cidade ? `${it.cidade}/${it.uf}` : '—'}
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-400">
                          {it.telefone || it.email || '—'}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setItens(itens.filter((_, i) => i !== idx))
                            }}
                            className="text-red-500 hover:text-red-700 p-1"
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
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {itens.length > 0 ? (
              <>Total de <strong>{itens.length}</strong> itens carregados (<strong>{prontosCount}</strong> prontos para cadastro).</>
            ) : (
              'Nenhum arquivo carregado ainda.'
            )}
          </p>

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
              disabled={salvandoBanco || processandoReceita || prontosCount === 0}
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
                  <span>Confirmar e Salvar ({prontosCount}) Cadastros</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
