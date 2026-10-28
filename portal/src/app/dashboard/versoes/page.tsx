'use client'

import { useState, useEffect } from 'react'
import { 
  Rocket, Plus, Download, CheckCircle2, AlertTriangle, RefreshCw, 
  Trash2, ShieldAlert, Laptop, Eye, Copy, ExternalLink, Sliders, 
  UploadCloud, FileCode2, Store, MonitorCheck, Zap, UtensilsCrossed, 
  Scale, HardDrive, Check, Clock, Globe, ArrowUpDown
} from 'lucide-react'
import toast from 'react-hot-toast'

interface VersaoSistema {
  id: string
  sistema_id: string
  versao: string
  build_number: number
  obrigatoria: boolean
  url_download: string
  changelog?: string
  sha256?: string
  tamanho_bytes?: number
  canal: string
  ativo: boolean
  criado_em: string
  atualizado_em: string
}

interface TelemetriaItem {
  sistema_id: string
  versao_atual: string
  ultima_checagem: string
  cliente_id: string
  nome_computador?: string
  politica_configurada?: string
  clientes?: {
    razao_social?: string
    nome_fantasia?: string
  }
}

interface ClientePolitica {
  id: string
  razao_social: string
  nome_fantasia?: string
  cnpj: string
  politica_atualizacao?: string
}

const SISTEMAS_PREDEFINIDOS = [
  { id: 'mei_simples', nome: 'MEI Simples', icon: Store, cor: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
  { id: 'hub_desktop', nome: 'Hub Desktop (.NET)', icon: HardDrive, cor: 'text-blue-600 bg-blue-50 border-blue-200' },
  { id: 'tech_slim', nome: 'TechSlim', icon: MonitorCheck, cor: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  { id: 'tech_pro', nome: 'TechPro', icon: Zap, cor: 'text-amber-600 bg-amber-50 border-amber-200' },
  { id: 'gastro', nome: 'Gastro (Food)', icon: UtensilsCrossed, cor: 'text-orange-600 bg-orange-50 border-orange-200' },
  { id: 'pes_ai', nome: 'Pes.Ai', icon: Scale, cor: 'text-purple-600 bg-purple-50 border-purple-200' },
]

export default function CentralVersoesPage() {
  const [versoes, setVersoes] = useState<VersaoSistema[]>([])
  const [telemetria, setTelemetria] = useState<TelemetriaItem[]>([])
  const [clientes, setClientes] = useState<ClientePolitica[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroSistema, setFiltroSistema] = useState<string>('todos')

  // Modais
  const [modalNovaVersao, setModalNovaVersao] = useState(false)
  const [modalPoliticas, setModalPoliticas] = useState(false)
  const [modalChangelog, setModalChangelog] = useState<VersaoSistema | null>(null)

  // Form Nova Versão
  const [formSistema, setFormSistema] = useState('mei_simples')
  const [formSistemaCustom, setFormSistemaCustom] = useState('')
  const [formVersao, setFormVersao] = useState('')
  const [formBuild, setFormBuild] = useState('')
  const [formUrlDownload, setFormUrlDownload] = useState('')
  const [formObrigatoria, setFormObrigatoria] = useState(false)
  const [formChangelog, setFormChangelog] = useState('')
  const [formCanal, setFormCanal] = useState('stable')
  const [uploadingFile, setUploadingFile] = useState(false)
  const [fileToUpload, setFileToUpload] = useState<File | null>(null)
  const [salvando, setSalvando] = useState(false)

  // Carregar Dados
  const carregarDados = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/hub/versoes')
      const data = await res.json()
      if (data.versoes) setVersoes(data.versoes)
      if (data.telemetria) setTelemetria(data.telemetria)

      // Carrega clientes para o modal de políticas
      const resCli = await fetch('/api/clientes')
      if (resCli.ok) {
        const dataCli = await resCli.json()
        setClientes(dataCli.clientes || [])
      }
    } catch (err: any) {
      toast.error('Erro ao carregar versões: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [])

  // Upload do instalador (.exe)
  const handleUploadInstalador = async () => {
    if (!fileToUpload) return
    const sisFinal = formSistema === 'outro' ? formSistemaCustom.trim() : formSistema
    if (!sisFinal) {
      toast.error('Informe o sistema antes de fazer o upload.')
      return
    }

    try {
      setUploadingFile(true)
      const formData = new FormData()
      formData.append('file', fileToUpload)
      formData.append('sistema_id', sisFinal)
      formData.append('versao', formVersao || '1.0.0')

      const res = await fetch('/api/hub/versoes/upload', {
        method: 'POST',
        body: formData
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro no upload')

      setFormUrlDownload(data.url)
      toast.success('Instalador enviado com sucesso!')
    } catch (err: any) {
      toast.error('Erro no upload: ' + err.message)
    } finally {
      setUploadingFile(false)
    }
  }

  // Salvar Nova Versão
  const handleSalvarVersao = async (e: React.FormEvent) => {
    e.preventDefault()
    const sisFinal = formSistema === 'outro' ? formSistemaCustom.trim().toLowerCase() : formSistema

    if (!sisFinal) {
      toast.error('Selecione ou digite o identificador do sistema.')
      return
    }
    if (!formVersao.trim()) {
      toast.error('Digite a versão (ex: 1.0.1).')
      return
    }
    if (!formUrlDownload.trim()) {
      toast.error('Faça upload do arquivo .exe ou insira uma URL de download.')
      return
    }

    try {
      setSalvando(true)
      const res = await fetch('/api/hub/versoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sistema_id: sisFinal,
          versao: formVersao.trim(),
          build_number: parseInt(formBuild || '1', 10),
          obrigatoria: formObrigatoria,
          url_download: formUrlDownload.trim(),
          changelog: formChangelog.trim(),
          canal: formCanal
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar versão')

      toast.success('Nova versão publicada com sucesso!')
      setModalNovaVersao(false)
      // Limpa form
      setFormVersao('')
      setFormBuild('')
      setFormUrlDownload('')
      setFormChangelog('')
      setFormObrigatoria(false)
      setFileToUpload(null)
      carregarDados()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSalvando(false)
    }
  }

  // Alternar Ativação
  const handleToggleAtivo = async (v: VersaoSistema) => {
    try {
      const res = await fetch('/api/hub/versoes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: v.id, ativo: !v.ativo })
      })
      if (!res.ok) throw new Error('Erro ao atualizar status')
      setVersoes(versoes.map(item => item.id === v.id ? { ...item, ativo: !item.ativo } : item))
      toast.success(v.ativo ? 'Versão desativada.' : 'Versão ativada!')
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  // Excluir Versão
  const handleExcluir = async (id: string) => {
    if (!confirm('Deseja realmente remover esta versão? Clientes antigos não conseguirão mais baixá-la.')) return
    try {
      const res = await fetch(`/api/hub/versoes?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erro ao excluir versão')
      setVersoes(versoes.filter(item => item.id !== id))
      toast.success('Versão removida.')
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  // Salvar Política de Atualização do Cliente
  const handleSalvarPoliticaCliente = async (clienteId: string, novaPolitica: string) => {
    try {
      const res = await fetch(`/api/clientes/${clienteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ politica_atualizacao: novaPolitica })
      })
      if (!res.ok) throw new Error('Erro ao atualizar política')
      setClientes(clientes.map(c => c.id === clienteId ? { ...c, politica_atualizacao: novaPolitica } : c))
      toast.success('Política atualizada!')
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  // Filtragem
  const versoesFiltradas = versoes.filter(v => filtroSistema === 'todos' || v.sistema_id === filtroSistema)

  // Metadados
  const sistemasUnicos = Array.from(new Set(versoes.map(v => v.sistema_id)))

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-300">
      
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <Rocket className="text-emerald-600 dark:text-emerald-400" size={32} />
            Central de Atualizações & Versões (Auto-Updater)
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Distribuição automática e sob demanda para todos os sistemas da Paratech (MEI Simples, Hub Desktop, TechSlim, TechPro, Gastro, Pes.Ai e futuros).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setModalPoliticas(true)}
            className="px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl transition flex items-center gap-2 shadow-2xs"
          >
            <Sliders size={16} className="text-slate-500" />
            Políticas por Empresa
          </button>
          <button
            onClick={() => setModalNovaVersao(true)}
            className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition flex items-center gap-2 shadow-sm cursor-pointer"
          >
            <Plus size={16} />
            Publicar Nova Versão
          </button>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Sistemas Ativos</span>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {sistemasUnicos.length > 0 ? sistemasUnicos.length : SISTEMAS_PREDEFINIDOS.length}
          </div>
          <span className="text-xs text-slate-400 mt-1 block">MEI, Hub, TechSlim, Gastro...</span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Versões Publicadas</span>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {versoes.filter(v => v.ativo).length} ativas
          </div>
          <span className="text-xs text-slate-400 mt-1 block">Total de {versoes.length} pacotes</span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Instalações Conectadas</span>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
            {telemetria.length} estações
          </div>
          <span className="text-xs text-slate-400 mt-1 block">Monitoradas via Telemetria</span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Modos de Rollout</span>
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">
            Híbrido
          </div>
          <span className="text-xs text-slate-400 mt-1 block">Automático e Informativo</span>
        </div>
      </div>

      {/* Seletor de Filtro por Sistema */}
      <div className="flex flex-wrap items-center gap-2 pb-2 overflow-x-auto">
        <button
          onClick={() => setFiltroSistema('todos')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
            filtroSistema === 'todos'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
          }`}
        >
          Todos os Sistemas ({versoes.length})
        </button>

        {SISTEMAS_PREDEFINIDOS.map(sis => {
          const count = versoes.filter(v => v.sistema_id === sis.id).length
          const IconComponent = sis.icon
          return (
            <button
              key={sis.id}
              onClick={() => setFiltroSistema(sis.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                filtroSistema === sis.id
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
              }`}
            >
              <IconComponent size={14} />
              {sis.nome} ({count})
            </button>
          )
        })}
      </div>

      {/* Lista de Versões */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 dark:text-white text-base flex items-center gap-2">
            <Rocket size={18} className="text-emerald-600" />
            Tabela de Versões & Pacotes Disponíveis
          </h3>
          <button
            onClick={carregarDados}
            disabled={loading}
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
            title="Recarregar"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400">Carregando versões...</div>
        ) : versoesFiltradas.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Rocket size={40} className="mx-auto text-slate-300 dark:text-slate-600" />
            <h4 className="font-semibold text-slate-700 dark:text-slate-300">Nenhuma versão publicada para este filtro</h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Clique em <strong>Publicar Nova Versão</strong> para fazer o upload do instalador .exe do MEI Simples, Hub Desktop ou outro aplicativo.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-3.5">Sistema</th>
                  <th className="p-3.5">Versão / Build</th>
                  <th className="p-3.5">Tipo de Atualização</th>
                  <th className="p-3.5">Canal</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Publicado Em</th>
                  <th className="p-3.5">Instalador / Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-medium">
                {versoesFiltradas.map(v => {
                  const pre = SISTEMAS_PREDEFINIDOS.find(s => s.id === v.sistema_id)
                  const nomeSistema = pre?.nome || v.sistema_id.toUpperCase()
                  const Icon = pre?.icon || Rocket

                  return (
                    <tr key={v.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/40 transition">
                      <td className="p-3.5">
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded-lg border ${pre?.cor || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                            <Icon size={16} />
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white block">{nomeSistema}</span>
                            <span className="text-[11px] text-slate-400 font-mono">{v.sistema_id}</span>
                          </div>
                        </div>
                      </td>

                      <td className="p-3.5">
                        <span className="text-sm font-bold text-slate-900 dark:text-white">v{v.versao}</span>
                        <span className="text-slate-400 text-[11px] block font-mono">Build #{v.build_number}</span>
                      </td>

                      <td className="p-3.5">
                        {v.obrigatoria ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <ShieldAlert size={12} /> Obrigatória (Crítica)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                            <CheckCircle2 size={12} /> Opcional / Normal
                          </span>
                        )}
                      </td>

                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          {v.canal}
                        </span>
                      </td>

                      <td className="p-3.5">
                        <button
                          onClick={() => handleToggleAtivo(v)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition flex items-center gap-1 ${
                            v.ativo
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${v.ativo ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                          {v.ativo ? 'Ativa' : 'Inativa'}
                        </button>
                      </td>

                      <td className="p-3.5 text-slate-500">
                        {new Date(v.criado_em).toLocaleDateString('pt-BR')} às {new Date(v.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </td>

                      <td className="p-3.5">
                        <div className="flex items-center gap-1.5">
                          {/* Botão Ver Changelog */}
                          {v.changelog && (
                            <button
                              onClick={() => setModalChangelog(v)}
                              className="p-1.5 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                              title="Ver Novidades / Changelog"
                            >
                              <FileCode2 size={15} />
                            </button>
                          )}

                          {/* Copiar Link */}
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(v.url_download)
                              toast.success('Link do instalador copiado!')
                            }}
                            className="p-1.5 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                            title="Copiar Link de Download"
                          >
                            <Copy size={15} />
                          </button>

                          {/* Baixar */}
                          <a
                            href={v.url_download}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition"
                            title="Baixar Instalador"
                          >
                            <Download size={15} />
                          </a>

                          {/* Excluir */}
                          <button
                            onClick={() => handleExcluir(v.id)}
                            className="p-1.5 text-rose-600 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 rounded-lg transition"
                            title="Excluir Versão"
                          >
                            <Trash2 size={15} />
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
      </div>

      {/* Telemetria de Clientes Conectados */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h3 className="font-bold text-slate-800 dark:text-white text-base flex items-center gap-2">
              <Laptop size={18} className="text-blue-600" />
              Telemetria das Estações de Trabalho (Clientes Conectados)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Identifica em tempo real qual versão cada estabelecimento e caixa está rodando.
            </p>
          </div>
          <span className="text-xs font-semibold bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg border border-blue-200">
            {telemetria.length} estações registradas
          </span>
        </div>

        {telemetria.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400">
            Nenhuma checagem de versão recebida ainda. Conforme os clientes abrirem o MEI Simples ou Hub, aparecerão aqui.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-900/60 uppercase font-semibold text-slate-500">
                <tr>
                  <th className="p-3">Empresa / Razão Social</th>
                  <th className="p-3">Sistema</th>
                  <th className="p-3">Estação / PC</th>
                  <th className="p-3">Versão Atual</th>
                  <th className="p-3">Política</th>
                  <th className="p-3">Última Checagem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {telemetria.map((t, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30">
                    <td className="p-3 font-semibold text-slate-800 dark:text-white">
                      {t.clientes?.nome_fantasia || t.clientes?.razao_social || 'Estação Não Vinculada'}
                    </td>
                    <td className="p-3 font-mono uppercase text-slate-600 dark:text-slate-400">
                      {t.sistema_id}
                    </td>
                    <td className="p-3 text-slate-600 dark:text-slate-400">
                      {t.nome_computador || 'PC Principal'}
                    </td>
                    <td className="p-3">
                      <span className="font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200">
                        v{t.versao_atual}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                        t.politica_configurada === 'automatica'
                          ? 'bg-purple-50 text-purple-700 border border-purple-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}>
                        {t.politica_configurada || 'informativa'}
                      </span>
                    </td>
                    <td className="p-3 text-slate-400">
                      {new Date(t.ultima_checagem).toLocaleDateString('pt-BR')} {new Date(t.ultima_checagem).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: Publicar Nova Versão */}
      {modalNovaVersao && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Rocket className="text-emerald-600" size={20} />
                Publicar Nova Versão de Sistema
              </h3>
              <button
                onClick={() => setModalNovaVersao(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold p-1"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSalvarVersao} className="space-y-4 text-xs">
              {/* Sistema */}
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Sistema da Paratech:</label>
                <select
                  value={formSistema}
                  onChange={e => setFormSistema(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-semibold text-slate-800 dark:text-white"
                >
                  {SISTEMAS_PREDEFINIDOS.map(s => (
                    <option key={s.id} value={s.id}>{s.nome} ({s.id})</option>
                  ))}
                  <option value="outro">+ Outro Sistema (Personalizado)...</option>
                </select>
              </div>

              {formSistema === 'outro' && (
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Identificador do Novo Sistema (ID):</label>
                  <input
                    type="text"
                    placeholder="ex: bartech, dispenser, totem"
                    value={formSistemaCustom}
                    onChange={e => setFormSistemaCustom(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    required
                  />
                </div>
              )}

              {/* Versão e Build */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Número da Versão:</label>
                  <input
                    type="text"
                    placeholder="ex: 1.0.1 ou 2.7.0"
                    value={formVersao}
                    onChange={e => setFormVersao(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Build Number (Inteiro):</label>
                  <input
                    type="number"
                    placeholder="ex: 101 ou 270"
                    value={formBuild}
                    onChange={e => setFormBuild(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono font-bold"
                    required
                  />
                </div>
              </div>

              {/* Upload ou URL do Instalador */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-2">
                <label className="font-bold text-slate-800 dark:text-white block">Instalador / Executável (.exe):</label>
                
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    accept=".exe,.zip,.msi"
                    onChange={e => setFileToUpload(e.target.files?.[0] || null)}
                    className="text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
                  />
                  {fileToUpload && (
                    <button
                      type="button"
                      onClick={handleUploadInstalador}
                      disabled={uploadingFile}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold flex items-center gap-1 cursor-pointer"
                    >
                      {uploadingFile ? <RefreshCw size={13} className="animate-spin" /> : <UploadCloud size={13} />}
                      {uploadingFile ? 'Enviando...' : 'Fazer Upload'}
                    </button>
                  )}
                </div>

                <div className="mt-2">
                  <label className="text-[11px] text-slate-500 block mb-0.5">Ou URL Direta de Download:</label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={formUrlDownload}
                    onChange={e => setFormUrlDownload(e.target.value)}
                    className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
                    required
                  />
                </div>
              </div>

              {/* Atualização Obrigatória / Crítica */}
              <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50/70 border border-amber-200">
                <input
                  type="checkbox"
                  id="chkObrig"
                  checked={formObrigatoria}
                  onChange={e => setFormObrigatoria(e.target.checked)}
                  className="mt-0.5 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                />
                <label htmlFor="chkObrig" className="text-xs text-amber-900 cursor-pointer">
                  <strong>Atualização Obrigatória / Crítica:</strong> Força a atualização imediatamente em todas as estações de trabalho e caixas na próxima abertura (ignora a opção de adiar do cliente). Ideal para mudanças fiscais da SEFAZ ou correções graves.
                </label>
              </div>

              {/* Changelog */}
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Notas da Versão (O que há de novo):</label>
                <textarea
                  rows={4}
                  placeholder="• Inclusão do módulo Contas a Pagar&#10;• Correção na segregação monofásica&#10;• Melhoria na velocidade de impressão"
                  value={formChangelog}
                  onChange={e => setFormChangelog(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-sans"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setModalNovaVersao(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  {salvando ? <RefreshCw size={14} className="animate-spin" /> : <Rocket size={14} />}
                  Publicar Versão
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Políticas por Empresa */}
      {modalPoliticas && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sliders className="text-blue-600" size={20} />
                  Políticas de Atualização por Empresa
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Defina se a aplicação no cliente deve atualizar silenciosamente ou apenas avisar na tela.
                </p>
              </div>
              <button
                onClick={() => setModalPoliticas(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold p-1"
              >
                ×
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/60">
              {clientes.map(cli => (
                <div key={cli.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="font-bold text-slate-800 dark:text-white block">
                      {cli.nome_fantasia || cli.razao_social}
                    </span>
                    <span className="text-slate-400 font-mono text-[11px]">{cli.cnpj}</span>
                  </div>

                  <select
                    value={cli.politica_atualizacao || 'padrao'}
                    onChange={e => handleSalvarPoliticaCliente(cli.id, e.target.value)}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-semibold text-slate-700 dark:text-slate-300 text-xs"
                  >
                    <option value="padrao">Padrão (Escolha do Usuário)</option>
                    <option value="automatica">⚡ Automática (Silenciosa)</option>
                    <option value="informativa">🔔 Informativa (Pergunta ao Usuário)</option>
                  </select>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setModalPoliticas(false)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl font-bold text-xs cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Ver Changelog */}
      {modalChangelog && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileCode2 className="text-emerald-600" size={18} />
                Novidades da Versão {modalChangelog.versao}
              </h3>
              <button
                onClick={() => setModalChangelog(null)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold p-1"
              >
                ×
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl text-xs text-slate-700 dark:text-slate-300 whitespace-pre-line font-mono leading-relaxed max-h-72 overflow-y-auto">
              {modalChangelog.changelog}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setModalChangelog(null)}
                className="px-4 py-1.5 bg-slate-900 text-white rounded-xl font-bold text-xs cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
