'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { Plus, Pencil, Trash2, X, Copy, RefreshCw, Search, Upload, DollarSign, TrendingDown, TrendingUp, Eye, EyeOff, KeyRound } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import toast from 'react-hot-toast'
import { limparDocumento, formatarCnpjCpf } from '@/utils/cnpjAlfanumerico'
import ImportadorLoteModal from '@/components/ImportadorLoteModal'
import ResizableSortableTh from '@/components/ui/ResizableSortableTh'
import { useTableFeatures } from '@/hooks/useTableFeatures'

export default function ClientesPage() {
  const [clientes, setClientes] = useState<any[]>([])
  const [contabilidades, setContabilidades] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; id: string; nome: string }>({ open: false, id: '', nome: '' })
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [priorizarNomeFantasia, setPriorizarNomeFantasia] = useState(false)
  const [userRole, setUserRole] = useState<'admin' | 'contabilidade' | 'cliente'>('admin')
  const [userRoleData, setUserRoleData] = useState<any>(null)
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({})
  const supabase = createClient()

  const togglePasswordVisibility = (id: string) => {
    setVisiblePasswords(prev => ({
      ...prev,
      [id]: !prev[id]
    }))
  }

  // Listener para sincronização da preferência de exibição (Nome Fantasia vs Razão Social)
  useEffect(() => {
    const checkPref = () => {
      const pref = localStorage.getItem('hub_priorizar_nome_fantasia') === 'true'
      setPriorizarNomeFantasia(pref)
    }
    checkPref()
    window.addEventListener('hub_settings_changed', checkPref)
    return () => window.removeEventListener('hub_settings_changed', checkPref)
  }, [])

  async function fetchClientes() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    const { data: roleData } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    const role = (roleData?.role as 'admin' | 'contabilidade' | 'cliente') || 'admin'
    setUserRole(role)
    setUserRoleData(roleData)

    let query = supabase
      .from('clientes')
      .select('*, contabilidades ( razao_social )')
      .order('created_at', { ascending: false })

    if (role === 'contabilidade' && roleData?.contabilidade_id) {
      query = query.eq('contabilidade_id', roleData.contabilidade_id)
    } else if (role === 'cliente' && roleData?.cliente_id) {
      query = query.eq('id', roleData.cliente_id)
    }

    const { data } = await query
    if (data) setClientes(data)

    if (role === 'admin') {
      const { data: contabs } = await supabase
        .from('contabilidades')
        .select('id, razao_social')
        .order('razao_social')
      if (contabs) setContabilidades(contabs)
    }

    setLoading(false)
  }

  useEffect(() => { 
    fetchClientes()
    try {
      const params = new URLSearchParams(window.location.search)
      const b = params.get('busca')
      if (b) setSearchTerm(decodeURIComponent(b))
    } catch {}
  }, [])

  const handleDelete = async () => {
    setDeleting(true)
    const { error } = await supabase.from('clientes').delete().eq('id', deleteModal.id)
    if (error) {
      toast.error('Erro ao excluir: ' + error.message)
    } else {
      toast.success('Cliente excluído com sucesso!')
      fetchClientes()
    }
    setDeleting(false)
    setDeleteModal({ open: false, id: '', nome: '' })
  }

  const copyToken = (token: string) => {
    navigator.clipboard.writeText(token)
    toast.success('Token copiado!')
  }

  const clientesFiltrados = useMemo(() => {
    return clientes.filter(c => {
      if (!searchTerm) return true
      const term = searchTerm.toLowerCase().trim()
      const cleanTerm = limparDocumento(term)
      const doc = (c.cnpj || '').toLowerCase()
      const cleanDoc = limparDocumento(doc)
      return (
        (c.razao_social && c.razao_social.toLowerCase().includes(term)) ||
        (c.nome_fantasia && c.nome_fantasia.toLowerCase().includes(term)) ||
        (c.contabilidades?.razao_social && c.contabilidades.razao_social.toLowerCase().includes(term)) ||
        doc.includes(term) ||
        (cleanTerm && cleanDoc.includes(cleanTerm))
      )
    })
  }, [clientes, searchTerm])

  // Cálculo da Soma Total das Mensalidades das Empresas
  const totalMensalidades = useMemo(() => {
    return clientes.reduce((acc, c) => acc + (Number(c.valor_mensalidade) || 0), 0)
  }, [clientes])

  const totalMensalidadesFiltradas = useMemo(() => {
    return clientesFiltrados.reduce((acc, c) => acc + (Number(c.valor_mensalidade) || 0), 0)
  }, [clientesFiltrados])

  // Cálculo da Soma dos Custos das Empresas
  const totalCustos = useMemo(() => {
    return clientes.reduce((acc, c) => acc + (Number(c.custo) || 0), 0)
  }, [clientes])

  const totalCustosFiltrados = useMemo(() => {
    return clientesFiltrados.reduce((acc, c) => acc + (Number(c.custo) || 0), 0)
  }, [clientesFiltrados])

  // Cálculo do Lucro (Total das Mensalidades - Total dos Custos)
  const totalLucro = useMemo(() => {
    return totalMensalidades - totalCustos
  }, [totalMensalidades, totalCustos])

  const totalLucroFiltrado = useMemo(() => {
    return totalMensalidadesFiltradas - totalCustosFiltrados
  }, [totalMensalidadesFiltradas, totalCustosFiltrados])

  // Margem de lucro percentual
  const margemLucro = useMemo(() => {
    if (totalMensalidades <= 0) return 0
    return Math.round((totalLucro / totalMensalidades) * 100)
  }, [totalMensalidades, totalLucro])

  const {
    sortedData: clientesOrdenados,
    sortKey,
    sortDirection,
    handleSort,
    columnWidths,
    handleResizeColumn
  } = useTableFeatures({
    data: clientesFiltrados,
    tableId: 'clientes_admin',
    defaultSortKey: 'razao_social',
    defaultSortDirection: 'asc',
    initialWidths: {
      logo: 70,
      razao_social: 250,
      cnpj: 180,
      regime: 130,
      mensalidade: 170,
      certificado: 170,
      contabilidade: 180,
      status: 100,
      token: 140,
      acoes: 120
    },
    customExtractors: {
      razao_social: (c: any) => {
        if (priorizarNomeFantasia) {
          return c.nome_fantasia || c.razao_social || ''
        }
        return c.razao_social || c.nome_fantasia || ''
      },
      cnpj: (c: any) => c.cnpj || '',
      regime: (c: any) => c.regime_tributario || '',
      mensalidade: (c: any) => Number(c.valor_mensalidade || 0),
      custo: (c: any) => Number(c.custo || 0),
      lucro: (c: any) => Number(c.valor_mensalidade || 0) - Number(c.custo || 0),
      certificado: (c: any) => c.certificado_validade || '',
      contabilidade: (c: any) => c.contabilidades?.razao_social || '',
      status: (c: any) => (c.ativo ? 1 : 0),
      token: (c: any) => c.hub_token || ''
    }
  })

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* 1. Topo: Título da Página e Botões de Ação Responsivos */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Clientes (Empresas)</h1>
          <p className="text-slate-500 mt-1 text-xs sm:text-sm">Gerencie os clientes e os tokens de acesso ao Hub.</p>
        </div>
        
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3">
          {userRole === 'admin' && (
            <button 
              type="button"
              onClick={() => setImportModalOpen(true)}
              className="flex-1 sm:flex-none bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2.5 rounded-xl font-medium transition flex items-center justify-center gap-2 border border-slate-300 text-xs sm:text-sm shadow-2xs cursor-pointer"
              title="Importar de arquivo CSV, TXT, JSON, XLS ou XLSX e buscar CNPJs automaticamente"
            >
              <Upload size={16} />
              <span>Importar Arquivo / CNPJs</span>
            </button>
          )}
          <button 
            onClick={() => { setLoading(true); fetchClientes() }} 
            className="bg-slate-100 text-slate-600 px-3.5 py-2.5 rounded-xl font-medium hover:bg-slate-200 transition flex items-center justify-center gap-2 text-xs sm:text-sm shadow-2xs cursor-pointer"
            title="Recarregar clientes"
          >
            <RefreshCw size={16} />
            <span className="hidden sm:inline">Atualizar</span>
          </button>
          {userRole === 'admin' && (
            <Link 
              href="/dashboard/clientes/novo" 
              className="flex-1 sm:flex-none bg-blue-600 text-white px-4 py-2.5 rounded-xl font-medium hover:bg-blue-700 transition flex items-center justify-center gap-2 text-xs sm:text-sm shadow-sm cursor-pointer whitespace-nowrap"
            >
              <Plus size={18} />
              <span>Novo Cliente</span>
            </Link>
          )}
        </div>
      </header>

      {/* 2. Barra de Cards Financeiros em Destaque (EXCLUSIVO PARA ADMINISTRADOR) */}
      {userRole === 'admin' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
          {/* Card 1: Soma das Mensalidades (MRR) */}
          <div className="flex items-center gap-3.5 bg-gradient-to-r from-emerald-50 via-teal-50/70 to-emerald-50 border border-emerald-200/90 rounded-2xl p-4 shadow-2xs transition-all hover:shadow-xs">
            <div className="p-3 bg-emerald-600 text-white rounded-xl shadow-xs shrink-0">
              <DollarSign size={22} className="stroke-[2.5]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 truncate">
                  Mensalidades
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                  MRR
                </span>
              </div>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-xl sm:text-2xl font-black text-emerald-950 font-mono tracking-tight truncate">
                  {totalMensalidades.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
                <span className="text-xs text-emerald-700 font-medium shrink-0">
                  /mês
                </span>
              </div>
              <div className="text-[11px] text-emerald-700/80 mt-0.5 truncate font-medium">
                {searchTerm ? `Filtradas: ${totalMensalidadesFiltradas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` : `${clientes.length} empresas cadastradas`}
              </div>
            </div>
          </div>

          {/* Card 2: Custo Total das Empresas */}
          <div className="flex items-center gap-3.5 bg-gradient-to-r from-rose-50 via-amber-50/60 to-rose-50 border border-rose-200/90 rounded-2xl p-4 shadow-2xs transition-all hover:shadow-xs">
            <div className="p-3 bg-rose-600 text-white rounded-xl shadow-xs shrink-0">
              <TrendingDown size={22} className="stroke-[2.5]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-rose-800 truncate">
                  Custo Total
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 border border-rose-200 shrink-0">
                  GASTOS
                </span>
              </div>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-xl sm:text-2xl font-black text-rose-950 font-mono tracking-tight truncate">
                  {totalCustos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
                <span className="text-xs text-rose-700 font-medium shrink-0">
                  /mês
                </span>
              </div>
              <div className="text-[11px] text-rose-700/80 mt-0.5 truncate font-medium">
                {searchTerm ? `Filtrado: ${totalCustosFiltrados.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` : 'Custos operacionais / licenças'}
              </div>
            </div>
          </div>

          {/* Card 3: Lucro Líquido (Mensalidades - Custos) */}
          <div className="flex items-center gap-3.5 bg-gradient-to-r from-blue-50 via-indigo-50/60 to-blue-50 border border-blue-200/90 rounded-2xl p-4 shadow-2xs transition-all hover:shadow-xs">
            <div className="p-3 bg-blue-600 text-white rounded-xl shadow-xs shrink-0">
              <TrendingUp size={22} className="stroke-[2.5]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800 truncate">
                  Lucro Líquido
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 border border-blue-200 shrink-0">
                  {margemLucro}% MARGEM
                </span>
              </div>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className={`text-xl sm:text-2xl font-black font-mono tracking-tight truncate ${totalLucro >= 0 ? 'text-blue-950' : 'text-red-700'}`}>
                  {totalLucro.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
                <span className="text-xs text-blue-700 font-medium shrink-0">
                  /mês
                </span>
              </div>
              <div className="text-[11px] text-blue-700/80 mt-0.5 truncate font-medium">
                {searchTerm ? `Líquido: ${totalLucroFiltrado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` : 'Mensalidades − Custos'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Barra de Busca Rápida Responsiva */}
      <div className="mb-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Buscar por Razão Social, CNPJ, CPF ou Contabilidade..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
          />
        </div>
        <div className="text-xs text-slate-500 font-medium self-end sm:self-center">
          {clientesFiltrados.length} {clientesFiltrados.length === 1 ? 'cliente encontrado' : 'clientes encontrados'}
        </div>
      </div>

      {/* 4. Card da Tabela com Rolagem Vertical Independente e Rolagem Horizontal Suave */}
      <div className="block md:hidden text-[11px] text-slate-400 mb-1.5 px-1 font-medium">
        👉 Deslize horizontalmente para visualizar todas as colunas
      </div>
      <div className="bg-white dark:bg-[#0B1120] rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-x-auto custom-scrollbar w-full">
        <table className="w-full text-left border-collapse min-w-[1100px]">
          <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 shadow-2xs">
            <tr className="bg-slate-50 border-b border-slate-200">
              <ResizableSortableTh
                columnId="logo"
                label="Logo"
                disableSort
                width={columnWidths.logo}
                onResize={handleResizeColumn}
                minWidth={80}
                align="center"
              />
              <ResizableSortableTh
                columnId="razao_social"
                label={priorizarNomeFantasia ? 'Nome Fantasia / Razão Social' : 'Razão Social / Ramo'}
                sortKey="razao_social"
                currentSortKey={sortKey}
                currentSortDirection={sortDirection}
                onSort={handleSort}
                width={columnWidths.razao_social}
                onResize={handleResizeColumn}
                minWidth={150}
              />
              <ResizableSortableTh
                columnId="cnpj"
                label="CNPJ / CPF"
                sortKey="cnpj"
                currentSortKey={sortKey}
                currentSortDirection={sortDirection}
                onSort={handleSort}
                width={columnWidths.cnpj}
                onResize={handleResizeColumn}
                minWidth={130}
              />
              <ResizableSortableTh
                columnId="regime"
                label="Regime"
                sortKey="regime"
                currentSortKey={sortKey}
                currentSortDirection={sortDirection}
                onSort={handleSort}
                width={columnWidths.regime}
                onResize={handleResizeColumn}
                minWidth={100}
              />
              {userRole === 'admin' && (
                <ResizableSortableTh
                  columnId="mensalidade"
                  label="Mensalidade / Lucro"
                  sortKey="mensalidade"
                  currentSortKey={sortKey}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                  width={columnWidths.mensalidade}
                  onResize={handleResizeColumn}
                  minWidth={140}
                />
              )}
              <ResizableSortableTh
                columnId="certificado"
                label="Certificado Digital"
                sortKey="certificado"
                currentSortKey={sortKey}
                currentSortDirection={sortDirection}
                onSort={handleSort}
                width={columnWidths.certificado}
                onResize={handleResizeColumn}
                minWidth={180}
              />
              <ResizableSortableTh
                columnId="contabilidade"
                label="Contabilidade"
                sortKey="contabilidade"
                currentSortKey={sortKey}
                currentSortDirection={sortDirection}
                onSort={handleSort}
                width={columnWidths.contabilidade}
                onResize={handleResizeColumn}
                minWidth={130}
              />
              <ResizableSortableTh
                columnId="status"
                label="Status"
                sortKey="status"
                currentSortKey={sortKey}
                currentSortDirection={sortDirection}
                onSort={handleSort}
                width={columnWidths.status}
                onResize={handleResizeColumn}
                minWidth={90}
              />
              <ResizableSortableTh
                columnId="token"
                label="Token do Hub"
                sortKey="token"
                currentSortKey={sortKey}
                currentSortDirection={sortDirection}
                onSort={handleSort}
                width={columnWidths.token}
                onResize={handleResizeColumn}
                minWidth={120}
              />
              <ResizableSortableTh
                columnId="acoes"
                label="Ações"
                disableSort
                width={columnWidths.acoes}
                onResize={handleResizeColumn}
                minWidth={110}
                align="right"
              />
            </tr>
          </thead>
          <tbody>
            {loading ? (
               <tr><td colSpan={userRole === 'admin' ? 10 : 9} className="p-8 text-center text-slate-500">Carregando...</td></tr>
            ) : clientesOrdenados.length === 0 ? (
              <tr><td colSpan={userRole === 'admin' ? 10 : 9} className="p-8 text-center text-slate-500">Nenhum cliente cadastrado.</td></tr>
            ) : (
              clientesOrdenados.map(c => {
                let certStatus = <span className="text-slate-400 text-xs">Não cadastrado</span>
                if (c.certificado_validade) {
                  const valDate = new Date(c.certificado_validade)
                  const diffDays = Math.ceil((valDate.getTime() - new Date().getTime()) / (1000 * 3600 * 24))

                  const rawDate = String(c.certificado_validade).split('T')[0]
                  const parts = rawDate.split('-')
                  const dataFormatada = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : valDate.toLocaleDateString('pt-BR')

                  let badge
                  if (diffDays < 0) {
                    badge = <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-red-100 text-red-700 whitespace-nowrap">Vencido</span>
                  } else if (diffDays <= 45) {
                    badge = <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800 whitespace-nowrap">Vence em {diffDays}d</span>
                  } else {
                    badge = <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800 whitespace-nowrap">Válido ({diffDays}d)</span>
                  }

                  certStatus = (
                    <div className="flex flex-col items-start gap-1">
                      {badge}
                      <span className="text-[11px] text-slate-500 font-mono font-medium whitespace-nowrap">
                        {dataFormatada}
                      </span>
                    </div>
                  )
                }

                const getRegimeBadge = (regime: string) => {
                  switch (regime) {
                    case 'simples_nacional':
                      return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800 whitespace-nowrap">Simples Nacional</span>
                    case 'simples_nacional_excesso':
                      return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800 whitespace-nowrap">Simples (Excesso)</span>
                    case 'lucro_presumido':
                      return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-100 text-blue-800 whitespace-nowrap">Lucro Presumido</span>
                    case 'lucro_real':
                      return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-100 text-purple-800 whitespace-nowrap">Lucro Real</span>
                    case 'mei':
                      return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-teal-100 text-teal-800 whitespace-nowrap">MEI</span>
                    default:
                      return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 whitespace-nowrap">Simples Nacional</span>
                  }
                }

                return (
                  <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="p-2.5 text-center">
                      <div className="w-12 h-12 mx-auto rounded-xl bg-white p-1 border border-slate-200/90 shadow-2xs flex items-center justify-center overflow-hidden">
                        {c.logo_url ? (
                          <img 
                            src={c.logo_url} 
                            alt={c.razao_social || 'Logo'} 
                            className="w-full h-full object-contain" 
                          />
                        ) : (
                          <div className="w-full h-full rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 text-xs font-black">
                            {((priorizarNomeFantasia && c.nome_fantasia) ? c.nome_fantasia : c.razao_social)?.charAt(0) || 'E'}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-slate-800">
                      {priorizarNomeFantasia ? (
                        <>
                          <div className="font-bold text-slate-900" title={c.nome_fantasia || c.razao_social}>
                            {c.nome_fantasia || c.razao_social}
                          </div>
                          <div className="text-xs text-slate-500" title={c.razao_social}>
                            {c.nome_fantasia ? c.razao_social : '—'}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="font-bold text-slate-900" title={c.razao_social}>
                            {c.razao_social}
                          </div>
                          <div className="text-xs text-slate-500" title={c.nome_fantasia || '—'}>
                            {c.nome_fantasia || '—'}
                          </div>
                        </>
                      )}
                      {c.ramo_atividade && (
                        <div className="text-[11px] text-blue-600 font-medium mt-0.5 max-w-[200px] truncate" title={c.ramo_atividade}>
                          🏢 {c.ramo_atividade}
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-slate-600 text-xs">
                      <div className="font-mono font-medium text-slate-800">{formatarCnpjCpf(c.cnpj) || c.cnpj}</div>
                      {c.nome_contato && <div className="text-slate-400 mt-0.5">{c.nome_contato}</div>}

                      {/* Informações de Login Visíveis no Cadastro */}
                      {c.login_email && (
                        <div className="mt-1.5 p-1.5 bg-blue-50/70 border border-blue-200/60 rounded-lg text-[11px] leading-tight space-y-1">
                          <div className="text-blue-900 font-semibold truncate flex items-center gap-1" title={`E-mail de Login: ${c.login_email}`}>
                            <KeyRound size={11} className="text-blue-600 shrink-0" />
                            <span className="truncate">{c.login_email}</span>
                          </div>
                          {c.login_senha && (
                            <div className="flex items-center justify-between gap-1 text-[10px] text-slate-600 pt-0.5 border-t border-blue-200/40">
                              <span className="text-slate-400 font-medium">Senha:</span>
                              <span className="font-mono font-bold text-slate-800">
                                {visiblePasswords[`login_${c.id}`] ? c.login_senha : '••••••'}
                              </span>
                              <button
                                type="button"
                                onClick={() => togglePasswordVisibility(`login_${c.id}`)}
                                className="text-slate-400 hover:text-blue-600 p-0.5 transition cursor-pointer"
                                title={visiblePasswords[`login_${c.id}`] ? 'Ocultar senha de login' : 'Ver senha de login'}
                              >
                                {visiblePasswords[`login_${c.id}`] ? <EyeOff size={11} /> : <Eye size={11} />}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="p-4">{getRegimeBadge(c.regime_tributario)}</td>
                    {userRole === 'admin' && (
                      <td className="p-4 align-top">
                        <div className="font-bold text-slate-900 text-sm whitespace-nowrap">
                          {c.valor_mensalidade !== undefined && c.valor_mensalidade !== null
                            ? Number(c.valor_mensalidade).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                            : 'R$ 0,00'}
                        </div>
                        <div className="mt-1 flex flex-col gap-0.5 text-[11px] leading-tight">
                          <span className="text-rose-600 font-medium whitespace-nowrap" title="Custo individual deste cliente">
                            Custo: {Number(c.custo || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </span>
                          <span className={`font-semibold whitespace-nowrap ${(Number(c.valor_mensalidade || 0) - Number(c.custo || 0)) >= 0 ? 'text-emerald-700' : 'text-red-600'}`} title="Lucro líquido (Mensalidade - Custo)">
                            Lucro: {(Number(c.valor_mensalidade || 0) - Number(c.custo || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </span>
                        </div>
                        {c.dia_vencimento && (
                          <div className="text-[10px] text-slate-400 font-medium mt-1 whitespace-nowrap">
                            Venc. dia {c.dia_vencimento}
                          </div>
                        )}
                      </td>
                    )}
                    <td className="p-4 align-top">
                      <div>{certStatus}</div>
                      {c.certificado_validade && (
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5 whitespace-nowrap">
                          Validade: {new Date(c.certificado_validade).toLocaleDateString('pt-BR')}
                        </div>
                      )}
                      {c.certificado_senha ? (
                        <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-lg w-fit whitespace-nowrap">
                          <span className="text-[10px] text-slate-400 font-semibold uppercase">Senha:</span>
                          <span className="font-mono text-slate-800 font-medium">
                            {visiblePasswords[c.id] ? c.certificado_senha : '••••••••'}
                          </span>
                          <button
                            type="button"
                            onClick={() => togglePasswordVisibility(c.id)}
                            className="text-slate-400 hover:text-blue-600 p-0.5 rounded transition cursor-pointer"
                            title={visiblePasswords[c.id] ? "Ocultar senha" : "Ver senha"}
                          >
                            {visiblePasswords[c.id] ? <EyeOff size={12} /> : <Eye size={12} />}
                          </button>
                        </div>
                      ) : (
                        <div className="text-[10px] text-slate-400 mt-1 italic">
                          Sem senha gravada
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-slate-600 text-xs">{c.contabilidades?.razao_social || <span className="text-slate-400">—</span>}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${c.is_ativo ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'}`}>
                        {c.is_ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1">
                        <code className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded max-w-[120px] truncate">{c.hub_token}</code>
                        <button onClick={() => copyToken(c.hub_token)} className="p-1 text-slate-400 hover:text-blue-600" title="Copiar Token">
                          <Copy size={14} />
                        </button>
                      </div>
                    </td>
                  <td className="p-4 text-right">
                    <div className="flex gap-2 justify-end">
                      <Link href={`/dashboard/clientes/${c.id}/editar`} className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition" title="Editar / Visualizar Dados Fiscais">
                        <Pencil size={16} />
                      </Link>
                      {userRole === 'admin' && (
                        <button onClick={() => setDeleteModal({ open: true, id: c.id, nome: c.razao_social })} className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition" title="Excluir">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )})
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de Confirmação de Exclusão */}
      {deleteModal.open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold text-slate-900">Confirmar Exclusão</h3>
              <button onClick={() => setDeleteModal({ open: false, id: '', nome: '' })} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <p className="text-slate-600 mb-6">
              Tem certeza que deseja excluir o cliente <strong className="text-red-600">{deleteModal.nome}</strong>? 
              Todos os dados vinculados (configurações, faturas, XMLs) também serão removidos. Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteModal({ open: false, id: '', nome: '' })} className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition font-medium">
                Cancelar
              </button>
              <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition font-medium disabled:opacity-50">
                {deleting ? 'Excluindo...' : 'Sim, Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal de Importação em Lote de Clientes */}
      <ImportadorLoteModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onSuccess={() => fetchClientes()}
        tipo="cliente"
        contabilidadesDisponiveis={contabilidades}
      />
    </div>
  )
}
