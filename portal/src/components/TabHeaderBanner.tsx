'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'

const BANNER_MAP: Record<string, string> = {
  '/dashboard': '/banners/dashboard.webp',
  '/dashboard/contabilidades': '/banners/contabilidades.webp',
  '/dashboard/clientes': '/banners/clientes.webp',
  '/dashboard/faturas': '/banners/faturas.webp',
  '/dashboard/minhas-faturas': '/banners/faturas.webp',
  '/dashboard/notas-fiscais': '/banners/notas-fiscais.webp',
  '/dashboard/corretor-tributario': '/banners/corretor-tributario.webp',
  '/dashboard/saneador-arquivos': '/banners/saneador-arquivos.webp',
  '/dashboard/sugestor-tributario': '/banners/sugestor-tributario.webp',
  '/dashboard/tutorial': '/banners/tutorial.webp',
  '/dashboard/relatorios': '/banners/relatorios.webp',
  '/dashboard/integracoes': '/banners/integracoes.webp',
  '/dashboard/permissoes': '/banners/permissoes.webp',
  '/dashboard/configuracoes-portal': '/banners/configuracoes-portal.webp',
  '/dashboard/configuracoes': '/banners/configuracoes.webp',
  '/dashboard/aparencia': '/banners/aparencia.webp',
  '/dashboard/meus-clientes': '/banners/meus-clientes.webp',
  '/dashboard/meu-perfil': '/banners/meu-perfil.webp',
}

export default function TabHeaderBanner() {
  const pathname = usePathname()
  const [showBanner, setShowBanner] = useState<boolean>(true)
  const [mounted, setMounted] = useState<boolean>(false)

  useEffect(() => {
    setMounted(true)
    const checkSetting = () => {
      const stored = localStorage.getItem('hub_show_header_banners')
      // Padrão é true (ativado)
      setShowBanner(stored !== 'false')
    }

    checkSetting()

    // Ouve alterações feitas na aba Aparência
    window.addEventListener('storage', checkSetting)
    window.addEventListener('hub_settings_changed', checkSetting)

    return () => {
      window.removeEventListener('storage', checkSetting)
      window.removeEventListener('hub_settings_changed', checkSetting)
    }
  }, [])

  if (!mounted || !showBanner) {
    return null
  }

  // Descobrir qual banner usar baseado no início do pathname
  let bannerUrl = '/banners/default.webp'
  for (const [route, url] of Object.entries(BANNER_MAP)) {
    if (pathname === route || (route !== '/dashboard' && pathname.startsWith(route))) {
      bannerUrl = url
      break
    }
  }

  return (
    <div className="w-full h-[80px] sm:h-[98px] bg-[#020b18] overflow-hidden relative select-none flex-shrink-0 border-b border-blue-950/50 shadow-md z-30 transition-all duration-300">
      <img
        src={bannerUrl}
        alt="Banner Temático da Aba"
        className="w-full h-full object-cover object-center block pointer-events-none"
        loading="eager"
      />
    </div>
  )
}
