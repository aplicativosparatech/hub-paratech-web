'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { 
  LayoutDashboard, Users, Building2, Settings, FileText, 
  LogOut, BarChart3, Receipt, FileDown, PlugZap, UserCircle,
  Menu, X
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import toast from 'react-hot-toast'

type Role = 'admin' | 'cliente' | 'contabilidade'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const [role, setRole] = useState<Role | null>(null)
  const [loading, setLoading] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

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
      setLoading(false)
    }
    loadRole()
  }, [])

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
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50/50">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <div className="text-slate-500 font-medium">Carregando painel...</div>
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
      <div className="p-6 lg:p-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
            <Building2 size={22} className="text-white" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-800">
            Hub<span className="text-blue-600">Paratech</span>
          </h2>
        </div>
        {/* Botão fechar para mobile */}
        <button 
          onClick={() => setMobileMenuOpen(false)} 
          className="md:hidden p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
        >
          <X size={22} />
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
            <NavItem href="/dashboard/integracoes" icon={PlugZap} label="Integrações (APIs)" />
            <NavItem href="/dashboard/configuracoes" icon={Settings} label="Configurações Hub" />
          </>
        )}

        {/* ===== MENUS DO CLIENTE ===== */}
        {role === 'cliente' && (
          <>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-4 mt-6">Meu Espaço</div>
            <NavItem href="/dashboard/minhas-faturas" icon={Receipt} label="Minhas Faturas" />
            <NavItem href="/dashboard/notas-fiscais" icon={FileDown} label="Minhas Notas Fiscais" />
            <NavItem href="/dashboard/relatorios" icon={BarChart3} label="Relatórios" />
            <NavItem href="/dashboard/meu-perfil" icon={UserCircle} label="Meu Perfil" />
          </>
        )}

        {/* ===== MENUS DA CONTABILIDADE ===== */}
        {role === 'contabilidade' && (
          <>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-4 mt-6">Escritório</div>
            <NavItem href="/dashboard/meus-clientes" icon={Users} label="Meus Clientes" />
            <NavItem href="/dashboard/notas-fiscais" icon={FileDown} label="Notas Fiscais (XMLs)" />
            <NavItem href="/dashboard/relatorios" icon={BarChart3} label="Relatórios" />
            <NavItem href="/dashboard/meu-perfil" icon={Building2} label="Perfil do Escritório" />
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

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-block px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-600 border border-blue-100 capitalize">
              {role}
            </span>
          </div>
        </header>
        
        {/* Área de conteúdo EXPANDIDA (Sem max-w-7xl que encurtava as tabelas) */}
        <div className="p-4 sm:p-6 lg:p-8 w-full flex-1">
          {children}
        </div>
      </main>
    </div>
  )
}
