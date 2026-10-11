// Utilitário para cálculo de dias úteis e feriados nacionais brasileiros

// Feriados Nacionais Fixos no Brasil (Mês é 0-indexado no JS: 0 = Janeiro, 11 = Dezembro)
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

// Cálculo do Domingo de Páscoa (Algoritmo de Meeus/Jones/Butcher)
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

// Retorna feriados móveis para determinado ano (Carnaval, Sexta-feira Santa, Corpus Christi)
function getMovableHolidays(year: number): Date[] {
  const pascoa = getEasterSunday(year)

  // Carnaval: 47 dias antes da Páscoa (Terça-feira de Carnaval)
  const carnaval = new Date(pascoa)
  carnaval.setDate(pascoa.getDate() - 47)

  // Sexta-feira Santa: 2 dias antes da Páscoa
  const sextaSanta = new Date(pascoa)
  sextaSanta.setDate(pascoa.getDate() - 2)

  // Corpus Christi: 60 dias após a Páscoa
  const corpusChristi = new Date(pascoa)
  corpusChristi.setDate(pascoa.getDate() + 60)

  return [carnaval, sextaSanta, corpusChristi]
}

export function isHoliday(date: Date): boolean {
  const mes = date.getMonth()
  const dia = date.getDate()
  const ano = date.getFullYear()

  // 1. Checa fixos
  if (FERIADOS_FIXOS.some(f => f.mes === mes && f.dia === dia)) {
    return true
  }

  // 2. Checa móveis
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

/**
 * Se a data cair em sábado, domingo ou feriado nacional,
 * avança sucessivamente até encontrar o próximo dia útil.
 */
export function getNextBusinessDay(date: Date): Date {
  const result = new Date(date)
  while (!isBusinessDay(result)) {
    result.setDate(result.getDate() + 1)
  }
  return result
}

/**
 * Calcula a data exata de bloqueio respeitando:
 * 1. Prorrogação do vencimento se cair em fim de semana ou feriado.
 * 2. Carência de 5 dias após o vencimento efetivo.
 * 3. Se a data final de bloqueio cair em fim de semana ou feriado, prorroga para o próximo dia útil.
 */
export function calculateEffectiveDates(dueDateString: string) {
  const rawDue = new Date(dueDateString)
  rawDue.setHours(0, 0, 0, 0)

  // 1. Vencimento Efetivo (se vence no sábado/domingo/feriado, prorroga)
  const effectiveDue = getNextBusinessDay(rawDue)

  // 2. Data de Bloqueio (5 dias após o vencimento efetivo)
  const rawBlock = new Date(effectiveDue)
  rawBlock.setDate(rawBlock.getDate() + 5)

  // 3. Bloqueio Efetivo (se o 5º dia cair em sábado/domingo/feriado, só bloqueia no próximo dia útil)
  const effectiveBlock = getNextBusinessDay(rawBlock)

  return {
    rawDueDate: rawDue,
    effectiveDueDate: effectiveDue,
    effectiveBlockDate: effectiveBlock
  }
}
