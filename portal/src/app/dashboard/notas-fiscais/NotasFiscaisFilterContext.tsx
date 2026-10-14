'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useSearchParams } from 'next/navigation'

interface NotasFiscaisFilterContextType {
  // Usuário e Clientes
  userRole: 'admin' | 'contabilidade' | 'cliente'
  clientes: any[]
  loadingClientes: boolean
  refreshClientes: () => Promise<void>

  // Filtro de Cliente Selecionado
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

  // Estados de Filtro inicializados a partir de sessionStorage
  const [selectedCliente, _setSelectedCliente] = useState<string>(() => {
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

  // Setters com persistência em sessionStorage
  const setSelectedCliente = useCallback((id: string) => {
    _setSelectedCliente(id)
    setSessionValue('cliente', id)
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

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role, cliente_id, contabilidade_id')
        .eq('user_id', user.id)
        .single()

      const role = (roleData?.role as any) || 'admin'
      setUserRole(role)

      if (role === 'cliente' && roleData?.cliente_id) {
        setSelectedCliente(roleData.cliente_id)
        const { data: cli } = await supabase
          .from('clientes')
          .select('id, razao_social, nome_fantasia, cnpj, certificado_url, logo_url')
          .eq('id', roleData.cliente_id)
          .single()
        if (cli) setClientes([cli])
      } else if (role === 'contabilidade' && roleData?.contabilidade_id) {
        const { data: clis } = await supabase
          .from('clientes')
          .select('id, razao_social, nome_fantasia, cnpj, certificado_url, logo_url')
          .eq('contabilidade_id', roleData.contabilidade_id)
          .order('razao_social')
        if (clis) {
          setClientes(clis)
          // Se não houver cliente salvo, pré-seleciona o primeiro
          _setSelectedCliente(prev => {
            if (clienteIdUrl) return clienteIdUrl
            if (prev && clis.some(c => c.id === prev)) return prev
            const firstId = clis.length > 0 ? clis[0].id : ''
            setSessionValue('cliente', firstId)
            return firstId
          })
        }
      } else {
        // Admin: busca todos os clientes
        const { data: clis } = await supabase
          .from('clientes')
          .select('id, razao_social, nome_fantasia, cnpj, certificado_url, logo_url')
          .order('razao_social')
        if (clis) {
          setClientes(clis)
          if (clienteIdUrl) {
            setSelectedCliente(clienteIdUrl)
          }
        }
      }
    } catch (e) {
      console.error('Erro ao carregar clientes no contexto de notas fiscais:', e)
    } finally {
      setLoadingClientes(false)
    }
  }, [supabase, clienteIdUrl, setSelectedCliente])

  useEffect(() => {
    loadUserAndClients()
  }, [loadUserAndClients])

  // Se a URL trouxer um novo cliente_id (ex: via link externo), atualiza
  useEffect(() => {
    if (clienteIdUrl && clienteIdUrl !== selectedCliente) {
      setSelectedCliente(clienteIdUrl)
    }
  }, [clienteIdUrl, selectedCliente, setSelectedCliente])

  // Limpa apenas os filtros de dados (mantém o cliente ativo)
  const limparFiltros = useCallback(() => {
    setFiltroMes('')
    setDataInicio('')
    setDataFim('')
    setBuscaNumero('')
    setBuscaGeral('')
  }, [setFiltroMes, setDataInicio, setDataFim, setBuscaNumero, setBuscaGeral])

  // Limpa tudo (filtros de dados e seleção de cliente se for admin)
  const limparTudo = useCallback(() => {
    limparFiltros()
    if (userRole === 'admin') {
      setSelectedCliente('')
      setClientSearchTerm('')
    }
  }, [limparFiltros, userRole, setSelectedCliente, setClientSearchTerm])

  const temFiltroAtivo = useMemo(() => {
    return Boolean(filtroMes || dataInicio || dataFim || buscaNumero || buscaGeral)
  }, [filtroMes, dataInicio, dataFim, buscaNumero, buscaGeral])

  const temFiltroClienteAtivo = useMemo(() => {
    return Boolean(selectedCliente)
  }, [selectedCliente])

  const value = useMemo<NotasFiscaisFilterContextType>(() => ({
    userRole,
    clientes,
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
