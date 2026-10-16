'use client'

import { useState, useEffect, useRef } from 'react'
import { 
  ScanText, Search, Upload, Camera, FileSpreadsheet, FileText, 
  Download, RefreshCw, CheckCircle2, AlertTriangle, Sparkles, 
  HelpCircle, Copy, Check, ChevronRight, Layers, ArrowRight, 
  Trash2, Plus, Edit3, Save, X, ExternalLink, ShieldCheck, 
  Info, Cpu, BarChart3, Database, FileDown, CheckCheck
} from 'lucide-react'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'
import { createClient } from '@/utils/supabase/client'
import { ProdutoTributadoOutput, ItemExtraidoOcr } from '@/utils/tributario/sugestorEngine'
import { useTableFeatures } from '@/hooks/useTableFeatures'
import { ResizableSortableTh } from '@/components/ui/ResizableSortableTh'

export default function SugestorTributarioPage() {
  const supabase = createClient()

  // Estados de Contexto do Cliente e CRT
  const [clientes, setClientes] = useState<any[]>([])
  const [clienteSelecionadoId, setClienteSelecionadoId] = useState<string>('')
  const [clienteAtivo, setClienteAtivo] = useState<any | null>(null)
  const [crt, setCrt] = useState<number>(1) // 1 = Simples Nacional, 3 = Regime Normal
  const [ufOrigem, setUfOrigem] = useState<string>('MG')
  const [ufDestino, setUfDestino] = useState<string>('MG')
  const [usarIa, setUsarIa] = useState<boolean>(true)

  // Modos de Entrada (Abas do Módulo)
  const [activeTab, setActiveTab] = useState<'unitario' | 'arquivo' | 'ocr'>('unitario')

  // MODO 1: Consulta Unitária
  const [termoBusca, setTermoBusca] = useState<string>('')
  const [ncmOpcional, setNcmOpcional] = useState<string>('')
  const [valorOpcional, setValorOpcional] = useState<string>('')
  const [buscandoUnitario, setBuscandoUnitario] = useState<boolean>(false)
  const [resultadoUnitario, setResultadoUnitario] = useState<ProdutoTributadoOutput | null>(null)
  const [editandoUnitario, setEditandoUnitario] = useState<boolean>(false)
  const [formUnitarioEdit, setFormUnitarioEdit] = useState<Partial<ProdutoTributadoOutput>>({})

  // MODO 2: Arquivo (Planilha ou TXT)
  const [arquivoCarregado, setArquivoCarregado] = useState<File | null>(null)
  const [itensArquivo, setItensArquivo] = useState<Array<{ codigo: string; descricao: string; valor: number; ncm: string }>>([])
  const [lendoArquivo, setLendoArquivo] = useState<boolean>(false)
  const [processandoLote, setProcessandoLote] = useState<boolean>(false)
  const [progressoLote, setProgressoLote] = useState<number>(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // MODO 3: Foto com OCR
  const [fotoOcrBase64, setFotoOcrBase64] = useState<string | null>(null)
  const [itensOcrExtraidos, setItensOcrExtraidos] = useState<ItemExtraidoOcr[]>([])
  const [processandoOcr, setProcessandoOcr] = useState<boolean>(false)
  const [provedorOcr, setProvedorOcr] = useState<string>('')
  const fotoInputRef = useRef<HTMLInputElement>(null)

  // Tabela Geral de Itens Tributados e Exportação
  const [tabelaTributada, setTabelaTributada] = useState<ProdutoTributadoOutput[]>([])
  const [filtroTabela, setFiltroTabela] = useState<'todos' | 'monofasicos' | 'st' | 'cesta_basica'>('todos')
  const [buscaTabela, setBuscaTabela] = useState<string>('')
  const [modalItemDetalhe, setModalItemDetalhe] = useState<ProdutoTributadoOutput | null>(null)

  // 1. Carregar Clientes para Contexto de CRT
  useEffect(() => {
    async function carregarClientes() {
      try {
        const { data, error } = await supabase
          .from('clientes')
          .select('id, razao_social, nome_fantasia, cnpj, regime_tributario, uf, cidade')
          .order('razao_social', { ascending: true })

        if (!error && data && data.length > 0) {
          setClientes(data)
          // Seleciona o primeiro por padrão ou recupera da sessão
          const salvo = localStorage.getItem('hub_cliente_ativo_id')
          const clientePadrao = data.find(c => c.id === salvo) || data[0]
          setClienteSelecionadoId(clientePadrao.id)
          setClienteAtivo(clientePadrao)

          // Aplica CRT e UF do cliente
          const regime = clientePadrao.regime_tributario || ''
          const isSimples = regime.includes('simples') || !regime.includes('lucro')
          setCrt(isSimples ? 1 : 3)
          if (clientePadrao.uf) {
            setUfOrigem(clientePadrao.uf.toUpperCase())
            setUfDestino(clientePadrao.uf.toUpperCase())
          }
        }
      } catch (err) {
        console.warn('Erro ao carregar lista de clientes:', err)
      }
    }
    carregarClientes()
  }, [])

  // Quando o cliente selecionado muda
  const handleSelecionarCliente = (id: string) => {
    setClienteSelecionadoId(id)
    localStorage.setItem('hub_cliente_ativo_id', id)
    const c = clientes.find(item => item.id === id)
    if (c) {
      setClienteAtivo(c)
      const regime = c.regime_tributario || ''
      const isSimples = regime.includes('simples') || !regime.includes('lucro')
      setCrt(isSimples ? 1 : 3)
      if (c.uf) {
        setUfOrigem(c.uf.toUpperCase())
        setUfDestino(c.uf.toUpperCase())
      }
      toast.success(`Contexto alterado para ${c.nome_fantasia || c.razao_social} (${isSimples ? 'Simples Nacional' : 'Regime Normal'})`)
    }
  }

  // Alternar CRT manualmente
  const handleAlternarCrt = (novoCrt: number) => {
    setCrt(novoCrt)
    toast.success(`Regime alterado para: ${novoCrt === 1 ? 'Simples Nacional (CSOSN)' : 'Regime Normal (CST ICMS/PIS/COFINS)'}`)
    
    // Se já tiver resultado unitário, re-tributa no novo CRT
    if (resultadoUnitario) {
      handleBuscarUnitario(termoBusca || resultadoUnitario.descricao, novoCrt)
    }
  }

  // ========================================================
  // MODO 1: BUSCAR TRIBUTAÇÃO UNITÁRIA
  // ========================================================
  const handleBuscarUnitario = async (descricaoManual?: string, crtManual?: number) => {
    const desc = (descricaoManual || termoBusca).trim()
    if (!desc) {
      toast.error('Digite a descrição ou nome do produto.')
      return
    }

    setBuscandoUnitario(true)
    setEditandoUnitario(false)
    const toastId = toast.loading('Consultando inteligência fiscal e tabelas de referência...')

    try {
      const res = await fetch('/api/tributario/sugestor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'buscar_unitario',
          produto: {
            descricao: desc,
            ncmAtual: ncmOpcional || undefined,
            valor: parseFloat(valorOpcional.replace(',', '.')) || 0
          },
          crt: crtManual || crt,
          uf_origem: ufOrigem,
          uf_destino: ufDestino,
          usar_ia: usarIa
        })
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Falha ao buscar tributação')
      }

      const itemTributado: ProdutoTributadoOutput = data.resultado
      setResultadoUnitario(itemTributado)
      setFormUnitarioEdit(itemTributado)

      // Adiciona automaticamente à tabela de resultados se ainda não estiver
      adicionarNaTabelaTributada(itemTributado)

      toast.success('Tributação encontrada com sucesso!', { id: toastId })
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`, { id: toastId })
    } finally {
      setBuscandoUnitario(false)
    }
  }

  // Salvar edições manuais feitas no formulário unitário
  const handleSalvarEdicaoUnitario = () => {
    if (!resultadoUnitario) return
    const atualizado: ProdutoTributadoOutput = {
      ...resultadoUnitario,
      ...formUnitarioEdit,
      id: resultadoUnitario.id
    } as ProdutoTributadoOutput

    setResultadoUnitario(atualizado)
    setEditandoUnitario(false)
    adicionarNaTabelaTributada(atualizado)
    toast.success('Valores tributários atualizados com sucesso!')
  }

  // ========================================================
  // MODO 2: IMPORTAR PLANILHA (.XLSX, .CSV) OU TXT
  // ========================================================
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setArquivoCarregado(file)
    setLendoArquivo(true)
    const ext = file.name.split('.').pop()?.toLowerCase()

    try {
      if (ext === 'txt') {
        // Leitura de arquivo TXT linha por linha
        const text = await file.text()
        const linhas = text.split(/\r?\n/).filter(l => l.trim().length > 0)
        const parsedItens = linhas.map((linha, index) => {
          // Verifica se a linha tem delimitador (ponto e vírgula, tabulação ou vírgula)
          if (linha.includes(';') || linha.includes('\t')) {
            const partes = linha.split(linha.includes(';') ? ';' : '\t')
            return {
              codigo: partes[0]?.trim() || String(index + 1),
              descricao: partes[1]?.trim() || partes[0]?.trim() || `Item ${index + 1}`,
              valor: parseFloat(partes[2]?.replace(',', '.') || '0') || 0,
              ncm: partes[3]?.replace(/\D/g, '') || ''
            }
          }
          return {
            codigo: String(index + 1),
            descricao: linha.trim(),
            valor: 0,
            ncm: ''
          }
        })

        setItensArquivo(parsedItens)
        toast.success(`${parsedItens.length} produtos carregados do arquivo TXT!`)
      } else {
        // Leitura de planilha (.xlsx, .xls, .csv)
        const arrayBuffer = await file.arrayBuffer()
        const workbook = XLSX.read(arrayBuffer, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        const rawJson: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' })

        if (rawJson.length === 0) {
          throw new Error('A planilha está vazia.')
        }

        // Mapeador semântico de colunas
        const colunas = Object.keys(rawJson[0])
        const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "")
        
        let colDesc = colunas.find(c => {
          const n = norm(c)
          return n.includes('desc') || n === 'produto' || n === 'nome' || n === 'item' || n === 'xprod'
        }) || colunas[0]

        let colCod = colunas.find(c => {
          const n = norm(c)
          return n === 'codigo' || n === 'cod' || n === 'id' || n === 'cprod' || n === 'sku' || n === 'ref'
        })

        let colVal = colunas.find(c => {
          const n = norm(c)
          return n.includes('preco') || n.includes('valor') || n === 'vuncom' || n === 'vprod'
        })

        let colNcm = colunas.find(c => {
          const n = norm(c)
          return n.includes('ncm') || n === 'sh'
        })

        const parsedItens = rawJson.map((row, index) => ({
          codigo: colCod ? String(row[colCod] || '') : String(index + 1),
          descricao: String(row[colDesc] || '').trim(),
          valor: colVal ? (parseFloat(String(row[colVal]).replace(',', '.')) || 0) : 0,
          ncm: colNcm ? String(row[colNcm] || '').replace(/\D/g, '') : ''
        })).filter(i => i.descricao.length > 0)

        setItensArquivo(parsedItens)
        toast.success(`${parsedItens.length} produtos detectados na planilha!`)
      }
    } catch (err: any) {
      toast.error('Erro ao ler arquivo: ' + err.message)
      setArquivoCarregado(null)
      setItensArquivo([])
    } finally {
      setLendoArquivo(false)
    }
  }

  // Executar tributação em lote da planilha / TXT
  const handleProcessarLoteArquivo = async () => {
    if (itensArquivo.length === 0) {
      toast.error('Nenhum item carregado para processar.')
      return
    }

    setProcessandoLote(true)
    setProgressoLote(10)
    const toastId = toast.loading(`Processando lote de ${itensArquivo.length} produtos com IA fiscal...`)

    try {
      const loteProdutos = itensArquivo.map(i => ({
        codigo: i.codigo,
        descricao: i.descricao,
        valor: i.valor,
        ncmAtual: i.ncm
      }))

      const res = await fetch('/api/tributario/sugestor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'buscar_lote',
          produtos: loteProdutos,
          crt,
          uf_origem: ufOrigem,
          uf_destino: ufDestino,
          usar_ia: usarIa
        })
      })

      setProgressoLote(70)
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Falha ao processar lote')
      }

      const resultadosLote: ProdutoTributadoOutput[] = data.resultados || []
      
      // Adiciona todos na tabela principal
      setTabelaTributada(prev => {
        const novos = [...resultadosLote, ...prev]
        // Remove duplicidades por descrição/código
        const mapa = new Map<string, ProdutoTributadoOutput>()
        novos.forEach(item => mapa.set(`${item.codigo}_${item.descricao}`, item))
        return Array.from(mapa.values())
      })

      setProgressoLote(100)
      toast.success(`${resultadosLote.length} produtos tributados com sucesso!`, { id: toastId })
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`, { id: toastId })
    } finally {
      setProcessandoLote(false)
    }
  }

  // ========================================================
  // MODO 3: FOTO COM OCR INTELIGENTE
  // ========================================================
  const handleFotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione um arquivo de imagem válido (PNG, JPG, JPEG, WEBP).')
      return
    }

    const reader = new FileReader()
    reader.onload = async () => {
      const base64 = reader.result as string
      setFotoOcrBase64(base64)
      await executarOcrNaFoto(base64, file.type)
    }
    reader.readAsDataURL(file)
  }

  const executarOcrNaFoto = async (base64: string, mimeType: string) => {
    setProcessandoOcr(true)
    const toastId = toast.loading('Lendo imagem e extraindo produtos com OCR e Visão IA...')

    try {
      const res = await fetch('/api/tributario/sugestor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'ocr_foto',
          image_base64: base64,
          mime_type: mimeType
        })
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Falha na leitura OCR da foto.')
      }

      setItensOcrExtraidos(data.itens || [])
      setProvedorOcr(data.provedor || 'Visão IA')
      toast.success(`${data.totalItens} produtos identificados na foto!`, { id: toastId })
    } catch (err: any) {
      toast.error(err.message, { id: toastId, duration: 6000 })
    } finally {
      setProcessandoOcr(false)
    }
  }

  // Alterar campo de um item extraído do OCR antes de tributar
  const handleEditarItemOcr = (id: string, campo: keyof ItemExtraidoOcr, valor: any) => {
    setItensOcrExtraidos(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, [campo]: valor }
      }
      return item
    }))
  }

  const handleExcluirItemOcr = (id: string) => {
    setItensOcrExtraidos(prev => prev.filter(i => i.id !== id))
    toast('Item removido da lista.', { icon: '🗑️' })
  }

  const handleAdicionarItemOcrManual = () => {
    const novo: ItemExtraidoOcr = {
      id: `ocr_manual_${Date.now()}`,
      codigo: '',
      descricao: 'Novo Produto',
      valor: 0,
      ncm: '',
      quantidade: 1
    }
    setItensOcrExtraidos(prev => [novo, ...prev])
  }

  // Tributar todos os itens validados do OCR
  const handleTributarItensOcr = async () => {
    if (itensOcrExtraidos.length === 0) {
      toast.error('Nenhum item para tributar.')
      return
    }

    setProcessandoLote(true)
    const toastId = toast.loading(`Buscando tributação de ${itensOcrExtraidos.length} itens do OCR...`)

    try {
      const loteProdutos = itensOcrExtraidos.map(i => ({
        codigo: i.codigo,
        descricao: i.descricao,
        valor: i.valor,
        ncmAtual: i.ncm,
        quantidade: i.quantidade
      }))

      const res = await fetch('/api/tributario/sugestor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'buscar_lote',
          produtos: loteProdutos,
          crt,
          uf_origem: ufOrigem,
          uf_destino: ufDestino,
          usar_ia: usarIa
        })
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Falha ao tributar itens do OCR')
      }

      const resultados: ProdutoTributadoOutput[] = data.resultados || []
      
      setTabelaTributada(prev => {
        const novos = [...resultados, ...prev]
        const mapa = new Map<string, ProdutoTributadoOutput>()
        novos.forEach(item => mapa.set(`${item.codigo}_${item.descricao}`, item))
        return Array.from(mapa.values())
      })

      toast.success(`${resultados.length} produtos do OCR tributados com sucesso!`, { id: toastId })
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`, { id: toastId })
    } finally {
      setProcessandoLote(false)
    }
  }

  // ========================================================
  // GERENCIAMENTO DA TABELA GERAL E EXPORTAÇÕES
  // ========================================================
  const adicionarNaTabelaTributada = (item: ProdutoTributadoOutput) => {
    setTabelaTributada(prev => {
      const semEle = prev.filter(p => !(p.codigo === item.codigo && p.descricao.toLowerCase() === item.descricao.toLowerCase()))
      return [item, ...semEle]
    })
  }

  const removerDaTabela = (id: string) => {
    setTabelaTributada(prev => prev.filter(i => i.id !== id))
    toast.success('Produto removido da lista.')
  }

  const limparTabela = () => {
    if (confirm('Deseja realmente limpar toda a tabela de produtos tributados?')) {
      setTabelaTributada([])
      setResultadoUnitario(null)
      toast('Tabela limpa.', { icon: '🧹' })
    }
  }

  // Filtros da Tabela
  const itensFiltrados = tabelaTributada.filter(item => {
    const matchBusca = 
      item.descricao.toLowerCase().includes(buscaTabela.toLowerCase()) ||
      item.codigo.toLowerCase().includes(buscaTabela.toLowerCase()) ||
      item.ncm.includes(buscaTabela) ||
      item.cest.includes(buscaTabela) ||
      item.cfopInterno.includes(buscaTabela)

    if (!matchBusca) return false

    if (filtroTabela === 'monofasicos') return item.isMonofasico
    if (filtroTabela === 'st') return Boolean(item.cest || item.cfopInterno === '5405')
    if (filtroTabela === 'cesta_basica') return item.classificacaoReforma.toLowerCase().includes('cesta') || item.ibsAliq === 0

    return true
  })

  const {
    sortedData: itensOrdenados,
    sortKey,
    sortDirection,
    handleSort,
    columnWidths,
    handleResizeColumn
  } = useTableFeatures({
    data: itensFiltrados,
    tableId: 'tabela_sugestor_tributario',
    defaultSortKey: 'produto',
    defaultSortDirection: 'asc',
    initialWidths: {
      produto: 260,
      ncm: 110,
      cest: 110,
      cfopInterno: 110,
      cfopInterestadual: 130,
      icms: 110,
      pisCofins: 130,
      reforma: 140,
      acoes: 100
    },
    customExtractors: {
      produto: (i: any) => i.descricao || '',
      ncm: (i: any) => i.ncm || '',
      cest: (i: any) => i.cest || '',
      cfopInterno: (i: any) => i.cfopInterno || '',
      cfopInterestadual: (i: any) => i.cfopInterestadual || '',
      icms: (i: any) => i.csosn || i.cstIcms || '',
      pisCofins: (i: any) => `${i.cstPis || ''}/${i.cstCofins || ''}`,
      reforma: (i: any) => i.classificacaoReforma || ''
    }
  })

  // EXPORTAR EM EXCEL (.XLSX)
  const exportarExcel = () => {
    if (tabelaTributada.length === 0) {
      toast.error('Nenhum dado na tabela para exportar.')
      return
    }

    const rows = tabelaTributada.map((item, idx) => ({
      'Item': idx + 1,
      'Código': item.codigo || '',
      'Descrição do Produto': item.descricao,
      'Valor Unitário (R$)': item.valor || 0,
      'NCM': item.ncm,
      'CEST': item.cest || '',
      'CFOP Interno (Dentro Estado)': item.cfopInterno,
      'CFOP Interestadual (Fora Estado)': item.cfopInterestadual,
      'Regime Tributário': item.crtUtilizado === 1 ? 'Simples Nacional' : 'Regime Normal',
      'CSOSN (Simples)': item.csosn || '',
      'CST ICMS (Normal)': item.cstIcms || '',
      'CST PIS': item.cstPis,
      'Alíquota PIS (%)': item.aliqPis,
      'CST COFINS': item.cstCofins,
      'Alíquota COFINS (%)': item.aliqCofins,
      'PIS/COFINS Monofásico?': item.isMonofasico ? 'SIM (Alíquota Zero Revenda)' : 'NÃO',
      'IBS Estimado (%)': item.ibsAliq,
      'CBS Estimada (%)': item.cbsAliq,
      'IVA Dual Total (%)': item.ivaDual,
      'CST IBS/CBS': item.cstIbsCbs,
      'Enquadramento Reforma': item.classificacaoReforma,
      'Imposto Seletivo?': item.temImpostoSeletivo ? 'SIM' : 'NÃO',
      'Confiabilidade': `${item.scoreConfianca}%`,
      'Motor Fiscal / IA': item.provedorIa,
      'Fundamentação Legal': item.justificativa
    }))

    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Tributacao_Produtos')
    XLSX.writeFile(workbook, `Tributacao_Produtos_HubParatech_${new Date().toISOString().slice(0, 10)}.xlsx`)
    toast.success('Planilha Excel baixada com sucesso!')
  }

  // EXPORTAR EM CSV
  const exportarCsv = () => {
    if (tabelaTributada.length === 0) {
      toast.error('Nenhum dado na tabela para exportar.')
      return
    }

    const headers = [
      'Codigo', 'Descricao', 'Valor', 'NCM', 'CEST', 
      'CFOP_Interno', 'CFOP_Interestadual', 'CSOSN', 'CST_ICMS', 
      'CST_PIS', 'Aliq_PIS', 'CST_COFINS', 'Aliq_COFINS', 'Monofasico', 
      'IBS_Aliq', 'CBS_Aliq', 'IVA_Dual', 'CST_IBS_CBS', 'Reforma_Classificacao'
    ]

    const linhas = tabelaTributada.map(i => [
      `"${i.codigo}"`,
      `"${i.descricao.replace(/"/g, '""')}"`,
      i.valor.toFixed(2),
      `"${i.ncm}"`,
      `"${i.cest}"`,
      `"${i.cfopInterno}"`,
      `"${i.cfopInterestadual}"`,
      `"${i.csosn}"`,
      `"${i.cstIcms}"`,
      `"${i.cstPis}"`,
      i.aliqPis,
      `"${i.cstCofins}"`,
      i.aliqCofins,
      i.isMonofasico ? 'SIM' : 'NAO',
      i.ibsAliq,
      i.cbsAliq,
      i.ivaDual,
      `"${i.cstIbsCbs}"`,
      `"${i.classificacaoReforma}"`
    ].join(';'))

    const csvContent = '\uFEFF' + [headers.join(';'), ...linhas].join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `tributacao_produtos_${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
    toast.success('Arquivo CSV baixado com sucesso!')
  }

  // EXPORTAR EM TXT FORMATADO (Padrão de integração com ERPs)
  const exportarTxt = () => {
    if (tabelaTributada.length === 0) {
      toast.error('Nenhum dado na tabela para exportar.')
      return
    }

    const linhas = tabelaTributada.map(i => 
      [
        i.codigo || '0',
        i.descricao,
        i.ncm,
        i.cest || '0000000',
        i.cfopInterno,
        i.cfopInterestadual,
        i.csosn || i.cstIcms,
        i.cstPis,
        i.cstCofins,
        i.isMonofasico ? '1' : '0',
        i.ibsAliq.toFixed(2),
        i.cbsAliq.toFixed(2)
      ].join('|')
    )

    const cabecalho = '# CODIGO|DESCRICAO|NCM|CEST|CFOP_INT|CFOP_EXT|CSOSN_CST|CST_PIS|CST_COF|MONO|IBS|CBS'
    const txtContent = [cabecalho, ...linhas].join('\r\n')
    const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `tributacao_erps_${new Date().toISOString().slice(0, 10)}.txt`
    link.click()
    URL.revokeObjectURL(url)
    toast.success('Arquivo TXT gerado para importação em sistemas ERP!')
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      
      {/* 1. SELETOR DE CONTEXTO DO CLIENTE & CRT */}
      <div className="bg-white dark:bg-[#0B1120] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs transition-colors">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          
          {/* Cliente Ativo */}
          <div className="flex items-start sm:items-center gap-3.5 flex-1 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200/60 dark:border-blue-800 flex-shrink-0">
              <ScanText size={22} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Cliente Selecionado:</span>
                {clienteAtivo && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono">
                    {clienteAtivo.cnpj}
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-center gap-3 flex-wrap">
                {clientes.length > 0 ? (
                  <select
                    value={clienteSelecionadoId}
                    onChange={(e) => handleSelecionarCliente(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-sm font-semibold rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none max-w-md truncate cursor-pointer"
                  >
                    {clientes.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.razao_social} {c.nome_fantasia ? `(${c.nome_fantasia})` : ''} - {c.uf || 'BR'}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    {clienteAtivo?.razao_social || 'Nenhum cliente cadastrado'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Seletores de CRT e UF */}
          <div className="flex flex-wrap items-center gap-3 border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-100 dark:border-slate-800">
            
            {/* Seletor Visual de CRT */}
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Regime Tributário (CRT):</span>
              <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-900 p-1 border border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => handleAlternarCrt(1)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    crt === 1 
                      ? 'bg-emerald-600 text-white shadow-xs' 
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${crt === 1 ? 'bg-white' : 'bg-emerald-500'}`} />
                  CRT 1 - Simples Nacional
                </button>
                <button
                  type="button"
                  onClick={() => handleAlternarCrt(3)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    crt === 3 
                      ? 'bg-blue-600 text-white shadow-xs' 
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${crt === 3 ? 'bg-white' : 'bg-blue-500'}`} />
                  CRT 3 - Regime Normal
                </button>
              </div>
            </div>

            {/* UF Origem / Destino */}
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">UF Origem / Destino:</span>
              <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300">
                <span>{ufOrigem}</span>
                <ArrowRight size={14} className="text-slate-400" />
                <select
                  value={ufDestino}
                  onChange={(e) => setUfDestino(e.target.value)}
                  className="bg-transparent font-bold text-blue-600 dark:text-blue-400 focus:outline-none cursor-pointer"
                >
                  {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(uf => (
                    <option key={uf} value={uf} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">
                      {uf} {uf === ufOrigem ? '(Interno)' : '(Interestadual)'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Toggle IA */}
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Motor de IA:</span>
              <button
                type="button"
                onClick={() => setUsarIa(!usarIa)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer ${
                  usarIa 
                    ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300' 
                    : 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500'
                }`}
              >
                <Sparkles size={14} className={usarIa ? 'text-indigo-600 dark:text-indigo-400 animate-pulse' : 'text-slate-400'} />
                {usarIa ? 'Multi-IA Ativa' : 'Apenas Motor Local'}
              </button>
            </div>

          </div>

        </div>
      </div>

      {/* 2. ABAS DE MODOS DE ENTRADA (CLEAN DESIGN) */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('unitario')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer ${
            activeTab === 'unitario'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Search size={18} />
          <span>Digitar Produto (Consulta Rápida)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('arquivo')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer ${
            activeTab === 'arquivo'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <FileSpreadsheet size={18} />
          <span>Importar Planilha ou TXT</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ocr')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer ${
            activeTab === 'ocr'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Camera size={18} />
          <span>Foto com OCR (Visão IA)</span>
          <span className="text-[10px] font-extrabold uppercase tracking-wide bg-amber-400 text-slate-900 px-1.5 py-0.2 rounded-md">
            IA
          </span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* ABA 1: CONSULTA UNITÁRIA                                 */}
      {/* ======================================================== */}
      {activeTab === 'unitario' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#0B1120] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xs">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">
              Pesquisar e Sugerir Tributação Completa
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
              Digite o nome comercial ou a descrição do produto. O sistema identificará automaticamente a NCM, CEST, os <strong>dois CFOPs</strong> (para dentro e fora do estado), o código de situação tributária adequado ao seu CRT ({crt === 1 ? 'CSOSN 102/500' : 'CST ICMS 00/60'}), PIS/COFINS (monofásicos e alíquota zero) e o enquadramento na Reforma Tributária (IBS e CBS).
            </p>

            <form 
              onSubmit={(e) => { e.preventDefault(); handleBuscarUnitario(); }}
              className="grid grid-cols-1 md:grid-cols-12 gap-3"
            >
              {/* Descrição do Produto */}
              <div className="md:col-span-7">
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Descrição ou Nome do Produto <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={termoBusca}
                    onChange={(e) => setTermoBusca(e.target.value)}
                    placeholder="Ex: Cerveja Heineken Long Neck 330ml, Refrigerante Coca Cola 2L, Pneu 175/70 R14, Arroz Tio João 5kg..."
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    autoFocus
                  />
                  <Search size={18} className="absolute left-3.5 top-3.5 text-slate-400" />
                </div>
              </div>

              {/* NCM Opcional */}
              <div className="md:col-span-3">
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  NCM (Opcional se já souber)
                </label>
                <input
                  type="text"
                  maxLength={8}
                  value={ncmOpcional}
                  onChange={(e) => setNcmOpcional(e.target.value.replace(/\D/g, ''))}
                  placeholder="8 dígitos (ex: 22021000)"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-mono text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* Valor Unitário */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Preço Venda (R$)
                </label>
                <input
                  type="text"
                  value={valorOpcional}
                  onChange={(e) => setValorOpcional(e.target.value)}
                  placeholder="0,00"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* Botão Buscar */}
              <div className="md:col-span-12 flex justify-end gap-3 mt-2">
                <button
                  type="submit"
                  disabled={buscandoUnitario}
                  className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-sm shadow-md transition-all flex items-center gap-2 cursor-pointer"
                >
                  {buscandoUnitario ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Classificando com Inteligência Fiscal...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} />
                      <span>Buscar Tributação Completa</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* CARD DE RESULTADOS DA CONSULTA UNITÁRIA */}
          {resultadoUnitario && (
            <div className="bg-white dark:bg-[#0B1120] rounded-2xl border-2 border-blue-500/30 dark:border-blue-500/40 p-6 sm:p-8 shadow-lg transition-all space-y-6 animate-fadeIn">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 uppercase">
                      Diagnóstico Concluído
                    </span>
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-mono">
                      {resultadoUnitario.scoreConfianca}% Confiabilidade
                    </span>
                    {resultadoUnitario.isMonofasico && (
                      <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                        ⚡ Monofásico PIS/COFINS
                      </span>
                    )}
                  </div>
                  <h4 className="text-xl font-black text-slate-900 dark:text-white mt-1.5">
                    {resultadoUnitario.descricao}
                  </h4>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditandoUnitario(!editandoUnitario)}
                    className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Edit3 size={15} />
                    {editandoUnitario ? 'Cancelar Edição' : 'Editar Valores Sugeridos'}
                  </button>
                  <button
                    type="button"
                    onClick={exportarExcel}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download size={15} />
                    Baixar Tabela (.xlsx)
                  </button>
                </div>
              </div>

              {/* MODO VISUALIZAÇÃO OU MODO FORMULÁRIO DE EDIÇÃO */}
              {!editandoUnitario ? (
                <div className="space-y-6">
                  
                  {/* GRID 1: CFOPs (Dentro e Fora do Estado) - Destaque solicitado pelo usuário */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* CFOP Interno */}
                    <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/60">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                          <CheckCircle2 size={16} className="text-blue-600" />
                          CFOP Dentro do Estado (Interno)
                        </span>
                        <span className="text-lg font-mono font-black text-blue-700 dark:text-blue-300 bg-white dark:bg-blue-900/50 px-2.5 py-0.5 rounded-lg border border-blue-200 dark:border-blue-800">
                          {resultadoUnitario.cfopInterno}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                        {resultadoUnitario.descricaoCfopInterno}
                      </p>
                    </div>

                    {/* CFOP Interestadual */}
                    <div className="p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/60">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                          <ArrowRight size={16} className="text-indigo-600" />
                          CFOP Fora do Estado (Interestadual)
                        </span>
                        <span className="text-lg font-mono font-black text-indigo-700 dark:text-indigo-300 bg-white dark:bg-indigo-900/50 px-2.5 py-0.5 rounded-lg border border-indigo-200 dark:border-indigo-800">
                          {resultadoUnitario.cfopInterestadual}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                        {resultadoUnitario.descricaoCfopInterestadual}
                      </p>
                    </div>

                  </div>

                  {/* GRID 2: NCM, CEST, ICMS/CSOSN, PIS, COFINS */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    
                    {/* NCM */}
                    <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                        Código NCM
                      </span>
                      <span className="text-base font-mono font-black text-slate-800 dark:text-slate-100">
                        {resultadoUnitario.ncm}
                      </span>
                    </div>

                    {/* CEST */}
                    <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                        Código CEST (ST)
                      </span>
                      <span className="text-base font-mono font-black text-slate-800 dark:text-slate-100">
                        {resultadoUnitario.cest || 'Sem CEST'}
                      </span>
                    </div>

                    {/* CSOSN ou CST ICMS de acordo com CRT */}
                    <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                        {resultadoUnitario.crtUtilizado === 1 ? 'CSOSN (Simples)' : 'CST ICMS (Normal)'}
                      </span>
                      <span className="text-base font-mono font-black text-blue-600 dark:text-blue-400">
                        {resultadoUnitario.crtUtilizado === 1 ? resultadoUnitario.csosn : resultadoUnitario.cstIcms}
                      </span>
                    </div>

                    {/* PIS */}
                    <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                        CST PIS
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-base font-mono font-black text-slate-800 dark:text-slate-100">
                          {resultadoUnitario.cstPis}
                        </span>
                        <span className="text-[11px] text-slate-400 font-bold">
                          ({resultadoUnitario.aliqPis}%)
                        </span>
                      </div>
                    </div>

                    {/* COFINS */}
                    <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                        CST COFINS
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-base font-mono font-black text-slate-800 dark:text-slate-100">
                          {resultadoUnitario.cstCofins}
                        </span>
                        <span className="text-[11px] text-slate-400 font-bold">
                          ({resultadoUnitario.aliqCofins}%)
                        </span>
                      </div>
                    </div>

                    {/* CST IBS/CBS */}
                    <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                        CST IBS/CBS
                      </span>
                      <span className="text-base font-mono font-black text-indigo-600 dark:text-indigo-400">
                        {resultadoUnitario.cstIbsCbs}
                      </span>
                    </div>

                  </div>

                  {/* GRID 3: REFORMA TRIBUTÁRIA (IBS, CBS & IVA DUAL) */}
                  <div className="p-4 rounded-xl bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <Sparkles size={16} className="text-amber-500" />
                        <span className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                          Reforma Tributária (EC 132/2023 & LC 214/2025):
                        </span>
                        <span className="font-bold text-xs text-amber-900 dark:text-amber-200">
                          {resultadoUnitario.classificacaoReforma}
                        </span>
                      </div>
                      <div className="text-xs font-mono font-extrabold text-amber-900 dark:text-amber-200">
                        IBS: {resultadoUnitario.ibsAliq}% + CBS: {resultadoUnitario.cbsAliq}% = IVA Dual: {resultadoUnitario.ivaDual}%
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {resultadoUnitario.justificativa}
                    </p>
                  </div>

                </div>
              ) : (
                /* FORMULÁRIO DE EDIÇÃO INLINE SE O USUÁRIO DESEJAR AJUSTAR */
                <div className="bg-slate-50 dark:bg-slate-900/80 p-5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
                  <div className="flex items-center justify-between">
                    <h5 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                      <Edit3 size={16} className="text-blue-500" />
                      Ajuste Manual dos Campos Tributários
                    </h5>
                    <span className="text-xs text-slate-400">Altere qualquer campo e clique em Salvar</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 block mb-1">NCM</label>
                      <input
                        type="text"
                        value={formUnitarioEdit.ncm || ''}
                        onChange={(e) => setFormUnitarioEdit({ ...formUnitarioEdit, ncm: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 block mb-1">CEST</label>
                      <input
                        type="text"
                        value={formUnitarioEdit.cest || ''}
                        onChange={(e) => setFormUnitarioEdit({ ...formUnitarioEdit, cest: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 block mb-1">CFOP Interno</label>
                      <input
                        type="text"
                        value={formUnitarioEdit.cfopInterno || ''}
                        onChange={(e) => setFormUnitarioEdit({ ...formUnitarioEdit, cfopInterno: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 block mb-1">CFOP Fora Estado</label>
                      <input
                        type="text"
                        value={formUnitarioEdit.cfopInterestadual || ''}
                        onChange={(e) => setFormUnitarioEdit({ ...formUnitarioEdit, cfopInterestadual: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 block mb-1">CSOSN / CST ICMS</label>
                      <input
                        type="text"
                        value={(resultadoUnitario.crtUtilizado === 1 ? formUnitarioEdit.csosn : formUnitarioEdit.cstIcms) || ''}
                        onChange={(e) => {
                          if (resultadoUnitario.crtUtilizado === 1) {
                            setFormUnitarioEdit({ ...formUnitarioEdit, csosn: e.target.value })
                          } else {
                            setFormUnitarioEdit({ ...formUnitarioEdit, cstIcms: e.target.value })
                          }
                        }}
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 block mb-1">CST PIS / COFINS</label>
                      <input
                        type="text"
                        value={formUnitarioEdit.cstPis || ''}
                        onChange={(e) => setFormUnitarioEdit({ ...formUnitarioEdit, cstPis: e.target.value, cstCofins: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-mono font-bold"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setEditandoUnitario(false)}
                      className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-400"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleSalvarEdicaoUnitario}
                      className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold shadow-xs hover:bg-blue-700"
                    >
                      Salvar Ajustes
                    </button>
                  </div>
                </div>
              )}

            </div>
          )}

        </div>
      )}

      {/* ======================================================== */}
      {/* ABA 2: IMPORTAR PLANILHA OU ARQUIVO TXT                  */}
      {/* ======================================================== */}
      {activeTab === 'arquivo' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#0B1120] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xs">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">
              Importação e Tributação em Lote (.xlsx, .csv, .txt)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
              Arraste ou selecione uma planilha Excel, arquivo CSV ou arquivo de texto TXT contendo uma lista de produtos. O motor inteligente detectará as colunas automaticamente e tributará cada item conforme o CRT do cliente selecionado.
            </p>

            {/* Dropzone */}
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 rounded-2xl p-8 text-center cursor-pointer transition-colors bg-slate-50/50 dark:bg-slate-900/40"
            >
              <input 
                ref={fileInputRef}
                type="file" 
                accept=".xlsx,.xls,.csv,.txt" 
                onChange={handleFileChange}
                className="hidden" 
              />
              <div className="w-14 h-14 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-3">
                <FileSpreadsheet size={28} />
              </div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-white">
                {arquivoCarregado ? arquivoCarregado.name : 'Clique para selecionar a Planilha ou Arquivo TXT'}
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                Formatos suportados: Excel (.xlsx, .xls), CSV (.csv) e Texto (.txt com 1 produto por linha ou delimitado)
              </p>
            </div>

            {/* Pré-visualização dos Itens Carregados */}
            {itensArquivo.length > 0 && (
              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCheck size={18} className="text-emerald-500" />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                      {itensArquivo.length} itens identificados no arquivo
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleProcessarLoteArquivo}
                    disabled={processandoLote}
                    className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold shadow-md transition-all flex items-center gap-2 cursor-pointer"
                  >
                    {processandoLote ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Tributando em Lote...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={16} />
                        <span>Tributar Todos os {itensArquivo.length} Produtos</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Amostra das primeiras 5 linhas */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden text-xs">
                  <div className="bg-slate-100 dark:bg-slate-900 px-4 py-2 font-bold text-slate-600 dark:text-slate-300">
                    Amostra dos produtos carregados:
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-48 overflow-y-auto">
                    {itensArquivo.slice(0, 10).map((i, idx) => (
                      <div key={idx} className="px-4 py-2 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-900/50">
                        <span className="font-semibold text-slate-700 dark:text-slate-200 truncate max-w-md">
                          {i.codigo ? `[${i.codigo}] ` : ''}{i.descricao}
                        </span>
                        <span className="text-slate-400 font-mono">
                          {i.ncm ? `NCM: ${i.ncm}` : 'NCM a preencher'}
                        </span>
                      </div>
                    ))}
                    {itensArquivo.length > 10 && (
                      <div className="px-4 py-2 text-center text-slate-400 italic bg-slate-50/50 dark:bg-slate-900/30">
                        + {itensArquivo.length - 10} outros produtos na lista...
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ABA 3: FOTO COM OCR INTELIGENTE (VISÃO IA)               */}
      {/* ======================================================== */}
      {activeTab === 'ocr' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#0B1120] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xs">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">
              Leitura de Foto com OCR e Visão Computacional por IA
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
              Tire uma foto ou envie uma imagem (etiqueta de preço, gôndola de supermercado, cupom fiscal, nota impressa ou folha de caderno com produtos). A IA lerá todos os itens e criará <strong>formulários editáveis</strong> na tela para você conferir ou ajustar antes da tributação.
            </p>

            {/* Dropzone de Foto */}
            <div 
              onClick={() => fotoInputRef.current?.click()}
              className="border-2 border-dashed border-indigo-300 dark:border-indigo-800 hover:border-indigo-500 rounded-2xl p-8 text-center cursor-pointer transition-colors bg-indigo-50/20 dark:bg-indigo-950/20"
            >
              <input 
                ref={fotoInputRef}
                type="file" 
                accept="image/*" 
                capture="environment"
                onChange={handleFotoChange}
                className="hidden" 
              />
              <div className="w-14 h-14 rounded-2xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-3">
                <Camera size={28} />
              </div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-white">
                Tire uma Foto ou Selecione uma Imagem
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                Suporta fotos de etiquetas, gôndolas, notas fiscais e listas escritas (PNG, JPG, WEBP)
              </p>
            </div>

            {/* Pré-visualização da Imagem e Status */}
            {fotoOcrBase64 && (
              <div className="mt-4 flex items-center gap-4 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                <img 
                  src={fotoOcrBase64} 
                  alt="Foto enviada" 
                  className="w-16 h-16 object-cover rounded-lg border border-slate-200 dark:border-slate-700" 
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    Foto carregada e processada
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {provedorOcr ? `Motor: ${provedorOcr}` : 'Pronto para OCR'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => fotoInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Trocar Foto
                </button>
              </div>
            )}

            {/* FORMULÁRIOS EDITÁVEIS DOS ITENS EXTRAÍDOS PELO OCR */}
            {itensOcrExtraidos.length > 0 && (
              <div className="mt-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                      <ScanText size={18} className="text-blue-500" />
                      Itens Identificados na Imagem ({itensOcrExtraidos.length})
                    </h4>
                    <p className="text-xs text-slate-400">
                      Você pode editar qualquer texto, código ou valor antes de buscar a tributação.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleAdicionarItemOcrManual}
                      className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus size={14} />
                      Adicionar Item
                    </button>
                    <button
                      type="button"
                      onClick={handleTributarItensOcr}
                      disabled={processandoLote}
                      className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Sparkles size={16} />
                      <span>Buscar Tributação dos Itens</span>
                    </button>
                  </div>
                </div>

                {/* Lista de formulários dos itens extraídos */}
                <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                  {itensOcrExtraidos.map((item, index) => (
                    <div 
                      key={item.id} 
                      className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-center gap-3"
                    >
                      <span className="text-xs font-mono font-bold text-slate-400 w-6 text-center">
                        #{index + 1}
                      </span>

                      {/* Código */}
                      <div className="w-full md:w-32">
                        <label className="text-[10px] font-bold text-slate-400 uppercase block md:hidden">Código</label>
                        <input
                          type="text"
                          value={item.codigo}
                          onChange={(e) => handleEditarItemOcr(item.id, 'codigo', e.target.value)}
                          placeholder="Código / Ref"
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono"
                        />
                      </div>

                      {/* Descrição */}
                      <div className="flex-1 w-full">
                        <label className="text-[10px] font-bold text-slate-400 uppercase block md:hidden">Descrição do Produto</label>
                        <input
                          type="text"
                          value={item.descricao}
                          onChange={(e) => handleEditarItemOcr(item.id, 'descricao', e.target.value)}
                          placeholder="Descrição do Produto"
                          className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-800 dark:text-slate-100"
                        />
                      </div>

                      {/* Preço */}
                      <div className="w-full md:w-28">
                        <label className="text-[10px] font-bold text-slate-400 uppercase block md:hidden">Preço (R$)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={item.valor || ''}
                          onChange={(e) => handleEditarItemOcr(item.id, 'valor', parseFloat(e.target.value) || 0)}
                          placeholder="R$ 0,00"
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold"
                        />
                      </div>

                      {/* Botão Excluir */}
                      <button
                        type="button"
                        onClick={() => handleExcluirItemOcr(item.id)}
                        className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
                        title="Remover este item"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>

              </div>
            )}

          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. TABELA CENTRAL DE PRODUTOS TOTALMENTE TRIBUTADOS       */}
      {/* ======================================================== */}
      <div className="bg-white dark:bg-[#0B1120] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xs space-y-5">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                Tabela Consolidada de Produtos Tributados
              </h3>
              <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                {tabelaTributada.length} Itens
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Resultados completos com NCM, CEST, CFOPs (interno e interestadual), CSOSN/CST e Reforma Tributária.
            </p>
          </div>

          {/* Botões de Ação e Download */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={exportarExcel}
              disabled={tabelaTributada.length === 0}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet size={15} />
              <span>Baixar Excel (.xlsx)</span>
            </button>

            <button
              type="button"
              onClick={exportarCsv}
              disabled={tabelaTributada.length === 0}
              className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 text-xs font-bold text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <FileDown size={15} />
              <span>CSV</span>
            </button>

            <button
              type="button"
              onClick={exportarTxt}
              disabled={tabelaTributada.length === 0}
              className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 text-xs font-bold text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <FileText size={15} />
              <span>TXT para ERP</span>
            </button>

            {tabelaTributada.length > 0 && (
              <button
                type="button"
                onClick={limparTabela}
                className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                title="Limpar Tabela"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Barra de Filtros e Busca na Tabela */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          {/* Campo de Busca Rápida */}
          <div className="relative w-full sm:w-80">
            <input
              type="text"
              value={buscaTabela}
              onChange={(e) => setBuscaTabela(e.target.value)}
              placeholder="Filtrar por produto, NCM, CEST, CFOP..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none"
            />
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
          </div>

          {/* Filtros Rápidos */}
          <div className="flex items-center gap-1.5 self-start sm:self-auto flex-wrap">
            <button
              type="button"
              onClick={() => setFiltroTabela('todos')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                filtroTabela === 'todos' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              Todos ({tabelaTributada.length})
            </button>
            <button
              type="button"
              onClick={() => setFiltroTabela('monofasicos')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                filtroTabela === 'monofasicos' 
                  ? 'bg-purple-600 text-white' 
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              Monofásicos PIS/COFINS
            </button>
            <button
              type="button"
              onClick={() => setFiltroTabela('st')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                filtroTabela === 'st' 
                  ? 'bg-amber-600 text-white' 
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              Com Substituição Tributária (ST)
            </button>
            <button
              type="button"
              onClick={() => setFiltroTabela('cesta_basica')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                filtroTabela === 'cesta_basica' 
                  ? 'bg-emerald-600 text-white' 
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              Cesta Básica (Alíquota Zero)
            </button>
          </div>
        </div>

        {/* Tabela de Produtos */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs" style={{ tableLayout: 'fixed' }}>
              <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase tracking-wider font-bold text-[10px]">
                <tr>
                  <ResizableSortableTh
                    columnId="produto"
                    label="Produto"
                    sortKey="produto"
                    currentSortKey={sortKey}
                    currentSortDirection={sortDirection}
                    onSort={handleSort}
                    width={columnWidths.produto}
                    onResize={handleResizeColumn}
                    minWidth={160}
                  />
                  <ResizableSortableTh
                    columnId="ncm"
                    label="NCM"
                    sortKey="ncm"
                    currentSortKey={sortKey}
                    currentSortDirection={sortDirection}
                    onSort={handleSort}
                    width={columnWidths.ncm}
                    onResize={handleResizeColumn}
                    minWidth={90}
                  />
                  <ResizableSortableTh
                    columnId="cest"
                    label="CEST"
                    sortKey="cest"
                    currentSortKey={sortKey}
                    currentSortDirection={sortDirection}
                    onSort={handleSort}
                    width={columnWidths.cest}
                    onResize={handleResizeColumn}
                    minWidth={90}
                  />
                  <ResizableSortableTh
                    columnId="cfopInterno"
                    label="CFOP Interno"
                    sortKey="cfopInterno"
                    currentSortKey={sortKey}
                    currentSortDirection={sortDirection}
                    onSort={handleSort}
                    width={columnWidths.cfopInterno}
                    onResize={handleResizeColumn}
                    minWidth={95}
                    align="center"
                  />
                  <ResizableSortableTh
                    columnId="cfopInterestadual"
                    label="CFOP Interestadual"
                    sortKey="cfopInterestadual"
                    currentSortKey={sortKey}
                    currentSortDirection={sortDirection}
                    onSort={handleSort}
                    width={columnWidths.cfopInterestadual}
                    onResize={handleResizeColumn}
                    minWidth={110}
                    align="center"
                  />
                  <ResizableSortableTh
                    columnId="icms"
                    label={crt === 1 ? 'CSOSN' : 'CST ICMS'}
                    sortKey="icms"
                    currentSortKey={sortKey}
                    currentSortDirection={sortDirection}
                    onSort={handleSort}
                    width={columnWidths.icms}
                    onResize={handleResizeColumn}
                    minWidth={95}
                    align="center"
                  />
                  <ResizableSortableTh
                    columnId="pisCofins"
                    label="PIS / COFINS"
                    sortKey="pisCofins"
                    currentSortKey={sortKey}
                    currentSortDirection={sortDirection}
                    onSort={handleSort}
                    width={columnWidths.pisCofins}
                    onResize={handleResizeColumn}
                    minWidth={110}
                    align="center"
                  />
                  <ResizableSortableTh
                    columnId="reforma"
                    label="IBS + CBS (Reforma)"
                    sortKey="reforma"
                    currentSortKey={sortKey}
                    currentSortDirection={sortDirection}
                    onSort={handleSort}
                    width={columnWidths.reforma}
                    onResize={handleResizeColumn}
                    minWidth={120}
                    align="center"
                  />
                  <ResizableSortableTh
                    columnId="acoes"
                    label="Ações"
                    disableSort
                    width={columnWidths.acoes}
                    onResize={handleResizeColumn}
                    minWidth={90}
                    align="right"
                  />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {itensOrdenados.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-400 italic">
                      Nenhum produto cadastrado na tabela. Digite um produto acima, envie uma planilha ou tire uma foto para tributar!
                    </td>
                  </tr>
                ) : (
                  itensOrdenados.map((item) => (
                    <tr 
                      key={item.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-900/40 transition-colors"
                    >
                      {/* Descrição do Produto */}
                      <td className="px-4 py-3 max-w-xs">
                        <div className="font-bold text-slate-800 dark:text-slate-100 truncate">
                          {item.descricao}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {item.codigo ? `Cód: ${item.codigo}` : 'S/ Cód'} • R$ {item.valor.toFixed(2)}
                        </div>
                      </td>

                      {/* NCM */}
                      <td className="px-3 py-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                        {item.ncm}
                      </td>

                      {/* CEST */}
                      <td className="px-3 py-3 font-mono text-slate-600 dark:text-slate-400">
                        {item.cest || '-'}
                      </td>

                      {/* CFOP Interno */}
                      <td className="px-3 py-3 text-center">
                        <span className="inline-block px-2 py-0.5 rounded-md font-mono font-bold bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                          {item.cfopInterno}
                        </span>
                      </td>

                      {/* CFOP Interestadual */}
                      <td className="px-3 py-3 text-center">
                        <span className="inline-block px-2 py-0.5 rounded-md font-mono font-bold bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                          {item.cfopInterestadual}
                        </span>
                      </td>

                      {/* CSOSN ou CST ICMS */}
                      <td className="px-3 py-3 text-center font-mono font-bold text-slate-800 dark:text-slate-200">
                        {item.crtUtilizado === 1 ? item.csosn : item.cstIcms}
                      </td>

                      {/* PIS / COFINS */}
                      <td className="px-3 py-3 text-center">
                        {item.isMonofasico ? (
                          <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                            CST 04 (Mono)
                          </span>
                        ) : (
                          <span className="text-slate-500 font-mono">
                            CST {item.cstPis}
                          </span>
                        )}
                      </td>

                      {/* IBS + CBS */}
                      <td className="px-3 py-3 text-center font-mono font-bold text-amber-700 dark:text-amber-400">
                        {item.ivaDual}%
                      </td>

                      {/* Ações */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setModalItemDetalhe(item)}
                            className="p-1 text-slate-400 hover:text-blue-600 rounded transition-colors"
                            title="Ver Detalhes e Justificativa"
                          >
                            <Info size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => removerDaTabela(item.id)}
                            className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                            title="Remover"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* MODAL DE DETALHES E FUNDAMENTAÇÃO LEGAL DO PRODUTO */}
      {modalItemDetalhe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#0B1120] rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h4 className="font-bold text-slate-800 dark:text-white text-base">
                Fundamentação Fiscal & Detalhes
              </h4>
              <button 
                type="button"
                onClick={() => setModalItemDetalhe(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={18} />
              </button>
            </div>

            <div>
              <div className="text-sm font-black text-slate-900 dark:text-white">
                {modalItemDetalhe.descricao}
              </div>
              <div className="text-xs text-slate-400 font-mono mt-0.5">
                NCM: {modalItemDetalhe.ncm} • CEST: {modalItemDetalhe.cest || 'Sem ST'}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">CFOP Interno:</span>
                <span className="font-bold text-blue-600">{modalItemDetalhe.cfopInterno}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">CFOP Interestadual:</span>
                <span className="font-bold text-indigo-600">{modalItemDetalhe.cfopInterestadual}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">CSOSN / CST ICMS:</span>
                <span className="font-bold">{modalItemDetalhe.csosn || modalItemDetalhe.cstIcms}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Reforma (IVA Dual):</span>
                <span className="font-bold text-amber-600">{modalItemDetalhe.ivaDual}%</span>
              </div>
            </div>

            <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 rounded-xl border border-blue-200 dark:border-blue-900/50 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              <strong>Justificativa Técnica:</strong>
              <p className="mt-1">{modalItemDetalhe.justificativa}</p>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setModalItemDetalhe(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
