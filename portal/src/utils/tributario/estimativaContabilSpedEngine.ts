/**
 * Paratech — Motor de Geração de SINTEGRA, SPEDs e Estimativa Contábil (Guia DAS)
 * Compatível com o ecossistema Hub Paratech.
 */

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export interface DadosEmpresaSped {
  razao_social: string
  nome_fantasia?: string
  cnpj: string
  ie?: string
  cidade?: string
  uf?: string
  regime_tributario?: string
  contabilidade_nome?: string
}

export interface NotaFiscalItemSped {
  numero: string
  serie: string
  chave: string
  data_emissao: string
  valor: number
  valor_monofasico?: number
  tipo: 'nfe' | 'nfce'
  destinatario?: string
  cnpj_destinatario?: string
}

export interface EstimativaDasResultado {
  rbm: number // Receita Bruta do Mês
  rbt12: number // Receita Bruta Acumulada 12 Meses
  aliquotaNominal: number // %
  parcelaDeduzir: number // R$
  aliquotaEfetiva: number // %
  
  // Faturamentos segregados
  faturamentoTributadoIntegral: number
  faturamentoSubstituicaoIcms: number
  faturamentoMonofasicoPisCofins: number
  faturamentoStEMonofasico: number
  
  // Apuração de Impostos
  valorDasSemSegregacao: number
  valorDasComSegregacao: number
  economiaMes: number
  percentualEconomia: number
  
  // Detalhamento das parcelas tributárias
  parcelas: {
    irpj: number
    csll: number
    cofins: number
    pis: number
    cpp: number
    icms: number
  }
}

/**
 * Calcula a estimativa da guia DAS do Simples Nacional (Anexo I - Comércio)
 * com a segregação de ICMS-ST e Monofásicos de PIS/COFINS.
 */
export function calcularEstimativaDasSimples(
  faturamentoTotal: number,
  faturamentoMonofasico: number,
  faturamentoIcmsSt: number = 0,
  rbt12Estimado?: number
): EstimativaDasResultado {
  const rbm = Math.max(0, faturamentoTotal)
  const rbt12 = rbt12Estimado && rbt12Estimado > 0 ? rbt12Estimado : (rbm * 12 || 180000)

  // Tabela Anexo I - Comércio (Lei Complementar 123/2006 atualizada)
  let aliqNominal = 0.04
  let deducao = 0
  let percIcms = 0.34
  let percPis = 0.0276
  let percCofins = 0.1274
  let percIrpj = 0.055
  let percCsll = 0.035
  let percCpp = 0.415

  if (rbt12 <= 180000) {
    aliqNominal = 0.04
    deducao = 0
  } else if (rbt12 <= 360000) {
    aliqNominal = 0.073
    deducao = 5940
  } else if (rbt12 <= 720000) {
    aliqNominal = 0.095
    deducao = 13860
  } else if (rbt12 <= 1800000) {
    aliqNominal = 0.107
    deducao = 22500
  } else if (rbt12 <= 3600000) {
    aliqNominal = 0.143
    deducao = 87300
  } else {
    aliqNominal = 0.19
    deducao = 378000
  }

  // Alíquota efetiva
  const aliquotaEfetiva = rbt12 > 0 ? Math.max(0.04, ((rbt12 * aliqNominal) - deducao) / rbt12) : 0.04

  // Segregação de faturamentos
  const mono = Math.min(rbm, Math.max(0, faturamentoMonofasico))
  const st = Math.min(rbm, Math.max(0, faturamentoIcmsSt))
  const stEMono = Math.min(mono, st)
  const tributadoIntegral = Math.max(0, rbm - mono - st + stEMono)

  // Cálculo sem segregação
  const valorDasSemSegregacao = rbm * aliquotaEfetiva

  // Cálculo com segregação Paratech
  const valorIrpj = rbm * aliquotaEfetiva * percIrpj
  const valorCsll = rbm * aliquotaEfetiva * percCsll
  const valorCpp = rbm * aliquotaEfetiva * percCpp
  
  // Abate ICMS sobre a parcela com ST
  const baseIcmsTributavel = Math.max(0, rbm - st)
  const valorIcms = baseIcmsTributavel * aliquotaEfetiva * percIcms

  // Abate PIS/COFINS sobre a parcela Monofásica
  const basePisCofinsTributavel = Math.max(0, rbm - mono)
  const valorPis = basePisCofinsTributavel * aliquotaEfetiva * percPis
  const valorCofins = basePisCofinsTributavel * aliquotaEfetiva * percCofins

  const valorDasComSegregacao = valorIrpj + valorCsll + valorCpp + valorIcms + valorPis + valorCofins
  const economiaMes = Math.max(0, valorDasSemSegregacao - valorDasComSegregacao)
  const percentualEconomia = valorDasSemSegregacao > 0 ? (economiaMes / valorDasSemSegregacao) * 100 : 0

  return {
    rbm,
    rbt12,
    aliquotaNominal: aliqNominal * 100,
    parcelaDeduzir: deducao,
    aliquotaEfetiva: aliquotaEfetiva * 100,
    faturamentoTributadoIntegral: tributadoIntegral,
    faturamentoSubstituicaoIcms: st,
    faturamentoMonofasicoPisCofins: mono,
    faturamentoStEMonofasico: stEMono,
    valorDasSemSegregacao,
    valorDasComSegregacao,
    economiaMes,
    percentualEconomia,
    parcelas: {
      irpj: valorIrpj,
      csll: valorCsll,
      cofins: valorCofins,
      pis: valorPis,
      cpp: valorCpp,
      icms: valorIcms
    }
  }
}

/**
 * Gera arquivo de texto posicional SINTEGRA (Convênio ICMS 57/95)
 */
export function gerarArquivoSintegraTxt(
  empresa: DadosEmpresaSped,
  competencia: string, // YYYY-MM
  notas: NotaFiscalItemSped[]
): string {
  const [ano, mes] = competencia.split('-')
  const dataIni = `01${mes}${ano}`
  const ultimoDia = new Date(Number(ano), Number(mes), 0).getDate()
  const dataFim = `${String(ultimoDia).padStart(2, '0')}${mes}${ano}`

  const cnpjClean = (empresa.cnpj || '').replace(/\D/g, '').padEnd(14, '0').slice(0, 14)
  const ieClean = (empresa.ie || 'ISENTO').replace(/\D/g, '').padEnd(14, ' ').slice(0, 14)
  const razaoClean = (empresa.razao_social || 'EMPRESA').toUpperCase().padEnd(35, ' ').slice(0, 35)
  const cidadeClean = (empresa.cidade || 'CIDADE').toUpperCase().padEnd(30, ' ').slice(0, 30)
  const ufClean = (empresa.uf || 'MG').toUpperCase().padEnd(2, ' ').slice(0, 2)

  const linhas: string[] = []

  // Registro 10: Mestre do Estabelecimento (126 chars)
  linhas.push(`10${cnpjClean}${ieClean}${razaoClean}${cidadeClean}${ufClean}0000000000${dataIni}${dataFim}3331`)

  // Registro 11: Dados Complementares
  linhas.push(`11${'RUA PRINCIPAL'.padEnd(34, ' ')}00000${''.padEnd(15, ' ')}${'CENTRO'.padEnd(15, ' ')}30000000${'CONTATO'.padEnd(28, ' ')}31999999999`)

  // Registros 50: Totalizadores de Notas Fiscais
  let totalDocs = 0
  notas.forEach(n => {
    totalDocs++
    const numDoc = String(n.numero || '1').replace(/\D/g, '').padStart(6, '0').slice(-6)
    const serieDoc = (n.serie || '1').padStart(3, ' ').slice(-3)
    const dtEmissao = n.data_emissao ? n.data_emissao.slice(0, 10).replace(/-/g, '') : `${ano}${mes}01`
    const dtFormatada = `${dtEmissao.slice(6, 8)}${dtEmissao.slice(4, 6)}${dtEmissao.slice(0, 4)}`
    const modelo = n.tipo === 'nfce' ? '65' : '55'
    const cfop = n.valor_monofasico && n.valor_monofasico > 0 ? '5405' : '5102'
    const vTotal = Math.round((n.valor || 0) * 100).toString().padStart(13, '0').slice(-13)

    linhas.push(`50${cnpjClean}${ieClean}${dtFormatada}${ufClean}${modelo}${serieDoc}${numDoc}${cfop}P${vTotal}${vTotal}0000000000000000000000000000000000000N`)
  })

  // Registro 90: Totalizador Geral
  const totalLinhas = linhas.length + 1
  linhas.push(`90${cnpjClean}${ieClean}50${String(totalDocs).padStart(8, '0')}000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000${String(totalLinhas).padStart(8, '0')}1`)

  return linhas.map(l => l.padEnd(126, ' ').slice(0, 126)).join('\r\n')
}

/**
 * Gera arquivo SPED Fiscal EFD ICMS/IPI (Texto delimitado por barras)
 */
export function gerarArquivoSpedFiscalTxt(
  empresa: DadosEmpresaSped,
  competencia: string,
  notas: NotaFiscalItemSped[]
): string {
  const [ano, mes] = competencia.split('-')
  const dtIni = `01${mes}${ano}`
  const ultimoDia = new Date(Number(ano), Number(mes), 0).getDate()
  const dtFim = `${String(ultimoDia).padStart(2, '0')}${mes}${ano}`

  const cnpjClean = (empresa.cnpj || '').replace(/\D/g, '')
  const ieClean = (empresa.ie || '').replace(/\D/g, '') || 'ISENTO'
  const razaoClean = empresa.razao_social || 'EMPRESA PARATECH'
  const ufClean = empresa.uf || 'MG'

  const linhas: string[] = []
  let c100Count = 0

  // Bloco 0
  linhas.push(`|0000|018|0|${dtIni}|${dtFim}|${razaoClean}|${cnpjClean}||${ufClean}|${ieClean}|||A|1|`)
  linhas.push(`|0001|0|`)
  linhas.push(`|0005|${empresa.nome_fantasia || razaoClean}|30000000|RUA PRINCIPAL|100||CENTRO|31999999999||contato@paratech.com.br|`)
  linhas.push(`|0100|CONTABILISTA RESPONSAVEL|00000000000|MG-000000/O-0|00000000000100|30000000|AV BRASIL|500||CENTRO|3133334444||contabil@paratech.com.br|3106200|`)
  linhas.push(`|0990|5|`)

  // Bloco C
  linhas.push(`|C001|0|`)
  notas.forEach(n => {
    c100Count++
    const mod = n.tipo === 'nfce' ? '65' : '55'
    const serie = n.serie || '1'
    const num = n.numero || '1'
    const chave = n.chave || ''
    const dt = n.data_emissao ? n.data_emissao.slice(0, 10).replace(/-/g, '') : `${ano}${mes}01`
    const dtFmt = `${dt.slice(6, 8)}${dt.slice(4, 6)}${dt.slice(0, 4)}`
    const vTotal = (n.valor || 0).toFixed(2)

    linhas.push(`|C100|1|0||${mod}|00|${serie}|${num}|${chave}|${dtFmt}|${dtFmt}|${vTotal}|0|0,00|0,00|${vTotal}|0|0,00|0,00|0,00|${vTotal}|0,00|0,00|0,00|0,00|0,00|0,00|`)
  })
  linhas.push(`|C990|${c100Count + 2}|`)

  // Bloco E
  linhas.push(`|E001|0|`)
  linhas.push(`|E100|${dtIni}|${dtFim}|`)
  const totalFaturado = notas.reduce((acc, n) => acc + (n.valor || 0), 0).toFixed(2)
  linhas.push(`|E110|${totalFaturado}|0,00|0,00|0,00|0,00|0,00|0,00|0,00|0,00|0,00|0,00|0,00|0,00|0,00|`)
  linhas.push(`|E990|4|`)

  // Bloco 1 e 9
  linhas.push(`|1001|0|`)
  linhas.push(`|1010|N|N|N|N|N|N|N|N|N|N|N|N|N|`)
  linhas.push(`|1990|3|`)

  linhas.push(`|9001|0|`)
  linhas.push(`|9900|0000|1|`)
  linhas.push(`|9900|C100|${c100Count}|`)
  linhas.push(`|9900|E100|1|`)
  linhas.push(`|9900|9999|1|`)
  linhas.push(`|9990|6|`)
  linhas.push(`|9999|${linhas.length + 2}|`)

  return linhas.join('\r\n')
}

/**
 * Gera arquivo SPED EFD Contribuições (PIS / COFINS)
 */
export function gerarArquivoSpedContribuicoesTxt(
  empresa: DadosEmpresaSped,
  competencia: string,
  notas: NotaFiscalItemSped[]
): string {
  const [ano, mes] = competencia.split('-')
  const dtIni = `01${mes}${ano}`
  const ultimoDia = new Date(Number(ano), Number(mes), 0).getDate()
  const dtFim = `${String(ultimoDia).padStart(2, '0')}${mes}${ano}`

  const cnpjClean = (empresa.cnpj || '').replace(/\D/g, '')
  const razaoClean = empresa.razao_social || 'EMPRESA PARATECH'

  const linhas: string[] = []
  linhas.push(`|0000|006|0|${dtIni}|${dtFim}|${razaoClean}|${cnpjClean}|MG|||00||`)
  linhas.push(`|0001|0|`)
  linhas.push(`|0990|3|`)

  linhas.push(`|C001|0|`)
  let count = 0
  notas.forEach(n => {
    count++
    const mod = n.tipo === 'nfce' ? '65' : '55'
    const dt = n.data_emissao ? n.data_emissao.slice(0, 10).replace(/-/g, '') : `${ano}${mes}01`
    const dtFmt = `${dt.slice(6, 8)}${dt.slice(4, 6)}${dt.slice(0, 4)}`
    const vTotal = (n.valor || 0).toFixed(2)
    linhas.push(`|C100|1|0||${mod}|00|${n.serie || '1'}|${n.numero || '1'}|${n.chave || ''}|${dtFmt}|${dtFmt}|${vTotal}|0|0,00|0,00|${vTotal}|0|0,00|0,00|0,00|0,00|0,00|0,00|`)
  })
  linhas.push(`|C990|${count + 2}|`)

  linhas.push(`|M001|0|`)
  linhas.push(`|M200|0,00|0,00|0,00|0,00|0,00|0,00|0,00|0,00|`)
  linhas.push(`|M600|0,00|0,00|0,00|0,00|0,00|0,00|0,00|0,00|`)
  linhas.push(`|M990|4|`)

  linhas.push(`|9001|0|`)
  linhas.push(`|9900|0000|1|`)
  linhas.push(`|9900|C100|${count}|`)
  linhas.push(`|9990|4|`)
  linhas.push(`|9999|${linhas.length + 2}|`)

  return linhas.join('\r\n')
}

/**
 * Dispara o download de um arquivo de texto no navegador
 */
export function dispararDownloadTexto(conteudo: string, nomeArquivo: string) {
  const blob = new Blob([conteudo], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivo
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Gera o Relatório / Extrato Oficial do Demonstrativo da Guia DAS (Simples Nacional)
 * em PDF profissional com Segregação Inteligente de PIS/COFINS Monofásicos e ICMS-ST.
 */
export function gerarDemonstrativoDasPdf(
  empresa: DadosEmpresaSped,
  competencia: string,
  estimativa: EstimativaDasResultado,
  totalNotas: number = 0
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const dataHoje = new Date().toLocaleString('pt-BR')

  // 1. Cabeçalho Corporativo Superior (Banner Verde Esmeralda Escuro)
  doc.setFillColor(15, 23, 42) // slate-900
  doc.rect(0, 0, pageWidth, 26, 'F')

  // Linha de acento verde
  doc.setFillColor(16, 185, 129) // emerald-500
  doc.rect(0, 24, pageWidth, 2, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text('HUB PARATECH — GESTÃO & AUDITORIA FISCAL', 14, 11)

  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(203, 213, 225) // slate-300
  doc.text(`Demonstrativo Oficial de Apuração Simples Nacional (PGDAS-D) | Emissão: ${dataHoje}`, 14, 18)

  // 2. Título Principal
  let y = 34
  doc.setTextColor(15, 23, 42)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(`EXTRATO DE APURAÇÃO DA GUIA DAS — SIMPLES NACIONAL`, 14, y)
  
  y += 5
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139) // slate-500
  doc.text(`Competência: ${competencia} | Regime: Simples Nacional (Anexo I - Comércio) | Base Legal: LC 123/2006`, 14, y)

  // 3. Card de Dados Cadastrais da Empresa
  y += 6
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(14, y, pageWidth - 28, 22, 2, 2, 'FD')

  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 41, 59)
  doc.text(`Empresa: ${empresa.razao_social || 'NÃO INFORMADA'}`, 18, y + 6)
  doc.text(`CNPJ: ${empresa.cnpj || '—'}`, 18, y + 12)
  doc.text(`Inscrição Estadual: ${empresa.ie || 'ISENTO'}`, 18, y + 18)

  doc.text(`Município/UF: ${(empresa.cidade || '—')}/${(empresa.uf || 'MG')}`, (pageWidth / 2) + 5, y + 6)
  doc.text(`Contabilidade: ${empresa.contabilidade_nome || 'Assessoria Contábil Vinculada'}`, (pageWidth / 2) + 5, y + 12)
  doc.text(`Total de Notas no Mês: ${totalNotas.toLocaleString('pt-BR')} documento(s)`, (pageWidth / 2) + 5, y + 18)

  y += 28

  const fmt = (v: number) => `R$ ${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  // 4. Tabela 1: Resumo do Faturamento e Segregação Tributária
  autoTable(doc, {
    startY: y,
    head: [['Discriminação da Receita no Mês', 'Classificação Fiscal', 'Base de Cálculo (R$)', '% sobre Faturamento']],
    body: [
      ['Receita Bruta do Mês (RBM)', 'Faturamento Geral Consolidado', fmt(estimativa.rbm), '100,0%'],
      ['Receita Tributada Integralmente (Faixa A)', 'Mercadorias Gerais (Alíquota Cheia)', fmt(estimativa.faturamentoTributadoIntegral), `${((estimativa.faturamentoTributadoIntegral / (estimativa.rbm || 1)) * 100).toFixed(1)}%`],
      ['Segregação de Monofásicos PIS/COFINS (Faixa C)', 'Produtos Monofásicos (CST 04/06)', fmt(estimativa.faturamentoMonofasicoPisCofins), `${((estimativa.faturamentoMonofasicoPisCofins / (estimativa.rbm || 1)) * 100).toFixed(1)}%`],
      ['Segregação de ICMS Substituição Tributária (Faixa B)', 'ICMS-ST Retido Anteriormente (CSOSN 500)', fmt(estimativa.faturamentoSubstituicaoIcms), `${((estimativa.faturamentoSubstituicaoIcms / (estimativa.rbm || 1)) * 100).toFixed(1)}%`],
    ],
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59] },
    columnStyles: {
      0: { cellWidth: 70 },
      1: { cellWidth: 55 },
      2: { cellWidth: 35, halign: 'right', fontStyle: 'bold' },
      3: { cellWidth: 22, halign: 'right' }
    },
    margin: { left: 14, right: 14 }
  })

  // @ts-ignore
  y = (doc as any).lastAutoTable.finalY + 6

  // 5. Tabela 2: Comparativo Financeiro da Guia DAS
  autoTable(doc, {
    startY: y,
    head: [['Cenário de Apuração', 'Alíquota Efetiva', 'Deduções Legais (ST + Monofásico)', 'Valor da Guia DAS']],
    body: [
      ['Pagamento Convencional (SEM Segregação)', `${estimativa.aliquotaEfetiva.toFixed(2)}%`, 'R$ 0,00 (Tributação em duplicidade)', fmt(estimativa.valorDasSemSegregacao)],
      ['Pagamento Inteligente Paratech (COM Segregação)', `${estimativa.aliquotaEfetiva.toFixed(2)}%`, `Abatimento ICMS-ST e PIS/COFINS`, fmt(estimativa.valorDasComSegregacao)],
      ['ECONOMIA LÍQUIDA OBTIDA NO MÊS', '—', `Economia de ${estimativa.percentualEconomia.toFixed(1)}% na Guia`, fmt(estimativa.economiaMes)]
    ],
    theme: 'grid',
    headStyles: { fillColor: [5, 150, 105], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59] },
    columnStyles: {
      0: { cellWidth: 75, fontStyle: 'bold' },
      1: { cellWidth: 30, halign: 'center' },
      2: { cellWidth: 47, halign: 'left' },
      3: { cellWidth: 30, halign: 'right', fontStyle: 'bold' }
    },
    didParseCell: function(data: any) {
      if (data.row.index === 1 && data.section === 'body') {
        data.cell.styles.fillColor = [236, 253, 245]
        data.cell.styles.textColor = [6, 95, 70]
      }
      if (data.row.index === 2 && data.section === 'body') {
        data.cell.styles.fillColor = [220, 252, 231]
        data.cell.styles.textColor = [22, 101, 52]
      }
    },
    margin: { left: 14, right: 14 }
  })

  // @ts-ignore
  y = (doc as any).lastAutoTable.finalY + 6

  // 6. Tabela 3: Partição dos Tributos Federais e Estaduais (Anexo I)
  autoTable(doc, {
    startY: y,
    head: [['Tributo', 'Competência de Destino', '% da Partição', 'Valor Pago na Guia Segregada']],
    body: [
      ['CPP (Previdência Patronal)', 'Federal / INSS', '41,50%', fmt(estimativa.parcelas.cpp)],
      ['ICMS (Imposto Estadual sobre Circulação)', 'Estadual / SEFAZ', '34,00% (com dedução ST)', fmt(estimativa.parcelas.icms)],
      ['COFINS (Seguridade Social)', 'Federal / RFB', '12,74% (com dedução Monofásicos)', fmt(estimativa.parcelas.cofins)],
      ['IRPJ (Imposto de Renda Pessoa Jurídica)', 'Federal / RFB', '5,50%', fmt(estimativa.parcelas.irpj)],
      ['CSLL (Contribuição Social sobre o Lucro)', 'Federal / RFB', '3,50%', fmt(estimativa.parcelas.csll)],
      ['PIS/PASEP (Integração Social)', 'Federal / RFB', '2,76% (com dedução Monofásicos)', fmt(estimativa.parcelas.pis)],
      ['TOTAL CONSOLIDADO DA GUIA DAS', 'Documento Único de Arrecadação', '100,00%', fmt(estimativa.valorDasComSegregacao)]
    ],
    theme: 'striped',
    headStyles: { fillColor: [51, 65, 85], textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
    bodyStyles: { fontSize: 7, textColor: [30, 41, 59] },
    columnStyles: {
      0: { cellWidth: 70, fontStyle: 'bold' },
      1: { cellWidth: 45 },
      2: { cellWidth: 37, halign: 'center' },
      3: { cellWidth: 30, halign: 'right', fontStyle: 'bold' }
    },
    margin: { left: 14, right: 14 }
  })

  // @ts-ignore
  y = (doc as any).lastAutoTable.finalY + 6

  // 7. Orientações para Lançamento no PGDAS-D
  doc.setFillColor(241, 245, 249)
  doc.setDrawColor(203, 213, 225)
  doc.roundedRect(14, y, pageWidth - 28, 24, 2, 2, 'FD')

  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 41, 59)
  doc.text('📌 Orientações Contábeis para Lançamento no PGDAS-D (Receita Federal):', 18, y + 5)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(71, 85, 105)
  doc.text(`1. Revenda de mercadorias SEM Substituição Tributária / Monofásicos: declarar ${fmt(estimativa.faturamentoTributadoIntegral)}.`, 18, y + 10)
  doc.text(`2. Revenda de mercadorias COM Substituição Tributária de ICMS e Monofásicos de PIS/COFINS: declarar ${fmt(estimativa.faturamentoMonofasicoPisCofins)}.`, 18, y + 15)
  doc.text(`3. No PGDAS-D, marque a opção de segregação de ICMS por Substituição Tributária e PIS/COFINS por Tributação Monofásica.`, 18, y + 20)

  // Rodapé
  doc.setFontSize(7)
  doc.setTextColor(148, 163, 184)
  doc.text(`HUB PARATECH — Sistema Integrado de Gestão & Inteligência Fiscal | Documento de Apuração Extraoficial | CNPJ ${empresa.cnpj}`, 14, pageHeight - 5)
  doc.text(`Página 1 de 1`, pageWidth - 14, pageHeight - 5, { align: 'right' })

  // Salva o PDF
  const nomeArquivo = `GUIA_DAS_DEMONSTRATIVO_${(empresa.cnpj || '').replace(/\D/g, '')}_${competencia.replace('-', '')}.pdf`
  doc.save(nomeArquivo)
}
