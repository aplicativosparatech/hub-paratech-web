'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { 
  Users, Building2, AlertTriangle, Receipt, BarChart3, MapPin, 
  Sparkles, ShieldCheck, ArrowRight, Calendar, Filter, Clock, 
  CheckCircle2, RotateCcw, Layers, Package, FileArchive, Download
} from 'lucide-react'
import Link from 'next/link'
import CertificadoAlertaBanner from '@/components/CertificadoAlertaBanner'
import FechamentoFiscalModal from '@/components/FechamentoFiscalModal'

type TipoPeriodoDashboard = 'tudo' | 'mes_atual' | 'mes_anterior' | 'personalizado'

export default function DashboardPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [loadingNotas, setLoadingNotas] = useState(false)
  const [userRole, setUserRole] = useState<'admin' | 'contabilidade' | 'cliente'>('admin')
  const [isFicticioAtivo, setIsFicticioAtivo] = useState(false)
  const [certAlerta, setCertAlerta] = useState<any>(null)

  // Filtro de Período do Dashboard (do primeiro ao último XML)
  const [filtroPeriodo, setFiltroPeriodo] = useState<TipoPeriodoDashboard>('tudo')
  const [dataInicioPersonalizada, setDataInicioPersonalizada] = useState('')
  const [dataFimPersonalizada, setDataFimPersonalizada] = useState('')
  const [primeiroXmlData, setPrimeiroXmlData] = useState<string | null>(null)
  const [ultimoXmlData, setUltimoXmlData] = useState<string | null>(null)

  // Filtros de Cliente e Mês de Competência para Fechamento Fiscal
  const [listaClientes, setListaClientes] = useState<Array<{ id: string; razao_social: string; nome_fantasia?: string; cnpj: string }>>([])
  const [selectedClienteId, setSelectedClienteId] = useState<string>('')
  const [mesCompetencia, setMesCompetencia] = useState<string>('2026-09')
  const [isFechamentoModalOpen, setIsFechamentoModalOpen] = useState(false)

  const [metrics, setMetrics] = useState({
    clientes: 0,
    contabilidades: 0,
    totalFaturas: 0,
    faturasEmDia: 0,
    faturasAtrasadas: 0,
    pctAtraso: 0,
    nfQuantidade: 0,
    nfValor: 0,
    relatorios: 0,
    cidades: 0
  })

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true)
      try {
        // 1. Identifica usuário e role
        const { data: { user } } = await supabase.auth.getUser()
        let currentRole: 'admin' | 'contabilidade' | 'cliente' = 'admin'
        let userRoleData: any = null
        if (user) {
          const { data: roleData } = await supabase.from('user_roles').select('*').eq('user_id', user.id).single()
          userRoleData = roleData
          if (roleData?.role) currentRole = roleData.role as any
        }
        setUserRole(currentRole)

        // Busca alertas de certificado
        if (currentRole === 'cliente' && userRoleData?.cliente_id) {
          const { data: cliCert } = await supabase
            .from('clientes')
            .select('certificado_validade, razao_social, nome_fantasia, cnpj, configuracoes_hub(exibir_faixa_topo_certificado, exibir_certificados_cliente)')
            .eq('id', userRoleData.cliente_id)
            .single()
          if (cliCert?.certificado_validade) {
            const cfg = Array.isArray(cliCert.configuracoes_hub) ? cliCert.configuracoes_hub[0] : cliCert.configuracoes_hub
            setCertAlerta({
              validade: cliCert.certificado_validade,
              razaoSocial: cliCert.nome_fantasia || cliCert.razao_social,
              documento: cliCert.cnpj,
              config: cfg
            })
          }
        } else if (currentRole === 'contabilidade' && userRoleData?.contabilidade_id) {
          const { data: clisCert } = await supabase
            .from('clientes')
            .select('certificado_validade, razao_social, nome_fantasia, cnpj, configuracoes_hub(exibir_faixa_topo_certificado, exibir_certificados_contabilidade)')
            .eq('contabilidade_id', userRoleData.contabilidade_id)
            .not('certificado_validade', 'is', null)
          
          const primeiroVencendo = (clisCert || []).find(c => {
            if (!c.certificado_validade) return false
            const diff = Math.ceil((new Date(c.certificado_validade).getTime() - new Date().getTime()) / (1000 * 3600 * 24))
            return diff <= 45
          })
          if (primeiroVencendo) {
            const cfg = Array.isArray(primeiroVencendo.configuracoes_hub) ? primeiroVencendo.configuracoes_hub[0] : primeiroVencendo.configuracoes_hub
            setCertAlerta({
              validade: primeiroVencendo.certificado_validade,
              razaoSocial: primeiroVencendo.nome_fantasia || primeiroVencendo.razao_social,
              documento: primeiroVencendo.cnpj,
              config: cfg
            })
          }
        } else if (currentRole === 'admin') {
          const { data: clisCert } = await supabase
            .from('clientes')
            .select('certificado_validade, razao_social, nome_fantasia, cnpj, configuracoes_hub(exibir_faixa_topo_certificado)')
            .not('certificado_validade', 'is', null)
          
          const primeiroVencendo = (clisCert || []).find(c => {
            if (!c.certificado_validade) return false
            const diff = Math.ceil((new Date(c.certificado_validade).getTime() - new Date().getTime()) / (1000 * 3600 * 24))
            return diff <= 45
          })
          if (primeiroVencendo) {
            const cfg = Array.isArray(primeiroVencendo.configuracoes_hub) ? primeiroVencendo.configuracoes_hub[0] : primeiroVencendo.configuracoes_hub
            setCertAlerta({
              validade: primeiroVencendo.certificado_validade,
              razaoSocial: primeiroVencendo.nome_fantasia || primeiroVencendo.razao_social,
              documento: primeiroVencendo.cnpj,
              config: cfg
            })
          }
        }

        // 2. Busca configuração geral de valores fictícios
        const { data: geralConfig } = await supabase
          .from('configuracoes_portal_geral')
          .select('*')
          .eq('id', 1)
          .maybeSingle()

        const ficticioLigado = Boolean(geralConfig?.valores_ficticios_ativos)
        setIsFicticioAtivo(ficticioLigado)

        // Se for contabilidade ou cliente e a opção de valores fictícios estiver ativa, usa os fictícios!
        if (ficticioLigado && currentRole !== 'admin') {
          const ficticioAtrasadas = Number(geralConfig?.ficticio_faturas_atrasadas ?? 0)
          const ficticioTotalFaturas = Math.max(ficticioAtrasadas, 10)
          const pct = ficticioTotalFaturas > 0 ? (ficticioAtrasadas / ficticioTotalFaturas) * 100 : 0
          setMetrics({
            clientes: Number(geralConfig?.ficticio_clientes ?? 0),
            contabilidades: Number(geralConfig?.ficticio_contabilidades ?? 0),
            totalFaturas: ficticioTotalFaturas,
            faturasEmDia: Math.max(0, ficticioTotalFaturas - ficticioAtrasadas),
            faturasAtrasadas: ficticioAtrasadas,
            pctAtraso: pct,
            nfQuantidade: Number(geralConfig?.ficticio_nf_quantidade ?? 0),
            nfValor: Number(geralConfig?.ficticio_nf_valor ?? 0),
            relatorios: Number(geralConfig?.ficticio_relatorios ?? 0),
            cidades: Number(geralConfig?.ficticio_cidades ?? 0)
          })
          setLoading(false)
          return
        }

        // 3. Caso contrário (se for Admin ou se valores fictícios estiverem desligados): calcula os valores REAIS
        const hojeStr = new Date().toISOString().split('T')[0]

        // Busca datas extremas (1º XML e Último XML emitidos no portal)
        try {
          const { data: minNota } = await supabase.from('nfce_saidas').select('data_emissao').order('data_emissao', { ascending: true }).limit(1)
          const { data: maxNota } = await supabase.from('nfce_saidas').select('data_emissao').order('data_emissao', { ascending: false }).limit(1)
          if (minNota && minNota.length > 0 && minNota[0].data_emissao) {
            setPrimeiroXmlData(new Date(minNota[0].data_emissao).toLocaleDateString('pt-BR'))
          }
          if (maxNota && maxNota.length > 0 && maxNota[0].data_emissao) {
            setUltimoXmlData(new Date(maxNota[0].data_emissao).toLocaleDateString('pt-BR'))
          }
        } catch (e) {
          console.warn('Erro ao obter datas extremas de XMLs:', e)
        }

        // Consultas gerais de Clientes, Contabilidades, Faturas, etc.
        let qFaturas = supabase.from('faturas').select('id, status, data_vencimento')
        if (currentRole === 'cliente' && userRoleData?.cliente_id) {
          qFaturas = qFaturas.eq('cliente_id', userRoleData.cliente_id)
        }

        // Consulta lista de Clientes para o Seletor de Fechamento Fiscal
        let qClientesLista = supabase.from('clientes').select('id, razao_social, nome_fantasia, cnpj', { count: 'exact' }).order('razao_social', { ascending: true })
        if (currentRole === 'cliente' && userRoleData?.cliente_id) {
          qClientesLista = qClientesLista.eq('id', userRoleData.cliente_id)
        } else if (currentRole === 'contabilidade' && userRoleData?.contabilidade_id) {
          qClientesLista = qClientesLista.eq('contabilidade_id', userRoleData.contabilidade_id)
        }

        const [
          clientesRes, 
          contabRes, 
          faturasRes, 
          xmlsRes,
          cidadesClientesRes,
          cidadesContabRes
        ] = await Promise.all([
          qClientesLista,
          supabase.from('contabilidades').select('id', { count: 'exact', head: true }),
          qFaturas,
          supabase.from('arquivos_xml').select('id', { count: 'exact', head: true }),
          supabase.from('clientes').select('cidade').not('cidade', 'is', null),
          supabase.from('contabilidades').select('cidade').not('cidade', 'is', null)
        ])

        // Popula clientes para o Seletor de Fechamento Fiscal
        const clisData = (clientesRes.data || []) as any[]
        setListaClientes(clisData)
        if (clisData.length > 0) {
          setSelectedClienteId(prev => {
            if (prev && clisData.some(c => c.id === prev)) return prev
            const cliComNotas = clisData.find(c => c.id === '0ae0938c-0124-453e-81d6-0e9d82f87f86')
            return cliComNotas ? cliComNotas.id : clisData[0].id
          })
        }

        // Faturas reais: calculando Total, Em Dia e Atrasadas
        const listaFaturas = faturasRes.data || []
        const totalFaturas = listaFaturas.length
        let faturasAtrasadas = 0
        let faturasEmDia = 0

        listaFaturas.forEach(f => {
          const isAtrasada = f.status === 'pendente' && f.data_vencimento && f.data_vencimento < hojeStr
          if (isAtrasada) {
            faturasAtrasadas++
          } else {
            faturasEmDia++
          }
        })

        const pctAtraso = totalFaturas > 0 ? (faturasAtrasadas / totalFaturas) * 100 : 0

        // Cidades distintas atendidas
        const cidadesSet = new Set<string>()
        ;(cidadesClientesRes.data || []).forEach(c => {
          if (c.cidade && c.cidade.trim()) cidadesSet.add(c.cidade.trim().toUpperCase())
        })
        ;(cidadesContabRes.data || []).forEach(c => {
          if (c.cidade && c.cidade.trim()) cidadesSet.add(c.cidade.trim().toUpperCase())
        })
        const totalCidades = Math.max(cidadesSet.size, (clientesRes.count || 0) > 0 ? 1 : 0)

        // Carrega volume de notas fiscais respeitando o período selecionado
        let qNfeSaidas = supabase.from('nfe_saidas').select('id, valor, data_emissao')
        let qNfceSaidas = supabase.from('nfce_saidas').select('id, valor, data_emissao')
        let qNfeEntradas = supabase.from('nfe_entradas').select('id, valor, data_emissao')

        if (currentRole === 'cliente' && userRoleData?.cliente_id) {
          qNfeSaidas = qNfeSaidas.eq('cliente_id', userRoleData.cliente_id)
          qNfceSaidas = qNfceSaidas.eq('cliente_id', userRoleData.cliente_id)
          qNfeEntradas = qNfeEntradas.eq('cliente_id', userRoleData.cliente_id)
        }

        // Aplica filtro de período
        if (filtroPeriodo === 'mes_atual') {
          const agora = new Date()
          const ano = agora.getFullYear()
          const mes = agora.getMonth()
          const inicio = new Date(ano, mes, 1).toISOString()
          const fim = new Date(ano, mes + 1, 0, 23, 59, 59, 999).toISOString()
          qNfeSaidas = qNfeSaidas.gte('data_emissao', inicio).lte('data_emissao', fim)
          qNfceSaidas = qNfceSaidas.gte('data_emissao', inicio).lte('data_emissao', fim)
          qNfeEntradas = qNfeEntradas.gte('data_emissao', inicio).lte('data_emissao', fim)
        } else if (filtroPeriodo === 'mes_anterior') {
          const agora = new Date()
          const ano = agora.getFullYear()
          const mesAnterior = agora.getMonth() - 1
          const inicio = new Date(ano, mesAnterior, 1).toISOString()
          const fim = new Date(ano, mesAnterior + 1, 0, 23, 59, 59, 999).toISOString()
          qNfeSaidas = qNfeSaidas.gte('data_emissao', inicio).lte('data_emissao', fim)
          qNfceSaidas = qNfceSaidas.gte('data_emissao', inicio).lte('data_emissao', fim)
          qNfeEntradas = qNfeEntradas.gte('data_emissao', inicio).lte('data_emissao', fim)
        } else if (filtroPeriodo === 'personalizado' && dataInicioPersonalizada && dataFimPersonalizada) {
          const inicio = `${dataInicioPersonalizada}T00:00:00-03:00`
          const fim = `${dataFimPersonalizada}T23:59:59.999-03:00`
          qNfeSaidas = qNfeSaidas.gte('data_emissao', new Date(inicio).toISOString()).lte('data_emissao', new Date(fim).toISOString())
          qNfceSaidas = qNfceSaidas.gte('data_emissao', new Date(inicio).toISOString()).lte('data_emissao', new Date(fim).toISOString())
          qNfeEntradas = qNfeEntradas.gte('data_emissao', new Date(inicio).toISOString()).lte('data_emissao', new Date(fim).toISOString())
        }
        // Se 'tudo', busca o volume total do primeiro ao último XML sem filtro

        const [nfeRes, nfceRes, nfeEntradasRes] = await Promise.all([
          qNfeSaidas,
          qNfceSaidas,
          qNfeEntradas
        ])

        const nfeCount = (nfeRes.data || []).length
        const nfeTotal = (nfeRes.data || []).reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0)

        const nfceCount = (nfceRes.data || []).length
        const nfceTotal = (nfceRes.data || []).reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0)

        const nfeEntradasCount = (nfeEntradasRes.data || []).length
        const nfeEntradasTotal = (nfeEntradasRes.data || []).reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0)

        let totalNFQuantidade = nfeCount + nfceCount + nfeEntradasCount
        const totalNFValor = nfeTotal + nfceTotal + nfeEntradasTotal

        if (totalNFQuantidade === 0 && (xmlsRes.count || 0) > 0) {
          totalNFQuantidade = xmlsRes.count || 0
        }

        const totalRelatorios = (xmlsRes.count || 0) > 0 ? (xmlsRes.count || 0) : (totalNFQuantidade > 0 ? totalNFQuantidade : 5)

        setMetrics({
          clientes: clientesRes.count || 0,
          contabilidades: contabRes.count || 0,
          totalFaturas,
          faturasEmDia,
          faturasAtrasadas,
          pctAtraso,
          nfQuantidade: totalNFQuantidade,
          nfValor: totalNFValor,
          relatorios: totalRelatorios,
          cidades: totalCidades
        })

      } catch (err) {
        console.error('Erro ao carregar dados do dashboard:', err)
      } finally {
        setLoading(false)
        setLoadingNotas(false)
      }
    }

    loadDashboard()
  }, [filtroPeriodo, dataInicioPersonalizada, dataFimPersonalizada])

  // Determina a cor do card de faturas segundo as regras solicitadas:
  // - Amarelo quando tiver >= 20% e < 50%
  // - Laranja quando tiver 50%
  // - Vermelho quando tiver mais de 50% (> 50%)
  // - Verde quando < 20% (ou 0)
  const getFaturasStatus = () => {
    const { totalFaturas, faturasAtrasadas, pctAtraso } = metrics
    if (totalFaturas === 0) {
      return {
        cor: 'verde',
        label: 'Tudo em dia (0 pendências)',
        badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        textCor: 'text-emerald-700',
        iconBg: 'bg-emerald-50 text-emerald-600'
      }
    }
    if (pctAtraso > 50) {
      return {
        cor: 'vermelho',
        label: `${pctAtraso.toFixed(0)}% em atraso (Crítico)`,
        badgeBg: 'bg-red-50 text-red-700 border-red-200',
        textCor: 'text-red-600',
        iconBg: 'bg-red-50 text-red-600'
      }
    }
    if (pctAtraso >= 50) {
      return {
        cor: 'laranja',
        label: `${pctAtraso.toFixed(0)}% em atraso (Alerta)`,
        badgeBg: 'bg-orange-50 text-orange-700 border-orange-200',
        textCor: 'text-orange-600',
        iconBg: 'bg-orange-50 text-orange-600'
      }
    }
    if (pctAtraso >= 20) {
      return {
        cor: 'amarelo',
        label: `${pctAtraso.toFixed(0)}% em atraso (Atenção)`,
        badgeBg: 'bg-amber-50 text-amber-800 border-amber-200',
        textCor: 'text-amber-600',
        iconBg: 'bg-amber-50 text-amber-600'
      }
    }
    return {
      cor: 'verde',
      label: faturasAtrasadas > 0 ? `${faturasAtrasadas} em atraso (${pctAtraso.toFixed(0)}%)` : 'Tudo em dia (0% atraso)',
      badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      textCor: 'text-emerald-600',
      iconBg: 'bg-emerald-50 text-emerald-600'
    }
  }

  const faturasStatus = getFaturasStatus()

  // Opções de Mês de Competência
  const mesesOpcoes = [
    { valor: '2026-10', label: 'Outubro / 2026 (Competência Atual)' },
    { valor: '2026-09', label: 'Setembro / 2026 (Base com 582 XMLs)' },
    { valor: '2026-08', label: 'Agosto / 2026' },
    { valor: '2026-07', label: 'Julho / 2026' },
    { valor: '2026-06', label: 'Junho / 2026' },
    { valor: '2026-05', label: 'Maio / 2026' },
    { valor: '2026-04', label: 'Abril / 2026' },
    { valor: '2026-03', label: 'Março / 2026' },
    { valor: '2026-02', label: 'Fevereiro / 2026' },
    { valor: '2026-01', label: 'Janeiro / 2026' },
    { valor: '2025-12', label: 'Dezembro / 2025' },
    { valor: '2025-11', label: 'Novembro / 2025' }
  ]

  const clienteSelecionadoObj = listaClientes.find(c => c.id === selectedClienteId)
  const clienteNomeExibicao = clienteSelecionadoObj
    ? (clienteSelecionadoObj.nome_fantasia || clienteSelecionadoObj.razao_social)
    : 'Selecione um Cliente'
  const mesCompetenciaLabel = mesesOpcoes.find(m => m.valor === mesCompetencia)?.label || mesCompetencia

  return (
    <div className="p-6 sm:p-8 space-y-6">
      
      {/* Cabeçalho */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Visão Geral</h1>
          <p className="text-slate-500 text-sm mt-1">
            Painel consolidado de inteligência fiscal e gestão operacional do Hub Paratech.
          </p>
        </div>
      </header>

      {/* PAINEL DE FECHAMENTO FISCAL MENSAL COM FILTROS DE CLIENTE & COMPETÊNCIA */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-4 sm:p-5 rounded-2xl border border-indigo-900/50 shadow-md flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        
        {/* Identificação do Fechamento */}
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-indigo-500/20 border border-indigo-400/30 rounded-2xl text-indigo-400 shrink-0">
            <Package size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white tracking-tight">
                Fechamento Fiscal Mensal
              </span>
              <span className="text-[10px] font-extrabold uppercase bg-indigo-500/30 text-indigo-200 px-2.5 py-0.5 rounded-full border border-indigo-400/20">
                Pacote ZIP de XMLs & Relatórios
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Empacotamento automático sem pastas vazias, relatórios oficiais e apuração de monofásicos.
            </p>
          </div>
        </div>

        {/* Filtros e Botão Fechamento */}
        <div className="flex flex-wrap items-center gap-3">
          
          {/* 1. FILTRO DE CLIENTE (Dropdown para Admin/Contabilidade, Tag fixa para Cliente) */}
          {userRole === 'cliente' ? (
            <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700/80 px-3.5 py-2 rounded-xl text-xs">
              <Building2 size={15} className="text-indigo-400 shrink-0" />
              <div>
                <span className="text-[9px] text-slate-400 block font-bold uppercase leading-none">Minha Empresa</span>
                <span className="text-white font-semibold text-xs leading-tight block truncate max-w-[200px]">
                  {clienteNomeExibicao}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-1.5 shadow-inner">
              <Building2 size={15} className="text-indigo-400 shrink-0" />
              <div className="flex flex-col">
                <label className="text-[9px] uppercase font-bold text-slate-400">Cliente / Empresa</label>
                <select
                  value={selectedClienteId}
                  onChange={(e) => setSelectedClienteId(e.target.value)}
                  className="bg-transparent text-xs text-white font-bold focus:outline-none cursor-pointer max-w-[220px] truncate"
                >
                  {listaClientes.map(c => (
                    <option key={c.id} value={c.id} className="bg-slate-900 text-white">
                      {c.nome_fantasia || c.razao_social} {c.cnpj ? `(${c.cnpj})` : ''}
                    </option>
                  ))}
                  {listaClientes.length === 0 && (
                    <option value="" className="bg-slate-900 text-white">Nenhum cliente disponível</option>
                  )}
                </select>
              </div>
            </div>
          )}

          {/* 2. FILTRO MÊS COMPETÊNCIA */}
          <div className="flex items-center gap-2 bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-1.5 shadow-inner">
            <Calendar size={15} className="text-indigo-400 shrink-0" />
            <div className="flex flex-col">
              <label className="text-[9px] uppercase font-bold text-slate-400">Mês Competência</label>
              <select
                value={mesCompetencia}
                onChange={(e) => setMesCompetencia(e.target.value)}
                className="bg-transparent text-xs text-white font-bold focus:outline-none cursor-pointer"
              >
                {mesesOpcoes.map(m => (
                  <option key={m.valor} value={m.valor} className="bg-slate-900 text-white">
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 3. BOTÃO FECHAMENTO FISCAL (SURGE QUANDO MÊS ESTÁ ESCOLHIDO) */}
          {mesCompetencia && selectedClienteId && (
            <button
              type="button"
              onClick={() => setIsFechamentoModalOpen(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-600 hover:from-emerald-600 hover:to-indigo-700 text-white rounded-xl text-xs font-black shadow-lg hover:shadow-emerald-500/20 transition-all flex items-center gap-2 transform active:scale-95 animate-in fade-in zoom-in-95 duration-200"
            >
              <Package size={16} className="text-emerald-100" />
              <span>Fechamento Fiscal</span>
              <span className="bg-white/20 px-2 py-0.5 rounded-full text-[10px] font-mono">
                {mesCompetencia}
              </span>
            </button>
          )}

        </div>

      </div>

      {/* Barra de Filtro de Período para Volume de XMLs e Notas */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl shrink-0">
            <Filter size={18} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Volume de XMLs & Período
              </span>
              {primeiroXmlData && ultimoXmlData && (
                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <Clock size={11} className="text-indigo-600" />
                  Base: 1º XML ({primeiroXmlData}) até o último ({ultimoXmlData})
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Consolide o volume de notas processadas no portal por período ou histórico global.
            </p>
          </div>
        </div>

        {/* Botões de Seleção do Período */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setFiltroPeriodo('tudo')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              filtroPeriodo === 'tudo'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Layers size={13} />
            Todo o Histórico (1º ao Último XML)
          </button>

          <button
            onClick={() => setFiltroPeriodo('mes_anterior')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              filtroPeriodo === 'mes_anterior'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Clock size={13} />
            Mês Anterior (Set/2026)
          </button>

          <button
            onClick={() => setFiltroPeriodo('mes_atual')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              filtroPeriodo === 'mes_atual'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Calendar size={13} />
            Mês Atual (Out/2026)
          </button>

          <button
            onClick={() => setFiltroPeriodo('personalizado')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              filtroPeriodo === 'personalizado'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Filter size={13} />
            Personalizado
          </button>
        </div>

        {/* Inputs de Data para Período Personalizado */}
        {filtroPeriodo === 'personalizado' && (
          <div className="flex items-center gap-2 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100 w-full lg:w-auto">
            <input
              type="date"
              value={dataInicioPersonalizada}
              onChange={(e) => setDataInicioPersonalizada(e.target.value)}
              className="bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl text-xs text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
            <span className="text-slate-400 text-xs">até</span>
            <input
              type="date"
              value={dataFimPersonalizada}
              onChange={(e) => setDataFimPersonalizada(e.target.value)}
              className="bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl text-xs text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
        )}
      </div>

      {/* Faixa Vermelha de Alerta de Certificado Digital */}
      {certAlerta && (
        <CertificadoAlertaBanner 
          validade={certAlerta.validade}
          razaoSocial={certAlerta.razaoSocial}
          documento={certAlerta.documento}
          userRole={userRole}
          config={certAlerta.config}
        />
      )}

      {/* Grid de Cards Compactos (6 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5 sm:gap-4">
        
        {/* CARD 1: TOTAL DE CLIENTES */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Total de Clientes
            </span>
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
              <Users size={16} />
            </div>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-black text-slate-800">
              {loading ? '...' : metrics.clientes.toLocaleString('pt-BR')}
            </p>
            <span className="text-[11px] text-slate-400 font-medium">Empresas ativas</span>
          </div>
        </div>

        {/* CARD 2: CONTABILIDADES */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Contabilidades
            </span>
            <div className="p-1.5 bg-purple-50 text-purple-600 rounded-lg">
              <Building2 size={16} />
            </div>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-black text-slate-800">
              {loading ? '...' : metrics.contabilidades.toLocaleString('pt-BR')}
            </p>
            <span className="text-[11px] text-slate-400 font-medium">Escritórios parceiros</span>
          </div>
        </div>

        {/* CARD 3: STATUS DAS FATURAS (TODAS, EM DIA E ATRASADAS - REGRAS 20% AMARELO, 50% LARANJA, >50% VERMELHO) */}
        <div className={`bg-white p-4 sm:p-5 rounded-2xl border transition flex flex-col justify-between shadow-xs ${
          faturasStatus.cor === 'vermelho' ? 'border-red-300 hover:border-red-400' :
          faturasStatus.cor === 'laranja' ? 'border-orange-300 hover:border-orange-400' :
          faturasStatus.cor === 'amarelo' ? 'border-amber-300 hover:border-amber-400' :
          'border-slate-200 hover:border-slate-300'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${faturasStatus.textCor}`}>
              Faturas & Cobranças
            </span>
            <div className={`p-1.5 rounded-lg ${faturasStatus.iconBg}`}>
              {faturasStatus.cor === 'verde' ? <Receipt size={16} /> : <AlertTriangle size={16} />}
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <p className={`text-2xl sm:text-3xl font-black ${
                faturasStatus.cor === 'vermelho' ? 'text-red-600' :
                faturasStatus.cor === 'laranja' ? 'text-orange-600' :
                faturasStatus.cor === 'amarelo' ? 'text-amber-600' :
                'text-slate-800'
              }`}>
                {loading ? '...' : metrics.totalFaturas.toLocaleString('pt-BR')}
              </p>
              <span className="text-[11px] font-semibold text-slate-400">total</span>
            </div>

            <div className="flex items-center gap-2 mt-1 text-[11px] font-medium text-slate-600">
              <span className="text-emerald-600 font-semibold">
                {metrics.faturasEmDia} em dia
              </span>
              <span>•</span>
              <span className={metrics.faturasAtrasadas > 0 ? faturasStatus.textCor + ' font-bold' : 'text-slate-400'}>
                {metrics.faturasAtrasadas} atrasadas
              </span>
            </div>

            <div className="mt-1.5">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border inline-block ${faturasStatus.badgeBg}`}>
                {faturasStatus.label}
              </span>
            </div>
          </div>
        </div>

        {/* CARD 4: TOTAL DE NF PROCESSADAS (VOLUME DO 1º AO ÚLTIMO XML OU FILTRADO) */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider truncate" title="NF Processadas">
              NF Processadas
            </span>
            <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg shrink-0">
              <Receipt size={16} />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl sm:text-3xl font-black text-slate-800 truncate">
                {loading || loadingNotas ? '...' : `${metrics.nfQuantidade.toLocaleString('pt-BR')} un`}
              </p>
              {loadingNotas && <div className="w-3 h-3 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>}
            </div>
            <p className="text-xs font-bold text-emerald-600 mt-0.5 truncate">
              {loading || loadingNotas ? '...' : `R$ ${metrics.nfValor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </p>
            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
              <span className="truncate" title={`1º XML: ${primeiroXmlData || '01/09/2026'} • Último: ${ultimoXmlData || '01/10/2026'}`}>
                {primeiroXmlData ? `${primeiroXmlData} a ${ultimoXmlData}` : 'Histórico completo'}
              </span>
              <span className="bg-emerald-50 text-emerald-700 font-bold px-1.5 py-0.5 rounded border border-emerald-200 shrink-0">
                {filtroPeriodo === 'tudo' ? '1º ao Último' : filtroPeriodo === 'mes_anterior' ? 'Mês Anterior' : filtroPeriodo === 'mes_atual' ? 'Mês Atual' : 'Período'}
              </span>
            </div>
          </div>
        </div>

        {/* CARD 5: TOTAL DE RELATÓRIOS */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">
              Total Relatórios
            </span>
            <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
              <BarChart3 size={16} />
            </div>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-black text-slate-800">
              {loading ? '...' : metrics.relatorios.toLocaleString('pt-BR')}
            </p>
            <span className="text-[11px] text-slate-400 font-medium">Auditorias & XMLs</span>
          </div>
        </div>

        {/* CARD 6: CIDADES ATENDIDAS */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">
              Cidades Atendidas
            </span>
            <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <MapPin size={16} />
            </div>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-black text-slate-800">
              {loading ? '...' : metrics.cidades.toLocaleString('pt-BR')}
            </p>
            <span className="text-[11px] text-slate-400 font-medium">Cobertura municipal</span>
          </div>
        </div>

      </div>

      {/* Atalhos Rápidos */}
      <div className="bg-gradient-to-r from-slate-900 to-blue-950 text-white rounded-2xl p-6 shadow-sm border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <ShieldCheck className="text-emerald-400" size={20} /> Central Fiscal & Auditoria Integrada
          </h3>
          <p className="text-slate-300 text-xs sm:text-sm mt-1">
            Audite produtos monofásicos, verifique quebras de sequência, consulte faturamento e gerencie certificados digitais em tempo real.
          </p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <Link
            href="/dashboard/relatorios"
            className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold px-5 py-2.5 rounded-xl transition text-center shadow-md"
          >
            Acessar Auditoria Fiscal
          </Link>
          <Link
            href="/dashboard/notas-fiscais"
            className="w-full md:w-auto bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-semibold px-5 py-2.5 rounded-xl transition text-center border border-white/15"
          >
            Portal de Notas
          </Link>
        </div>
      </div>

      {/* Modal de Fechamento Fiscal Mensal (Empacotador ZIP & Relatórios) */}
      <FechamentoFiscalModal
        isOpen={isFechamentoModalOpen}
        onClose={() => setIsFechamentoModalOpen(false)}
        clienteId={selectedClienteId}
        clienteNome={clienteNomeExibicao}
        mesCompetencia={mesCompetencia}
        anoMesFormatado={mesCompetenciaLabel}
      />

    </div>
  )
}
