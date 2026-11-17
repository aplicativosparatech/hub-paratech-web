'use client'

import React, { useState, useMemo } from 'react'
import { 
  Calculator, Download, FileText, CheckCircle2, TrendingUp, 
  ShieldCheck, AlertCircle, FileSpreadsheet, Sparkles, ArrowDownRight,
  Layers, Percent, Coins, Building, Receipt, ExternalLink
} from 'lucide-react'
import toast from 'react-hot-toast'
import { 
  calcularEstimativaDasSimples, 
  gerarArquivoSintegraTxt, 
  gerarArquivoSpedFiscalTxt, 
  gerarArquivoSpedContribuicoesTxt, 
  gerarDemonstrativoDasPdf,
  dispararDownloadTexto,
  DadosEmpresaSped,
  NotaFiscalItemSped
} from '@/utils/tributario/estimativaContabilSpedEngine'

interface EstimativaContabilTabProps {
  empresa: DadosEmpresaSped
  competencia: string // YYYY-MM
  auditData: any
}

export default function EstimativaContabilTab({
  empresa,
  competencia,
  auditData
}: EstimativaContabilTabProps) {
  const [gerandoArquivo, setGerandoArquivo] = useState<string | null>(null)

  // Extração das notas fiscais e consolidação de faturamento
  const { notasFormatadas, totalFaturado, totalMonofasico, totalIcmsSt } = useMemo(() => {
    if (!auditData) {
      return { notasFormatadas: [], totalFaturado: 0, totalMonofasico: 0, totalIcmsSt: 0 }
    }

    const nfeList: any[] = auditData.notas_detalhadas?.nfe || []
    const nfceList: any[] = auditData.notas_detalhadas?.nfce || []

    const formatadas: NotaFiscalItemSped[] = [
      ...nfeList.map((n: any) => ({
        numero: String(n.numero || ''),
        serie: String(n.serie || '1'),
        chave: String(n.chave || ''),
        data_emissao: n.data_emissao || '',
        valor: Number(n.valor || 0),
        valor_monofasico: Number(n.valor_monofasico || 0),
        tipo: 'nfe' as const,
        destinatario: n.destinatario_nome,
        cnpj_destinatario: n.destinatario_cnpj
      })),
      ...nfceList.map((n: any) => ({
        numero: String(n.numero || ''),
        serie: String(n.serie || '1'),
        chave: String(n.chave || ''),
        data_emissao: n.data_emissao || '',
        valor: Number(n.valor || 0),
        valor_monofasico: Number(n.valor_monofasico || 0),
        tipo: 'nfce' as const
      }))
    ]

    const faturadoCalculado = formatadas.reduce((acc, n) => acc + (n.valor || 0), 0)
    const monofasicoCalculado = formatadas.reduce((acc, n) => acc + (n.valor_monofasico || 0), 0)

    const faturado = Number(
      auditData.consolidado?.geral?.total_faturado ??
      auditData.consolidado?.total_faturado ??
      auditData.consolidado?.total_geral ??
      faturadoCalculado
    )
    const monofasico = Number(
      auditData.consolidado?.geral?.total_monofasico ??
      auditData.consolidado?.total_monofasico ??
      monofasicoCalculado
    )
    // Se não houver segregação específica de ST no resumo, estimamos ST baseado nas notas de saída
    const icmsSt = monofasico * 0.95 // Bebidas/peças geralmente são simultaneamente ST + Monofásicos

    return {
      notasFormatadas: formatadas,
      totalFaturado: faturado,
      totalMonofasico: monofasico,
      totalIcmsSt: icmsSt
    }
  }, [auditData])

  // Cálculo da Estimativa Contábil
  const estimativa = useMemo(() => {
    return calcularEstimativaDasSimples(totalFaturado, totalMonofasico, totalIcmsSt)
  }, [totalFaturado, totalMonofasico, totalIcmsSt])

  const formatMoney = (val: number) => {
    return (val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  // Handlers de geração dos arquivos fiscais
  const handleGerarSintegra = () => {
    try {
      setGerandoArquivo('sintegra')
      const txt = gerarArquivoSintegraTxt(empresa, competencia, notasFormatadas)
      const nome = `SINTEGRA_${empresa.cnpj.replace(/\D/g, '')}_${competencia.replace('-', '')}.txt`
      dispararDownloadTexto(txt, nome)
      toast.success('Arquivo SINTEGRA (Convênio 57/95) gerado com sucesso!')
    } catch (e: any) {
      toast.error('Erro ao gerar SINTEGRA: ' + e.message)
    } finally {
      setGerandoArquivo(null)
    }
  }

  const handleGerarSpedFiscal = () => {
    try {
      setGerandoArquivo('sped_fiscal')
      const txt = gerarArquivoSpedFiscalTxt(empresa, competencia, notasFormatadas)
      const nome = `SPED_EFD_ICMS_IPI_${empresa.cnpj.replace(/\D/g, '')}_${competencia.replace('-', '')}.txt`
      dispararDownloadTexto(txt, nome)
      toast.success('Arquivo SPED Fiscal (EFD ICMS/IPI) gerado com sucesso!')
    } catch (e: any) {
      toast.error('Erro ao gerar SPED Fiscal: ' + e.message)
    } finally {
      setGerandoArquivo(null)
    }
  }

  const handleGerarSpedContribuicoes = () => {
    try {
      setGerandoArquivo('sped_contribuicoes')
      const txt = gerarArquivoSpedContribuicoesTxt(empresa, competencia, notasFormatadas)
      const nome = `SPED_EFD_CONTRIBUICOES_${empresa.cnpj.replace(/\D/g, '')}_${competencia.replace('-', '')}.txt`
      dispararDownloadTexto(txt, nome)
      toast.success('Arquivo SPED EFD Contribuições gerado com sucesso!')
    } catch (e: any) {
      toast.error('Erro ao gerar SPED Contribuições: ' + e.message)
    } finally {
      setGerandoArquivo(null)
    }
  }

  // Handler para geração do Extrato / Espelho Oficial da Guia DAS em PDF
  const handleGerarDemonstrativoDas = () => {
    try {
      setGerandoArquivo('das_pdf')
      gerarDemonstrativoDasPdf(empresa, competencia, estimativa, notasFormatadas.length)
      toast.success('Espelho Oficial da Guia DAS gerado com sucesso em PDF!')
    } catch (e: any) {
      toast.error('Erro ao gerar Espelho da Guia DAS: ' + e.message)
    } finally {
      setGerandoArquivo(null)
    }
  }

  // Handler para abertura do portal oficial PGDAS-D da Receita Federal
  const handleAbrirPgdasReceita = () => {
    try {
      const cnpjClean = (empresa.cnpj || '').replace(/\D/g, '')
      if (cnpjClean && typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(cnpjClean)
        toast.success(`CNPJ (${empresa.cnpj}) copiado! Abrindo o portal oficial do Simples Nacional / PGDAS-D...`)
      } else {
        toast.success('Abrindo o portal oficial do Simples Nacional / PGDAS-D...')
      }
      window.open(
        'https://www8.receita.fazenda.gov.br/SimplesNacional/ControleAcesso/Autentica.aspx?url=https://www8.receita.fazenda.gov.br/SimplesNacional/Aplicacoes/ATSPO/pgdasd.app/',
        '_blank'
      )
    } catch (e: any) {
      window.open('https://www8.receita.fazenda.gov.br/SimplesNacional/', '_blank')
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* CABEÇALHO DA ABA */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-bold text-slate-900">Estimativa Contábil & Guias (Simples Nacional)</h3>
            <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <Sparkles size={12} /> Segregação Tributária Inteligente
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Apuração automatizada do PGDAS-D com abatimento legal de Monofásicos (PIS/COFINS) e ICMS-ST, mais geração de arquivos SINTEGRA e SPEDs.
          </p>
        </div>

        {/* BOTÕES DE OBRIGAÇÕES ACESSÓRIAS & GUIA DAS */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Botão Emitir Espelho Guia DAS */}
          <button
            onClick={handleGerarDemonstrativoDas}
            disabled={gerandoArquivo !== null}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition shadow-sm disabled:opacity-50 cursor-pointer"
            title="Gera e baixa o Espelho Oficial do PGDAS-D com cálculo da Guia DAS e segregação tributária em PDF"
          >
            <FileText size={14} /> Espelho Guia DAS (.pdf)
          </button>

          {/* Botão Emitir no PGDAS-D Receita Federal */}
          <button
            onClick={handleAbrirPgdasReceita}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition shadow-sm cursor-pointer"
            title="Abre o portal oficial do Simples Nacional / PGDAS-D da Receita Federal e copia o CNPJ da empresa"
          >
            <ExternalLink size={14} /> Emitir no PGDAS-D (Receita)
          </button>

          <button
            onClick={handleGerarSintegra}
            disabled={gerandoArquivo !== null}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl transition shadow-sm disabled:opacity-50 cursor-pointer"
            title="Gera arquivo texto no formato Convênio ICMS 57/95"
          >
            <Download size={14} /> SINTEGRA (.txt)
          </button>

          <button
            onClick={handleGerarSpedFiscal}
            disabled={gerandoArquivo !== null}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition shadow-sm disabled:opacity-50 cursor-pointer"
            title="Gera arquivo do SPED Fiscal EFD ICMS/IPI"
          >
            <Download size={14} /> SPED Fiscal (.txt)
          </button>

          <button
            onClick={handleGerarSpedContribuicoes}
            disabled={gerandoArquivo !== null}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition shadow-sm disabled:opacity-50 cursor-pointer"
            title="Gera arquivo do SPED EFD Contribuições (PIS/COFINS)"
          >
            <Download size={14} /> SPED PIS/COFINS (.txt)
          </button>
        </div>
      </div>

      {/* CARDS DE DESTAQUE TRIBUTÁRIO & ECONOMIA */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Faturamento Bruto (RBM) */}
        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Receita Bruta do Mês</span>
            <Receipt size={18} className="text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            R$ {formatMoney(estimativa.rbm)}
          </div>
          <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
            <span>Competência: <b>{competencia}</b></span>
          </div>
        </div>

        {/* Card 2: Faturamento Monofásico & ST */}
        <div className="bg-amber-50/50 p-5 rounded-2xl border border-amber-200">
          <div className="flex items-center justify-between text-amber-700 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Segregação Tributária</span>
            <Coins size={18} className="text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-900">
            R$ {formatMoney(estimativa.faturamentoMonofasicoPisCofins)}
          </div>
          <div className="text-xs text-amber-700 mt-1">
            {((estimativa.faturamentoMonofasicoPisCofins / (estimativa.rbm || 1)) * 100).toFixed(1)}% faturado em Monofásicos/ST
          </div>
        </div>

        {/* Card 3: Guia DAS Estimada com Segregação */}
        <div className="bg-blue-50/50 p-5 rounded-2xl border border-blue-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-blue-700 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Guia DAS Estimada</span>
              <Calculator size={18} className="text-blue-500" />
            </div>
            <div className="text-2xl font-black text-blue-900">
              R$ {formatMoney(estimativa.valorDasComSegregacao)}
            </div>
            <div className="text-xs text-blue-600 mt-1">
              Alíquota Efetiva: <b>{estimativa.aliquotaEfetiva.toFixed(2)}%</b>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-blue-100 flex items-center gap-2">
            <button
              onClick={handleGerarDemonstrativoDas}
              className="text-[11px] font-bold text-blue-700 hover:text-blue-900 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <FileText size={12} /> Espelho PDF
            </button>
            <span className="text-blue-300">•</span>
            <button
              onClick={handleAbrirPgdasReceita}
              className="text-[11px] font-bold text-amber-700 hover:text-amber-900 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <ExternalLink size={12} /> PGDAS-D
            </button>
          </div>
        </div>

        {/* Card 4: Economia Fiscal Real */}
        <div className="bg-emerald-50 p-5 rounded-2xl border border-emerald-300">
          <div className="flex items-center justify-between text-emerald-800 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Economia Obtida</span>
            <TrendingUp size={18} className="text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700 flex items-center gap-1">
            R$ {formatMoney(estimativa.economiaMes)}
          </div>
          <div className="text-xs font-bold text-emerald-700 mt-1 flex items-center gap-1">
            <ArrowDownRight size={14} /> Redução de {estimativa.percentualEconomia.toFixed(1)}% no DAS
          </div>
        </div>
      </div>

      {/* COMPARATIVO DE TRIBUTAÇÃO */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="text-blue-600" size={18} />
            <h4 className="font-bold text-slate-800 text-sm">Demonstrativo de Economia Fiscal — Simples Nacional</h4>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Base Legal: Lei Complementar 123/2006 & Resoluções CGSN
          </span>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Cenário 1: Sem Segregação */}
            <div className="p-5 rounded-xl border border-red-200 bg-red-50/30">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold text-red-900">❌ Pagamento SEM Segregação (Convencional)</span>
                <span className="text-xs bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded">Tributação Cheia</span>
              </div>
              <p className="text-xs text-slate-600 mb-4">
                Ocorre quando a contabilidade declara 100% da receita como mercadoria comum, pagando ICMS, PIS e COFINS em duplicidade.
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-1 border-b border-red-100">
                  <span className="text-slate-600">Receita Total:</span>
                  <span className="font-semibold text-slate-800">R$ {formatMoney(estimativa.rbm)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-red-100">
                  <span className="text-slate-600">Alíquota Efetiva:</span>
                  <span className="font-semibold text-slate-800">{estimativa.aliquotaEfetiva.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between py-1 pt-2 font-bold text-base text-red-700">
                  <span>Guia DAS a Pagar:</span>
                  <span>R$ {formatMoney(estimativa.valorDasSemSegregacao)}</span>
                </div>
              </div>
            </div>

            {/* Cenário 2: Com Segregação Paratech */}
            <div className="p-5 rounded-xl border border-emerald-300 bg-emerald-50/40">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold text-emerald-900">✅ Pagamento COM Segregação Paratech</span>
                <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">Economia Máxima</span>
              </div>
              <p className="text-xs text-slate-600 mb-4">
                Abatimento das parcelas de PIS/COFINS sobre produtos monofásicos (CST 04) e abatimento de ICMS sobre produtos com ST (CSOSN 500).
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-1 border-b border-emerald-100">
                  <span className="text-slate-600">Abatimento ICMS-ST:</span>
                  <span className="font-semibold text-emerald-700">- R$ {formatMoney(estimativa.valorDasSemSegregacao * 0.34 * (estimativa.faturamentoSubstituicaoIcms / (estimativa.rbm || 1)))}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-emerald-100">
                  <span className="text-slate-600">Abatimento PIS/COFINS:</span>
                  <span className="font-semibold text-emerald-700">- R$ {formatMoney(estimativa.valorDasSemSegregacao * 0.155 * (estimativa.faturamentoMonofasicoPisCofins / (estimativa.rbm || 1)))}</span>
                </div>
                <div className="flex justify-between py-1 pt-2 font-bold text-base text-emerald-700">
                  <span>Guia DAS com Desconto Legal:</span>
                  <span>R$ {formatMoney(estimativa.valorDasComSegregacao)}</span>
                </div>
                <div className="mt-4 pt-3 border-t border-emerald-200/80 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-emerald-800 font-medium">Economia Líquida: <b>R$ {formatMoney(estimativa.economiaMes)}</b></span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleGerarDemonstrativoDas}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition flex items-center gap-1 shadow-sm cursor-pointer"
                    >
                      <Download size={13} /> Baixar Espelho Guia DAS (PDF)
                    </button>
                    <button
                      onClick={handleAbrirPgdasReceita}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg transition flex items-center gap-1 shadow-sm cursor-pointer"
                    >
                      <ExternalLink size={13} /> Emitir no PGDAS-D
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ESPELHO DETALHADO POR IMPOSTO (PGDAS-D) */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-5 bg-slate-50/80 border-b border-slate-200">
          <h4 className="font-bold text-slate-800 text-sm">Espelho de Apuração dos Tributos Federais e Estaduais</h4>
          <p className="text-xs text-slate-500 mt-0.5">Valores correspondentes a cada tributo que compõe a Guia DAS do Simples Nacional</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs font-bold text-slate-600 uppercase border-b border-slate-200">
              <tr>
                <th className="p-4">Tributo</th>
                <th className="p-4">Natureza</th>
                <th className="p-4">Base Aplicável</th>
                <th className="p-4">Benefício / Abatimento</th>
                <th className="p-4 text-right">Valor Parcela (R$)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="p-4 font-bold text-slate-800">IRPJ</td>
                <td className="p-4">Federal</td>
                <td className="p-4">Receita Total</td>
                <td className="p-4 text-slate-400">—</td>
                <td className="p-4 text-right font-semibold">R$ {formatMoney(estimativa.parcelas.irpj)}</td>
              </tr>
              <tr>
                <td className="p-4 font-bold text-slate-800">CSLL</td>
                <td className="p-4">Federal</td>
                <td className="p-4">Receita Total</td>
                <td className="p-4 text-slate-400">—</td>
                <td className="p-4 text-right font-semibold">R$ {formatMoney(estimativa.parcelas.csll)}</td>
              </tr>
              <tr>
                <td className="p-4 font-bold text-slate-800">CPP (Previdência)</td>
                <td className="p-4">Federal</td>
                <td className="p-4">Receita Total</td>
                <td className="p-4 text-slate-400">—</td>
                <td className="p-4 text-right font-semibold">R$ {formatMoney(estimativa.parcelas.cpp)}</td>
              </tr>
              <tr className="bg-amber-50/30">
                <td className="p-4 font-bold text-amber-900">PIS / PASEP</td>
                <td className="p-4">Federal</td>
                <td className="p-4">Receita Líquida de Monofásicos</td>
                <td className="p-4 text-emerald-700 font-medium">Alíquota Zero no Varejo (Lei 13.097/15)</td>
                <td className="p-4 text-right font-semibold text-emerald-700">R$ {formatMoney(estimativa.parcelas.pis)}</td>
              </tr>
              <tr className="bg-amber-50/30">
                <td className="p-4 font-bold text-amber-900">COFINS</td>
                <td className="p-4">Federal</td>
                <td className="p-4">Receita Líquida de Monofásicos</td>
                <td className="p-4 text-emerald-700 font-medium">Alíquota Zero no Varejo (Lei 10.147/00)</td>
                <td className="p-4 text-right font-semibold text-emerald-700">R$ {formatMoney(estimativa.parcelas.cofins)}</td>
              </tr>
              <tr className="bg-blue-50/30">
                <td className="p-4 font-bold text-blue-900">ICMS</td>
                <td className="p-4">Estadual</td>
                <td className="p-4">Receita Líquida de ICMS-ST</td>
                <td className="p-4 text-emerald-700 font-medium">Isenção no Simples (ICMS Retido Ant.)</td>
                <td className="p-4 text-right font-semibold text-emerald-700">R$ {formatMoney(estimativa.parcelas.icms)}</td>
              </tr>
              <tr className="bg-slate-100/80 font-black text-slate-900">
                <td className="p-4" colSpan={4}>TOTAL CONSOLIDADO DA GUIA DAS ESTIMADA</td>
                <td className="p-4 text-right text-base text-blue-700">R$ {formatMoney(estimativa.valorDasComSegregacao)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
