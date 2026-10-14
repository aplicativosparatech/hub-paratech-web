'use client'

import { useState, useEffect } from 'react'
import { 
  Activity, CheckCircle2, AlertTriangle, XCircle, RefreshCw, 
  ChevronRight, X, ExternalLink, ShieldAlert, ShieldCheck, 
  Clock, Server, Search, Radio, Wifi
} from 'lucide-react'
import toast from 'react-hot-toast'
import { ServicoSefazStatus, SefazStatusGeralResponse } from '@/app/api/sefaz/status/route'

export const ESTADOS_POR_AUTORIZADOR: Record<string, { nome: string; ufs: string[]; descricao?: string }> = {
  'AM': { nome: 'Amazonas', ufs: ['AM'] },
  'BA': { nome: 'Bahia', ufs: ['BA'] },
  'GO': { nome: 'Goiás', ufs: ['GO'] },
  'MG': { nome: 'Minas Gerais', ufs: ['MG'] },
  'MS': { nome: 'Mato Grosso do Sul', ufs: ['MS'] },
  'MT': { nome: 'Mato Grosso', ufs: ['MT'] },
  'PE': { nome: 'Pernambuco', ufs: ['PE'] },
  'PR': { nome: 'Paraná', ufs: ['PR'] },
  'RS': { nome: 'Rio Grande do Sul', ufs: ['RS'] },
  'SP': { nome: 'São Paulo', ufs: ['SP'] },
  'SVAN': { nome: 'SEFAZ Virtual AN', ufs: ['MA', 'PA', 'PI'], descricao: 'Atende MA, PA e PI' },
  'SVRS': { 
    nome: 'SEFAZ Virtual RS', 
    ufs: ['AC', 'AL', 'AP', 'DF', 'ES', 'PB', 'RJ', 'RN', 'RO', 'RR', 'SC', 'SE', 'TO'], 
    descricao: 'Atende RJ, ES, SC, DF, AL, PB, RN, SE, TO, AC, AP, RO, RR' 
  },
  'SVC-AN': { nome: 'Contingência SVC-AN', ufs: ['AC', 'AL', 'AP', 'DF', 'ES', 'MG', 'PB', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'], descricao: 'Servidor Virtual de Contingência Nacional' },
  'SVC-RS': { nome: 'Contingência SVC-RS', ufs: ['AM', 'BA', 'GO', 'MA', 'MS', 'MT', 'PA', 'PE', 'PI', 'PR'], descricao: 'Servidor Virtual de Contingência RS' }
}

export default function SefazStatusBadge() {
  const [statusData, setStatusData] = useState<SefazStatusGeralResponse | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [refreshing, setRefreshing] = useState<boolean>(false)
  const [modalOpen, setModalOpen] = useState<boolean>(false)
  const [filtroUf, setFiltroUf] = useState<string>('')
  const [abaFiltro, setAbaFiltro] = useState<'todos' | 'instaveis' | 'principais'>('todos')

  // Busca o status inicial
  const carregarStatus = async (force = false) => {
    if (force) setRefreshing(true)
    try {
      const url = force ? '/api/sefaz/status?force=true' : '/api/sefaz/status'
      const res = await fetch(url)
      if (res.ok) {
        const data: SefazStatusGeralResponse = await res.json()
        setStatusData(data)
        if (force) {
          toast.success('Status da SEFAZ atualizado com sucesso!')
        }
      }
    } catch (err) {
      console.warn('Erro ao carregar status da SEFAZ:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    carregarStatus()

    // Atualiza a cada 3 minutos em segundo plano
    const interval = setInterval(() => {
      carregarStatus()
    }, 180000)

    return () => clearInterval(interval)
  }, [])

  // Cores e estilos baseados no status geral
  const getStatusColorConfig = () => {
    if (!statusData) {
      return {
        bg: 'bg-slate-100 dark:bg-slate-800/80',
        border: 'border-slate-200 dark:border-slate-700',
        text: 'text-slate-600 dark:text-slate-300',
        dot: 'bg-slate-400',
        ping: 'bg-slate-400',
        label: 'Verificando SEFAZ...',
        sublabel: 'Carregando disponibilidade'
      }
    }

    switch (statusData.statusGeral) {
      case 'inoperante':
        return {
          bg: 'bg-red-500/10 dark:bg-red-950/40',
          border: 'border-red-300 dark:border-red-800/80',
          text: 'text-red-700 dark:text-red-400',
          dot: 'bg-red-500',
          ping: 'bg-red-400',
          label: 'SEFAZ: Inoperante',
          sublabel: 'Servidores indisponíveis'
        }
      case 'falhas':
        return {
          bg: 'bg-orange-500/10 dark:bg-orange-950/40',
          border: 'border-orange-300 dark:border-orange-800/80',
          text: 'text-orange-700 dark:text-orange-400',
          dot: 'bg-orange-500',
          ping: 'bg-orange-400',
          label: 'SEFAZ: Com Falhas',
          sublabel: `${statusData.totalFalhas} autorizador(es) fora`
        }
      case 'instavel':
        return {
          bg: 'bg-amber-500/10 dark:bg-amber-950/40',
          border: 'border-amber-300 dark:border-amber-800/80',
          text: 'text-amber-700 dark:text-amber-400',
          dot: 'bg-amber-500',
          ping: 'bg-amber-400',
          label: 'SEFAZ: Instável',
          sublabel: `${statusData.totalInstaveis} serviço(s) c/ lentidão`
        }
      case 'estavel':
      default:
        return {
          bg: 'bg-emerald-500/10 dark:bg-emerald-950/40',
          border: 'border-emerald-300/80 dark:border-emerald-800/80',
          text: 'text-emerald-700 dark:text-emerald-400',
          dot: 'bg-emerald-500',
          ping: 'bg-emerald-400',
          label: 'SEFAZ: Operante',
          sublabel: 'Servidores 100% Estáveis'
        }
    }
  }

  const cfg = getStatusColorConfig()

  // Filtragem dos autorizadores no modal (suporta buscar por qualquer estado, ex: RJ, SC, ES, MG)
  const autorizadoresFiltrados = (statusData?.autorizadores || []).filter(item => {
    const q = filtroUf.toLowerCase().trim()
    if (q) {
      const info = ESTADOS_POR_AUTORIZADOR[item.autorizador]
      const matchAut = item.autorizador.toLowerCase().includes(q)
      const matchNome = info?.nome.toLowerCase().includes(q)
      const matchUfs = info?.ufs.some(u => u.toLowerCase() === q || u.toLowerCase().includes(q))
      if (!matchAut && !matchNome && !matchUfs) return false
    }

    if (abaFiltro === 'instaveis') {
      const temAmarela = Object.values(item).includes('amarela')
      const temVermelha = Object.values(item).includes('vermelha')
      return temAmarela || temVermelha
    }

    if (abaFiltro === 'principais') {
      const principais = ['MG', 'SP', 'RS', 'PR', 'SVRS', 'SVAN', 'SVC-AN', 'SVC-RS']
      return principais.includes(item.autorizador)
    }

    return true
  })

  // Render do badge de status individual de cada serviço
  const renderItemStatusIcon = (st: 'verde' | 'amarela' | 'vermelha' | 'desconhecido') => {
    switch (st) {
      case 'verde':
        return <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs" title="Disponível e Estável" />
      case 'amarela':
        return <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shadow-xs" title="Instável / Lentidão" />
      case 'vermelha':
        return <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 shadow-xs" title="Inoperante / Fora do ar" />
      default:
        return <span className="inline-block w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-700" title="Não se aplica / Sem dados" />
    }
  }

  return (
    <>
      {/* BADGE COMPACTO E ELEGANTE NA SIDEBAR (EMBAIXO DO NOME HUBPARATECH) */}
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className={`w-full text-left p-2.5 rounded-xl border transition-all duration-200 group flex items-center justify-between cursor-pointer select-none ${cfg.bg} ${cfg.border} hover:scale-[1.01]`}
        title="Clique para ver o status detalhado de todos os servidores da SEFAZ"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Ponto Pulsante de Status em Tempo Real */}
          <div className="relative flex items-center justify-center w-3 h-3 flex-shrink-0">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${cfg.ping}`} />
            <span className={`relative inline-flex rounded-full h-2 w-2 ${cfg.dot}`} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className={`text-[12px] font-black tracking-tight leading-none ${cfg.text}`}>
                {cfg.label}
              </span>
            </div>
            <div className="text-[10px] text-slate-400 dark:text-slate-400 font-medium truncate mt-0.5">
              {cfg.sublabel}
            </div>
          </div>
        </div>

        <div className="flex items-center text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-colors ml-1">
          <ChevronRight size={15} />
        </div>
      </button>

      {/* MODAL DETALHADO DE DISPONIBILIDADE DA SEFAZ */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-[#0B1120] rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            
            {/* Header do Modal */}
            <div className="p-5 sm:p-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-4 flex-shrink-0">
              <div className="flex items-start gap-3.5">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 border ${cfg.bg} ${cfg.border} ${cfg.text}`}>
                  <Activity size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-black text-slate-900 dark:text-white">
                      Disponibilidade dos Servidores da SEFAZ
                    </h3>
                    <span className={`text-[11px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${cfg.bg} ${cfg.border} ${cfg.text}`}>
                      {cfg.label.replace('SEFAZ: ', '')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Monitoramento oficial de autorizadores estaduais e nacionais de NF-e e NFC-e em tempo real.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Sub-Header com Métricas e Botão Atualizar */}
            <div className="px-5 sm:px-6 py-3 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs flex-shrink-0">
              <div className="flex items-center gap-4 text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Clock size={14} className="text-slate-400" />
                  Última checagem: <strong className="text-slate-700 dark:text-slate-200">{statusData?.ultimaVerificacao || 'Agora'}</strong>
                </span>
                <span className="flex items-center gap-1.5">
                  <Wifi size={14} className="text-slate-400" />
                  Latência: <strong className="text-slate-700 dark:text-slate-200">{statusData?.tempoRespostaMs || 0}ms</strong>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => carregarStatus(true)}
                  disabled={refreshing}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                  <span>{refreshing ? 'Verificando...' : 'Verificar Agora'}</span>
                </button>
              </div>
            </div>

            {/* Filtros e Busca */}
            <div className="p-4 sm:px-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 flex-shrink-0">
              {/* Abas Rápidas */}
              <div className="flex items-center gap-1 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setAbaFiltro('todos')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    abaFiltro === 'todos' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Todos ({statusData?.autorizadores.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setAbaFiltro('principais')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    abaFiltro === 'principais' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Principais (MG, SP, RS, SVC)
                </button>
                <button
                  type="button"
                  onClick={() => setAbaFiltro('instaveis')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    abaFiltro === 'instaveis' 
                      ? 'bg-amber-600 text-white' 
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Com Instabilidades ({(statusData?.totalInstaveis || 0) + (statusData?.totalFalhas || 0)})
                </button>
              </div>

              {/* Input Filtro de UF */}
              <div className="relative w-full sm:w-48">
                <input
                  type="text"
                  maxLength={6}
                  value={filtroUf}
                  onChange={(e) => setFiltroUf(e.target.value)}
                  placeholder="Buscar UF (ex: MG)..."
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs uppercase font-bold text-slate-800 dark:text-slate-200 placeholder:normal-case placeholder:font-normal focus:outline-none"
                />
                <Search size={14} className="absolute left-2.5 top-2 text-slate-400" />
              </div>
            </div>

            {/* Tabela de Serviços por Autorizador */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 space-y-4">
              
              {/* Banner Dinâmico de Diagnóstico dos Estados */}
              {statusData && (statusData.totalInstaveis > 0 || statusData.totalFalhas > 0) ? (
                <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 flex items-start gap-3 text-xs text-amber-900 dark:text-amber-200">
                  <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-bold">Atenção Fiscal:</strong> Há {statusData.totalInstaveis} serviço(s) com lentidão / instabilidade e {statusData.totalFalhas} inoperante(s).
                    <div className="text-[11px] text-amber-800 dark:text-amber-300 mt-1">
                      <strong>Estados / Autorizadores com alerta:</strong> {statusData.autorizadores
                        .filter(a => [a.autorizacao, a.retornoAutorizacao, a.statusServico, a.consultaProtocolo, a.recepcaoEvento].some(v => v === 'amarela' || v === 'vermelha'))
                        .map(a => `${a.autorizador} (${ESTADOS_POR_AUTORIZADOR[a.autorizador]?.nome || a.autorizador})`)
                        .join(', ')}.
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-2.5 text-xs text-emerald-800 dark:text-emerald-300">
                  <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                  <span><strong>Todos os 27 estados e o DF</strong> estão operando com 100% de estabilidade e servidores verdes na SEFAZ neste momento.</span>
                </div>
              )}

              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-900 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-4 py-2.5">Autorizador / Estados</th>
                      <th className="px-2 py-2.5 text-center" title="Autorização de NF-e e NFC-e">Autorização</th>
                      <th className="px-2 py-2.5 text-center" title="Retorno de Lote">Retorno</th>
                      <th className="px-2 py-2.5 text-center" title="Consulta Protocolo">Protocolo</th>
                      <th className="px-2 py-2.5 text-center" title="Status do Serviço (Webservice)">Status Serv.</th>
                      <th className="px-2 py-2.5 text-center" title="Recepção de Eventos (CC-e e Cancelamento)">Eventos</th>
                      <th className="px-2 py-2.5 text-center">Tempo Médio</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                    {autorizadoresFiltrados.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-400 italic">
                          Nenhum autorizador correspondente aos filtros.
                        </td>
                      </tr>
                    ) : (
                      autorizadoresFiltrados.map((aut) => {
                        const isSvc = aut.autorizador.startsWith('SVC')
                        const info = ESTADOS_POR_AUTORIZADOR[aut.autorizador]
                        return (
                          <tr 
                            key={aut.autorizador} 
                            className={`hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors ${
                              isSvc ? 'bg-blue-50/20 dark:bg-blue-950/20 font-bold' : ''
                            }`}
                          >
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                                  {aut.autorizador}
                                </span>
                                {isSvc && (
                                  <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                                    Contingência
                                  </span>
                                )}
                              </div>
                              {info?.descricao ? (
                                <div className="text-[10px] text-blue-600 dark:text-blue-400 font-medium truncate max-w-[280px]" title={info.descricao}>
                                  {info.descricao}
                                </div>
                              ) : info?.nome && !isSvc ? (
                                <div className="text-[10px] text-slate-400">
                                  {info.nome}
                                </div>
                              ) : null}
                            </td>
                            <td className="px-2 py-2.5 text-center">{renderItemStatusIcon(aut.autorizacao)}</td>
                            <td className="px-2 py-2.5 text-center">{renderItemStatusIcon(aut.retornoAutorizacao)}</td>
                            <td className="px-2 py-2.5 text-center">{renderItemStatusIcon(aut.consultaProtocolo)}</td>
                            <td className="px-2 py-2.5 text-center">{renderItemStatusIcon(aut.statusServico)}</td>
                            <td className="px-2 py-2.5 text-center">{renderItemStatusIcon(aut.recepcaoEvento)}</td>
                            <td className="px-2 py-2.5 text-center font-mono text-[11px] text-slate-500">
                              {aut.tempoMedio}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Legenda dos Indicadores */}
              <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-4 flex-wrap">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <strong>Verde:</strong> Operante e Estável
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <strong>Amarelo:</strong> Instabilidade / Lentidão
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                    <strong>Vermelho:</strong> Inoperante / Falha
                  </span>
                </div>

                <a
                  href="https://www.nfe.fazenda.gov.br/portal/disponibilidade.aspx"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 font-bold hover:underline flex items-center gap-1 text-[11px]"
                >
                  Portal da NF-e Oficial
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>

            {/* Footer do Modal */}
            <div className="p-4 sm:px-6 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-[#0B1120] flex items-center justify-between flex-shrink-0">
              <span className="text-[11px] text-slate-400">
                HubParatech Telemetria Fiscal
              </span>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Concluir
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  )
}
