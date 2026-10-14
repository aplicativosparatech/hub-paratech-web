'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { 
  GraduationCap, Bot, Sparkles, Compass, CheckCircle2, Circle, ArrowRight,
  ArrowLeft, Search, Send, RefreshCw, Key, ShieldCheck, FileText, 
  ExternalLink, HelpCircle, BookOpen, Layers, Lightbulb, Play, Check,
  ChevronDown, ChevronUp, Copy, CheckCheck, Laptop, Building2, 
  ScanText, Database, Receipt, BarChart3, AlertCircle
} from 'lucide-react'
import toast from 'react-hot-toast'
import { APP_VERSION } from '@/utils/version'

interface TourStep {
  id: string
  titulo: string
  modulo: string
  rota: string
  icone: any
  descricao: string
  pontosChave: string[]
  dicaOuro: string
}

const PASSOS_TOUR: TourStep[] = [
  {
    id: 'passo-1',
    titulo: '1. Monitoramento SEFAZ & Dashboard Fiscal',
    modulo: 'Dashboard',
    rota: '/dashboard',
    icone: BarChart3,
    descricao: 'Visualize o volume de notas emitidas, faturamento total, alertas de vencimento de certificados A1 e o semáforo de status em tempo real dos servidores da SEFAZ de todos os estados.',
    pontosChave: [
      'Semáforo da SEFAZ logo abaixo da logo na barra lateral',
      'Alertas preventivos de certificados digitais vencendo em até 30 dias',
      'Métricas de notas sincronizadas pelo Hub Desktop'
    ],
    dicaOuro: 'Clique no selo de status da SEFAZ a qualquer momento para abrir o mapa detalhado com a situação dos servidores de MG, SP, RJ, RS e demais estados.'
  },
  {
    id: 'passo-2',
    titulo: '2. Emissão de DANFE e Consulta SEFAZ',
    modulo: 'Notas Fiscais',
    rota: '/dashboard/notas-fiscais',
    icone: FileText,
    descricao: 'Pesquise e audite todas as NF-e e NFC-e emitidas ou recebidas, com filtros persistentes sincronizados que continuam salvos ao trocar de tela.',
    pontosChave: [
      'Gere a DANFE em PDF personalizada com o logotipo oficial do cliente cadastrado',
      'Botão "Consultar SEFAZ": abre o portal oficial e copia a chave de acesso de 44 dígitos',
      'Download em lote em formato compactado ZIP'
    ],
    dicaOuro: 'Ao filtrar por uma data ou cliente em Entradas, o mesmo filtro se mantém ativo ao mudar para Saídas ou NFC-e!'
  },
  {
    id: 'passo-3',
    titulo: '3. Sugestor Tributário com IA & OCR',
    modulo: 'Sugestor Tributário',
    rota: '/dashboard/sugestor-tributario',
    icone: ScanText,
    descricao: 'Descubra a tributação exata de mercadorias instantaneamente. Digite o nome do produto, faça upload de planilha Excel ou envie a foto de um cupom ou prateleira.',
    pontosChave: [
      'Sugestão completa de NCM, CEST, CFOP (interno e interestadual), CSOSN/CST',
      'Previsão oficial dos novos tributos da Reforma Tributária (IBS e CBS - IVA Dual)',
      'Leitura OCR por Inteligência Artificial de fotos de produtos e etiquetas',
      'Exportação da tabela totalmente tributada pronta para o seu ERP'
    ],
    dicaOuro: 'Selecione o CRT correto do cliente (Simples Nacional ou Regime Normal) antes de buscar para que os CSOSNs ou CSTs venham devidamente calibrados.'
  },
  {
    id: 'passo-4',
    titulo: '4. Corretor Tributário de XMLs & Reforma',
    modulo: 'Corretor Tributário',
    rota: '/dashboard/corretor-tributario',
    icone: Sparkles,
    descricao: 'Audite os arquivos XML emitidos pelo seu sistema para identificar inconsistências cadastrais e antecipar a adequação aos tributos IBS e CBS da EC 132/2023.',
    pontosChave: [
      'Validação de alíquotas zeradas indevidamente',
      'Identificação de itens da Cesta Básica Nacional e regimes diferenciados',
      'Conformidade com os leiautes técnicos da Receita Federal'
    ],
    dicaOuro: 'O Corretor aponta divergências antes que o arquivo seja transmitido para a contabilidade ou para o Fisco.'
  },
  {
    id: 'passo-5',
    titulo: '5. Saneador de Arquivos & Bancos de Dados',
    modulo: 'Saneador de Arquivos',
    rota: '/dashboard/saneador-arquivos',
    icone: Database,
    descricao: 'Higienize cadastros legados, arquivos texto de exportação e planilhas corrompidas de forma automatizada.',
    pontosChave: [
      'Correção de caracteres especiais e pontuações inválidas',
      'Preenchimento de NCMs desatualizados ou extintos',
      'Sanitização em lote com download do arquivo corrigido'
    ],
    dicaOuro: 'Utilize o saneador sempre que for realizar uma migração de banco de dados ou fechamento anual de inventário.'
  },
  {
    id: 'passo-6',
    titulo: '6. Gestão de Clientes e CNPJ Alfanumérico',
    modulo: 'Clientes & Contabilidades',
    rota: '/dashboard/clientes',
    icone: Building2,
    descricao: 'Cadastre e gerencie empresas com consulta instantânea em cascata na ReceitaWS, BrasilAPI e suporte nativo ao novo CNPJ Alfanumérico.',
    pontosChave: [
      'Compatível com a Instrução Normativa RFB nº 2.229/2024 (letras no CNPJ)',
      'Algoritmo oficial Módulo 11 com conversão de caracteres alfanuméricos',
      'Preenchimento automático de Razão Social, Fantasia, Endereço, Regime e Contatos',
      'Upload da logomarca oficial para inclusão automática em DANFEs'
    ],
    dicaOuro: 'Basta digitar os 14 caracteres do CNPJ e clicar na lupa para que todos os campos cadastrais sejam preenchidos em segundos.'
  },
  {
    id: 'passo-7',
    titulo: '7. Hub Desktop & Sincronização Windows',
    modulo: 'Configurações Hub',
    rota: '/dashboard/configuracoes',
    icone: Laptop,
    descricao: 'O Hub Desktop roda silenciosamente na bandeja do Windows nas máquinas de clientes e servidores, sincronizando todos os XMLs em segundo plano.',
    pontosChave: [
      'Monitoramento de pastas locais do ERP em tempo real',
      'Compactação e upload seguro de NF-e e NFC-e emitidas',
      'Testes de contingência local e reconexão automática'
    ],
    dicaOuro: 'O Hub Desktop possui auto-reinicialização resiliente, garantindo que nenhum documento fiscal deixe de ser enviado para a contabilidade.'
  }
]

const PERGUNTAS_RAPIDAS = [
  'Como emitir a DANFE com a logomarca da empresa?',
  'Como funciona o Sugestor Tributário com IA e OCR?',
  'O que muda com o IBS e CBS na Reforma Tributária?',
  'Como cadastrar clientes com o novo CNPJ Alfanumérico?',
  'Como consultar a situação dos servidores da SEFAZ?',
  'Como o Hub Desktop sincroniza os XMLs do ERP?'
]

const FAQ_ITEMS = [
  {
    pergunta: 'Como obtenho uma chave gratuita da API do Google Gemini para usar com a IA?',
    resposta: 'Acesse o site oficial do Google AI Studio (aistudio.google.com), faça login com sua conta Google e clique em "Get API key". A chave gratuita (Free Tier) permite centenas de requisições diárias sem custo algum. Você pode colá-la na aba Integrações ou diretamente no chat desta tela!'
  },
  {
    pergunta: 'Qual o prazo limite para cancelamento de NF-e e NFC-e?',
    resposta: 'Para NF-e (modelo 55), o prazo padrão estabelecido pela SEFAZ é de 24 horas a partir da concessão da Autorização de Uso, desde que a mercadoria não tenha circulado. Para NFC-e (modelo 65), na maioria dos estados como MG e SP, o prazo padrão é de apenas 30 minutos após a emissão.'
  },
  {
    pergunta: 'O que são produtos monofásicos no Simples Nacional e como o Hub ajuda?',
    resposta: 'Produtos sujeitos à tributação monofásica de PIS/COFINS (como bebidas frias, medicamentos, cosméticos e autopeças) já recolheram esses tributos na indústria ou importador. No relatório "Produtos Monofásicos" do Hub Paratech, você gera a planilha exata para segregar essas receitas no PGDAS-D e evitar pagar imposto em duplicidade!'
  },
  {
    pergunta: 'O sistema continua funcionando se o servidor da SEFAZ estadual cair?',
    resposta: 'Sim! Quando a SEFAZ do seu estado entra em instabilidade, o Hub Paratech sinaliza no badge de status a ativação dos servidores de contingência nacional (SVC-AN ou SVC-RS). As notas emitidas em contingência continuam sendo sincronizadas normalmente assim que o serviço retorna.'
  }
]

export default function TutorialPage() {
  const [tabAtiva, setTabAtiva] = useState<'tour' | 'copiloto' | 'faq'>('tour')
  const [passosConcluidos, setPassosConcluidos] = useState<string[]>([])
  const [modalWalkthroughOpen, setModalWalkthroughOpen] = useState(false)
  const [walkthroughStepIndex, setWalkthroughStepIndex] = useState(0)

  // Estado do Chat Copiloto IA
  const [mensagens, setMensagens] = useState<Array<{ role: 'user' | 'assistant', content: string, titulo?: string, provedor?: string }>>([
    {
      role: 'assistant',
      content: `Olá! Sou o **Copiloto Fiscal do Hub Paratech** 🤖✨\n\nEstou aqui para tirar todas as suas dúvidas operacionais e fiscais. Posso te ensinar a emitir DANFEs, sugerir NCMs com o novo **IBS e CBS**, explicar como funciona o **CNPJ Alfanumérico** ou auditar seus XMLs.\n\nEscolha uma das perguntas sugeridas abaixo ou digite sua dúvida livremente!`
    }
  ])
  const [inputMensagem, setInputMensagem] = useState('')
  const [enviandoMensagem, setEnviandoMensagem] = useState(false)
  const [geminiApiKeyInput, setGeminiApiKeyInput] = useState('')
  const [showConfigKey, setShowConfigKey] = useState(false)
  const [faqAberto, setFaqAberto] = useState<number | null>(null)
  const [copiadoIdx, setCopiadoIdx] = useState<number | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Carregar passos concluídos e chave do localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('hub_tutorial_concluidos')
      if (saved) {
        setPassosConcluidos(JSON.parse(saved))
      }
      const savedKey = localStorage.getItem('hub_gemini_api_key')
      if (savedKey) {
        setGeminiApiKeyInput(savedKey)
      }
    } catch {}
  }, [])

  useEffect(() => {
    if (tabAtiva === 'copiloto') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [mensagens, tabAtiva])

  const togglePassoConcluido = (id: string) => {
    let novos: string[] = []
    if (passosConcluidos.includes(id)) {
      novos = passosConcluidos.filter(item => item !== id)
    } else {
      novos = [...passosConcluidos, id]
      toast.success('Etapa marcada como concluída! 🎉')
    }
    setPassosConcluidos(novos)
    localStorage.setItem('hub_tutorial_concluidos', JSON.stringify(novos))
  }

  const salvarChaveCustom = () => {
    localStorage.setItem('hub_gemini_api_key', geminiApiKeyInput.trim())
    toast.success('Chave da API Gemini salva localmente no navegador!')
    setShowConfigKey(false)
  }

  const handleEnviarMensagem = async (texto?: string) => {
    const msg = (texto || inputMensagem).trim()
    if (!msg || enviandoMensagem) return

    const novaMensagemUsuario = { role: 'user' as const, content: msg }
    const novoHistorico = [...mensagens, novaMensagemUsuario]
    setMensagens(novoHistorico)
    setInputMensagem('')
    setEnviandoMensagem(true)

    try {
      const res = await fetch('/api/tutorial/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          history: novoHistorico.slice(-6),
          customApiKey: geminiApiKeyInput.trim() || undefined
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao consultar Copiloto IA.')

      setMensagens(prev => [
        ...prev,
        {
          role: 'assistant',
          content: data.resposta,
          titulo: data.titulo,
          provedor: data.provedor
        }
      ])
    } catch (err: any) {
      toast.error(err.message || 'Falha na resposta do assistente.')
      setMensagens(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `⚠️ Não foi possível obter a resposta no momento: ${err.message}. Verifique sua conexão ou tente novamente.`
        }
      ])
    } finally {
      setEnviandoMensagem(false)
    }
  }

  const copiarTexto = (texto: string, idx: number) => {
    navigator.clipboard.writeText(texto)
    setCopiadoIdx(idx)
    toast.success('Copiado para a área de transferência!')
    setTimeout(() => setCopiadoIdx(null), 2500)
  }

  const progressoPercent = Math.round((passosConcluidos.length / PASSOS_TOUR.length) * 100)

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header com Estilo Glassmorphism Panorâmico */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 border border-blue-900/40 p-6 sm:p-8 text-white shadow-xl">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-72 h-72 rounded-full bg-blue-500/10 blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-1/3 -mb-20 w-80 h-80 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-semibold uppercase tracking-wider">
              <GraduationCap size={14} className="text-blue-400" />
              Central de Treinamento & Copiloto IA
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight">
              Aprenda e domine o <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">Hub Paratech</span>
            </h1>
            <p className="text-sm sm:text-base text-slate-300">
              Conheça as principais ferramentas fiscais através do nosso tour interativo guiado e tire dúvidas em tempo real com o Copiloto IA alimentado com Inteligência Artificial e a legislação fiscal oficial.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              onClick={() => {
                setWalkthroughStepIndex(0)
                setModalWalkthroughOpen(true)
              }}
              className="px-5 py-3.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded-xl font-bold shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2.5 transition transform hover:-translate-y-0.5"
            >
              <Play size={18} className="fill-current" />
              <span>Iniciar Tour Guiado</span>
            </button>
            <button
              onClick={() => setTabAtiva('copiloto')}
              className="px-5 py-3.5 bg-white/10 hover:bg-white/15 text-white border border-white/15 rounded-xl font-bold flex items-center justify-center gap-2.5 transition backdrop-blur-sm"
            >
              <Bot size={18} className="text-cyan-400" />
              <span>Falar com o Copiloto</span>
            </button>
          </div>
        </div>

        {/* Barra de Progresso do Tour */}
        <div className="mt-8 pt-6 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/30 flex items-center justify-center font-black text-cyan-300 text-sm">
              {progressoPercent}%
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Seu Progresso de Onboarding</p>
              <p className="text-sm font-bold text-white">
                {passosConcluidos.length} de {PASSOS_TOUR.length} módulos explorados
              </p>
            </div>
          </div>
          <div className="flex-1 max-w-md bg-slate-800/80 rounded-full h-2.5 overflow-hidden border border-white/10">
            <div 
              className="bg-gradient-to-r from-blue-500 to-cyan-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${progressoPercent}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Navegação entre as Abas */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setTabAtiva('tour')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition whitespace-nowrap ${
            tabAtiva === 'tour'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Compass size={18} />
          <span>Tour Guiado (Walkthrough)</span>
        </button>

        <button
          onClick={() => setTabAtiva('copiloto')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition whitespace-nowrap ${
            tabAtiva === 'copiloto'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Bot size={18} />
          <span>Copiloto IA Tira-Dúvidas (Gemini Free)</span>
          <span className="text-[10px] uppercase font-black bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded border border-cyan-500/30">IA</span>
        </button>

        <button
          onClick={() => setTabAtiva('faq')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition whitespace-nowrap ${
            tabAtiva === 'faq'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <HelpCircle size={18} />
          <span>Perguntas Frequentes & Manuais</span>
        </button>
      </div>

      {/* CONTEÚDO 1: TOUR GUIADO EM CARDS */}
      {tabAtiva === 'tour' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {PASSOS_TOUR.map((passo, idx) => {
              const Icone = passo.icone
              const isConcluido = passosConcluidos.includes(passo.id)

              return (
                <div
                  key={passo.id}
                  className={`relative flex flex-col justify-between p-5 rounded-2xl border transition-all duration-200 bg-white dark:bg-slate-900 ${
                    isConcluido
                      ? 'border-emerald-300 dark:border-emerald-800/60 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 shadow-md hover:shadow-lg'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className={`p-3 rounded-xl flex items-center justify-center ${
                        isConcluido 
                          ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400' 
                          : 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400'
                      }`}>
                        <Icone size={22} />
                      </div>
                      <button
                        onClick={() => togglePassoConcluido(passo.id)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                          isConcluido
                            ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                        title={isConcluido ? 'Desmarcar' : 'Marcar como concluído'}
                      >
                        {isConcluido ? (
                          <>
                            <CheckCircle2 size={14} className="text-emerald-600" />
                            <span>Concluído</span>
                          </>
                        ) : (
                          <>
                            <Circle size={14} />
                            <span>Marcar</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                        {passo.modulo}
                      </span>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                        {passo.titulo}
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                        {passo.descricao}
                      </p>
                    </div>

                    {/* Pontos-chave */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-1.5">
                      {passo.pontosChave.map((ponto, pIdx) => (
                        <div key={pIdx} className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <Check size={13} className="text-blue-500 mt-0.5 flex-shrink-0" />
                          <span>{ponto}</span>
                        </div>
                      ))}
                    </div>

                    {/* Dica de ouro */}
                    <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 text-[11px] text-amber-900 dark:text-amber-200 flex items-start gap-2">
                      <Lightbulb size={14} className="text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <strong className="font-bold">Dica: </strong>
                        <span>{passo.dicaOuro}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <button
                      onClick={() => {
                        setWalkthroughStepIndex(idx)
                        setModalWalkthroughOpen(true)
                      }}
                      className="text-xs font-semibold text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition"
                    >
                      Ver detalhes
                    </button>
                    <Link
                      href={passo.rota}
                      className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 transition"
                    >
                      <span>Acessar Módulo</span>
                      <ArrowRight size={13} />
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* CONTEÚDO 2: COPILOTO IA TIRA-DÚVIDAS (GEMINI FREE) */}
      {tabAtiva === 'copiloto' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Painel Esquerdo: Sugestões e Configuração de API */}
          <div className="lg:col-span-1 space-y-4">
            {/* Card de Configuração do Gemini Free */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400">
                    <Key size={16} />
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Google Gemini Free
                  </h4>
                </div>
                <button
                  onClick={() => setShowConfigKey(!showConfigKey)}
                  className="text-xs text-blue-600 hover:underline font-semibold"
                >
                  {showConfigKey ? 'Ocultar' : 'Configurar'}
                </button>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                O Copiloto utiliza o modelo Gemini 2.5 Flash gratuito do Google ou a base interna do sistema.
              </p>

              {showConfigKey && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase">
                    Sua API Key do Google AI Studio:
                  </label>
                  <input
                    type="password"
                    value={geminiApiKeyInput}
                    onChange={e => setGeminiApiKeyInput(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={salvarChaveCustom}
                      className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition"
                    >
                      Salvar Chave
                    </button>
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-slate-400 hover:text-blue-500 rounded-lg border border-slate-200 dark:border-slate-700"
                      title="Obter chave gratuita no Google AI Studio"
                    >
                      <ExternalLink size={14} />
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Perguntas Rápidas */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-amber-500" />
                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Dúvidas Frequentes
                </h4>
              </div>
              <div className="space-y-1.5">
                {PERGUNTAS_RAPIDAS.map((pergunta, pIdx) => (
                  <button
                    key={pIdx}
                    onClick={() => handleEnviarMensagem(pergunta)}
                    disabled={enviandoMensagem}
                    className="w-full text-left p-2 rounded-xl text-xs text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 dark:hover:text-blue-400 transition border border-transparent hover:border-blue-200 dark:hover:border-blue-900 disabled:opacity-50"
                  >
                    💬 {pergunta}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Painel Central / Direito: Janela de Chat */}
          <div className="lg:col-span-3 flex flex-col h-[650px] bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            {/* Header do Chat */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white shadow-sm">
                  <Bot size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    Copiloto Fiscal & Tutorial Hub Paratech
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Respostas em tempo real sobre navegação, regras da SEFAZ, IBS/CBS e XMLs
                  </p>
                </div>
              </div>

              <button
                onClick={() => setMensagens([
                  {
                    role: 'assistant',
                    content: 'Conversa reiniciada! Como posso te ajudar agora?'
                  }
                ])}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-1"
                title="Reiniciar chat"
              >
                <RefreshCw size={13} />
                <span>Limpar</span>
              </button>
            </div>

            {/* Lista de Mensagens */}
            <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-4 custom-scrollbar">
              {mensagens.map((msg, idx) => {
                const isAssistant = msg.role === 'assistant'
                return (
                  <div
                    key={idx}
                    className={`flex gap-3 ${isAssistant ? 'items-start' : 'items-end justify-end'}`}
                  >
                    {isAssistant && (
                      <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Bot size={17} />
                      </div>
                    )}

                    <div
                      className={`relative max-w-2xl p-4 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                        isAssistant
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-tl-sm border border-slate-200/80 dark:border-slate-700'
                          : 'bg-blue-600 text-white rounded-br-sm shadow-md shadow-blue-600/20'
                      }`}
                    >
                      {/* Badge de Provedor se assistente */}
                      {isAssistant && msg.provedor && (
                        <div className="mb-2 pb-1.5 border-b border-slate-200 dark:border-slate-700/80 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                          <span>{msg.provedor}</span>
                          <button
                            onClick={() => copiarTexto(msg.content, idx)}
                            className="hover:text-blue-500 flex items-center gap-1"
                            title="Copiar resposta"
                          >
                            {copiadoIdx === idx ? <CheckCheck size={12} className="text-emerald-500" /> : <Copy size={12} />}
                            <span>{copiadoIdx === idx ? 'Copiado!' : 'Copiar'}</span>
                          </button>
                        </div>
                      )}

                      <div className="whitespace-pre-wrap font-sans">
                        {msg.content}
                      </div>
                    </div>

                    {!isAssistant && (
                      <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center flex-shrink-0 font-bold text-xs">
                        VC
                      </div>
                    )}
                  </div>
                )
              })}

              {enviandoMensagem && (
                <div className="flex gap-3 items-start">
                  <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot size={17} />
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 text-xs rounded-tl-sm border border-slate-200 dark:border-slate-700 flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <span>Consultando base de conhecimento fiscal e IA...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleEnviarMensagem()
              }}
              className="p-3 sm:p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 flex items-center gap-2"
            >
              <input
                type="text"
                value={inputMensagem}
                onChange={e => setInputMensagem(e.target.value)}
                placeholder="Ex: Como eu sincronizo as notas com o Hub Desktop?"
                disabled={enviandoMensagem}
                className="flex-1 text-xs sm:text-sm px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!inputMensagem.trim() || enviandoMensagem}
                className="p-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white rounded-xl transition flex items-center justify-center shadow-md disabled:shadow-none"
              >
                <Send size={18} />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CONTEÚDO 3: PERGUNTAS FREQUENTES (FAQ) */}
      {tabAtiva === 'faq' && (
        <div className="space-y-4 max-w-4xl mx-auto">
          {FAQ_ITEMS.map((item, idx) => {
            const isOpen = faqAberto === idx
            return (
              <div
                key={idx}
                className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm transition-all"
              >
                <button
                  onClick={() => setFaqAberto(isOpen ? null : idx)}
                  className="w-full flex items-center justify-between text-left gap-4"
                >
                  <span className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                    {item.pergunta}
                  </span>
                  <div className="p-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500">
                    {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </div>
                </button>

                {isOpen && (
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {item.resposta}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* MODAL WALKTHROUGH INTERATIVO PASSO A PASSO */}
      {modalWalkthroughOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl relative space-y-6">
            {/* Header do Modal */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center">
                  <Compass size={22} />
                </div>
                <div>
                  <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
                    Tour Interativo Hub Paratech
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Etapa {walkthroughStepIndex + 1} de {PASSOS_TOUR.length}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setModalWalkthroughOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Conteúdo do Passo Atual */}
            {(() => {
              const passoAtual = PASSOS_TOUR[walkthroughStepIndex]
              const Icone = passoAtual.icone
              const isConcluido = passosConcluidos.includes(passoAtual.id)

              return (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-2xl">
                      <Icone size={26} />
                    </div>
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
                        {passoAtual.modulo}
                      </span>
                      <h4 className="text-xl font-bold text-slate-900 dark:text-white">
                        {passoAtual.titulo}
                      </h4>
                    </div>
                  </div>

                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {passoAtual.descricao}
                  </p>

                  <div className="space-y-2 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Recursos em Destaque:</p>
                    {passoAtual.pontosChave.map((pt, pIdx) => (
                      <div key={pIdx} className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                        <CheckCircle2 size={15} className="text-emerald-500 flex-shrink-0" />
                        <span>{pt}</span>
                      </div>
                    ))}
                  </div>

                  <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/40 rounded-2xl text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
                    <Lightbulb size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Super Dica: </span>
                      <span>{passoAtual.dicaOuro}</span>
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* Footer de Navegação do Tour */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <button
                onClick={() => setWalkthroughStepIndex(prev => Math.max(0, prev - 1))}
                disabled={walkthroughStepIndex === 0}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-30"
              >
                Voltar
              </button>

              <div className="flex items-center gap-1.5">
                {PASSOS_TOUR.map((_, dotIdx) => (
                  <span
                    key={dotIdx}
                    className={`w-2 h-2 rounded-full transition-all ${
                      dotIdx === walkthroughStepIndex
                        ? 'w-6 bg-blue-600'
                        : passosConcluidos.includes(PASSOS_TOUR[dotIdx].id)
                        ? 'bg-emerald-400'
                        : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  />
                ))}
              </div>

              {walkthroughStepIndex < PASSOS_TOUR.length - 1 ? (
                <button
                  onClick={() => {
                    const currentId = PASSOS_TOUR[walkthroughStepIndex].id
                    if (!passosConcluidos.includes(currentId)) {
                      togglePassoConcluido(currentId)
                    }
                    setWalkthroughStepIndex(prev => prev + 1)
                  }}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-md shadow-blue-600/20"
                >
                  <span>Próximo Passo</span>
                  <ArrowRight size={14} />
                </button>
              ) : (
                <button
                  onClick={() => {
                    const currentId = PASSOS_TOUR[walkthroughStepIndex].id
                    if (!passosConcluidos.includes(currentId)) {
                      togglePassoConcluido(currentId)
                    }
                    setModalWalkthroughOpen(false)
                    toast.success('Parabéns! Você completou o Tour Oficial do Hub Paratech! 🚀', { duration: 5000 })
                  }}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-md shadow-emerald-600/20"
                >
                  <span>Concluir Tour</span>
                  <CheckCheck size={16} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
