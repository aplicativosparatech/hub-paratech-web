'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { 
  RefreshCw, X, Trash2, AlertTriangle, ArrowRight, 
  Calendar, Filter, Search, Clock, RotateCcw, CheckCircle2, Download 
} from 'lucide-react'
import toast from 'react-hot-toast'
import Pagination from '@/components/Pagination'

function AssinaturaChip({ ok }: { ok: boolean }) {
  return ok
    ? <span className="text-green-600 font-bold">✅</span>
    : <span className="text-red-500">❌</span>
}

function TabelaNotas({ tabela, label }: { tabela: string, label: string }) {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const clienteIdParam = searchParams.get('cliente_id')
  const [notas, setNotas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Controle de Papel e Filtro de Cliente
  const [userRole, setUserRole] = useState<'admin' | 'contabilidade' | 'cliente'>('admin')
  const [clientes, setClientes] = useState<any[]>([])
  const [selectedCliente, setSelectedCliente] = useState<string>(clienteIdParam || '')
  const [clientSearchTerm, setClientSearchTerm] = useState('')

  // Filtros Avançados solicitados pelo usuário
  const [filtroMes, setFiltroMes] = useState<string>('') // 'YYYY-MM' ou vazio
  const [dataInicio, setDataInicio] = useState<string>('') // 'YYYY-MM-DD'
  const [dataFim, setDataFim] = useState<string>('') // 'YYYY-MM-DD'
  const [buscaNumero, setBuscaNumero] = useState<string>('')
  const [buscaGeral, setBuscaGeral] = useState<string>('')

  // Paginação com registros por página configuráveis
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(25)

  // Horário da Última Sincronização do Hub e Última Consulta
  const [ultimaSincronizacaoHub, setUltimaSincronizacaoHub] = useState<string | null>(null)
  const [ultimaConsultaHora, setUltimaConsultaHora] = useState<string>('')

  // Carrega Clientes disponíveis de acordo com o perfil
  useEffect(() => {
    async function loadUserAndClients() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

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
          .select('id, razao_social, nome_fantasia, cnpj')
          .eq('id', roleData.cliente_id)
          .single()
        if (cli) setClientes([cli])
      } else if (role === 'contabilidade' && roleData?.contabilidade_id) {
        const { data: clis } = await supabase
          .from('clientes')
          .select('id, razao_social, nome_fantasia, cnpj')
          .eq('contabilidade_id', roleData.contabilidade_id)
          .order('razao_social')
        if (clis) {
          setClientes(clis)
          if (!clienteIdParam && clis.length > 0) {
            setSelectedCliente(clis[0].id)
          }
        }
      } else {
        // Admin: busca todos os clientes
        const { data: clis } = await supabase
          .from('clientes')
          .select('id, razao_social, nome_fantasia, cnpj')
          .order('razao_social')
        if (clis) {
          setClientes(clis)
          if (!clienteIdParam && clis.length > 0) {
            setSelectedCliente('') // vazio = Todos os clientes ou pode escolher um específico
          }
        }
      }
    }
    loadUserAndClients()
  }, [])

  // Carrega o horário em que o Hub sincronizou pela última vez
  async function loadUltimaSincronizacao() {
    try {
      let query = supabase.from('configuracoes_hub').select('ultima_sincronizacao')
      if (selectedCliente) {
        query = query.eq('cliente_id', selectedCliente)
      } else {
        query = query.not('ultima_sincronizacao', 'is', null).order('ultima_sincronizacao', { ascending: false }).limit(1)
      }
      const { data } = await query
      if (data && data.length > 0 && data[0].ultima_sincronizacao) {
        setUltimaSincronizacaoHub(data[0].ultima_sincronizacao)
      } else {
        setUltimaSincronizacaoHub(null)
      }
    } catch (e) {
      console.warn('Erro ao carregar ultima sincronizacao:', e)
    }
  }

  async function load() {
    setLoading(true)
    const agora = new Date()
    setUltimaConsultaHora(agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    loadUltimaSincronizacao()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role, cliente_id, contabilidade_id')
      .eq('user_id', user.id)
      .single()

    let query = supabase.from(tabela).select('*').order('data_emissao', { ascending: false })

    if (roleData?.role === 'cliente') {
      query = query.eq('cliente_id', roleData.cliente_id)
    } else if (roleData?.role === 'contabilidade') {
      if (selectedCliente) {
        query = query.eq('cliente_id', selectedCliente)
      } else {
        const { data: clis } = await supabase
          .from('clientes')
          .select('id')
          .eq('contabilidade_id', roleData.contabilidade_id)
        const ids = clis?.map((c: any) => c.id) || []
        if (ids.length === 0) { setNotas([]); setLoading(false); return }
        query = query.in('cliente_id', ids)
      }
    } else {
      // Admin: se escolheu um cliente específico, filtra por ele. Senão, mostra todos!
      if (selectedCliente) {
        query = query.eq('cliente_id', selectedCliente)
      }
    }

    const { data } = await query
    setNotas(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [tabela, selectedCliente])

  function formatDoc(doc?: string | null) {
    if (!doc) return '—'
    const clean = doc.replace(/\D/g, '')
    if (clean.length === 14) return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
    if (clean.length === 11) return clean.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
    return doc
  }

  const [modalDelete, setModalDelete] = useState<{
    open: boolean
    tipo: 'individual' | 'em_lote'
    id?: string
    numero?: string
    idsLote?: string[]
  }>({ open: false, tipo: 'individual' })
  const [deleting, setDeleting] = useState(false)

  const confirmDeleteAction = async () => {
    setDeleting(true)
    try {
      if (modalDelete.tipo === 'individual' && modalDelete.id) {
        const { error } = await supabase.from(tabela).delete().eq('id', modalDelete.id)
        if (error) throw error
        setNotas(prev => prev.filter(n => n.id !== modalDelete.id))
        toast.success(`Nota fiscal ${modalDelete.numero || ''} excluída com sucesso!`)
      } else if (modalDelete.tipo === 'em_lote' && modalDelete.idsLote) {
        const { error } = await supabase.from(tabela).delete().in('id', modalDelete.idsLote)
        if (error) throw error
        setNotas(prev => prev.filter(n => !modalDelete.idsLote!.includes(n.id)))
        toast.success(`${modalDelete.idsLote.length} notas divergentes excluídas com sucesso!`)
      }
    } catch (err: any) {
      toast.error('Erro ao excluir: ' + (err.message || 'Falha na exclusão'))
    } finally {
      setDeleting(false)
      setModalDelete({ open: false, tipo: 'individual' })
    }
  }

  const currentCli = clientes.find(c => c.id === selectedCliente) || (userRole === 'cliente' ? clientes[0] : null)
  const cleanCurrentCnpj = (currentCli?.cnpj || '').replace(/\D/g, '')

  // Separação solicitada pelo usuário:
  // Se a nota tiver erro/pendência (não autorizada pela SEFAZ, sem assinatura, divergente),
  // ela NÃO é listada nas abas normais (NFC-e e NF-e), e sim exclusivamente na nova aba "Arquivos para Correção".
  const pendentesList = notas.filter(n => {
    if (n.is_autorizada === false) return true
    if (!n.tem_assinatura) return true
    if (n.cnpj_divergente) return true
    const cleanChaveCnpj = n.chave && n.chave.length === 44 ? n.chave.substring(6, 20) : ''
    const emit = (n.cnpj_emitente || cleanChaveCnpj || '').replace(/\D/g, '')
    return Boolean(cleanCurrentCnpj) && Boolean(emit) && cleanCurrentCnpj !== emit
  })

  // Apenas notas 100% regulares e autorizadas são exibidas nas abas oficiais
  const notasOficiaisValidas = notas.filter(n => !pendentesList.some(p => p.id === n.id))

  // Formatação humanizada do horário da última sincronização do Hub
  function formatRelativeSync(dateStr?: string | null) {
    if (!dateStr) return null
    try {
      const syncDate = new Date(dateStr)
      const now = new Date()
      const diffMs = now.getTime() - syncDate.getTime()
      const diffMin = Math.floor(diffMs / (1000 * 60))
      const diffHours = Math.floor(diffMin / 60)
      const diffDays = Math.floor(diffHours / 24)

      const horaFormatada = syncDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      const dataFormatada = syncDate.toLocaleDateString('pt-BR')

      let relStr = ''
      if (diffMin < 1) relStr = 'agora mesmo'
      else if (diffMin < 60) relStr = `há ${diffMin} min`
      else if (diffHours < 24) relStr = `há ${diffHours}h`
      else relStr = `há ${diffDays}d`

      return {
        textoCompleto: `${dataFormatada} às ${horaFormatada}`,
        tempoRelativo: relStr,
        isRecente: diffMin <= 60
      }
    } catch {
      return null
    }
  }

  // Filtragem Dinâmica das Notas (por Mês, Data de Emissão, Número e Busca Geral)
  const notasFiltradas = useMemo(() => {
    return notasOficiaisValidas.filter(n => {
      // 1. Filtro por Mês de Competência (YYYY-MM)
      if (filtroMes && n.data_emissao) {
        const emissaoMes = n.data_emissao.substring(0, 7)
        if (emissaoMes !== filtroMes) return false
      }

      // 2. Filtro por Intervalo de Data de Emissão
      if (dataInicio && n.data_emissao) {
        const emissaoData = n.data_emissao.substring(0, 10)
        if (emissaoData < dataInicio) return false
      }
      if (dataFim && n.data_emissao) {
        const emissaoData = n.data_emissao.substring(0, 10)
        if (emissaoData > dataFim) return false
      }

      // 3. Filtro por Número da Nota ou Chave
      if (buscaNumero.trim()) {
        const term = buscaNumero.trim().toLowerCase()
        const num = String(n.numero || '').toLowerCase()
        const chave = String(n.chave || '').toLowerCase()
        if (!num.includes(term) && !chave.includes(term)) return false
      }

      // 4. Busca Geral (CNPJ, Emitente, Valor)
      if (buscaGeral.trim()) {
        const term = buscaGeral.trim().toLowerCase()
        const emit = String(n.cnpj_emitente || '').toLowerCase()
        const num = String(n.numero || '').toLowerCase()
        const chave = String(n.chave || '').toLowerCase()
        const valor = String(n.valor || '').toLowerCase()
        if (!emit.includes(term) && !num.includes(term) && !chave.includes(term) && !valor.includes(term)) {
          return false
        }
      }

      return true
    })
  }, [notasOficiaisValidas, filtroMes, dataInicio, dataFim, buscaNumero, buscaGeral])

  // Resetar para página 1 ao alterar qualquer filtro
  useEffect(() => {
    setCurrentPage(1)
  }, [filtroMes, dataInicio, dataFim, buscaNumero, buscaGeral, selectedCliente, pageSize])

  // Paginação dos registros filtrados
  const notasPaginadas = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return notasFiltradas.slice(start, start + pageSize)
  }, [notasFiltradas, currentPage, pageSize])

  const temFiltroAtivo = Boolean(filtroMes || dataInicio || dataFim || buscaNumero || buscaGeral)

  const limparFiltros = () => {
    setFiltroMes('')
    setDataInicio('')
    setDataFim('')
    setBuscaNumero('')
    setBuscaGeral('')
  }

  const syncInfo = formatRelativeSync(ultimaSincronizacaoHub)

  // Download Individual de XML
  const handleDownloadXml = (nota: any) => {
    try {
      const url = `/api/notas-fiscais/download-xml?tabela=${tabela}&id=${nota.id}`
      const a = document.createElement('a')
      a.href = url
      a.download = `${nota.chave || nota.numero || 'nota_fiscal'}.xml`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      toast.success(`Download do XML ${nota.numero ? 'Nº ' + nota.numero : ''} iniciado!`)
    } catch (err: any) {
      toast.error('Erro ao baixar XML: ' + (err.message || 'Falha no download'))
    }
  }

  // Consolidação Financeira e Modalidades de Pagamento (PIX, Dinheiro, Cartões, etc.)
  const resumoFinanceiro = useMemo(() => {
    let valorTotal = 0
    const formasMap: Record<string, { total: number; qtd: number }> = {}

    for (const n of notasFiltradas) {
      const vNota = Number(n.valor || 0)
      valorTotal += vNota

      if (Array.isArray(n.formas_pagamento) && n.formas_pagamento.length > 0) {
        for (const fp of n.formas_pagamento) {
          const nome = fp.nome || 'Outros'
          const v = Number(fp.valor || 0)
          if (!formasMap[nome]) formasMap[nome] = { total: 0, qtd: 0 }
          formasMap[nome].total += v
          formasMap[nome].qtd += 1
        }
      } else {
        const nome = 'Outros'
        if (!formasMap[nome]) formasMap[nome] = { total: 0, qtd: 0 }
        formasMap[nome].total += vNota
        formasMap[nome].qtd += 1
      }
    }

    return {
      valorTotal,
      formas: Object.entries(formasMap)
        .map(([nome, dados]) => ({ nome, ...dados }))
        .sort((a, b) => b.total - a.total)
    }
  }, [notasFiltradas])

  return (
    <div className="space-y-4">
      {/* Barra de Filtro de Clientes para Admin e Contabilidade */}
      {userRole !== 'cliente' && clientes.length > 0 && (
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex-1 max-w-lg space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                {userRole === 'admin' ? '🔍 Localizar Cliente (Admin)' : '🏢 Empresa Selecionada'}
              </span>
              {userRole === 'admin' && (
                <span className="text-[11px] text-blue-600 font-medium">
                  {selectedCliente ? 'Filtrado por empresa' : 'Exibindo todas as empresas'}
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              {userRole === 'admin' && (
                <input
                  type="text"
                  placeholder="Buscar por nome, CNPJ ou CPF..."
                  value={clientSearchTerm}
                  onChange={e => {
                    const term = e.target.value
                    setClientSearchTerm(term)
                    if (term.trim()) {
                      const t = term.toLowerCase().trim()
                      const ct = t.replace(/\D/g, '')
                      const match = clientes.find(c => {
                        const doc = (c.cnpj || '').toLowerCase()
                        const cleanDoc = doc.replace(/\D/g, '')
                        return (
                          (c.razao_social && c.razao_social.toLowerCase().includes(t)) ||
                          (c.nome_fantasia && c.nome_fantasia.toLowerCase().includes(t)) ||
                          doc.includes(t) ||
                          (ct && cleanDoc.includes(ct))
                        )
                      })
                      if (match && match.id !== selectedCliente) {
                        setSelectedCliente(match.id)
                      }
                    } else {
                      setSelectedCliente('')
                    }
                  }}
                  className="w-full sm:w-1/2 bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}

              <select
                value={selectedCliente}
                onChange={e => setSelectedCliente(e.target.value)}
                className={`w-full ${userRole === 'admin' ? 'sm:w-1/2' : ''} bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium`}
              >
                {userRole === 'admin' && (
                  <option value="">-- Todos os Clientes --</option>
                )}
                {clientes
                  .filter(c => {
                    if (!clientSearchTerm) return true
                    const term = clientSearchTerm.toLowerCase().trim()
                    const cleanTerm = term.replace(/\D/g, '')
                    const doc = (c.cnpj || '').toLowerCase()
                    const cleanDoc = doc.replace(/\D/g, '')
                    return (
                      (c.razao_social && c.razao_social.toLowerCase().includes(term)) ||
                      (c.nome_fantasia && c.nome_fantasia.toLowerCase().includes(term)) ||
                      doc.includes(term) ||
                      (cleanTerm && cleanDoc.includes(cleanTerm))
                    )
                  })
                  .map(c => (
                    <option key={c.id} value={c.id}>
                      {c.razao_social} {c.nome_fantasia ? `(${c.nome_fantasia})` : ''} {c.cnpj ? `— ${c.cnpj}` : ''}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col sm:items-end justify-center gap-1.5 text-right sm:self-end">
            <div className="flex flex-wrap items-center justify-end gap-2 text-xs">
              <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1 rounded-xl font-bold flex items-center gap-1 shadow-2xs">
                <span>Total:</span>
                <strong className="text-emerald-700 text-sm">
                  R$ {resumoFinanceiro.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </strong>
              </span>

              <span className="text-slate-500 bg-white border border-slate-200 px-2.5 py-1 rounded-xl font-medium">
                <strong className="text-slate-800 font-semibold">{notasFiltradas.length}</strong> {notasFiltradas.length === 1 ? 'nota oficial' : 'notas oficiais'}
              </span>
            </div>

            {/* Modalidades de Pagamento (PIX, Dinheiro, Cartões, etc.) */}
            {resumoFinanceiro.formas.length > 0 && (
              <div className="flex flex-wrap items-center justify-end gap-1.5 text-[11px] mt-0.5">
                {resumoFinanceiro.formas.map(fp => {
                  let badgeColor = 'bg-slate-50 text-slate-700 border-slate-200'
                  let icon = '🏷️'
                  const nomeLower = fp.nome.toLowerCase()
                  if (nomeLower.includes('pix')) {
                    badgeColor = 'bg-teal-50 text-teal-800 border-teal-200'
                    icon = '⚡'
                  } else if (nomeLower.includes('dinheiro')) {
                    badgeColor = 'bg-green-50 text-green-800 border-green-200'
                    icon = '💵'
                  } else if (nomeLower.includes('crédito') || nomeLower.includes('credito')) {
                    badgeColor = 'bg-blue-50 text-blue-800 border-blue-200'
                    icon = '💳'
                  } else if (nomeLower.includes('débito') || nomeLower.includes('debito')) {
                    badgeColor = 'bg-sky-50 text-sky-800 border-sky-200'
                    icon = '💳'
                  } else if (nomeLower.includes('boleto')) {
                    badgeColor = 'bg-amber-50 text-amber-800 border-amber-200'
                    icon = '📄'
                  } else if (nomeLower.includes('depósito') || nomeLower.includes('transferência')) {
                    badgeColor = 'bg-purple-50 text-purple-800 border-purple-200'
                    icon = '🏦'
                  }

                  return (
                    <span 
                      key={fp.nome} 
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border font-medium ${badgeColor}`}
                      title={`${fp.nome}: R$ ${fp.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${fp.qtd} notas)`}
                    >
                      <span>{icon} {fp.nome}:</span>
                      <strong className="font-bold">
                        R$ {fp.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </strong>
                    </span>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Banner Informativo de Redirecionamento para a Aba de Correção */}
      {pendentesList.length > 0 && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-950 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="font-bold text-sm text-amber-900">
                {pendentesList.length} {pendentesList.length === 1 ? 'arquivo com pendência foi movido' : 'arquivos com pendências foram movidos'} para a aba de Correção!
              </p>
              <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                Para manter a escrituração contábil 100% segura, notas sem protocolo da SEFAZ, sem assinatura ou divergentes são listadas exclusivamente em <strong>Arquivos para Correção</strong>.
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/notas-fiscais/saidas/correcao"
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition shadow whitespace-nowrap flex items-center justify-center gap-1.5 shrink-0"
          >
            <span>Ir para Correção ({pendentesList.length})</span>
            <ArrowRight size={15} />
          </Link>
        </div>
      )}

      {/* Identificação de Empresa e Resumo Financeiro para o perfil Cliente */}
      {userRole === 'cliente' && clientes.length > 0 && (
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="text-xs text-slate-700 font-medium">
            Empresa Titular: <strong className="text-slate-900">{clientes[0].razao_social}</strong> ({clientes[0].cnpj})
          </div>

          <div className="flex flex-col sm:items-end justify-center gap-1.5 text-right sm:self-end">
            <div className="flex flex-wrap items-center justify-end gap-2 text-xs">
              <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1 rounded-xl font-bold flex items-center gap-1 shadow-2xs">
                <span>Total:</span>
                <strong className="text-emerald-700 text-sm">
                  R$ {resumoFinanceiro.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </strong>
              </span>

              <span className="text-slate-500 bg-white border border-slate-200 px-2.5 py-1 rounded-xl font-medium">
                <strong className="text-slate-800 font-semibold">{notasFiltradas.length}</strong> {notasFiltradas.length === 1 ? 'nota oficial' : 'notas oficiais'}
              </span>
            </div>

            {/* Modalidades de Pagamento (PIX, Dinheiro, Cartões, etc.) */}
            {resumoFinanceiro.formas.length > 0 && (
              <div className="flex flex-wrap items-center justify-end gap-1.5 text-[11px] mt-0.5">
                {resumoFinanceiro.formas.map(fp => {
                  let badgeColor = 'bg-slate-50 text-slate-700 border-slate-200'
                  let icon = '🏷️'
                  const nomeLower = fp.nome.toLowerCase()
                  if (nomeLower.includes('pix')) {
                    badgeColor = 'bg-teal-50 text-teal-800 border-teal-200'
                    icon = '⚡'
                  } else if (nomeLower.includes('dinheiro')) {
                    badgeColor = 'bg-green-50 text-green-800 border-green-200'
                    icon = '💵'
                  } else if (nomeLower.includes('crédito') || nomeLower.includes('credito')) {
                    badgeColor = 'bg-blue-50 text-blue-800 border-blue-200'
                    icon = '💳'
                  } else if (nomeLower.includes('débito') || nomeLower.includes('debito')) {
                    badgeColor = 'bg-sky-50 text-sky-800 border-sky-200'
                    icon = '💳'
                  } else if (nomeLower.includes('boleto')) {
                    badgeColor = 'bg-amber-50 text-amber-800 border-amber-200'
                    icon = '📄'
                  } else if (nomeLower.includes('depósito') || nomeLower.includes('transferência')) {
                    badgeColor = 'bg-purple-50 text-purple-800 border-purple-200'
                    icon = '🏦'
                  }

                  return (
                    <span 
                      key={fp.nome} 
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border font-medium ${badgeColor}`}
                      title={`${fp.nome}: R$ ${fp.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${fp.qtd} notas)`}
                    >
                      <span>{icon} {fp.nome}:</span>
                      <strong className="font-bold">
                        R$ {fp.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </strong>
                    </span>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* CABEÇALHO COM HORÁRIO DA ÚLTIMA SINCRONIZAÇÃO E ATUALIZAÇÃO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-slate-100">
        <div>
          <h2 className="text-xl font-bold text-slate-800">{label}</h2>
          <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-500">
            {/* Horário da Última Sincronização do Hub */}
            <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-lg">
              <Clock size={13} className="text-blue-600" />
              <span>
                Última sincronização do Hub:{' '}
                {syncInfo ? (
                  <strong className="text-slate-800 font-semibold" title={syncInfo.textoCompleto}>
                    {syncInfo.textoCompleto} <span className="text-blue-600 font-bold">({syncInfo.tempoRelativo})</span>
                  </strong>
                ) : (
                  <span className="text-slate-400 italic">Aguardando primeira sincronização</span>
                )}
              </span>
            </div>

            {/* Consulta em tela */}
            {ultimaConsultaHora && (
              <span className="text-slate-400">
                Consulta atualizada às <strong className="text-slate-600">{ultimaConsultaHora}</strong>
              </span>
            )}
          </div>
        </div>

        <button 
          onClick={load} 
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition disabled:opacity-50 self-start sm:self-auto"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> 
          Atualizar Dados
        </button>
      </div>

      {/* PAINEL DE FILTROS AVANÇADOS: MÊS, DATA, NÚMERO E BUSCA */}
      <div className="bg-slate-50/90 p-3.5 rounded-2xl border border-slate-200 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Filter size={14} className="text-blue-600" />
            Filtros de Notas Fiscais
          </span>

          {temFiltroAtivo && (
            <button
              onClick={limparFiltros}
              className="text-xs text-rose-600 hover:text-rose-800 font-bold flex items-center gap-1 transition"
            >
              <RotateCcw size={12} /> Limpar Filtros
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* 1. Mês de Competência */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
              Mês de Competência:
            </label>
            <div className="flex items-center gap-1">
              <input
                type="month"
                value={filtroMes}
                onChange={e => setFiltroMes(e.target.value)}
                className="w-full bg-white border border-slate-200 px-2.5 py-1.5 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              />
              {filtroMes && (
                <button
                  onClick={() => setFiltroMes('')}
                  title="Remover filtro de mês"
                  className="p-1.5 text-slate-400 hover:text-slate-600 bg-white rounded-lg border border-slate-200"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* 2. Data de Emissão (De/Até) */}
          <div className="sm:col-span-1 md:col-span-1">
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
              Período de Emissão:
            </label>
            <div className="flex items-center gap-1">
              <input
                type="date"
                placeholder="De"
                value={dataInicio}
                onChange={e => setDataInicio(e.target.value)}
                className="w-1/2 bg-white border border-slate-200 px-2 py-1.5 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              />
              <span className="text-slate-400 text-xs">até</span>
              <input
                type="date"
                placeholder="Até"
                value={dataFim}
                onChange={e => setDataFim(e.target.value)}
                className="w-1/2 bg-white border border-slate-200 px-2 py-1.5 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              />
            </div>
          </div>

          {/* 3. Número da Nota ou Chave */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
              Nº da Nota ou Chave:
            </label>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Ex: 44086 ou chave..."
                value={buscaNumero}
                onChange={e => setBuscaNumero(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              />
            </div>
          </div>

          {/* 4. Busca Geral */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
              Busca Textual (CNPJ / Valor):
            </label>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por CNPJ, valor..."
                value={buscaGeral}
                onChange={e => setBuscaGeral(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              />
            </div>
          </div>
        </div>

        {/* Resumo do Filtro Ativo */}
        {temFiltroAtivo && (
          <div className="flex items-center gap-2 pt-1 text-xs text-slate-500">
            <span>Resultados encontrados: <strong className="text-blue-600 font-bold">{notasFiltradas.length}</strong> de {notasOficiaisValidas.length} notas oficiais</span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-slate-400 py-8 text-center animate-pulse">Carregando notas...</div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-2xs bg-white">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
              <tr>
                <th className="p-4">Número</th>
                <th className="p-4">Chave de Acesso</th>
                <th className="p-4">Emitente (CNPJ / CPF)</th>
                <th className="p-4">Valor (R$)</th>
                <th className="p-4">Emissão</th>
                <th className="p-4">Transmissão</th>
                <th className="p-4 text-center">Assinatura</th>
                <th className="p-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {notasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    {temFiltroAtivo 
                      ? 'Nenhuma nota encontrada com os filtros selecionados. Tente ajustar os parâmetros ou limpar os filtros.' 
                      : 'Nenhuma nota encontrada. O Hub ainda não enviou dados para esta seção.'}
                  </td>
                </tr>
              ) : notasPaginadas.map(n => {
                const cleanChaveCnpj = n.chave && n.chave.length === 44 ? n.chave.substring(6, 20) : ''
                const emitenteDoc = n.cnpj_emitente || cleanChaveCnpj
                const cleanEmit = (emitenteDoc || '').replace(/\D/g, '')
                const isDivergente = Boolean(n.cnpj_divergente) || (Boolean(cleanCurrentCnpj) && Boolean(cleanEmit) && cleanCurrentCnpj !== cleanEmit)

                return (
                  <tr 
                    key={n.id} 
                    className={`border-b transition ${isDivergente ? 'bg-red-50 hover:bg-red-100/90 text-red-900 border-red-200' : 'border-slate-100 hover:bg-slate-50'}`}
                  >
                    <td className="p-4 font-mono">
                      <div className="flex items-center gap-2">
                        <span className={isDivergente ? 'font-bold text-red-700' : ''}>{n.numero || '—'}</span>
                        {isDivergente && (
                          <span 
                            className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-sm"
                            title={n.motivo_divergencia || 'Emitente não pertence à empresa cadastrada'}
                          >
                            ⚠️ Não Pertence à Empresa
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 font-mono text-xs text-slate-500" title={n.chave}>
                      {n.chave ? n.chave.substring(0, 22) + '...' : '—'}
                    </td>
                    <td className="p-4 font-mono text-xs">
                      <div className={isDivergente ? 'text-red-700 font-bold' : ''}>
                        {formatDoc(emitenteDoc)}
                      </div>
                      {isDivergente && (
                        <div className="text-[11px] text-red-600 mt-0.5 font-sans max-w-xs" title={n.motivo_divergencia || 'Emitente diverge da empresa atual'}>
                          {n.motivo_divergencia || `CNPJ na nota (${formatDoc(emitenteDoc)}) diverge da empresa (${formatDoc(currentCli?.cnpj)})`}
                        </div>
                      )}
                    </td>
                    <td className="p-4 font-medium">R$ {Number(n.valor || 0).toFixed(2)}</td>
                    <td className="p-4">{n.data_emissao ? new Date(n.data_emissao).toLocaleDateString('pt-BR') : '—'}</td>
                    <td className="p-4">{n.data_transmissao ? new Date(n.data_transmissao).toLocaleDateString('pt-BR') : '—'}</td>
                    <td className="p-4 text-center"><AssinaturaChip ok={n.tem_assinatura} /></td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleDownloadXml(n)}
                          className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-100 hover:text-blue-800 transition"
                          title="Baixar Arquivo XML"
                        >
                          <Download size={15} />
                        </button>
                        <button 
                          onClick={() => setModalDelete({ open: true, tipo: 'individual', id: n.id, numero: n.numero })}
                          className="p-1.5 rounded-lg text-red-500 hover:bg-red-100 hover:text-red-700 transition" 
                          title="Excluir XML"
                        >
                          <span className="font-bold text-sm">✕</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Paginação de Registros */}
          <Pagination
            currentPage={currentPage}
            totalItems={notasFiltradas.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            itemLabel="notas oficiais"
          />
        </div>
      )}

      {/* Modal Centralizado de Confirmação de Exclusão */}
      {modalDelete.open && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 sm:p-7 border border-slate-100 animate-in zoom-in-95 duration-200 relative">
            <button
              onClick={() => setModalDelete({ open: false, tipo: 'individual' })}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-3.5 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center border border-red-100 shrink-0">
                <Trash2 size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {modalDelete.tipo === 'em_lote' ? 'Excluir Notas Divergentes' : 'Excluir Nota Fiscal'}
                </h3>
                <p className="text-xs text-slate-500">Ação irreversível de limpeza</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed mb-6">
              {modalDelete.tipo === 'em_lote' ? (
                <>
                  Tem certeza que deseja excluir permanentemente todas as <strong className="text-red-600 font-semibold">{modalDelete.idsLote?.length} notas fiscais divergentes</strong>? Elas serão removidas do Portal e dos relatórios fiscais.
                </>
              ) : (
                <>
                  Tem certeza que deseja excluir a nota fiscal número <strong className="text-red-600 font-semibold">{modalDelete.numero || 'selecionada'}</strong>? Esta ação removerá o registro e o arquivo XML associado.
                </>
              )}
            </p>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setModalDelete({ open: false, tipo: 'individual' })}
                disabled={deleting}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold text-sm transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteAction}
                disabled={deleting}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-sm transition shadow-sm hover:shadow disabled:opacity-50 flex items-center gap-2"
              >
                <Trash2 size={16} />
                {deleting ? 'Excluindo...' : (modalDelete.tipo === 'em_lote' ? 'Sim, Excluir Todas' : 'Sim, Excluir Nota')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TabelaNotas
