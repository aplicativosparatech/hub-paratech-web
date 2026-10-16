'use client'

import { useState, useEffect } from 'react'
import { 
  Palette, Sun, Moon, Maximize2, Minimize2, Image as ImageIcon, 
  Check, Save, Sparkles, Monitor, Eye, Layout, ShieldCheck, Building2
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function AparenciaPage() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [displayMode, setDisplayMode] = useState<'window' | 'fullscreen'>('window')
  const [showHeaderBanners, setShowHeaderBanners] = useState<boolean>(true)
  const [priorizarNomeFantasia, setPriorizarNomeFantasia] = useState<boolean>(false)
  const [saving, setSaving] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Carregar preferências salvas
  useEffect(() => {
    setMounted(true)
    const savedTheme = (localStorage.getItem('hub_theme') as 'light' | 'dark') || 'light'
    const savedMode = (localStorage.getItem('hub_display_mode') as 'window' | 'fullscreen') || 'window'
    const savedBanners = localStorage.getItem('hub_show_header_banners') !== 'false'
    const savedPriorizar = localStorage.getItem('hub_priorizar_nome_fantasia') === 'true'

    setTheme(savedTheme)
    setDisplayMode(savedMode)
    setShowHeaderBanners(savedBanners)
    setPriorizarNomeFantasia(savedPriorizar)
  }, [])

  const handleThemeChange = (newTheme: 'light' | 'dark') => {
    setTheme(newTheme)
    localStorage.setItem('hub_theme', newTheme)
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    window.dispatchEvent(new Event('hub_settings_changed'))
  }

  const handleDisplayModeChange = (newMode: 'window' | 'fullscreen') => {
    setDisplayMode(newMode)
    localStorage.setItem('hub_display_mode', newMode)
    window.dispatchEvent(new Event('hub_settings_changed'))

    if (newMode === 'fullscreen') {
      toast.success('Tela cheia automática ativada! Ao mover o mouse na tela, o portal entrará em modo Kiosk.', {
        icon: '🖥️',
        duration: 4000
      })
    } else {
      toast('Modo janela padrão ativado.', { icon: '🪟' })
    }
  }

  const handleBannerToggle = (enabled: boolean) => {
    setShowHeaderBanners(enabled)
    localStorage.setItem('hub_show_header_banners', enabled ? 'true' : 'false')
    window.dispatchEvent(new Event('hub_settings_changed'))
    toast.success(
      enabled 
        ? 'Cabeçalhos com imagens ativados para todas as abas!' 
        : 'Cabeçalhos com imagens desativados (modo minimalista).',
      { icon: enabled ? '🖼️' : '🚫' }
    )
  }

  const handlePriorizarNomeFantasiaToggle = (enabled: boolean) => {
    setPriorizarNomeFantasia(enabled)
    localStorage.setItem('hub_priorizar_nome_fantasia', enabled ? 'true' : 'false')
    window.dispatchEvent(new Event('hub_settings_changed'))
    toast.success(
      enabled 
        ? 'Nome Fantasia definido como título principal das empresas!' 
        : 'Razão Social restaurada como título principal das empresas.',
      { icon: '🏢' }
    )
  }

  const handleSaveAll = () => {
    setSaving(true)
    localStorage.setItem('hub_theme', theme)
    localStorage.setItem('hub_display_mode', displayMode)
    localStorage.setItem('hub_show_header_banners', showHeaderBanners ? 'true' : 'false')
    localStorage.setItem('hub_priorizar_nome_fantasia', priorizarNomeFantasia ? 'true' : 'false')
    window.dispatchEvent(new Event('hub_settings_changed'))
    
    setTimeout(() => {
      setSaving(false)
      toast.success('Todas as preferências de aparência foram salvas e aplicadas!')
    }, 400)
  }

  if (!mounted) return null

  return (
    <div className="space-y-8 pb-16 max-w-5xl mx-auto">
      
      {/* 1. Header da Página */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold border border-indigo-500/30">
              <Palette size={14} className="text-indigo-400" />
              Interface & Identidade Visual
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Personalização & Aparência
            </h1>
            <p className="text-slate-300 text-sm max-w-2xl leading-relaxed">
              Defina a experiência visual do ecossistema: escolha o tema padrão, configure o modo de tela cheia automática e gerencie a exibição de cabeçalhos ilustrados temáticos em todas as abas.
            </p>
          </div>

          <button
            type="button"
            onClick={handleSaveAll}
            disabled={saving}
            className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer self-start md:self-auto"
          >
            <Save size={16} />
            <span>{saving ? 'Aplicando...' : 'Salvar Preferências'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* CARD 1: TEMA PADRÃO */}
        <div className="bg-white dark:bg-[#0B1120] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs flex flex-col justify-between transition-colors">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-200/60 dark:border-amber-800">
                <Sun size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 dark:text-white text-base">Tema Padrão do Sistema</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Escolha a paleta de cores predominante</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
              Alterne entre os modos claro e escuro. O tema selecionado será carregado automaticamente em todos os seus acessos.
            </p>

            <div className="grid grid-cols-2 gap-4">
              {/* Opção Claro */}
              <button
                type="button"
                onClick={() => handleThemeChange('light')}
                className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-3 cursor-pointer ${
                  theme === 'light'
                    ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 font-bold shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-white text-amber-500 flex items-center justify-center shadow-xs border border-slate-200">
                  <Sun size={22} className="fill-amber-400/20" />
                </div>
                <div className="text-center">
                  <div className="text-sm font-bold">Tema Claro</div>
                  <div className="text-[11px] text-slate-400 font-normal">Fundo branco e limpo</div>
                </div>
                {theme === 'light' && (
                  <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold text-blue-600 bg-blue-100 dark:bg-blue-900/60 px-2 py-0.5 rounded-full">
                    <Check size={10} /> Ativo
                  </span>
                )}
              </button>

              {/* Opção Escuro */}
              <button
                type="button"
                onClick={() => handleThemeChange('dark')}
                className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-3 cursor-pointer ${
                  theme === 'dark'
                    ? 'border-indigo-600 bg-indigo-950/30 text-indigo-300 font-bold shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-slate-900 text-indigo-400 flex items-center justify-center shadow-xs border border-slate-700">
                  <Moon size={22} className="fill-indigo-400/20" />
                </div>
                <div className="text-center">
                  <div className="text-sm font-bold">Tema Escuro</div>
                  <div className="text-[11px] text-slate-400 font-normal">Alto contraste e descanso</div>
                </div>
                {theme === 'dark' && (
                  <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold text-indigo-400 bg-indigo-900/60 px-2 py-0.5 rounded-full">
                    <Check size={10} /> Ativo
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* CARD 2: MODO DE EXIBIÇÃO DE TELA */}
        <div className="bg-white dark:bg-[#0B1120] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs flex flex-col justify-between transition-colors">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200/60 dark:border-blue-800">
                <Monitor size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 dark:text-white text-base">Modo de Exibição de Tela</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Janela normal ou tela cheia (F11)</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
              Por segurança dos navegadores, a tela cheia necessita de uma interação. Ao selecionar <strong>Tela Cheia Automática</strong>, o portal expandirá assim que você movimentar o mouse.
            </p>

            <div className="grid grid-cols-2 gap-4">
              {/* Opção Janela Padrão */}
              <button
                type="button"
                onClick={() => handleDisplayModeChange('window')}
                className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-3 cursor-pointer ${
                  displayMode === 'window'
                    ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 font-bold shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shadow-xs border border-slate-200 dark:border-slate-700">
                  <Minimize2 size={20} />
                </div>
                <div className="text-center">
                  <div className="text-sm font-bold">Modo Janela</div>
                  <div className="text-[11px] text-slate-400 font-normal">Navegador tradicional</div>
                </div>
                {displayMode === 'window' && (
                  <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold text-blue-600 bg-blue-100 dark:bg-blue-900/60 px-2 py-0.5 rounded-full">
                    <Check size={10} /> Ativo
                  </span>
                )}
              </button>

              {/* Opção Tela Cheia Automática */}
              <button
                type="button"
                onClick={() => handleDisplayModeChange('fullscreen')}
                className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-3 cursor-pointer ${
                  displayMode === 'fullscreen'
                    ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 font-bold shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xs">
                  <Maximize2 size={20} />
                </div>
                <div className="text-center">
                  <div className="text-sm font-bold">Tela Cheia Auto</div>
                  <div className="text-[11px] text-slate-400 font-normal">Ao mover o mouse</div>
                </div>
                {displayMode === 'fullscreen' && (
                  <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold text-blue-600 bg-blue-100 dark:bg-blue-900/60 px-2 py-0.5 rounded-full">
                    <Check size={10} /> Ativo
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* CARD 3: CABEÇALHOS COM IMAGENS (FULL WIDTH) */}
      <div className="bg-white dark:bg-[#0B1120] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xs transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200/60 dark:border-indigo-800 flex-shrink-0">
              <ImageIcon size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-800 dark:text-white text-lg">Exibir Cabeçalhos com Imagens</h3>
                <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-[11px] font-bold uppercase tracking-wider border border-blue-200 dark:border-blue-800">
                  Todas as Abas
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
                Renderiza um cabeçalho panorâmico (ultra-widescreen) estilizado no topo de cada página, trazendo gráficos fiscais, ícones e slogan contextual para o módulo em exibição (incluindo abas futuras).
              </p>
            </div>
          </div>

          {/* Toggle Switch */}
          <div className="flex items-center gap-3 self-end sm:self-center">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              {showHeaderBanners ? 'Ativado' : 'Desativado'}
            </span>
            <button
              type="button"
              onClick={() => handleBannerToggle(!showHeaderBanners)}
              className={`w-14 h-8 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ease-in-out ${
                showHeaderBanners ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
              }`}
              role="switch"
              aria-checked={showHeaderBanners}
            >
              <div
                className={`bg-white w-6 h-6 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                  showHeaderBanners ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Pré-visualização do Banner */}
        <div className="mt-6 space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <Eye size={14} className="text-blue-500" />
              Pré-visualização do Cabeçalho Ilustrado:
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              Proporção ultra-widescreen (1280x98)
            </span>
          </div>

          <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-md relative bg-[#021332]">
            {showHeaderBanners ? (
              <img
                src="/banners/contabilidades.webp"
                alt="Banner de Exemplo - Contabilidade"
                className="w-full h-[98px] object-cover object-center block"
              />
            ) : (
              <div className="h-[98px] flex items-center justify-center bg-slate-100 dark:bg-slate-900 text-slate-400 text-xs italic">
                Cabeçalho com imagem desativado — O sistema operará em layout minimalista.
              </div>
            )}
          </div>

          <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200/80 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2.5">
            <Sparkles size={16} className="text-blue-500 mt-0.5 flex-shrink-0" />
            <p>
              <strong>Suporte a Abas Atuais e Futuras:</strong> Cada aba do sistema possui um banner exclusivo gerado sob medida (Contabilidades, Clientes, Notas Fiscais, Analisador Tributário, Saneador de Arquivos, Faturas, Relatórios, Integrações, Permissões, Aparência, etc.). Qualquer nova funcionalidade futura herdará automaticamente o design limpo e proporcional.
            </p>
          </div>
        </div>

      </div>

      {/* CARD 4: HIERARQUIA DE NOMES DAS EMPRESAS (NOME FANTASIA VS RAZÃO SOCIAL) */}
      <div className="bg-white dark:bg-[#0B1120] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xs transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200/60 dark:border-emerald-800 flex-shrink-0">
              <Building2 size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-800 dark:text-white text-lg">Hierarquia de Nomes das Empresas</h3>
                <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold uppercase tracking-wider border border-emerald-200 dark:border-emerald-800">
                  Clientes & Tabelas
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
                Define se o <strong>Nome Fantasia</strong> ou a <strong>Razão Social</strong> da empresa deve aparecer como o título principal (em negrito de maior destaque) na tela de Clientes (Empresas) e seletores do portal.
              </p>
            </div>
          </div>

          {/* Toggle Switch */}
          <div className="flex items-center gap-3 self-end sm:self-center">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              {priorizarNomeFantasia ? 'Nome Fantasia como Título' : 'Razão Social como Título (Padrão)'}
            </span>
            <button
              type="button"
              onClick={() => handlePriorizarNomeFantasiaToggle(!priorizarNomeFantasia)}
              className={`w-14 h-8 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ease-in-out shrink-0 ${
                priorizarNomeFantasia ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
              }`}
              role="switch"
              aria-checked={priorizarNomeFantasia}
            >
              <div
                className={`bg-white w-6 h-6 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                  priorizarNomeFantasia ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Prévia visual da tabela */}
        <div className="mt-6 space-y-3">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Eye size={14} className="text-emerald-500" />
            Exemplo de como a empresa aparecerá na listagem de Clientes:
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-900/80 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex items-center justify-center font-bold text-sm border border-emerald-200 dark:border-emerald-800">
                {priorizarNomeFantasia ? 'B' : 'A'}
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  {priorizarNomeFantasia ? 'BURGER & BEER RESTAURANTE' : 'AUTO POSTO & CONVENIENCIA SILVA LTDA'}
                  <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    Título Principal
                  </span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                  <span>{priorizarNomeFantasia ? 'AUTO POSTO & CONVENIENCIA SILVA LTDA' : 'BURGER & BEER RESTAURANTE'}</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 italic">
                    (Subtítulo secundário)
                  </span>
                </div>
              </div>
            </div>

            <div className="text-right hidden sm:block">
              <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">12.345.678/0001-90</span>
              <span className="text-[11px] text-slate-400 block">Simples Nacional</span>
            </div>
          </div>
        </div>

      </div>

    </div>
  )
}
