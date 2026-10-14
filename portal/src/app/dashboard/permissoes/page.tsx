'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { 
  ShieldCheck, FileDown, Download, Archive, BarChart3, 
  Coins, AlertTriangle, Receipt, Sliders, Users, 
  UserCircle, CheckCircle2, XCircle, Save, RotateCcw, 
  Search, Filter, Lock, Unlock, Info, Check, 
  HelpCircle, Eye, EyeOff, Sparkles, Database, Settings, 
  PlugZap, Wrench, ChevronDown, ChevronUp
} from 'lucide-react'
import toast from 'react-hot-toast'
import { ModuloPermissao } from '@/utils/permissoes'

const ICONES_MAP: Record<string, any> = {
  FileDown,
  Download,
  Archive,
  BarChart3,
  Coins,
  AlertTriangle,
  Receipt,
  Sliders,
  Users,
  UserCircle,
  ShieldCheck,
  Sparkles,
  Database,
  Settings,
  PlugZap,
  Wrench
}

export default function PermissoesPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [modulos, setModulos] = useState<ModuloPermissao[]>([])
  const [modulosOriginais, setModulosOriginais] = useState<ModuloPermissao[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('todos')
  const [openCategorias, setOpenCategorias] = useState<Record<string, boolean>>({})

  // Controle de sanfona (accordion)
  const isCategoriaOpen = (categoria: string) => {
    return openCategorias[categoria] !== false
  }

  const toggleCategoria = (categoria: string) => {
    setOpenCategorias(prev => ({
      ...prev,
      [categoria]: !isCategoriaOpen(categoria)
    }))
  }

  const expandirTodas = () => {
    const map: Record<string, boolean> = {}
    categorias.forEach(c => { map[c] = true })
    setOpenCategorias(map)
  }

  const recolherTodas = () => {
    const map: Record<string, boolean> = {}
    categorias.forEach(c => { map[c] = false })
    setOpenCategorias(map)
  }

  // 1. Verificar permissão de Admin e carregar dados
  useEffect(() => {
    async function loadData() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single()

      if (!roleData || roleData.role !== 'admin') {
        setUserRole(roleData?.role || 'desconhecido')
        setLoading(false)
        return
      }

      setUserRole('admin')

      // Buscar módulos cadastrados
      const { data: modulosData, error } = await supabase
        .from('permissoes_modulos')
        .select('*')
        .order('ordem', { ascending: true })

      if (error) {
        toast.error('Erro ao carregar permissões: ' + error.message)
      } else if (modulosData) {
        setModulos(modulosData)
        setModulosOriginais(JSON.parse(JSON.stringify(modulosData)))
      }

      setLoading(false)
    }

    loadData()
  }, [])

  // Categorias únicas
  const categorias = useMemo(() => {
    const set = new Set<string>()
    modulos.forEach(m => set.add(m.categoria))
    return Array.from(set)
  }, [modulos])

  // Filtragem de busca e categoria
  const modulosFiltrados = useMemo(() => {
    return modulos.filter(m => {
      const matchTexto = 
        m.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.descricao && m.descricao.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (m.rota && m.rota.toLowerCase().includes(searchTerm.toLowerCase()))
      
      const matchCategoria = categoriaFiltro === 'todos' || m.categoria === categoriaFiltro

      return matchTexto && matchCategoria
    })
  }, [modulos, searchTerm, categoriaFiltro])

  // Agrupamento por categoria
  const modulosPorCategoria = useMemo(() => {
    const agrupado: Record<string, ModuloPermissao[]> = {}
    modulosFiltrados.forEach(m => {
      if (!agrupado[m.categoria]) agrupado[m.categoria] = []
      agrupado[m.categoria].push(m)
    })
    return agrupado
  }, [modulosFiltrados])

  // Detectar se há alterações não salvas
  const temAlteracoes = useMemo(() => {
    return JSON.stringify(modulos) !== JSON.stringify(modulosOriginais)
  }, [modulos, modulosOriginais])

  // Métricas rápidas
  const totalModulos = modulos.length
  const totalClientesLiberados = modulos.filter(m => m.permitido_cliente).length
  const totalContabilidadesLiberados = modulos.filter(m => m.permitido_contabilidade).length

  // Alternar permissão individual
  const togglePermissao = (id: string, perfil: 'cliente' | 'contabilidade') => {
    setModulos(prev => prev.map(m => {
      if (m.id === id) {
        if (perfil === 'cliente') {
          return { ...m, permitido_cliente: !m.permitido_cliente }
        } else {
          return { ...m, permitido_contabilidade: !m.permitido_contabilidade }
        }
      }
      return m
    }))
  }

  // Ações em massa por perfil
  const setAllPerfil = (perfil: 'cliente' | 'contabilidade', valor: boolean) => {
    setModulos(prev => prev.map(m => ({
      ...m,
      [perfil === 'cliente' ? 'permitido_cliente' : 'permitido_contabilidade']: valor
    })))
    toast.success(
      valor 
        ? `Todos os módulos liberados para ${perfil === 'cliente' ? 'Clientes' : 'Contabilidades'}!` 
        : `Todos os módulos bloqueados para ${perfil === 'cliente' ? 'Clientes' : 'Contabilidades'}!`
    )
  }

  // Restaurar padrões originais salvos
  const handleRestaurar = () => {
    setModulos(JSON.parse(JSON.stringify(modulosOriginais)))
    toast('Alterações descartadas.', { icon: '↩️' })
  }

  // Salvar no Supabase
  const handleSalvar = async () => {
    setSaving(true)
    try {
      const updates = modulos.map(m => ({
        id: m.id,
        modulo_chave: m.modulo_chave,
        nome: m.nome,
        descricao: m.descricao,
        categoria: m.categoria,
        rota: m.rota,
        icone: m.icone,
        ordem: m.ordem,
        permitido_cliente: m.permitido_cliente,
        permitido_contabilidade: m.permitido_contabilidade,
        permitido_admin: true,
        updated_at: new Date().toISOString()
      }))

      const { error } = await supabase
        .from('permissoes_modulos')
        .upsert(updates, { onConflict: 'modulo_chave' })

      if (error) {
        toast.error('Erro ao salvar permissões: ' + error.message)
      } else {
        setModulosOriginais(JSON.parse(JSON.stringify(modulos)))
        toast.success('Permissões salvas e aplicadas com sucesso!')
      }
    } catch (err: any) {
      toast.error('Falha inesperada: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 font-medium text-sm">Carregando painel de permissões...</p>
      </div>
    )
  }

  // Se não for admin, exibe tela de bloqueio
  if (userRole !== 'admin') {
    return (
      <div className="max-w-xl mx-auto mt-16 p-8 bg-white rounded-2xl shadow-sm border border-red-100 text-center">
        <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Lock size={32} />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Acesso Restrito ao Administrador</h2>
        <p className="text-slate-600 text-sm mb-6">
          Esta área é reservada exclusivamente para os administradores do sistema definirem as regras de acesso de cada perfil.
        </p>
        <button
          onClick={() => router.push('/dashboard')}
          className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition"
        >
          Voltar ao Dashboard
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-16">
      
      {/* 1. Header Principal */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold border border-indigo-500/30">
              <ShieldCheck size={14} className="text-indigo-400" />
              Controle de Acesso & Perfis (RBAC)
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Permissões & Controle de Módulos
            </h1>
            <p className="text-slate-300 text-sm max-w-2xl leading-relaxed">
              Defina de forma centralizada quais telas, abas e recursos do Portal ficam visíveis e liberados para 
              <span className="text-indigo-300 font-semibold"> Clientes</span> e 
              <span className="text-indigo-300 font-semibold"> Contabilidades</span>. 
              O Administrador tem acesso irrestrito e automático a 100% dos recursos.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {temAlteracoes && (
              <button
                onClick={handleRestaurar}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 text-sm font-semibold transition border border-white/15"
              >
                <RotateCcw size={16} />
                Descartar
              </button>
            )}

            <button
              onClick={handleSalvar}
              disabled={saving}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold shadow-lg transition-all ${
                temAlteracoes 
                  ? 'bg-indigo-500 hover:bg-indigo-600 text-white shadow-indigo-500/30 scale-105' 
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
              } disabled:opacity-50`}
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Salvando...
                </>
              ) : (
                <>
                  <Save size={16} />
                  {temAlteracoes ? 'Salvar Alterações' : 'Permissões Salvas'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 2. Cards de Estatísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total de Módulos</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">{totalModulos}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Recursos mapeados no portal</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Sliders size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Liberados para Clientes</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">
              {totalClientesLiberados} <span className="text-xs font-normal text-slate-400">/ {totalModulos}</span>
            </p>
            <p className="text-[11px] text-emerald-600 font-medium mt-0.5">
              {Math.round((totalClientesLiberados / (totalModulos || 1)) * 100)}% das abas ativas
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <Users size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Liberados p/ Contabilidade</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">
              {totalContabilidadesLiberados} <span className="text-xs font-normal text-slate-400">/ {totalModulos}</span>
            </p>
            <p className="text-[11px] text-indigo-600 font-medium mt-0.5">
              {Math.round((totalContabilidadesLiberados / (totalModulos || 1)) * 100)}% das abas ativas
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <BarChart3 size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Perfil Administrador</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">100%</p>
            <p className="text-[11px] text-amber-600 font-medium mt-0.5">Controle mestre irrestrito</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <ShieldCheck size={22} />
          </div>
        </div>
      </div>

      {/* 3. Barra de Filtros, Busca e Ações Rápidas */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Busca */}
          <div className="relative flex-1 max-w-md">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por módulo, descrição ou rota..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          {/* Filtro de Categoria */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
            <button
              onClick={() => setCategoriaFiltro('todos')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                categoriaFiltro === 'todos'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Todos ({totalModulos})
            </button>
            {categorias.map(cat => (
              <button
                key={cat}
                onClick={() => setCategoriaFiltro(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                  categoriaFiltro === cat
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Ações em Massa e Controle de Sanfona */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Sanfona:</span>
            <button
              type="button"
              onClick={expandirTodas}
              className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold border border-slate-200 dark:border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
            >
              <ChevronDown size={13} />
              Expandir Todas
            </button>
            <button
              type="button"
              onClick={recolherTodas}
              className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold border border-slate-200 dark:border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
            >
              <ChevronUp size={13} />
              Recolher Todas
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-500 dark:text-slate-400 font-medium hidden sm:inline">Ações em massa:</span>
            <button
              onClick={() => setAllPerfil('cliente', true)}
              className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-semibold border border-emerald-200 transition cursor-pointer"
            >
              + Liberar Todos p/ Clientes
            </button>
            <button
              onClick={() => setAllPerfil('cliente', false)}
              className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200 font-semibold border border-slate-200 transition cursor-pointer"
            >
              - Bloquear Todos p/ Clientes
            </button>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <button
              onClick={() => setAllPerfil('contabilidade', true)}
              className="px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-semibold border border-indigo-200 transition cursor-pointer"
            >
              + Liberar Todos p/ Contabilidades
            </button>
            <button
              onClick={() => setAllPerfil('contabilidade', false)}
              className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200 font-semibold border border-slate-200 transition cursor-pointer"
            >
              - Bloquear Todos p/ Contabilidades
            </button>
          </div>
        </div>
      </div>

      {/* 4. Lista de Módulos Agrupados por Categoria */}
      <div className="space-y-6">
        {Object.entries(modulosPorCategoria).length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-500">
            <Search size={36} className="mx-auto text-slate-300 mb-3" />
            <p className="font-semibold text-base">Nenhum módulo encontrado</p>
            <p className="text-xs text-slate-400 mt-1">Tente ajustar o termo de pesquisa ou os filtros de categoria.</p>
          </div>
        ) : (
          Object.entries(modulosPorCategoria).map(([categoria, listaModulos]) => {
            const isOpen = isCategoriaOpen(categoria)

            return (
              <div 
                key={categoria} 
                className="bg-white dark:bg-[#0B1120] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-all duration-200"
              >
                
                {/* Header da Categoria com Efeito Sanfona (Destaque Escuro + Letras Claras) */}
                <div 
                  onClick={() => toggleCategoria(categoria)}
                  className={`bg-slate-900 hover:bg-slate-800 dark:bg-[#0F172A] dark:hover:bg-slate-800/90 px-6 py-4.5 flex items-center justify-between cursor-pointer select-none transition-colors group ${
                    isOpen ? 'border-b border-slate-800' : ''
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    {/* Badge Contador */}
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 flex items-center justify-center font-extrabold text-sm shadow-xs group-hover:scale-105 transition-transform">
                      {listaModulos.length}
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-base sm:text-lg flex items-center gap-2 tracking-tight">
                        {categoria}
                      </h3>
                      <p className="text-xs text-slate-400 font-normal">
                        {listaModulos.length} {listaModulos.length === 1 ? 'funcionalidade configurável' : 'funcionalidades configuráveis'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 sm:gap-8">
                    <div className="hidden sm:flex items-center gap-8 text-xs font-bold uppercase tracking-wider pr-2">
                      <span className="w-32 text-center text-emerald-400">Clientes</span>
                      <span className="w-32 text-center text-indigo-300">Contabilidades</span>
                      <span className="w-24 text-center text-amber-400">Admin</span>
                    </div>

                    {/* Botão/Ícone Indicador do Efeito Sanfona */}
                    <div className="w-8 h-8 rounded-lg bg-slate-800 group-hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-all shadow-xs border border-slate-700/60">
                      <ChevronDown 
                        size={18} 
                        className={`transition-transform duration-300 ${isOpen ? 'rotate-180 text-white' : 'text-slate-400'}`} 
                      />
                    </div>
                  </div>
                </div>

                {/* Conteúdo Expansível (Efeito Sanfona) */}
                <div 
                  className={`transition-all duration-300 ease-in-out overflow-hidden ${
                    isOpen ? 'max-h-[3000px] opacity-100' : 'max-h-0 opacity-0 pointer-events-none'
                  }`}
                >
                  {/* Linhas de Módulos */}
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {listaModulos.map((modulo) => {
                      const IconComponent = ICONES_MAP[modulo.icone || ''] || FileDown

                      return (
                        <div 
                          key={modulo.id} 
                          className="p-5 sm:px-6 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                        >
                          {/* Info do Módulo */}
                          <div className="flex items-start gap-4 flex-1 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center flex-shrink-0 mt-0.5 border border-slate-200/60 dark:border-slate-700">
                              <IconComponent size={20} className="text-indigo-600 dark:text-indigo-400" />
                            </div>
                            
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-bold text-slate-800 dark:text-slate-100 text-sm sm:text-base">
                                  {modulo.nome}
                                </span>
                                {modulo.rota ? (
                                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                    {modulo.rota}
                                  </span>
                                ) : (
                                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                                    Ação / Recurso Interno
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-3xl">
                                {modulo.descricao}
                              </p>
                            </div>
                          </div>

                          {/* Controles de Permissão (Toggles) */}
                          <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-8 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                            
                            {/* Toggle Cliente */}
                            <div className="flex flex-col items-center sm:w-32">
                              <span className="sm:hidden text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Clientes</span>
                              <button
                                type="button"
                                onClick={() => togglePermissao(modulo.id, 'cliente')}
                                className={`w-full max-w-[120px] py-1.5 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 border shadow-sm cursor-pointer ${
                                  modulo.permitido_cliente
                                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/60'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                                }`}
                              >
                                {modulo.permitido_cliente ? (
                                  <>
                                    <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400" />
                                    Liberado
                                  </>
                                ) : (
                                  <>
                                    <XCircle size={14} className="text-slate-400 dark:text-slate-500" />
                                    Oculto
                                  </>
                                )}
                              </button>
                            </div>

                            {/* Toggle Contabilidade */}
                            <div className="flex flex-col items-center sm:w-32">
                              <span className="sm:hidden text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Contabilidade</span>
                              <button
                                type="button"
                                onClick={() => togglePermissao(modulo.id, 'contabilidade')}
                                className={`w-full max-w-[120px] py-1.5 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 border shadow-sm cursor-pointer ${
                                  modulo.permitido_contabilidade
                                    ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700 hover:bg-indigo-100 dark:hover:bg-indigo-900/60'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                                }`}
                              >
                                {modulo.permitido_contabilidade ? (
                                  <>
                                    <CheckCircle2 size={14} className="text-indigo-600 dark:text-indigo-400" />
                                    Liberado
                                  </>
                                ) : (
                                  <>
                                    <XCircle size={14} className="text-slate-400 dark:text-slate-500" />
                                    Oculto
                                  </>
                                )}
                              </button>
                            </div>

                            {/* Badge Admin (Fixo) */}
                            <div className="flex flex-col items-center sm:w-24">
                              <span className="sm:hidden text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Admin</span>
                              <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 text-xs font-bold shadow-sm">
                                <ShieldCheck size={13} />
                                Total
                              </span>
                            </div>

                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

              </div>
            )
          })
        )}
      </div>

      {/* Floating Save Bar se houver alterações pendentes */}
      {temAlteracoes && (
        <div className="fixed bottom-6 right-6 z-40 bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></div>
            <span className="text-xs sm:text-sm font-medium">Existem alterações não salvas nas permissões</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRestaurar}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
            >
              Cancelar
            </button>
            <button
              onClick={handleSalvar}
              disabled={saving}
              className="px-4 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-indigo-500/30"
            >
              {saving ? 'Salvando...' : 'Salvar Agora'}
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
