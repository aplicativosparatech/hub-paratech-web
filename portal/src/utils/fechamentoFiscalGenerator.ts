import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import JSZip from 'jszip'
import { isNcmMonofasico, formatarNcm, identificarDescricaoNcm } from '@/utils/ncmMonofasicos'
import { FUSO_BRASIL, parseDateUtc } from '@/utils/dateBrasil'

export interface DadosEmpresaFechamento {
  razao_social: string
  nome_fantasia?: string
  cnpj: string
  regime_tributario?: string
  contabilidade_nome?: string
  cidade?: string
  uf?: string
}

export interface DocumentoFiscalFechamento {
  id?: string
  numero: string
  serie?: string
  data_emissao: string
  data_entrada?: string
  contato_nome: string // Fornecedor, Prestador, Tomador ou Destinatário/Consumidor
  cidade?: string
  uf?: string
  valor: number
  chave: string
  modalidade: 'nfe_entradas' | 'nfse_entradas' | 'nfe_saidas' | 'nfse_saidas' | 'nfce_saidas'
  storage_path?: string
  conteudo_xml?: string
}

export interface ItemProdutoFechamento {
  numero_nota: string
  data_hora: string
  produto_nome: string
  codigo_prod?: string
  ncm: string
  cst_pis_cofins: string
  aliquota_pis?: number
  aliquota_cofins?: number
  quantidade: number
  valor_unitario: number
  valor_total: number
  is_monofasico: boolean
}

export interface ItemAgrupadoFechamento {
  produto_nome: string
  ncm: string
  cst_pis_cofins: string
  quantidade_total: number
  valor_total: number
  is_monofasico: boolean
}

export interface FechamentoPreferencias {
  // Relatórios selecionados
  relNfeEntrada: boolean
  relNfseEntrada: boolean
  relNfeSaida: boolean
  relNfseSaida: boolean
  relNfceSaida: boolean
  relMonofasicos: boolean

  // Local dos relatórios no ZIP
  localRelatorios: 'pasta_relatorios' | 'pasta_modalidade'

  // Ordenação
  ordenacao: 'data' | 'numero' | 'contato'

  // Formatos selecionados
  formatos: Array<'pdf' | 'xlsx' | 'csv' | 'json'>

  // Configuração de Monofásicos
  monofasicosEscopo: 'apenas_monofasicos' | 'todos_produtos'
  monofasicosTipo: 'detalhado' | 'agrupado'

  // Envio Automático Mensal Recorrente
  envioAutomaticoAtivo: boolean
  envioDiaMes: number | string
  envioWhatsapp: string
  envioEmail: string
}

export const PREFERENCIAS_FECHAMENTO_PADRAO: FechamentoPreferencias = {
  relNfeEntrada: true,
  relNfseEntrada: true,
  relNfeSaida: true,
  relNfseSaida: true,
  relNfceSaida: true,
  relMonofasicos: true,
  localRelatorios: 'pasta_relatorios',
  ordenacao: 'data',
  formatos: ['pdf', 'xlsx'],
  monofasicosEscopo: 'apenas_monofasicos',
  monofasicosTipo: 'detalhado',
  envioAutomaticoAtivo: false,
  envioDiaMes: 5,
  envioWhatsapp: '',
  envioEmail: ''
}

export function formatMoney(val: number): string {
  return (val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function formatDate(dateStr?: string): string {
  if (!dateStr) return '—'
  try {
    const d = parseDateUtc(dateStr)
    if (!d) return dateStr
    return d.toLocaleDateString('pt-BR', { timeZone: FUSO_BRASIL })
  } catch {
    return dateStr
  }
}

export function formatDateTime(dateStr?: string): string {
  if (!dateStr) return '—'
  try {
    const d = parseDateUtc(dateStr)
    if (!d) return dateStr
    const dataFmt = d.toLocaleDateString('pt-BR', { timeZone: FUSO_BRASIL })
    const horaFmt = d.toLocaleTimeString('pt-BR', { timeZone: FUSO_BRASIL, hour: '2-digit', minute: '2-digit' })
    return `${dataFmt} ${horaFmt}`
  } catch {
    return dateStr
  }
}

// Ordena documentos conforme critério selecionado
export function ordenarDocumentos(docs: DocumentoFiscalFechamento[], criterio: 'data' | 'numero' | 'contato'): DocumentoFiscalFechamento[] {
  return [...docs].sort((a, b) => {
    if (criterio === 'data') {
      const timeA = new Date(a.data_emissao).getTime() || 0
      const timeB = new Date(b.data_emissao).getTime() || 0
      return timeA - timeB
    }
    if (criterio === 'numero') {
      const numA = parseInt(String(a.numero || '').replace(/\D/g, '')) || 0
      const numB = parseInt(String(b.numero || '').replace(/\D/g, '')) || 0
      return numA - numB
    }
    if (criterio === 'contato') {
      return (a.contato_nome || '').localeCompare(b.contato_nome || '', 'pt-BR')
    }
    return 0
  })
}

// Ordena itens de produtos
export function ordenarItens(itens: ItemProdutoFechamento[], criterio: 'data' | 'numero' | 'contato'): ItemProdutoFechamento[] {
  return [...itens].sort((a, b) => {
    if (criterio === 'data') {
      const timeA = new Date(a.data_hora).getTime() || 0
      const timeB = new Date(b.data_hora).getTime() || 0
      return timeA - timeB
    }
    if (criterio === 'numero') {
      const numA = parseInt(String(a.numero_nota || '').replace(/\D/g, '')) || 0
      const numB = parseInt(String(b.numero_nota || '').replace(/\D/g, '')) || 0
      return numA - numB
    }
    if (criterio === 'contato') {
      return (a.produto_nome || '').localeCompare(b.produto_nome || '', 'pt-BR')
    }
    return 0
  })
}

// Agrupa produtos por NCM e Nome
export function agruparProdutos(itens: ItemProdutoFechamento[]): ItemAgrupadoFechamento[] {
  const map = new Map<string, ItemAgrupadoFechamento>()

  for (const it of itens) {
    const key = `${it.ncm}_${it.produto_nome.trim().toUpperCase()}`
    const exist = map.get(key)
    if (exist) {
      exist.quantidade_total += it.quantidade
      exist.valor_total += it.valor_total
    } else {
      map.set(key, {
        produto_nome: it.produto_nome,
        ncm: it.ncm,
        cst_pis_cofins: it.cst_pis_cofins,
        quantidade_total: it.quantidade,
        valor_total: it.valor_total,
        is_monofasico: it.is_monofasico
      })
    }
  }

  return Array.from(map.values()).sort((a, b) => a.produto_nome.localeCompare(b.produto_nome, 'pt-BR'))
}

// Helper para extrair tags simples de XML
export function extractXmlTag(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`))
  return m ? m[1].trim() : ''
}

// Extrai itens de produto e seus tributos de uma string XML
export function extractItensFromXml(xml: string, numeroNota: string, dataHora: string): ItemProdutoFechamento[] {
  const itens: ItemProdutoFechamento[] = []
  const dets = xml.match(/<det[^>]*>[\s\S]*?<\/det>/g) || []

  for (const det of dets) {
    const cProd = extractXmlTag(det, 'cProd') || ''
    const xProd = extractXmlTag(det, 'xProd') || 'Produto sem descrição'
    const ncm = extractXmlTag(det, 'NCM') || ''
    const qCom = parseFloat(extractXmlTag(det, 'qCom') || '1') || 1
    const vUnCom = parseFloat(extractXmlTag(det, 'vUnCom') || '0') || 0
    const vProd = parseFloat(extractXmlTag(det, 'vProd') || '0') || (qCom * vUnCom)

    // PIS e COFINS
    let cst = extractXmlTag(det, 'CST') || ''
    const pPis = parseFloat(extractXmlTag(det, 'pPIS') || '0')
    const pCofins = parseFloat(extractXmlTag(det, 'pCOFINS') || '0')

    const ncmCheck = isNcmMonofasico(ncm)
    const isMonofasico = /^(04|06)$/.test(cst) || ncmCheck.isMonofasico

    if (!cst) {
      cst = isMonofasico ? '04' : '01'
    }

    itens.push({
      numero_nota: numeroNota,
      data_hora: dataHora,
      produto_nome: xProd,
      codigo_prod: cProd,
      ncm,
      cst_pis_cofins: cst,
      aliquota_pis: pPis,
      aliquota_cofins: pCofins,
      quantidade: qCom,
      valor_unitario: vUnCom,
      valor_total: vProd,
      is_monofasico: isMonofasico
    })
  }

  return itens
}

export interface ArquivoGerado {
  nomeArquivo: string
  buffer: Uint8Array | string
  tipo: 'pdf' | 'xlsx' | 'csv' | 'json'
  modalidade: string // 'NFE_Entradas' | 'NFSE_Entradas' | 'NFE_Saidas' | 'NFSE_Saidas' | 'NFCE_Saidas' | 'Relatorios'
}

// ============================================================================
// MOTOR DE LAYOUT PDF FISCAL DE ALTO PADRÃO EXECUTIVO (HUB PARATECH)
// ============================================================================
export interface ConfigPdfFiscal {
  titulo: string
  subtitulo?: string
  empresa: DadosEmpresaFechamento
  competencia: string
  totalItens: number
  valorTotal: number
  valorMonofasicos?: number
  colunas: string[]
  linhas: (string | number)[][]
  colunasAlinhadasDireita?: number[]
  orientacao?: 'landscape' | 'portrait'
}

export function gerarDocumentoPdfFiscal(cfg: ConfigPdfFiscal): Uint8Array {
  const orientacao = cfg.orientacao || 'landscape'
  const doc = new jsPDF({ orientation: orientacao, unit: 'mm', format: 'a4' })
  const isLandscape = orientacao === 'landscape'
  const pageWidth = isLandscape ? 297 : 210
  const pageHeight = isLandscape ? 210 : 297
  const margem = 14
  const contentWidth = pageWidth - (margem * 2)

  // 1. Banner Superior Executivo Escuro (Slate-900 / High-Tech Corporativo)
  doc.setFillColor(15, 23, 42) // Slate 900
  doc.roundedRect(margem, 9, contentWidth, 17, 2, 2, 'F')

  // Título e identificação fiscal
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.setTextColor(255, 255, 255)
  doc.text(cfg.titulo.toUpperCase(), margem + 5, 15.5)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(203, 213, 225) // Slate 300
  const compLabel = cfg.competencia ? `Competência: ${cfg.competencia}` : ''
  const cnpjClean = cfg.empresa.cnpj || '—'
  const cidadeUf = cfg.empresa.cidade ? ` • ${cfg.empresa.cidade}/${cfg.empresa.uf || ''}` : ''
  doc.text(
    `${cfg.empresa.razao_social || 'Empresa'}  |  CNPJ: ${cnpjClean}${cidadeUf}  |  ${compLabel}`,
    margem + 5,
    21.5
  )

  // Identificação do sistema à direita
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(129, 140, 248) // Indigo 400
  doc.text('HUB PARATECH', margem + contentWidth - 5, 15.5, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(148, 163, 184)
  doc.text('Inteligência Contábil & Fiscal', margem + contentWidth - 5, 21.5, { align: 'right' })

  // 2. Quadro de Resumo Executivo (NO INÍCIO - Exatamente como solicitado pelo usuário!)
  // Cards: TOTAL DE ITENS, VALOR TOTAL MOVIMENTADO, TOTAL PRODUTOS MONOFÁSICOS
  const cardY = 29
  const cardHeight = 13.5
  const numCards = 3
  const cardGap = 3
  const cardWidth = (contentWidth - ((numCards - 1) * cardGap)) / numCards

  // Card 1: TOTAL DE DOCUMENTOS / ITENS
  doc.setFillColor(248, 250, 252) // Slate 50
  doc.setDrawColor(226, 232, 240) // Slate 200
  doc.setLineWidth(0.25)
  doc.roundedRect(margem, cardY, cardWidth, cardHeight, 1.5, 1.5, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.5)
  doc.setTextColor(100, 116, 139) // Slate 500
  doc.text('TOTAL DE DOCUMENTOS / ITENS', margem + 3.5, cardY + 4.5)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(15, 23, 42)
  doc.text(`${cfg.totalItens} ${cfg.totalItens === 1 ? 'registro' : 'registros'}`, margem + 3.5, cardY + 10.5)

  // Card 2: VALOR TOTAL MOVIMENTADO
  const card2X = margem + cardWidth + cardGap
  doc.setFillColor(248, 250, 252)
  doc.roundedRect(card2X, cardY, cardWidth, cardHeight, 1.5, 1.5, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.5)
  doc.setTextColor(100, 116, 139)
  doc.text('VALOR TOTAL MOVIMENTADO', card2X + 3.5, cardY + 4.5)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(16, 115, 60) // Verde escuro
  doc.text(`R$ ${formatMoney(cfg.valorTotal)}`, card2X + 3.5, cardY + 10.5)

  // Card 3: PRODUTOS MONOFÁSICOS (PIS/COFINS)
  const card3X = card2X + cardWidth + cardGap
  doc.setFillColor(248, 250, 252)
  doc.roundedRect(card3X, cardY, cardWidth, cardHeight, 1.5, 1.5, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.5)
  doc.setTextColor(100, 116, 139)
  doc.text('TOTAL PRODUTOS MONOFÁSICOS', card3X + 3.5, cardY + 4.5)

  doc.setFont('helvetica', 'bold')
  const valMono = cfg.valorMonofasicos !== undefined ? cfg.valorMonofasicos : 0
  if (valMono > 0) {
    doc.setTextColor(180, 83, 9)
  } else {
    doc.setTextColor(71, 85, 105)
  }
  doc.text(`R$ ${formatMoney(valMono)}`, card3X + 3.5, cardY + 10.5)

  // 3. Tabela de Dados (autoTable)
  let bodyData = cfg.linhas
  if (bodyData.length === 0) {
    const emptyRow = new Array(cfg.colunas.length).fill('')
    emptyRow[0] = 'Nenhum documento registrado para esta modalidade nesta competência (Sem Movimento no Período).'
    bodyData = [emptyRow]
  }

  const columnStylesConfig: any = {}
  if (cfg.colunasAlinhadasDireita) {
    cfg.colunasAlinhadasDireita.forEach(idx => {
      columnStylesConfig[idx] = { halign: 'right' }
    })
  }

  // Linha de rodapé consolidada: EXIBIDA EXCLUSIVAMENTE NA ÚLTIMA PÁGINA (showFoot: 'lastPage')
  // Nunca mais repete o valor total em todas as páginas!
  const footRow = new Array(cfg.colunas.length).fill('')
  let valorColIdx = cfg.colunas.findIndex(c => c.toLowerCase().includes('valor') || c.toLowerCase().includes('total'))
  if (valorColIdx < 0) valorColIdx = cfg.colunas.length - 2
  if (valorColIdx > 0) {
    footRow[valorColIdx - 1] = 'TOTAL FINAL:'
    footRow[valorColIdx] = `R$ ${formatMoney(cfg.valorTotal)}`
  } else {
    footRow[0] = 'TOTAL FINAL:'
    footRow[footRow.length - 1] = `R$ ${formatMoney(cfg.valorTotal)}`
  }

  autoTable(doc, {
    startY: 46,
    margin: { left: margem, right: margem, bottom: 12 },
    head: [cfg.colunas],
    body: bodyData,
    foot: [footRow],
    showFoot: 'lastPage', // REGRA DE OURO: Total APENAS na última página!
    styles: {
      fontSize: 7.2,
      cellPadding: 1.8,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
      font: 'helvetica'
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'left'
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 7.8
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    columnStyles: columnStylesConfig
  })

  // 4. Numeração e Rodapé Limpo em todas as páginas
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.8)
    doc.setTextColor(148, 163, 184)
    doc.setDrawColor(226, 232, 240)
    doc.line(margem, pageHeight - 7, margem + contentWidth, pageHeight - 7)
    
    doc.text(
      `HUB PARATECH • Relatório Fiscal Oficial para Escrituração Contábil • Gerado em ${new Date().toLocaleDateString('pt-BR')}`,
      margem,
      pageHeight - 3.5
    )
    doc.text(`Página ${i} de ${totalPages}`, margem + contentWidth, pageHeight - 3.5, { align: 'right' })
  }

  return new Uint8Array(doc.output('arraybuffer'))
}

// GERAÇÃO DE RELATÓRIO 1: Resumo de Documentos Fiscais Recebidos (Compras NF-e)
// Colunas: Número da nota, Data da nota, Data na entrada, Fornecedor, Cidade/Estado, Valor, Chave da nota, Total Geral
export function gerarRelatorioNfeCompras(
  docs: DocumentoFiscalFechamento[],
  empresa: DadosEmpresaFechamento,
  competencia: string,
  formatos: Array<'pdf' | 'xlsx' | 'csv' | 'json'>,
  ordenacao: 'data' | 'numero' | 'contato'
): ArquivoGerado[] {
  const lista = ordenarDocumentos(docs, ordenacao)
  const totalGeral = lista.reduce((acc, d) => acc + (d.valor || 0), 0)
  const titulo = 'Resumo de Documentos Fiscais Recebidos (Compras - NF-e)'
  const baseName = `Relatorio_Compras_NFe_${competencia.replace('-', '_')}`
  const resultados: ArquivoGerado[] = []

  // CSV
  if (formatos.includes('csv')) {
    let csv = '\uFEFF'
    csv += `RELATÓRIO FISCAL;${titulo}\r\n`
    csv += `EMPRESA;${empresa.razao_social};CNPJ;${empresa.cnpj};COMPETENCIA;${competencia}\r\n`
    csv += `TOTAL DE ITENS;${lista.length};VALOR TOTAL;${totalGeral.toFixed(2).replace('.', ',')}\r\n\r\n`
    csv += 'NUMERO;DATA DA NOTA;DATA ENTRADA;FORNECEDOR;CIDADE/UF;VALOR (R$);CHAVE DA NOTA\r\n'
    lista.forEach(d => {
      csv += `${d.numero || '—'};${formatDate(d.data_emissao)};${formatDate(d.data_entrada || d.data_emissao)};"${(d.contato_nome || '—').replace(/"/g, '""')}";${d.cidade || '—'}/${d.uf || '—'};${(d.valor || 0).toFixed(2).replace('.', ',')};${d.chave || '—'}\r\n`
    })
    csv += `;;;;TOTAL GERAL;${totalGeral.toFixed(2).replace('.', ',')};\r\n`
    resultados.push({
      nomeArquivo: `${baseName}.csv`,
      buffer: csv,
      tipo: 'csv',
      modalidade: 'NFE_Entradas'
    })
  }

  // JSON
  if (formatos.includes('json')) {
    const jsonStr = JSON.stringify({
      titulo,
      empresa,
      competencia,
      gerado_em: new Date().toISOString(),
      resumo_executivo: {
        total_documentos: lista.length,
        valor_total: totalGeral,
        total_monofasicos: 0
      },
      documentos: lista.map(d => ({
        numero: d.numero,
        data_nota: d.data_emissao,
        data_entrada: d.data_entrada || d.data_emissao,
        fornecedor: d.contato_nome,
        cidade: d.cidade,
        uf: d.uf,
        valor: d.valor,
        chave: d.chave
      }))
    }, null, 2)
    resultados.push({
      nomeArquivo: `${baseName}.json`,
      buffer: jsonStr,
      tipo: 'json',
      modalidade: 'NFE_Entradas'
    })
  }

  // EXCEL (XLSX)
  if (formatos.includes('xlsx')) {
    const wb = XLSX.utils.book_new()
    const rows = [
      ['RELATÓRIO FISCAL:', titulo],
      ['EMPRESA:', empresa.razao_social, 'CNPJ:', empresa.cnpj, 'COMPETÊNCIA:', competencia],
      [],
      ['RESUMO EXECUTIVO:'],
      ['TOTAL DE DOCUMENTOS:', lista.length, 'VALOR TOTAL APURADO (R$):', totalGeral, 'MONOFÁSICOS (R$):', 0],
      [],
      ['Número da Nota', 'Data da Nota', 'Data Entrada', 'Fornecedor', 'Cidade / UF', 'Valor (R$)', 'Chave da Nota'],
      ...lista.map(d => [
        d.numero || '—',
        formatDate(d.data_emissao),
        formatDate(d.data_entrada || d.data_emissao),
        d.contato_nome || '—',
        `${d.cidade || '—'} / ${d.uf || '—'}`,
        d.valor || 0,
        d.chave || '—'
      ]),
      ['', '', '', '', 'TOTAL GERAL:', totalGeral, '']
    ]
    const ws = XLSX.utils.aoa_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, ws, 'Compras_NFe')
    const xlsxBuf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
    resultados.push({
      nomeArquivo: `${baseName}.xlsx`,
      buffer: new Uint8Array(xlsxBuf),
      tipo: 'xlsx',
      modalidade: 'NFE_Entradas'
    })
  }

  // PDF PROFISSIONAL COM RESUMO NO INÍCIO E TOTAL APENAS NO FINAL
  if (formatos.includes('pdf')) {
    const colunas = ['Número', 'Data Nota', 'Data Entrada', 'Fornecedor', 'Cidade/UF', 'Valor', 'Chave de Acesso']
    const linhas = lista.map(d => [
      d.numero || '—',
      formatDate(d.data_emissao),
      formatDate(d.data_entrada || d.data_emissao),
      (d.contato_nome || '—').slice(0, 36),
      `${d.cidade || '—'}/${d.uf || '—'}`,
      `R$ ${formatMoney(d.valor)}`,
      (d.chave || '—').slice(0, 30) + (d.chave && d.chave.length > 30 ? '...' : '')
    ])

    const pdfBuffer = gerarDocumentoPdfFiscal({
      titulo,
      empresa,
      competencia,
      totalItens: lista.length,
      valorTotal: totalGeral,
      valorMonofasicos: 0,
      colunas,
      linhas,
      colunasAlinhadasDireita: [5],
      orientacao: 'landscape'
    })

    resultados.push({
      nomeArquivo: `${baseName}.pdf`,
      buffer: pdfBuffer,
      tipo: 'pdf',
      modalidade: 'NFE_Entradas'
    })
  }

  return resultados
}

// GERAÇÃO DE RELATÓRIO 2: Resumo de Documentos Fiscais de Serviços Recebidos (NFS-e de Entrada)
// Colunas: Número da nota, Data da nota, Data na entrada, Prestador, Cidade/Estado, Valor, Chave/Código, Total Geral
export function gerarRelatorioNfseEntrada(
  docs: DocumentoFiscalFechamento[],
  empresa: DadosEmpresaFechamento,
  competencia: string,
  formatos: Array<'pdf' | 'xlsx' | 'csv' | 'json'>,
  ordenacao: 'data' | 'numero' | 'contato'
): ArquivoGerado[] {
  const lista = ordenarDocumentos(docs, ordenacao)
  const totalGeral = lista.reduce((acc, d) => acc + (d.valor || 0), 0)
  const titulo = 'Resumo de Serviços Recebidos (NFS-e Tomados)'
  const baseName = `Relatorio_Servicos_Recebidos_NFSe_${competencia.replace('-', '_')}`
  const resultados: ArquivoGerado[] = []

  // CSV
  if (formatos.includes('csv')) {
    let csv = '\uFEFF'
    csv += `RELATÓRIO FISCAL;${titulo}\r\n`
    csv += `EMPRESA;${empresa.razao_social};CNPJ;${empresa.cnpj};COMPETENCIA;${competencia}\r\n`
    csv += `TOTAL DE ITENS;${lista.length};VALOR TOTAL;${totalGeral.toFixed(2).replace('.', ',')}\r\n\r\n`
    csv += 'NUMERO;DATA DA NOTA;DATA ENTRADA;PRESTADOR;CIDADE/UF;VALOR (R$);CHAVE/CODIGO\r\n'
    lista.forEach(d => {
      csv += `${d.numero || '—'};${formatDate(d.data_emissao)};${formatDate(d.data_entrada || d.data_emissao)};"${(d.contato_nome || '—').replace(/"/g, '""')}";${d.cidade || '—'}/${d.uf || '—'};${(d.valor || 0).toFixed(2).replace('.', ',')};${d.chave || '—'}\r\n`
    })
    csv += `;;;;TOTAL GERAL;${totalGeral.toFixed(2).replace('.', ',')};\r\n`
    resultados.push({
      nomeArquivo: `${baseName}.csv`,
      buffer: csv,
      tipo: 'csv',
      modalidade: 'NFSE_Entradas'
    })
  }

  // JSON
  if (formatos.includes('json')) {
    const jsonStr = JSON.stringify({
      titulo,
      empresa,
      competencia,
      gerado_em: new Date().toISOString(),
      resumo_executivo: {
        total_documentos: lista.length,
        valor_total: totalGeral,
        total_monofasicos: 0
      },
      documentos: lista.map(d => ({
        numero: d.numero,
        data_nota: d.data_emissao,
        data_entrada: d.data_entrada || d.data_emissao,
        prestador: d.contato_nome,
        cidade: d.cidade,
        uf: d.uf,
        valor: d.valor,
        chave: d.chave
      }))
    }, null, 2)
    resultados.push({
      nomeArquivo: `${baseName}.json`,
      buffer: jsonStr,
      tipo: 'json',
      modalidade: 'NFSE_Entradas'
    })
  }

  // EXCEL
  if (formatos.includes('xlsx')) {
    const wb = XLSX.utils.book_new()
    const rows = [
      ['RELATÓRIO FISCAL:', titulo],
      ['EMPRESA:', empresa.razao_social, 'CNPJ:', empresa.cnpj, 'COMPETÊNCIA:', competencia],
      [],
      ['RESUMO EXECUTIVO:'],
      ['TOTAL DE DOCUMENTOS:', lista.length, 'VALOR TOTAL APURADO (R$):', totalGeral, 'MONOFÁSICOS (R$):', 0],
      [],
      ['Número da Nota', 'Data da Nota', 'Data Entrada', 'Prestador', 'Cidade / UF', 'Valor (R$)', 'Chave / Código'],
      ...lista.map(d => [
        d.numero || '—',
        formatDate(d.data_emissao),
        formatDate(d.data_entrada || d.data_emissao),
        d.contato_nome || '—',
        `${d.cidade || '—'} / ${d.uf || '—'}`,
        d.valor || 0,
        d.chave || '—'
      ]),
      ['', '', '', '', 'TOTAL GERAL:', totalGeral, '']
    ]
    const ws = XLSX.utils.aoa_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, ws, 'Servicos_NFSe')
    const xlsxBuf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
    resultados.push({
      nomeArquivo: `${baseName}.xlsx`,
      buffer: new Uint8Array(xlsxBuf),
      tipo: 'xlsx',
      modalidade: 'NFSE_Entradas'
    })
  }

  // PDF PROFISSIONAL COM RESUMO NO INÍCIO E TOTAL APENAS NO FINAL
  if (formatos.includes('pdf')) {
    const colunas = ['Número', 'Data Nota', 'Data Entrada', 'Prestador', 'Cidade/UF', 'Valor', 'Chave/Código']
    const linhas = lista.map(d => [
      d.numero || '—',
      formatDate(d.data_emissao),
      formatDate(d.data_entrada || d.data_emissao),
      (d.contato_nome || '—').slice(0, 36),
      `${d.cidade || '—'}/${d.uf || '—'}`,
      `R$ ${formatMoney(d.valor)}`,
      (d.chave || '—').slice(0, 30) + (d.chave && d.chave.length > 30 ? '...' : '')
    ])

    const pdfBuffer = gerarDocumentoPdfFiscal({
      titulo,
      empresa,
      competencia,
      totalItens: lista.length,
      valorTotal: totalGeral,
      valorMonofasicos: 0,
      colunas,
      linhas,
      colunasAlinhadasDireita: [5],
      orientacao: 'landscape'
    })

    resultados.push({
      nomeArquivo: `${baseName}.pdf`,
      buffer: pdfBuffer,
      tipo: 'pdf',
      modalidade: 'NFSE_Entradas'
    })
  }

  return resultados
}

// GERAÇÃO DE RELATÓRIO 3: Resumo de Notas Fiscais Emitidas - NF-e (Saídas)
// Colunas: Número, Data/Hora, Cliente, Valor, Chave, Total Geral
export function gerarRelatorioNfeSaidas(
  docs: DocumentoFiscalFechamento[],
  empresa: DadosEmpresaFechamento,
  competencia: string,
  formatos: Array<'pdf' | 'xlsx' | 'csv' | 'json'>,
  ordenacao: 'data' | 'numero' | 'contato'
): ArquivoGerado[] {
  const lista = ordenarDocumentos(docs, ordenacao)
  const totalGeral = lista.reduce((acc, d) => acc + (d.valor || 0), 0)
  const titulo = 'Resumo de Notas Fiscais Eletrônicas Emitidas (NF-e - Mod 55)'
  const baseName = `Relatorio_Notas_Emitidas_NFe_${competencia.replace('-', '_')}`
  const resultados: ArquivoGerado[] = []

  // CSV
  if (formatos.includes('csv')) {
    let csv = '\uFEFF'
    csv += `RELATÓRIO FISCAL;${titulo}\r\n`
    csv += `EMPRESA;${empresa.razao_social};CNPJ;${empresa.cnpj};COMPETENCIA;${competencia}\r\n`
    csv += `TOTAL DE ITENS;${lista.length};VALOR TOTAL;${totalGeral.toFixed(2).replace('.', ',')}\r\n\r\n`
    csv += 'NUMERO;DATA/HORA;CLIENTE;VALOR (R$);CHAVE DA NOTA\r\n'
    lista.forEach(d => {
      csv += `${d.numero || '—'};${formatDateTime(d.data_emissao)};"${(d.contato_nome || '—').replace(/"/g, '""')}";${(d.valor || 0).toFixed(2).replace('.', ',')};${d.chave || '—'}\r\n`
    })
    csv += `;;TOTAL GERAL;${totalGeral.toFixed(2).replace('.', ',')};\r\n`
    resultados.push({
      nomeArquivo: `${baseName}.csv`,
      buffer: csv,
      tipo: 'csv',
      modalidade: 'NFE_Saidas'
    })
  }

  // JSON
  if (formatos.includes('json')) {
    const jsonStr = JSON.stringify({
      titulo,
      empresa,
      competencia,
      gerado_em: new Date().toISOString(),
      resumo_executivo: {
        total_documentos: lista.length,
        valor_total: totalGeral,
        total_monofasicos: 0
      },
      documentos: lista.map(d => ({
        numero: d.numero,
        data_hora: d.data_emissao,
        cliente: d.contato_nome,
        valor: d.valor,
        chave: d.chave
      }))
    }, null, 2)
    resultados.push({
      nomeArquivo: `${baseName}.json`,
      buffer: jsonStr,
      tipo: 'json',
      modalidade: 'NFE_Saidas'
    })
  }

  // EXCEL
  if (formatos.includes('xlsx')) {
    const wb = XLSX.utils.book_new()
    const rows = [
      ['RELATÓRIO FISCAL:', titulo],
      ['EMPRESA:', empresa.razao_social, 'CNPJ:', empresa.cnpj, 'COMPETÊNCIA:', competencia],
      [],
      ['RESUMO EXECUTIVO:'],
      ['TOTAL DE DOCUMENTOS:', lista.length, 'VALOR TOTAL APURADO (R$):', totalGeral, 'MONOFÁSICOS (R$):', 0],
      [],
      ['Número', 'Data / Hora', 'Cliente / Destinatário', 'Cidade / UF', 'Valor (R$)', 'Chave de Acesso'],
      ...lista.map(d => [
        d.numero || '—',
        formatDateTime(d.data_emissao),
        d.contato_nome || '—',
        `${d.cidade || '—'} / ${d.uf || '—'}`,
        d.valor || 0,
        d.chave || '—'
      ]),
      ['', '', '', 'TOTAL GERAL:', totalGeral, '']
    ]
    const ws = XLSX.utils.aoa_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, ws, 'Vendas_NFe')
    const xlsxBuf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
    resultados.push({
      nomeArquivo: `${baseName}.xlsx`,
      buffer: new Uint8Array(xlsxBuf),
      tipo: 'xlsx',
      modalidade: 'NFE_Saidas'
    })
  }

  // PDF PROFISSIONAL COM RESUMO NO INÍCIO E TOTAL APENAS NO FINAL
  if (formatos.includes('pdf')) {
    const colunas = ['Número', 'Data/Hora', 'Cliente / Destinatário', 'Cidade/UF', 'Valor', 'Chave de Acesso']
    const linhas = lista.map(d => [
      d.numero || '—',
      formatDateTime(d.data_emissao),
      (d.contato_nome || '—').slice(0, 36),
      `${d.cidade || '—'}/${d.uf || '—'}`,
      `R$ ${formatMoney(d.valor)}`,
      (d.chave || '—').slice(0, 30) + (d.chave && d.chave.length > 30 ? '...' : '')
    ])

    const pdfBuffer = gerarDocumentoPdfFiscal({
      titulo,
      empresa,
      competencia,
      totalItens: lista.length,
      valorTotal: totalGeral,
      valorMonofasicos: 0,
      colunas,
      linhas,
      colunasAlinhadasDireita: [4],
      orientacao: 'landscape'
    })

    resultados.push({
      nomeArquivo: `${baseName}.pdf`,
      buffer: pdfBuffer,
      tipo: 'pdf',
      modalidade: 'NFE_Saidas'
    })
  }

  return resultados
}

// GERAÇÃO DE RELATÓRIO 4: Resumo de Notas Fiscais De Serviços Emitidas - NFS-e (Saídas)
// Colunas: Número, Data/Hora, Cliente, Valor, Chave, Total Geral
export function gerarRelatorioNfseSaidas(
  docs: DocumentoFiscalFechamento[],
  empresa: DadosEmpresaFechamento,
  competencia: string,
  formatos: Array<'pdf' | 'xlsx' | 'csv' | 'json'>,
  ordenacao: 'data' | 'numero' | 'contato'
): ArquivoGerado[] {
  const lista = ordenarDocumentos(docs, ordenacao)
  const totalGeral = lista.reduce((acc, d) => acc + (d.valor || 0), 0)
  const titulo = 'Resumo de Notas Fiscais de Serviços Emitidas (NFS-e de Saída)'
  const baseName = `Relatorio_Servicos_Emitidos_NFSe_${competencia.replace('-', '_')}`
  const resultados: ArquivoGerado[] = []

  // CSV
  if (formatos.includes('csv')) {
    let csv = '\uFEFF'
    csv += `RELATÓRIO FISCAL;${titulo}\r\n`
    csv += `EMPRESA;${empresa.razao_social};CNPJ;${empresa.cnpj};COMPETENCIA;${competencia}\r\n`
    csv += `TOTAL DE ITENS;${lista.length};VALOR TOTAL;${totalGeral.toFixed(2).replace('.', ',')}\r\n\r\n`
    csv += 'NUMERO;DATA/HORA;TOMADOR/CLIENTE;VALOR (R$);CHAVE/CODIGO\r\n'
    lista.forEach(d => {
      csv += `${d.numero || '—'};${formatDateTime(d.data_emissao)};"${(d.contato_nome || '—').replace(/"/g, '""')}";${(d.valor || 0).toFixed(2).replace('.', ',')};${d.chave || '—'}\r\n`
    })
    csv += `;;TOTAL GERAL;${totalGeral.toFixed(2).replace('.', ',')};\r\n`
    resultados.push({
      nomeArquivo: `${baseName}.csv`,
      buffer: csv,
      tipo: 'csv',
      modalidade: 'NFSE_Saidas'
    })
  }

  // JSON
  if (formatos.includes('json')) {
    const jsonStr = JSON.stringify({
      titulo,
      empresa,
      competencia,
      gerado_em: new Date().toISOString(),
      resumo_executivo: {
        total_documentos: lista.length,
        valor_total: totalGeral,
        total_monofasicos: 0
      },
      documentos: lista.map(d => ({
        numero: d.numero,
        data_hora: d.data_emissao,
        tomador: d.contato_nome,
        valor: d.valor,
        chave: d.chave
      }))
    }, null, 2)
    resultados.push({
      nomeArquivo: `${baseName}.json`,
      buffer: jsonStr,
      tipo: 'json',
      modalidade: 'NFSE_Saidas'
    })
  }

  // EXCEL
  if (formatos.includes('xlsx')) {
    const wb = XLSX.utils.book_new()
    const rows = [
      ['RELATÓRIO FISCAL:', titulo],
      ['EMPRESA:', empresa.razao_social, 'CNPJ:', empresa.cnpj, 'COMPETÊNCIA:', competencia],
      [],
      ['RESUMO EXECUTIVO:'],
      ['TOTAL DE DOCUMENTOS:', lista.length, 'VALOR TOTAL APURADO (R$):', totalGeral, 'MONOFÁSICOS (R$):', 0],
      [],
      ['Número', 'Data / Hora', 'Tomador / Cliente', 'Valor (R$)', 'Chave / Código'],
      ...lista.map(d => [
        d.numero || '—',
        formatDateTime(d.data_emissao),
        d.contato_nome || '—',
        d.valor || 0,
        d.chave || '—'
      ]),
      ['', '', 'TOTAL GERAL:', totalGeral, '']
    ]
    const ws = XLSX.utils.aoa_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, ws, 'Servicos_Prestados')
    const xlsxBuf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
    resultados.push({
      nomeArquivo: `${baseName}.xlsx`,
      buffer: new Uint8Array(xlsxBuf),
      tipo: 'xlsx',
      modalidade: 'NFSE_Saidas'
    })
  }

  // PDF PROFISSIONAL COM RESUMO NO INÍCIO E TOTAL APENAS NO FINAL
  if (formatos.includes('pdf')) {
    const colunas = ['Número', 'Data/Hora', 'Cliente / Tomador', 'Valor', 'Chave/Código']
    const linhas = lista.map(d => [
      d.numero || '—',
      formatDateTime(d.data_emissao),
      (d.contato_nome || '—').slice(0, 42),
      `R$ ${formatMoney(d.valor)}`,
      d.chave || '—'
    ])

    const pdfBuffer = gerarDocumentoPdfFiscal({
      titulo,
      empresa,
      competencia,
      totalItens: lista.length,
      valorTotal: totalGeral,
      valorMonofasicos: 0,
      colunas,
      linhas,
      colunasAlinhadasDireita: [3],
      orientacao: 'landscape'
    })

    resultados.push({
      nomeArquivo: `${baseName}.pdf`,
      buffer: pdfBuffer,
      tipo: 'pdf',
      modalidade: 'NFSE_Saidas'
    })
  }

  return resultados
}

// GERAÇÃO DE RELATÓRIO 5: Resumo de Notas Fiscais ao Consumidor Emitidas - NFC-e (Saídas)
// Colunas: Número, Data/Hora, Cliente, Valor, Chave, Total Geral
export function gerarRelatorioNfceSaidas(
  docs: DocumentoFiscalFechamento[],
  empresa: DadosEmpresaFechamento,
  competencia: string,
  formatos: Array<'pdf' | 'xlsx' | 'csv' | 'json'>,
  ordenacao: 'data' | 'numero' | 'contato'
): ArquivoGerado[] {
  const lista = ordenarDocumentos(docs, ordenacao)
  const totalGeral = lista.reduce((acc, d) => acc + (d.valor || 0), 0)
  const titulo = 'Resumo de Notas Fiscais ao Consumidor Eletrônicas (NFC-e - Mod 65)'
  const baseName = `Relatorio_Vendas_NFCe_${competencia.replace('-', '_')}`
  const resultados: ArquivoGerado[] = []

  // CSV
  if (formatos.includes('csv')) {
    let csv = '\uFEFF'
    csv += `RELATÓRIO FISCAL;${titulo}\r\n`
    csv += `EMPRESA;${empresa.razao_social};CNPJ;${empresa.cnpj};COMPETENCIA;${competencia}\r\n`
    csv += `TOTAL DE ITENS;${lista.length};VALOR TOTAL;${totalGeral.toFixed(2).replace('.', ',')}\r\n\r\n`
    csv += 'NUMERO;DATA/HORA;CONSUMIDOR;VALOR (R$);CHAVE DA NOTA\r\n'
    lista.forEach(d => {
      csv += `${d.numero || '—'};${formatDateTime(d.data_emissao)};"${(d.contato_nome || 'Consumidor Final').replace(/"/g, '""')}";${(d.valor || 0).toFixed(2).replace('.', ',')};${d.chave || '—'}\r\n`
    })
    csv += `;;TOTAL GERAL;${totalGeral.toFixed(2).replace('.', ',')};\r\n`
    resultados.push({
      nomeArquivo: `${baseName}.csv`,
      buffer: csv,
      tipo: 'csv',
      modalidade: 'NFCE_Saidas'
    })
  }

  // JSON
  if (formatos.includes('json')) {
    const jsonStr = JSON.stringify({
      titulo,
      empresa,
      competencia,
      gerado_em: new Date().toISOString(),
      resumo_executivo: {
        total_documentos: lista.length,
        valor_total: totalGeral,
        total_monofasicos: 0
      },
      documentos: lista.map(d => ({
        numero: d.numero,
        data_hora: d.data_emissao,
        consumidor: d.contato_nome || 'Consumidor Final',
        valor: d.valor,
        chave: d.chave
      }))
    }, null, 2)
    resultados.push({
      nomeArquivo: `${baseName}.json`,
      buffer: jsonStr,
      tipo: 'json',
      modalidade: 'NFCE_Saidas'
    })
  }

  // EXCEL
  if (formatos.includes('xlsx')) {
    const wb = XLSX.utils.book_new()
    const rows = [
      ['RELATÓRIO FISCAL:', titulo],
      ['EMPRESA:', empresa.razao_social, 'CNPJ:', empresa.cnpj, 'COMPETÊNCIA:', competencia],
      [],
      ['RESUMO EXECUTIVO:'],
      ['TOTAL DE DOCUMENTOS:', lista.length, 'VALOR TOTAL APURADO (R$):', totalGeral, 'MONOFÁSICOS (R$):', 0],
      [],
      ['Número', 'Data / Hora', 'Consumidor / Destinatário', 'Valor (R$)', 'Chave de Acesso'],
      ...lista.map(d => [
        d.numero || '—',
        formatDateTime(d.data_emissao),
        d.contato_nome || 'Consumidor Final',
        d.valor || 0,
        d.chave || '—'
      ]),
      ['', '', '', 'TOTAL GERAL:', totalGeral, '']
    ]
    const ws = XLSX.utils.aoa_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, ws, 'Vendas_NFCe')
    const xlsxBuf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
    resultados.push({
      nomeArquivo: `${baseName}.xlsx`,
      buffer: new Uint8Array(xlsxBuf),
      tipo: 'xlsx',
      modalidade: 'NFCE_Saidas'
    })
  }

  // PDF PROFISSIONAL COM RESUMO NO INÍCIO E TOTAL APENAS NO FINAL
  if (formatos.includes('pdf')) {
    const colunas = ['Número', 'Data/Hora', 'Consumidor', 'Valor', 'Chave de Acesso']
    const linhas = lista.map(d => [
      d.numero || '—',
      formatDateTime(d.data_emissao),
      (d.contato_nome || 'Consumidor Final').slice(0, 36),
      `R$ ${formatMoney(d.valor)}`,
      (d.chave || '—').slice(0, 30) + (d.chave && d.chave.length > 30 ? '...' : '')
    ])

    const pdfBuffer = gerarDocumentoPdfFiscal({
      titulo,
      empresa,
      competencia,
      totalItens: lista.length,
      valorTotal: totalGeral,
      valorMonofasicos: 0,
      colunas,
      linhas,
      colunasAlinhadasDireita: [3],
      orientacao: 'landscape'
    })

    resultados.push({
      nomeArquivo: `${baseName}.pdf`,
      buffer: pdfBuffer,
      tipo: 'pdf',
      modalidade: 'NFCE_Saidas'
    })
  }

  return resultados
}

// GERAÇÃO DE RELATÓRIO 6: Relatório de Monofásicos
// Permite escolher:
// - Apenas Monofásicos OU Todos os produtos
// - Detalhado: Número, Data/Hora, Produto, NCM, PIS/COFINS, Quantidade, Valor Total + Somatório Total
// - Agrupado: Quantidade Total, Produto, NCM, PIS/COFINS, Valor Total + Somatório Total
export function gerarRelatorioMonofasicos(
  itensBrutos: ItemProdutoFechamento[],
  empresa: DadosEmpresaFechamento,
  competencia: string,
  formatos: Array<'pdf' | 'xlsx' | 'csv' | 'json'>,
  ordenacao: 'data' | 'numero' | 'contato',
  escopo: 'apenas_monofasicos' | 'todos_produtos',
  tipoVisualizacao: 'detalhado' | 'agrupado'
): ArquivoGerado[] {
  // Filtra pelo escopo
  const itensFiltrados = escopo === 'apenas_monofasicos'
    ? itensBrutos.filter(it => it.is_monofasico)
    : itensBrutos

  const titulo = escopo === 'apenas_monofasicos'
    ? (tipoVisualizacao === 'detalhado' ? 'Relatório Detalhado de Produtos Monofásicos (PIS/COFINS)' : 'Relatório Agrupado de Produtos Monofásicos (PIS/COFINS)')
    : (tipoVisualizacao === 'detalhado' ? 'Relatório Detalhado de Produtos (Todos os Itens)' : 'Relatório Agrupado de Produtos por NCM')

  const baseName = `Relatorio_Monofasicos_${tipoVisualizacao}_${competencia.replace('-', '_')}`
  const resultados: ArquivoGerado[] = []

  if (tipoVisualizacao === 'detalhado') {
    const lista = ordenarItens(itensFiltrados, ordenacao)
    const totalQtd = lista.reduce((acc, it) => acc + (it.quantidade || 0), 0)
    const totalGeral = lista.reduce((acc, it) => acc + (it.valor_total || 0), 0)
    const totalMonofasicos = lista.filter(it => it.is_monofasico).reduce((acc, it) => acc + (it.valor_total || 0), 0)

    // CSV
    if (formatos.includes('csv')) {
      let csv = '\uFEFF'
      csv += `RELATÓRIO FISCAL;${titulo}\r\n`
      csv += `EMPRESA;${empresa.razao_social};CNPJ;${empresa.cnpj};COMPETENCIA;${competencia}\r\n`
      csv += `ESCOPO;${escopo};TIPO;${tipoVisualizacao};TOTAL ITENS;${lista.length};TOTAL GERAL;${totalGeral.toFixed(2).replace('.', ',')};TOTAL MONOFÁSICOS;${totalMonofasicos.toFixed(2).replace('.', ',')}\r\n\r\n`
      csv += 'NUMERO;DATA/HORA;PRODUTO;NCM;PIS/COFINS CST;QUANTIDADE;TOTAL (R$);STATUS\r\n'
      lista.forEach(it => {
        csv += `${it.numero_nota || '—'};${formatDateTime(it.data_hora)};"${it.produto_nome.replace(/"/g, '""')}";${formatarNcm(it.ncm)};${it.cst_pis_cofins};${it.quantidade.toFixed(2).replace('.', ',')};${it.valor_total.toFixed(2).replace('.', ',')};${it.is_monofasico ? 'Monofásico' : 'Tributado'}\r\n`
      })
      csv += `;;;;TOTAL GERAL;${totalQtd.toFixed(2).replace('.', ',')};${totalGeral.toFixed(2).replace('.', ',')};\r\n`
      resultados.push({
        nomeArquivo: `${baseName}.csv`,
        buffer: csv,
        tipo: 'csv',
        modalidade: 'Relatorios'
      })
    }

    // JSON
    if (formatos.includes('json')) {
      const jsonStr = JSON.stringify({
        titulo,
        empresa,
        competencia,
        tipo: 'detalhado',
        escopo,
        gerado_em: new Date().toISOString(),
        resumo_executivo: {
          total_itens: lista.length,
          soma_quantidades: totalQtd,
          valor_total_geral: totalGeral,
          valor_total_monofasicos: totalMonofasicos
        },
        itens: lista
      }, null, 2)
      resultados.push({
        nomeArquivo: `${baseName}.json`,
        buffer: jsonStr,
        tipo: 'json',
        modalidade: 'Relatorios'
      })
    }

    // EXCEL
    if (formatos.includes('xlsx')) {
      const wb = XLSX.utils.book_new()
      const rows = [
        ['RELATÓRIO FISCAL:', titulo],
        ['EMPRESA:', empresa.razao_social, 'CNPJ:', empresa.cnpj, 'COMPETÊNCIA:', competencia],
        [],
        ['RESUMO EXECUTIVO:'],
        ['TOTAL DE ITENS:', lista.length, 'SOMA QUANTIDADES:', totalQtd, 'VALOR TOTAL APURADO (R$):', totalGeral, 'TOTAL MONOFÁSICOS (R$):', totalMonofasicos],
        [],
        ['Número da Nota', 'Data / Hora', 'Produto', 'NCM', 'PIS/COFINS (CST)', 'Quantidade', 'Valor Total (R$)', 'Classificação'],
        ...lista.map(it => [
          it.numero_nota || '—',
          formatDateTime(it.data_hora),
          it.produto_nome,
          formatarNcm(it.ncm),
          it.cst_pis_cofins,
          it.quantidade,
          it.valor_total,
          it.is_monofasico ? 'Monofásico' : 'Tributado Integral'
        ]),
        ['', '', '', '', 'TOTAL GERAL:', totalQtd, totalGeral, '']
      ]
      const ws = XLSX.utils.aoa_to_sheet(rows)
      XLSX.utils.book_append_sheet(wb, ws, 'Monofasicos_Detalhado')
      const xlsxBuf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
      resultados.push({
        nomeArquivo: `${baseName}.xlsx`,
        buffer: new Uint8Array(xlsxBuf),
        tipo: 'xlsx',
        modalidade: 'Relatorios'
      })
    }

    // PDF PROFISSIONAL COM RESUMO NO INÍCIO E TOTAL APENAS NO FINAL
    if (formatos.includes('pdf')) {
      const colunas = ['Nota', 'Data/Hora', 'Produto', 'NCM', 'PIS/COFINS', 'Qtd', 'Valor Total', 'Status']
      const linhas = lista.map(it => [
        it.numero_nota || '—',
        formatDateTime(it.data_hora),
        it.produto_nome.slice(0, 36),
        formatarNcm(it.ncm),
        it.cst_pis_cofins || '01',
        it.quantidade.toFixed(2),
        `R$ ${formatMoney(it.valor_total)}`,
        it.is_monofasico ? 'Monofásico' : 'Tributado'
      ])

      const pdfBuffer = gerarDocumentoPdfFiscal({
        titulo,
        empresa,
        competencia,
        totalItens: lista.length,
        valorTotal: totalGeral,
        valorMonofasicos: totalMonofasicos,
        colunas,
        linhas,
        colunasAlinhadasDireita: [5, 6],
        orientacao: 'landscape'
      })

      resultados.push({
        nomeArquivo: `${baseName}.pdf`,
        buffer: pdfBuffer,
        tipo: 'pdf',
        modalidade: 'Relatorios'
      })
    }

  } else {
    // TIPO AGRUPADO (Sintético por Nome e NCM)
    const agrupados = agruparProdutos(itensFiltrados)
    const totalQtd = agrupados.reduce((acc, it) => acc + (it.quantidade_total || 0), 0)
    const totalGeral = agrupados.reduce((acc, it) => acc + (it.valor_total || 0), 0)
    const totalMonofasicos = agrupados.filter(it => it.is_monofasico).reduce((acc, it) => acc + (it.valor_total || 0), 0)

    // CSV
    if (formatos.includes('csv')) {
      let csv = '\uFEFF'
      csv += `RELATÓRIO FISCAL;${titulo}\r\n`
      csv += `EMPRESA;${empresa.razao_social};CNPJ;${empresa.cnpj};COMPETENCIA;${competencia}\r\n`
      csv += `ESCOPO;${escopo};TIPO;${tipoVisualizacao};PRODUTOS AGRUPADOS;${agrupados.length};TOTAL GERAL;${totalGeral.toFixed(2).replace('.', ',')};TOTAL MONOFÁSICOS;${totalMonofasicos.toFixed(2).replace('.', ',')}\r\n\r\n`
      csv += 'QUANTIDADE;PRODUTO;NCM;PIS/COFINS CST;VALOR TOTAL (R$);STATUS\r\n'
      agrupados.forEach(it => {
        csv += `${it.quantidade_total.toFixed(2).replace('.', ',')};"${it.produto_nome.replace(/"/g, '""')}";${formatarNcm(it.ncm)};${it.cst_pis_cofins};${it.valor_total.toFixed(2).replace('.', ',')};${it.is_monofasico ? 'Monofásico' : 'Tributado'}\r\n`
      })
      csv += `${totalQtd.toFixed(2).replace('.', ',')};TOTAL GERAL;;;${totalGeral.toFixed(2).replace('.', ',')};\r\n`
      resultados.push({
        nomeArquivo: `${baseName}.csv`,
        buffer: csv,
        tipo: 'csv',
        modalidade: 'Relatorios'
      })
    }

    // JSON
    if (formatos.includes('json')) {
      const jsonStr = JSON.stringify({
        titulo,
        empresa,
        competencia,
        tipo: 'agrupado',
        escopo,
        gerado_em: new Date().toISOString(),
        resumo_executivo: {
          quantidade_produtos_distintos: agrupados.length,
          soma_quantidades: totalQtd,
          valor_total_geral: totalGeral,
          valor_total_monofasicos: totalMonofasicos
        },
        itens_agrupados: agrupados
      }, null, 2)
      resultados.push({
        nomeArquivo: `${baseName}.json`,
        buffer: jsonStr,
        tipo: 'json',
        modalidade: 'Relatorios'
      })
    }

    // EXCEL
    if (formatos.includes('xlsx')) {
      const wb = XLSX.utils.book_new()
      const rows = [
        ['RELATÓRIO FISCAL:', titulo],
        ['EMPRESA:', empresa.razao_social, 'CNPJ:', empresa.cnpj, 'COMPETÊNCIA:', competencia],
        [],
        ['RESUMO EXECUTIVO:'],
        ['PRODUTOS DISTINTOS:', agrupados.length, 'SOMA QUANTIDADES:', totalQtd, 'VALOR TOTAL APURADO (R$):', totalGeral, 'TOTAL MONOFÁSICOS (R$):', totalMonofasicos],
        [],
        ['Quantidade Total', 'Produto', 'NCM', 'PIS/COFINS (CST)', 'Valor Total (R$)', 'Classificação'],
        ...agrupados.map(it => [
          it.quantidade_total,
          it.produto_nome,
          formatarNcm(it.ncm),
          it.cst_pis_cofins,
          it.valor_total,
          it.is_monofasico ? 'Monofásico' : 'Tributado Integral'
        ]),
        [totalQtd, 'TOTAL GERAL:', '', '', totalGeral, '']
      ]
      const ws = XLSX.utils.aoa_to_sheet(rows)
      XLSX.utils.book_append_sheet(wb, ws, 'Monofasicos_Agrupado')
      const xlsxBuf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
      resultados.push({
        nomeArquivo: `${baseName}.xlsx`,
        buffer: new Uint8Array(xlsxBuf),
        tipo: 'xlsx',
        modalidade: 'Relatorios'
      })
    }

    // PDF PROFISSIONAL COM RESUMO NO INÍCIO E TOTAL APENAS NO FINAL
    if (formatos.includes('pdf')) {
      const colunas = ['Quantidade Total', 'Produto', 'NCM', 'PIS/COFINS', 'Valor Total', 'Status']
      const linhas = agrupados.map(it => [
        it.quantidade_total.toFixed(2),
        it.produto_nome.slice(0, 42),
        formatarNcm(it.ncm),
        it.cst_pis_cofins || '01',
        `R$ ${formatMoney(it.valor_total)}`,
        it.is_monofasico ? 'Monofásico' : 'Tributado'
      ])

      const pdfBuffer = gerarDocumentoPdfFiscal({
        titulo,
        empresa,
        competencia,
        totalItens: agrupados.length,
        valorTotal: totalGeral,
        valorMonofasicos: totalMonofasicos,
        colunas,
        linhas,
        colunasAlinhadasDireita: [0, 4],
        orientacao: 'landscape'
      })

      resultados.push({
        nomeArquivo: `${baseName}.pdf`,
        buffer: pdfBuffer,
        tipo: 'pdf',
        modalidade: 'Relatorios'
      })
    }
  }

  return resultados
}

// EMPACOTADOR ZIP FINAL:
// Regra de Ouro:
// Para cada modalidade só cria a pasta SE EXISTIREM XMLS PARA A MODALIDADE (evitando pastas vazias!)
// E grava os relatórios na pasta escolhida (Relatorios/ ou na pasta da modalidade).
export async function montarPacoteFechamentoZip(params: {
  empresa: DadosEmpresaFechamento
  competencia: string
  localRelatorios: 'pasta_relatorios' | 'pasta_modalidade'
  xmlsPorModalidade: {
    nfe_entradas: Array<{ nome: string; buffer: Uint8Array | string }>
    nfse_entradas: Array<{ nome: string; buffer: Uint8Array | string }>
    nfe_saidas: Array<{ nome: string; buffer: Uint8Array | string }>
    nfse_saidas: Array<{ nome: string; buffer: Uint8Array | string }>
    nfce_saidas: Array<{ nome: string; buffer: Uint8Array | string }>
  }
  relatoriosGerados: ArquivoGerado[]
  onProgresso?: (etapa: string, pct: number) => void
}): Promise<Blob> {
  const { empresa, competencia, localRelatorios, xmlsPorModalidade, relatoriosGerados, onProgresso } = params
  const zip = new JSZip()

  onProgresso?.('Organizando pastas e documentos fiscais...', 80)

  // Pastas de modalidades - SÓ CRIA SE EXISTIREM XMLs
  let folderNfeEntrada: JSZip | null = null
  let folderNfseEntrada: JSZip | null = null
  let folderNfeSaida: JSZip | null = null
  let folderNfseSaida: JSZip | null = null
  let folderNfceSaida: JSZip | null = null

  if (xmlsPorModalidade.nfe_entradas.length > 0) {
    folderNfeEntrada = zip.folder('NFE_Entradas')
    xmlsPorModalidade.nfe_entradas.forEach(x => {
      folderNfeEntrada?.file(x.nome, x.buffer)
    })
  }

  if (xmlsPorModalidade.nfse_entradas.length > 0) {
    folderNfseEntrada = zip.folder('NFSE_Entradas')
    xmlsPorModalidade.nfse_entradas.forEach(x => {
      folderNfseEntrada?.file(x.nome, x.buffer)
    })
  }

  if (xmlsPorModalidade.nfe_saidas.length > 0) {
    folderNfeSaida = zip.folder('NFE_Saidas')
    xmlsPorModalidade.nfe_saidas.forEach(x => {
      folderNfeSaida?.file(x.nome, x.buffer)
    })
  }

  if (xmlsPorModalidade.nfse_saidas.length > 0) {
    folderNfseSaida = zip.folder('NFSE_Saidas')
    xmlsPorModalidade.nfse_saidas.forEach(x => {
      folderNfseSaida?.file(x.nome, x.buffer)
    })
  }

  if (xmlsPorModalidade.nfce_saidas.length > 0) {
    folderNfceSaida = zip.folder('NFCE_Saidas')
    xmlsPorModalidade.nfce_saidas.forEach(x => {
      folderNfceSaida?.file(x.nome, x.buffer)
    })
  }

  // Grava os Relatórios
  if (localRelatorios === 'pasta_relatorios') {
    // Salva tudo na pasta Relatorios/
    if (relatoriosGerados.length > 0) {
      const folderRelatorios = zip.folder('Relatorios')
      relatoriosGerados.forEach(r => {
        folderRelatorios?.file(r.nomeArquivo, r.buffer)
      })
    }
  } else {
    // Salva cada relatório dentro da pasta da respectiva modalidade
    // Se a pasta da modalidade não existir (ex: não teve XML), cria a pasta de relatórios como fallback
    let folderFallback: JSZip | null = null

    relatoriosGerados.forEach(r => {
      let targetFolder: JSZip | null = null
      if (r.modalidade === 'NFE_Entradas') {
        targetFolder = folderNfeEntrada || (folderFallback ??= zip.folder('Relatorios'))
      } else if (r.modalidade === 'NFSE_Entradas') {
        targetFolder = folderNfseEntrada || (folderFallback ??= zip.folder('Relatorios'))
      } else if (r.modalidade === 'NFE_Saidas') {
        targetFolder = folderNfeSaida || (folderFallback ??= zip.folder('Relatorios'))
      } else if (r.modalidade === 'NFSE_Saidas') {
        targetFolder = folderNfseSaida || (folderFallback ??= zip.folder('Relatorios'))
      } else if (r.modalidade === 'NFCE_Saidas') {
        targetFolder = folderNfceSaida || (folderFallback ??= zip.folder('Relatorios'))
      } else {
        // Monofásicos ou outros relatórios
        targetFolder = folderNfceSaida || folderNfeSaida || (folderFallback ??= zip.folder('Relatorios'))
      }
      targetFolder?.file(r.nomeArquivo, r.buffer)
    })
  }

  onProgresso?.('Comprimindo pacote ZIP (DEFLATE)...', 92)

  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  }, (metadata) => {
    onProgresso?.(`Compactando arquivos (${metadata.percent.toFixed(0)}%)...`, 92 + (metadata.percent * 0.08))
  })

  return zipBlob
}
