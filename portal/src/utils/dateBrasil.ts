/**
 * Utilitário para tratamento de datas fiscais no Fuso Horário Oficial do Brasil (Minas Gerais / Brasília)
 * Fuso IANA: America/Sao_Paulo (UTC-3)
 */

export const FUSO_BRASIL = 'America/Sao_Paulo'

/**
 * Formata data e hora completas no fuso de Minas Gerais / Brasília
 * Exemplo: "30/09/2026 22:58:45"
 */
export function formatarDataHoraBrasil(dateStr?: string | null): string {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr

    return d.toLocaleString('pt-BR', {
      timeZone: FUSO_BRASIL,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  } catch {
    return dateStr
  }
}

/**
 * Formata apenas a data no fuso de Minas Gerais / Brasília
 * Exemplo: "30/09/2026"
 */
export function formatarDataBrasil(dateStr?: string | null): string {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr

    return d.toLocaleDateString('pt-BR', {
      timeZone: FUSO_BRASIL,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  } catch {
    return dateStr
  }
}

/**
 * Formata apenas o horário no fuso de Minas Gerais / Brasília
 * Exemplo: "22:58:45"
 */
export function formatarHoraBrasil(dateStr?: string | null): string {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return ''

    return d.toLocaleTimeString('pt-BR', {
      timeZone: FUSO_BRASIL,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  } catch {
    return ''
  }
}

/**
 * Extrai o mês de competência no formato YYYY-MM
 * Prioriza a chave da SEFAZ (dígitos 2 a 5 são AAMM), ou o timezone de Brasília.
 * Exemplo: para uma nota emitida em 30/09/2026 às 22:58, retorna "2026-09".
 */
export function extrairCompetenciaBrasil(dateStr?: string | null, chave?: string | null): string {
  // 1. A chave de 44 dígitos da SEFAZ é a verdade fiscal absoluta
  if (chave && chave.replace(/\D/g, '').length === 44) {
    const cleanChave = chave.replace(/\D/g, '')
    const aa = cleanChave.substring(2, 4)
    const mm = cleanChave.substring(4, 6)
    return `20${aa}-${mm}`
  }

  // 2. Se não tiver chave, calcula a data no fuso de Brasília/Minas Gerais
  if (dateStr) {
    try {
      const d = new Date(dateStr)
      if (!isNaN(d.getTime())) {
        return new Intl.DateTimeFormat('en-CA', {
          timeZone: FUSO_BRASIL,
          year: 'numeric',
          month: '2-digit'
        }).format(d) // 'YYYY-MM'
      }
    } catch {
      // fallback
    }
    return dateStr.substring(0, 7)
  }

  return ''
}

/**
 * Extrai a data no formato ISO YYYY-MM-DD no fuso de Minas Gerais / Brasília
 * Exemplo: para "2026-10-01T01:58:45+00:00", retorna "2026-09-30".
 */
export function extrairDataIsoBrasil(dateStr?: string | null): string {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    if (!isNaN(d.getTime())) {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: FUSO_BRASIL,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(d) // 'YYYY-MM-DD'
    }
  } catch {
    // fallback
  }
  return dateStr.substring(0, 10)
}

/**
 * Retorna o intervalo exato de início e fim do mês considerando o fuso de Brasília (UTC-3)
 * para filtrar no banco de dados sem perder notas emitidas tarde da noite.
 */
export function obterIntervaloMesBrasil(mesAno: string): { startDate: string; endDate: string } {
  const [anoStr, mesStr] = mesAno.split('-')
  const ano = parseInt(anoStr, 10)
  const mes = parseInt(mesStr, 10)

  // Início: primeiro dia do mês às 00:00:00 no fuso de Brasília (-03:00)
  // Em ISO: YYYY-MM-01T00:00:00-03:00 -> vira YYYY-MM-01T03:00:00.000Z
  const inicioLocal = `${anoStr}-${mesStr.padStart(2, '0')}-01T00:00:00-03:00`
  const startDate = new Date(inicioLocal).toISOString()

  // Fim: último dia do mês às 23:59:59.999 no fuso de Brasília (-03:00)
  // Último dia do mês:
  const ultimoDia = new Date(ano, mes, 0).getDate()
  const fimLocal = `${anoStr}-${mesStr.padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}T23:59:59.999-03:00`
  const endDate = new Date(fimLocal).toISOString()

  return { startDate, endDate }
}
