'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useSearchParams } from 'next/navigation'

interface NotasFiscaisFilterContextType {
  // Usuário e Clientes
  userRole: 'admin' | 'contabilidade' | 'cliente'
  clientes: any[]
  clienteAtual: any | null
  loadingClientes: boolean
  refreshClientes: () => Promise<void>

  // Filtro de Cliente Selecionado (Sempre obrigatório, nunca vazio)
  selectedCliente: string
  setSelectedCliente: (id: string) => void
  clientSearchTerm: string
  setClientSearchTerm: (term: string) => void

  // Filtros Avançados
  filtroMes: string
  setFiltroMes: (mes: string) => void
  dataInicio: string
  setDataInicio: (data: string) => void
  dataFim: string
  setDataFim: (data: string) => void
  buscaNumero: string
  setBuscaNumero: (num: string) => void
  buscaGeral: string
  setBuscaGeral: (termo: string) => void
  pageSize: number
  setPageSize: (size: number) => void

  // Status e Ações
  temFiltroAtivo: boolean
  temFiltroClienteAtivo: boolean
  limparFiltros: () => void
  limparTudo: () => void
}

const STORAGE_KEY_PREFIX = 'hub_paratech_nf_filter_'

function getSessionValue(key: string, defaultValue: string = ''): string {
  if (typeof window === 'undefined') return defaultValue
  try {
    return sessionStorage.getItem(STORAGE_KEY_PREFIX + key) ?? defaultValue
  } catch {
    return defaultValue
  }
}

function setSessionValue(key: string, value: string): void {
  if (typeof window === 'undefined') return
  try {
    if (value) {
      sessionStorage.setItem(STORAGE_KEY_PREFIX + key, value)
    } else {
      sessionStorage.removeItem(STORAGE_KEY_PREFIX + key)
    }
  } catch {
    // Ignora restrições de sessionStorage
  }
}

const NotasFiscaisFilterContext = createContext<NotasFiscaisFilterContextType | null>(null)

export function NotasFiscaisFilterProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const clienteIdUrl = searchParams.get('cliente_id')

  // Controle de Papel e Clientes
  const [userRole, setUserRole] = useState<'admin' | 'contabilidade' | 'cliente'>('admin')
  const [clientes, setClientes] = useState<any[]>([])
  const [loadingClientes, setLoadingClientes] = useState(true)

  // Estados de Filtro inicializados a partir de sessionStorage ou GlobalClient
  const [selectedCliente, _setSelectedCliente] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const globalSaved = localStorage.getItem('hub_paratech_global_cliente')
      if (globalSaved) return globalSaved
    }
    return clienteIdUrl || getSessionValue('cliente', '')
  })
  const [clientSearchTerm, _setClientSearchTerm] = useState<string>(() => getSessionValue('client_search', ''))
  const [filtroMes, _setFiltroMes] = useState<string>(() => getSessionValue('mes', ''))
  const [dataInicio, _setDataInicio] = useState<string>(() => getSessionValue('data_inicio', ''))
  const [dataFim, _setDataFim] = useState<string>(() => getSessionValue('data_fim', ''))
  const [buscaNumero, _setBuscaNumero] = useState<string>(() => getSessionValue('busca_numero', ''))
  const [buscaGeral, _setBuscaGeral] = useState<string>(() => getSessionValue('busca_geral', ''))
  const [pageSize, _setPageSize] = useState<number>(() => {
    const saved = getSessionValue('page_size', '25')
    const parsed = parseInt(saved, 10)
    return isNaN(parsed) ? 25 : parsed
  })

  // Sincronização Reativa com o Filtro Global do Topo
  useEffect(() => {
    const handleGlobalChange = (e: any) => {
      const newId = e.detail?.clienteId ?? (typeof window !== 'undefined' ? localStorage.getItem('hub_paratech_global_cliente') || '' : '')
      _setSelectedCliente(newId)
      setSessionValue('cliente', newId)
    }

    window.addEventListener('hub_global_cliente_changed', handleGlobalChange)
    return () => window.removeEventListener('hub_global_cliente_changed', handleGlobalChange)
  }, [])

  // Setters com persistência em sessionStorage e sincronização bidirecional global
  const setSelectedCliente = useCallback((id: string) => {
    _setSelectedCliente(id)
    setSessionValue('cliente', id)
    if (typeof window !== 'undefined') {
      if (id) {
        localStorage.setItem('hub_paratech_global_cliente', id)
      } else {
        localStorage.removeItem('hub_paratech_global_cliente')
      }
      window.dispatchEvent(new CustomEvent('hub_global_cliente_changed', { detail: { clienteId: id } }))
    }
  }, [])

  const setClientSearchTerm = useCallback((term: string) => {
    _setClientSearchTerm(term)
    setSessionValue('client_search', term)
  }, [])

  const setFiltroMes = useCallback((mes: string) => {
    _setFiltroMes(mes)
    setSessionValue('mes', mes)
  }, [])

  const setDataInicio = useCallback((data: string) => {
    _setDataInicio(data)
    setSessionValue('data_inicio', data)
  }, [])

  const setDataFim = useCallback((data: string) => {
    _setDataFim(data)
    setSessionValue('data_fim', data)
  }, [])

  const setBuscaNumero = useCallback((num: string) => {
    _setBuscaNumero(num)
    setSessionValue('busca_numero', num)
  }, [])

  const setBuscaGeral = useCallback((termo: string) => {
    _setBuscaGeral(termo)
    setSessionValue('busca_geral', termo)
  }, [])

  const setPageSize = useCallback((size: number) => {
    _setPageSize(size)
    setSessionValue('page_size', String(size))
  }, [])

  // Carrega Perfil do Usuário e Lista de Clientes
  const loadUserAndClients = useCallback(async () => {
    try {
      setLoadingClientes(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoadingClientes(false)
        return
      }

      // Consulta de papel com fallback resiliente
      let role: 'admin' | 'contabilidade' | 'cliente' = 'admin'
      let roleData: any = null

      try {
        const { data } = await supabase
          .from('user_roles')
          .select('role, cliente_id, contabilidade_id')
          .eq('user_id', user.id)
          .maybeSingle()
        if (data) {
          roleData = data
          role = (data.role as any) || 'admin'
        }
      } catch (errRole) {
        console.warn('user_roles indisponível, assumindo admin:', errRole)
      }

      setUserRole(role)

      let clisData: any[] = []
      const camposSelect = 'id, razao_social, nome_fantasia, cnpj, is_associacao, certificado_url, logo_url, uf, cidade, regime_tributario, data_inicio_monitoramento, numero_inicial_nfe, numero_inicial_nfce, numero_inicial_nfse, numero_inicial_cte, numero_inicial_mdfe'

      if (role === 'cliente' && roleData?.cliente_id) {
        const { data: cli } = await supabase
          .from('clientes')
          .select(camposSelect)
          .eq('id', roleData.cliente_id)
          .maybeSingle()
        if (cli) clisData = [cli]
      } else if (role === 'contabilidade' && roleData?.contabilidade_id) {
        const { data: clis } = await supabase
          .from('clientes')
          .select(camposSelect)
          .eq('contabilidade_id', roleData.contabilidade_id)
          .order('razao_social')
        if (clis) clisData = clis
      } else {
        // Admin: busca todas as empresas
        const { data: clis } = await supabase
          .from('clientes')
          .select(camposSelect)
          .order('razao_social')
        if (clis) clisData = clis
      }

      setClientes(clisData)

      // Regra de Seleção: prioriza papel de cliente, URL, cliente ativo em memória ou filtro global salvo
      if (clisData.length > 0) {
        _setSelectedCliente(prev => {
          if (role === 'cliente') {
            return clisData[0].id
          }
          if (clienteIdUrl && clisData.some(c => c.id === clienteIdUrl)) {
            setSessionValue('cliente', clienteIdUrl)
            return clienteIdUrl
          }
          const globalSaved = typeof window !== 'undefined' ? localStorage.getItem('hub_paratech_global_cliente') : null
          if (globalSaved && clisData.some(c => c.id === globalSaved)) {
            setSessionValue('cliente', globalSaved)
            return globalSaved
          }
          if (prev && clisData.some(c => c.id === prev)) {
            return prev
          }
          // Padrão: sem cliente ativo no filtro global = Todos os Clientes ('')
          return ''
        })
      }
    } catch (e) {
      console.error('Erro ao carregar clientes no contexto de notas fiscais:', e)
    } finally {
      setLoadingClientes(false)
    }
  }, [supabase, clienteIdUrl])

  useEffect(() => {
    loadUserAndClients()
  }, [loadUserAndClients])

  // Se a URL trouxer um novo cliente_id (ex: via link externo), atualiza
  useEffect(() => {
    if (clienteIdUrl && clienteIdUrl !== selectedCliente) {
      setSelectedCliente(clienteIdUrl)
    }
  }, [clienteIdUrl, selectedCliente, setSelectedCliente])

  // Objeto completo da empresa selecionada em análise (null se nenhum selecionado)
  const clienteAtual = useMemo(() => {
    if (!selectedCliente) return null
    return clientes.find(c => c.id === selectedCliente) || null
  }, [clientes, selectedCliente])

  // Limpa apenas os filtros de dados (mantém a empresa ativa)
  const limparFiltros = useCallback(() => {
    setFiltroMes('')
    setDataInicio('')
    setDataFim('')
    setBuscaNumero('')
    setBuscaGeral('')
  }, [setFiltroMes, setDataInicio, setDataFim, setBuscaNumero, setBuscaGeral])

  // Limpa filtros de pesquisa mantendo a empresa selecionada
  const limparTudo = useCallback(() => {
    limparFiltros()
    setClientSearchTerm('')
  }, [limparFiltros, setClientSearchTerm])

  const temFiltroAtivo = useMemo(() => {
    return Boolean(filtroMes || dataInicio || dataFim || buscaNumero || buscaGeral)
  }, [filtroMes, dataInicio, dataFim, buscaNumero, buscaGeral])

  const temFiltroClienteAtivo = useMemo(() => {
    return Boolean(selectedCliente)
  }, [selectedCliente])

  const value = useMemo<NotasFiscaisFilterContextType>(() => ({
    userRole,
    clientes,
    clienteAtual,
    loadingClientes,
    refreshClientes: loadUserAndClients,
    selectedCliente,
    setSelectedCliente,
    clientSearchTerm,
    setClientSearchTerm,
    filtroMes,
    setFiltroMes,
    dataInicio,
    setDataInicio,
    dataFim,
    setDataFim,
    buscaNumero,
    setBuscaNumero,
    buscaGeral,
    setBuscaGeral,
    pageSize,
    setPageSize,
    temFiltroAtivo,
    temFiltroClienteAtivo,
    limparFiltros,
    limparTudo,
  }), [
    userRole,
    clientes,
    clienteAtual,
    loadingClientes,
    loadUserAndClients,
    selectedCliente,
    setSelectedCliente,
    clientSearchTerm,
    setClientSearchTerm,
    filtroMes,
    setFiltroMes,
    dataInicio,
    setDataInicio,
    dataFim,
    setDataFim,
    buscaNumero,
    setBuscaNumero,
    buscaGeral,
    setBuscaGeral,
    pageSize,
    setPageSize,
    temFiltroAtivo,
    temFiltroClienteAtivo,
    limparFiltros,
    limparTudo,
  ])

  return (
    <NotasFiscaisFilterContext.Provider value={value}>
      {children}
    </NotasFiscaisFilterContext.Provider>
  )
}

export function useNotasFiscaisFilters() {
  const context = useContext(NotasFiscaisFilterContext)
  if (!context) {
    throw new Error('useNotasFiscaisFilters deve ser usado dentro de um NotasFiscaisFilterProvider')
  }
  return context
}
