'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useSearchParams } from 'next/navigation'
import { RefreshCw, Trash2, AlertTriangle, Sparkles, Sliders, CheckCircle2, ShieldAlert, FileText, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'
import Link from 'next/link'

export default function TabelaCorrecao() {
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

  // Modais
  const [modalManual, setModalManual] = useState<{
    open: boolean
    nota?: any
    nProt: string
    dhRecbto: string
    digVal: string
    verAplic: string
  }>({
    open: false,
    nProt: '',
    dhRecbto: '',
    digVal: '',
    verAplic: 'W-1.5.11'
  })

  const [modalDelete, setModalDelete] = useState<{
    open: boolean
    tipo: 'individual' | 'em_lote'
    id?: string
    tabela?: string
    numero?: string
    idsLote?: { id: string; tabela: string }[]
  }>({ open: false, tipo: 'individual' })

  const [corrigindoId, setCorrigindoId] = useState<string | null>(null)
  const [processandoLote, setProcessandoLote] = useState(false)
  const [salvandoManual, setSalvandoManual] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Carrega Clientes disponíveis
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
          .select('id, razao_social, nome_fantasia, cnpj, certificado_url')
          .eq('id', roleData.cliente_id)
          .single()
        if (cli) setClientes([cli])
      } else if (role === 'contabilidade' && roleData?.contabilidade_id) {
        const { data: clis } = await supabase
          .from('clientes')
          .select('id, razao_social, nome_fantasia, cnpj, certificado_url')
          .eq('contabilidade_id', roleData.contabilidade_id)
          .order('razao_social')
        if (clis) {
          setClientes(clis)
          if (!clienteIdParam && clis.length > 0) {
            setSelectedCliente(clis[0].id)
          }
        }
      } else {
        const { data: clis } = await supabase
          .from('clientes')
          .select('id, razao_social, nome_fantasia, cnpj, certificado_url')
          .order('razao_social')
        if (clis) {
          setClientes(clis)
        }
      }
    }
    loadUserAndClients()
  }, [])

  // Carrega notas com pendências de correção (nfce_saidas e nfe_saidas)
  async function loadNotas() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role, cliente_id, contabilidade_id')
      .eq('user_id', user.id)
      .single()

    let clienteIds: string[] = []
    if (roleData?.role === 'cliente') {
      clienteIds = [roleData.cliente_id]
    } else if (roleData?.role === 'contabilidade') {
      if (selectedCliente) {
        clienteIds = [selectedCliente]
      } else {
        const { data: clis } = await supabase
          .from('clientes')
          .select('id')
          .eq('contabilidade_id', roleData.contabilidade_id)
        clienteIds = clis?.map((c: any) => c.id) || []
      }
    } else {
      if (selectedCliente) {
        clienteIds = [selectedCliente]
      }
    }

    // Busca em nfce_saidas
    let queryNfce = supabase.from('nfce_saidas').select('*').order('data_emissao', { ascending: false })
    if (clienteIds.length > 0) queryNfce = queryNfce.in('cliente_id', clienteIds)

    // Busca em nfe_saidas
    let queryNfe = supabase.from('nfe_saidas').select('*').order('data_emissao', { ascending: false })
    if (clienteIds.length > 0) queryNfe = queryNfe.in('cliente_id', clienteIds)

    const [resNfce, resNfe] = await Promise.all([queryNfce, queryNfe])

    const currentCli = clientes.find(c => c.id === selectedCliente) || (userRole === 'cliente' ? clientes[0] : null)
    const cleanCurrentCnpj = (currentCli?.cnpj || '').replace(/\D/g, '')

    const pendentesNfce = (resNfce.data || [])
      .filter((n: any) => {
        const cleanChaveCnpj = n.chave && n.chave.length === 44 ? n.chave.substring(6, 20) : ''
        const emit = (n.cnpj_emitente || cleanChaveCnpj || '').replace(/\D/g, '')
        const isDivergente = Boolean(cleanCurrentCnpj) && Boolean(emit) && cleanCurrentCnpj !== emit
        return n.is_autorizada === false || !n.tem_assinatura || n.cnpj_divergente || isDivergente
      })
      .map((n: any) => ({ ...n, _tabela: 'nfce_saidas', _tipo: 'NFC-e (Mod 65)' }))

    const pendentesNfe = (resNfe.data || [])
      .filter((n: any) => {
        const cleanChaveCnpj = n.chave && n.chave.length === 44 ? n.chave.substring(6, 20) : ''
        const emit = (n.cnpj_emitente || cleanChaveCnpj || '').replace(/\D/g, '')
        const isDivergente = Boolean(cleanCurrentCnpj) && Boolean(emit) && cleanCurrentCnpj !== emit
        return n.is_autorizada === false || !n.tem_assinatura || n.cnpj_divergente || isDivergente
      })
      .map((n: any) => ({ ...n, _tabela: 'nfe_saidas', _tipo: 'NF-e (Mod 55)' }))

    setNotas([...pendentesNfce, ...pendentesNfe])
    setLoading(false)
  }

  useEffect(() => {
    loadNotas()
  }, [selectedCliente])

  // Ação 1: Consultar e Corrigir via SEFAZ
  const handleCorrigirSefaz = async (nota: any) => {
    setCorrigindoId(nota.id)
    const toastId = toast.loading(`Consultando SEFAZ para a nota ${nota.numero || nota.chave.substring(25, 34)}...`)

    try {
      const res = await fetch('/api/sefaz/corrigir-nota', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nota_id: nota.id,
          tabela: nota._tabela
        })
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || `SEFAZ: ${data.xMotivo || 'Falha na consulta'}`)
      }

      toast.success(data.message || 'Nota autorizada e corrigida com sucesso!', { id: toastId })
      // Remove da lista de correção
      setNotas(prev => prev.filter(n => n.id !== nota.id))
    } catch (err: any) {
      toast.error(err.message || 'Erro ao consultar SEFAZ', { id: toastId })
      loadNotas()
    } finally {
      setCorrigindoId(null)
    }
  }

  // Ação 2: Corrigir Todas via SEFAZ em Lote
  const handleCorrigirLote = async () => {
    if (notas.length === 0) return
    setProcessandoLote(true)
    const toastId = toast.loading(`Iniciando consulta e correção de ${notas.length} notas na SEFAZ...`)

    let sucesso = 0
    let falhas = 0

    for (const nota of notas) {
      try {
        const res = await fetch('/api/sefaz/corrigir-nota', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nota_id: nota.id,
            tabela: nota._tabela
          })
        })
        const data = await res.json()
        if (res.ok && data.success) {
          sucesso++
        } else {
          falhas++
        }
      } catch {
        falhas++
      }
    }

    setProcessandoLote(false)
    if (sucesso > 0) {
      toast.success(`${sucesso} nota(s) corrigida(s) e autorizada(s) via SEFAZ!`, { id: toastId })
    } else {
      toast.error(`Nenhuma nota pôde ser autorizada pela SEFAZ (${falhas} falhas). Verifique o certificado ou situação na SEFAZ.`, { id: toastId })
    }
    loadNotas()
  }

  // Ação 3: Salvar Correção Manual
  const handleSalvarManual = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!modalManual.nota) return

    setSalvandoManual(true)
    const toastId = toast.loading('Assinando e anexando protocolo ao XML...')

    try {
      const res = await fetch('/api/sefaz/corrigir-nota', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nota_id: modalManual.nota.id,
          tabela: modalManual.nota._tabela,
          manualData: {
            nProt: modalManual.nProt,
            dhRecbto: modalManual.dhRecbto,
            digVal: modalManual.digVal,
            verAplic: modalManual.verAplic,
            cStat: '100',
            xMotivo: 'Autorizado o uso da NF-e'
          }
        })
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erro ao processar correção manual.')
      }

      toast.success('XML corrigido, assinado e aprovado com sucesso!', { id: toastId })
      setNotas(prev => prev.filter(n => n.id !== modalManual.nota.id))
      setModalManual({ open: false, nProt: '', dhRecbto: '', digVal: '', verAplic: 'W-1.5.11' })
    } catch (err: any) {
      toast.error(err.message || 'Falha ao salvar correção manual.', { id: toastId })
    } finally {
      setSalvandoManual(false)
    }
  }

  // Ação 4: Excluir
  const confirmDeleteAction = async () => {
    setDeleting(true)
    try {
      if (modalDelete.tipo === 'individual' && modalDelete.id && modalDelete.tabela) {
        const { error } = await supabase.from(modalDelete.tabela).delete().eq('id', modalDelete.id)
        if (error) throw error
        setNotas(prev => prev.filter(n => n.id !== modalDelete.id))
        toast.success(`Nota fiscal ${modalDelete.numero || ''} excluída com sucesso!`)
      } else if (modalDelete.tipo === 'em_lote' && modalDelete.idsLote) {
        for (const item of modalDelete.idsLote) {
          await supabase.from(item.tabela).delete().eq('id', item.id)
        }
        setNotas([])
        toast.success(`${modalDelete.idsLote.length} arquivos incorretos excluídos com sucesso!`)
      }
    } catch (err: any) {
      toast.error('Erro ao excluir: ' + (err.message || 'Falha na exclusão'))
    } finally {
      setDeleting(false)
      setModalDelete({ open: false, tipo: 'individual' })
    }
  }

  const currentCli = clientes.find(c => c.id === selectedCliente) || (userRole === 'cliente' ? clientes[0] : null)

  return (
    <div className="space-y-4">
      {/* Barra de Filtro de Clientes */}
      {userRole !== 'cliente' && clientes.length > 0 && (
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex-1 max-w-lg space-y-1">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
              {userRole === 'admin' ? '🔍 Localizar Cliente (Admin)' : '🏢 Empresa Selecionada'}
            </span>
            <div className="flex flex-col sm:flex-row gap-2">
              <input 
                type="text" 
                placeholder="Filtrar por nome, fantasia ou CNPJ..." 
                value={clientSearchTerm}
                onChange={e => setClientSearchTerm(e.target.value)}
                className="w-full sm:w-1/2 bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              />
              <select
                value={selectedCliente}
                onChange={e => setSelectedCliente(e.target.value)}
                className="w-full sm:w-1/2 bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              >
                {userRole === 'admin' && <option value="">-- Todos os Clientes --</option>}
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
                      {c.razao_social} {c.nome_fantasia ? `(${c.nome_fantasia})` : ''}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="text-xs text-slate-500 text-right sm:self-end">
            <span className="font-semibold text-amber-700">{notas.length}</span> arquivo(s) aguardando correção
          </div>
        </div>
      )}

      {/* Banner Informativo Explicando o Funcionamento */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-amber-950 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 bg-amber-100 text-amber-700 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
            <AlertTriangle size={22} />
          </div>
          <div>
            <h3 className="font-bold text-sm text-amber-900">
              Quarentena de Arquivos: Notas Incompletas ou Divergentes
            </h3>
            <p className="text-xs text-amber-800 mt-1 leading-relaxed">
              Estes arquivos foram recebidos pelo Hub porém <strong>não possuem protocolo oficial da SEFAZ (&lt;protNFe&gt;) ou assinatura digital</strong> (comuns em rascunhos de PDV, pré-vendas ou contingências).
              <br />
              Para não contaminar os relatórios contábeis, eles são mantidos isolados aqui até serem corrigidos ou excluídos.
            </p>
          </div>
        </div>

        {notas.length > 0 && (
          <div className="flex flex-wrap gap-2 w-full md:w-auto justify-end">
            <button
              onClick={handleCorrigirLote}
              disabled={processandoLote}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-2"
              title="Consulta automaticamente a SEFAZ de todas as notas da lista para obter protocolo e assinar"
            >
              <Sparkles size={16} className={processandoLote ? 'animate-spin' : ''} />
              {processandoLote ? 'Processando Lote...' : `Corrigir Todas via SEFAZ (${notas.length})`}
            </button>
            <button
              onClick={() => setModalDelete({ 
                open: true, 
                tipo: 'em_lote', 
                idsLote: notas.map(n => ({ id: n.id, tabela: n._tabela })) 
              })}
              className="px-4 py-2.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
            >
              <Trash2 size={16} /> Excluir Todas
            </button>
          </div>
        )}
      </div>

      {/* Cabeçalho da Tabela */}
      <div className="flex justify-between items-center pt-2">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <span>Arquivos para Correção Fiscal</span>
            <span className="text-xs bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full font-bold">
              {notas.length} pendente(s)
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Ao serem corrigidas com protocolo e assinatura, as notas serão transferidas automaticamente para as abas oficiais <strong>NF-e (Mod 55)</strong> ou <strong>NFC-e (Mod 65)</strong>.
          </p>
        </div>
        <button onClick={loadNotas} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition">
          <RefreshCw size={16} /> Atualizar
        </button>
      </div>

      {/* Tabela de Arquivos para Correção */}
      {loading ? (
        <div className="text-slate-400 py-12 text-center animate-pulse">Carregando arquivos pendentes...</div>
      ) : notas.length === 0 ? (
        <div className="text-center py-16 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 size={30} />
          </div>
          <h3 className="font-bold text-slate-800 text-base">Nenhum arquivo pendente de correção!</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Todos os XMLs importados no sistema estão com assinatura digital válida e autorização confirmada pela SEFAZ.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-2xl">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
              <tr>
                <th className="p-4">Tipo</th>
                <th className="p-4">Número / Série</th>
                <th className="p-4">Chave de Acesso</th>
                <th className="p-4">Valor (R$)</th>
                <th className="p-4">Emissão</th>
                <th className="p-4">Diagnóstico da Pendência</th>
                <th className="p-4 text-center">Ações de Correção</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {notas.map(n => {
                const isCorrigindo = corrigindoId === n.id
                return (
                  <tr key={n.id} className="hover:bg-amber-50/40 transition">
                    <td className="p-4 font-bold text-slate-800 text-xs">
                      <span className="px-2 py-1 bg-slate-100 rounded-md border border-slate-200">
                        {n._tipo}
                      </span>
                    </td>
                    <td className="p-4 font-mono font-bold text-slate-900">
                      Nº {n.numero || 'S/N'} <span className="text-slate-400 font-normal text-xs">(Série {n.serie || 1})</span>
                    </td>
                    <td className="p-4 font-mono text-xs text-slate-600 select-all">
                      {n.chave}
                    </td>
                    <td className="p-4 font-semibold text-slate-900">
                      R$ {Number(n.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-4 text-xs text-slate-500">
                      {n.data_emissao ? new Date(n.data_emissao).toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1 text-xs">
                        {!n.tem_assinatura && (
                          <span className="inline-flex items-center gap-1 text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md font-medium w-fit">
                            ❌ Sem Assinatura Digital
                          </span>
                        )}
                        {!n.is_autorizada && (
                          <span className="inline-flex items-center gap-1 text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md font-medium w-fit">
                            ⚠️ Sem Protocolo SEFAZ
                          </span>
                        )}
                        {n.cstat && n.cstat !== '100' && (
                          <span className="text-[11px] text-slate-500 font-mono">
                            Status SEFAZ: {n.cstat} {n.motivo_sefaz ? `(${n.motivo_sefaz})` : ''}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {/* Botão Consultar SEFAZ */}
                        <button
                          onClick={() => handleCorrigirSefaz(n)}
                          disabled={isCorrigindo}
                          className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold border border-blue-200 transition flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
                          title="Consulta a situação desta chave na SEFAZ e anexa o protocolo/assinatura automaticamente"
                        >
                          <Sparkles size={14} className={isCorrigindo ? 'animate-spin' : ''} />
                          {isCorrigindo ? 'Consultando...' : 'Consultar SEFAZ'}
                        </button>

                        {/* Botão Correção Manual */}
                        <button
                          onClick={() => setModalManual({
                            open: true,
                            nota: n,
                            nProt: n.protocolo || '',
                            dhRecbto: n.data_transmissao || n.data_emissao || new Date().toISOString(),
                            digVal: '',
                            verAplic: 'W-1.5.11'
                          })}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 transition flex items-center gap-1"
                          title="Digitar manualmente protocolo e data/hora (estilo AssinaXML)"
                        >
                          <Sliders size={14} />
                          Manual
                        </button>

                        {/* Botão Excluir */}
                        <button
                          onClick={() => setModalDelete({
                            open: true,
                            tipo: 'individual',
                            id: n.id,
                            tabela: n._tabela,
                            numero: n.numero
                          })}
                          className="p-1.5 text-slate-400 hover:text-red-600 transition rounded-lg hover:bg-red-50"
                          title="Excluir este arquivo"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL CENTRALIZADO: Correção Manual (Estilo AssinaXML) */}
      {modalManual.open && modalManual.nota && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-100">
              <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                <Sliders size={22} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Correção Manual de XML</h3>
                <p className="text-xs text-slate-500">
                  Preencha os dados oficiais da SEFAZ para assinar e anexar o protocolo ao arquivo.
                </p>
              </div>
            </div>

            <form onSubmit={handleSalvarManual} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Chave de Acesso (44 Dígitos)</label>
                <input
                  type="text"
                  readOnly
                  value={modalManual.nota.chave}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-700"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Número do Protocolo <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 131241851090029"
                    value={modalManual.nProt}
                    onChange={e => setModalManual({ ...modalManual, nProt: e.target.value.trim() })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Data/Hora do Recibo <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="2026-09-30T19:32:22-03:00"
                    value={modalManual.dhRecbto}
                    onChange={e => setModalManual({ ...modalManual, dhRecbto: e.target.value.trim() })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    DigestValue <span className="text-slate-400 font-normal">(Opcional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Calculado automaticamente"
                    value={modalManual.digVal}
                    onChange={e => setModalManual({ ...modalManual, digVal: e.target.value.trim() })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Se vazio, calcula o SHA1 canônico</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Versão Aplicativo SEFAZ
                  </label>
                  <input
                    type="text"
                    value={modalManual.verAplic}
                    onChange={e => setModalManual({ ...modalManual, verAplic: e.target.value.trim() })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3 justify-end border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalManual({ open: false, nProt: '', dhRecbto: '', digVal: '', verAplic: 'W-1.5.11' })}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoManual}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs transition shadow-sm flex items-center gap-1.5"
                >
                  {salvandoManual ? 'Processando...' : 'Assinar e Concluir'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CENTRALIZADO: Exclusão */}
      {modalDelete.open && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-slate-100 text-center animate-in fade-in zoom-in-95 duration-150">
            <div className="w-14 h-14 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Trash2 size={28} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Excluir Arquivo</h3>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              {modalDelete.tipo === 'individual'
                ? `Deseja realmente excluir a nota ${modalDelete.numero ? `número ${modalDelete.numero}` : ''}?`
                : `Deseja realmente excluir todos os ${modalDelete.idsLote?.length} arquivos incorretos?`}
              <br /><span className="text-xs text-red-500 font-medium mt-1 block">Esta ação é irreversível.</span>
            </p>
            <div className="flex gap-3 justify-center">
              <button
                type="button"
                onClick={() => setModalDelete({ open: false, tipo: 'individual' })}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={confirmDeleteAction}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 transition shadow-sm disabled:opacity-50"
              >
                {deleting ? 'Excluindo...' : 'Sim, Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
