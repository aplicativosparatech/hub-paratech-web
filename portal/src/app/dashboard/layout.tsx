'use client'

import Link from 'next/link'
import { LayoutDashboard, Users, Building2, Settings, FileText, LogOut, BarChart3, Receipt, FileDown } from 'lucide-react'
import { Toaster } from 'react-hot-toast'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const supabase = createClient()
  const [role, setRole] = useState<'admin' | 'cliente' | 'contabilidade' | null>(null)

  useEffect(() => {
    async function loadRole() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: roleData } = await supabase.from('user_roles').select('role').eq('user_id', user.id).single()
        if (roleData) {
          setRole(roleData.role)
        } else {
          setRole('admin') // Fallback if no role found for some reason, though normally we kick them out.
        }
      }
    }
    loadRole()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen flex bg-slate-50">
      <Toaster position="top-right" />
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col">
        <div className="p-6 flex items-center gap-3">
          <img src="/logo-icon.png" alt="Icon" className="w-8 h-8 object-contain" />
          <h2 className="text-xl font-bold text-white tracking-tight">Hub<span className="text-blue-500">Paratech</span></h2>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 mt-4">
          <Link href="/dashboard" className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition">
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
          </Link>

          {/* MENUS DO ADMIN */}
          {(!role || role === 'admin') && (
            <>
              <Link href="/dashboard/contabilidades" className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition">
                <Building2 size={20} />
                <span>Contabilidades</span>
              </Link>
              <Link href="/dashboard/clientes" className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition">
                <Users size={20} />
                <span>Clientes</span>
              </Link>
              <Link href="/dashboard/faturas" className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition">
                <FileText size={20} />
                <span>Faturas</span>
              </Link>
              <Link href="/dashboard/notas-fiscais" className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition">
                <FileDown size={20} />
                <span>Notas Fiscais</span>
              </Link>
              <Link href="/dashboard/relatorios" className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition">
                <BarChart3 size={20} />
                <span>Relatórios</span>
              </Link>
              <Link href="/dashboard/gateways" className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition">
                <Building2 size={20} />
                <span>Gateways</span>
              </Link>
              <Link href="/dashboard/configuracoes" className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition">
                <Settings size={20} />
                <span>Configurações Hub</span>
              </Link>
            </>
          )}

          {/* MENUS DO CLIENTE */}
          {role === 'cliente' && (
            <>
              <Link href="/dashboard/minhas-faturas" className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition">
                <Receipt size={20} />
                <span>Minhas Faturas</span>
              </Link>
            </>
          )}

          {/* MENUS DA CONTABILIDADE */}
          {role === 'contabilidade' && (
            <>
              <Link href="/dashboard/notas-fiscais" className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition">
                <FileDown size={20} />
                <span>Notas Fiscais (XMLs)</span>
              </Link>
            </>
          )}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="px-4 pb-3 mb-3 border-b border-slate-800 text-xs text-slate-500 text-center font-mono">
            {role ? `Acesso: ${role.toUpperCase()}` : 'Carregando...'}
          </div>
          <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition">
            <LogOut size={20} />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
