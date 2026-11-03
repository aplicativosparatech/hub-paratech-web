import { createAdminClient } from '@/utils/supabase/admin'
import { obterOuGerarPixFatura } from '@/utils/pix'
import { sendWhatsAppMessage, extrairTelefonesWhatsapp } from '@/utils/whatsapp'

export const NOMES_MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

export interface GerarFaturasOptions {
  dataReferencia?: Date
  competencia?: string
  dispararWhatsapp?: boolean
  forcarWhatsapp?: boolean
  baseUrl?: string
}

export interface FaturaDetalheItem {
  clienteId: string
  cliente: string
  cnpj?: string
  sistema?: string
  telefone?: string
  valor: number
  vencimento: string
  faturaId?: string
  status: 'criada' | 'atualizada' | 'ja_existia' | 'paga_antecipada' | 'sem_mensalidade'
  whatsappEnviado?: boolean
  whatsappErro?: string
  periodo?: string
}

export interface GerarFaturasResult {
  totalClientesAtivos: number
  faturasCriadas: number
  faturasAtualizadas: number
  faturasIgnoradas: number
  mensagensEnviadas: number
  competencia: string
  mesAnteriorReferencia: string
  detalhes: FaturaDetalheItem[]
}

/**
 * Retorna a competência e o nome amigável do mês anterior.
 * Exemplo: se competência é 11/2026, mês anterior é Outubro/2026 (10/2026).
 */
export function calcularCompetenciaEMesAnterior(dataReferencia: Date = new Date(), compStr?: string) {
  let ano: number
  let mesNum: number

  if (compStr && compStr.includes('/')) {
    const parts = compStr.split('/')
    mesNum = parseInt(parts[0], 10)
    ano = parseInt(parts[1], 10)
  } else {
    ano = dataReferencia.getFullYear()
    mesNum = dataReferencia.getMonth() + 1
  }

  const competencia = `${String(mesNum).padStart(2, '0')}/${ano}`

  const mesAnteriorNum = mesNum === 1 ? 12 : mesNum - 1
  const anoAnterior = mesNum === 1 ? ano - 1 : ano
  const mesAnteriorNome = `${NOMES_MESES[mesAnteriorNum - 1]}/${anoAnterior}`
  const mesAnteriorComp = `${String(mesAnteriorNum).padStart(2, '0')}/${anoAnterior}`

  return { ano, mesNum, competencia, mesAnteriorNum, anoAnterior, mesAnteriorNome, mesAnteriorComp }
}

/**
 * Gera automaticamente as faturas para todos os clientes ativos mensalistas.
 * - Idempotente: não duplica faturas existentes para a mesma competência.
 * - Suporta envio automático de WhatsApp com saudação pelo nome, identificação do sistema comercial,
 *   referência ao mês anterior, link público de pagamento e Pix Copia e Cola.
 */
export async function gerarFaturasMensalistas(options: GerarFaturasOptions = {}): Promise<GerarFaturasResult> {
  const supabase = createAdminClient()
  const dataReferencia = options.dataReferencia || new Date()
  const { ano, mesNum, competencia, mesAnteriorNome } = calcularCompetenciaEMesAnterior(dataReferencia, options.competencia)

  const baseUrl = options.baseUrl || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://hub.paratechsolucoes.com.br'

  // 1. Buscar todos os clientes ATIVOS
  const { data: clientes, error: cliError } = await supabase
    .from('clientes')
    .select(`
      id, razao_social, nome_fantasia, cnpj, valor_mensalidade, dia_vencimento, is_ativo,
      nome_sistema_utilizado, nome_contato, whatsapp, whatsapp_cobranca, periodo_cobranca
    `)
    .eq('is_ativo', true)

  if (cliError) throw cliError
  if (!clientes || clientes.length === 0) {
    return {
      totalClientesAtivos: 0,
      faturasCriadas: 0,
      faturasAtualizadas: 0,
      faturasIgnoradas: 0,
      mensagensEnviadas: 0,
      competencia,
      mesAnteriorReferencia: mesAnteriorNome,
      detalhes: []
    }
  }

  // 2. Buscar faturas já existentes nesta competência (mensal, quinzenal ou semanal)
  const { data: faturasExistentes, error: fatError } = await supabase
    .from('faturas')
    .select('id, cliente_id, competencia, valor, valor_original, data_vencimento, status, qr_code_payload, periodo_cobranca, parcela_periodo')
    .or(`competencia.eq.${competencia},competencia.ilike.${competencia} (%`)

  if (fatError) throw fatError

  // Mapeia faturas existentes por "clienteId_competencia"
  const faturasMap = new Map<string, any>()
  for (const f of faturasExistentes || []) {
    faturasMap.set(`${f.cliente_id}__${f.competencia}`, f)
  }

  const novasFaturas: any[] = []
  const detalhes: FaturaDetalheItem[] = []
  let faturasAtualizadas = 0
  let mensagensEnviadas = 0

  // Último dia do mês para evitar datas inválidas (ex: 31 de fevereiro)
  const ultimoDiaDoMes = new Date(ano, mesNum, 0).getDate()

  // 3. Processar cada cliente ativo
  for (const c of clientes) {
    const nomeExibicao = c.nome_fantasia || c.razao_social
    const valorCadastrado = Number(c.valor_mensalidade || 0)
    const telefonesCliente = extrairTelefonesWhatsapp(c.whatsapp_cobranca || c.whatsapp)
    const telefonePrincipal = telefonesCliente[0] || ''
    const periodo = (c.periodo_cobranca || 'mensal').toLowerCase()

    if (valorCadastrado <= 0) {
      detalhes.push({
        clienteId: c.id,
        cliente: nomeExibicao,
        cnpj: c.cnpj,
        sistema: c.nome_sistema_utilizado,
        telefone: telefonePrincipal,
        valor: 0,
        vencimento: '-',
        status: 'sem_mensalidade',
        periodo
      })
      continue
    }

    const diaVenc = Math.min(Math.max(c.dia_vencimento || 10, 1), ultimoDiaDoMes)

    // Define os sub-períodos (mensal: 1 fatura; quinzenal: 2 faturas; semanal: 4 faturas)
    interface ParcelaPlano {
      competenciaNome: string
      vencimento: string
      valor: number
      parcelaNum: number
    }

    const parcelasPlanejadas: ParcelaPlano[] = []

    if (periodo === 'quinzenal') {
      const val1 = parseFloat((valorCadastrado / 2).toFixed(2))
      const val2 = parseFloat((valorCadastrado - val1).toFixed(2))

      const diaQ1 = Math.min(diaVenc, 15)
      const vencQ1 = `${ano}-${String(mesNum).padStart(2, '0')}-${String(diaQ1).padStart(2, '0')}`

      const diaQ2 = Math.min(diaQ1 + 15, ultimoDiaDoMes)
      const vencQ2 = `${ano}-${String(mesNum).padStart(2, '0')}-${String(diaQ2).padStart(2, '0')}`

      parcelasPlanejadas.push(
        { competenciaNome: `${competencia} (1ª Quinzena)`, vencimento: vencQ1, valor: val1, parcelaNum: 1 },
        { competenciaNome: `${competencia} (2ª Quinzena)`, vencimento: vencQ2, valor: val2, parcelaNum: 2 }
      )
    } else if (periodo === 'semanal') {
      const valSem = parseFloat((valorCadastrado / 4).toFixed(2))
      const valUltima = parseFloat((valorCadastrado - (valSem * 3)).toFixed(2))

      parcelasPlanejadas.push(
        { competenciaNome: `${competencia} (Semana 1)`, vencimento: `${ano}-${String(mesNum).padStart(2, '0')}-07`, valor: valSem, parcelaNum: 1 },
        { competenciaNome: `${competencia} (Semana 2)`, vencimento: `${ano}-${String(mesNum).padStart(2, '0')}-14`, valor: valSem, parcelaNum: 2 },
        { competenciaNome: `${competencia} (Semana 3)`, vencimento: `${ano}-${String(mesNum).padStart(2, '0')}-21`, valor: valSem, parcelaNum: 3 },
        { competenciaNome: `${competencia} (Semana 4)`, vencimento: `${ano}-${String(mesNum).padStart(2, '0')}-${String(Math.min(28, ultimoDiaDoMes)).padStart(2, '0')}`, valor: valUltima, parcelaNum: 4 }
      )
    } else {
      // Padrão: MENSAL (1 única fatura no mês)
      const dataVencimentoEsperada = `${ano}-${String(mesNum).padStart(2, '0')}-${String(diaVenc).padStart(2, '0')}`
      parcelasPlanejadas.push({
        competenciaNome: competencia,
        vencimento: dataVencimentoEsperada,
        valor: valorCadastrado,
        parcelaNum: 1
      })
    }

    // Processa cada fatura planejada do cliente
    for (const parc of parcelasPlanejadas) {
      const chaveFatura = `${c.id}__${parc.competenciaNome}`
      const faturaExistente = faturasMap.get(chaveFatura)

      if (faturaExistente) {
        if (faturaExistente.status === 'pago' || faturaExistente.status === 'paga') {
          detalhes.push({
            clienteId: c.id,
            cliente: nomeExibicao,
            cnpj: c.cnpj,
            sistema: c.nome_sistema_utilizado,
            telefone: telefonePrincipal,
            valor: Number(faturaExistente.valor),
            vencimento: faturaExistente.data_vencimento,
            faturaId: faturaExistente.id,
            status: 'paga_antecipada',
            periodo
          })
          continue
        }

        const valorBaseAtual = Number(faturaExistente.valor_original ?? faturaExistente.valor)
        const mudouValor = Math.abs(valorBaseAtual - parc.valor) > 0.009
        const mudouVencimento = faturaExistente.data_vencimento !== parc.vencimento

        if (mudouValor || mudouVencimento) {
          await supabase
            .from('faturas')
            .update({
              valor: parc.valor,
              valor_original: parc.valor,
              data_vencimento: parc.vencimento,
              periodo_cobranca: periodo,
              parcela_periodo: parc.parcelaNum,
              qr_code_payload: null
            })
            .eq('id', faturaExistente.id)

          faturasAtualizadas++
          detalhes.push({
            clienteId: c.id,
            cliente: nomeExibicao,
            cnpj: c.cnpj,
            sistema: c.nome_sistema_utilizado,
            telefone: telefonePrincipal,
            valor: parc.valor,
            vencimento: parc.vencimento,
            faturaId: faturaExistente.id,
            status: 'atualizada',
            periodo
          })
        } else {
          detalhes.push({
            clienteId: c.id,
            cliente: nomeExibicao,
            cnpj: c.cnpj,
            sistema: c.nome_sistema_utilizado,
            telefone: telefonePrincipal,
            valor: Number(faturaExistente.valor),
            vencimento: faturaExistente.data_vencimento,
            faturaId: faturaExistente.id,
            status: 'ja_existia',
            periodo
          })
        }
        continue
      }

      // Fatura nova para esta parcela/período
      novasFaturas.push({
        cliente_id: c.id,
        competencia: parc.competenciaNome,
        data_vencimento: parc.vencimento,
        valor: parc.valor,
        valor_original: parc.valor,
        periodo_cobranca: periodo,
        parcela_periodo: parc.parcelaNum,
        status: 'pendente'
      })

      detalhes.push({
        clienteId: c.id,
        cliente: nomeExibicao,
        cnpj: c.cnpj,
        sistema: c.nome_sistema_utilizado,
        telefone: telefonePrincipal,
        valor: parc.valor,
        vencimento: parc.vencimento,
        status: 'criada',
        periodo
      })
    }
  }

  // 4. Inserir novas faturas no banco
  if (novasFaturas.length > 0) {
    const { data: faturasInseridas, error: insertError } = await supabase
      .from('faturas')
      .insert(novasFaturas)
      .select('id, cliente_id, valor, data_vencimento, competencia')

    if (insertError) throw insertError

    if (faturasInseridas) {
      for (const fi of faturasInseridas) {
        const item = detalhes.find(d => d.clienteId === fi.cliente_id && d.status === 'criada' && !d.faturaId)
        if (item) item.faturaId = fi.id
      }
    }
  }

  // 5. Se solicitado envio de WhatsApp (ex: primeiro dia do mês ou botão Gerar Todas com checkbox)
  if (options.dispararWhatsapp) {
    // Verifica se os disparos de WhatsApp do Cron estão ativos pelo Administrador
    let isWhatsappHabilitado = true
    if (!options.forcarWhatsapp) {
      const { data: configGeral } = await supabase
        .from('configuracoes_portal_geral')
        .select('cron_whatsapp_ativo')
        .eq('id', 1)
        .maybeSingle()

      if (configGeral?.cron_whatsapp_ativo === false) {
        isWhatsappHabilitado = false
      }
    }

    if (!isWhatsappHabilitado) {
      for (const item of detalhes) {
        if (item.status !== 'sem_mensalidade' && item.status !== 'paga_antecipada') {
          item.whatsappEnviado = false
          item.whatsappErro = 'Disparos automáticos do Cron estão pausados pelo Administrador.'
        }
      }
    } else {
      for (const item of detalhes) {
      if (item.status === 'sem_mensalidade' || item.status === 'paga_antecipada' || !item.faturaId) {
        continue
      }

      const clienteObj = clientes.find(c => c.id === item.clienteId)
      if (!clienteObj) continue

      const telefones = extrairTelefonesWhatsapp(clienteObj.whatsapp_cobranca || clienteObj.whatsapp)
      if (telefones.length === 0) {
        item.whatsappEnviado = false
        item.whatsappErro = 'Telefone inválido ou não cadastrado'
        continue
      }

      try {
        // Assegura QR Code Pix
        const pixResult = await obterOuGerarPixFatura(item.faturaId)
        const pixPayload = pixResult.qr_code_payload

        // Nome de saudação
        const nomeCumprimento = clienteObj.nome_contato?.trim() || clienteObj.nome_fantasia?.trim() || clienteObj.razao_social?.trim() || 'Cliente'
        const nomeSistema = clienteObj.nome_sistema_utilizado?.trim() || 'MEI Simples'

        // Formatação de valores e datas
        const valorFormatado = Number(item.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        const [anoV, mesV, diaV] = item.vencimento.split('-')
        const vencimentoFormatado = `${diaV}/${mesV}/${anoV}`

        const linkFatura = `${baseUrl}/fatura/${item.faturaId}`

        const mensagem = [
          `Olá, ${nomeCumprimento}! 👋`,
          ``,
          `Passando para enviar a fatura da mensalidade do seu *Sistema de Gerenciamento Comercial e Fiscal [${nomeSistema}]*, referente ao mês anterior (${mesAnteriorNome}).`,
          ``,
          `📄 *Detalhes da Fatura:*`,
          `• *Competência:* ${competencia} (Serviços de ${mesAnteriorNome})`,
          `• *Valor:* R$ ${valorFormatado}`,
          `• *Vencimento:* ${vencimentoFormatado}`,
          ``,
          `🔗 *Acesse sua fatura online:*`,
          `${linkFatura}`,
          ``,
          `🔑 *Código Pix Copia e Cola:*`,
          `\`\`\`${pixPayload}\`\`\``,
          ``,
          `_Após o pagamento via Pix, a confirmação e liberação do seu sistema ocorrem de forma 100% automática em segundos._`,
          ``,
          `Ficamos à disposição para qualquer dúvida ou suporte!`,
          `*Paratech Soluções em Software*`
        ].join('\n')

        // Dispara para cada um dos números de WhatsApp cadastrados no cliente
        let algumDisparado = false
        for (const tel of telefones) {
          try {
            await sendWhatsAppMessage({
              to: tel,
              message: mensagem,
              remetente: 'Robô Automático (1º Dia do Mês)',
              destinatarioTipo: 'cliente',
              destinatarioNome: clienteObj.nome_fantasia || clienteObj.razao_social,
              motivo: 'Fatura Mensalidade (Dia 01)',
              modelo: 'Aviso 1º Dia do Mês',
              clienteId: clienteObj.id,
              faturaId: item.faturaId
            })
            algumDisparado = true
          } catch (errDisparo) {
            console.error(`Erro ao disparar fatura do dia 01 para ${tel}:`, errDisparo)
          }
        }

        if (algumDisparado) {
          item.whatsappEnviado = true
          mensagensEnviadas++
        } else {
          item.whatsappEnviado = false
          item.whatsappErro = 'Falha no disparo para os telefones do cliente'
        }
      } catch (errWpp: any) {
        console.error(`Erro ao enviar WhatsApp para ${clienteObj.razao_social}:`, errWpp)
        item.whatsappEnviado = false
        item.whatsappErro = errWpp.message || 'Erro no envio WhatsApp'
      }
    }
  }
}

  return {
    totalClientesAtivos: clientes.length,
    faturasCriadas: novasFaturas.length,
    faturasAtualizadas,
    faturasIgnoradas: clientes.length - novasFaturas.length - faturasAtualizadas,
    mensagensEnviadas,
    competencia,
    mesAnteriorReferencia: mesAnteriorNome,
    detalhes
  }
}

/**
 * Rotina executada no 1º dia do mês:
 * Gera todas as faturas faltantes da competência que se inicia e dispara mensagem de cobrança
 * para todos os mensalistas via WhatsApp com link de pagamento e código Pix Copia e Cola.
 */
export async function executarRotinaPrimeiroDiaDoMes(options: { dataReferencia?: Date; forcar?: boolean; baseUrl?: string } = {}) {
  const hoje = options.dataReferencia || new Date()

  // Se não estiver forçado e não for dia 01, não executa
  if (!options.forcar && hoje.getDate() !== 1) {
    return {
      executado: false,
      motivo: `Hoje é dia ${hoje.getDate()}, rotina programada para rodar exclusivamente no dia 01 do mês.`,
      resultado: null
    }
  }

  // Trava do Cron: Se não for forçado manualmente e o cron estiver desativado pelo Administrador, aborta
  if (!options.forcar) {
    const supabase = createAdminClient()
    const { data: configGeral } = await supabase
      .from('configuracoes_portal_geral')
      .select('cron_whatsapp_ativo')
      .eq('id', 1)
      .maybeSingle()

    if (configGeral?.cron_whatsapp_ativo === false) {
      return {
        executado: false,
        motivo: 'Rotina do 1º dia do mês pausada: Disparos e rotinas do Cron estão desativados pelo Administrador.',
        resultado: null
      }
    }
  }

  const resultado = await gerarFaturasMensalistas({
    dataReferencia: hoje,
    dispararWhatsapp: true,
    forcarWhatsapp: options.forcar,
    baseUrl: options.baseUrl
  })

  return {
    executado: true,
    motivo: 'Rotina do 1º dia do mês executada com sucesso.',
    resultado
  }
}
