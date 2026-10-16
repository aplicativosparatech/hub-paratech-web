'use client'

import { useEffect, useState, useMemo } from 'react'
import { 
  AlertTriangle, CheckCircle2, RefreshCw, Zap, ShieldAlert, 
  Search, Filter, Check, Clock, FileText, ExternalLink, HelpCircle,
  FileCheck, ShieldCheck, ChevronRight, X, Play, CheckSquare, Square,
  AlertOctagon, ArrowRight
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useNotasFiscaisFilters } from './NotasFiscaisFilterContext'
import { formatarCnpjCpf } from '@/utils/cnpjAlfanumerico'

interface GapItem {
  id: string
  modelo: string
  serie: string
  nNFIni: number
  nNFFin: number
  quantidade: number
  ano: string
  status: 'PENDENTE' | 'HOMOLOGADO' | 'UTILIZADA_SEFAZ'
  motivo: string
  protocolo?: string
  data_registro?: string
  ultimaEmissaoProxima?: string
}

interface ErroProcessamentoItem {
  id: string
  modelo: string
  serie: string
  nNFIni: number
  nNFFin: number
  codigo: string
  motivo: string
  dataHora: string
}

export default function TabelaInutilizacao() {
  const {
    userRole,
    clientes,
    loadingClientes,
    selectedCliente,
    setSelectedCliente
  } = useNotasFiscaisFilters()

  const [clienteAtualId, setClienteAtualId] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [gaps, setGaps] = useState<GapItem[]>([])
  const [historico, setHistorico] = useState<any[]>([])
  const [errosProcessamento, setErrosProcessamento] = useState<ErroProcessamentoItem[]>([])
  const [selectedGapIds, setSelectedGapIds] = useState<string[]>([])

  const [resumo, setResumo] = useState({
    totalGaps: 0,
    totalNumerosFaltantes: 0,
    pendentes: 0,
    homologadas: 0,
    utilizadasSefaz: 0
  })
  const [clienteInfo, setClienteInfo] = useState<{
    razao_social?: string
    cnpj?: string
    uf?: string
    tem_certificado?: boolean
  } | null>(null)

  // Filtros Locais
  const [filtroModelo, setFiltroModelo] = useState<'todos' | '55' | '65'>('todos')
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'PENDENTE' | 'HOMOLOGADO' | 'UTILIZADA_SEFAZ'>('todos')
  const [buscaTermo, setBuscaTermo] = useState('')
  const [abaExibicao, setAbaExibicao] = useState<'gaps' | 'historico' | 'erros'>('gaps')

  // Modais e Estados de Ação
  const [modalInutilizar, setModalInutilizar] = useState<{
    open: boolean
    gap: GapItem | null
    justificativa: string
  }>({
    open: false,
    gap: null,
    justificativa: 'Quebra de sequencia numerica do sistema emissor'
  })

  const [modalMassa, setModalMassa] = useState<{
    open: boolean
    justificativa: string
  }>({
    open: false,
    justificativa: 'Quebra de sequencia numerica do sistema emissor'
  })

  const [modalAjudaSefaz, setModalAjudaSefaz] = useState<{
    open: boolean
    gap: GapItem | null
  }>({
    open: false,
    gap: null
  })

  const [processandoId, setProcessandoId] = useState<string | null>(null)
  const [processandoLote, setProcessandoLote] = useState(false)
  const [progressoLote, setProgressoLote] = useState({ atual: 0, total: 0, itemAtual: '' })

  // Define o cliente ativo
  useEffect(() => {
    if (selectedCliente) {
      setClienteAtualId(selectedCliente)
    } else if (clientes.length > 0) {
      setClienteAtualId(clientes[0].id)
    }
  }, [selectedCliente, clientes])

  // Carrega os gaps de numeração do cliente
  async function carregarGaps(clienteId?: string) {
    const idParaConsultar = clienteId || clienteAtualId
    if (!idParaConsultar) return

    setLoading(true)
    try {
      const res = await fetch(`/api/sefaz/gaps-numeracao?cliente_id=${idParaConsultar}&modelo=${filtroModelo}`)
      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Falha ao identificar quebras de numeração.')
      }

      setGaps(data.gaps || [])
      setHistorico(data.historicoInutilizacoes || [])
      setResumo(data.resumo || { totalGaps: 0, totalNumerosFaltantes: 0, pendentes: 0, homologadas: 0, utilizadasSefaz: 0 })
      setClienteInfo(data.cliente || null)

      // Identifica erros históricos anteriores gravados no banco
      if (data.historicoInutilizacoes) {
        const errosBd: ErroProcessamentoItem[] = data.historicoInutilizacoes
          .filter((h: any) => h.status_sefaz && !['102', '204'].includes(h.status_sefaz))
          .map((h: any) => ({
            id: h.id,
            modelo: h.modelo,
            serie: h.serie,
            nNFIni: h.numero_inicial,
            nNFFin: h.numero_final,
            codigo: h.status_sefaz,
            motivo: h.motivo_sefaz || 'Rejeição na SEFAZ',
            dataHora: h.data_hora || h.created_at
          }))
        
        // Mescla sem duplicar
        setErrosProcessamento(prev => {
          const map = new Map<string, ErroProcessamentoItem>()
          errosBd.forEach(e => map.set(`${e.modelo}_${e.serie}_${e.nNFIni}`, e))
          prev.forEach(e => map.set(`${e.modelo}_${e.serie}_${e.nNFIni}`, e))
          return Array.from(map.values())
        })
      }

    } catch (err: any) {
      toast.error('Erro ao buscar numeração faltante: ' + (err.message || ''))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (clienteAtualId) {
      setSelectedGapIds([])
      carregarGaps(clienteAtualId)
    }
  }, [clienteAtualId, filtroModelo])

  // Ação: Inutilizar individualmente na SEFAZ
  async function handleExecutarInutilizacao(gap: GapItem, justificativaTexto: string) {
    if (!clienteAtualId) return
    setProcessandoId(gap.id)
    const toastId = toast.loading(`Enviando pedido de inutilização da faixa ${gap.nNFIni} a ${gap.nNFFin} para a SEFAZ...`)

    try {
      const res = await fetch('/api/sefaz/inutilizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_id: clienteAtualId,
          modelo: gap.modelo,
          serie: gap.serie,
          nNFIni: gap.nNFIni,
          nNFFin: gap.nNFFin,
          ano: gap.ano,
          justificativa: justificativaTexto
        })
      })

      const data = await res.json()

      if (!res.ok && !data.cStat) {
        throw new Error(data.error || 'Falha ao conectar com o serviço de inutilização.')
      }

      if (data.isHomologada) {
        toast.success(`Inutilização HOMOLOGADA pela SEFAZ! Protocolo: ${data.nProt}`, { id: toastId, duration: 6000 })
      } else if (data.isJaInutilizado) {
        toast.success(`Confirmado pela SEFAZ: Este número JÁ SE ENCONTRAVA INUTILIZADO (Código 204)!`, { id: toastId, duration: 6000 })
      } else if (data.isUtilizadaNaSefaz) {
        toast.error(`⚠️ ATENÇÃO: Esta numeração CONSTA COMO UTILIZADA na SEFAZ (${data.cStat}: ${data.xMotivo}). O XML foi emitido no PDV mas não está no HUB!`, { id: toastId, duration: 8000 })
      } else {
        toast.error(`Rejeição da SEFAZ (${data.cStat}): ${data.xMotivo}`, { id: toastId, duration: 6000 })
        // Adiciona à aba de erros
        setErrosProcessamento(prev => [
          {
            id: `${gap.id}_${Date.now()}`,
            modelo: gap.modelo,
            serie: gap.serie,
            nNFIni: gap.nNFIni,
            nNFFin: gap.nNFFin,
            codigo: data.cStat || 'REJEICAO',
            motivo: data.xMotivo || 'Erro na SEFAZ',
            dataHora: new Date().toISOString()
          },
          ...prev
        ])
      }

      // Recarrega lista atualizada
      await carregarGaps()
    } catch (err: any) {
      toast.error('Erro ao processar na SEFAZ: ' + (err.message || ''), { id: toastId })
    } finally {
      setProcessandoId(null)
      setModalInutilizar({ open: false, gap: null, justificativa: 'Quebra de sequencia numerica do sistema emissor' })
    }
  }

  // Ação: Inutilização em Massa com Itens Marcados (Checkboxes)
  async function handleInutilizarSelecionadasEmMassa(justificativaTexto: string) {
    const selecionados = gaps.filter(g => selectedGapIds.includes(g.id) && g.status === 'PENDENTE')
    
    if (selecionados.length === 0) {
      toast('Nenhuma numeração pendente marcada para processar.', { icon: 'ℹ️' })
      return
    }

    if (!clienteInfo?.tem_certificado) {
      toast.error('O cliente precisa ter o Certificado Digital A1 cadastrado no portal para inutilizar na SEFAZ.')
      return
    }

    setModalMassa({ open: false, justificativa: justificativaTexto })
    setProcessandoLote(true)
    setProgressoLote({ atual: 0, total: selecionados.length, itemAtual: '' })

    const toastId = toast.loading(`Iniciando fila em massa de ${selecionados.length} faixas com mesma justificativa...`)

    let homologadasCount = 0
    let jaInutilizadasCount = 0
    let utilizadasSefazCount = 0
    let novosErros: ErroProcessamentoItem[] = []

    for (let i = 0; i < selecionados.length; i++) {
      const gap = selecionados[i]
      const labelItem = `${gap.modelo === '55' ? 'NF-e' : 'NFC-e'} Nº ${gap.nNFIni}${gap.nNFIni !== gap.nNFFin ? ` a ${gap.nNFFin}` : ''}`
      setProgressoLote({ atual: i + 1, total: selecionados.length, itemAtual: labelItem })

      try {
        const res = await fetch('/api/sefaz/inutilizar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cliente_id: clienteAtualId,
            modelo: gap.modelo,
            serie: gap.serie,
            nNFIni: gap.nNFIni,
            nNFFin: gap.nNFFin,
            ano: gap.ano,
            justificativa: justificativaTexto
          })
        })

        const data = await res.json()

        if (data.isHomologada) {
          homologadasCount++
          // Desmarca da seleção com sucesso
          setSelectedGapIds(prev => prev.filter(id => id !== gap.id))
        } else if (data.isJaInutilizado) {
          jaInutilizadasCount++
          setSelectedGapIds(prev => prev.filter(id => id !== gap.id))
        } else if (data.isUtilizadaNaSefaz) {
          utilizadasSefazCount++
          novosErros.push({
            id: `${gap.id}_${Date.now()}`,
            modelo: gap.modelo,
            serie: gap.serie,
            nNFIni: gap.nNFIni,
            nNFFin: gap.nNFFin,
            codigo: data.cStat || '206',
            motivo: `Consta como UTILIZADA na SEFAZ (${data.xMotivo || 'Nota emitida no PDV'}). Localizar arquivo XML.`,
            dataHora: new Date().toISOString()
          })
        } else {
          // Registra o erro e NÃO atrapalha o fluxo (passa para a próxima!)
          novosErros.push({
            id: `${gap.id}_${Date.now()}`,
            modelo: gap.modelo,
            serie: gap.serie,
            nNFIni: gap.nNFIni,
            nNFFin: gap.nNFFin,
            codigo: data.cStat || 'REJEICAO',
            motivo: data.xMotivo || data.error || 'Falha ao processar na SEFAZ',
            dataHora: new Date().toISOString()
          })
        }
      } catch (err: any) {
        // Erro de rede ou comunicação: registra e passa para a próxima nota!
        novosErros.push({
          id: `${gap.id}_${Date.now()}`,
          modelo: gap.modelo,
          serie: gap.serie,
          nNFIni: gap.nNFIni,
          nNFFin: gap.nNFFin,
          codigo: 'TIMEOUT/REDE',
          motivo: err.message || 'Falha de comunicação',
          dataHora: new Date().toISOString()
        })
      }

      // Intervalo de segurança de 1.5s entre chamadas da SEFAZ
      if (i < selecionados.length - 1) {
        await new Promise(r => setTimeout(r, 1500))
      }
    }

    setProcessandoLote(false)
    toast.dismiss(toastId)

    if (novosErros.length > 0) {
      setErrosProcessamento(prev => [...novosErros, ...prev])
    }

    const totalRegularizados = homologadasCount + jaInutilizadasCount
    if (novosErros.length > 0) {
      toast(
        `Fila concluída!\n✅ ${totalRegularizados} regularizadas com sucesso.\n⚠️ ${novosErros.length} notas com erro/aviso incluídas na aba "Erros / Ocorrências".`,
        { icon: '⚠️', duration: 9000 }
      )
    } else {
      toast.success(
        `Fila em massa concluída com 100% de sucesso!\n✅ ${totalRegularizados} numerações regularizadas junto à SEFAZ!`,
        { duration: 8000 }
      )
    }

    await carregarGaps()
  }

  // Filtragem dos gaps na tela
  const gapsFiltrados = useMemo(() => {
    return gaps.filter(g => {
      if (filtroModelo !== 'todos' && g.modelo !== filtroModelo) return false
      if (filtroStatus !== 'todos' && g.status !== filtroStatus) return false
      if (buscaTermo.trim()) {
        const t = buscaTermo.trim().toLowerCase()
        const faixa = `${g.nNFIni} a ${g.nNFFin}`.toLowerCase()
        const serie = `série ${g.serie}`.toLowerCase()
        const motivo = (g.motivo || '').toLowerCase()
        if (!faixa.includes(t) && !serie.includes(t) && !motivo.includes(t)) return false
      }
      return true
    })
  }, [gaps, filtroModelo, filtroStatus, buscaTermo])

  // Itens pendentes elegíveis para seleção
  const pendentesVisiveis = useMemo(() => {
    return gapsFiltrados.filter(g => g.status === 'PENDENTE')
  }, [gapsFiltrados])

  // Toggle selecionar todas as visíveis
  const todosSelecionados = pendentesVisiveis.length > 0 && pendentesVisiveis.every(g => selectedGapIds.includes(g.id))

  const handleToggleSelectAll = () => {
    if (todosSelecionados) {
      // Desmarca as visíveis
      setSelectedGapIds(prev => prev.filter(id => !pendentesVisiveis.some(g => g.id === id)))
    } else {
      // Marca todas as visíveis
      const idsToAdd = pendentesVisiveis.map(g => g.id)
      setSelectedGapIds(prev => Array.from(new Set([...prev, ...idsToAdd])))
    }
  }

  const handleToggleSelectGap = (id: string) => {
    setSelectedGapIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    )
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Seção */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-rose-100 text-rose-700 rounded-lg">
              <ShieldAlert size={20} />
            </span>
            <h2 className="text-xl font-bold text-slate-900">Quebras de Sequência e Inutilização SEFAZ</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Detecção automática de numerações puladas/faltantes de NF-e e NFC-e. Marque as notas desejadas com checkboxes para inutilização sequencial em massa com a mesma justificativa.
          </p>
        </div>

        {/* Botões de Ação no Topo */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => carregarGaps()}
            disabled={loading || processandoLote}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Recalcular Quebras
          </button>

          <button
            type="button"
            onClick={() => setModalMassa({ open: true, justificativa: 'Quebra de sequencia numerica do sistema emissor' })}
            disabled={processandoLote || loading || selectedGapIds.length === 0}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md shadow-rose-600/20 transition disabled:opacity-40"
          >
            <Zap size={14} className={processandoLote ? 'animate-spin' : ''} />
            {processandoLote 
              ? `Processando (${progressoLote.atual}/${progressoLote.total})...`
              : `Inutilizar Selecionadas em Massa (${selectedGapIds.length})`
            }
          </button>
        </div>
      </div>

      {/* Seletor de Empresa e Status do Certificado */}
      <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-slate-600 uppercase">Empresa / Cliente:</label>
          <select
            value={clienteAtualId}
            onChange={(e) => {
              setClienteAtualId(e.target.value)
              setSelectedCliente(e.target.value)
            }}
            className="text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-rose-500 outline-none"
          >
            {clientes.map(cli => (
              <option key={cli.id} value={cli.id}>
                {cli.razao_social} ({formatarCnpjCpf(cli.cnpj)})
              </option>
            ))}
          </select>
        </div>

        {clienteInfo && (
          <div className="flex items-center gap-2 text-xs">
            {clienteInfo.tem_certificado ? (
              <span className="flex items-center gap-1 text-emerald-700 bg-emerald-100/80 px-2.5 py-1 rounded-full font-medium">
                <CheckCircle2 size={13} /> Certificado Digital A1 Conectado ({clienteInfo.uf || 'MG'})
              </span>
            ) : (
              <span className="flex items-center gap-1 text-amber-700 bg-amber-100/80 px-2.5 py-1 rounded-full font-medium">
                <AlertTriangle size={13} /> Sem Certificado A1 cadastrado (necessário para assinar na SEFAZ)
              </span>
            )}
          </div>
        )}
      </div>

      {/* Cards de Resumo KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
            Numerações Faltantes
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{resumo.totalNumerosFaltantes}</span>
            <span className="text-xs text-slate-400 font-medium">em {resumo.totalGaps} quebras</span>
          </div>
        </div>

        <div className="bg-amber-50/60 rounded-xl p-4 border border-amber-200/80 shadow-sm">
          <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block mb-1">
            Pendentes de Inutilização
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-700">{resumo.pendentes}</span>
            <span className="text-xs text-amber-600 font-medium">aguardando envio</span>
          </div>
        </div>

        <div className="bg-red-50/70 rounded-xl p-4 border border-red-200/80 shadow-sm">
          <span className="text-[11px] font-bold text-red-800 uppercase tracking-wider block mb-1">
            Constam na SEFAZ (Falta XML)
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-red-700">{resumo.utilizadasSefaz}</span>
            <span className="text-xs text-red-600 font-medium">localizar no PDV</span>
          </div>
        </div>

        <div className="bg-emerald-50/60 rounded-xl p-4 border border-emerald-200/80 shadow-sm">
          <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block mb-1">
            Homologadas pela SEFAZ
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-700">{resumo.homologadas}</span>
            <span className="text-xs text-emerald-600 font-medium">regularizadas</span>
          </div>
        </div>
      </div>

      {/* Barra de Seleção em Massa quando há itens marcados */}
      {selectedGapIds.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <CheckSquare size={16} className="text-rose-600" />
            <span className="text-xs font-bold text-rose-900">
              {selectedGapIds.length} numerações selecionadas para processamento em lote
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedGapIds([])}
              className="text-xs text-rose-700 hover:text-rose-900 font-semibold px-2.5 py-1 rounded hover:bg-rose-100 transition"
            >
              Desmarcar Todas
            </button>
            <button
              type="button"
              onClick={() => setModalMassa({ open: true, justificativa: 'Quebra de sequencia numerica do sistema emissor' })}
              disabled={processandoLote}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-sm transition"
            >
              <Zap size={13} />
              Inutilizar Marcadas ({selectedGapIds.length})
            </button>
          </div>
        </div>
      )}

      {/* Abas de Navegação (Gaps vs Histórico vs Erros) e Filtros */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
          <button
            type="button"
            onClick={() => setAbaExibicao('gaps')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${
              abaExibicao === 'gaps'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Quebras de Sequência ({gaps.length})
          </button>

          <button
            type="button"
            onClick={() => setAbaExibicao('historico')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${
              abaExibicao === 'historico'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Histórico Homologado ({historico.length})
          </button>

          <button
            type="button"
            onClick={() => setAbaExibicao('erros')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition ${
              abaExibicao === 'erros'
                ? 'bg-red-600 text-white shadow-sm'
                : errosProcessamento.length > 0 
                  ? 'bg-red-100 text-red-800 hover:bg-red-200' 
                  : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <AlertOctagon size={13} />
            Erros / Ocorrências ({errosProcessamento.length})
          </button>
        </div>

        {/* Filtros de Modelo, Status e Busca */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filtroModelo}
            onChange={(e: any) => setFiltroModelo(e.target.value)}
            className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700"
          >
            <option value="todos">Todos os Modelos</option>
            <option value="55">NF-e (Mod 55)</option>
            <option value="65">NFC-e (Mod 65)</option>
          </select>

          {abaExibicao === 'gaps' && (
            <select
              value={filtroStatus}
              onChange={(e: any) => setFiltroStatus(e.target.value)}
              className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700"
            >
              <option value="todos">Todos os Status</option>
              <option value="PENDENTE">Pendentes</option>
              <option value="UTILIZADA_SEFAZ">Constam na SEFAZ</option>
              <option value="HOMOLOGADO">Homologadas</option>
            </select>
          )}

          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar numeração..."
              value={buscaTermo}
              onChange={(e) => setBuscaTermo(e.target.value)}
              className="pl-8 pr-3 py-1 text-xs border border-slate-200 rounded-lg w-40 focus:w-56 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Conteúdo da Aba Selecionada */}
      {abaExibicao === 'gaps' ? (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center gap-3">
              <RefreshCw size={24} className="animate-spin text-rose-500" />
              <span>Analisando sequência numérica das notas e consultando histórico...</span>
            </div>
          ) : gapsFiltrados.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs space-y-2">
              <CheckCircle2 size={36} className="mx-auto text-emerald-500" />
              <p className="font-bold text-sm text-slate-800">Nenhuma quebra de sequência encontrada!</p>
              <p className="text-slate-400">
                A numeração das notas emitidas está 100% contínua e sem faltantes para os filtros selecionados.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3 text-center w-10">
                      <button
                        type="button"
                        onClick={handleToggleSelectAll}
                        title={todosSelecionados ? "Desmarcar todas" : "Marcar todas as pendentes"}
                        className="text-slate-400 hover:text-slate-700 flex items-center justify-center mx-auto"
                      >
                        {todosSelecionados ? (
                          <CheckSquare size={16} className="text-rose-600" />
                        ) : (
                          <Square size={16} />
                        )}
                      </button>
                    </th>
                    <th className="py-3 px-4">Modelo</th>
                    <th className="py-3 px-4">Série</th>
                    <th className="py-3 px-4">Faixa Faltante</th>
                    <th className="py-3 px-4 text-center">Qtd</th>
                    <th className="py-3 px-4">Ano</th>
                    <th className="py-3 px-4">Diagnóstico / Situação SEFAZ</th>
                    <th className="py-3 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {gapsFiltrados.map((gap) => {
                    const isSelected = selectedGapIds.includes(gap.id)
                    const isPendente = gap.status === 'PENDENTE'

                    return (
                      <tr 
                        key={gap.id} 
                        className={`transition-colors ${
                          isSelected ? 'bg-rose-50/50' : 'hover:bg-slate-50/70'
                        }`}
                      >
                        <td className="py-3 px-3 text-center">
                          {isPendente ? (
                            <button
                              type="button"
                              onClick={() => handleToggleSelectGap(gap.id)}
                              className="text-slate-400 hover:text-rose-600 flex items-center justify-center mx-auto"
                            >
                              {isSelected ? (
                                <CheckSquare size={16} className="text-rose-600" />
                              ) : (
                                <Square size={16} />
                              )}
                            </button>
                          ) : (
                            <span className="text-slate-200 block text-center">•</span>
                          )}
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            gap.modelo === '55' ? 'bg-blue-100 text-blue-700' : 'bg-indigo-100 text-indigo-700'
                          }`}>
                            {gap.modelo === '55' ? 'NF-e (55)' : 'NFC-e (65)'}
                          </span>
                        </td>

                        <td className="py-3 px-4 font-mono font-medium text-slate-800">
                          Série {gap.serie}
                        </td>

                        <td className="py-3 px-4 font-mono font-bold text-slate-900">
                          {gap.nNFIni === gap.nNFFin ? (
                            <span>Nº {gap.nNFIni}</span>
                          ) : (
                            <span>Nº {gap.nNFIni} até {gap.nNFFin}</span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-center font-bold text-slate-700">
                          {gap.quantidade}
                        </td>

                        <td className="py-3 px-4 font-mono text-slate-500">
                          20{gap.ano}
                        </td>

                        <td className="py-3 px-4">
                          {gap.status === 'HOMOLOGADO' && (
                            <div className="flex items-center gap-1.5 text-emerald-700">
                              <CheckCircle2 size={14} className="text-emerald-600 flex-shrink-0" />
                              <span className="font-bold">
                                {gap.motivo?.includes('204') ? 'Já Inutilizada no PDV/SEFAZ' : 'Inutilizada na SEFAZ'}
                              </span>
                              {gap.protocolo ? (
                                <span className="text-[10px] font-mono text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded ml-1">
                                  Prot: {gap.protocolo}
                                </span>
                              ) : gap.motivo?.includes('204') ? (
                                <span className="text-[10px] font-mono text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded ml-1">
                                  Cód. 204
                                </span>
                              ) : null}
                            </div>
                          )}

                          {gap.status === 'UTILIZADA_SEFAZ' && (
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 text-red-700 font-bold">
                                <AlertTriangle size={14} className="text-red-600 flex-shrink-0" />
                                <span>Consta como UTILIZADA na SEFAZ</span>
                              </div>
                              <p className="text-[11px] text-red-600/90 leading-tight">
                                Esta nota foi emitida no PDV, mas o XML não subiu para o portal. Localize o arquivo no PDV.
                              </p>
                            </div>
                          )}

                          {gap.status === 'PENDENTE' && (
                            <div className="flex items-center gap-1.5 text-amber-700">
                              <Clock size={14} className="text-amber-600 flex-shrink-0" />
                              <span className="font-medium">Pendente de Inutilização</span>
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          {gap.status === 'UTILIZADA_SEFAZ' ? (
                            <button
                              type="button"
                              onClick={() => setModalAjudaSefaz({ open: true, gap })}
                              className="inline-flex items-center gap-1 px-3 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg font-bold text-[11px] transition"
                            >
                              <HelpCircle size={13} /> Como resolver?
                            </button>
                          ) : gap.status === 'HOMOLOGADO' ? (
                            <span className="text-xs text-slate-400 italic">Concluído</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setModalInutilizar({
                                open: true,
                                gap,
                                justificativa: 'Quebra de sequencia numerica do sistema emissor'
                              })}
                              disabled={processandoId === gap.id || processandoLote}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold text-xs transition shadow-sm disabled:opacity-50"
                            >
                              <Zap size={13} className={processandoId === gap.id ? 'animate-spin' : ''} />
                              {processandoId === gap.id ? 'Consultando...' : 'Consultar / Inutilizar'}
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : abaExibicao === 'historico' ? (
        /* Tabela de Histórico de Inutilizações Homologadas */
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          {historico.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              Nenhuma inutilização registrada para este cliente até o momento.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Data/Hora</th>
                    <th className="py-3 px-4">Modelo</th>
                    <th className="py-3 px-4">Série</th>
                    <th className="py-3 px-4">Faixa</th>
                    <th className="py-3 px-4">Status SEFAZ</th>
                    <th className="py-3 px-4">Protocolo</th>
                    <th className="py-3 px-4">Motivo / Retorno</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {historico.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 whitespace-nowrap text-slate-500">
                        {new Date(item.data_hora || item.created_at).toLocaleString('pt-BR')}
                      </td>
                      <td className="py-3 px-4 font-bold">
                        {item.modelo === '55' ? 'NF-e' : 'NFC-e'}
                      </td>
                      <td className="py-3 px-4">
                        Série {item.serie}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {item.numero_inicial} a {item.numero_final}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.status_sefaz === '102' || item.status_sefaz === '204'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {item.status_sefaz} - {item.status_sefaz === '102' ? 'HOMOLOGADO' : item.status_sefaz === '204' ? 'JÁ INUTILIZADO' : 'RECUSADO'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-emerald-700 font-bold">
                        {item.protocolo || '-'}
                      </td>
                      <td className="py-3 px-4 font-sans text-slate-600 max-w-xs truncate" title={item.motivo_sefaz || ''}>
                        {item.motivo_sefaz || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* ABA NOVA: Erros e Ocorrências do Processamento */
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-4 bg-red-50/60 border-b border-red-200/60 flex items-center justify-between">
            <div className="flex items-center gap-2 text-red-900">
              <AlertOctagon size={18} className="text-red-600" />
              <h3 className="font-bold text-sm">Ocorrências e Rejeições da SEFAZ ({errosProcessamento.length})</h3>
            </div>
            {errosProcessamento.length > 0 && (
              <button
                type="button"
                onClick={() => setErrosProcessamento([])}
                className="text-xs text-red-700 hover:text-red-900 font-semibold px-2 py-1 rounded hover:bg-red-100"
              >
                Limpar Lista de Erros
              </button>
            )}
          </div>

          {errosProcessamento.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
              <CheckCircle2 size={32} className="text-emerald-500" />
              <p className="font-bold text-slate-700">Nenhum erro registrado!</p>
              <p className="text-slate-400">
                Todas as tentativas de inutilização e consultas executadas foram aceitas sem rejeição.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Data/Hora</th>
                    <th className="py-3 px-4">Modelo</th>
                    <th className="py-3 px-4">Série</th>
                    <th className="py-3 px-4">Numeração</th>
                    <th className="py-3 px-4">Código SEFAZ</th>
                    <th className="py-3 px-4">Motivo / Rejeição</th>
                    <th className="py-3 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {errosProcessamento.map((item) => (
                    <tr key={item.id} className="hover:bg-red-50/30">
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap font-mono">
                        {new Date(item.dataHora).toLocaleTimeString('pt-BR')} - {new Date(item.dataHora).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="py-3 px-4 font-bold">
                        {item.modelo === '55' ? 'NF-e' : 'NFC-e'}
                      </td>
                      <td className="py-3 px-4 font-mono">
                        Série {item.serie}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {item.nNFIni === item.nNFFin ? `Nº ${item.nNFIni}` : `Nº ${item.nNFIni} a ${item.nNFFin}`}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 font-mono">
                          {item.codigo}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-red-800 max-w-md font-sans">
                        {item.motivo}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            const gapAlvo = gaps.find(g => g.modelo === item.modelo && g.serie === item.serie && g.nNFIni === item.nNFIni)
                            if (gapAlvo) {
                              setModalInutilizar({
                                open: true,
                                gap: gapAlvo,
                                justificativa: 'Quebra de sequencia numerica do sistema emissor'
                              })
                            } else {
                              toast.error('Esta numeração já foi resolvida ou atualizada.')
                            }
                          }}
                          className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
                        >
                          Tentar Novamente
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal de Inutilização Individual */}
      {modalInutilizar.open && modalInutilizar.gap && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2 text-rose-600">
                <ShieldAlert size={20} />
                <h3 className="font-bold text-slate-900 text-base">Inutilização de Numeração na SEFAZ</h3>
              </div>
              <button
                type="button"
                onClick={() => setModalInutilizar({ open: false, gap: null, justificativa: '' })}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-600">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500">Documento:</span>
                  <span className="font-bold text-slate-800">
                    {modalInutilizar.gap.modelo === '55' ? 'NF-e (Mod 55)' : 'NFC-e (Mod 65)'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Série:</span>
                  <span className="font-bold text-slate-800">{modalInutilizar.gap.serie}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Faixa a Inutilizar:</span>
                  <span className="font-bold text-rose-600">
                    Nº {modalInutilizar.gap.nNFIni} até {modalInutilizar.gap.nNFFin} ({modalInutilizar.gap.quantidade} notas)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Ano de Exercício:</span>
                  <span className="font-bold text-slate-800">20{modalInutilizar.gap.ano}</span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Justificativa Oficial (mínimo de 15 caracteres):
                </label>
                <textarea
                  rows={3}
                  value={modalInutilizar.justificativa}
                  onChange={(e) => setModalInutilizar(prev => ({ ...prev, justificativa: e.target.value }))}
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-rose-500 outline-none"
                  placeholder="Informe o motivo da quebra na sequência..."
                />
                <span className={`text-[11px] font-medium ${
                  modalInutilizar.justificativa.trim().length >= 15 ? 'text-emerald-600' : 'text-red-500'
                }`}>
                  {modalInutilizar.justificativa.trim().length} / 255 caracteres (mínimo 15)
                </span>
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-[11px] leading-relaxed">
                ℹ️ <strong>Importante:</strong> Esta ação assina o pedido de inutilização digitalmente com o Certificado Digital A1 do cliente e submete diretamente ao WebService oficial da SEFAZ de Minas Gerais.
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setModalInutilizar({ open: false, gap: null, justificativa: '' })}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={modalInutilizar.justificativa.trim().length < 15 || processandoId === modalInutilizar.gap.id}
                onClick={() => handleExecutarInutilizacao(modalInutilizar.gap!, modalInutilizar.justificativa)}
                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md shadow-rose-600/20 transition disabled:opacity-50"
              >
                Confirmar &amp; Inutilizar na SEFAZ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Inutilização em Massa (Mesma Justificativa) */}
      {modalMassa.open && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2 text-rose-600">
                <Zap size={20} />
                <h3 className="font-bold text-slate-900 text-base">Inutilização em Massa na SEFAZ</h3>
              </div>
              <button
                type="button"
                onClick={() => setModalMassa({ open: false, justificativa: '' })}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-600">
              <div className="p-3.5 bg-rose-50 rounded-xl border border-rose-200 text-rose-900">
                <p className="font-bold text-sm mb-1">
                  {selectedGapIds.length} numerações selecionadas para processamento sequencial
                </p>
                <p className="text-rose-700 text-xs">
                  A aplicação enviará as notas uma a uma com a mesma justificativa abaixo. Se alguma retornar rejeição ou erro, ela será automaticamente enviada para a aba <strong>Erros / Ocorrências</strong> e o sistema continuará o fluxo imediatamente sem interrupção.
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Justificativa Unificada para o Lote (mínimo de 15 caracteres):
                </label>
                <textarea
                  rows={3}
                  value={modalMassa.justificativa}
                  onChange={(e) => setModalMassa(prev => ({ ...prev, justificativa: e.target.value }))}
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-rose-500 outline-none"
                  placeholder="Informe a justificativa que será aplicada a todas as numerações..."
                />
                <span className={`text-[11px] font-medium ${
                  modalMassa.justificativa.trim().length >= 15 ? 'text-emerald-600' : 'text-red-500'
                }`}>
                  {modalMassa.justificativa.trim().length} / 255 caracteres (mínimo 15)
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-500 text-[11px] leading-relaxed">
                🛡️ <strong>Proteção SEFAZ:</strong> O robô aplicará um intervalo seguro de 1.5s entre cada chamada para evitar bloqueio temporário por consumo indevido.
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setModalMassa({ open: false, justificativa: '' })}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={modalMassa.justificativa.trim().length < 15 || processandoLote}
                onClick={() => handleInutilizarSelecionadasEmMassa(modalMassa.justificativa)}
                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md shadow-rose-600/20 transition disabled:opacity-50"
              >
                Iniciar Inutilização em Massa ({selectedGapIds.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Educativo: O que fazer quando a SEFAZ informa que já foi utilizada */}
      {modalAjudaSefaz.open && modalAjudaSefaz.gap && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2 text-red-600">
                <AlertTriangle size={20} />
                <h3 className="font-bold text-slate-900 text-base">Nota Emitida na SEFAZ (XML Faltante)</h3>
              </div>
              <button
                type="button"
                onClick={() => setModalAjudaSefaz({ open: false, gap: null })}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-600">
              <div className="p-3.5 bg-red-50/80 rounded-xl border border-red-200 text-red-900 leading-relaxed">
                <p className="font-bold text-sm mb-1">Por que esta nota não pode ser inutilizada?</p>
                <p>
                  Ao consultar a SEFAZ, o órgão fiscal respondeu com o código de rejeição oficial informando que o <strong>número {modalAjudaSefaz.gap.nNFIni} já foi autorizado</strong>.
                </p>
              </div>

              <div className="space-y-2">
                <p className="font-bold text-slate-800">O que isso significa na prática?</p>
                <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
                  <li>O PDV local da empresa emitiu a nota fiscal com sucesso para o cliente.</li>
                  <li>A nota existe e está válida no banco de dados da SEFAZ.</li>
                  <li>Porém, o arquivo <strong>XML não foi sincronizado</strong> para a nuvem do HUB Paratech.</li>
                </ul>
              </div>

              <div className="space-y-2">
                <p className="font-bold text-slate-800">Passo a passo para regularizar:</p>
                <ol className="list-decimal pl-5 space-y-1.5 text-slate-600">
                  <li>Acesse o computador do PDV ou a pasta de XMLs do sistema emissor local.</li>
                  <li>Localize o arquivo XML correspondente ao número <strong>{modalAjudaSefaz.gap.nNFIni}</strong>.</li>
                  <li>Faça o upload do XML no HUB Paratech na aba <em>Notas Fiscais</em> ou sincronize pelo aplicativo desktop do HUB.</li>
                </ol>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setModalAjudaSefaz({ open: false, gap: null })}
                className="px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
