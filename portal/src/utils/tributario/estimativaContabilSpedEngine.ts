/**
 * Paratech — Motor de Geração de SINTEGRA, SPEDs e Estimativa Contábil (Guia DAS)
 * Compatível com o ecossistema Hub Paratech.
 */

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
