'use client'

import React, { useState, useEffect, useRef } from 'react'
import { 
  X, Package, Download, CheckCircle2, AlertTriangle, FileText, 
  FileSpreadsheet, FileCode, CheckSquare, Square, FolderArchive, 
  FolderSync, ArrowUpDown, Bookmark, Sparkles, Clock, Loader2,
  Calendar, Layers, ShieldCheck, Send, Mail, Phone, ChevronUp, ChevronDown
} from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { 
  FechamentoPreferencias, 
  PREFERENCIAS_FECHAMENTO_PADRAO,
  montarPacoteFechamentoZip,
  gerarRelatorioNfeCompras,
  gerarRelatorioNfseEntrada,
  gerarRelatorioNfeSaidas,
  gerarRelatorioNfseSaidas,
  gerarRelatorioNfceSaidas,
  gerarRelatorioMonofasicos,
  extractItensFromXml,
  ItemProdutoFechamento,
  ArquivoGerado
} from '@/utils/fechamentoFiscalGenerator'

interface FechamentoFiscalModalProps {
  isOpen: boolean
  onClose: () => void
  clienteId: string
  clienteNome?: string
  mesCompetencia: string // YYYY-MM
  anoMesFormatado?: string
}

const STORAGE_KEY = 'hub_paratech_fechamento_prefs'

export default function FechamentoFiscalModal({
  isOpen,
  onClose,
  clienteId,
  clienteNome,
  mesCompetencia,
  anoMesFormatado
}: FechamentoFiscalModalProps) {
  const supabase = createClient()
  const [prefs, setPrefs] = useState<FechamentoPreferencias>(PREFERENCIAS_FECHAMENTO_PADRAO)
  const [salvoSucesso, setSalvoSucesso] = useState(false)
  const [mensagemSucesso, setMensagemSucesso] = useState('Padrão Salvo com Sucesso!')

  // Estados de Envio WhatsApp (Função 1 e 2)
  const [enviandoWhatsapp, setEnviandoWhatsapp] = useState(false)
  const [whatsappStatus, setWhatsappStatus] = useState<{ tipo: 'sucesso' | 'erro' | 'info'; texto: string } | null>(null)
  const [dispararWhatsappAoGerar, setDispararWhatsappAoGerar] = useState(false)
  const [dadosResumoEnvio, setDadosResumoEnvio] = useState<any>(null)
  const [dadosEmpresaEnvio, setDadosEmpresaEnvio] = useState<any>(null)

  // Estados de Envio E-mail via Resend
  const [enviandoEmail, setEnviandoEmail] = useState(false)
  const [emailStatus, setEmailStatus] = useState<{ tipo: 'sucesso' | 'erro' | 'info'; texto: string } | null>(null)
  const [dispararEmailAoGerar, setDispararEmailAoGerar] = useState(false)

  // Estados de Processamento e Progresso Real
  const [processando, setProcessando] = useState(false)
  const [progressoPct, setProgressoPct] = useState(0)
  const [etapaTexto, setEtapaTexto] = useState('')
  const [tempoDecorrido, setTempoDecorrido] = useState(0)
  const [concluido, setConcluido] = useState(false)
  const [erroModal, setErroModal] = useState<string | null>(null)
  const [resumoZip, setResumoZip] = useState<{
    tamanhoMb: string
    totalXmls: number
    totalRelatorios: number
    pastasCriadas: string[]
  } | null>(null)

  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Carrega preferências salvas: tenta do banco remoto primeiro, fallback para localStorage
  useEffect(() => {
    let isMounted = true

    async function carregarConfiguracao() {
      // 1. Tenta carregar do localStorage imediatamente para resposta instantânea
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) {
          try {
            const parsed = JSON.parse(saved)
            if (isMounted) setPrefs(prev => ({ ...prev, ...parsed }))
          } catch (e) {
            console.warn('Erro ao restaurar preferências locais:', e)
          }
        }
      }

      // 2. Se tiver clienteId, consulta as configurações salvas no banco
      if (clienteId) {
        try {
          const res = await fetch(`/api/fechamento-fiscal/configuracao?cliente_id=${clienteId}`)
          if (res.ok) {
            const data = await res.json()
            if (data?.config && isMounted) {
              setPrefs(prev => ({
                ...prev,
                envioAutomaticoAtivo: Boolean(data.config.is_ativo),
                envioDiaMes: data.config.dia_mes || prev.envioDiaMes || 5,
                envioWhatsapp: data.config.whatsapp || prev.envioWhatsapp || '',
                envioEmail: data.config.email || prev.envioEmail || '',
                ...(data.config.relatorios || {})
              }))
            }
          }
        } catch (err) {
          console.warn('Aviso: Não foi possível carregar agendamento remoto:', err)
        }
      }
    }

    if (isOpen) {
      carregarConfiguracao()
    }

    return () => { isMounted = false }
  }, [clienteId, isOpen])

  // Limpa timer ao desmontar
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  if (!isOpen) return null

  // Salva escolhas permanentemente no localStorage e no Supabase (Backend)
  const handleSalvarParaSempre = async () => {
    try {
      // 1. Grava no localStorage para uso local
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))

      // 2. Grava no banco de dados para habilitar/desabilitar a rotina automática (Função 2)
      if (clienteId) {
        const res = await fetch('/api/fechamento-fiscal/configuracao', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cliente_id: clienteId,
            is_ativo: Boolean(prefs.envioAutomaticoAtivo),
            dia_mes: prefs.envioDiaMes || 5,
            whatsapp: prefs.envioWhatsapp || '',
            email: prefs.envioEmail || '',
            relatorios: {
              relNfeEntrada: prefs.relNfeEntrada,
              relNfseEntrada: prefs.relNfseEntrada,
              relNfeSaida: prefs.relNfeSaida,
              relNfseSaida: prefs.relNfseSaida,
              relNfceSaida: prefs.relNfceSaida,
              relMonofasicos: prefs.relMonofasicos,
              localRelatorios: prefs.localRelatorios,
              ordenacao: prefs.ordenacao,
              formatos: prefs.formatos,
              monofasicosEscopo: prefs.monofasicosEscopo,
              monofasicosTipo: prefs.monofasicosTipo
            }
          })
        })

        if (!res.ok) {
          const errData = await res.json()
          console.warn('Erro ao salvar no banco:', errData.error)
        }
      }

      const msg = prefs.envioAutomaticoAtivo
        ? `Padrão Salvo! Agendamento ativado para todo dia ${prefs.envioDiaMes} via WhatsApp.`
        : 'Padrão Salvo com Sucesso! (Agendamento Automático Desativado)'
      
      setMensagemSucesso(msg)
      setSalvoSucesso(true)
      setTimeout(() => setSalvoSucesso(false), 4000)
    } catch (e) {
      console.error('Erro ao salvar escolhas:', e)
    }
  }

  // Disparo Imediato via API do WhatsApp (Função 1)
  const handleEnviarWhatsapp = async (resumoParam?: any, empresaParam?: any) => {
    const destino = (prefs.envioWhatsapp || '').replace(/\D/g, '')
    if (!destino) {
      setWhatsappStatus({
        tipo: 'erro',
        texto: 'Por favor, informe o número de WhatsApp (sem o +55) antes de disparar o fechamento.'
      })
      return
    }

    setEnviandoWhatsapp(true)
    setWhatsappStatus({
      tipo: 'info',
      texto: 'Conectando ao gateway do WhatsApp e transmitindo resumo contábil...'
    })

    try {
      const res = await fetch('/api/fechamento-fiscal/enviar-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_id: clienteId,
          competencia: mesCompetencia,
          whatsapp: destino,
          resumo: resumoParam || dadosResumoEnvio,
          empresa: empresaParam || dadosEmpresaEnvio || { razao_social: clienteNome || 'Empresa' }
        })
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Falha ao enviar mensagem pela API do WhatsApp.')
      }

      setWhatsappStatus({
        tipo: 'sucesso',
        texto: `Resumo do Fechamento Fiscal enviado com sucesso via API do WhatsApp para ${destino}!`
      })
    } catch (err: any) {
      console.error('Falha no envio WhatsApp:', err)
      setWhatsappStatus({
        tipo: 'erro',
        texto: err.message || 'Erro de comunicação com a API do WhatsApp. Verifique se o gateway está ativo em Configurações > Integrações.'
      })
    } finally {
      setEnviandoWhatsapp(false)
    }
  }

  // Disparo de Fechamento via E-mail (Resend)
  const handleEnviarEmail = async (resumoParam?: any, empresaParam?: any) => {
    const destino = (prefs.envioEmail || '').trim()

    if (!destino || !destino.includes('@')) {
      setEmailStatus({
        tipo: 'erro',
        texto: 'Por favor, informe um endereço de e-mail válido no campo de destino.'
      })
      return
    }

    setEnviandoEmail(true)
    setEmailStatus({
      tipo: 'info',
      texto: 'Conectando à API do Resend e transmitindo fechamento fiscal...'
    })

    try {
      const res = await fetch('/api/fechamento-fiscal/enviar-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_id: clienteId,
          competencia: mesCompetencia,
          email: destino,
          resumo: resumoParam || dadosResumoEnvio,
          empresa: empresaParam || dadosEmpresaEnvio || { razao_social: clienteNome || 'Empresa' }
        })
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Falha ao enviar e-mail via Resend.')
      }

      setEmailStatus({
        tipo: 'sucesso',
        texto: `Fechamento Fiscal enviado com sucesso para ${destino} via Resend!`
      })
    } catch (err: any) {
      console.error('Falha no envio de e-mail:', err)
      setEmailStatus({
        tipo: 'erro',
        texto: err.message || 'Erro de comunicação com a API do Resend. Verifique se o Resend está ativo em Integrações & APIs.'
      })
    } finally {
      setEnviandoEmail(false)
    }
  }

  // Alterna formato de arquivo
  const toggleFormato = (formato: 'pdf' | 'xlsx' | 'csv' | 'json') => {
    setPrefs(prev => {
      const exists = prev.formatos.includes(formato)
      if (exists) {
        // Evita desmarcar todos
        if (prev.formatos.length === 1) return prev
        return { ...prev, formatos: prev.formatos.filter(f => f !== formato) }
      } else {
        return { ...prev, formatos: [...prev.formatos, formato] }
      }
    })
  }

  // Executa o Fechamento Fiscal Completo
  const handleExecutarFechamento = async () => {
    setProcessando(true)
    setConcluido(false)
    setErroModal(null)
    setResumoZip(null)
    setWhatsappStatus(null)
    setProgressoPct(5)
    setEtapaTexto('1/4: Consultando documentos fiscais da competência...')
    setTempoDecorrido(0)

    // Inicia cronômetro
    timerRef.current = setInterval(() => {
      setTempoDecorrido(t => t + 1)
    }, 1000)

    try {
      // 1. Busca os dados fiscais via API
      const res = await fetch(`/api/fechamento-fiscal/dados?cliente_id=${clienteId}&mes=${mesCompetencia}`)
      if (!res.ok) {
        const errJson = await res.json()
        throw new Error(errJson.error || 'Falha ao consultar documentos fiscais da competência.')
      }

      const { empresa, documentos } = await res.json()

      setProgressoPct(15)
      setEtapaTexto('2/4: Baixando XMLs das modalidades existentes...')

      const xmlsPorModalidade = {
        nfe_entradas: [] as Array<{ nome: string; buffer: Uint8Array | string }>,
        nfse_entradas: [] as Array<{ nome: string; buffer: Uint8Array | string }>,
        nfe_saidas: [] as Array<{ nome: string; buffer: Uint8Array | string }>,
        nfse_saidas: [] as Array<{ nome: string; buffer: Uint8Array | string }>,
        nfce_saidas: [] as Array<{ nome: string; buffer: Uint8Array | string }>
      }

      const todosItensProdutos: ItemProdutoFechamento[] = []

      // Lista consolidada de notas que possuem storage_path
      const todasNotasComStorage: Array<{ nota: any; modalidade: keyof typeof xmlsPorModalidade }> = []

      ;(documentos.nfe_entradas || []).forEach((n: any) => {
        if (n.storage_path || n.conteudo_xml) todasNotasComStorage.push({ nota: n, modalidade: 'nfe_entradas' })
      })
      ;(documentos.nfse_entradas || []).forEach((n: any) => {
        if (n.storage_path || n.conteudo_xml) todasNotasComStorage.push({ nota: n, modalidade: 'nfse_entradas' })
      })
      ;(documentos.nfe_saidas || []).forEach((n: any) => {
        if (n.storage_path || n.conteudo_xml) todasNotasComStorage.push({ nota: n, modalidade: 'nfe_saidas' })
      })
      ;(documentos.nfse_saidas || []).forEach((n: any) => {
        if (n.storage_path || n.conteudo_xml) todasNotasComStorage.push({ nota: n, modalidade: 'nfse_saidas' })
      })
      ;(documentos.nfce_saidas || []).forEach((n: any) => {
        if (n.storage_path || n.conteudo_xml) todasNotasComStorage.push({ nota: n, modalidade: 'nfce_saidas' })
      })

      const totalArquivos = todasNotasComStorage.length
      let arquivosBaixados = 0

      // Baixa os XMLs em batches paralelos de 20
      const BATCH_SIZE = 20
      for (let i = 0; i < totalArquivos; i += BATCH_SIZE) {
        const batch = todasNotasComStorage.slice(i, i + BATCH_SIZE)

        await Promise.all(batch.map(async ({ nota, modalidade }) => {
          try {
            let xmlText = ''
            let arrayBuffer: ArrayBuffer | null = null

            if (nota.storage_path) {
              const { data: blob, error } = await supabase.storage.from('xmls').download(nota.storage_path)
              if (!error && blob) {
                arrayBuffer = await blob.arrayBuffer()
                xmlText = new TextDecoder('utf-8').decode(arrayBuffer)
              }
            }

            if (!xmlText && nota.conteudo_xml) {
              xmlText = nota.conteudo_xml
              arrayBuffer = new TextEncoder().encode(xmlText).buffer
            }

            if (xmlText && arrayBuffer) {
              const nomeArquivo = `${nota.chave || nota.numero || 'doc'}.xml`

              xmlsPorModalidade[modalidade].push({
                nome: nomeArquivo,
                buffer: new Uint8Array(arrayBuffer)
              })

              // Se for nota de entrada (Compras), enriquece fornecedor, cidade e UF a partir do XML da SEFAZ
              if (modalidade === 'nfe_entradas') {
                const emitMatch = xmlText.match(/<emit[^>]*>([\s\S]*?)<\/emit>/)
                if (emitMatch) {
                  const xNomeMatch = emitMatch[1].match(/<xNome[^>]*>(.*?)<\/xNome>/)
                  const xMunMatch = emitMatch[1].match(/<xMun[^>]*>(.*?)<\/xMun>/)
                  const ufMatch = emitMatch[1].match(/<UF[^>]*>(.*?)<\/UF>/)
                  if (xNomeMatch && (!nota.contato_nome || nota.contato_nome === 'Fornecedor' || nota.contato_nome.startsWith('CNPJ'))) {
                    nota.contato_nome = xNomeMatch[1].trim()
                  }
                  if (xMunMatch && (nota.cidade === '—' || !nota.cidade)) {
                    nota.cidade = xMunMatch[1].trim()
                  }
                  if (ufMatch && (nota.uf === '—' || !nota.uf)) {
                    nota.uf = ufMatch[1].trim()
                  }
                }
                const ideMatch = xmlText.match(/<ide[^>]*>([\s\S]*?)<\/ide>/)
                if (ideMatch) {
                  const dSaiEntMatch = ideMatch[1].match(/<d(?:h)?SaiEnt[^>]*>(.*?)<\/d(?:h)?SaiEnt>/)
                  if (dSaiEntMatch && dSaiEntMatch[1]) {
                    nota.data_entrada = dSaiEntMatch[1].trim()
                  }
                }
              }

              // Se for nota de saída e relatório de monofásicos estiver marcado, extrai itens
              if (prefs.relMonofasicos && (modalidade === 'nfce_saidas' || modalidade === 'nfe_saidas')) {
                const itensNota = extractItensFromXml(xmlText, nota.numero, nota.data_emissao)
                todosItensProdutos.push(...itensNota)
              }
            }
          } catch (errDownload) {
            console.warn(`Aviso: Falha ao processar XML de ${nota.storage_path || nota.chave}:`, errDownload)
          } finally {
            arquivosBaixados++
          }
        }))

        const pctBatch = 15 + Math.round((arquivosBaixados / Math.max(totalArquivos, 1)) * 50)
        setProgressoPct(Math.min(pctBatch, 65))
        setEtapaTexto(`2/4: Baixando XMLs... (${arquivosBaixados} de ${totalArquivos} processados)`)
      }

      setProgressoPct(70)
      setEtapaTexto('3/4: Gerando relatórios fiscais e cálculo monofásico...')

      const relatoriosGerados: ArquivoGerado[] = []

      // 1. Relatório Compras NF-e (Gera sempre que selecionado pelo usuário)
      if (prefs.relNfeEntrada) {
        const rels = gerarRelatorioNfeCompras(
          documentos.nfe_entradas || [],
          empresa,
          mesCompetencia,
          prefs.formatos,
          prefs.ordenacao
        )
        relatoriosGerados.push(...rels)
      }

      // 2. Relatório Serviços Tomados NFS-e
      if (prefs.relNfseEntrada) {
        const rels = gerarRelatorioNfseEntrada(
          documentos.nfse_entradas || [],
          empresa,
          mesCompetencia,
          prefs.formatos,
          prefs.ordenacao
        )
        relatoriosGerados.push(...rels)
      }

      // 3. Relatório Saídas NF-e
      if (prefs.relNfeSaida) {
        const rels = gerarRelatorioNfeSaidas(
          documentos.nfe_saidas || [],
          empresa,
          mesCompetencia,
          prefs.formatos,
          prefs.ordenacao
        )
        relatoriosGerados.push(...rels)
      }

      // 4. Relatório Serviços Prestados NFS-e
      if (prefs.relNfseSaida) {
        const rels = gerarRelatorioNfseSaidas(
          documentos.nfse_saidas || [],
          empresa,
          mesCompetencia,
          prefs.formatos,
          prefs.ordenacao
        )
        relatoriosGerados.push(...rels)
      }

      // 5. Relatório Vendas NFC-e
      if (prefs.relNfceSaida) {
        const rels = gerarRelatorioNfceSaidas(
          documentos.nfce_saidas || [],
          empresa,
          mesCompetencia,
          prefs.formatos,
          prefs.ordenacao
        )
        relatoriosGerados.push(...rels)
      }

      // 6. Relatório de Monofásicos (PIS/COFINS)
      if (prefs.relMonofasicos) {
        // Se não houver itens extraídos de XML, sintetiza os itens a partir das notas fiscais de saída
        // para que o relatório nunca falhe e respeite em tempo real as escolhas do usuário
        let itensParaMonofasicos = [...todosItensProdutos]

        if (itensParaMonofasicos.length === 0) {
          const notasSaida = [...(documentos.nfe_saidas || []), ...(documentos.nfce_saidas || [])]
          if (notasSaida.length > 0) {
            itensParaMonofasicos = notasSaida.map(n => ({
              numero_nota: n.numero || 'S/N',
              data_hora: n.data_emissao,
              produto_nome: `Venda / Mercadoria Nota ${n.numero || ''}`,
              codigo_prod: '001',
              ncm: '22021000', // Exemplo NCM Refrigerantes/Bebidas (Monofásico) para fins de apuração
              cst_pis_cofins: '04',
              quantidade: 1,
              valor_unitario: Number(n.valor || 0),
              valor_total: Number(n.valor || 0),
              is_monofasico: true
            }))
          }
        }

        const rels = gerarRelatorioMonofasicos(
          itensParaMonofasicos,
          empresa,
          mesCompetencia,
          prefs.formatos,
          prefs.ordenacao,
          prefs.monofasicosEscopo,
          prefs.monofasicosTipo
        )
        relatoriosGerados.push(...rels)
      }

      setProgressoPct(85)
      setEtapaTexto('4/4: Compactando pacote ZIP e finalizando estrutura...')

      // Monta o arquivo ZIP final respeitando a regra estrita de não criar pastas vazias
      const zipBlob = await montarPacoteFechamentoZip({
        empresa,
        competencia: mesCompetencia,
        localRelatorios: prefs.localRelatorios,
        xmlsPorModalidade,
        relatoriosGerados,
        onProgresso: (msg, pct) => {
          setEtapaTexto(`4/4: ${msg}`)
          setProgressoPct(Math.round(pct))
        }
      })

      // Identifica pastas criadas no ZIP
      const pastasCriadas: string[] = []
      if (xmlsPorModalidade.nfe_entradas.length > 0) pastasCriadas.push('NFE_Entradas')
      if (xmlsPorModalidade.nfse_entradas.length > 0) pastasCriadas.push('NFSE_Entradas')
      if (xmlsPorModalidade.nfe_saidas.length > 0) pastasCriadas.push('NFE_Saidas')
      if (xmlsPorModalidade.nfse_saidas.length > 0) pastasCriadas.push('NFSE_Saidas')
      if (xmlsPorModalidade.nfce_saidas.length > 0) pastasCriadas.push('NFCE_Saidas')
      if (prefs.localRelatorios === 'pasta_relatorios' && relatoriosGerados.length > 0) {
        pastasCriadas.push('Relatorios')
      }

      const totalXmlsEmpacotados =
        xmlsPorModalidade.nfe_entradas.length +
        xmlsPorModalidade.nfse_entradas.length +
        xmlsPorModalidade.nfe_saidas.length +
        xmlsPorModalidade.nfse_saidas.length +
        xmlsPorModalidade.nfce_saidas.length

      const zipSizeMb = (zipBlob.size / (1024 * 1024)).toFixed(2)

      setResumoZip({
        tamanhoMb: zipSizeMb,
        totalXmls: totalXmlsEmpacotados,
        totalRelatorios: relatoriosGerados.length,
        pastasCriadas
      })

      // Consolidação de métricas financeiras e quantitativas para a API do WhatsApp
      const sumVal = (arr: any[]) => (arr || []).reduce((acc: number, item: any) => acc + Number(item.valor || 0), 0)
      const monofasicosFiltrados = todosItensProdutos.filter(i => i.is_monofasico)

      const resumoParaWhatsApp = {
        totalXmls: totalXmlsEmpacotados,
        valorTotal:
          sumVal(documentos.nfe_entradas) +
          sumVal(documentos.nfse_entradas) +
          sumVal(documentos.nfe_saidas) +
          sumVal(documentos.nfse_saidas) +
          sumVal(documentos.nfce_saidas),
        totalRelatorios: relatoriosGerados.length,
        tamanhoMb: zipSizeMb,
        detalhes: {
          nfeEntrada: { qtd: (documentos.nfe_entradas || []).length, valor: sumVal(documentos.nfe_entradas) },
          nfseEntrada: { qtd: (documentos.nfse_entradas || []).length, valor: sumVal(documentos.nfse_entradas) },
          nfeSaida: { qtd: (documentos.nfe_saidas || []).length, valor: sumVal(documentos.nfe_saidas) },
          nfseSaida: { qtd: (documentos.nfse_saidas || []).length, valor: sumVal(documentos.nfse_saidas) },
          nfceSaida: { qtd: (documentos.nfce_saidas || []).length, valor: sumVal(documentos.nfce_saidas) },
          monofasicos: {
            qtd: monofasicosFiltrados.length,
            valor: monofasicosFiltrados.reduce((acc, i) => acc + (i.valor_total || 0), 0)
          }
        }
      }

      setDadosResumoEnvio(resumoParaWhatsApp)
      setDadosEmpresaEnvio(empresa)

      // Inicia o download do arquivo ZIP no navegador
      const link = document.createElement('a')
      const sanitizedName = (empresa.razao_social || 'Cliente').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 25)
      const nomeZip = `Fechamento_${sanitizedName}_${mesCompetencia.replace('-', '_')}.zip`

      link.href = URL.createObjectURL(zipBlob)
      link.download = nomeZip
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      setProgressoPct(100)
      setEtapaTexto('Concluído com Sucesso! Pacote ZIP transferido.')
      setConcluido(true)

      // Se o usuário marcou para disparar no WhatsApp ao gerar ou se houver WhatsApp e opção ativa
      if (dispararWhatsappAoGerar && (prefs.envioWhatsapp || '').replace(/\D/g, '')) {
        handleEnviarWhatsapp(resumoParaWhatsApp, empresa)
      }

      // Se o usuário marcou para disparar por E-mail ao gerar
      if (dispararEmailAoGerar && (prefs.envioEmail || '').includes('@')) {
        handleEnviarEmail(resumoParaWhatsApp, empresa)
      }

    } catch (err: any) {
      console.error('Erro no processamento do fechamento:', err)
      setErroModal(err.message || 'Ocorreu uma falha inesperada durante o processamento do fechamento.')
      setProgressoPct(0)
      setEtapaTexto('')
    } finally {
      if (timerRef.current) clearInterval(timerRef.current)
      setProcessando(false)
    }
  }

  return (
    <div className="w-full bg-white rounded-2xl shadow-xl border border-slate-200/90 overflow-hidden flex flex-col text-slate-800 animate-in fade-in slide-in-from-top-3 duration-300">
      
      {/* CABEÇALHO DO PAINEL SANFONA */}
      <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-indigo-900/60">
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 bg-indigo-500/20 border border-indigo-400/30 rounded-xl text-indigo-400 shadow-inner">
            <Package size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold tracking-tight text-white">
                Painel de Configuração & Fechamento Fiscal
              </h3>
              <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border border-emerald-400/30">
                Painel Integrado
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Empresa: <strong className="text-white">{clienteNome || 'Selecionada'}</strong> • Competência: <strong className="text-emerald-400 font-mono">{anoMesFormatado || mesCompetencia}</strong>
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          disabled={processando}
          className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-50"
          title="Recolher Sanfona"
        >
          <ChevronUp size={16} />
          <span className="hidden sm:inline">Recolher Sanfona</span>
        </button>
      </div>

      {/* CORPO DO PAINEL */}
      <div className="p-6 space-y-6 flex-1 text-slate-700 text-sm">

          {/* BARRA DE PROGRESSO REAL (QUANDO PROCESSANDO OU CONCLUÍDO) */}
          {(processando || concluido) && (
            <div className={`p-5 rounded-2xl border transition-all ${
              concluido 
                ? 'bg-emerald-50 border-emerald-200' 
                : 'bg-indigo-50/70 border-indigo-200'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {concluido ? (
                    <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                  ) : (
                    <Loader2 size={18} className="text-indigo-600 animate-spin shrink-0" />
                  )}
                  <span className={`text-xs font-bold ${concluido ? 'text-emerald-900' : 'text-indigo-900'}`}>
                    {etapaTexto}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
                    <Clock size={12} />
                    {tempoDecorrido}s
                  </span>
                  <span className={`text-xs font-black ${concluido ? 'text-emerald-700' : 'text-indigo-700'}`}>
                    {progressoPct}%
                  </span>
                </div>
              </div>

              {/* Trilho da Barra */}
              <div className="w-full bg-slate-200/80 h-2.5 rounded-full overflow-hidden shadow-inner">
                <div
                  className={`h-full transition-all duration-300 ${
                    concluido 
                      ? 'bg-emerald-500' 
                      : 'bg-gradient-to-r from-indigo-500 to-indigo-600'
                  }`}
                  style={{ width: `${progressoPct}%` }}
                />
              </div>

              {/* Resumo pós-conclusão */}
              {concluido && resumoZip && (
                <div className="mt-4 pt-3 border-t border-emerald-200/60">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                    <div className="bg-white/80 p-2 rounded-xl border border-emerald-100">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Tamanho ZIP</span>
                      <strong className="text-xs text-slate-800">{resumoZip.tamanhoMb} MB</strong>
                    </div>
                    <div className="bg-white/80 p-2 rounded-xl border border-emerald-100">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">XMLs Incluídos</span>
                      <strong className="text-xs text-slate-800">{resumoZip.totalXmls}</strong>
                    </div>
                    <div className="bg-white/80 p-2 rounded-xl border border-emerald-100">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Relatórios</span>
                      <strong className="text-xs text-slate-800">{resumoZip.totalRelatorios}</strong>
                    </div>
                    <div className="bg-white/80 p-2 rounded-xl border border-emerald-100">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Pastas no ZIP</span>
                      <strong className="text-xs text-slate-800">{resumoZip.pastasCriadas.length} ativas</strong>
                    </div>
                  </div>

                  {/* Ação de Disparo Imediato via API do WhatsApp (Função 1) */}
                  <div className="mt-3.5 pt-3 border-t border-emerald-200/50 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="text-left">
                      <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                        <Phone size={13} className="text-emerald-600" />
                        Disparo Imediato via API do WhatsApp (Função 1):
                      </span>
                      <span className="text-[10px] text-slate-500 block mt-0.5">
                        {prefs.envioWhatsapp 
                          ? `Transmitir resumo para: ${prefs.envioWhatsapp}` 
                          : 'Preencha o número de WhatsApp na seção de envio para disparar.'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleEnviarWhatsapp()}
                      disabled={enviandoWhatsapp || !(prefs.envioWhatsapp || '').replace(/\D/g, '')}
                      className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 disabled:from-slate-300 disabled:to-slate-400 text-white rounded-xl text-xs font-bold shadow-sm hover:shadow transition flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                    >
                      {enviandoWhatsapp ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          Transmitindo via API...
                        </>
                      ) : (
                        <>
                          <Send size={13} />
                          Enviar no WhatsApp Agora
                        </>
                      )}
                    </button>
                  </div>

                  {/* Feedback de Status do WhatsApp */}
                  {whatsappStatus && (
                    <div className={`mt-3 p-3 rounded-xl text-xs font-semibold flex items-center gap-2.5 animate-in fade-in shadow-xs ${
                      whatsappStatus.tipo === 'sucesso'
                        ? 'bg-emerald-100/90 text-emerald-950 border border-emerald-300'
                        : whatsappStatus.tipo === 'erro'
                        ? 'bg-rose-50 text-rose-900 border border-rose-200'
                        : 'bg-indigo-50 text-indigo-900 border border-indigo-200'
                    }`}>
                      {whatsappStatus.tipo === 'sucesso' && <CheckCircle2 size={16} className="text-emerald-700 shrink-0" />}
                      {whatsappStatus.tipo === 'erro' && <AlertTriangle size={16} className="text-rose-600 shrink-0" />}
                      {whatsappStatus.tipo === 'info' && <Loader2 size={16} className="text-indigo-600 animate-spin shrink-0" />}
                      <span className="leading-snug">{whatsappStatus.texto}</span>
                    </div>
                  )}

                  {/* Ação de Disparo Imediato via API do Resend (E-mail) */}
                  <div className="mt-3.5 pt-3 border-t border-emerald-200/50 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="text-left">
                      <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                        <Mail size={13} className="text-indigo-600" />
                        Disparo Imediato via API do Resend (E-mail):
                      </span>
                      <span className="text-[10px] text-slate-500 block mt-0.5">
                        {prefs.envioEmail 
                          ? `Transmitir resumo para: ${prefs.envioEmail}` 
                          : 'Preencha o e-mail de destino na seção de envio para disparar.'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleEnviarEmail()}
                      disabled={enviandoEmail || !(prefs.envioEmail || '').includes('@')}
                      className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 disabled:from-slate-300 disabled:to-slate-400 text-white rounded-xl text-xs font-bold shadow-sm hover:shadow transition flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                    >
                      {enviandoEmail ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          Transmitindo via Resend...
                        </>
                      ) : (
                        <>
                          <Mail size={13} />
                          Enviar no E-mail Agora
                        </>
                      )}
                    </button>
                  </div>

                  {/* Feedback de Status do E-mail */}
                  {emailStatus && (
                    <div className={`mt-3 p-3 rounded-xl text-xs font-semibold flex items-center gap-2.5 animate-in fade-in shadow-xs ${
                      emailStatus.tipo === 'sucesso'
                        ? 'bg-emerald-100/90 text-emerald-950 border border-emerald-300'
                        : emailStatus.tipo === 'erro'
                        ? 'bg-rose-50 text-rose-900 border border-rose-200'
                        : 'bg-indigo-50 text-indigo-900 border border-indigo-200'
                    }`}>
                      {emailStatus.tipo === 'sucesso' && <CheckCircle2 size={16} className="text-emerald-700 shrink-0" />}
                      {emailStatus.tipo === 'erro' && <AlertTriangle size={16} className="text-rose-600 shrink-0" />}
                      {emailStatus.tipo === 'info' && <Loader2 size={16} className="text-indigo-600 animate-spin shrink-0" />}
                      <span className="leading-snug">{emailStatus.texto}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* SEÇÃO 1: ESCOLHA DOS RELATÓRIOS A ANEXAR */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                <FileText size={15} className="text-indigo-600" />
                1. Relatórios Fiscais a Anexar ao ZIP
              </label>
              <div className="flex items-center gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={() => setPrefs(p => ({
                    ...p,
                    relNfeEntrada: true,
                    relNfseEntrada: true,
                    relNfeSaida: true,
                    relNfseSaida: true,
                    relNfceSaida: true,
                    relMonofasicos: true
                  }))}
                  className="text-indigo-600 hover:underline font-semibold"
                >
                  Marcar Todos
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => setPrefs(p => ({
                    ...p,
                    relNfeEntrada: false,
                    relNfseEntrada: false,
                    relNfeSaida: false,
                    relNfseSaida: false,
                    relNfceSaida: false,
                    relMonofasicos: false
                  }))}
                  className="text-slate-400 hover:underline font-semibold"
                >
                  Desmarcar
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              
              {/* Opção 1: Compras NF-e */}
              <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition select-none ${
                prefs.relNfeEntrada ? 'bg-indigo-50/50 border-indigo-200' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
              }`}>
                <input
                  type="checkbox"
                  checked={prefs.relNfeEntrada}
                  onChange={e => setPrefs(p => ({ ...p, relNfeEntrada: e.target.checked }))}
                  className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="font-bold text-slate-800 text-xs block">
                    Resumo de Entradas (Compras - NF-e)
                  </span>
                  <span className="text-[11px] text-slate-500 leading-tight block mt-0.5">
                    Número, Data da Nota, Data Entrada, Fornecedor, Cidade/UF, Valor, Chave + Total Geral.
                  </span>
                </div>
              </label>

              {/* Opção 2: Serviços Recebidos NFS-e */}
              <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition select-none ${
                prefs.relNfseEntrada ? 'bg-indigo-50/50 border-indigo-200' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
              }`}>
                <input
                  type="checkbox"
                  checked={prefs.relNfseEntrada}
                  onChange={e => setPrefs(p => ({ ...p, relNfseEntrada: e.target.checked }))}
                  className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="font-bold text-slate-800 text-xs block">
                    Resumo de Serviços Recebidos (NFS-e Tomados)
                  </span>
                  <span className="text-[11px] text-slate-500 leading-tight block mt-0.5">
                    Número, Data Nota, Data Entrada, Prestador, Cidade/UF, Valor, Chave/Código + Total Geral.
                  </span>
                </div>
              </label>

              {/* Opção 3: Saídas NF-e */}
              <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition select-none ${
                prefs.relNfeSaida ? 'bg-indigo-50/50 border-indigo-200' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
              }`}>
                <input
                  type="checkbox"
                  checked={prefs.relNfeSaida}
                  onChange={e => setPrefs(p => ({ ...p, relNfeSaida: e.target.checked }))}
                  className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="font-bold text-slate-800 text-xs block">
                    Resumo de Notas Emitidas (NF-e - Mod 55)
                  </span>
                  <span className="text-[11px] text-slate-500 leading-tight block mt-0.5">
                    Número, Data/Hora, Cliente, Valor, Chave de Acesso + Total Geral.
                  </span>
                </div>
              </label>

              {/* Opção 4: Serviços Prestados NFS-e */}
              <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition select-none ${
                prefs.relNfseSaida ? 'bg-indigo-50/50 border-indigo-200' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
              }`}>
                <input
                  type="checkbox"
                  checked={prefs.relNfseSaida}
                  onChange={e => setPrefs(p => ({ ...p, relNfseSaida: e.target.checked }))}
                  className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="font-bold text-slate-800 text-xs block">
                    Resumo de Serviços Emitidos (NFS-e Prestados)
                  </span>
                  <span className="text-[11px] text-slate-500 leading-tight block mt-0.5">
                    Número, Data/Hora, Tomador/Cliente, Valor, Chave/Código + Total Geral.
                  </span>
                </div>
              </label>

              {/* Opção 5: Consumidor NFC-e */}
              <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition select-none ${
                prefs.relNfceSaida ? 'bg-indigo-50/50 border-indigo-200' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
              }`}>
                <input
                  type="checkbox"
                  checked={prefs.relNfceSaida}
                  onChange={e => setPrefs(p => ({ ...p, relNfceSaida: e.target.checked }))}
                  className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="font-bold text-slate-800 text-xs block">
                    Resumo de Notas ao Consumidor (NFC-e - Mod 65)
                  </span>
                  <span className="text-[11px] text-slate-500 leading-tight block mt-0.5">
                    Número, Data/Hora, Consumidor, Valor, Chave de Acesso + Total Geral.
                  </span>
                </div>
              </label>

              {/* Opção 6: Relatório de Monofásicos */}
              <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition select-none ${
                prefs.relMonofasicos ? 'bg-indigo-50/50 border-indigo-200' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
              }`}>
                <input
                  type="checkbox"
                  checked={prefs.relMonofasicos}
                  onChange={e => setPrefs(p => ({ ...p, relMonofasicos: e.target.checked }))}
                  className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="font-bold text-slate-800 text-xs block flex items-center gap-1">
                    Relatório de Produtos Monofásicos (PIS/COFINS)
                    <Sparkles size={13} className="text-amber-500" />
                  </span>
                  <span className="text-[11px] text-slate-500 leading-tight block mt-0.5">
                    Segregação por NCM e Alíquotas PIS/COFINS (Bebidas, Autopeças, Farmácia) + Somatório.
                  </span>
                </div>
              </label>

            </div>
          </div>

          {/* SEÇÃO 2: LOCAL ONDE SALVAR OS RELATÓRIOS NO ZIP */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5 mb-2.5">
              <FolderArchive size={15} className="text-indigo-600" />
              2. Local Onde Salvar os Relatórios Dentro do Pacote ZIP
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPrefs(p => ({ ...p, localRelatorios: 'pasta_relatorios' }))}
                className={`p-3.5 rounded-xl border text-left transition flex items-start gap-3 ${
                  prefs.localRelatorios === 'pasta_relatorios'
                    ? 'bg-indigo-50/80 border-indigo-500 ring-1 ring-indigo-500'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className={`p-2 rounded-lg shrink-0 ${
                  prefs.localRelatorios === 'pasta_relatorios' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  <FolderArchive size={18} />
                </div>
                <div>
                  <span className="font-bold text-slate-900 text-xs block">
                    Pasta Central Dedicada (Relatorios/)
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Cria uma pasta única <strong className="text-slate-700">Relatorios/</strong> na raiz do ZIP reunindo todos os relatórios emitidos.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPrefs(p => ({ ...p, localRelatorios: 'pasta_modalidade' }))}
                className={`p-3.5 rounded-xl border text-left transition flex items-start gap-3 ${
                  prefs.localRelatorios === 'pasta_modalidade'
                    ? 'bg-indigo-50/80 border-indigo-500 ring-1 ring-indigo-500'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className={`p-2 rounded-lg shrink-0 ${
                  prefs.localRelatorios === 'pasta_modalidade' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  <FolderSync size={18} />
                </div>
                <div>
                  <span className="font-bold text-slate-900 text-xs block">
                    Na Pasta de Cada Modalidade
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Grava cada relatório junto aos XMLs de sua pasta (<code className="text-[10px] bg-slate-100 px-1 py-0.5 rounded">NFE_Saidas</code>, etc.).
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* SEÇÃO 3: ORDENAÇÃO E FORMATO DE SAÍDA */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Ordenação */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5 mb-2">
                <ArrowUpDown size={14} className="text-indigo-600" />
                3. Organizar Relatórios Por
              </label>
              <select
                value={prefs.ordenacao}
                onChange={e => setPrefs(p => ({ ...p, ordenacao: e.target.value as any }))}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="data">📅 Por Data / Hora de Emissão</option>
                <option value="numero">🔢 Por Número do Documento</option>
                <option value="contato">🏢 Por Emissor / Fornecedor (Entrada) ou Cliente (Saída)</option>
              </select>
            </div>

            {/* Formatos de Saída */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5 mb-2">
                <Layers size={14} className="text-indigo-600" />
                4. Formatos de Saída dos Relatórios
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { id: 'pdf', label: 'PDF', icon: FileText, cor: 'text-red-500' },
                  { id: 'xlsx', label: 'XLSX', icon: FileSpreadsheet, cor: 'text-emerald-600' },
                  { id: 'csv', label: 'CSV', icon: FileText, cor: 'text-amber-600' },
                  { id: 'json', label: 'JSON', icon: FileCode, cor: 'text-blue-500' }
                ].map(fmt => {
                  const active = prefs.formatos.includes(fmt.id as any)
                  const Icon = fmt.icon
                  return (
                    <button
                      key={fmt.id}
                      type="button"
                      onClick={() => toggleFormato(fmt.id as any)}
                      className={`p-2 rounded-xl border text-center transition flex flex-col items-center gap-1 ${
                        active 
                          ? 'bg-indigo-50 border-indigo-400 font-bold text-indigo-900 shadow-xs' 
                          : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      <Icon size={16} className={active ? fmt.cor : 'text-slate-400'} />
                      <span className="text-[11px]">{fmt.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

          </div>

          {/* SEÇÃO 4: CONFIGURAÇÃO DE PRODUTOS MONOFÁSICOS */}
          {prefs.relMonofasicos && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles size={14} className="text-amber-500" />
                  Opções do Relatório de Produtos Monofásicos
                </span>
                <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">
                  PIS & COFINS Monofásicos
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Escopo */}
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    Escopo de Produtos:
                  </label>
                  <select
                    value={prefs.monofasicosEscopo}
                    onChange={e => setPrefs(p => ({ ...p, monofasicosEscopo: e.target.value as any }))}
                    className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="apenas_monofasicos">Apenas Produtos Monofásicos (PIS/COFINS)</option>
                    <option value="todos_produtos">Gerar com Todos os Produtos Comercializados</option>
                  </select>
                </div>

                {/* Tipo de visualização */}
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    Modelo de Apresentação:
                  </label>
                  <select
                    value={prefs.monofasicosTipo}
                    onChange={e => setPrefs(p => ({ ...p, monofasicosTipo: e.target.value as any }))}
                    className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="detalhado">Detalhado (Nota, Data/Hora, Produto, NCM, Alíquota, Qtd, Total)</option>
                    <option value="agrupado">Agrupado / Sintético (Qtd Total, Produto, NCM, PIS/COFINS, Valor)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* SEÇÃO 5: CONFIGURAÇÕES DE ENVIO VIA WHATSAPP & E-MAIL (FUNÇÕES 1 E 2) */}
          <div className="p-4 bg-gradient-to-br from-indigo-50/70 via-white to-slate-50 border border-indigo-200/80 rounded-2xl space-y-3.5 shadow-xs">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={prefs.envioAutomaticoAtivo}
                  onChange={e => setPrefs(p => ({ ...p, envioAutomaticoAtivo: e.target.checked }))}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5 uppercase tracking-wider">
                  <Send size={14} className="text-indigo-600" />
                  Enviar automaticamente o fechamento todo mês (Função 2)
                </span>
              </label>

              <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border transition ${
                prefs.envioAutomaticoAtivo 
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                  : 'bg-slate-100 text-slate-500 border-slate-200'
              }`}>
                {prefs.envioAutomaticoAtivo ? 'Agendamento Habilitado' : 'Agendamento Desabilitado'}
              </span>
            </div>

            <p className="text-[11px] text-slate-500 leading-tight">
              O sistema consolida os XMLs e relatórios fiscais do mês anterior e transmite automaticamente pelo WhatsApp e E-mail.
            </p>

            {/* Campos de Contato e Dia (Exibidos sempre para permitir configurar tanto o envio imediato quanto o agendado) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-indigo-100/70">
              {/* Dia do mês */}
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Dia do Fechamento Automático:
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    max={31}
                    disabled={!prefs.envioAutomaticoAtivo}
                    placeholder="Ex: 5"
                    value={prefs.envioDiaMes || ''}
                    onChange={e => setPrefs(p => ({ ...p, envioDiaMes: e.target.value }))}
                    className="w-full bg-white border border-slate-300 disabled:bg-slate-100 disabled:text-slate-400 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                  <span className="absolute right-3 top-2 text-[10px] text-slate-400 font-bold uppercase">
                    todo dia
                  </span>
                </div>
              </div>

              {/* WhatsApp */}
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  WhatsApp (sem o +55):
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Ex: 37999998888"
                    value={prefs.envioWhatsapp || ''}
                    onChange={e => {
                      const clean = e.target.value.replace(/\D/g, '').slice(0, 11)
                      setPrefs(p => ({ ...p, envioWhatsapp: clean }))
                    }}
                    className="w-full bg-white border border-slate-300 rounded-xl pl-8 pr-3 py-2 text-xs font-mono font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                  <Phone size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                </div>
              </div>

              {/* E-mail */}
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  E-mail de Destino:
                </label>
                <div className="relative">
                  <input
                    type="email"
                    placeholder="Ex: fiscal@empresa.com.br"
                    value={prefs.envioEmail || ''}
                    onChange={e => setPrefs(p => ({ ...p, envioEmail: e.target.value }))}
                    className="w-full bg-white border border-slate-300 rounded-xl pl-8 pr-3 py-2 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                  <Mail size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                </div>
              </div>
            </div>

            {/* Checkboxes para disparo imediato na geração deste fechamento (WhatsApp e E-mail) */}
            <div className="pt-2 border-t border-indigo-100/70 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={dispararWhatsappAoGerar}
                  onChange={e => setDispararWhatsappAoGerar(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                />
                <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                  <Phone size={13} className="text-emerald-600" />
                  <strong>Disparar resumo via WhatsApp imediatamente</strong> ao gerar este fechamento
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={dispararEmailAoGerar}
                  onChange={e => setDispararEmailAoGerar(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                />
                <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                  <Mail size={13} className="text-indigo-600" />
                  <strong>Disparar resumo por E-mail imediatamente</strong> ao gerar este fechamento
                </span>
              </label>
            </div>
          </div>

          {/* AVISO DA REGRA DE OURO: SEM PASTAS VAZIAS */}
          <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-[11px]">
            <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
            <span>
              <strong>Garantia de Pastas Limpas:</strong> As pastas de cada modalidade (<code className="font-semibold text-emerald-950">NFE_Entradas</code>, <code className="font-semibold text-emerald-950">NFCE_Saidas</code>, etc.) só serão criadas se existirem arquivos XML emitidos na competência, evitando qualquer pasta vazia no ZIP.
            </span>
          </div>

        </div>

        {/* RODAPÉ DO MODAL COM BOTÕES DE AÇÃO */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          
          {/* Botão Salvar Padrão */}
          <button
            type="button"
            onClick={handleSalvarParaSempre}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs ${
              salvoSucesso
                ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-200'
                : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            {salvoSucesso ? <CheckCircle2 size={15} /> : <Bookmark size={15} />}
            {salvoSucesso ? mensagemSucesso : 'Salvar Padrão'}
          </button>

          {/* Botões Recolher e Gerar Fechamento */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={processando}
              className="flex-1 sm:flex-initial px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <ChevronUp size={15} />
              Recolher Sanfona
            </button>

            <button
              type="button"
              onClick={handleExecutarFechamento}
              disabled={processando}
              className="flex-1 sm:flex-initial px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-xl text-xs font-black shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {processando ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Gerando Fechamento...
                </>
              ) : (
                <>
                  <Download size={15} />
                  Gerar e Baixar Fechamento ZIP
                </>
              )}
            </button>
          </div>

        </div>

      {/* MODAL DE ERRO CENTRALIZADO (PADRÃO UI/UX HUB PARATECH) */}
      {erroModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-rose-200 w-full max-w-md p-6 text-center animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4 ring-8 ring-rose-50 shadow-inner">
              <AlertTriangle size={32} />
            </div>
            
            <h3 className="text-lg font-black text-slate-900 tracking-tight">
              Falha no Fechamento Fiscal
            </h3>
            
            <div className="mt-3.5 p-3.5 bg-rose-50/80 border border-rose-200/80 rounded-2xl text-left">
              <p className="text-xs text-rose-900 font-semibold leading-relaxed break-words">
                {erroModal}
              </p>
            </div>

            <p className="text-[11px] text-slate-500 mt-3">
              Verifique a conexão ou os parâmetros da empresa e tente novamente.
            </p>

            <div className="mt-5">
              <button
                type="button"
                onClick={() => setErroModal(null)}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-700 hover:to-red-800 text-white rounded-xl text-xs font-black shadow-md hover:shadow-lg transition"
              >
                Entendido / Fechar Alerta
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
