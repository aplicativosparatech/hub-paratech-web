/**
 * Modelos Oficiais de Mensagens da Régua de Cobrança do Hub Paratech
 * Suporta interpolação de todas as variáveis do Hub:
 * [Cliente], [Empresa], [Fatura] / [FAT-001], [Competencia], [Valor],
 * [Data] / [Vencimento], [Data_Bloqueio], [Dias_Tolerancia], [Link_Pix], [Link_QRCode], [Pix_Copia_Cola]
 */

export type SituacaoCobranca =
  | 'pre_vencimento'
  | 'no_vencimento'
  | 'atrasado_tolerancia'
  | 'bloqueado'
  | 'pago'
  | 'abandono_pix'

export interface DadosParaMensagem {
  cliente: {
    id: string
    razao_social?: string | null
    nome_fantasia?: string | null
    nome_contato?: string | null
    whatsapp?: string | null
    whatsapp_cobranca?: string | null
    dias_carencia?: number | null
  }
  fatura: {
    id: string
    valor: number
    valor_original?: number | null
    data_vencimento: string
    competencia?: string | null
    qr_code_payload?: string | null
    status?: string | null
  }
  encargos?: {
    emAtraso: boolean
    valorMulta: number
    valorJuros: number
    valorTotal: number
  }
  diasParaBloqueio?: number
  diasCarenciaEfetivos?: number
  dataVencimentoFormatada?: string
  dataBloqueioFormatada?: string
  baseUrl?: string
}

export interface MensagemGerada {
  situacao: SituacaoCobranca
  tituloCondicao: string
  modelo: string
  motivo: string
  mensagem: string
  clienteNome: string
  empresaNome: string
  faturaCodigo: string
  competencia: string
  valorFormatado: string
  dataVencimento: string
  dataBloqueio: string
  linkFatura: string
  linkQrCode: string
  pixCopiaCola: string
  diasParaBloqueio: number
  diasCarencia: number
}

/**
 * Gera a mensagem oficial do Hub Paratech com base na situação e nos dados do cliente/fatura.
 */
export function gerarMensagemCobranca(
  situacao: SituacaoCobranca,
  dados: DadosParaMensagem
): MensagemGerada {
  const { cliente, fatura, encargos, baseUrl: customBaseUrl } = dados

  const baseUrl = (
    customBaseUrl ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'https://hub-paratech-web.vercel.app'
  ).replace(/\/+$/, '')

  // 1. Extração de variáveis com fallback seguro
  const clienteNome = (cliente.nome_contato || '').trim() ||
    (cliente.nome_fantasia || '').trim() ||
    (cliente.razao_social || '').trim() ||
    'Cliente'

  const empresaNome = (cliente.nome_fantasia || '').trim() ||
    (cliente.razao_social || '').trim() ||
    'Sua Empresa'

  const faturaCodigo = `FAT-${(fatura.id || '00000000').split('-')[0].toUpperCase()}`
  const competencia = fatura.competencia || 'este mês'

  const valorBase = encargos?.valorTotal ?? Number(fatura.valor || 0)
  const valorFormatado = valorBase.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  // Datas
  let dataVencimento = dados.dataVencimentoFormatada || ''
  if (!dataVencimento && fatura.data_vencimento) {
    const [ano, mes, dia] = fatura.data_vencimento.split('T')[0].split('-')
    dataVencimento = `${dia}/${mes}/${ano}`
  }

  const diasCarencia = dados.diasCarenciaEfetivos ?? (cliente.dias_carencia || 3)
  const diasParaBloqueio = dados.diasParaBloqueio ?? 0

  let dataBloqueio = dados.dataBloqueioFormatada || ''
  if (!dataBloqueio && fatura.data_vencimento) {
    const dt = new Date(`${fatura.data_vencimento.split('T')[0]}T00:00:00`)
    dt.setDate(dt.getDate() + diasCarencia)
    dataBloqueio = dt.toLocaleDateString('pt-BR')
  }

  const linkFatura = `${baseUrl}/fatura/${fatura.id}`
  const linkQrCode = `${baseUrl}/api/fatura-publica/${fatura.id}/qrcode`
  const pixCopiaCola = (fatura.qr_code_payload || '').trim()

  const bannerHeader = `🏢 *PARATECH TECNOLOGIA & SISTEMAS*\n─────────────────────────────\n`

  const linksPagamento = [
    `📄 *Visualizar Fatura Completa & QR Code:*`,
    `${linkFatura}`,
    ``,
    `🖼️ *Abrir Imagem do QR Code Pix:*`,
    `${linkQrCode}`
  ].join('\n')

  const pixBloco = pixCopiaCola
    ? `\n\n${linksPagamento}\n\n🔑 *Pix Copia e Cola:*\n\`\`\`${pixCopiaCola}\`\`\``
    : `\n\n${linksPagamento}`

  let textoEncargos = ''
  if (encargos?.emAtraso && ((encargos.valorMulta || 0) > 0 || (encargos.valorJuros || 0) > 0)) {
    textoEncargos = ` (inclui R$ ${encargos.valorMulta.toFixed(2)} de multa e R$ ${encargos.valorJuros.toFixed(2)} de juros)`
  }

  // 2. Construção da mensagem conforme o Modelo Oficial da Régua
  let tituloCondicao = ''
  let modelo = ''
  let motivo = ''
  let mensagem = ''

  switch (situacao) {
    case 'pre_vencimento': {
      tituloCondicao = 'Fatura Disponível (Pré-Vencimento)'
      modelo = '1. Fatura Disponível'
      motivo = 'Pré-Vencimento (5 dias antes)'
      mensagem = `${bannerHeader}📄 *FATURA DISPONÍVEL*\n\nOlá, *${clienteNome}*! 👋\nA fatura *[${faturaCodigo}]* da empresa *${empresaNome}* referente a *${competencia}* já está disponível.\n\n• *Valor:* ${valorFormatado}\n• *Vencimento:* ${dataVencimento}${pixBloco}\n\nPague antecipadamente com tranquilidade via Pix com baixa instantânea no sistema!`
      break
    }

    case 'no_vencimento': {
      tituloCondicao = 'Vence Hoje (Lembrete)'
      modelo = '2. No Vencimento'
      motivo = 'Lembrete de Vencimento (Dia D)'
      mensagem = `${bannerHeader}🔔 *LEMBRETE DE VENCIMENTO*\n\nOlá, *${clienteNome}*! Sua fatura *[${faturaCodigo}]* da empresa *${empresaNome}* vence hoje, *${dataVencimento}*.\n\n• *Valor:* ${valorFormatado}\n\nPara evitar o bloqueio previsto para *${dataBloqueio}*, regularize o pagamento. Faltam ${diasCarencia} dias de tolerância.${pixBloco}\n\n⚡ A liberação e compensação ocorrem de forma 100% automática em segundos após o Pix!`
      break
    }

    case 'atrasado_tolerancia': {
      const avisoDias = diasParaBloqueio <= 0
        ? 'o prazo de tolerância encerra *HOJE*!'
        : `faltam apenas *${diasParaBloqueio}* dia(s) de tolerância antes do bloqueio previsto para *${dataBloqueio}*.`

      tituloCondicao = `Em Atraso (${diasParaBloqueio}d de tolerância)`
      modelo = '3. Atraso & Regressiva'
      motivo = 'Cobrança Progressiva (Em Atraso)'
      mensagem = `${bannerHeader}⚠️ *AVISO DE FATURA EM ATRASO*\n\nOlá, *${clienteNome}*! Ainda não identificamos o pagamento da fatura *[${faturaCodigo}]* da empresa *${empresaNome}*, que venceu em *${dataVencimento}*.\n\nPara evitar a interrupção do sistema prevista para *${dataBloqueio}*, ${avisoDias}\n\n• *Valor Atualizado:* ${valorFormatado}${textoEncargos}${pixBloco}\n\nEvite encargos adicionais e a suspensão dos serviços. (Se já pagou, favor desconsiderar).`
      break
    }

    case 'bloqueado': {
      tituloCondicao = 'Bloqueado por Inadimplência'
      modelo = '4. Aviso de Bloqueio'
      motivo = 'Aviso de Bloqueio por Inadimplência'
      mensagem = `${bannerHeader}🚨 *AVISO DE BLOQUEIO POR PENDÊNCIA FINANCEIRA* 🚨\n\nOlá, *${clienteNome}*! O prazo de tolerância para a fatura *[${faturaCodigo}]* referente a *${competencia}* da empresa *${empresaNome}* encerrou em *${dataBloqueio}* e seu sistema pode ter sido bloqueado.\n\n• *Fatura:* ${faturaCodigo}\n• *Vencimento Original:* ${dataVencimento}\n• *Valor Atualizado:* ${valorFormatado}${textoEncargos}${pixBloco}\n\n⚡ *Liberação Instantânea:* O sistema desbloqueia de forma 100% automática em segundos após a confirmação do Pix!`
      break
    }

    case 'pago': {
      tituloCondicao = 'Fatura Quitada (Em Dia)'
      modelo = '5. Ao Pagar (Confirmação)'
      motivo = 'Confirmação de Quitação'
      mensagem = `${bannerHeader}✅ *PAGAMENTO CONFIRMADO!*\n\nOlá, *${clienteNome}*! Confirmamos o recebimento da fatura *[${faturaCodigo}]* referente a *${competencia}* da empresa *${empresaNome}* no valor de *${valorFormatado}*.\n\nSeu sistema está liberado para uso normal. Muito obrigado pela pontualidade e parceria!\n\n*Paratech Soluções em Software*`
      break
    }

    case 'abandono_pix': {
      tituloCondicao = 'Abandono de Pix (Recuperação)'
      modelo = '6. Abandono de Pix'
      motivo = 'Recuperação de Pagamento'
      mensagem = `${bannerHeader}Olá, *${clienteNome}*! Notamos que você iniciou o pagamento da fatura *[${faturaCodigo}]* da empresa *${empresaNome}* no valor de *${valorFormatado}*, mas a operação não foi concluída.\n\nPrecisa de ajuda com o Pix? Você pode concluir de forma rápida tocando no link abaixo:${pixBloco}\n\nQualquer dúvida estamos à inteira disposição!`
      break
    }
  }

  return {
    situacao,
    tituloCondicao,
    modelo,
    motivo,
    mensagem,
    clienteNome,
    empresaNome,
    faturaCodigo,
    competencia,
    valorFormatado,
    dataVencimento,
    dataBloqueio,
    linkFatura,
    linkQrCode,
    pixCopiaCola,
    diasParaBloqueio,
    diasCarencia
  }
}

export const OPCOES_SITUACAO = [
  { valor: 'auto', rotulo: '⚡ Condição Real Detectada (Automático)', badge: 'bg-emerald-100 text-emerald-800' },
  { valor: 'pre_vencimento', rotulo: '1. Pré-Vencimento (Fatura Disponível - 5 dias antes)', badge: 'bg-blue-100 text-blue-800' },
  { valor: 'no_vencimento', rotulo: '2. No Vencimento (Lembrete - Vence Hoje)', badge: 'bg-amber-100 text-amber-800' },
  { valor: 'atrasado_tolerancia', rotulo: '3. Atraso & Regressiva (Cobrança Progressiva)', badge: 'bg-orange-100 text-orange-800' },
  { valor: 'bloqueado', rotulo: '4. Bloqueio por Inadimplência (Sistema Bloqueado)', badge: 'bg-red-100 text-red-800' },
  { valor: 'pago', rotulo: '5. Ao Pagar (Confirmação de Quitação)', badge: 'bg-emerald-100 text-emerald-800' },
  { valor: 'abandono_pix', rotulo: '6. Abandono de Pix (Recuperação)', badge: 'bg-purple-100 text-purple-800' }
]
