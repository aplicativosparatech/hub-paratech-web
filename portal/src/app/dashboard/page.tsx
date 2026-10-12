'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { 
  Users, Building2, AlertTriangle, Receipt, BarChart3, MapPin, 
  Sparkles, ShieldCheck, ArrowRight
} from 'lucide-react'
import Link from 'next/link'

export default function DashboardPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState<'admin' | 'contabilidade' | 'cliente'>('admin')
  const [isFicticioAtivo, setIsFicticioAtivo] = useState(false)

  const [metrics, setMetrics] = useState({
    clientes: 0,
    contabilidades: 0,
    faturasAtrasadas: 0,
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
        if (user) {
          const { data: roleData } = await supabase.from('user_roles').select('role').eq('user_id', user.id).single()
          if (roleData?.role) currentRole = roleData.role as any
        }
        setUserRole(currentRole)

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
          setMetrics({
            clientes: Number(geralConfig?.ficticio_clientes ?? 0),
            contabilidades: Number(geralConfig?.ficticio_contabilidades ?? 0),
            faturasAtrasadas: Number(geralConfig?.ficticio_faturas_atrasadas ?? 0),
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

        const [
          clientesRes, 
          contabRes, 
          faturasRes, 
          nfeRes, 
          nfceRes, 
          xmlsRes,
          cidadesClientesRes,
          cidadesContabRes
        ] = await Promise.all([
          supabase.from('clientes').select('id', { count: 'exact', head: true }),
          supabase.from('contabilidades').select('id', { count: 'exact', head: true }),
          supabase.from('faturas').select('id', { count: 'exact', head: true }).eq('status', 'pendente').lt('data_vencimento', hojeStr),
          supabase.from('nfe_saidas').select('valor_total'),
          supabase.from('nfce_saidas').select('valor_total'),
          supabase.from('arquivos_xml').select('id', { count: 'exact', head: true }),
          supabase.from('clientes').select('cidade').not('cidade', 'is', null),
          supabase.from('contabilidades').select('cidade').not('cidade', 'is', null)
        ])

        // Soma valores de NF
        const nfeCount = nfeRes.data?.length || 0
        const nfeTotal = (nfeRes.data || []).reduce((acc, curr) => acc + (Number(curr.valor_total) || 0), 0)

        const nfceCount = nfceRes.data?.length || 0
        const nfceTotal = (nfceRes.data || []).reduce((acc, curr) => acc + (Number(curr.valor_total) || 0), 0)

        const totalNFQuantidade = nfeCount + nfceCount
        const totalNFValor = nfeTotal + nfceTotal

        // Total de Relatórios no sistema (arquivos XML + notas processadas + relatórios)
        const totalRelatorios = (xmlsRes.count || 0) > 0 ? (xmlsRes.count || 0) : (totalNFQuantidade > 0 ? totalNFQuantidade : 5)

        // Cidades distintas atendidas
        const cidadesSet = new Set<string>()
        ;(cidadesClientesRes.data || []).forEach(c => {
          if (c.cidade && c.cidade.trim()) cidadesSet.add(c.cidade.trim().toUpperCase())
        })
        ;(cidadesContabRes.data || []).forEach(c => {
          if (c.cidade && c.cidade.trim()) cidadesSet.add(c.cidade.trim().toUpperCase())
        })
        const totalCidades = Math.max(cidadesSet.size, (clientesRes.count || 0) > 0 ? 1 : 0)

        setMetrics({
          clientes: clientesRes.count || 0,
          contabilidades: contabRes.count || 0,
          faturasAtrasadas: faturasRes.count || 0,
          nfQuantidade: totalNFQuantidade,
          nfValor: totalNFValor,
          relatorios: totalRelatorios,
          cidades: totalCidades
        })

      } catch (err) {
        console.error('Erro ao carregar dados do dashboard:', err)
      } finally {
        setLoading(false)
      }
    }

    loadDashboard()
  }, [])

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

        {/* Aviso de Modo Demonstração para o Super Admin */}
        {userRole === 'admin' && isFicticioAtivo && (
          <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 text-indigo-800 px-3.5 py-1.5 rounded-xl text-xs font-semibold">
            <Sparkles size={15} className="text-indigo-600 animate-pulse" />
            <span>Valores Fictícios ativos para Contabilidades e Clientes</span>
            <Link 
              href="/dashboard/configuracoes-portal" 
              className="underline hover:text-indigo-950 font-bold ml-1 inline-flex items-center gap-0.5"
            >
              Configurar <ArrowRight size={12} />
            </Link>
          </div>
        )}
      </header>

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

        {/* CARD 3: FATURAS ATRASADAS */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-red-600 uppercase tracking-wider">
              Faturas Atrasadas
            </span>
            <div className="p-1.5 bg-red-50 text-red-600 rounded-lg">
              <AlertTriangle size={16} />
            </div>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-black text-red-600">
              {loading ? '...' : metrics.faturasAtrasadas.toLocaleString('pt-BR')}
            </p>
            <span className="text-[11px] text-red-400 font-medium">
              {metrics.faturasAtrasadas > 0 ? 'Requer atenção imediata' : 'Tudo em dia'}
            </span>
          </div>
        </div>

        {/* CARD 4: TOTAL DE NF PROCESSADOS (QUANTIDADE E VALOR NO MESMO CARD) */}
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
            <p className="text-2xl sm:text-3xl font-black text-slate-800 truncate">
              {loading ? '...' : `${metrics.nfQuantidade.toLocaleString('pt-BR')} un`}
            </p>
            <p className="text-xs font-bold text-emerald-600 mt-0.5 truncate">
              {loading ? '...' : `R$ ${metrics.nfValor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </p>
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

    </div>
  )
}
