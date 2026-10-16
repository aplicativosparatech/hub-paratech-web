'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { 
  LayoutDashboard, Users, Building2, Settings, FileText, 
  LogOut, BarChart3, Receipt, FileDown, PlugZap, UserCircle,
  Menu, X, Sliders, ShieldCheck, Sparkles, Database,
  Maximize2, Minimize2, Sun, Moon, Palette, ScanText, GraduationCap, Inbox
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import toast from 'react-hot-toast'
import { PermissoesMap } from '@/utils/permissoes'
import { APP_VERSION } from '@/utils/version'
import TabHeaderBanner from '@/components/TabHeaderBanner'
import SefazStatusBadge from '@/components/SefazStatusBadge'

type Role = 'admin' | 'cliente' | 'contabilidade'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const [role, setRole] = useState<Role | null>(null)
  const [permissoesMap, setPermissoesMap] = useState<PermissoesMap>({})
  const [loading, setLoading] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  // 0. Tema Claro / Escuro
  useEffect(() => {
    const saved = localStorage.getItem('hub_theme')
    if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setTheme('dark')
      document.documentElement.classList.add('dark')
    } else {
      setTheme('light')
      document.documentElement.classList.remove('dark')
    }
  }, [])

  const handleSetTheme = (newTheme: 'light' | 'dark') => {
    setTheme(newTheme)
    localStorage.setItem('hub_theme', newTheme)
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  // 2. Listener e Controle de Tela Inteira (Modo Kiosk F11)
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error('Erro ao ativar tela inteira:', err)
      })
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(err => {
          console.error('Erro ao sair de tela cheia:', err)
        })
      }
    }
  }

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFsChange)
    return () => document.removeEventListener('fullscreenchange', handleFsChange)
  }, [])

  // 3. Controle de Tela Cheia Automática no Movimento do Mouse (se configurado em Aparência)
  useEffect(() => {
    const autoFs = localStorage.getItem('hub_display_mode') === 'fullscreen'
    if (!autoFs) return

    let triggered = false
    const handleFirstUserAction = () => {
      if (triggered) return
      triggered = true

      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {})
      }

      window.removeEventListener('mousemove', handleFirstUserAction)
      window.removeEventListener('pointerdown', handleFirstUserAction)
      window.removeEventListener('keydown', handleFirstUserAction)
    }

    window.addEventListener('mousemove', handleFirstUserAction, { passive: true })
    window.addEventListener('pointerdown', handleFirstUserAction, { passive: true })
    window.addEventListener('keydown', handleFirstUserAction, { passive: true })

    return () => {
      window.removeEventListener('mousemove', handleFirstUserAction)
      window.removeEventListener('pointerdown', handleFirstUserAction)
      window.removeEventListener('keydown', handleFirstUserAction)
    }
  }, [pathname])

  useEffect(() => {
    async function loadRole() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: roleData, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single()

      if (error || !roleData) {
        toast.error(`Erro de permissão: ${error?.message || 'Papel não encontrado'}`)
        setTimeout(async () => {
          await supabase.auth.signOut()
          router.push('/login')
        }, 4000)
        return
      }

      setRole(roleData.role as Role)

      // Carregar configurações de permissões de módulos
      const { data: perms } = await supabase
        .from('permissoes_modulos')
        .select('modulo_chave, permitido_cliente, permitido_contabilidade')

      if (perms) {
        const map: PermissoesMap = {}
        perms.forEach(p => {
          map[p.modulo_chave] = {
            cliente: p.permitido_cliente,
            contabilidade: p.permitido_contabilidade
          }
        })
        setPermissoesMap(map)
      }

      setLoading(false)
    }
    loadRole()
  }, [])

  const canAccess = (moduloKey: string) => {
    if (role === 'admin') return true
    if (!role) return false
    const perm = permissoesMap[moduloKey]
    if (!perm) return true
    return role === 'cliente' ? perm.cliente : perm.contabilidade
  }

  // Proteção dinâmica de rotas se o módulo estiver desativado pelo Admin
  useEffect(() => {
    if (loading || !role || role === 'admin') return

    const rotasProtegidas = [
      { prefixo: '/dashboard/minhas-faturas', modulo: 'faturas', nome: 'Minhas Faturas' },
      { prefixo: '/dashboard/faturas', modulo: 'faturas', nome: 'Faturas' },
      { prefixo: '/dashboard/notas-fiscais/saidas/correcao', modulo: 'notas_fiscais_correcao', nome: 'Correção de Notas Fiscais' },
      { prefixo: '/dashboard/notas-fiscais', modulo: 'notas_fiscais', nome: 'Notas Fiscais' },
      { prefixo: '/dashboard/distribuicao-dfe', modulo: 'distribuicao_dfe', nome: 'Distribuição de DF-e' },
      { prefixo: '/dashboard/configuracoes-portal', modulo: 'configuracoes_portal', nome: 'Configurações do Portal' },
      { prefixo: '/dashboard/configuracoes', modulo: 'configuracoes_hub', nome: 'Configurações Hub' },
      { prefixo: '/dashboard/integracoes', modulo: 'integracoes', nome: 'Integrações (APIs)' },
      { prefixo: '/dashboard/corretor-tributario', modulo: 'corretor_tributario', nome: 'Corretor Tributário' },
      { prefixo: '/dashboard/saneador-arquivos', modulo: 'saneador_arquivos', nome: 'Saneador de Arquivos' },
      { prefixo: '/dashboard/sugestor-tributario', modulo: 'sugestor_tributario', nome: 'Sugestor Tributário' },
      { prefixo: '/dashboard/meus-clientes', modulo: 'contabilidade_meus_clientes', nome: 'Meus Clientes' },
      { prefixo: '/dashboard/meu-perfil', modulo: 'meu_perfil', nome: 'Meu Perfil' },
      { prefixo: '/dashboard/aparencia', modulo: 'aparencia', nome: 'Personalização & Aparência' },
      { prefixo: '/dashboard/permissoes', modulo: '_admin_only', nome: 'Permissões' },
    ]

    for (const r of rotasProtegidas) {
      if (pathname === r.prefixo || pathname.startsWith(r.prefixo + '/')) {
        if (r.modulo === '_admin_only') {
          toast.error('Acesso restrito ao Administrador.')
          router.push('/dashboard')
          return
        }
        if (!canAccess(r.modulo)) {
          toast.error(`O módulo ${r.nome} está desativado para o seu perfil.`)
          router.push('/dashboard')
          return
        }
      }
    }

    if (pathname === '/dashboard/relatorios' || pathname.startsWith('/dashboard/relatorios/')) {
      const temRelatorio = canAccess('relatorios') || canAccess('relatorios_resumo') || canAccess('relatorios_monofasicos') || canAccess('relatorios_auditoria')
      if (!temRelatorio) {
        toast.error('O módulo de Relatórios está desativado para o seu perfil.')
        router.push('/dashboard')
        return
      }
    }
  }, [pathname, role, permissoesMap, loading])

  // Fecha o menu mobile ao navegar
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white gap-3 select-none">
        <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <span className="text-xs text-slate-400 font-medium">Carregando painel...</span>
      </div>
    )
  }

  // Componente de Link Customizado para o Menu
  const NavItem = ({ href, icon: Icon, label }: { href: string, icon: any, label: string }) => {
    const isActive = pathname === href || pathname.startsWith(href + '/')
    return (
      <Link 
        href={href} 
        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
          isActive 
            ? 'bg-blue-600/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400 font-semibold shadow-xs' 
            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-slate-100'
        }`}
      >
        <Icon size={20} className={isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500 group-hover:text-blue-500 transition-colors'} />
        <span>{label}</span>
      </Link>
    )
  }

  const SidebarContent = () => (
    <>
      <div className="p-5 lg:p-6 pb-4 border-b border-slate-100 dark:border-slate-800/80 flex items-start justify-between">
        <div className="flex flex-col items-start w-full gap-2.5">
          {/* Logo Paratech Oficial (Imagem 01) - mesma largura da junção HubParatech + versão como na imagem 2 */}
          <Link href="/dashboard" className="block w-full transition-transform hover:scale-[1.01]">
            <img 
              src="/logo-paratech.webp" 
              alt="Paratech Soluções & Sistemas" 
              className="w-full h-auto object-contain block drop-shadow-xs"
            />
          </Link>
          <div className="w-full flex items-center justify-between">
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Hub<span className="text-blue-600">Paratech</span>
            </h2>
            <span className="text-[11px] font-bold uppercase tracking-wider bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2.5 py-0.5 rounded-xl border border-blue-200 dark:border-blue-800">
              {APP_VERSION}
            </span>
          </div>

          {/* Status do Servidor SEFAZ em tempo real (Clicável para maiores detalhes) */}
          <div className="w-full mt-1">
            <SefazStatusBadge />
          </div>
        </div>
        {/* Botão fechar para mobile */}
        <button 
          onClick={() => setMobileMenuOpen(false)} 
          className="md:hidden p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg -mt-1 -mr-2"
        >
          <X size={20} />
        </button>
      </div>
      
      <nav className="flex-1 px-4 lg:px-5 space-y-1.5 mt-2 overflow-y-auto custom-scrollbar">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-4 mt-2">Visão Geral</div>
        <NavItem href="/dashboard" icon={LayoutDashboard} label="Dashboard" />

        {/* ===== MENUS DO ADMIN ===== */}
        {role === 'admin' && (
          <>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-4 mt-6">Gestão</div>
            <NavItem href="/dashboard/contabilidades" icon={Building2} label="Contabilidades" />
            <NavItem href="/dashboard/clientes" icon={Users} label="Clientes" />
            <NavItem href="/dashboard/faturas" icon={Receipt} label="Faturas" />
            <NavItem href="/dashboard/notas-fiscais" icon={FileDown} label="Notas Fiscais" />
            <NavItem href="/dashboard/distribuicao-dfe" icon={Inbox} label="Distribuição de DF-e" />
            
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-4 mt-6">Sistema</div>
            <NavItem href="/dashboard/relatorios" icon={BarChart3} label="Relatórios" />
            <NavItem href="/dashboard/corretor-tributario" icon={Sparkles} label="Corretor Tributário" />
            <NavItem href="/dashboard/saneador-arquivos" icon={Database} label="Saneador de Arquivos" />
            <NavItem href="/dashboard/sugestor-tributario" icon={ScanText} label="Sugestor Tributário" />
            <NavItem href="/dashboard/integracoes" icon={PlugZap} label="Integrações (APIs)" />
            <NavItem href="/dashboard/permissoes" icon={ShieldCheck} label="Permissões" />
            <NavItem href="/dashboard/aparencia" icon={Palette} label="Aparência" />
            <NavItem href="/dashboard/configuracoes-portal" icon={Sliders} label="Configurações do Portal" />
            <NavItem href="/dashboard/configuracoes" icon={Settings} label="Configurações Hub" />
            <NavItem href="/dashboard/tutorial" icon={GraduationCap} label="Tutorial & Tour IA" />
          </>
        )}

        {/* ===== MENUS DO CLIENTE ===== */}
        {role === 'cliente' && (
          <>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-4 mt-6">Meu Espaço</div>
            {canAccess('faturas') && <NavItem href="/dashboard/minhas-faturas" icon={Receipt} label="Minhas Faturas" />}
            {canAccess('notas_fiscais') && <NavItem href="/dashboard/notas-fiscais" icon={FileDown} label="Minhas Notas Fiscais" />}
            {canAccess('distribuicao_dfe') && <NavItem href="/dashboard/distribuicao-dfe" icon={Inbox} label="Distribuição de DF-e" />}
            {(canAccess('relatorios') || canAccess('relatorios_resumo') || canAccess('relatorios_monofasicos') || canAccess('relatorios_auditoria')) && (
              <NavItem href="/dashboard/relatorios" icon={BarChart3} label="Relatórios" />
            )}
            {canAccess('corretor_tributario') && <NavItem href="/dashboard/corretor-tributario" icon={Sparkles} label="Corretor Tributário" />}
            {canAccess('saneador_arquivos') && <NavItem href="/dashboard/saneador-arquivos" icon={Database} label="Saneador de Arquivos" />}
            {canAccess('sugestor_tributario') && <NavItem href="/dashboard/sugestor-tributario" icon={ScanText} label="Sugestor Tributário" />}
            {canAccess('aparencia') && <NavItem href="/dashboard/aparencia" icon={Palette} label="Aparência" />}
            {canAccess('configuracoes_portal') && <NavItem href="/dashboard/configuracoes-portal" icon={Sliders} label="Configurações do Portal" />}
            {canAccess('configuracoes_hub') && <NavItem href="/dashboard/configuracoes" icon={Settings} label="Configurações Hub" />}
            {canAccess('integracoes') && <NavItem href="/dashboard/integracoes" icon={PlugZap} label="Integrações (APIs)" />}
            {canAccess('meu_perfil') && <NavItem href="/dashboard/meu-perfil" icon={UserCircle} label="Meu Perfil" />}
            <NavItem href="/dashboard/tutorial" icon={GraduationCap} label="Tutorial & Tour IA" />
          </>
        )}

        {/* ===== MENUS DA CONTABILIDADE ===== */}
        {role === 'contabilidade' && (
          <>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-4 mt-6">Escritório</div>
            {canAccess('contabilidade_meus_clientes') && <NavItem href="/dashboard/meus-clientes" icon={Users} label="Meus Clientes" />}
            {canAccess('notas_fiscais') && <NavItem href="/dashboard/notas-fiscais" icon={FileDown} label="Notas Fiscais (XMLs)" />}
            {canAccess('distribuicao_dfe') && <NavItem href="/dashboard/distribuicao-dfe" icon={Inbox} label="Distribuição de DF-e" />}
            {(canAccess('relatorios') || canAccess('relatorios_resumo') || canAccess('relatorios_monofasicos') || canAccess('relatorios_auditoria')) && (
              <NavItem href="/dashboard/relatorios" icon={BarChart3} label="Relatórios" />
            )}
            {canAccess('corretor_tributario') && <NavItem href="/dashboard/corretor-tributario" icon={Sparkles} label="Corretor Tributário" />}
            {canAccess('saneador_arquivos') && <NavItem href="/dashboard/saneador-arquivos" icon={Database} label="Saneador de Arquivos" />}
            {canAccess('sugestor_tributario') && <NavItem href="/dashboard/sugestor-tributario" icon={ScanText} label="Sugestor Tributário" />}
            {canAccess('aparencia') && <NavItem href="/dashboard/aparencia" icon={Palette} label="Aparência" />}
            {canAccess('configuracoes_portal') && <NavItem href="/dashboard/configuracoes-portal" icon={Sliders} label="Configurações do Portal" />}
            {canAccess('configuracoes_hub') && <NavItem href="/dashboard/configuracoes" icon={Settings} label="Configurações Hub" />}
            {canAccess('integracoes') && <NavItem href="/dashboard/integracoes" icon={PlugZap} label="Integrações (APIs)" />}
            {canAccess('meu_perfil') && <NavItem href="/dashboard/meu-perfil" icon={Building2} label="Perfil do Escritório" />}
            <NavItem href="/dashboard/tutorial" icon={GraduationCap} label="Tutorial & Tour IA" />
          </>
        )}
      </nav>

      {/* User Card Inferior */}
      <div className="p-4 lg:p-5 border-t border-slate-100 bg-slate-50/50 mt-auto">
        <div className="flex items-center gap-3 px-3 py-2 mb-3 bg-white rounded-lg shadow-sm border border-slate-200">
          <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm uppercase">
            {role?.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-700 truncate capitalize">{role}</p>
            <p className="text-xs text-slate-500 truncate">Sessão Ativa</p>
          </div>
        </div>
        <button 
          onClick={handleLogout} 
          className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl text-red-600 hover:bg-red-50 hover:text-red-700 font-medium transition-colors border border-transparent hover:border-red-100 text-sm"
        >
          <LogOut size={18} />
          <span>Encerrar Sessão</span>
        </button>

        <div className="mt-3 pt-2.5 border-t border-slate-200/70 flex items-center justify-between text-[11px] text-slate-400 px-1">
          <span>Portal & Hub</span>
          <span className="font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">{APP_VERSION}</span>
        </div>
      </div>
    </>
  )

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 font-sans transition-colors duration-200">
      
      {/* 0. Banner Ilustrado Panorâmico no Topo (100% de largura) */}
      <TabHeaderBanner />

      <div className="flex-1 flex overflow-hidden relative">
        {/* 1. Sidebar Desktop (Fixa na esquerda) */}
        <aside className="hidden md:flex md:w-64 lg:w-72 bg-white dark:bg-[#0B1120] border-r border-slate-200 dark:border-slate-800 flex-col shadow-xs relative z-10 flex-shrink-0 transition-colors duration-200">
          <SidebarContent />
        </aside>

        {/* 2. Sidebar Mobile (Drawer com Overlay) */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex">
            {/* Backdrop escuro com clique para fechar */}
            <div 
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity" 
              onClick={() => setMobileMenuOpen(false)} 
            />
            {/* Menu Drawer Deslizante */}
            <div className="relative w-72 max-w-[85vw] bg-white dark:bg-[#0B1120] h-full flex flex-col shadow-2xl z-10 transition-colors duration-200">
              <SidebarContent />
            </div>
          </div>
        )}

        {/* 3. Main Content (Totalmente expandido em 100% da tela) */}
        <main className="flex-1 flex flex-col h-full overflow-y-auto bg-[#F8FAFC] dark:bg-[#06090F] transition-colors duration-200">
        {/* Topbar moderna e responsiva */}
        <header className="h-16 bg-white/80 dark:bg-[#0B1120]/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 sm:px-6 lg:px-8 sticky top-0 z-20 shadow-xs flex-shrink-0 transition-colors duration-200">
          <div className="flex items-center gap-3">
            {/* Botão Hambúrguer Mobile */}
            <button 
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 focus:outline-none"
              aria-label="Abrir Menu"
            >
              <Menu size={22} />
            </button>
            <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100 capitalize">
              {pathname.split('/').pop()?.replace('-', ' ') || 'Visão Geral'}
            </h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Seletor com Opções de Tema Claro e Tema Escuro */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200/80 dark:border-slate-700 text-xs shadow-xs">
              <button
                type="button"
                onClick={() => handleSetTheme('light')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  theme === 'light'
                    ? 'bg-white text-amber-600 shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
                title="Ativar Tema Claro"
              >
                <Sun size={14} className={theme === 'light' ? 'text-amber-500 fill-amber-400/30' : ''} />
                <span className="hidden sm:inline">Tema Claro</span>
              </button>

              <button
                type="button"
                onClick={() => handleSetTheme('dark')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  theme === 'dark'
                    ? 'bg-slate-900 text-indigo-400 shadow-xs border border-slate-700/80'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
                title="Ativar Tema Escuro"
              >
                <Moon size={14} className={theme === 'dark' ? 'text-indigo-400 fill-indigo-400/30' : ''} />
                <span className="hidden sm:inline">Tema Escuro</span>
              </button>
            </div>

            {/* Botão Modo Kiosk / Tela Inteira (F11) */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition border border-slate-200/80 dark:border-slate-700 shadow-xs cursor-pointer"
              title={isFullscreen ? "Sair da Tela Cheia (F11)" : "Modo Tela Inteira / Kiosk (F11)"}
            >
              {isFullscreen ? (
                <>
                  <Minimize2 size={14} className="text-blue-600 dark:text-blue-400" />
                  <span className="hidden sm:inline">Sair Tela Cheia</span>
                </>
              ) : (
                <>
                  <Maximize2 size={14} className="text-slate-600 dark:text-slate-400" />
                  <span className="hidden sm:inline">Tela Inteira</span>
                </>
              )}
            </button>

            <span className="hidden sm:inline-block px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800 capitalize">
              {role}
            </span>
          </div>
        </header>
        
        {/* Área de conteúdo EXPANDIDA com padding inferior para o rodapé fixo */}
        <div className="p-4 sm:p-6 lg:p-8 w-full flex-1 pb-16">
          {children}
        </div>

        {/* Rodapé Fixo e Discreto */}
        <footer className="h-9 bg-white/95 dark:bg-[#0B1120]/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800 fixed bottom-0 left-0 right-0 md:left-64 lg:left-72 z-20 flex items-center justify-between px-4 sm:px-6 text-[11px] text-slate-500 dark:text-slate-400 shadow-xs transition-colors duration-200">
          <div className="flex items-center gap-1.5 truncate">
            <span>Desenvolvido por <strong className="text-slate-700 dark:text-slate-200 font-semibold">Paratech Soluções e Sistemas</strong> -</span>
            <a 
              href="https://paratechsolucoes.com.br" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 hover:underline font-medium transition-colors"
            >
              www.paratechsolucoes.com.br
            </a>
          </div>
          <div className="flex items-center gap-1.5 text-right pl-3 truncate">
            <span className="hidden sm:inline text-slate-400">Analista programador Responsável:</span>
            <span className="sm:hidden text-slate-400">Resp:</span>
            <strong className="text-slate-700 dark:text-slate-200 font-semibold">Regis Alexandre</strong>
            <span className="text-slate-300 dark:text-slate-600">•</span>
            <a 
              href="https://wa.me/5537920007857?text=Ol%C3%A1%20Regis,%20contato%20atrav%C3%A9s%20do%20HubParatech" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 font-bold hover:underline transition-colors"
            >
              <span>37 92000 - 78 57</span>
            </a>
          </div>
        </footer>
      </main>
      </div>
    </div>
  )
}
