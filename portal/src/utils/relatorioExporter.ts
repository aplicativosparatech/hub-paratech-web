import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { FUSO_BRASIL, parseDateUtc } from './dateBrasil'

export interface EmpresaDados {
  razao_social: string
  nome_fantasia?: string
  cnpj: string
  regime_tributario?: string
  contabilidade_nome?: string
}

export type TipoRelatorio = 
  | 'nfe' 
  | 'nfce' 
  | 'consolidado' 
  | 'pagamentos'
  | 'monofasicos' 
  | 'monofasicos_produtos_analitico'
  | 'monofasicos_produtos_agrupado'
  | 'quebra' 
  | 'nao_assinadas' 
  | 'inutilizadas'
  | 'certificados'

export type FormatoExportacao = 'pdf' | 'excel' | 'xls' | 'csv'

function formatMoney(val: number): string {
  return (val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—'
  try {
    const d = parseDateUtc(dateStr)
    if (!d) return dateStr
    return d.toLocaleDateString('pt-BR', { timeZone: FUSO_BRASIL })
  } catch {
    return dateStr
  }
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_')
}

function getRegimeNome(regime?: string): string {
  switch (regime) {
    case 'simples_nacional': return 'Simples Nacional'
    case 'simples_nacional_excesso': return 'Simples (Excesso)'
    case 'lucro_presumido': return 'Lucro Presumido'
    case 'lucro_real': return 'Lucro Real'
    case 'mei': return 'MEI'
    default: return 'Simples Nacional'
  }
}

// ==========================================
// 1. EXPORTAÇÃO CSV
// ==========================================
export function exportarCSV(
  tipo: TipoRelatorio,
  empresa: EmpresaDados,
  competencia: string,
  dados: any
) {
  let linhas: string[] = []
  const dataHoje = new Date().toLocaleString('pt-BR', { timeZone: FUSO_BRASIL })

  // Cabeçalho da Empresa
  linhas.push(`EMPRESA;${empresa.razao_social || '—'}`)
  linhas.push(`CNPJ;${empresa.cnpj || '—'}`)
  linhas.push(`REGIME TRIBUTARIO;${getRegimeNome(empresa.regime_tributario)}`)
  linhas.push(`CONTABILIDADE;${empresa.contabilidade_nome || 'Não vinculada'}`)
  linhas.push(`COMPETENCIA;${competencia}`)
  linhas.push(`EMISSAO DO RELATORIO;${dataHoje}`)
  linhas.push('') // Linha em branco

  if (tipo === 'nfe' || tipo === 'nfce') {
    const isNfe = tipo === 'nfe'
    const lista = isNfe ? (dados.notas_detalhadas?.nfe || []) : (dados.notas_detalhadas?.nfce || [])
    const resumo = isNfe ? dados.consolidado?.nfe : dados.consolidado?.nfce
    const titulo = isNfe ? 'RELATORIO DE VENDAS - NF-E (MODELO 55)' : 'RELATORIO DE VENDAS - NFC-E (MODELO 65)'

    linhas.push(`TITULO;${titulo}`)
    linhas.push(`QUANTIDADE DE NOTAS;${resumo?.quantidade || lista.length}`)
    linhas.push(`VALOR TOTAL FATURADO;R$ ${formatMoney(resumo?.total || 0)}`)
    linhas.push(`TOTAL MONOFASICO;R$ ${formatMoney(resumo?.monofasico || 0)}`)
    linhas.push('')
    linhas.push('NUMERO;SERIE;CHAVE DE ACESSO;DATA EMISSAO;VALOR TOTAL (R$);MONOFASICO (R$);PROTOCOLO SEFAZ;STATUS')

    lista.forEach((n: any) => {
      linhas.push([
        n.numero || '—',
        n.serie || '1',
        n.chave || '—',
        formatDate(n.data_emissao),
        Number(n.valor || 0).toFixed(2).replace('.', ','),
        Number(n.valor_monofasico || 0).toFixed(2).replace('.', ','),
        n.protocolo || '—',
        n.cstat === '100' || n.is_autorizada ? 'Autorizada (100)' : 'Pendente'
      ].join(';'))
    })

  } else if (tipo === 'consolidado') {
    const c = dados.consolidado
    linhas.push('TITULO;RELATORIO CONSOLIDADO DE FATURAMENTO FISCAL')
    linhas.push(`FATURAMENTO NF-E (MOD 55);R$ ${formatMoney(c?.nfe?.total || 0)};${c?.nfe?.quantidade || 0} notas`)
    linhas.push(`FATURAMENTO NFC-E (MOD 65);R$ ${formatMoney(c?.nfce?.total || 0)};${c?.nfce?.quantidade || 0} notas`)
    linhas.push(`FATURAMENTO BRUTO TOTAL;R$ ${formatMoney(c?.geral?.total_faturado || 0)};${c?.geral?.quantidade_total || 0} notas`)
    linhas.push(`(-) DEDUCAO PRODUTOS MONOFASICOS;R$ ${formatMoney(c?.geral?.total_monofasico || 0)}`)
    linhas.push(`(=) BASE TRIBUTAVEL RESTANTE (PGDAS);R$ ${formatMoney(c?.geral?.total_tributavel_restante || 0)}`)

    if (dados.formas_pagamento && dados.formas_pagamento.length > 0) {
      linhas.push('')
      linhas.push('MODALIDADES DE PAGAMENTO RECEBIDAS')
      linhas.push('FORMA DE PAGAMENTO;VALOR TOTAL (R$);QUANTIDADE;% DO TOTAL')
      dados.formas_pagamento.forEach((fp: any) => {
        linhas.push([
          fp.nome,
          Number(fp.total || 0).toFixed(2).replace('.', ','),
          fp.quantidade,
          Number(fp.percentual || 0).toFixed(1).replace('.', ',') + '%'
        ].join(';'))
      })
    }

    linhas.push('')
    linhas.push('MODELO;NUMERO;SERIE;CHAVE DE ACESSO;DATA EMISSAO;VALOR TOTAL (R$);MONOFASICO (R$);PROTOCOLO')

    const todos = [
      ...(dados.notas_detalhadas?.nfe || []).map((n: any) => ({ ...n, modelo: 'NF-e (55)' })),
      ...(dados.notas_detalhadas?.nfce || []).map((n: any) => ({ ...n, modelo: 'NFC-e (65)' }))
    ]

    todos.forEach((n: any) => {
      linhas.push([
        n.modelo,
        n.numero || '—',
        n.serie || '1',
        n.chave || '—',
        formatDate(n.data_emissao),
        Number(n.valor || 0).toFixed(2).replace('.', ','),
        Number(n.valor_monofasico || 0).toFixed(2).replace('.', ','),
        n.protocolo || '—'
      ].join(';'))
    })

  } else if (tipo === 'pagamentos') {
    linhas.push('TITULO;DEMONSTRATIVO DE MODALIDADES DE PAGAMENTO')
    linhas.push(`FATURAMENTO TOTAL;R$ ${formatMoney(dados.consolidado?.geral?.total_faturado || 0)}`)
    linhas.push(`QUANTIDADE TOTAL DE NOTAS;${dados.consolidado?.geral?.quantidade_total || 0}`)
    linhas.push('')
    linhas.push('RESUMO CONSOLIDADO POR FORMA DE PAGAMENTO')
    linhas.push('MODALIDADE;VALOR TOTAL (R$);QTD NOTAS/CUPONS;% PARTICIPACAO')
    const fps = dados.formas_pagamento || []
    fps.forEach((fp: any) => {
      linhas.push([
        fp.nome,
        Number(fp.total || 0).toFixed(2).replace('.', ','),
        fp.quantidade,
        Number(fp.percentual || 0).toFixed(1).replace('.', ',') + '%'
      ].join(';'))
    })
    linhas.push('')
    linhas.push('DETALHAMENTO ANALITICO DAS NOTAS COM MODALIDADES DE PAGAMENTO')
    linhas.push('MODELO;NUMERO;SERIE;CHAVE;DATA;VALOR NOTA (R$);FORMA DE PAGAMENTO;VALOR PARCELA (R$)')
    const todos = [
      ...(dados.notas_detalhadas?.nfe || []).map((n: any) => ({ ...n, modelo: 'NF-e (55)' })),
      ...(dados.notas_detalhadas?.nfce || []).map((n: any) => ({ ...n, modelo: 'NFC-e (65)' }))
    ]
    todos.forEach((n: any) => {
      if (Array.isArray(n.formas_pagamento) && n.formas_pagamento.length > 0) {
        n.formas_pagamento.forEach((fp: any) => {
          linhas.push([
            n.modelo,
            n.numero || '—',
            n.serie || '1',
            n.chave || '—',
            formatDate(n.data_emissao),
            Number(n.valor || 0).toFixed(2).replace('.', ','),
            fp.nome || 'Outros',
            Number(fp.valor || 0).toFixed(2).replace('.', ',')
          ].join(';'))
        })
      } else {
        linhas.push([
          n.modelo,
          n.numero || '—',
          n.serie || '1',
          n.chave || '—',
          formatDate(n.data_emissao),
          Number(n.valor || 0).toFixed(2).replace('.', ','),
          'Outros',
          Number(n.valor || 0).toFixed(2).replace('.', ',')
        ].join(';'))
      }
    })

  } else if (tipo === 'monofasicos') {
    const c = dados.consolidado
    linhas.push('TITULO;DEMONSTRATIVO DE PRODUTOS MONOFASICOS (PIS E COFINS)')
    linhas.push(`TOTAL MONOFASICO A SEGREGAR;R$ ${formatMoney(c?.geral?.total_monofasico || 0)}`)
    linhas.push(`FATURAMENTO BRUTO TOTAL;R$ ${formatMoney(c?.geral?.total_faturado || 0)}`)
    linhas.push(`BASE RESTANTE PGDAS;R$ ${formatMoney(c?.geral?.total_tributavel_restante || 0)}`)
    linhas.push('')
    linhas.push('MODELO;NUMERO;SERIE;CHAVE DE ACESSO;DATA;VALOR DA NOTA (R$);VALOR MONOFASICO (R$)')

    const monofList = [
      ...(dados.notas_detalhadas?.nfe || []).filter((n: any) => (n.valor_monofasico || 0) > 0).map((n: any) => ({ ...n, modelo: 'NF-e (55)' })),
      ...(dados.notas_detalhadas?.nfce || []).filter((n: any) => (n.valor_monofasico || 0) > 0).map((n: any) => ({ ...n, modelo: 'NFC-e (65)' }))
    ]

    monofList.forEach((n: any) => {
      linhas.push([
        n.modelo,
        n.numero || '—',
        n.serie || '1',
        n.chave || '—',
        formatDate(n.data_emissao),
        Number(n.valor || 0).toFixed(2).replace('.', ','),
        Number(n.valor_monofasico || 0).toFixed(2).replace('.', ',')
      ].join(';'))
    })

  } else if (tipo === 'monofasicos_produtos_analitico') {
    const lista = dados.produtos || []
    linhas.push('TITULO;RELATORIO ANALITICO DE PRODUTOS MONOFASICOS (POR CUPOM/NOTA)')
    linhas.push(`FILTRO APLICADO;${dados.filtro_rotulo || 'Todos os Produtos'}`)
    linhas.push(`TOTAL DE ITENS MONOFASICOS;${lista.length}`)
    linhas.push(`VALOR TOTAL MONOFASICO;R$ ${formatMoney(dados.total_valor || lista.reduce((a: number, b: any) => a + (b.vProd || 0), 0))}`)
    linhas.push('')
    linhas.push('CUPOM / NOTA;MODELO;SERIE;DATA;HORA;COD PROD;DESCRICAO DO PRODUTO;NCM;CATEGORIA;DESCRICAO NCM;CFOP;QTD;UN;VALOR UNIT (R$);VALOR TOTAL (R$);CST;CHAVE DE ACESSO;PROTOCOLO')

    lista.forEach((item: any) => {
      linhas.push([
        `Nº ${item.cupom_numero || '—'}`,
        item.modelo_nome || 'NFC-e',
        item.serie || '1',
        formatDate(item.data_emissao),
        item.hora_emissao || '—',
        item.cProd || '—',
        item.xProd || '—',
        item.ncm_formatado || item.ncm || '—',
        item.categoria || '—',
        item.descricao_ncm || '—',
        item.cfop || '5405',
        Number(item.qCom || 0).toFixed(2).replace('.', ','),
        item.uCom || 'UN',
        Number(item.vUnCom || 0).toFixed(2).replace('.', ','),
        Number(item.vProd || 0).toFixed(2).replace('.', ','),
        item.cst || '04',
        item.chave || '—',
        item.protocolo || '—'
      ].join(';'))
    })

  } else if (tipo === 'monofasicos_produtos_agrupado') {
    const lista = dados.produtos_agrupados || []
    linhas.push('TITULO;RELATORIO AGRUPADO / SINTETICO DE PRODUTOS MONOFASICOS')
    linhas.push(`FILTRO APLICADO;${dados.filtro_rotulo || 'Todos os Produtos'}`)
    linhas.push(`TOTAL DE PRODUTOS DISTINTOS;${lista.length}`)
    linhas.push(`VALOR TOTAL MONOFASICO;R$ ${formatMoney(dados.total_valor || lista.reduce((a: number, b: any) => a + (b.valor_total || 0), 0))}`)
    linhas.push('')
    linhas.push('NCM;CATEGORIA;DESCRICAO NCM;COD PROD;DESCRICAO DO PRODUTO;QTD CUPONS;QTD TOTAL VENDIDA;UN;PRECO MEDIO (R$);VALOR TOTAL (R$);% DO TOTAL')

    lista.forEach((item: any) => {
      linhas.push([
        item.ncm_formatado || item.ncm || '—',
        item.categoria || '—',
        item.descricao_ncm || '—',
        item.cProd || '—',
        item.xProd || '—',
        item.qtd_cupons || 1,
        Number(item.qtd_total || 0).toFixed(2).replace('.', ','),
        item.uCom || 'UN',
        Number(item.preco_medio || 0).toFixed(2).replace('.', ','),
        Number(item.valor_total || 0).toFixed(2).replace('.', ','),
        Number(item.percentual || 0).toFixed(2).replace('.', ',') + '%'
      ].join(';'))
    })

  } else if (tipo === 'quebra') {
    linhas.push('TITULO;RELATORIO DE QUEBRA DE SEQUENCIA DE NUMERACAO')
    linhas.push('MODELO;SERIE;INTERVALO FALTANTE;NOTAS PULADAS;NOTA ANTERIOR;NOTA POSTERIOR;STATUS')
    const quebras = dados.quebras_sequencia || []
    quebras.forEach((q: any) => {
      linhas.push([
        q.modelo,
        q.serie,
        q.esperado_de === q.esperado_ate ? `Nº ${q.esperado_de}` : `Nº ${q.esperado_de} ate ${q.esperado_ate}`,
        `${q.quantidade_faltante} nota(s)`,
        `Nº ${q.anterior_emitido}`,
        `Nº ${q.posterior_emitido}`,
        'Pendente / Inutilizar'
      ].join(';'))
    })

  } else if (tipo === 'nao_assinadas') {
    linhas.push('TITULO;RELATORIO DE NOTAS NAO ASSINADAS OU SEM PROTOCOLO')
    linhas.push('NUMERO;CHAVE DE ACESSO;VALOR (R$);DATA EMISSAO;ASSINATURA;STATUS SEFAZ')
    const lista = [...(dados.nao_assinadas?.nfe || []), ...(dados.nao_assinadas?.nfce || [])]
    lista.forEach((n: any) => {
      linhas.push([
        n.numero || '—',
        n.chave || '—',
        Number(n.valor || 0).toFixed(2).replace('.', ','),
        formatDate(n.data_emissao),
        n.tem_assinatura ? 'Assinada' : 'Sem Assinatura',
        n.motivo_sefaz || (n.cstat ? `cStat: ${n.cstat}` : 'Sem Protocolo')
      ].join(';'))
    })

  } else if (tipo === 'certificados') {
    linhas.push('TITULO;RELATORIO DE CERTIFICADOS DIGITAIS A1 (A VENCER)')
    linhas.push('EMPRESA;CNPJ;VENCIMENTO;DIAS RESTANTES;STATUS;WHATSAPP')
    const certList = dados.certificados || []
    certList.forEach((c: any) => {
      linhas.push([
        c.razao_social || '—',
        c.cnpj || '—',
        c.validadeFormatada || '—',
        c.dias !== null ? `${c.dias} dias` : '—',
        c.status === 'vencido' ? 'VENCIDO' : (c.status === 'alerta' ? 'A VENCER' : 'VALIDO'),
        c.whatsapp || '—'
      ].join(';'))
    })
  }

  const csvContent = '\uFEFF' + linhas.join('\r\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Relatorio_${tipo.toUpperCase()}_${sanitizeFileName(empresa.razao_social)}_${competencia}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ==========================================
// 2. EXPORTAÇÃO EXCEL (XLSX)
// ==========================================
export function exportarExcel(
  tipo: TipoRelatorio,
  empresa: EmpresaDados,
  competencia: string,
  dados: any
) {
  const wb = XLSX.utils.book_new()
  const dataHoje = new Date().toLocaleString('pt-BR', { timeZone: FUSO_BRASIL })

  const rows: any[][] = [
    ['HUB PARATECH - SISTEMA DE AUDITORIA FISCAL'],
    [`Empresa: ${empresa.razao_social}`, `CNPJ: ${empresa.cnpj}`],
    [`Regime: ${getRegimeNome(empresa.regime_tributario)}`, `Competência: ${competencia}`],
    [`Contabilidade: ${empresa.contabilidade_nome || 'Não vinculada'}`, `Data Emissão: ${dataHoje}`],
    []
  ]

  let sheetName = 'Relatório'

  if (tipo === 'nfe' || tipo === 'nfce') {
    const isNfe = tipo === 'nfe'
    const lista = isNfe ? (dados.notas_detalhadas?.nfe || []) : (dados.notas_detalhadas?.nfce || [])
    const resumo = isNfe ? dados.consolidado?.nfe : dados.consolidado?.nfce
    sheetName = isNfe ? 'Vendas NF-e (55)' : 'Vendas NFC-e (65)'

    rows.push([sheetName.toUpperCase()])
    rows.push(['Total de Notas', resumo?.quantidade || lista.length])
    rows.push(['Valor Total Faturado (R$)', resumo?.total || 0])
    rows.push(['Total Monofásico (R$)', resumo?.monofasico || 0])
    rows.push([])
    rows.push(['Número', 'Série', 'Chave de Acesso', 'Data Emissão', 'Valor (R$)', 'Monofásico (R$)', 'Protocolo SEFAZ', 'Status'])

    lista.forEach((n: any) => {
      rows.push([
        n.numero || '',
        n.serie || '1',
        n.chave || '',
        formatDate(n.data_emissao),
        Number(n.valor || 0),
        Number(n.valor_monofasico || 0),
        n.protocolo || '',
        n.cstat === '100' || n.is_autorizada ? 'Autorizada (100)' : 'Pendente'
      ])
    })

  } else if (tipo === 'consolidado') {
    sheetName = 'Consolidado Fiscal'
    const c = dados.consolidado
    rows.push(['DEMONSTRATIVO CONSOLIDADO DO PERÍODO'])
    rows.push(['NF-e (Modelo 55)', c?.nfe?.quantidade || 0, c?.nfe?.total || 0])
    rows.push(['NFC-e (Modelo 65)', c?.nfce?.quantidade || 0, c?.nfce?.total || 0])
    rows.push(['Faturamento Bruto Total', c?.geral?.quantidade_total || 0, c?.geral?.total_faturado || 0])
    rows.push(['(-) Produtos Monofásicos a Segregar', '', -(c?.geral?.total_monofasico || 0)])
    rows.push(['(=) Base Tributável Restante (PGDAS)', '', c?.geral?.total_tributavel_restante || 0])

    if (dados.formas_pagamento && dados.formas_pagamento.length > 0) {
      rows.push([])
      rows.push(['MODALIDADES DE PAGAMENTO RECEBIDAS'])
      rows.push(['Forma de Pagamento', 'Total Recebido (R$)', 'Qtd. Notas/Cupons', '% do Faturamento'])
      dados.formas_pagamento.forEach((fp: any) => {
        rows.push([fp.nome, Number(fp.total || 0), fp.quantidade, `${fp.percentual || 0}%`])
      })
    }

    rows.push([])
    rows.push(['Modelo', 'Número', 'Série', 'Chave de Acesso', 'Data Emissão', 'Valor (R$)', 'Monofásico (R$)', 'Protocolo'])

    const todos = [
      ...(dados.notas_detalhadas?.nfe || []).map((n: any) => ({ ...n, modelo: 'NF-e (55)' })),
      ...(dados.notas_detalhadas?.nfce || []).map((n: any) => ({ ...n, modelo: 'NFC-e (65)' }))
    ]

    todos.forEach((n: any) => {
      rows.push([
        n.modelo,
        n.numero || '',
        n.serie || '1',
        n.chave || '',
        formatDate(n.data_emissao),
        Number(n.valor || 0),
        Number(n.valor_monofasico || 0),
        n.protocolo || ''
      ])
    })

  } else if (tipo === 'pagamentos') {
    sheetName = 'Modalidades Pagamento'
    rows.push(['DEMONSTRATIVO DE MODALIDADES DE PAGAMENTO'])
    rows.push(['Faturamento Total (R$)', dados.consolidado?.geral?.total_faturado || 0])
    rows.push(['Quantidade Total de Notas', dados.consolidado?.geral?.quantidade_total || 0])
    rows.push([])
    rows.push(['RESUMO POR FORMA DE PAGAMENTO'])
    rows.push(['Modalidade de Pagamento', 'Valor Total (R$)', 'Qtd. Notas/Cupons', '% Participação'])
    const fps = dados.formas_pagamento || []
    fps.forEach((fp: any) => {
      rows.push([fp.nome, Number(fp.total || 0), fp.quantidade, `${fp.percentual || 0}%`])
    })
    rows.push([])
    rows.push(['DETALHAMENTO ANALÍTICO POR NOTA FISCAL'])
    rows.push(['Modelo', 'Número', 'Série', 'Chave de Acesso', 'Data Emissão', 'Valor Total Nota (R$)', 'Forma de Pagamento', 'Valor Parcela (R$)'])
    const todos = [
      ...(dados.notas_detalhadas?.nfe || []).map((n: any) => ({ ...n, modelo: 'NF-e (55)' })),
      ...(dados.notas_detalhadas?.nfce || []).map((n: any) => ({ ...n, modelo: 'NFC-e (65)' }))
    ]
    todos.forEach((n: any) => {
      if (Array.isArray(n.formas_pagamento) && n.formas_pagamento.length > 0) {
        n.formas_pagamento.forEach((fp: any) => {
          rows.push([
            n.modelo,
            n.numero || '',
            n.serie || '1',
            n.chave || '',
            formatDate(n.data_emissao),
            Number(n.valor || 0),
            fp.nome || 'Outros',
            Number(fp.valor || 0)
          ])
        })
      } else {
        rows.push([
          n.modelo,
          n.numero || '',
          n.serie || '1',
          n.chave || '',
          formatDate(n.data_emissao),
          Number(n.valor || 0),
          'Outros',
          Number(n.valor || 0)
        ])
      }
    })

  } else if (tipo === 'monofasicos') {
    sheetName = 'Monofásicos PIS COFINS'
    const c = dados.consolidado
    rows.push(['AUDITORIA DE PRODUTOS MONOFÁSICOS'])
    rows.push(['Faturamento Bruto Total', c?.geral?.total_faturado || 0])
    rows.push(['Total Monofásico a Segregar no DAS', c?.geral?.total_monofasico || 0])
    rows.push(['Base Tributável Restante', c?.geral?.total_tributavel_restante || 0])
    rows.push([])
    rows.push(['Modelo', 'Número', 'Série', 'Chave de Acesso', 'Data Emissão', 'Valor da Nota (R$)', 'Valor Monofásico (R$)'])

    const monofList = [
      ...(dados.notas_detalhadas?.nfe || []).filter((n: any) => (n.valor_monofasico || 0) > 0).map((n: any) => ({ ...n, modelo: 'NF-e (55)' })),
      ...(dados.notas_detalhadas?.nfce || []).filter((n: any) => (n.valor_monofasico || 0) > 0).map((n: any) => ({ ...n, modelo: 'NFC-e (65)' }))
    ]

    monofList.forEach((n: any) => {
      rows.push([
        n.modelo,
        n.numero || '',
        n.serie || '1',
        n.chave || '',
        formatDate(n.data_emissao),
        Number(n.valor || 0),
        Number(n.valor_monofasico || 0)
      ])
    })

  } else if (tipo === 'monofasicos_produtos_analitico') {
    sheetName = 'Itens Monofásicos'
    const lista = dados.produtos || []
    rows.push(['RELATÓRIO ANALÍTICO DE PRODUTOS MONOFÁSICOS POR CUPOM/NOTA'])
    rows.push([`Filtro Aplicado: ${dados.filtro_rotulo || 'Todos os Produtos'}`])
    rows.push(['Total de Itens Monofásicos', lista.length])
    rows.push(['Valor Total Monofásico (R$)', Number(dados.total_valor || lista.reduce((a: number, b: any) => a + (b.vProd || 0), 0))])
    rows.push([])
    rows.push(['Cupom / Nota', 'Modelo', 'Série', 'Data', 'Hora', 'Cód. Prod', 'Descrição do Produto', 'NCM', 'Categoria', 'Descrição NCM', 'CFOP', 'Qtd', 'Un', 'Valor Unit (R$)', 'Valor Total (R$)', 'CST', 'Chave de Acesso', 'Protocolo SEFAZ'])

    lista.forEach((item: any) => {
      rows.push([
        `Nº ${item.cupom_numero || '—'}`,
        item.modelo_nome || 'NFC-e',
        item.serie || '1',
        formatDate(item.data_emissao),
        item.hora_emissao || '',
        item.cProd || '',
        item.xProd || '',
        item.ncm_formatado || item.ncm || '',
        item.categoria || '',
        item.descricao_ncm || '',
        item.cfop || '5405',
        Number(item.qCom || 0),
        item.uCom || 'UN',
        Number(item.vUnCom || 0),
        Number(item.vProd || 0),
        item.cst || '04',
        item.chave || '',
        item.protocolo || ''
      ])
    })

  } else if (tipo === 'monofasicos_produtos_agrupado') {
    sheetName = 'Monofásicos Agrupados'
    const lista = dados.produtos_agrupados || []
    rows.push(['RELATÓRIO AGRUPADO / SINTÉTICO DE PRODUTOS MONOFÁSICOS'])
    rows.push([`Filtro Aplicado: ${dados.filtro_rotulo || 'Todos os Produtos'}`])
    rows.push(['Total de Produtos Distintos', lista.length])
    rows.push(['Valor Total Monofásico (R$)', Number(dados.total_valor || lista.reduce((a: number, b: any) => a + (b.valor_total || 0), 0))])
    rows.push([])
    rows.push(['NCM', 'Categoria', 'Descrição NCM', 'Cód. Prod', 'Descrição do Produto', 'Qtd Cupons', 'Qtd Total Vendida', 'Un', 'Preço Médio (R$)', 'Valor Total (R$)', '% do Total'])

    lista.forEach((item: any) => {
      rows.push([
        item.ncm_formatado || item.ncm || '',
        item.categoria || '',
        item.descricao_ncm || '',
        item.cProd || '',
        item.xProd || '',
        item.qtd_cupons || 1,
        Number(item.qtd_total || 0),
        item.uCom || 'UN',
        Number(item.preco_medio || 0),
        Number(item.valor_total || 0),
        `${Number(item.percentual || 0).toFixed(2)}%`
      ])
    })

  } else if (tipo === 'quebra') {
    sheetName = 'Quebras de Sequência'
    rows.push(['RELATÓRIO DE QUEBRAS DE SEQUÊNCIA'])
    rows.push(['Modelo', 'Série', 'Intervalo Faltante', 'Qtd. Puladas', 'Nota Anterior', 'Nota Posterior', 'Ação Sugerida'])
    const quebras = dados.quebras_sequencia || []
    quebras.forEach((q: any) => {
      rows.push([
        q.modelo,
        q.serie,
        q.esperado_de === q.esperado_ate ? `Nº ${q.esperado_de}` : `Nº ${q.esperado_de} até ${q.esperado_ate}`,
        q.quantidade_faltante,
        q.anterior_emitido,
        q.posterior_emitido,
        'Inutilizar na SEFAZ'
      ])
    })

  } else if (tipo === 'nao_assinadas') {
    sheetName = 'Não Assinadas'
    rows.push(['NOTAS NÃO ASSINADAS OU SEM PROTOCOLO'])
    rows.push(['Número', 'Chave de Acesso', 'Valor (R$)', 'Data Emissão', 'Assinatura Digital', 'Situação SEFAZ'])
    const lista = [...(dados.nao_assinadas?.nfe || []), ...(dados.nao_assinadas?.nfce || [])]
    lista.forEach((n: any) => {
      rows.push([
        n.numero || '',
        n.chave || '',
        Number(n.valor || 0),
        formatDate(n.data_emissao),
        n.tem_assinatura ? 'Assinada' : 'Sem Assinatura',
        n.motivo_sefaz || (n.cstat ? `cStat: ${n.cstat}` : 'Sem Protocolo')
      ])
    })

  } else if (tipo === 'certificados') {
    sheetName = 'Certificados A1'
    rows.push(['RELATÓRIO DE CERTIFICADOS DIGITAIS A1'])
    rows.push(['Empresa', 'CNPJ', 'Vencimento', 'Dias Restantes', 'Situação', 'WhatsApp'])
    const certList = dados.certificados || []
    certList.forEach((c: any) => {
      rows.push([
        c.razao_social || '',
        c.cnpj || '',
        c.validadeFormatada || '',
        c.dias !== null ? c.dias : '',
        c.status === 'vencido' ? 'VENCIDO' : (c.status === 'alerta' ? 'A VENCER' : 'VÁLIDO'),
        c.whatsapp || ''
      ])
    })
  }

  const ws = XLSX.utils.aoa_to_sheet(rows)
  XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31))
  XLSX.writeFile(wb, `Relatorio_${tipo.toUpperCase()}_${sanitizeFileName(empresa.razao_social)}_${competencia}.xlsx`)
}

// ==========================================
// 3. EXPORTAÇÃO PDF PROFISSIONAL (jspdf)
// ==========================================
export function exportarPDF(
  tipo: TipoRelatorio,
  empresa: EmpresaDados,
  competencia: string,
  dados: any
) {
  // Configura orientação paisagem para relatórios com chave de 44 dígitos
  const orientation = (tipo === 'nfe' || tipo === 'nfce' || tipo === 'consolidado' || tipo === 'monofasicos' || tipo === 'nao_assinadas') ? 'landscape' : 'portrait'
  const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' })
  const dataHoje = new Date().toLocaleString('pt-BR', { timeZone: FUSO_BRASIL })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  // 1. Cabeçalho Corporativo Superior (Banner Azul Escuro)
  doc.setFillColor(30, 41, 59) // slate-800
  doc.rect(0, 0, pageWidth, 24, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('HUB PARATECH - AUDITORIA & GESTÃO FISCAL', 14, 11)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`Competência: ${competencia} | Emissão: ${dataHoje}`, 14, 18)

  // 2. Título do Relatório
  let tituloRelatorio = 'Relatório Fiscal'
  if (tipo === 'nfe') tituloRelatorio = 'Demonstrativo de Vendas - NF-e (Modelo 55)'
  if (tipo === 'nfce') tituloRelatorio = 'Demonstrativo de Vendas - NFC-e (Modelo 65)'
  if (tipo === 'consolidado') tituloRelatorio = 'Faturamento Consolidado & Segregação Fiscal'
  if (tipo === 'monofasicos') tituloRelatorio = 'Auditor de Produtos Monofásicos (PIS & COFINS)'
  if (tipo === 'quebra') tituloRelatorio = 'Auditoria de Quebras de Sequência de Numeração'
  if (tipo === 'nao_assinadas') tituloRelatorio = 'Auditoria de Notas Sem Assinatura / Sem Protocolo'
  if (tipo === 'certificados') tituloRelatorio = 'Controle de Validade dos Certificados Digitais A1'

  doc.setTextColor(30, 58, 138) // blue-900
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text(tituloRelatorio, 14, 32)

  // 3. Caixa de Identificação da Empresa
  doc.setFillColor(248, 250, 252) // slate-50
  doc.setDrawColor(226, 232, 240) // slate-200
  doc.roundedRect(14, 36, pageWidth - 28, 18, 2, 2, 'FD')

  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(51, 65, 85)
  doc.text(`Empresa: ${empresa.razao_social}`, 18, 42)
  doc.text(`CNPJ: ${empresa.cnpj}`, 18, 48)

  doc.setFont('helvetica', 'normal')
  doc.text(`Regime Tributário: ${getRegimeNome(empresa.regime_tributario)}`, pageWidth / 2, 42)
  doc.text(`Contabilidade: ${empresa.contabilidade_nome || 'Não vinculada'}`, pageWidth / 2, 48)

  let startY = 58

  // 4. Cards / Resumos em Destaque
  if (tipo === 'nfe' || tipo === 'nfce') {
    const isNfe = tipo === 'nfe'
    const resumo = isNfe ? dados.consolidado?.nfe : dados.consolidado?.nfce

    doc.setFillColor(239, 246, 255) // blue-50
    doc.setDrawColor(191, 219, 254) // blue-200
    doc.roundedRect(14, startY, 70, 16, 2, 2, 'FD')
    doc.roundedRect(90, startY, 90, 16, 2, 2, 'FD')
    doc.roundedRect(186, startY, 90, 16, 2, 2, 'FD')

    doc.setFontSize(8)
    doc.setTextColor(71, 85, 105)
    doc.text('Quantidade Emitida', 18, startY + 5)
    doc.text('Faturamento Total', 94, startY + 5)
    doc.text('Produtos Monofásicos', 190, startY + 5)

    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(30, 41, 59)
    doc.text(`${resumo?.quantidade || 0} notas`, 18, startY + 12)
    doc.text(`R$ ${formatMoney(resumo?.total || 0)}`, 94, startY + 12)
    doc.setTextColor(180, 83, 9)
    doc.text(`R$ ${formatMoney(resumo?.monofasico || 0)}`, 190, startY + 12)

    startY += 22

    // Tabela Analítica
    const lista = isNfe ? (dados.notas_detalhadas?.nfe || []) : (dados.notas_detalhadas?.nfce || [])
    const tableBody = lista.map((n: any) => [
      n.numero || '—',
      n.serie || '1',
      n.chave || '—',
      formatDate(n.data_emissao),
      `R$ ${formatMoney(n.valor || 0)}`,
      `R$ ${formatMoney(n.valor_monofasico || 0)}`,
      n.protocolo || '—',
      n.cstat === '100' || n.is_autorizada ? 'Autorizada' : 'Pendente'
    ])

    autoTable(doc, {
      startY,
      head: [['Número', 'Série', 'Chave de Acesso', 'Emissão', 'Valor Total', 'Monofásico', 'Protocolo SEFAZ', 'Status']],
      body: tableBody,
      theme: 'striped',
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59] },
      columnStyles: {
        0: { cellWidth: 18, fontStyle: 'bold' },
        1: { cellWidth: 12 },
        2: { cellWidth: 85, font: 'courier' },
        3: { cellWidth: 20 },
        4: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
        5: { cellWidth: 28, halign: 'right' },
        6: { cellWidth: 35 },
        7: { cellWidth: 22, halign: 'center' }
      },
      didDrawPage: (data: any) => {
        // Rodapé da página
        const str = `Página ${data.pageNumber} de ${doc.getNumberOfPages()}`
        doc.setFontSize(8)
        doc.setTextColor(148, 163, 184)
        doc.text(str, pageWidth - 30, pageHeight - 8)
      }
    })

  } else if (tipo === 'consolidado') {
    const c = dados.consolidado

    // Tabela de Resumo Consolidado
    autoTable(doc, {
      startY,
      head: [['Modelo Operacional', 'Qtd. Notas', 'Total Faturado (R$)', 'Dedução Monofásica (R$)', 'Base Tributável Restante (R$)']],
      body: [
        ['NF-e (Modelo 55)', `${c?.nfe?.quantidade || 0}`, `R$ ${formatMoney(c?.nfe?.total || 0)}`, `R$ ${formatMoney(c?.nfe?.monofasico || 0)}`, '—'],
        ['NFC-e (Modelo 65)', `${c?.nfce?.quantidade || 0}`, `R$ ${formatMoney(c?.nfce?.total || 0)}`, `R$ ${formatMoney(c?.nfce?.monofasico || 0)}`, '—'],
        ['TOTAL CONSOLIDADO', `${c?.geral?.quantidade_total || 0}`, `R$ ${formatMoney(c?.geral?.total_faturado || 0)}`, `R$ ${formatMoney(c?.geral?.total_monofasico || 0)}`, `R$ ${formatMoney(c?.geral?.total_tributavel_restante || 0)}`]
      ],
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
      bodyStyles: { fontSize: 8.5, fontStyle: 'normal' },
      footStyles: { fillColor: [241, 245, 249], fontStyle: 'bold' }
    })

    let currentPdfY = (doc as any).lastAutoTable.finalY + 6

    // Tabela de Modalidades de Pagamento no Consolidado (se houver)
    if (dados.formas_pagamento && dados.formas_pagamento.length > 0) {
      const fps = dados.formas_pagamento
      autoTable(doc, {
        startY: currentPdfY,
        head: [['Modalidade de Pagamento', 'Total Recebido (R$)', 'Qtd. Notas/Cupons', '% do Faturamento']],
        body: fps.map((fp: any) => [
          fp.nome,
          `R$ ${formatMoney(fp.total || 0)}`,
          `${fp.quantidade}`,
          `${fp.percentual || 0}%`
        ]),
        theme: 'striped',
        headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59] },
        columnStyles: {
          0: { fontStyle: 'bold' },
          1: { halign: 'right', fontStyle: 'bold' },
          2: { halign: 'center' },
          3: { halign: 'right' }
        }
      })
      currentPdfY = (doc as any).lastAutoTable.finalY + 8
    }

    // Relação Analítica de Notas
    const todos = [
      ...(dados.notas_detalhadas?.nfe || []).map((n: any) => ({ ...n, modelo: '55' })),
      ...(dados.notas_detalhadas?.nfce || []).map((n: any) => ({ ...n, modelo: '65' }))
    ]

    const tableBody = todos.map((n: any) => [
      `Mod ${n.modelo}`,
      n.numero || '—',
      n.serie || '1',
      n.chave || '—',
      formatDate(n.data_emissao),
      `R$ ${formatMoney(n.valor || 0)}`,
      `R$ ${formatMoney(n.valor_monofasico || 0)}`,
      n.protocolo || '—'
    ])

    autoTable(doc, {
      startY: currentPdfY,
      head: [['Mod', 'Número', 'Série', 'Chave de Acesso', 'Emissão', 'Valor Total', 'Monofásico', 'Protocolo']],
      body: tableBody,
      theme: 'striped',
      headStyles: { fillColor: [71, 85, 105], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
      bodyStyles: { fontSize: 7, textColor: [30, 41, 59] },
      columnStyles: {
        0: { cellWidth: 16 },
        1: { cellWidth: 18, fontStyle: 'bold' },
        2: { cellWidth: 12 },
        3: { cellWidth: 90, font: 'courier' },
        4: { cellWidth: 20 },
        5: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
        6: { cellWidth: 28, halign: 'right' },
        7: { cellWidth: 35 }
      },
      didDrawPage: (data: any) => {
        const str = `Página ${data.pageNumber} de ${doc.getNumberOfPages()}`
        doc.setFontSize(8)
        doc.setTextColor(148, 163, 184)
        doc.text(str, pageWidth - 30, pageHeight - 8)
      }
    })

  } else if (tipo === 'pagamentos') {
    const fps = dados.formas_pagamento || []
    const totalGeral = dados.consolidado?.geral?.total_faturado || 0
    const qtdNotas = dados.consolidado?.geral?.quantidade_total || 0

    doc.setFillColor(240, 253, 250) // teal-50
    doc.setDrawColor(153, 246, 228) // teal-200
    doc.roundedRect(14, startY, 80, 16, 2, 2, 'FD')
    doc.roundedRect(100, startY, 80, 16, 2, 2, 'FD')
    doc.roundedRect(186, startY, 90, 16, 2, 2, 'FD')

    doc.setFontSize(8)
    doc.setTextColor(15, 118, 110)
    doc.text('Faturamento Total', 18, startY + 5)
    doc.text('Quantidade de Notas', 104, startY + 5)
    doc.text('Modalidade Principal', 190, startY + 5)

    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(19, 78, 74)
    doc.text(`R$ ${formatMoney(totalGeral)}`, 18, startY + 12)
    doc.text(`${qtdNotas} notas/cupons`, 104, startY + 12)
    const principal = fps[0] ? `${fps[0].nome} (${fps[0].percentual || 0}%)` : '—'
    doc.text(principal, 190, startY + 12)

    startY += 22

    // Tabela Consolidada de Modalidades de Pagamento
    autoTable(doc, {
      startY,
      head: [['Modalidade de Pagamento', 'Total Recebido (R$)', 'Qtd. Cupons/Notas', '% Participação']],
      body: fps.map((fp: any) => [
        fp.nome,
        `R$ ${formatMoney(fp.total || 0)}`,
        `${fp.quantidade}`,
        `${fp.percentual || 0}%`
      ]),
      theme: 'grid',
      headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
      bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
      columnStyles: {
        0: { fontStyle: 'bold' },
        1: { halign: 'right', fontStyle: 'bold' },
        2: { halign: 'center' },
        3: { halign: 'right' }
      }
    })

    const finalYPag = (doc as any).lastAutoTable.finalY + 8

    // Tabela Analítica das Notas com suas respectivas Formas de Pagamento
    const todos = [
      ...(dados.notas_detalhadas?.nfe || []).map((n: any) => ({ ...n, modelo: '55' })),
      ...(dados.notas_detalhadas?.nfce || []).map((n: any) => ({ ...n, modelo: '65' }))
    ]

    const tableBodyPag: any[] = []
    todos.forEach((n: any) => {
      if (Array.isArray(n.formas_pagamento) && n.formas_pagamento.length > 0) {
        n.formas_pagamento.forEach((fp: any) => {
          tableBodyPag.push([
            `Mod ${n.modelo}`,
            n.numero || '—',
            n.serie || '1',
            n.chave || '—',
            formatDate(n.data_emissao),
            `R$ ${formatMoney(n.valor || 0)}`,
            fp.nome || 'Outros',
            `R$ ${formatMoney(fp.valor || 0)}`
          ])
        })
      } else {
        tableBodyPag.push([
          `Mod ${n.modelo}`,
          n.numero || '—',
          n.serie || '1',
          n.chave || '—',
          formatDate(n.data_emissao),
          `R$ ${formatMoney(n.valor || 0)}`,
          'Outros',
          `R$ ${formatMoney(n.valor || 0)}`
        ])
      }
    })

    autoTable(doc, {
      startY: finalYPag,
      head: [['Mod', 'Número', 'Série', 'Chave de Acesso', 'Emissão', 'Valor Total', 'Forma Pagamento', 'Valor Parcela']],
      body: tableBodyPag,
      theme: 'striped',
      headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
      bodyStyles: { fontSize: 7, textColor: [30, 41, 59] },
      columnStyles: {
        0: { cellWidth: 16 },
        1: { cellWidth: 18, fontStyle: 'bold' },
        2: { cellWidth: 12 },
        3: { cellWidth: 85, font: 'courier' },
        4: { cellWidth: 20 },
        5: { cellWidth: 25, halign: 'right' },
        6: { cellWidth: 40, fontStyle: 'bold' },
        7: { cellWidth: 25, halign: 'right', fontStyle: 'bold' }
      },
      didDrawPage: (data: any) => {
        const str = `Página ${data.pageNumber} de ${doc.getNumberOfPages()}`
        doc.setFontSize(8)
        doc.setTextColor(148, 163, 184)
        doc.text(str, pageWidth - 30, pageHeight - 8)
      }
    })

  } else if (tipo === 'monofasicos') {
    const c = dados.consolidado

    autoTable(doc, {
      startY,
      head: [['Demonstrativo PGDAS-D', 'Valor (R$)', 'Observação Tributária']],
      body: [
        ['Faturamento Bruto Consolidado', `R$ ${formatMoney(c?.geral?.total_faturado || 0)}`, 'Soma de todas as vendas do período'],
        ['(-) Dedução Produtos Monofásicos', `R$ ${formatMoney(c?.geral?.total_monofasico || 0)}`, 'Alíquota Zero de PIS e COFINS na revenda (Segregação DAS)'],
        ['(=) Base Tributável Restante', `R$ ${formatMoney(c?.geral?.total_tributavel_restante || 0)}`, 'Base para cálculo dos tributos restantes']
      ],
      theme: 'grid',
      headStyles: { fillColor: [180, 83, 9], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
      bodyStyles: { fontSize: 8.5 }
    })

    const finalY = (doc as any).lastAutoTable.finalY + 8

    const monofList = [
      ...(dados.notas_detalhadas?.nfe || []).filter((n: any) => (n.valor_monofasico || 0) > 0).map((n: any) => ({ ...n, modelo: '55' })),
      ...(dados.notas_detalhadas?.nfce || []).filter((n: any) => (n.valor_monofasico || 0) > 0).map((n: any) => ({ ...n, modelo: '65' }))
    ]

    const tableBody = monofList.map((n: any) => [
      `Mod ${n.modelo}`,
      n.numero || '—',
      n.serie || '1',
      n.chave || '—',
      formatDate(n.data_emissao),
      `R$ ${formatMoney(n.valor || 0)}`,
      `R$ ${formatMoney(n.valor_monofasico || 0)}`
    ])

    autoTable(doc, {
      startY: finalY,
      head: [['Mod', 'Número', 'Série', 'Chave de Acesso', 'Data', 'Valor da Nota', 'Valor Monofásico Segregado']],
      body: tableBody,
      theme: 'striped',
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
      bodyStyles: { fontSize: 7, textColor: [30, 41, 59] },
      columnStyles: {
        0: { cellWidth: 16 },
        1: { cellWidth: 18, fontStyle: 'bold' },
        2: { cellWidth: 12 },
        3: { cellWidth: 100, font: 'courier' },
        4: { cellWidth: 22 },
        5: { cellWidth: 32, halign: 'right' },
        6: { cellWidth: 35, halign: 'right', fontStyle: 'bold', textColor: [180, 83, 9] }
      },
      didDrawPage: (data: any) => {
        const str = `Página ${data.pageNumber} de ${doc.getNumberOfPages()}`
        doc.setFontSize(8)
        doc.setTextColor(148, 163, 184)
        doc.text(str, pageWidth - 30, pageHeight - 8)
      }
    })

  } else if (tipo === 'monofasicos_produtos_analitico') {
    const lista = dados.produtos || []
    const totalValor = dados.total_valor || lista.reduce((a: number, b: any) => a + (b.vProd || 0), 0)

    // Caixa de Resumo
    autoTable(doc, {
      startY,
      head: [['Relatório Analítico de Itens Monofásicos', 'Filtro Aplicado', 'Qtd. Itens', 'Total Monofásico (R$)']],
      body: [
        [
          'Discriminação detalhada de produtos por cupom/nota',
          dados.filtro_rotulo || 'Todos os Produtos',
          `${lista.length} item(ns)`,
          `R$ ${formatMoney(totalValor)}`
        ]
      ],
      theme: 'grid',
      headStyles: { fillColor: [180, 83, 9], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8 }
    })

    const finalY = (doc as any).lastAutoTable.finalY + 6

    const tableBody = lista.map((item: any) => [
      `Nº ${item.cupom_numero || '—'}`,
      item.modelo === '65' ? 'NFC-e' : 'NF-e',
      formatDate(item.data_emissao),
      item.cProd || '—',
      item.xProd || '—',
      item.ncm_formatado || item.ncm || '—',
      item.descricao_ncm || item.categoria || '—',
      Number(item.qCom || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
      item.uCom || 'UN',
      `R$ ${formatMoney(item.vUnCom || 0)}`,
      `R$ ${formatMoney(item.vProd || 0)}`,
      item.cst || '04'
    ])

    autoTable(doc, {
      startY: finalY,
      head: [['Cupom/Nota', 'Mod', 'Data', 'Cód.', 'Descrição do Produto', 'NCM', 'Classificação / Categoria', 'Qtd', 'Un', 'Vlr Unit', 'Vlr Total', 'CST']],
      body: tableBody,
      theme: 'striped',
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
      bodyStyles: { fontSize: 7, textColor: [30, 41, 59] },
      columnStyles: {
        0: { cellWidth: 20, fontStyle: 'bold', textColor: [29, 78, 216] },
        1: { cellWidth: 12 },
        2: { cellWidth: 18 },
        3: { cellWidth: 14, font: 'courier' },
        4: { cellWidth: 60, fontStyle: 'bold' },
        5: { cellWidth: 22, font: 'courier' },
        6: { cellWidth: 45 },
        7: { cellWidth: 14, halign: 'right' },
        8: { cellWidth: 10, halign: 'center' },
        9: { cellWidth: 20, halign: 'right' },
        10: { cellWidth: 22, halign: 'right', fontStyle: 'bold', textColor: [180, 83, 9] },
        11: { cellWidth: 12, halign: 'center' }
      },
      didDrawPage: (data: any) => {
        const str = `Página ${data.pageNumber} de ${doc.getNumberOfPages()}`
        doc.setFontSize(8)
        doc.setTextColor(148, 163, 184)
        doc.text(str, pageWidth - 30, pageHeight - 8)
      }
    })

  } else if (tipo === 'monofasicos_produtos_agrupado') {
    const lista = dados.produtos_agrupados || []
    const totalValor = dados.total_valor || lista.reduce((a: number, b: any) => a + (b.valor_total || 0), 0)

    // Caixa de Resumo
    autoTable(doc, {
      startY,
      head: [['Relatório Agrupado de Produtos Monofásicos', 'Filtro Aplicado', 'Produtos Distintos', 'Total Monofásico (R$)']],
      body: [
        [
          'Consolidação sintetizada por produto e NCM',
          dados.filtro_rotulo || 'Todos os Produtos',
          `${lista.length} produto(s)`,
          `R$ ${formatMoney(totalValor)}`
        ]
      ],
      theme: 'grid',
      headStyles: { fillColor: [180, 83, 9], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8 }
    })

    const finalY = (doc as any).lastAutoTable.finalY + 6

    const tableBody = lista.map((item: any) => [
      item.ncm_formatado || item.ncm || '—',
      item.categoria || '—',
      item.descricao_ncm || '—',
      item.cProd || '—',
      item.xProd || '—',
      `${item.qtd_cupons || 1} cupom(ns)`,
      Number(item.qtd_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
      item.uCom || 'UN',
      `R$ ${formatMoney(item.preco_medio || 0)}`,
      `R$ ${formatMoney(item.valor_total || 0)}`,
      `${Number(item.percentual || 0).toFixed(1)}%`
    ])

    autoTable(doc, {
      startY: finalY,
      head: [['NCM', 'Categoria', 'Classificação NCM', 'Cód.', 'Descrição do Produto', 'Frequência', 'Qtd Total', 'Un', 'Preço Médio', 'Valor Total', '% Total']],
      body: tableBody,
      theme: 'striped',
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
      bodyStyles: { fontSize: 7, textColor: [30, 41, 59] },
      columnStyles: {
        0: { cellWidth: 22, font: 'courier', fontStyle: 'bold' },
        1: { cellWidth: 22 },
        2: { cellWidth: 46 },
        3: { cellWidth: 14, font: 'courier' },
        4: { cellWidth: 62, fontStyle: 'bold' },
        5: { cellWidth: 24, halign: 'center' },
        6: { cellWidth: 18, halign: 'right' },
        7: { cellWidth: 10, halign: 'center' },
        8: { cellWidth: 22, halign: 'right' },
        9: { cellWidth: 24, halign: 'right', fontStyle: 'bold', textColor: [180, 83, 9] },
        10: { cellWidth: 15, halign: 'right' }
      },
      didDrawPage: (data: any) => {
        const str = `Página ${data.pageNumber} de ${doc.getNumberOfPages()}`
        doc.setFontSize(8)
        doc.setTextColor(148, 163, 184)
        doc.text(str, pageWidth - 30, pageHeight - 8)
      }
    })

  } else if (tipo === 'quebra') {
    const quebras = dados.quebras_sequencia || []
    const tableBody = quebras.map((q: any) => [
      q.modelo,
      `Série ${q.serie}`,
      q.esperado_de === q.esperado_ate ? `Nº ${q.esperado_de}` : `Nº ${q.esperado_de} até ${q.esperado_ate}`,
      `${q.quantidade_faltante} nota(s)`,
      `Nº ${q.anterior_emitido}`,
      `Nº ${q.posterior_emitido}`,
      'Pendente / Inutilizar'
    ])

    autoTable(doc, {
      startY,
      head: [['Modelo', 'Série', 'Intervalo Faltante', 'Qtd. Pulada', 'Nota Anterior', 'Nota Posterior', 'Status']],
      body: tableBody,
      theme: 'striped',
      headStyles: { fillColor: [185, 28, 28], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
      bodyStyles: { fontSize: 8 },
      didDrawPage: (data: any) => {
        const str = `Página ${data.pageNumber} de ${doc.getNumberOfPages()}`
        doc.setFontSize(8)
        doc.setTextColor(148, 163, 184)
        doc.text(str, pageWidth - 30, pageHeight - 8)
      }
    })

  } else if (tipo === 'nao_assinadas') {
    const lista = [...(dados.nao_assinadas?.nfe || []), ...(dados.nao_assinadas?.nfce || [])]
    const tableBody = lista.map((n: any) => [
      n.numero || '—',
      n.chave || '—',
      `R$ ${formatMoney(n.valor || 0)}`,
      formatDate(n.data_emissao),
      n.tem_assinatura ? 'Assinada' : 'Sem Assinatura',
      n.motivo_sefaz || (n.cstat ? `cStat: ${n.cstat}` : 'Sem Protocolo')
    ])

    autoTable(doc, {
      startY,
      head: [['Número', 'Chave de Acesso', 'Valor (R$)', 'Emissão', 'Assinatura', 'Situação SEFAZ']],
      body: tableBody,
      theme: 'striped',
      headStyles: { fillColor: [194, 65, 12], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 7.5 },
      columnStyles: {
        0: { cellWidth: 20, fontStyle: 'bold' },
        1: { cellWidth: 110, font: 'courier' },
        2: { cellWidth: 30, halign: 'right' },
        3: { cellWidth: 25 },
        4: { cellWidth: 30, halign: 'center' },
        5: { cellWidth: 50 }
      },
      didDrawPage: (data: any) => {
        const str = `Página ${data.pageNumber} de ${doc.getNumberOfPages()}`
        doc.setFontSize(8)
        doc.setTextColor(148, 163, 184)
        doc.text(str, pageWidth - 30, pageHeight - 8)
      }
    })

  } else if (tipo === 'certificados') {
    const certList = dados.certificados || []
    const tableBody = certList.map((c: any) => [
      c.razao_social || '—',
      c.cnpj || '—',
      c.validadeFormatada || '—',
      c.dias !== null ? `${c.dias} dias` : '—',
      c.status === 'vencido' ? 'VENCIDO' : (c.status === 'alerta' ? 'A VENCER' : 'VÁLIDO'),
      c.whatsapp || '—'
    ])

    autoTable(doc, {
      startY,
      head: [['Empresa', 'CNPJ', 'Vencimento', 'Dias Restantes', 'Status', 'WhatsApp']],
      body: tableBody,
      theme: 'striped',
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
      bodyStyles: { fontSize: 8 },
      didDrawPage: (data: any) => {
        const str = `Página ${data.pageNumber} de ${doc.getNumberOfPages()}`
        doc.setFontSize(8)
        doc.setTextColor(148, 163, 184)
        doc.text(str, pageWidth - 30, pageHeight - 8)
      }
    })
  }

  doc.save(`Relatorio_${tipo.toUpperCase()}_${sanitizeFileName(empresa.razao_social)}_${competencia}.pdf`)
}

// ==========================================
// 4. FUNÇÃO CONSOLIDADORA UNIVERSAL
// ==========================================
export function exportarRelatorioIndividual(
  tipo: TipoRelatorio,
  formato: FormatoExportacao,
  empresa: EmpresaDados,
  competencia: string,
  dados: any
) {
  if (formato === 'pdf') {
    exportarPDF(tipo, empresa, competencia, dados)
  } else if (formato === 'excel' || formato === 'xls') {
    exportarExcel(tipo, empresa, competencia, dados)
  } else if (formato === 'csv') {
    exportarCSV(tipo, empresa, competencia, dados)
  }
}
