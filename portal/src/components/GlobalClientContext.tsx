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
  telefone?: string | null
  uf?: string | null
  cidade?: string | null
  regime_tributario?: string | null
  certificado_url?: string | null
  certificado_validade?: string | null
  logo_url?: string | null
  contabilidade_id?: string | null
  contabilidade_nome?: string | null
  ultima_sincronizacao_hub?: string | null
  is_ativo?: boolean
}

interface GlobalClientContextType {
  // Modo de Interface
  interfaceMode: InterfaceMode
  setInterfaceMode: (mode: InterfaceMode) => void
  toggleInterfaceMode: () => void
  permitirTrocaInterface: boolean
  modoPadraoInterface: InterfaceMode

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
  clientePadraoLogin: 'vazio' | 'ultimo_usado'
  setClientePadraoLogin: (modo: 'vazio' | 'ultimo_usado') => void
}

const GLOBAL_CLIENT_STORAGE_KEY = 'hub_paratech_global_cliente'
const INTERFACE_MODE_STORAGE_KEY = 'hub_interface_mode'

const GlobalClientContext = createContext<GlobalClientContextType | null>(null)

export function GlobalClientProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient()

  // 1. Modo de Interface ('classico' ou 'clean') - Padrão 'clean'
  const [interfaceMode, _setInterfaceMode] = useState<InterfaceMode>('clean')
  const [permitirTrocaInterface, setPermitirTrocaInterface] = useState(true)
  const [modoPadraoInterface, setModoPadraoInterface] = useState<InterfaceMode>('clean')

  // 2. Papel do Usuário
  const [userRole, setUserRole] = useState<'admin' | 'contabilidade' | 'cliente' | null>(null)
  const [loadingRole, setLoadingRole] = useState(true)

  // 3. Lista de Clientes
  const [clientes, setClientes] = useState<ClienteItem[]>([])
  const [loadingClientes, setLoadingClientes] = useState(true)

  // 4. Cliente Global Selecionado ('' = Nenhum / Todos)
  const [selectedClienteId, _setSelectedClienteId] = useState<string>('')

  // 5. Preferências de interface e login
  const [priorizarNomeFantasia, setPriorizarNomeFantasia] = useState(false)
  const [clientePadraoLogin, setClientePadraoLoginState] = useState<'vazio' | 'ultimo_usado'>('vazio')

  // Inicialização no Client
  useEffect(() => {
    // Carrega permissão e modo padrão de interface
    const savedPermitir = localStorage.getItem('hub_permitir_troca_interface')
    if (savedPermitir !== null) {
      setPermitirTrocaInterface(savedPermitir === 'true')
    }
    const savedPadrao = (localStorage.getItem('hub_interface_mode_default') as InterfaceMode) || 'clean'
    setModoPadraoInterface(savedPadrao)

    // Carrega modo de interface salvo (se bloqueado para usuário comum, adota o padrão)
    const savedMode = (localStorage.getItem(INTERFACE_MODE_STORAGE_KEY) as InterfaceMode) || savedPadrao
    _setInterfaceMode(savedMode)

    // Carrega preferência de nome fantasia
    const savedPriorizar = localStorage.getItem('hub_priorizar_nome_fantasia') === 'true'
    setPriorizarNomeFantasia(savedPriorizar)

    // Carrega preferência de cliente padrão ao logar (vazio ou ultimo_usado) - Padrão: 'vazio'
    const savedClientePadrao = (localStorage.getItem('hub_cliente_padrao_login') as 'vazio' | 'ultimo_usado') || 'vazio'
    setClientePadraoLoginState(savedClientePadrao)

    // Se configurado para manter o último usado, recupera do storage; caso contrário inicia vazio
    if (savedClientePadrao === 'ultimo_usado') {
      const savedClient = localStorage.getItem(GLOBAL_CLIENT_STORAGE_KEY) || sessionStorage.getItem('hub_paratech_nf_filter_cliente') || ''
      if (savedClient) {
        _setSelectedClienteId(savedClient)
      }
    } else {
      _setSelectedClienteId('')
    }
  }, [])

  // Listener para eventos de configuração externa
  useEffect(() => {
    const handleSettingsChanged = () => {
      const savedPermitir = localStorage.getItem('hub_permitir_troca_interface')
      if (savedPermitir !== null) {
        setPermitirTrocaInterface(savedPermitir === 'true')
      }
      const savedPadrao = (localStorage.getItem('hub_interface_mode_default') as InterfaceMode) || 'clean'
      setModoPadraoInterface(savedPadrao)

      const mode = (localStorage.getItem(INTERFACE_MODE_STORAGE_KEY) as InterfaceMode) || savedPadrao
      _setInterfaceMode(mode)

      const pref = localStorage.getItem('hub_priorizar_nome_fantasia') === 'true'
      setPriorizarNomeFantasia(pref)

      const padraoLogin = (localStorage.getItem('hub_cliente_padrao_login') as 'vazio' | 'ultimo_usado') || 'vazio'
      setClientePadraoLoginState(padraoLogin)
    }

    const handleStorage = (e: StorageEvent) => {
      if (e.key === INTERFACE_MODE_STORAGE_KEY && e.newValue) {
        _setInterfaceMode(e.newValue as InterfaceMode)
      }
      if (e.key === 'hub_permitir_troca_interface') {
        setPermitirTrocaInterface(e.newValue === 'true')
      }
      if (e.key === 'hub_interface_mode_default' && e.newValue) {
        setModoPadraoInterface(e.newValue as InterfaceMode)
      }
      if (e.key === GLOBAL_CLIENT_STORAGE_KEY) {
        _setSelectedClienteId(e.newValue || '')
      }
      if (e.key === 'hub_priorizar_nome_fantasia') {
        setPriorizarNomeFantasia(e.newValue === 'true')
      }
      if (e.key === 'hub_cliente_padrao_login') {
        setClientePadraoLoginState((e.newValue as 'vazio' | 'ultimo_usado') || 'vazio')
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

      const camposSelect = 'id, razao_social, nome_fantasia, cnpj, whatsapp, telefone, uf, cidade, regime_tributario, certificado_url, certificado_validade, logo_url, contabilidade_id, is_ativo, contabilidades(id, razao_social, nome_fantasia), configuracoes_hub(ultima_sincronizacao)'
      let clisData: ClienteItem[] = []

      const formatarClienteItem = (c: any): ClienteItem => {
        const contab = Array.isArray(c.contabilidades) ? c.contabilidades[0] : c.contabilidades
        const hub = Array.isArray(c.configuracoes_hub) ? c.configuracoes_hub[0] : c.configuracoes_hub
        return {
          id: c.id,
          razao_social: c.razao_social,
          nome_fantasia: c.nome_fantasia,
          cnpj: c.cnpj,
          whatsapp: c.whatsapp,
          telefone: c.telefone,
          uf: c.uf,
          cidade: c.cidade,
          regime_tributario: c.regime_tributario,
          certificado_url: c.certificado_url,
          certificado_validade: c.certificado_validade,
          logo_url: c.logo_url,
          contabilidade_id: c.contabilidade_id,
          is_ativo: c.is_ativo,
          contabilidade_nome: contab?.nome_fantasia || contab?.razao_social || 'Não vinculada',
          ultima_sincronizacao_hub: hub?.ultima_sincronizacao || null
        }
      }

      if (role === 'cliente' && roleData?.cliente_id) {
        const { data: cli, error: errCli } = await supabase
          .from('clientes')
          .select(camposSelect)
          .eq('id', roleData.cliente_id)
          .maybeSingle()
        if (errCli) {
          console.warn('Erro ao carregar cliente, tentando fallback simplificado:', errCli)
          const { data: fbCli } = await supabase
            .from('clientes')
            .select('id, razao_social, nome_fantasia, cnpj, whatsapp, telefone, uf, cidade')
            .eq('id', roleData.cliente_id)
            .maybeSingle()
          if (fbCli) clisData = [fbCli as any]
        } else if (cli) {
          clisData = [formatarClienteItem(cli)]
        }
        if (clisData.length > 0) {
          _setSelectedClienteId(clisData[0].id)
          localStorage.setItem(GLOBAL_CLIENT_STORAGE_KEY, clisData[0].id)
        }
      } else if (role === 'contabilidade' && roleData?.contabilidade_id) {
        const { data: clis, error: errClis } = await supabase
          .from('clientes')
          .select(camposSelect)
          .eq('contabilidade_id', roleData.contabilidade_id)
          .order('razao_social')
        if (errClis) {
          console.warn('Erro ao carregar clientes da contabilidade, tentando fallback:', errClis)
          const { data: fbClis } = await supabase
            .from('clientes')
            .select('id, razao_social, nome_fantasia, cnpj, whatsapp, telefone, uf, cidade')
            .eq('contabilidade_id', roleData.contabilidade_id)
            .order('razao_social')
          if (fbClis) clisData = fbClis as any[]
        } else if (clis) {
          clisData = clis.map(formatarClienteItem)
        }
      } else {
        // Admin: busca todas as empresas
        const { data: clis, error: errClis } = await supabase
          .from('clientes')
          .select(camposSelect)
          .order('razao_social')
        if (errClis) {
          console.warn('Erro ao carregar clientes do admin, tentando fallback:', errClis)
          const { data: fbClis } = await supabase
            .from('clientes')
            .select('id, razao_social, nome_fantasia, cnpj, whatsapp, telefone, uf, cidade')
            .order('razao_social')
          if (fbClis) clisData = fbClis as any[]
        } else if (clis) {
          clisData = clis.map(formatarClienteItem)
        }
      }

      setClientes(clisData)

      // Carrega permissão de alternância de interface
      try {
        const { data: permTroca } = await supabase
          .from('permissoes_modulos')
          .select('permitido_cliente, permitido_contabilidade')
          .eq('modulo_chave', 'troca_modo_interface')
          .maybeSingle()

        if (permTroca) {
          const canSwitch = role === 'admin'
            ? true
            : role === 'cliente'
              ? Boolean(permTroca.permitido_cliente)
              : Boolean(permTroca.permitido_contabilidade)

          setPermitirTrocaInterface(canSwitch)

          if (!canSwitch && role !== 'admin') {
            const defMode = (localStorage.getItem('hub_interface_mode_default') as InterfaceMode) || 'clean'
            _setInterfaceMode(defMode)
          }
        }
      } catch (errPerm) {
        console.warn('Erro ao carregar permissão troca_modo_interface:', errPerm)
      }

      // Carrega configuração de cliente padrão e preferências do banco
      try {
        const { data: configGeral } = await supabase
          .from('configuracoes_portal_geral')
          .select('cliente_padrao_login, priorizar_nome_fantasia')
          .eq('id', 1)
          .maybeSingle()
        if (configGeral?.cliente_padrao_login) {
          const pref = configGeral.cliente_padrao_login as 'vazio' | 'ultimo_usado'
          setClientePadraoLoginState(pref)
          localStorage.setItem('hub_cliente_padrao_login', pref)
        }
      } catch (errConfig) {
        console.warn('Erro ao carregar configuracoes_portal_geral no GlobalClientContext:', errConfig)
      }

      // Regra de Seleção de Cliente ao Iniciar:
      _setSelectedClienteId(prev => {
        // 1. Se for perfil 'cliente', sempre seleciona a única empresa dele
        if (role === 'cliente' && clisData.length > 0) {
          return clisData[0].id
        }
        // 2. Se o usuário já selecionou ativamente uma empresa durante a navegação desta sessão, mantém
        if (prev && clisData.some(c => c.id === prev)) {
          return prev
        }
        // 3. Verifica a preferência configurada (Vazio como padrão vs Manter último usado)
        const prefPadrao = (localStorage.getItem('hub_cliente_padrao_login') as 'vazio' | 'ultimo_usado') || 'vazio'
        if (prefPadrao === 'ultimo_usado') {
          const saved = typeof window !== 'undefined' ? localStorage.getItem(GLOBAL_CLIENT_STORAGE_KEY) : null
          if (saved && clisData.some(c => c.id === saved)) {
            return saved
          }
        }
        // 4. Padrão do sistema para Admin e Contabilidade: Vazio (visão global / Todas as Empresas)
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

    const handleClientUpdated = () => {
      loadUserAndClients()
    }
    window.addEventListener('hub_client_updated', handleClientUpdated)
    return () => {
      window.removeEventListener('hub_client_updated', handleClientUpdated)
    }
  }, [loadUserAndClients])

  // Setters
  const setInterfaceMode = useCallback((mode: InterfaceMode) => {
    _setInterfaceMode(mode)
    localStorage.setItem(INTERFACE_MODE_STORAGE_KEY, mode)
    window.dispatchEvent(new Event('hub_settings_changed'))
  }, [])

  const setClientePadraoLogin = useCallback((modo: 'vazio' | 'ultimo_usado') => {
    setClientePadraoLoginState(modo)
    localStorage.setItem('hub_cliente_padrao_login', modo)
    window.dispatchEvent(new Event('hub_settings_changed'))
  }, [])

  const toggleInterfaceMode = useCallback(() => {
    if (userRole !== 'admin' && !permitirTrocaInterface) {
      toast.error('A alternância de modos de interface foi desabilitada pelo administrador.')
      return
    }
    setInterfaceMode(interfaceMode === 'clean' ? 'classico' : 'clean')
    toast(
      interfaceMode === 'clean' 
        ? 'Alternado para o Modo Clássico (banners e visual tradicional)' 
        : 'Alternado para o Modo Clean (foco em dados e busca global)', 
      { icon: interfaceMode === 'clean' ? '🏛️' : '✨' }
    )
  }, [interfaceMode, setInterfaceMode, userRole, permitirTrocaInterface])

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
    permitirTrocaInterface,
    modoPadraoInterface,
    userRole,
    loadingRole,
    clientes,
    loadingClientes,
    refreshClientes: loadUserAndClients,
    selectedClienteId,
    selectedCliente,
    setSelectedClienteId,
    clearSelectedCliente,
    priorizarNomeFantasia,
    clientePadraoLogin,
    setClientePadraoLogin
  }), [
    interfaceMode,
    setInterfaceMode,
    toggleInterfaceMode,
    permitirTrocaInterface,
    modoPadraoInterface,
    userRole,
    loadingRole,
    clientes,
    loadingClientes,
    loadUserAndClients,
    selectedClienteId,
    selectedCliente,
    setSelectedClienteId,
    clearSelectedCliente,
    priorizarNomeFantasia,
    clientePadraoLogin,
    setClientePadraoLogin
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
