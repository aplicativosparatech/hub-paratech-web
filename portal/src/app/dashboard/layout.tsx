'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { 
  LayoutDashboard, Users, Building2, Settings, FileText, 
  LogOut, BarChart3, Receipt, FileDown, PlugZap, UserCircle,
  Menu, X, Sliders, ShieldCheck, Sparkles, Database,
  Maximize2, Minimize2, Sun, Moon, Palette, ScanText, GraduationCap, Inbox,
  PanelLeftClose, PanelLeftOpen, Bell, ChevronDown, ChevronRight, Store,
  MonitorCheck, Zap, UtensilsCrossed, Scale, Lock, Unlock, Rocket
} from 'lucide-react'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import toast from 'react-hot-toast'
import { PermissoesMap } from '@/utils/permissoes'
import { APP_VERSION } from '@/utils/version'
import TabHeaderBanner from '@/components/TabHeaderBanner'
import SefazStatusBadge from '@/components/SefazStatusBadge'
import { GlobalClientProvider, useGlobalClient } from '@/components/GlobalClientContext'
import GlobalClientSelector from '@/components/GlobalClientSelector'
import InterfaceModeToggle from '@/components/InterfaceModeToggle'
import GlobalCompanyActiveCard from '@/components/GlobalCompanyActiveCard'
import BotechFloatingWidget from '@/components/BotechFloatingWidget'

type Role = 'admin' | 'cliente' | 'contabilidade'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <GlobalClientProvider>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </GlobalClientProvider>
  )
}

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const { interfaceMode, userRole: globalRole } = useGlobalClient()

  const [role, setRole] = useState<Role | null>(null)
  const [permissoesMap, setPermissoesMap] = useState<PermissoesMap>({})
  const [loading, setLoading] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [cleanActiveDropdown, setCleanActiveDropdown] = useState<string | null>(null)
  const cleanNavRef = useRef<HTMLDivElement>(null)

  // Fecha qualquer submenu dropdown do modo Clean ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (cleanNavRef.current && !cleanNavRef.current.contains(e.target as Node)) {
        setCleanActiveDropdown(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Carregar preferência salva do menu lateral recolhido
  useEffect(() => {
    const saved = localStorage.getItem('hub_sidebar_collapsed') === 'true'
    setIsCollapsed(saved)
  }, [])

  const toggleSidebar = () => {
    setIsCollapsed(prev => {
      const next = !prev
      localStorage.setItem('hub_sidebar_collapsed', String(next))
      return next
    })
  }

  // Controle de Sanfona (Accordion) e Cadeado no Menu Lateral Clássico
  const [isMenuLocked, setIsMenuLocked] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('hub_menu_locked') === 'true'
  })

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') {
      return { gestao: true, sistema: true, extras: true, paratech_sistemas: true, tecnica: false, ajuda: false }
    }
    const saved = localStorage.getItem('hub_sidebar_sections_state')
    if (saved) {
      try { return JSON.parse(saved) } catch (_) {}
    }
    return { gestao: true, sistema: true, extras: true, paratech_sistemas: true, tecnica: false, ajuda: false }
  })

  const toggleMenuLock = () => {
    setIsMenuLocked(prev => {
      const next = !prev
      localStorage.setItem('hub_menu_locked', String(next))
      if (next) {
        toast('Menus bloqueados abertos! Todas as opções ficarão sempre visíveis.', { icon: '🔒' })
      } else {
        toast('Modo Sanfona ativado! Clique nos tópicos para recolher ou expandir.', { icon: '🔓' })
      }
      return next
    })
  }

  const isSectionOpen = (sectionId: string): boolean => {
    // Se o cadeado estiver ativado, todos os menus ficam travados abertos
    if (isMenuLocked) return true

    // Garante que o tópico da rota atual sempre fique visível
    if (sectionId === 'gestao' && (
      pathname.startsWith('/dashboard/contabilidades') ||
      pathname.startsWith('/dashboard/clientes') ||
      pathname.startsWith('/dashboard/faturas') ||
      pathname.startsWith('/dashboard/minhas-faturas') ||
      pathname.startsWith('/dashboard/meus-clientes')
    )) return true

    if (sectionId === 'sistema' && (
      pathname.startsWith('/dashboard/notas-fiscais') ||
      pathname.startsWith('/dashboard/distribuicao-dfe') ||
      pathname.startsWith('/dashboard/relatorios') ||
      pathname.startsWith('/dashboard/corretor-tributario')
    )) return true

    if (sectionId === 'extras' && (
      pathname.startsWith('/dashboard/saneador-arquivos') ||
      pathname.startsWith('/dashboard/sugestor-tributario')
    )) return true

    if (sectionId === 'paratech_sistemas' && (
      pathname.startsWith('/dashboard/versoes') ||
      pathname.startsWith('/dashboard/mei-simples') ||
      pathname.startsWith('/dashboard/tech-slim') ||
      pathname.startsWith('/dashboard/tech-pro') ||
      pathname.startsWith('/dashboard/gastro') ||
      pathname.startsWith('/dashboard/pes-ai')
    )) return true

    if (sectionId === 'tecnica' && (
      pathname.startsWith('/dashboard/permissoes') ||
      pathname.startsWith('/dashboard/aparencia') ||
      pathname.startsWith('/dashboard/configuracoes-portal') ||
      pathname.startsWith('/dashboard/configuracoes') ||
      pathname.startsWith('/dashboard/integracoes') ||
      pathname.startsWith('/dashboard/meu-perfil')
    )) return true

    if (sectionId === 'ajuda' && pathname.startsWith('/dashboard/tutorial')) return true

    return openSections[sectionId] !== false
  }

  const toggleSection = (sectionId: string) => {
    if (isMenuLocked) {
      toast('Os menus estão travados abertos. Destranque o cadeado no topo para usar a sanfona.', { icon: '🔒' })
      return
    }

    setOpenSections(prev => {
      const current = prev[sectionId] !== false
      const next = { ...prev, [sectionId]: !current }
      localStorage.setItem('hub_sidebar_sections_state', JSON.stringify(next))
      return next
    })
  }

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
      { prefixo: '/dashboard/versoes', modulo: '_admin_only', nome: 'Atualizações & Versões' },
      { prefixo: '/dashboard/mei-simples', modulo: '_admin_only', nome: 'MEI Simples' },
      { prefixo: '/dashboard/tech-slim', modulo: '_admin_only', nome: 'Tech Slim' },
      { prefixo: '/dashboard/tech-pro', modulo: '_admin_only', nome: 'Tech Pro' },
      { prefixo: '/dashboard/gastro', modulo: '_admin_only', nome: 'Gastro' },
      { prefixo: '/dashboard/pes-ai', modulo: '_admin_only', nome: 'Pes.Ai' },
      { prefixo: '/dashboard/notas-fiscais/saidas/correcao', modulo: 'notas_fiscais_correcao', nome: 'Correção de Notas Fiscais' },
      { prefixo: '/dashboard/notas-fiscais', modulo: 'notas_fiscais', nome: 'Notas Fiscais' },
      { prefixo: '/dashboard/distribuicao-dfe', modulo: 'distribuicao_dfe', nome: 'Distribuição de DF-e' },
      { prefixo: '/dashboard/configuracoes-portal', modulo: '_admin_only', nome: 'Configurações do Portal' },
      { prefixo: '/dashboard/configuracoes', modulo: 'configuracoes_hub', nome: 'Configurações Hub' },
      { prefixo: '/dashboard/integracoes', modulo: 'integracoes', nome: 'Integrações (APIs)' },
      { prefixo: '/dashboard/corretor-tributario', modulo: 'corretor_tributario', nome: 'Analisador Tributário' },
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

  // Fecha os menus mobile e dropdowns ao navegar
  useEffect(() => {
    setMobileMenuOpen(false)
    setCleanActiveDropdown(null)
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

  const isClean = interfaceMode === 'clean'

  // Define se o card da empresa ativa deve ser exibido no cabeçalho
  // Conforme regra de negócio: apenas o Dashboard (Visão Geral) e o bloco SISTEMA possuem vínculo com a empresa escolhida
  const shouldShowCompanyCard = (currentPath: string): boolean => {
    if (currentPath === '/dashboard') return true
    if (currentPath.startsWith('/dashboard/notas-fiscais')) return true
    if (currentPath.startsWith('/dashboard/distribuicao-dfe')) return true
    if (currentPath.startsWith('/dashboard/relatorios')) return true
    if (currentPath.startsWith('/dashboard/corretor-tributario')) return true
    return false
  }

  // Componente de Link Customizado para o Menu Lateral Clássico
  const NavItem = ({ href, icon: Icon, label }: { href: string, icon: any, label: string }) => {
    const isActive = pathname === href || pathname.startsWith(href + '/')
    return (
      <Link 
        href={href} 
        title={isCollapsed ? label : undefined}
        className={`flex items-center ${isCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-4 py-2.5'} rounded-xl transition-all duration-200 group relative ${
          isActive 
            ? 'bg-blue-600/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400 font-semibold shadow-2xs' 
            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-slate-100'
        }`}
      >
        <Icon size={20} className={`${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500 group-hover:text-blue-500'} shrink-0 transition-colors`} />
        {!isCollapsed && <span className="truncate text-sm">{label}</span>}
        {isCollapsed && (
          <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-slate-900 dark:bg-slate-800 text-white text-xs font-semibold rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap shadow-xl border border-slate-700">
            {label}
          </div>
        )}
      </Link>
    )
  }

  // Componente de Cabeçalho de Categoria / Seção com Sanfona e Cadeado
  const MenuSectionHeader = ({ 
    id, 
    label, 
    itemCount 
  }: { 
    id: string
    label: string
    itemCount?: number 
  }) => {
    if (isCollapsed) {
      return <div className="my-2 border-t border-slate-200 dark:border-slate-800/80" />
    }

    const isOpen = isSectionOpen(id)

    return (
      <button
        type="button"
        onClick={() => toggleSection(id)}
        className="w-full flex items-center justify-between px-3 py-1.5 mt-3 mb-1 text-[11px] font-black text-black dark:text-white uppercase tracking-wider rounded-lg hover:bg-slate-100/80 dark:hover:bg-slate-800/60 transition-all cursor-pointer group select-none text-left"
        title={isMenuLocked ? `${label} (Fixado Aberto pelo Cadeado)` : isOpen ? `Clique para recolher ${label}` : `Clique para expandir ${label}`}
      >
        <div className="flex items-center gap-1.5 truncate">
          <span className="truncate text-black dark:text-white">{label}</span>
          {!isOpen && itemCount !== undefined && (
            <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded-full bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              {itemCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isMenuLocked ? (
            <Lock size={11} className="text-black/70 dark:text-white/70" />
          ) : (
            <ChevronDown 
              size={13} 
              className={`transition-transform duration-200 ${isOpen ? 'rotate-0 text-black dark:text-white' : '-rotate-90 text-slate-500 dark:text-slate-400'}`} 
            />
          )}
        </div>
      </button>
    )
  }

  const SidebarContent = () => (
    <>
      <div className={`p-4 ${isCollapsed ? 'p-3 text-center' : 'lg:p-5'} pb-3 border-b border-slate-100 dark:border-slate-800/80 flex items-start justify-between`}>
        <div className="flex flex-col items-start w-full gap-2">
          {/* Logo Paratech Oficial */}
          <Link href="/dashboard" className="block w-full transition-transform hover:scale-[1.01]" title="HubParatech">
            {isCollapsed ? (
              <div className="w-10 h-10 mx-auto flex items-center justify-center transition-transform hover:scale-105">
                <img 
                  src="/logo-paratech-icone.png" 
                  alt="HubParatech" 
                  className="w-10 h-10 object-contain drop-shadow-xs"
                />
              </div>
            ) : (
              <img 
                src="/logo-paratech.webp" 
                alt="Paratech Soluções & Sistemas" 
                className="w-full h-auto object-contain block drop-shadow-xs"
              />
            )}
          </Link>
          {!isCollapsed && (
            <>
              <div className="w-full flex items-center justify-between">
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                  Hub<span className="text-blue-600">Paratech</span>
                </h2>
                <span className="text-[11px] font-bold uppercase tracking-wider bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2.5 py-0.5 rounded-xl border border-blue-200 dark:border-blue-800">
                  {APP_VERSION}
                </span>
              </div>

              {/* Status do Servidor SEFAZ em tempo real */}
              <div className="w-full mt-1">
                <SefazStatusBadge />
              </div>
            </>
          )}
        </div>
        {/* Botão fechar para mobile */}
        <button 
          onClick={() => setMobileMenuOpen(false)} 
          className="md:hidden p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg -mt-1 -mr-2"
        >
          <X size={20} />
        </button>
      </div>
      
      <nav className={`flex-1 ${isCollapsed ? 'px-2' : 'px-3 lg:px-4'} space-y-1 mt-2 overflow-y-auto custom-scrollbar`}>
        {/* TÓPICO 1: VISÃO GERAL COM CADEADO DE TRAVA / MODO SANFONA */}
        {!isCollapsed ? (
          <div className="flex items-center justify-between px-3 mt-2 mb-1.5">
            <span className="text-[11px] font-black text-black dark:text-white uppercase tracking-wider">Visão Geral</span>
            <button
              type="button"
              onClick={toggleMenuLock}
              title={isMenuLocked 
                ? "Cadeado Trancado: Todos os submenus estão travados abertos. Clique para ativar a Sanfona." 
                : "Cadeado Aberto: Modo Sanfona ativo. Clique para travar todos os submenus abertos."}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold transition-all cursor-pointer shadow-2xs ${
                isMenuLocked
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 border border-blue-200/90 dark:border-blue-800 hover:bg-blue-100'
                  : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100'
              }`}
            >
              {isMenuLocked ? (
                <>
                  <Lock size={10} className="text-blue-600 dark:text-blue-400" />
                  <span>Fixado Aberto</span>
                </>
              ) : (
                <>
                  <Unlock size={10} className="text-amber-600 dark:text-amber-400" />
                  <span>Sanfona</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="my-2 border-t border-slate-200 dark:border-slate-800/80" />
        )}
        <NavItem href="/dashboard" icon={LayoutDashboard} label="Dashboard" />

        {/* ===== MENUS DO ADMIN ===== */}
        {role === 'admin' && (
          <>
            {/* TÓPICO 2: GESTÃO */}
            <MenuSectionHeader id="gestao" label="Gestão" itemCount={3} />
            {(isCollapsed || isSectionOpen('gestao')) && (
              <div className="space-y-1 animate-in fade-in duration-150">
                <NavItem href="/dashboard/contabilidades" icon={Building2} label="Contabilidades" />
                <NavItem href="/dashboard/clientes" icon={Users} label="Clientes" />
                <NavItem href="/dashboard/faturas" icon={Receipt} label="Faturas" />
              </div>
            )}

            {/* TÓPICO 3: SISTEMA */}
            <MenuSectionHeader id="sistema" label="Sistema" itemCount={4} />
            {(isCollapsed || isSectionOpen('sistema')) && (
              <div className="space-y-1 animate-in fade-in duration-150">
                <NavItem href="/dashboard/notas-fiscais" icon={FileDown} label="Notas Fiscais" />
                <NavItem href="/dashboard/distribuicao-dfe" icon={Inbox} label="Distribuição de DF-e" />
                <NavItem href="/dashboard/relatorios" icon={BarChart3} label="Relatórios" />
                <NavItem href="/dashboard/corretor-tributario" icon={Sparkles} label="Analisador Tributário" />
              </div>
            )}

            {/* TÓPICO 4: EXTRAS */}
            <MenuSectionHeader id="extras" label="Extras" itemCount={2} />
            {(isCollapsed || isSectionOpen('extras')) && (
              <div className="space-y-1 animate-in fade-in duration-150">
                <NavItem href="/dashboard/saneador-arquivos" icon={Database} label="Saneador de Arquivos" />
                <NavItem href="/dashboard/sugestor-tributario" icon={ScanText} label="Sugestor Tributário" />
              </div>
            )}

            {/* TÓPICO 5: PARATECH SISTEMAS */}
            <MenuSectionHeader id="paratech_sistemas" label="Paratech Sistemas" itemCount={6} />
            {(isCollapsed || isSectionOpen('paratech_sistemas')) && (
              <div className="space-y-1 animate-in fade-in duration-150">
                <NavItem href="/dashboard/versoes" icon={Rocket} label="Atualizações & Versões" />
                <NavItem href="/dashboard/mei-simples" icon={Store} label="MEI Simples" />
                <NavItem href="/dashboard/tech-slim" icon={MonitorCheck} label="Tech Slim" />
                <NavItem href="/dashboard/tech-pro" icon={Zap} label="Tech Pro" />
                <NavItem href="/dashboard/gastro" icon={UtensilsCrossed} label="Gastro" />
                <NavItem href="/dashboard/pes-ai" icon={Scale} label="Pes.Ai" />
              </div>
            )}

            {/* TÓPICO 6: ÁREA TÉCNICA */}
            <MenuSectionHeader id="tecnica" label="Área Técnica" itemCount={5} />
            {(isCollapsed || isSectionOpen('tecnica')) && (
              <div className="space-y-1 animate-in fade-in duration-150">
                <NavItem href="/dashboard/permissoes" icon={ShieldCheck} label="Permissões" />
                <NavItem href="/dashboard/aparencia" icon={Palette} label="Aparência" />
                <NavItem href="/dashboard/configuracoes-portal" icon={Sliders} label="Configurações do Portal" />
                <NavItem href="/dashboard/configuracoes" icon={Settings} label="Configurações Hub" />
                <NavItem href="/dashboard/integracoes" icon={PlugZap} label="Integrações & APIs" />
              </div>
            )}

            {/* TÓPICO 7: AJUDA */}
            <MenuSectionHeader id="ajuda" label="Ajuda" itemCount={1} />
            {(isCollapsed || isSectionOpen('ajuda')) && (
              <div className="space-y-1 animate-in fade-in duration-150">
                <NavItem href="/dashboard/tutorial" icon={GraduationCap} label="Tutorial & Tour IA" />
              </div>
            )}
          </>
        )}

        {/* ===== MENUS DO CLIENTE ===== */}
        {role === 'cliente' && (
          <>
            {/* TÓPICO 2: GESTÃO */}
            {canAccess('faturas') && (
              <>
                <MenuSectionHeader id="gestao" label="Gestão" itemCount={1} />
                {(isCollapsed || isSectionOpen('gestao')) && (
                  <div className="space-y-1 animate-in fade-in duration-150">
                    <NavItem href="/dashboard/minhas-faturas" icon={Receipt} label="Minhas Faturas" />
                  </div>
                )}
              </>
            )}

            {/* TÓPICO 3: SISTEMA */}
            {(canAccess('notas_fiscais') || canAccess('distribuicao_dfe') || canAccess('relatorios') || canAccess('corretor_tributario')) && (
              <>
                <MenuSectionHeader id="sistema" label="Sistema" />
                {(isCollapsed || isSectionOpen('sistema')) && (
                  <div className="space-y-1 animate-in fade-in duration-150">
                    {canAccess('notas_fiscais') && <NavItem href="/dashboard/notas-fiscais" icon={FileDown} label="Minhas Notas Fiscais" />}
                    {canAccess('distribuicao_dfe') && <NavItem href="/dashboard/distribuicao-dfe" icon={Inbox} label="Distribuição de DF-e" />}
                    {(canAccess('relatorios') || canAccess('relatorios_resumo') || canAccess('relatorios_monofasicos') || canAccess('relatorios_auditoria')) && (
                      <NavItem href="/dashboard/relatorios" icon={BarChart3} label="Relatórios" />
                    )}
                    {canAccess('corretor_tributario') && <NavItem href="/dashboard/corretor-tributario" icon={Sparkles} label="Analisador Tributário" />}
                  </div>
                )}
              </>
            )}

            {/* TÓPICO 4: EXTRAS */}
            {(canAccess('saneador_arquivos') || canAccess('sugestor_tributario')) && (
              <>
                <MenuSectionHeader id="extras" label="Extras" />
                {(isCollapsed || isSectionOpen('extras')) && (
                  <div className="space-y-1 animate-in fade-in duration-150">
                    {canAccess('saneador_arquivos') && <NavItem href="/dashboard/saneador-arquivos" icon={Database} label="Saneador de Arquivos" />}
                    {canAccess('sugestor_tributario') && <NavItem href="/dashboard/sugestor-tributario" icon={ScanText} label="Sugestor Tributário" />}
                  </div>
                )}
              </>
            )}

            {/* TÓPICO 5: ÁREA TÉCNICA */}
            {(canAccess('aparencia') || canAccess('configuracoes_hub') || canAccess('integracoes') || canAccess('meu_perfil')) && (
              <>
                <MenuSectionHeader id="tecnica" label="Área Técnica" />
                {(isCollapsed || isSectionOpen('tecnica')) && (
                  <div className="space-y-1 animate-in fade-in duration-150">
                    {canAccess('aparencia') && <NavItem href="/dashboard/aparencia" icon={Palette} label="Aparência" />}
                    {canAccess('configuracoes_hub') && <NavItem href="/dashboard/configuracoes" icon={Settings} label="Configurações Hub" />}
                    {canAccess('integracoes') && <NavItem href="/dashboard/integracoes" icon={PlugZap} label="Integrações (APIs)" />}
                    {canAccess('meu_perfil') && <NavItem href="/dashboard/meu-perfil" icon={UserCircle} label="Meu Perfil" />}
                  </div>
                )}
              </>
            )}

            {/* TÓPICO 6: AJUDA */}
            <MenuSectionHeader id="ajuda" label="Ajuda" itemCount={1} />
            {(isCollapsed || isSectionOpen('ajuda')) && (
              <div className="space-y-1 animate-in fade-in duration-150">
                <NavItem href="/dashboard/tutorial" icon={GraduationCap} label="Tutorial & Tour IA" />
              </div>
            )}
          </>
        )}

        {/* ===== MENUS DA CONTABILIDADE ===== */}
        {role === 'contabilidade' && (
          <>
            {/* TÓPICO 2: GESTÃO */}
            {canAccess('contabilidade_meus_clientes') && (
              <>
                <MenuSectionHeader id="gestao" label="Gestão" itemCount={1} />
                {(isCollapsed || isSectionOpen('gestao')) && (
                  <div className="space-y-1 animate-in fade-in duration-150">
                    <NavItem href="/dashboard/meus-clientes" icon={Users} label="Meus Clientes" />
                  </div>
                )}
              </>
            )}

            {/* TÓPICO 3: SISTEMA */}
            {(canAccess('notas_fiscais') || canAccess('distribuicao_dfe') || canAccess('relatorios') || canAccess('corretor_tributario')) && (
              <>
                <MenuSectionHeader id="sistema" label="Sistema" />
                {(isCollapsed || isSectionOpen('sistema')) && (
                  <div className="space-y-1 animate-in fade-in duration-150">
                    {canAccess('notas_fiscais') && <NavItem href="/dashboard/notas-fiscais" icon={FileDown} label="Notas Fiscais (XMLs)" />}
                    {canAccess('distribuicao_dfe') && <NavItem href="/dashboard/distribuicao-dfe" icon={Inbox} label="Distribuição de DF-e" />}
                    {(canAccess('relatorios') || canAccess('relatorios_resumo') || canAccess('relatorios_monofasicos') || canAccess('relatorios_auditoria')) && (
                      <NavItem href="/dashboard/relatorios" icon={BarChart3} label="Relatórios" />
                    )}
                    {canAccess('corretor_tributario') && <NavItem href="/dashboard/corretor-tributario" icon={Sparkles} label="Analisador Tributário" />}
                  </div>
                )}
              </>
            )}

            {/* TÓPICO 4: EXTRAS */}
            {(canAccess('saneador_arquivos') || canAccess('sugestor_tributario')) && (
              <>
                <MenuSectionHeader id="extras" label="Extras" />
                {(isCollapsed || isSectionOpen('extras')) && (
                  <div className="space-y-1 animate-in fade-in duration-150">
                    {canAccess('saneador_arquivos') && <NavItem href="/dashboard/saneador-arquivos" icon={Database} label="Saneador de Arquivos" />}
                    {canAccess('sugestor_tributario') && <NavItem href="/dashboard/sugestor-tributario" icon={ScanText} label="Sugestor Tributário" />}
                  </div>
                )}
              </>
            )}

            {/* TÓPICO 5: ÁREA TÉCNICA */}
            {(canAccess('aparencia') || canAccess('configuracoes_hub') || canAccess('integracoes') || canAccess('meu_perfil')) && (
              <>
                <MenuSectionHeader id="tecnica" label="Área Técnica" />
                {(isCollapsed || isSectionOpen('tecnica')) && (
                  <div className="space-y-1 animate-in fade-in duration-150">
                    {canAccess('aparencia') && <NavItem href="/dashboard/aparencia" icon={Palette} label="Aparência" />}
                    {canAccess('configuracoes_hub') && <NavItem href="/dashboard/configuracoes" icon={Settings} label="Configurações Hub" />}
                    {canAccess('integracoes') && <NavItem href="/dashboard/integracoes" icon={PlugZap} label="Integrações & APIs" />}
                    {canAccess('meu_perfil') && <NavItem href="/dashboard/meu-perfil" icon={Building2} label="Perfil do Escritório" />}
                  </div>
                )}
              </>
            )}

            {/* TÓPICO 6: AJUDA */}
            <MenuSectionHeader id="ajuda" label="Ajuda" itemCount={1} />
            {(isCollapsed || isSectionOpen('ajuda')) && (
              <div className="space-y-1 animate-in fade-in duration-150">
                <NavItem href="/dashboard/tutorial" icon={GraduationCap} label="Tutorial & Tour IA" />
              </div>
            )}
          </>
        )}
      </nav>

      {/* Seletor Visual de Modo de Interface no Menu Lateral */}
      <div className={`px-3 ${isCollapsed ? 'px-2' : 'lg:px-4'} pb-1`}>
        <InterfaceModeToggle variant="sidebar" isCollapsed={isCollapsed} />
      </div>

      {/* User Card Inferior e Botão Toggle (Recolher Menu) */}
      <div className={`p-3 ${isCollapsed ? 'p-2' : 'lg:p-4'} border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 mt-auto`}>
        {!isCollapsed ? (
          <div className="flex items-center gap-3 px-3 py-2 mb-2.5 bg-white dark:bg-slate-800/80 rounded-xl shadow-2xs border border-slate-200 dark:border-slate-700">
            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300 flex items-center justify-center font-bold text-sm uppercase shrink-0">
              {role?.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate capitalize">{role}</p>
              <p className="text-[11px] text-slate-400 truncate">Sessão Ativa</p>
            </div>
          </div>
        ) : (
          <div className="flex justify-center mb-2" title={`Sessão Ativa: ${role}`}>
            <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300 flex items-center justify-center font-bold text-xs uppercase shadow-2xs">
              {role?.charAt(0)}
            </div>
          </div>
        )}

        {/* Botão Toggle para Recolher / Expandir Menu Lateral */}
        <button 
          type="button"
          onClick={toggleSidebar}
          title={isCollapsed ? 'Expandir Menu' : 'Recolher Menu'}
          className={`flex items-center ${isCollapsed ? 'justify-center px-1' : 'justify-between px-3'} w-full py-2 mb-2 rounded-xl text-slate-600 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700 font-semibold transition-all duration-200 text-xs border border-slate-200/80 dark:border-slate-700/80 shadow-2xs cursor-pointer group`}
        >
          <div className="flex items-center gap-2">
            {isCollapsed ? (
              <PanelLeftOpen size={18} className="text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform" />
            ) : (
              <PanelLeftClose size={18} className="text-slate-500 dark:text-slate-400 group-hover:text-blue-600 transition-colors" />
            )}
            {!isCollapsed && <span>Recolher Menu</span>}
          </div>
          {!isCollapsed && (
            <span className="text-[9px] uppercase font-bold text-slate-400 bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
              Toggle
            </span>
          )}
        </button>

        {/* Botão Encerrar Sessão (Sair) */}
        <button 
          onClick={handleLogout} 
          title="Encerrar Sessão (Sair)"
          className={`flex items-center ${isCollapsed ? 'justify-center px-1' : 'justify-center gap-2'} w-full px-3 py-2 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-700 font-medium transition-colors border border-transparent hover:border-red-100 dark:hover:border-red-900/40 text-xs cursor-pointer`}
        >
          <LogOut size={16} />
          {!isCollapsed && <span>Encerrar Sessão</span>}
        </button>

        {!isCollapsed && (
          <div className="mt-2.5 pt-2 border-t border-slate-200/70 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-400 px-1">
            <span>Portal & Hub</span>
            <span className="font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px]">{APP_VERSION}</span>
          </div>
        )}
      </div>
    </>
  )

  // =========================================================================
  // MODO CLEAN: LAYOUT MINIMALISTA, SEM SIDEBAR FIXA, COM ABAS HORIZONTAIS
  // ESTRITAMENTE CONFORME O MOCKUP 1 (media_1792253996470_339c80fd.png)
  // =========================================================================
  if (isClean) {
    // Definição dos Tópicos Oficiais e Submenus do Modo Clean
    interface CleanSubmenuItem {
      href: string
      label: string
      desc: string
      icon: any
      iconColor: string
      iconBg: string
    }

    interface CleanTopic {
      id: string
      label: string
      href?: string
      isActive: boolean
      items?: CleanSubmenuItem[]
    }

    const cleanTopics: CleanTopic[] = [
      {
        id: 'visao_geral',
        label: 'Visão Geral',
        href: '/dashboard',
        isActive: pathname === '/dashboard'
      },
      {
        id: 'gestao',
        label: 'Gestão',
        isActive: pathname.startsWith('/dashboard/contabilidades') ||
                  pathname.startsWith('/dashboard/clientes') ||
                  pathname.startsWith('/dashboard/faturas') ||
                  pathname.startsWith('/dashboard/minhas-faturas') ||
                  pathname.startsWith('/dashboard/meus-clientes'),
        items: [
          ...(role === 'admin' ? [
            {
              href: '/dashboard/contabilidades',
              label: 'Contabilidades',
              desc: 'Gestão de escritórios contábeis parceiros',
              icon: Building2,
              iconColor: 'text-blue-600 dark:text-blue-400',
              iconBg: 'bg-blue-50 dark:bg-blue-950/60'
            },
            {
              href: '/dashboard/clientes',
              label: 'Clientes',
              desc: 'Empresas cadastradas e certificados digitais',
              icon: Users,
              iconColor: 'text-emerald-600 dark:text-emerald-400',
              iconBg: 'bg-emerald-50 dark:bg-emerald-950/60'
            },
            {
              href: '/dashboard/faturas',
              label: 'Faturas',
              desc: 'Controle de mensalidades e cobranças',
              icon: Receipt,
              iconColor: 'text-amber-600 dark:text-amber-400',
              iconBg: 'bg-amber-50 dark:bg-amber-950/60'
            }
          ] : []),
          ...(role === 'contabilidade' && canAccess('contabilidade_meus_clientes') ? [
            {
              href: '/dashboard/meus-clientes',
              label: 'Meus Clientes',
              desc: 'Carteira de empresas atendidas pelo escritório',
              icon: Users,
              iconColor: 'text-emerald-600 dark:text-emerald-400',
              iconBg: 'bg-emerald-50 dark:bg-emerald-950/60'
            }
          ] : []),
          ...(role === 'cliente' && canAccess('faturas') ? [
            {
              href: '/dashboard/minhas-faturas',
              label: 'Minhas Faturas',
              desc: 'Histórico de faturas e pagamentos PIX',
              icon: Receipt,
              iconColor: 'text-amber-600 dark:text-amber-400',
              iconBg: 'bg-amber-50 dark:bg-amber-950/60'
            }
          ] : [])
        ]
      },
      {
        id: 'sistema',
        label: 'Sistema',
        isActive: pathname.startsWith('/dashboard/notas-fiscais') ||
                  pathname.startsWith('/dashboard/distribuicao-dfe') ||
                  pathname.startsWith('/dashboard/relatorios') ||
                  pathname.startsWith('/dashboard/corretor-tributario'),
        items: [
          ...(canAccess('notas_fiscais') ? [{
            href: '/dashboard/notas-fiscais',
            label: 'Notas Fiscais',
            desc: 'Repositório de XMLs emitidos e recebidos',
            icon: FileDown,
            iconColor: 'text-blue-600 dark:text-blue-400',
            iconBg: 'bg-blue-50 dark:bg-blue-950/60'
          }] : []),
          ...(canAccess('distribuicao_dfe') ? [{
            href: '/dashboard/distribuicao-dfe',
            label: 'Distribuição de DF-e',
            desc: 'Consulta oficial SEFAZ Nacional de DF-e',
            icon: Inbox,
            iconColor: 'text-indigo-600 dark:text-indigo-400',
            iconBg: 'bg-indigo-50 dark:bg-indigo-950/60'
          }] : []),
          ...(canAccess('relatorios') || canAccess('relatorios_resumo') || canAccess('relatorios_monofasicos') || canAccess('relatorios_auditoria') ? [{
            href: '/dashboard/relatorios',
            label: 'Relatórios',
            desc: 'Auditoria fiscal, faturamento e monofásicos',
            icon: BarChart3,
            iconColor: 'text-emerald-600 dark:text-emerald-400',
            iconBg: 'bg-emerald-50 dark:bg-emerald-950/60'
          }] : []),
          ...(canAccess('corretor_tributario') ? [{
            href: '/dashboard/corretor-tributario',
            label: 'Analisador Tributário',
            desc: 'Auditoria de NCM, CEST e Reforma Tributária',
            icon: Sparkles,
            iconColor: 'text-purple-600 dark:text-purple-400',
            iconBg: 'bg-purple-50 dark:bg-purple-950/60'
          }] : [])
        ]
      },
      {
        id: 'extras',
        label: 'Extras',
        isActive: pathname.startsWith('/dashboard/saneador-arquivos') ||
                  pathname.startsWith('/dashboard/sugestor-tributario'),
        items: [
          ...(canAccess('saneador_arquivos') ? [{
            href: '/dashboard/saneador-arquivos',
            label: 'Saneador de Arquivos',
            desc: 'Higienização e correção estrutural de XMLs',
            icon: Database,
            iconColor: 'text-indigo-600 dark:text-indigo-400',
            iconBg: 'bg-indigo-50 dark:bg-indigo-950/60'
          }] : []),
          ...(canAccess('sugestor_tributario') ? [{
            href: '/dashboard/sugestor-tributario',
            label: 'Sugestor Tributário',
            desc: 'Sugestão automática de tributação por IA',
            icon: ScanText,
            iconColor: 'text-teal-600 dark:text-teal-400',
            iconBg: 'bg-teal-50 dark:bg-teal-950/60'
          }] : [])
        ]
      },
      {
        id: 'paratech_sistemas',
        label: 'Paratech Sistemas',
        isActive: pathname.startsWith('/dashboard/mei-simples') ||
                  pathname.startsWith('/dashboard/tech-slim') ||
                  pathname.startsWith('/dashboard/tech-pro') ||
                  pathname.startsWith('/dashboard/gastro') ||
                  pathname.startsWith('/dashboard/pes-ai') ||
                  pathname.startsWith('/dashboard/versoes'),
        items: [
          ...(role === 'admin' ? [
            {
              href: '/dashboard/versoes',
              label: 'Atualizações & Versões',
              desc: 'Central de versões e auto-update dos sistemas',
              icon: Rocket,
              iconColor: 'text-emerald-600 dark:text-emerald-400',
              iconBg: 'bg-emerald-50 dark:bg-emerald-950/60'
            },
            {
              href: '/dashboard/mei-simples',
              label: 'MEI Simples',
              desc: 'Assinaturas, licenças e bloqueios do MEI',
              icon: Store,
              iconColor: 'text-indigo-600 dark:text-indigo-400',
              iconBg: 'bg-indigo-50 dark:bg-indigo-950/60'
            },
            {
              href: '/dashboard/tech-slim',
              label: 'Tech Slim',
              desc: 'Frente de caixa e emissão fiscal NFC-e rápida',
              icon: MonitorCheck,
              iconColor: 'text-blue-600 dark:text-blue-400',
              iconBg: 'bg-blue-50 dark:bg-blue-950/60'
            },
            {
              href: '/dashboard/tech-pro',
              label: 'Tech Pro',
              desc: 'Gestão empresarial completa, estoque e NFe/CTe',
              icon: Zap,
              iconColor: 'text-amber-600 dark:text-amber-400',
              iconBg: 'bg-amber-50 dark:bg-amber-950/60'
            },
            {
              href: '/dashboard/gastro',
              label: 'Gastro',
              desc: 'Food service, comandas, mesas e delivery',
              icon: UtensilsCrossed,
              iconColor: 'text-orange-600 dark:text-orange-400',
              iconBg: 'bg-orange-50 dark:bg-orange-950/60'
            },
            {
              href: '/dashboard/pes-ai',
              label: 'Pes.Ai',
              desc: 'Automação inteligente de pesagem e visão por IA',
              icon: Scale,
              iconColor: 'text-purple-600 dark:text-purple-400',
              iconBg: 'bg-purple-50 dark:bg-purple-950/60'
            }
          ] : [])
        ]
      },
      {
        id: 'tecnica',
        label: 'Área Técnica',
        isActive: pathname.startsWith('/dashboard/permissoes') ||
                  pathname.startsWith('/dashboard/aparencia') ||
                  pathname.startsWith('/dashboard/configuracoes-portal') ||
                  pathname.startsWith('/dashboard/configuracoes') ||
                  pathname.startsWith('/dashboard/integracoes') ||
                  pathname.startsWith('/dashboard/meu-perfil'),
        items: [
          ...(role === 'admin' ? [
            {
              href: '/dashboard/permissoes',
              label: 'Permissões',
              desc: 'Controle de acessos e regras por perfil',
              icon: ShieldCheck,
              iconColor: 'text-emerald-600 dark:text-emerald-400',
              iconBg: 'bg-emerald-50 dark:bg-emerald-950/60'
            },
            {
              href: '/dashboard/aparencia',
              label: 'Aparência',
              desc: 'Modos de interface, cores e temas',
              icon: Palette,
              iconColor: 'text-purple-600 dark:text-purple-400',
              iconBg: 'bg-purple-50 dark:bg-purple-950/60'
            },
            {
              href: '/dashboard/configuracoes-portal',
              label: 'Configurações do Portal',
              desc: 'Regras globais e preferências do SaaS',
              icon: Sliders,
              iconColor: 'text-blue-600 dark:text-blue-400',
              iconBg: 'bg-blue-50 dark:bg-blue-950/60'
            },
            {
              href: '/dashboard/configuracoes',
              label: 'Configurações Hub',
              desc: 'Comunicação SEFAZ e agentes locais',
              icon: Settings,
              iconColor: 'text-slate-600 dark:text-slate-400',
              iconBg: 'bg-slate-100 dark:bg-slate-800'
            },
            {
              href: '/dashboard/integracoes',
              label: 'Integrações & APIs',
              desc: 'Webhooks, APIs e sincronizadores',
              icon: PlugZap,
              iconColor: 'text-amber-600 dark:text-amber-400',
              iconBg: 'bg-amber-50 dark:bg-amber-950/60'
            }
          ] : []),
          ...(role === 'contabilidade' ? [
            ...(canAccess('aparencia') ? [{
              href: '/dashboard/aparencia',
              label: 'Aparência',
              desc: 'Modos de interface e temas',
              icon: Palette,
              iconColor: 'text-purple-600 dark:text-purple-400',
              iconBg: 'bg-purple-50 dark:bg-purple-950/60'
            }] : []),
            ...(canAccess('configuracoes_hub') ? [{
              href: '/dashboard/configuracoes',
              label: 'Configurações Hub',
              desc: 'Comunicação SEFAZ e sincronização',
              icon: Settings,
              iconColor: 'text-slate-600 dark:text-slate-400',
              iconBg: 'bg-slate-100 dark:bg-slate-800'
            }] : []),
            ...(canAccess('integracoes') ? [{
              href: '/dashboard/integracoes',
              label: 'Integrações & APIs',
              desc: 'Webhooks e chaves de acesso',
              icon: PlugZap,
              iconColor: 'text-amber-600 dark:text-amber-400',
              iconBg: 'bg-amber-50 dark:bg-amber-950/60'
            }] : []),
            ...(canAccess('meu_perfil') ? [{
              href: '/dashboard/meu-perfil',
              label: 'Perfil do Escritório',
              desc: 'Dados cadastrais da contabilidade',
              icon: Building2,
              iconColor: 'text-blue-600 dark:text-blue-400',
              iconBg: 'bg-blue-50 dark:bg-blue-950/60'
            }] : [])
          ] : []),
          ...(role === 'cliente' ? [
            ...(canAccess('aparencia') ? [{
              href: '/dashboard/aparencia',
              label: 'Aparência',
              desc: 'Modos de interface e temas',
              icon: Palette,
              iconColor: 'text-purple-600 dark:text-purple-400',
              iconBg: 'bg-purple-50 dark:bg-purple-950/60'
            }] : []),
            ...(canAccess('configuracoes_hub') ? [{
              href: '/dashboard/configuracoes',
              label: 'Configurações Hub',
              desc: 'Comunicação SEFAZ e sincronização',
              icon: Settings,
              iconColor: 'text-slate-600 dark:text-slate-400',
              iconBg: 'bg-slate-100 dark:bg-slate-800'
            }] : []),
            ...(canAccess('integracoes') ? [{
              href: '/dashboard/integracoes',
              label: 'Integrações (APIs)',
              desc: 'Webhooks e integrações',
              icon: PlugZap,
              iconColor: 'text-amber-600 dark:text-amber-400',
              iconBg: 'bg-amber-50 dark:bg-amber-950/60'
            }] : []),
            ...(canAccess('meu_perfil') ? [{
              href: '/dashboard/meu-perfil',
              label: 'Meu Perfil',
              desc: 'Dados cadastrais da empresa',
              icon: UserCircle,
              iconColor: 'text-blue-600 dark:text-blue-400',
              iconBg: 'bg-blue-50 dark:bg-blue-950/60'
            }] : [])
          ] : [])
        ]
      },
      {
        id: 'ajuda',
        label: 'Ajuda',
        isActive: pathname.startsWith('/dashboard/tutorial'),
        items: [
          {
            href: '/dashboard/tutorial',
            label: 'Tutorial & Tour IA',
            desc: 'Aprenda a utilizar o Hub Paratech passo a passo',
            icon: GraduationCap,
            iconColor: 'text-indigo-600 dark:text-indigo-400',
            iconBg: 'bg-indigo-50 dark:bg-indigo-950/60'
          },
          {
            href: '#robotech',
            label: 'Robotech IA',
            desc: 'Assistente fiscal e operacional oficial Paratech',
            icon: Sparkles,
            iconColor: 'text-blue-600 dark:text-blue-400',
            iconBg: 'bg-blue-50 dark:bg-blue-950/60'
          }
        ]
      }
    ]

    return (
      <div className="min-h-screen flex flex-col bg-[#F8FAFC] dark:bg-[#06090F] font-sans transition-colors duration-200 text-slate-900 dark:text-slate-100">
        
        {/* CABEÇALHO FIXO UNIFICADO (STICKY TOP-0 Z-40) */}
        <header className="sticky top-0 z-40 bg-white dark:bg-[#0B1120] border-b border-slate-200/80 dark:border-slate-800 shadow-md transition-colors">
          
          {/* 1. Barra Superior com Logo (80% maior), Status SEFAZ à frente e Controles de Sistema */}
          <div className="min-h-[72px] sm:min-h-[80px] py-2 sm:py-3 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3 sm:gap-6 border-b border-slate-100 dark:border-slate-800/80">
            {/* Lado Esquerdo: Botão Mobile + Logo Oficial Paratech (80% maior) + Card SEFAZ à frente */}
            <div className="flex items-center gap-3 sm:gap-5 shrink-0">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                aria-label="Abrir Navegação Completa"
              >
                <Menu size={22} />
              </button>

              <Link href="/dashboard" className="flex items-center gap-2 group transition-transform hover:scale-[1.01]" title="Paratech Soluções & Sistemas">
                <img 
                  src="/logo-paratech-horizontal.png" 
                  alt="Paratech Soluções & Sistemas" 
                  className="h-14 sm:h-16 w-auto max-w-[340px] sm:max-w-[420px] object-contain block drop-shadow-sm"
                />
              </Link>

              {/* Card Informativo dos Servidores da SEFAZ à frente da logomarca */}
              <SefazStatusBadge variant="header" />
            </div>

            {/* Lado Direito: Notificações, Modo Toggle, Tema, Kiosk, Perfil */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <button
                type="button"
                title="Notificações do Hub"
                onClick={() => toast('Nenhuma notificação crítica pendente.', { icon: '🔔' })}
                className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/60 dark:border-slate-800 transition cursor-pointer shadow-2xs"
              >
                <Bell size={17} />
              </button>

              {/* Botão de Acesso Rápido ao Robotech IA no Modo Clean */}
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('open_robotech_chat'))}
                title="Abrir Robotech IA - Assistente Inteligente Oficial"
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all border shadow-2xs cursor-pointer bg-blue-50/90 hover:bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:hover:bg-blue-900/60 dark:text-blue-300 dark:border-blue-800/80"
              >
                <div className="w-4 h-4 rounded-full overflow-hidden bg-[#020b18] border border-blue-400 shrink-0">
                  <img src="/robotech.png" alt="Robotech" className="w-full h-full object-cover rounded-full" />
                </div>
                <span>Robotech IA</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </button>

              {/* Alternador de Modo de Interface (Modo Clean vs Modo Clássico) */}
              <InterfaceModeToggle />

              {/* Alternador de Tema Claro / Escuro */}
              <div className="hidden sm:flex items-center bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-xl border border-slate-200/80 dark:border-slate-700 text-xs">
                <button
                  type="button"
                  onClick={() => handleSetTheme('light')}
                  className={`p-1.5 rounded-lg transition cursor-pointer ${theme === 'light' ? 'bg-white text-amber-600 shadow-xs' : 'text-slate-400 hover:text-slate-700'}`}
                  title="Tema Claro"
                >
                  <Sun size={14} className={theme === 'light' ? 'fill-amber-400/30' : ''} />
                </button>
                <button
                  type="button"
                  onClick={() => handleSetTheme('dark')}
                  className={`p-1.5 rounded-lg transition cursor-pointer ${theme === 'dark' ? 'bg-slate-900 text-indigo-400 shadow-xs' : 'text-slate-400 hover:text-slate-200'}`}
                  title="Tema Escuro"
                >
                  <Moon size={14} className={theme === 'dark' ? 'fill-indigo-400/30' : ''} />
                </button>
              </div>

              {/* Botão Kiosk / Tela Cheia */}
              <button
                type="button"
                onClick={toggleFullscreen}
                className="hidden md:flex p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/60 dark:border-slate-800 transition cursor-pointer shadow-2xs"
                title={isFullscreen ? "Sair da Tela Cheia (F11)" : "Modo Tela Cheia (F11)"}
              >
                {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>

              {/* Avatar do Usuário */}
              <div className="flex items-center gap-2 pl-1">
                <div 
                  className="w-8 h-8 rounded-full bg-slate-900 dark:bg-blue-600 text-white font-bold text-xs flex items-center justify-center uppercase shadow-sm border border-slate-200 dark:border-slate-700 cursor-pointer"
                  title={`Perfil Conectado: ${role}`}
                >
                  {role?.charAt(0) || 'U'}
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  title="Encerrar Sessão"
                  className="hidden xl:flex text-slate-400 hover:text-red-500 p-1.5 rounded-lg transition"
                >
                  <LogOut size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* 2. Card Escuro com Dados Cadastrais da Empresa Selecionada e Botão Trocar Empresa Ctrl+K (Imagem 2) */}
          {shouldShowCompanyCard(pathname) && (
            <div className="px-4 sm:px-6 lg:px-8 py-2 bg-[#060B14] dark:bg-[#060B14] border-b border-slate-800/80">
              <GlobalCompanyActiveCard variant="header" />
            </div>
          )}

          {/* 3. Sub-Navbar com Menus e Submenus por Tópicos Oficiais no Modo Clean */}
          <div ref={cleanNavRef} className="bg-white dark:bg-[#0B1120] px-4 sm:px-6 lg:px-8 border-b border-slate-200/80 dark:border-slate-800 relative z-30">
            <div className="flex items-center justify-between">
              <nav className="flex items-center gap-1 sm:gap-3 md:gap-6 py-0.5">
                {cleanTopics.filter(t => (t.items && t.items.length > 0) || t.href).map(topic => {
                  if (topic.href) {
                    return (
                      <Link
                        key={topic.id}
                        href={topic.href}
                        onClick={() => setCleanActiveDropdown(null)}
                        className={`text-sm font-semibold transition-all py-3 px-2 sm:px-2.5 whitespace-nowrap relative ${
                          topic.isActive
                            ? 'text-slate-900 dark:text-white font-bold after:content-[""] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2.5px] after:bg-blue-600 dark:after:bg-blue-500 after:rounded-full'
                            : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                        }`}
                      >
                        {topic.label}
                      </Link>
                    )
                  }

                  const isOpen = cleanActiveDropdown === topic.id
                  return (
                    <div key={topic.id} className="relative">
                      <button
                        type="button"
                        onClick={() => setCleanActiveDropdown(prev => prev === topic.id ? null : topic.id)}
                        className={`flex items-center gap-1 sm:gap-1.5 text-sm font-semibold transition-all py-3 px-2 sm:px-2.5 whitespace-nowrap relative cursor-pointer ${
                          topic.isActive
                            ? 'text-blue-600 dark:text-blue-400 font-bold after:content-[""] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2.5px] after:bg-blue-600 dark:after:bg-blue-500 after:rounded-full'
                            : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                        }`}
                      >
                        <span>{topic.label}</span>
                        <ChevronDown 
                          size={14} 
                          className={`transition-transform duration-200 ${isOpen ? 'rotate-180 text-blue-600 dark:text-blue-400' : 'text-slate-400'}`} 
                        />
                      </button>

                      {/* Dropdown Suspenso com Submenu */}
                      {isOpen && (
                        <div className="absolute left-0 top-full mt-1.5 w-72 sm:w-80 bg-white dark:bg-[#0B1120] border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                          <div className="text-[10px] font-black uppercase tracking-wider text-black dark:text-white px-3 py-1.5 mb-1 border-b border-slate-100 dark:border-slate-800/80">
                            {topic.label}
                          </div>
                          <div className="space-y-1">
                            {topic.items?.map(item => {
                              const isItemActive = pathname === item.href || pathname.startsWith(item.href + '/')
                              const IconComponent = item.icon
                              return (
                                <Link
                                  key={item.href}
                                  href={item.href}
                                  onClick={(e) => {
                                    setCleanActiveDropdown(null)
                                    if (item.href === '#robotech') {
                                      e.preventDefault()
                                      window.dispatchEvent(new CustomEvent('open_robotech_chat'))
                                    }
                                  }}
                                  className={`flex items-start gap-3 p-2.5 rounded-xl transition group ${
                                    isItemActive
                                      ? 'bg-blue-50/80 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-semibold'
                                      : 'hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-300'
                                  }`}
                                >
                                  <div className={`p-2 rounded-xl shrink-0 ${item.iconBg} ${item.iconColor} group-hover:scale-105 transition-transform`}>
                                    <IconComponent size={18} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                      <p className="text-xs font-bold leading-tight truncate">
                                        {item.label}
                                      </p>
                                      {isItemActive && (
                                        <span className="text-[9px] font-extrabold bg-blue-600 text-white px-1.5 py-0.5 rounded-md uppercase">
                                          Ativo
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-snug line-clamp-1 mt-0.5">
                                      {item.desc}
                                    </p>
                                  </div>
                                </Link>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </nav>
            </div>
          </div>
        </header>

      {/* 3. CONTEÚDO PRINCIPAL (EXPANDIDO 100% DA LARGURA) */}
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6 pb-20">
        {children}
      </main>

        {/* 4. DRAWER MOBILE (Para o Modo Clean no Celular) */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div 
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity" 
              onClick={() => setMobileMenuOpen(false)} 
            />
            <div className="relative w-72 max-w-[85vw] bg-white dark:bg-[#0B1120] h-full flex flex-col shadow-2xl z-10">
              <SidebarContent />
            </div>
          </div>
        )}

        {/* 5. RODAPÉ FIXO DISCRETO */}
        <footer className="h-9 bg-white/95 dark:bg-[#0B1120]/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800 fixed bottom-0 left-0 right-0 z-20 flex items-center justify-between px-4 sm:px-6 text-[11px] text-slate-500 dark:text-slate-400 shadow-xs">
          <div className="flex items-center gap-1.5 truncate">
            <span>Desenvolvido por <strong className="text-slate-700 dark:text-slate-200 font-semibold">Paratech Soluções e Sistemas</strong> -</span>
            <a 
              href="https://paratechsolucoes.com.br" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
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
              className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold hover:underline"
            >
              <span>37 92000 - 78 57</span>
            </a>
          </div>
        </footer>

        {/* Assistente Virtual de IA Flutuante (Robotech) no Modo Clean */}
        <BotechFloatingWidget />

      </div>
    )
  }

  // =========================================================================
  // MODO CLÁSSICO: 100% PRESERVADO COM BANNERS ILUSTRADOS E MENU LATERAL FIXO
  // =========================================================================
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 font-sans transition-colors duration-200">
      
      {/* 0. Banner Ilustrado Panorâmico no Topo (100% de largura - Visível apenas no Modo Clássico) */}
      <TabHeaderBanner />

      <div className="flex-1 flex overflow-hidden relative">
        {/* 1. Sidebar Desktop (Fixa na esquerda, com suporte a recolher) */}
        <aside className={`hidden md:flex ${isCollapsed ? 'w-20' : 'w-64 lg:w-72'} bg-white dark:bg-[#0B1120] border-r border-slate-200 dark:border-slate-800 flex-col shadow-xs relative z-10 flex-shrink-0 transition-all duration-300 ease-in-out`}>
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
          {/* Topbar clássica, responsiva E FIXA */}
          <header className="bg-[#0B1120] border-b border-slate-800 sticky top-0 z-20 shadow-md flex-shrink-0 transition-colors duration-200">
            {/* Linha 1: Controles de navegação, modo, tema, tela cheia e perfil */}
            <div className="h-14 flex items-center justify-between px-3 sm:px-6 lg:px-8 border-b border-slate-800/80 gap-2 sm:gap-4">
              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                {/* Botão Hambúrguer Mobile */}
                <button 
                  onClick={() => setMobileMenuOpen(true)}
                  className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 focus:outline-none cursor-pointer"
                  aria-label="Abrir Menu"
                >
                  <Menu size={22} />
                </button>
                {/* Botão Toggle Desktop no Topo */}
                <button 
                  onClick={toggleSidebar}
                  className="hidden md:flex p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 focus:outline-none cursor-pointer transition-colors"
                  title={isCollapsed ? 'Expandir Menu Lateral' : 'Recolher Menu Lateral'}
                  aria-label="Alternar Menu Lateral"
                >
                  {isCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
                </button>
                <h1 className="text-sm sm:text-base font-bold text-white capitalize truncate max-w-[150px] sm:max-w-none">
                  {pathname.split('/').pop()?.replace('-', ' ') || 'Visão Geral'}
                </h1>
              </div>

              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                {/* Alternador de Modo de Interface (Modo Clean vs Modo Clássico) */}
                <InterfaceModeToggle />

                {/* Seletor com Opções de Tema Claro e Tema Escuro */}
                <div className="flex items-center bg-slate-900/80 p-0.5 rounded-xl border border-slate-700/80 text-xs shadow-xs">
                  <button
                    type="button"
                    onClick={() => handleSetTheme('light')}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                      theme === 'light'
                        ? 'bg-white text-amber-600 shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                    title="Ativar Tema Claro"
                  >
                    <Sun size={14} className={theme === 'light' ? 'text-amber-500 fill-amber-400/30' : ''} />
                    <span className="hidden sm:inline">Claro</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSetTheme('dark')}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                      theme === 'dark'
                        ? 'bg-slate-800 text-indigo-400 shadow-xs border border-slate-700/80'
                        : 'text-slate-400 hover:text-white'
                    }`}
                    title="Ativar Tema Escuro"
                  >
                    <Moon size={14} className={theme === 'dark' ? 'text-indigo-400 fill-indigo-400/30' : ''} />
                    <span className="hidden sm:inline">Escuro</span>
                  </button>
                </div>

                {/* Botão Modo Kiosk / Tela Inteira (F11) */}
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800/80 hover:bg-slate-700 text-slate-200 transition border border-slate-700 shadow-xs cursor-pointer"
                  title={isFullscreen ? "Sair da Tela Cheia (F11)" : "Modo Tela Inteira / Kiosk (F11)"}
                >
                  {isFullscreen ? (
                    <>
                      <Minimize2 size={14} className="text-blue-400" />
                      <span className="hidden sm:inline text-xs">Sair F11</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 size={14} className="text-slate-300" />
                      <span className="hidden sm:inline text-xs">F11</span>
                    </>
                  )}
                </button>

                <div className="flex items-center gap-2 pl-1">
                  <div 
                    className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center uppercase shadow-sm border border-blue-500 cursor-pointer"
                    title={`Perfil Conectado: ${role}`}
                  >
                    {role?.charAt(0) || 'U'}
                  </div>
                  <button
                    type="button"
                    onClick={handleLogout}
                    title="Encerrar Sessão"
                    className="hidden xl:flex text-slate-400 hover:text-red-400 p-1.5 rounded-lg transition"
                  >
                    <LogOut size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Linha 2: O Card Escuro com Dados Cadastrais da Empresa e Trocar Empresa Ctrl+K (Imagem 2) */}
            {shouldShowCompanyCard(pathname) && (
              <div className="px-3 sm:px-6 py-2 bg-[#060B14]">
                <GlobalCompanyActiveCard variant="header" />
              </div>
            )}
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

          {/* Assistente Virtual de IA Flutuante (Botech) */}
          <BotechFloatingWidget />
        </main>
      </div>
    </div>
  )
}
