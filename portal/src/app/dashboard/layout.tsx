'use client'

import Link from 'next/link'
import { LayoutDashboard, Users, Building2, Settings, FileText, LogOut } from 'lucide-react'
import { Toaster } from 'react-hot-toast'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const supabase = createClient()

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
          <Link href="/dashboard/gateways" className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition">
            <Building2 size={20} />
            <span>Gateways</span>
          </Link>
          <Link href="/dashboard/configuracoes" className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition">
            <Settings size={20} />
            <span>Configurações Hub</span>
          </Link>
        </nav>

        <div className="p-4 border-t border-slate-800">
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
