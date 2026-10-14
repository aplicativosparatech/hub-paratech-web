'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { APP_VERSION } from '@/utils/version'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  
  // Splash Screen apenas no primeiro carregamento antes da tela de login
  const [showSplash, setShowSplash] = useState(true)
  const [splashProgress, setSplashProgress] = useState(0)

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    // Se o splash já foi exibido nesta sessão, libera a tela de login imediatamente
    if (typeof window !== 'undefined' && sessionStorage.getItem('hub_splash_shown') === 'true') {
      setShowSplash(false)
      return
    }

    const duration = 2000
    const startTime = Date.now()

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(100, Math.round((elapsed / duration) * 100))
      setSplashProgress(progress)

      if (elapsed >= duration) {
        clearInterval(interval)
        sessionStorage.setItem('hub_splash_shown', 'true')
        setTimeout(() => {
          setShowSplash(false)
        }, 150)
      }
    }, 25)

    return () => clearInterval(interval)
  }, [])

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

  // 1. TELA DE SPLASH (Executada apenas antes do login, 1 vez por sessão)
  if (showSplash) {
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

  // 2. TELA DE LOGIN (Aparece suavemente após o splash)
  return (
    <main className="min-h-screen flex flex-col justify-between bg-slate-900 p-4 relative overflow-hidden animate-in fade-in duration-500">
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
