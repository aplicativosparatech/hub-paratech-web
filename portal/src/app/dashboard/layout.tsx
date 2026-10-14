'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { 
  LayoutDashboard, Users, Building2, Settings, FileText, 
  LogOut, BarChart3, Receipt, FileDown, PlugZap, UserCircle,
  Menu, X, Sliders, ShieldCheck, Sparkles, Database,
  Maximize2, Minimize2
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import toast from 'react-hot-toast'
import { PermissoesMap } from '@/utils/permissoes'
import { APP_VERSION } from '@/utils/version'

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
  const [showSplash, setShowSplash] = useState(true)
  const [splashProgress, setSplashProgress] = useState(0)

  // 1. Splash Screen de 2 segundos com barra de progresso suave
  useEffect(() => {
    const startTime = Date.now()
    const duration = 2000

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(100, Math.round((elapsed / duration) * 100))
      setSplashProgress(progress)

      if (elapsed >= duration) {
        clearInterval(interval)
        setTimeout(() => {
          setShowSplash(false)
        }, 150)
      }
    }, 25)

    return () => clearInterval(interval)
  }, [])

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
      { prefixo: '/dashboard/configuracoes-portal', modulo: 'configuracoes_portal', nome: 'Configurações do Portal' },
      { prefixo: '/dashboard/configuracoes', modulo: 'configuracoes_hub', nome: 'Configurações Hub' },
      { prefixo: '/dashboard/integracoes', modulo: 'integracoes', nome: 'Integrações (APIs)' },
      { prefixo: '/dashboard/corretor-tributario', modulo: 'corretor_tributario', nome: 'Corretor Tributário' },
      { prefixo: '/dashboard/saneador-arquivos', modulo: 'saneador_arquivos', nome: 'Saneador de Arquivos' },
      { prefixo: '/dashboard/meus-clientes', modulo: 'contabilidade_meus_clientes', nome: 'Meus Clientes' },
      { prefixo: '/dashboard/meu-perfil', modulo: 'meu_perfil', nome: 'Meu Perfil' },
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

  if (showSplash || loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white relative overflow-hidden select-none">
        {/* Glow de fundo */}
        <div className="absolute w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col items-center max-w-sm w-full px-6 space-y-6 text-center animate-in fade-in duration-300">
          <img 
            src="/logo-paratech.webp" 
            alt="Paratech Soluções & Sistemas" 
            className="h-16 sm:h-20 w-auto object-contain drop-shadow-2xl animate-pulse"
          />
          
          <div className="space-y-1">
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Hub<span className="text-blue-500">Paratech</span>
            </h2>
            <p className="text-xs text-slate-400">
              Ecossistema Fiscal & Inteligência Tributária
            </p>
          </div>
          
          {/* Barra de Progresso Animada */}
          <div className="w-full bg-slate-900 rounded-full h-2.5 p-0.5 border border-slate-800 overflow-hidden shadow-inner">
            <div 
              className="bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-400 h-full rounded-full transition-all duration-75 ease-out shadow-sm"
              style={{ width: `${splashProgress}%` }}
            />
          </div>

          <div className="flex items-center justify-between w-full text-[11px] text-slate-400 font-mono">
            <span>Carregando ecossistema fiscal...</span>
            <span className="font-bold text-blue-400">{splashProgress}%</span>
          </div>
        </div>

        <div className="absolute bottom-6 text-[11px] text-slate-500 font-medium">
          Paratech Soluções & Sistemas • {APP_VERSION}
        </div>
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
            ? 'bg-blue-600/10 text-blue-600 font-semibold shadow-sm' 
            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
        }`}
      >
        <Icon size={20} className={isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-blue-500 transition-colors'} />
        <span>{label}</span>
      </Link>
    )
  }

  const SidebarContent = () => (
    <>
      <div className="p-5 lg:p-6 pb-4 border-b border-slate-100 flex items-start justify-between">
        <div className="flex flex-col items-start gap-2.5">
          {/* Logo Paratech Oficial (Imagem 01) Acima do Nome */}
          <Link href="/dashboard" className="block transition-transform hover:scale-[1.02]">
            <img 
              src="/logo-paratech.webp" 
              alt="Paratech Soluções & Sistemas" 
              className="h-10 sm:h-11 w-auto object-contain"
            />
          </Link>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black tracking-tight text-slate-800">
              Hub<span className="text-blue-600">Paratech</span>
            </h2>
            <span className="text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-md border border-blue-200">
              {APP_VERSION}
            </span>
          </div>
        </div>
        {/* Botão fechar para mobile */}
        <button 
          onClick={() => setMobileMenuOpen(false)} 
          className="md:hidden p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg -mt-1 -mr-2"
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
            
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-4 mt-6">Sistema</div>
            <NavItem href="/dashboard/relatorios" icon={BarChart3} label="Relatórios" />
            <NavItem href="/dashboard/corretor-tributario" icon={Sparkles} label="Corretor Tributário" />
            <NavItem href="/dashboard/saneador-arquivos" icon={Database} label="Saneador de Arquivos" />
            <NavItem href="/dashboard/integracoes" icon={PlugZap} label="Integrações (APIs)" />
            <NavItem href="/dashboard/permissoes" icon={ShieldCheck} label="Permissões" />
            <NavItem href="/dashboard/configuracoes-portal" icon={Sliders} label="Configurações do Portal" />
            <NavItem href="/dashboard/configuracoes" icon={Settings} label="Configurações Hub" />
          </>
        )}

        {/* ===== MENUS DO CLIENTE ===== */}
        {role === 'cliente' && (
          <>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-4 mt-6">Meu Espaço</div>
            {canAccess('faturas') && <NavItem href="/dashboard/minhas-faturas" icon={Receipt} label="Minhas Faturas" />}
            {canAccess('notas_fiscais') && <NavItem href="/dashboard/notas-fiscais" icon={FileDown} label="Minhas Notas Fiscais" />}
            {(canAccess('relatorios') || canAccess('relatorios_resumo') || canAccess('relatorios_monofasicos') || canAccess('relatorios_auditoria')) && (
              <NavItem href="/dashboard/relatorios" icon={BarChart3} label="Relatórios" />
            )}
            {canAccess('corretor_tributario') && <NavItem href="/dashboard/corretor-tributario" icon={Sparkles} label="Corretor Tributário" />}
            {canAccess('saneador_arquivos') && <NavItem href="/dashboard/saneador-arquivos" icon={Database} label="Saneador de Arquivos" />}
            {canAccess('configuracoes_portal') && <NavItem href="/dashboard/configuracoes-portal" icon={Sliders} label="Configurações do Portal" />}
            {canAccess('configuracoes_hub') && <NavItem href="/dashboard/configuracoes" icon={Settings} label="Configurações Hub" />}
            {canAccess('integracoes') && <NavItem href="/dashboard/integracoes" icon={PlugZap} label="Integrações (APIs)" />}
            {canAccess('meu_perfil') && <NavItem href="/dashboard/meu-perfil" icon={UserCircle} label="Meu Perfil" />}
          </>
        )}

        {/* ===== MENUS DA CONTABILIDADE ===== */}
        {role === 'contabilidade' && (
          <>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-4 mt-6">Escritório</div>
            {canAccess('contabilidade_meus_clientes') && <NavItem href="/dashboard/meus-clientes" icon={Users} label="Meus Clientes" />}
            {canAccess('notas_fiscais') && <NavItem href="/dashboard/notas-fiscais" icon={FileDown} label="Notas Fiscais (XMLs)" />}
            {(canAccess('relatorios') || canAccess('relatorios_resumo') || canAccess('relatorios_monofasicos') || canAccess('relatorios_auditoria')) && (
              <NavItem href="/dashboard/relatorios" icon={BarChart3} label="Relatórios" />
            )}
            {canAccess('corretor_tributario') && <NavItem href="/dashboard/corretor-tributario" icon={Sparkles} label="Corretor Tributário" />}
            {canAccess('saneador_arquivos') && <NavItem href="/dashboard/saneador-arquivos" icon={Database} label="Saneador de Arquivos" />}
            {canAccess('configuracoes_portal') && <NavItem href="/dashboard/configuracoes-portal" icon={Sliders} label="Configurações do Portal" />}
            {canAccess('configuracoes_hub') && <NavItem href="/dashboard/configuracoes" icon={Settings} label="Configurações Hub" />}
            {canAccess('integracoes') && <NavItem href="/dashboard/integracoes" icon={PlugZap} label="Integrações (APIs)" />}
            {canAccess('meu_perfil') && <NavItem href="/dashboard/meu-perfil" icon={Building2} label="Perfil do Escritório" />}
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
    <div className="min-h-screen flex bg-slate-50 font-sans">
      
      {/* 1. Sidebar Desktop (Fixa na esquerda) */}
      <aside className="hidden md:flex md:w-64 lg:w-72 bg-white border-r border-slate-200 flex-col shadow-sm relative z-10 flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* 2. Sidebar Mobile (Drawer com Overlay) */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop escuro com clique para fechar */}
          <div 
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity" 
            onClick={() => setMobileMenuOpen(false)} 
          />
          {/* Menu Drawer Deslizante */}
          <div className="relative w-72 max-w-[85vw] bg-white h-full flex flex-col shadow-2xl z-10">
            <SidebarContent />
          </div>
        </div>
      )}

      {/* 3. Main Content (Totalmente expandido em 100% da tela) */}
      <main className="flex-1 flex flex-col h-screen overflow-y-auto bg-[#F8FAFC]">
        {/* Topbar moderna e responsiva */}
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 lg:px-8 sticky top-0 z-20 shadow-sm flex-shrink-0">
          <div className="flex items-center gap-3">
            {/* Botão Hambúrguer Mobile */}
            <button 
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 focus:outline-none"
              aria-label="Abrir Menu"
            >
              <Menu size={22} />
            </button>
            <h1 className="text-lg font-bold text-slate-800 capitalize">
              {pathname.split('/').pop()?.replace('-', ' ') || 'Visão Geral'}
            </h1>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Botão Modo Kiosk / Tela Inteira (F11) */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition border border-slate-200/80 shadow-xs cursor-pointer"
              title={isFullscreen ? "Sair da Tela Cheia (F11)" : "Modo Tela Inteira / Kiosk (F11)"}
            >
              {isFullscreen ? (
                <>
                  <Minimize2 size={14} className="text-blue-600" />
                  <span className="hidden sm:inline">Sair Tela Cheia</span>
                </>
              ) : (
                <>
                  <Maximize2 size={14} className="text-slate-600" />
                  <span className="hidden sm:inline">Tela Inteira</span>
                </>
              )}
            </button>

            <span className="hidden sm:inline-block px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-600 border border-blue-100 capitalize">
              {role}
            </span>
          </div>
        </header>
        
        {/* Área de conteúdo EXPANDIDA com padding inferior para o rodapé fixo */}
        <div className="p-4 sm:p-6 lg:p-8 w-full flex-1 pb-16">
          {children}
        </div>

        {/* Rodapé Fixo e Discreto */}
        <footer className="h-9 bg-white/95 backdrop-blur-md border-t border-slate-200/80 fixed bottom-0 left-0 right-0 md:left-64 lg:left-72 z-20 flex items-center justify-between px-4 sm:px-6 text-[11px] text-slate-500 shadow-xs">
          <div className="flex items-center gap-1.5 truncate">
            <span>Desenvolvido por <strong className="text-slate-700 font-semibold">Paratech Soluções e Sistemas</strong> -</span>
            <a 
              href="https://paratechsolucoes.com.br" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700 hover:underline font-medium transition-colors"
            >
              www.paratechsolucoes.com.br
            </a>
          </div>
          <div className="flex items-center gap-1.5 text-right pl-3 truncate">
            <span className="hidden sm:inline text-slate-400">Analista programador Responsável:</span>
            <span className="sm:hidden text-slate-400">Resp:</span>
            <strong className="text-slate-700 font-semibold">Regis Alexandre</strong>
            <span className="text-slate-300">•</span>
            <a 
              href="https://wa.me/5537920007857?text=Ol%C3%A1%20Regis,%20contato%20atrav%C3%A9s%20do%20HubParatech" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-bold hover:underline transition-colors"
            >
              <span>37 92000 - 78 57</span>
            </a>
          </div>
        </footer>
      </main>
    </div>
  )
}
