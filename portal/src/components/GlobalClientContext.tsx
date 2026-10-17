'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import toast from 'react-hot-toast'

export type InterfaceMode = 'classico' | 'clean'

export interface ClienteItem {
  id: string
  razao_social: string
  nome_fantasia?: string | null
  cnpj: string
  whatsapp?: string | null
  celular?: string | null
  telefone?: string | null
  uf?: string | null
  cidade?: string | null
  regime_tributario?: string | null
  certificado_url?: string | null
  certificado_vencimento?: string | null
  logo_url?: string | null
  contabilidade_id?: string | null
  is_ativo?: boolean
}

interface GlobalClientContextType {
  // Modo de Interface
  interfaceMode: InterfaceMode
  setInterfaceMode: (mode: InterfaceMode) => void
  toggleInterfaceMode: () => void

  // Usuário e Permissão
  userRole: 'admin' | 'contabilidade' | 'cliente' | null
  loadingRole: boolean

  // Clientes
  clientes: ClienteItem[]
  loadingClientes: boolean
  refreshClientes: () => Promise<void>

  // Cliente Ativo Global
  selectedClienteId: string
  selectedCliente: ClienteItem | null
  setSelectedClienteId: (id: string | null) => void
  clearSelectedCliente: () => void

  // Preferências
  priorizarNomeFantasia: boolean
}

const GLOBAL_CLIENT_STORAGE_KEY = 'hub_paratech_global_cliente'
const INTERFACE_MODE_STORAGE_KEY = 'hub_interface_mode'

const GlobalClientContext = createContext<GlobalClientContextType | null>(null)

export function GlobalClientProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient()

  // 1. Modo de Interface ('classico' ou 'clean') - Padrão 'clean'
  const [interfaceMode, _setInterfaceMode] = useState<InterfaceMode>('clean')

  // 2. Papel do Usuário
  const [userRole, setUserRole] = useState<'admin' | 'contabilidade' | 'cliente' | null>(null)
  const [loadingRole, setLoadingRole] = useState(true)

  // 3. Lista de Clientes
  const [clientes, setClientes] = useState<ClienteItem[]>([])
  const [loadingClientes, setLoadingClientes] = useState(true)

  // 4. Cliente Global Selecionado ('' = Nenhum / Todos)
  const [selectedClienteId, _setSelectedClienteId] = useState<string>('')

  // 5. Preferência de exibição Nome Fantasia vs Razão Social
  const [priorizarNomeFantasia, setPriorizarNomeFantasia] = useState(false)

  // Inicialização no Client
  useEffect(() => {
    // Carrega modo de interface salvo (padrão 'clean')
    const savedMode = (localStorage.getItem(INTERFACE_MODE_STORAGE_KEY) as InterfaceMode) || 'clean'
    _setInterfaceMode(savedMode)

    // Carrega preferência de nome fantasia
    const savedPriorizar = localStorage.getItem('hub_priorizar_nome_fantasia') === 'true'
    setPriorizarNomeFantasia(savedPriorizar)

    // Carrega cliente salvo do localStorage ou sessionStorage
    const savedClient = localStorage.getItem(GLOBAL_CLIENT_STORAGE_KEY) || sessionStorage.getItem('hub_paratech_nf_filter_cliente') || ''
    if (savedClient) {
      _setSelectedClienteId(savedClient)
    }
  }, [])

  // Listener para eventos de configuração externa
  useEffect(() => {
    const handleSettingsChanged = () => {
      const mode = (localStorage.getItem(INTERFACE_MODE_STORAGE_KEY) as InterfaceMode) || 'clean'
      _setInterfaceMode(mode)

      const pref = localStorage.getItem('hub_priorizar_nome_fantasia') === 'true'
      setPriorizarNomeFantasia(pref)
    }

    const handleStorage = (e: StorageEvent) => {
      if (e.key === INTERFACE_MODE_STORAGE_KEY && e.newValue) {
        _setInterfaceMode(e.newValue as InterfaceMode)
      }
      if (e.key === GLOBAL_CLIENT_STORAGE_KEY) {
        _setSelectedClienteId(e.newValue || '')
      }
      if (e.key === 'hub_priorizar_nome_fantasia') {
        setPriorizarNomeFantasia(e.newValue === 'true')
      }
    }

    window.addEventListener('hub_settings_changed', handleSettingsChanged)
    window.addEventListener('storage', handleStorage)
    return () => {
      window.removeEventListener('hub_settings_changed', handleSettingsChanged)
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  // Carregar Usuário e Clientes
  const loadUserAndClients = useCallback(async () => {
    try {
      setLoadingClientes(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoadingRole(false)
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
      setLoadingRole(false)

      const camposSelect = 'id, razao_social, nome_fantasia, cnpj, whatsapp, celular, telefone, uf, cidade, regime_tributario, certificado_url, certificado_vencimento, logo_url, contabilidade_id, is_ativo'
      let clisData: ClienteItem[] = []

      if (role === 'cliente' && roleData?.cliente_id) {
        const { data: cli } = await supabase
          .from('clientes')
          .select(camposSelect)
          .eq('id', roleData.cliente_id)
          .maybeSingle()
        if (cli) {
          clisData = [cli]
          // Cliente fica sempre fixo na própria empresa
          _setSelectedClienteId(cli.id)
          localStorage.setItem(GLOBAL_CLIENT_STORAGE_KEY, cli.id)
        }
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

      // Se havia um cliente salvo, verificar se ele ainda existe na lista
      _setSelectedClienteId(prev => {
        if (role === 'cliente' && clisData.length > 0) {
          return clisData[0].id
        }
        if (prev && clisData.some(c => c.id === prev)) {
          return prev
        }
        // No modo clássico ou se for o primeiro acesso, padrão pode ser '' (nenhum/todos)
        return ''
      })
    } catch (err: any) {
      console.error('Erro ao carregar clientes globais:', err)
    } finally {
      setLoadingClientes(false)
    }
  }, [supabase])

  useEffect(() => {
    loadUserAndClients()
  }, [loadUserAndClients])

  // Setters
  const setInterfaceMode = useCallback((mode: InterfaceMode) => {
    _setInterfaceMode(mode)
    localStorage.setItem(INTERFACE_MODE_STORAGE_KEY, mode)
    window.dispatchEvent(new Event('hub_settings_changed'))
  }, [])

  const toggleInterfaceMode = useCallback(() => {
    setInterfaceMode(interfaceMode === 'clean' ? 'classico' : 'clean')
    toast(
      interfaceMode === 'clean' 
        ? 'Alternado para o Modo Clássico (banners e visual tradicional)' 
        : 'Alternado para o Modo Clean (foco em dados e busca global)', 
      { icon: interfaceMode === 'clean' ? '🏛️' : '✨' }
    )
  }, [interfaceMode, setInterfaceMode])

  const setSelectedClienteId = useCallback((id: string | null) => {
    const finalId = id || ''
    _setSelectedClienteId(finalId)
    
    if (finalId) {
      localStorage.setItem(GLOBAL_CLIENT_STORAGE_KEY, finalId)
      sessionStorage.setItem('hub_paratech_nf_filter_cliente', finalId)
    } else {
      localStorage.removeItem(GLOBAL_CLIENT_STORAGE_KEY)
      sessionStorage.removeItem('hub_paratech_nf_filter_cliente')
    }

    // Notifica todos os módulos da aplicação
    window.dispatchEvent(new CustomEvent('hub_global_cliente_changed', { detail: { clienteId: finalId } }))
    window.dispatchEvent(new Event('hub_settings_changed'))
  }, [])

  const clearSelectedCliente = useCallback(() => {
    setSelectedClienteId('')
  }, [setSelectedClienteId])

  const selectedCliente = useMemo(() => {
    if (!selectedClienteId) return null
    return clientes.find(c => c.id === selectedClienteId) || null
  }, [clientes, selectedClienteId])

  const value = useMemo(() => ({
    interfaceMode,
    setInterfaceMode,
    toggleInterfaceMode,
    userRole,
    loadingRole,
    clientes,
    loadingClientes,
    refreshClientes: loadUserAndClients,
    selectedClienteId,
    selectedCliente,
    setSelectedClienteId,
    clearSelectedCliente,
    priorizarNomeFantasia
  }), [
    interfaceMode,
    setInterfaceMode,
    toggleInterfaceMode,
    userRole,
    loadingRole,
    clientes,
    loadingClientes,
    loadUserAndClients,
    selectedClienteId,
    selectedCliente,
    setSelectedClienteId,
    clearSelectedCliente,
    priorizarNomeFantasia
  ])

  return (
    <GlobalClientContext.Provider value={value}>
      {children}
    </GlobalClientContext.Provider>
  )
}

export function useGlobalClient() {
  const ctx = useContext(GlobalClientContext)
  if (!ctx) {
    throw new Error('useGlobalClient deve ser utilizado dentro de GlobalClientProvider')
  }
  return ctx
}
