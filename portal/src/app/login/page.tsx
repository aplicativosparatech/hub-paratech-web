'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

import { APP_VERSION } from '@/utils/version'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError('E-mail ou senha incorretos.')
      setLoading(false)
      return
    }

    // Se o login der certo, redireciona para o dashboard
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <main className="min-h-screen flex flex-col justify-between bg-slate-900 p-4 relative overflow-hidden">
      {/* Glow de fundo */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none"></div>

      <div className="flex-1 flex items-center justify-center relative z-10 py-10">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 border border-slate-100">
          <div className="text-center mb-8 flex flex-col items-center">
            <img src="/logo-paratech.webp" alt="Paratech Logo" className="h-14 mb-4 object-contain" />
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">HubParatech</h1>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">
                {APP_VERSION}
              </span>
            </div>
            <p className="text-slate-500 text-xs mt-1">Ecossistema Fiscal & Inteligência Tributária</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                E-mail de Acesso
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                placeholder="seu@email.com"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Senha
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-600 text-xs rounded-xl border border-red-200 font-medium">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition shadow-lg shadow-blue-600/20 disabled:opacity-50 text-sm cursor-pointer"
            >
              {loading ? 'Acessando Portal...' : 'Entrar no Sistema'}
            </button>
          </form>
        </div>
      </div>

      {/* Rodapé Fixo e Discreto */}
      <footer className="w-full py-3 px-4 sm:px-8 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 gap-2 relative z-10">
        <div className="flex items-center gap-1.5 truncate">
          <span>Desenvolvido por <strong className="text-slate-300">Paratech Soluções e Sistemas</strong> -</span>
          <a 
            href="https://paratechsolucoes.com.br" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 hover:underline font-medium transition-colors"
          >
            www.paratechsolucoes.com.br
          </a>
        </div>
        <div className="flex items-center gap-1.5 text-right truncate">
          <span className="text-slate-500">Analista programador Responsável:</span>
          <strong className="text-slate-300">Regis Alexandre</strong>
          <span className="text-slate-600">•</span>
          <a 
            href="https://wa.me/5537920007857?text=Ol%C3%A1%20Regis,%20contato%20atrav%C3%A9s%20do%20HubParatech" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-emerald-400 hover:text-emerald-300 font-bold hover:underline transition-colors"
          >
            <span>37 92000 - 78 57</span>
          </a>
        </div>
      </footer>
    </main>
  )
}
