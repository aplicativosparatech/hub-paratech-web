'use client'

import { useEffect, useState, useMemo } from 'react'
import { 
  AlertTriangle, CheckCircle2, RefreshCw, Zap, ShieldAlert, 
  Search, Filter, Check, Clock, FileText, ExternalLink, HelpCircle,
  FileCheck, ShieldCheck, ChevronRight, X, Play, CheckSquare, Square,
  AlertOctagon, ArrowRight, Copy, CheckCheck, Calendar, SlidersHorizontal, Hash
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useNotasFiscaisFilters } from './NotasFiscaisFilterContext'
import { formatarCnpjCpf } from '@/utils/cnpjAlfanumerico'
import { JUSTIFICATIVAS_INUTILIZACAO } from '@/utils/justificativasInutilizacao'

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
    id?: string
    razao_social?: string
    cnpj?: string
    uf?: string
    tem_certificado?: boolean
    ponto_partida?: {
      data_inicio_monitoramento: string | null
      numero_inicial_nfe: number
      numero_inicial_nfce: number
      numero_inicial_nfse: number
      numero_inicial_cte: number
      numero_inicial_mdfe: number
    }
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
    justificativa: 'Erro de comunicacao com os servidores da SEFAZ durante a emissao'
  })

  const [modalMassa, setModalMassa] = useState<{
    open: boolean
    justificativa: string
  }>({
    open: false,
    justificativa: 'Erro de comunicacao com os servidores da SEFAZ durante a emissao'
  })

  // Modal Elegante de Retorno da SEFAZ
  const [modalResultado, setModalResultado] = useState<{
    open: boolean
    tipo: 'sucesso' | 'ja_inutilizado' | 'utilizada' | 'erro'
    titulo: string
    mensagem: string
    protocolo?: string
    cStat?: string
    dhRecbto?: string
    faixaTexto?: string
  }>({
    open: false,
    tipo: 'sucesso',
    titulo: '',
    mensagem: ''
  })

  const [protocoloCopiado, setProtocoloCopiado] = useState(false)

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
  const [modalPontoPartida, setModalPontoPartida] = useState<{
    open: boolean
    saving: boolean
    data_inicio_monitoramento: string
    numero_inicial_nfe: number
    numero_inicial_nfce: number
    numero_inicial_nfse: number
    numero_inicial_cte: number
    numero_inicial_mdfe: number
  }>({
    open: false,
    saving: false,
    data_inicio_monitoramento: '',
    numero_inicial_nfe: 1,
    numero_inicial_nfce: 1,
    numero_inicial_nfse: 1,
    numero_inicial_cte: 1,
    numero_inicial_mdfe: 1
  })

  const handleAbrirModalPontoPartida = () => {
    const pp = clienteInfo?.ponto_partida
    setModalPontoPartida({
      open: true,
      saving: false,
      data_inicio_monitoramento: pp?.data_inicio_monitoramento || '',
      numero_inicial_nfe: pp?.numero_inicial_nfe || 1,
      numero_inicial_nfce: pp?.numero_inicial_nfce || 1,
      numero_inicial_nfse: pp?.numero_inicial_nfse || 1,
      numero_inicial_cte: pp?.numero_inicial_cte || 1,
      numero_inicial_mdfe: pp?.numero_inicial_mdfe || 1
    })
  }

  const handleSalvarPontoPartida = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clienteAtualId) return
    setModalPontoPartida(prev => ({ ...prev, saving: true }))
    const toastId = toast.loading('Atualizando ponto de partida fiscal...')
    try {
      const res = await fetch('/api/clientes/ponto-partida', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_id: clienteAtualId,
          data_inicio_monitoramento: modalPontoPartida.data_inicio_monitoramento || null,
          numero_inicial_nfe: modalPontoPartida.numero_inicial_nfe,
          numero_inicial_nfce: modalPontoPartida.numero_inicial_nfce,
          numero_inicial_nfse: modalPontoPartida.numero_inicial_nfse,
          numero_inicial_cte: modalPontoPartida.numero_inicial_cte,
          numero_inicial_mdfe: modalPontoPartida.numero_inicial_mdfe
        })
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Falha ao salvar ponto de partida fiscal.')
      }
      toast.success('Ponto de partida fiscal atualizado com sucesso!', { id: toastId })
      setModalPontoPartida(prev => ({ ...prev, open: false, saving: false }))
      // Recarrega os gaps para refletir o novo ponto de partida
      await carregarGaps(clienteAtualId)
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + (err.message || ''), { id: toastId })
      setModalPontoPartida(prev => ({ ...prev, saving: false }))
    }
  }

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

      // Identifica ocorrências anteriores registradas no histórico
      if (data.historicoInutilizacoes) {
        const errosBd: ErroProcessamentoItem[] = data.historicoInutilizacoes
          .filter((h: any) => h.status_sefaz && !['102', '204', '563'].includes(h.status_sefaz))
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

  // Copiar protocolo com feedback
  const handleCopiarProtocolo = (prot: string) => {
    if (!prot) return
    navigator.clipboard.writeText(prot)
    setProtocoloCopiado(true)
    toast.success('Protocolo copiado para a área de transferência!')
    setTimeout(() => setProtocoloCopiado(false), 2500)
  }

  // Ação: Inutilizar individualmente na SEFAZ
  async function handleExecutarInutilizacao(gap: GapItem, justificativaTexto: string) {
    if (!clienteAtualId) return
    setProcessandoId(gap.id)
    setModalInutilizar(prev => ({ ...prev, open: false }))
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
      toast.dismiss(toastId)

      const labelFaixa = `${gap.modelo === '55' ? 'NF-e (Mod 55)' : 'NFC-e (Mod 65)'} - Série ${gap.serie} - Nº ${gap.nNFIni}${gap.nNFIni !== gap.nNFFin ? ` a ${gap.nNFFin}` : ''}`

      if (data.isHomologada) {
        setModalResultado({
          open: true,
          tipo: 'sucesso',
          titulo: 'Inutilização Homologada com Sucesso!',
          mensagem: 'A SEFAZ autorizou a inutilização da numeração e gerou o protocolo oficial de homologação.',
          protocolo: data.nProt,
          cStat: data.cStat || '102',
          dhRecbto: data.dhRecbto,
          faixaTexto: labelFaixa
        })
      } else if (data.isJaInutilizado) {
        setModalResultado({
          open: true,
          tipo: 'ja_inutilizado',
          titulo: 'Numeração Já Inutilizada na SEFAZ!',
          mensagem: `A SEFAZ confirmou que este número já se encontrava homologado e inutilizado no Fisco (Código ${data.cStat}). O HUB atualizou o status para regularizado!`,
          protocolo: data.nProt,
          cStat: data.cStat || '204',
          dhRecbto: data.dhRecbto,
          faixaTexto: labelFaixa
        })
      } else if (data.isUtilizadaNaSefaz) {
        setModalResultado({
          open: true,
          tipo: 'utilizada',
          titulo: 'Nota Emitida na SEFAZ (Falta XML no HUB)',
          mensagem: `A SEFAZ informou que o número já foi utilizado em uma nota fiscal autorizada (${data.cStat}: ${data.xMotivo}). O XML foi emitido no PDV local mas não subiu para a nuvem.`,
          cStat: data.cStat,
          faixaTexto: labelFaixa
        })
      } else {
        setModalResultado({
          open: true,
          tipo: 'erro',
          titulo: `Retorno da SEFAZ (Código ${data.cStat || 'ERRO'})`,
          mensagem: data.xMotivo || data.error || 'A SEFAZ recusou a solicitação de inutilização.',
          cStat: data.cStat,
          faixaTexto: labelFaixa
        })

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
      toast.dismiss(toastId)
      toast.error('Erro ao processar na SEFAZ: ' + (err.message || ''))
    } finally {
      setProcessandoId(null)
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
        // Erro de rede ou comunicação: registra e passa para a próxima nota sem travar!
        novosErros.push({
          id: `${gap.id}_${Date.now()}`,
          modelo: gap.modelo,
          serie: gap.serie,
          nNFIni: gap.nNFIni,
          nNFFin: gap.nNFFin,
          codigo: 'TIMEOUT/REDE',
          motivo: err.message || 'Falha de comunicação com a SEFAZ',
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
        `Fila concluída!\n✅ ${totalRegularizados} regularizadas na SEFAZ.\n⚠️ ${novosErros.length} notas com erro/aviso incluídas na aba "Erros / Ocorrências".`,
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
      setSelectedGapIds(prev => prev.filter(id => !pendentesVisiveis.some(g => g.id === id)))
    } else {
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
            Detecção automática de numerações puladas/faltantes de NF-e e NFC-e. Marque as notas desejadas com checkboxes para inutilização sequencial em massa com justificativa padronizada.
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
            onClick={() => setModalMassa({ open: true, justificativa: 'Erro de comunicacao com os servidores da SEFAZ durante a emissao' })}
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

      {/* Banner de Ponto de Partida Fiscal & Competência Inicial */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-xl p-4 shadow-sm border border-indigo-900/50 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-indigo-500/20 text-indigo-400 rounded-lg">
              <Calendar size={15} />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
              Ponto de Partida Fiscal & Competência Inicial
            </span>
            <span className="text-[10px] bg-indigo-500/30 text-indigo-200 px-2 py-0.5 rounded-full font-medium">
              Contrato de Monitoramento
            </span>
          </div>
          <div className="text-sm font-semibold text-white flex flex-wrap items-center gap-2">
            <span>Início das Atividades / Envio:</span>
            <span className="text-indigo-200 font-mono font-bold bg-indigo-950 px-2.5 py-0.5 rounded border border-indigo-700/60">
              {clienteInfo?.ponto_partida?.data_inicio_monitoramento
                ? new Date(clienteInfo.ponto_partida.data_inicio_monitoramento + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase()
                : 'Todas as competências (Desde o início)'}
            </span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            XMLs anteriores a esta data ou com números inferiores ao ponto de partida são ignorados automaticamente e não geram falsos gaps.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 text-center">
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-lg px-2.5 py-1 min-w-[70px]">
              <span className="text-[9px] block text-slate-400 font-bold uppercase">NF-e (55)</span>
              <span className="text-xs font-black text-emerald-400 font-mono">#{clienteInfo?.ponto_partida?.numero_inicial_nfe || 1}</span>
            </div>
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-lg px-2.5 py-1 min-w-[70px]">
              <span className="text-[9px] block text-slate-400 font-bold uppercase">NFC-e (65)</span>
              <span className="text-xs font-black text-emerald-400 font-mono">#{clienteInfo?.ponto_partida?.numero_inicial_nfce || 1}</span>
            </div>
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-lg px-2.5 py-1 min-w-[70px]">
              <span className="text-[9px] block text-slate-400 font-bold uppercase">NFS-e</span>
              <span className="text-xs font-black text-cyan-400 font-mono">#{clienteInfo?.ponto_partida?.numero_inicial_nfse || 1}</span>
            </div>
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-lg px-2.5 py-1 min-w-[70px]">
              <span className="text-[9px] block text-slate-400 font-bold uppercase">CT-e (57)</span>
              <span className="text-xs font-black text-purple-400 font-mono">#{clienteInfo?.ponto_partida?.numero_inicial_cte || 1}</span>
            </div>
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-lg px-2.5 py-1 min-w-[70px]">
              <span className="text-[9px] block text-slate-400 font-bold uppercase">MDF-e (58)</span>
              <span className="text-xs font-black text-purple-400 font-mono">#{clienteInfo?.ponto_partida?.numero_inicial_mdfe || 1}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleAbrirModalPontoPartida}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition shadow-sm"
          >
            <SlidersHorizontal size={13} />
            Ajustar
          </button>
        </div>
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
              onClick={() => setModalMassa({ open: true, justificativa: 'Erro de comunicacao com os servidores da SEFAZ durante a emissao' })}
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
                                {gap.motivo?.includes('204') || gap.motivo?.includes('563') ? 'Já Inutilizada no PDV/SEFAZ' : 'Inutilizada na SEFAZ'}
                              </span>
                              {gap.protocolo ? (
                                <span className="text-[10px] font-mono text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded ml-1">
                                  Prot: {gap.protocolo}
                                </span>
                              ) : (gap.motivo?.includes('204') || gap.motivo?.includes('563')) ? (
                                <span className="text-[10px] font-mono text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded ml-1">
                                  Confirmado SEFAZ
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
                                justificativa: 'Erro de comunicacao com os servidores da SEFAZ durante a emissao'
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
                          item.status_sefaz === '102' || item.status_sefaz === '204' || item.status_sefaz === '563'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {item.status_sefaz} - {item.status_sefaz === '102' ? 'HOMOLOGADO' : ['204', '563'].includes(item.status_sefaz) ? 'JÁ INUTILIZADO' : 'RECUSADO'}
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
                                justificativa: 'Erro de comunicacao com os servidores da SEFAZ durante a emissao'
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

      {/* Modal de Inutilização Individual com Combobox de 30 Justificativas */}
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

              {/* Seletor Combobox de Justificativas */}
              <div>
                <label className="block font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Justificativa da Inutilização:</span>
                  <span className="text-[11px] font-normal text-slate-400">Escolha da lista ou digite abaixo</span>
                </label>

                <div className="mb-2">
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        setModalInutilizar(prev => ({ ...prev, justificativa: e.target.value }))
                      }
                    }}
                    className="w-full border border-slate-300 bg-slate-50 text-slate-800 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-rose-500 outline-none font-medium"
                    defaultValue=""
                  >
                    <option value="" disabled>
                      ⚡ Escolha uma das 30 justificativas mais aceitas pela SEFAZ...
                    </option>
                    {JUSTIFICATIVAS_INUTILIZACAO.map((just, idx) => (
                      <option key={idx} value={just}>
                        {idx + 1}. {just}
                      </option>
                    ))}
                  </select>
                </div>

                <textarea
                  rows={3}
                  value={modalInutilizar.justificativa}
                  onChange={(e) => setModalInutilizar(prev => ({ ...prev, justificativa: e.target.value }))}
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-rose-500 outline-none"
                  placeholder="Você também pode personalizar ou escrever outra justificativa aqui..."
                />

                <div className="flex items-center justify-between mt-1">
                  <span className={`text-[11px] font-medium ${
                    modalInutilizar.justificativa.trim().length >= 15 ? 'text-emerald-600' : 'text-red-500'
                  }`}>
                    {modalInutilizar.justificativa.trim().length} / 255 caracteres (mínimo 15)
                  </span>
                  {modalInutilizar.justificativa.trim().length >= 15 && (
                    <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                      <Check size={12} /> Tamanho válido para a SEFAZ
                    </span>
                  )}
                </div>
              </div>

              {/* Aviso Preventivo se a faixa for maior que 1.000 notas */}
              {modalInutilizar.gap && modalInutilizar.gap.quantidade > 1000 && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-300 text-amber-950 text-xs flex items-start gap-2.5">
                  <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block mb-0.5">
                      Atenção: Faixa extensa ({modalInutilizar.gap.quantidade.toLocaleString('pt-BR')} numerações)!
                    </span>
                    <p className="text-[11px] leading-relaxed text-amber-800">
                      A SEFAZ rejeita pedidos de inutilização com mais de 10.000 números (Rejeição 201). Se essas notas pertencem ao histórico anterior da empresa, <strong>não inutilize</strong>. Basta fechar este modal e clicar no botão <strong>"Ajustar"</strong> no topo da página para definir o Ponto de Partida Fiscal.
                    </p>
                  </div>
                </div>
              )}

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

      {/* Modal de Inutilização em Massa (Com Combobox de 30 Justificativas) */}
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

              {/* Aviso se o lote selecionado contiver faixas maiores que 1.000 notas */}
              {gaps.filter(g => selectedGapIds.includes(g.id) && g.quantidade > 1000).length > 0 && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-300 text-amber-950 text-xs flex items-start gap-2.5">
                  <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block mb-0.5">
                      Atenção: O lote possui {gaps.filter(g => selectedGapIds.includes(g.id) && g.quantidade > 1000).length} faixa(s) com mais de 1.000 notas!
                    </span>
                    <p className="text-[11px] leading-relaxed text-amber-800">
                      A SEFAZ rejeita faixas extensas com o Código 201 (limite ultrapassado). Se forem numerações antigas anteriores ao HUB, desmarque-as e ajuste o <strong>Ponto de Partida Fiscal</strong> no topo da página.
                    </p>
                  </div>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Justificativa Unificada para o Lote:</span>
                  <span className="text-[11px] font-normal text-slate-400">Escolha da lista ou digite abaixo</span>
                </label>

                <div className="mb-2">
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        setModalMassa(prev => ({ ...prev, justificativa: e.target.value }))
                      }
                    }}
                    className="w-full border border-slate-300 bg-slate-50 text-slate-800 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-rose-500 outline-none font-medium"
                    defaultValue=""
                  >
                    <option value="" disabled>
                      ⚡ Escolha uma das 30 justificativas mais aceitas pela SEFAZ...
                    </option>
                    {JUSTIFICATIVAS_INUTILIZACAO.map((just, idx) => (
                      <option key={idx} value={just}>
                        {idx + 1}. {just}
                      </option>
                    ))}
                  </select>
                </div>

                <textarea
                  rows={3}
                  value={modalMassa.justificativa}
                  onChange={(e) => setModalMassa(prev => ({ ...prev, justificativa: e.target.value }))}
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-rose-500 outline-none"
                  placeholder="Informe a justificativa que será aplicada a todas as numerações..."
                />

                <div className="flex items-center justify-between mt-1">
                  <span className={`text-[11px] font-medium ${
                    modalMassa.justificativa.trim().length >= 15 ? 'text-emerald-600' : 'text-red-500'
                  }`}>
                    {modalMassa.justificativa.trim().length} / 255 caracteres (mínimo 15)
                  </span>
                  {modalMassa.justificativa.trim().length >= 15 && (
                    <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                      <Check size={12} /> Tamanho válido para a SEFAZ
                    </span>
                  )}
                </div>
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

      {/* MODAL NOVO: Resposta Elegante da SEFAZ com Protocolo e Cópia */}
      {modalResultado.open && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                {modalResultado.tipo === 'sucesso' && (
                  <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                    <CheckCircle2 size={22} />
                  </div>
                )}
                {modalResultado.tipo === 'ja_inutilizado' && (
                  <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
                    <ShieldCheck size={22} />
                  </div>
                )}
                {modalResultado.tipo === 'utilizada' && (
                  <div className="p-2 bg-amber-100 text-amber-700 rounded-xl">
                    <AlertTriangle size={22} />
                  </div>
                )}
                {modalResultado.tipo === 'erro' && (
                  <div className="p-2 bg-red-100 text-red-700 rounded-xl">
                    <AlertOctagon size={22} />
                  </div>
                )}

                <div>
                  <h3 className="font-bold text-slate-900 text-base leading-tight">
                    {modalResultado.titulo}
                  </h3>
                  <span className="text-[11px] font-semibold text-slate-400">
                    Retorno Oficial da Fazenda de Minas Gerais (MG)
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setModalResultado(prev => ({ ...prev, open: false }))}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Detalhes do Documento */}
              {modalResultado.faixaTexto && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-slate-700 font-mono">
                  <span className="text-slate-500 font-sans">Documento:</span>
                  <span className="font-bold">{modalResultado.faixaTexto}</span>
                </div>
              )}

              {/* Protocolo Oficial SEFAZ com Botão de Copiar */}
              {modalResultado.protocolo && (
                <div className="p-4 bg-emerald-50/70 border border-emerald-200/80 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block mb-0.5">
                      Número do Protocolo SEFAZ
                    </span>
                    <span className="text-base font-black font-mono text-emerald-950 tracking-wide">
                      {modalResultado.protocolo}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopiarProtocolo(modalResultado.protocolo!)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-xs shadow-sm transition"
                  >
                    {protocoloCopiado ? <CheckCheck size={14} /> : <Copy size={14} />}
                    {protocoloCopiado ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
              )}

              {/* Mensagem explicativa */}
              <div className={`p-3.5 rounded-xl border ${
                modalResultado.tipo === 'sucesso' || modalResultado.tipo === 'ja_inutilizado'
                  ? 'bg-slate-50 border-slate-200 text-slate-700'
                  : modalResultado.tipo === 'utilizada'
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : 'bg-red-50 border-red-200 text-red-900'
              }`}>
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 font-bold font-mono text-[11px] px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-800">
                    Cód. {modalResultado.cStat}
                  </div>
                  <p className="leading-relaxed text-xs">
                    {modalResultado.mensagem}
                  </p>
                </div>
              </div>

              {/* Alerta Inteligente para Rejeição 201 (Limite de Numeração Ultrapassado) */}
              {(modalResultado.cStat === '201' || String(modalResultado.mensagem).toLowerCase().includes('ultrapassou o limite')) && (
                <div className="p-4 bg-indigo-50/90 border border-indigo-200 rounded-xl text-indigo-950 space-y-2.5">
                  <div className="flex items-center gap-2 font-bold text-xs text-indigo-900">
                    <SlidersHorizontal size={15} className="text-indigo-600" />
                    <span>Por que a SEFAZ rejeitou com o Código 201?</span>
                  </div>
                  <p className="text-xs leading-relaxed text-indigo-900">
                    A SEFAZ possui uma regra rígida (MOC DP08) que <strong>limita a quantidade de números por pedido de inutilização (máximo de 10.000 notas)</strong>. Pedidos com faixas muito extensas são rejeitados para evitar que notas já vendidas sejam perdidas por engano.
                  </p>
                  <div className="p-3 bg-white rounded-lg border border-indigo-100 text-xs leading-relaxed text-slate-800 space-y-2 shadow-xs">
                    <p className="font-bold text-indigo-700">💡 Como regularizar corretamente sem dar erro na SEFAZ:</p>
                    <p>
                      Essas notas anteriores ao início do HUB são vendas reais já feitas pelo cliente. <strong>Você não precisa inutilizá-las</strong>.
                    </p>
                    <p>
                      Basta clicar no botão abaixo para definir o <strong>Ponto de Partida Fiscal</strong> deste cliente. Ao informar a numeração inicial correta, esse falso gap desaparecerá instantaneamente!
                    </p>
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setModalResultado(prev => ({ ...prev, open: false }))
                          handleAbrirModalPontoPartida()
                        }}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition shadow-sm"
                      >
                        <SlidersHorizontal size={14} />
                        Configurar Ponto de Partida Fiscal Agora
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {modalResultado.dhRecbto && (
                <p className="text-[11px] text-slate-400 text-right">
                  Recebido pela SEFAZ em: {new Date(modalResultado.dhRecbto).toLocaleString('pt-BR')}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setModalResultado(prev => ({ ...prev, open: false }))}
                className="px-6 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition"
              >
                Fechar
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

      {/* Modal de Ajuste Rápido do Ponto de Partida Fiscal */}
      {modalPontoPartida.open && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2 text-indigo-700">
                <SlidersHorizontal size={20} />
                <h3 className="font-bold text-slate-900 text-base">Ponto de Partida Fiscal & Competência</h3>
              </div>
              <button
                type="button"
                onClick={() => setModalPontoPartida(prev => ({ ...prev, open: false }))}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSalvarPontoPartida} className="space-y-4">
              <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-xs text-indigo-900 leading-relaxed">
                Configure a partir de qual data/competência o cliente iniciou as atividades no HUB e quais as numerações iniciais de contagem. O monitoramento e a auditoria de quebra de sequência (SEFAZ) respeitarão estritamente estes valores.
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mês de Início / Competência Inicial:
                </label>
                <input
                  type="date"
                  value={modalPontoPartida.data_inicio_monitoramento}
                  onChange={(e) => setModalPontoPartida(prev => ({ ...prev, data_inicio_monitoramento: e.target.value }))}
                  className="w-full text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Exemplo: selecione 01/09/2026 para início em Setembro/2026. XMLs emitidos anteriormente serão descartados automaticamente.
                </p>
              </div>

              <div className="border-t border-slate-100 pt-3">
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Primeiro Número de Cada Documento (Contador Inicial):
                </label>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                      NF-e (Mod. 55)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={modalPontoPartida.numero_inicial_nfe}
                      onChange={(e) => setModalPontoPartida(prev => ({ ...prev, numero_inicial_nfe: parseInt(e.target.value) || 1 }))}
                      className="w-full text-xs font-mono font-bold text-slate-800 border border-slate-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                      NFC-e (Mod. 65)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={modalPontoPartida.numero_inicial_nfce}
                      onChange={(e) => setModalPontoPartida(prev => ({ ...prev, numero_inicial_nfce: parseInt(e.target.value) || 1 }))}
                      className="w-full text-xs font-mono font-bold text-slate-800 border border-slate-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                      NFS-e (Serviço)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={modalPontoPartida.numero_inicial_nfse}
                      onChange={(e) => setModalPontoPartida(prev => ({ ...prev, numero_inicial_nfse: parseInt(e.target.value) || 1 }))}
                      className="w-full text-xs font-mono font-bold text-slate-800 border border-slate-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                      CT-e (Mod. 57)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={modalPontoPartida.numero_inicial_cte}
                      onChange={(e) => setModalPontoPartida(prev => ({ ...prev, numero_inicial_cte: parseInt(e.target.value) || 1 }))}
                      className="w-full text-xs font-mono font-bold text-slate-800 border border-slate-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                      MDF-e (Mod. 58)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={modalPontoPartida.numero_inicial_mdfe}
                      onChange={(e) => setModalPontoPartida(prev => ({ ...prev, numero_inicial_mdfe: parseInt(e.target.value) || 1 }))}
                      className="w-full text-xs font-mono font-bold text-slate-800 border border-slate-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalPontoPartida(prev => ({ ...prev, open: false }))}
                  disabled={modalPontoPartida.saving}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={modalPontoPartida.saving}
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl transition shadow-sm"
                >
                  {modalPontoPartida.saving ? 'Salvando...' : 'Salvar e Recalcular'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
