/**
 * Utilitários para Formatação e Parse de Valores Financeiros com Duas Casas Decimais (Padrão PT-BR)
 */

/**
 * Formata um valor numérico ou string para o formato monetário com duas casas decimais (ex: 269.5 -> "269,50", 480 -> "480,00").
 */
export function formatarDuasCasasDecimais(val: string | number | undefined | null): string {
  if (val === undefined || val === null || String(val).trim() === '') return ''
  if (typeof val === 'number') {
    return isNaN(val) ? '' : val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }
  const str = String(val).trim()
  let num: number
  if (str.includes(',')) {
    // Formato brasileiro: 1.250,50 ou 269,50
    num = parseFloat(str.replace(/\./g, '').replace(',', '.'))
  } else {
    // Formato padrão / float: 269.50 ou 269
    num = parseFloat(str)
  }
  return isNaN(num) ? '' : num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * Converte uma string formatada (ex: "480,00", "269,50" ou "1.250,50") para número float nativo (ex: 480, 269.5 ou 1250.5).
 */
export function parseValorDecimal(val: string | number | undefined | null): number {
  if (val === undefined || val === null || String(val).trim() === '') return 0
  if (typeof val === 'number') return isNaN(val) ? 0 : val
  const str = String(val).trim()
  let num: number
  if (str.includes(',')) {
    num = parseFloat(str.replace(/\./g, '').replace(',', '.'))
  } else {
    num = parseFloat(str)
  }
  return isNaN(num) ? 0 : num
}
