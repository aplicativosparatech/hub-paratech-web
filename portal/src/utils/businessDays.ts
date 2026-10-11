// Utilitário para cálculo de dias úteis e feriados nacionais brasileiros

const FERIADOS_FIXOS: { mes: number; dia: number; nome: string }[] = [
  { mes: 0, dia: 1, nome: 'Ano Novo' },
  { mes: 3, dia: 21, nome: 'Tiradentes' },
  { mes: 4, dia: 1, nome: 'Dia do Trabalhador' },
  { mes: 8, dia: 7, nome: 'Independência do Brasil' },
  { mes: 9, dia: 12, nome: 'Nossa Senhora Aparecida' },
  { mes: 10, dia: 2, nome: 'Finados' },
  { mes: 10, dia: 15, nome: 'Proclamação da República' },
  { mes: 10, dia: 20, nome: 'Dia da Consciência Negra' },
  { mes: 11, dia: 25, nome: 'Natal' },
]

function getEasterSunday(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month, day)
}

function getMovableHolidays(year: number): Date[] {
  const pascoa = getEasterSunday(year)
  const carnaval = new Date(pascoa)
  carnaval.setDate(pascoa.getDate() - 47)

  const sextaSanta = new Date(pascoa)
  sextaSanta.setDate(pascoa.getDate() - 2)

  const corpusChristi = new Date(pascoa)
  corpusChristi.setDate(pascoa.getDate() + 60)

  return [carnaval, sextaSanta, corpusChristi]
}

export function isHoliday(date: Date): boolean {
  const mes = date.getMonth()
  const dia = date.getDate()
  const ano = date.getFullYear()

  if (FERIADOS_FIXOS.some(f => f.mes === mes && f.dia === dia)) {
    return true
  }

  const moveis = getMovableHolidays(ano)
  return moveis.some(f => f.getMonth() === mes && f.getDate() === dia)
}

export function isWeekend(date: Date): boolean {
  const day = date.getDay()
  return day === 0 || day === 6 // 0 = Domingo, 6 = Sábado
}

export function isBusinessDay(date: Date): boolean {
  return !isWeekend(date) && !isHoliday(date)
}

export function getNextBusinessDay(date: Date): Date {
  const result = new Date(date)
  while (!isBusinessDay(result)) {
    result.setDate(result.getDate() + 1)
  }
  return result
}

/**
 * Calcula as datas de cobrança e bloqueio respeitando a regra:
 * - A DATA DO VENCIMENTO NÃO MUDA (permanece a data original gravada na fatura).
 * - O BLOQUEIO NUNCA ACONTECE EM FIM DE SEMANA OU FERIADO (prorroga para o próximo dia útil).
 * - Suporta escolha entre contagem nominal (+5 dias da data de vencimento) ou contagem real (até o dia útil do bloqueio).
 */
export function calculateEffectiveDates(dueDateString: string, modoContagem: 'bloqueio_real' | 'bloqueio_nominal' = 'bloqueio_real') {
  // 1. Data original do Vencimento (NUNCA MUDA)
  const rawDue = new Date(dueDateString)
  rawDue.setHours(0, 0, 0, 0)

  // 2. Data Nominal de Bloqueio (5 dias corridos após o vencimento)
  const nominalBlock = new Date(rawDue)
  nominalBlock.setDate(nominalBlock.getDate() + 5)

  // 3. Data Real de Bloqueio (se cair em sábado, domingo ou feriado, só bloqueia no próximo dia útil)
  const effectiveBlock = getNextBusinessDay(nominalBlock)

  // A data usada para a contagem regressiva nas mensagens
  const targetCountdownDate = modoContagem === 'bloqueio_real' ? effectiveBlock : nominalBlock

  return {
    rawDueDate: rawDue,
    nominalBlockDate: nominalBlock,
    effectiveBlockDate: effectiveBlock,
    targetCountdownDate: targetCountdownDate
  }
}
