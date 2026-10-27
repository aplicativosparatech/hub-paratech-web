/**
 * Utilitários para Formatação e Parse de Valores Financeiros com Duas Casas Decimais (Padrão PT-BR)
 */

/**
 * Formata um valor numérico ou string para o formato monetário com duas casas decimais (ex: 480 -> "480,00", 85 -> "85,00").
 */
export function formatarDuasCasasDecimais(val: string | number | undefined | null): string {
  if (val === undefined || val === null || String(val).trim() === '') return ''
  const str = String(val).trim()
  const num = parseFloat(str.replace(/\./g, '').replace(',', '.'))
  if (isNaN(num)) return ''
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * Converte uma string formatada (ex: "480,00" ou "1.250,50") para número float nativo (ex: 480 ou 1250.5).
 */
export function parseValorDecimal(val: string | number | undefined | null): number {
  if (val === undefined || val === null || String(val).trim() === '') return 0
  const str = String(val).trim()
  const num = parseFloat(str.replace(/\./g, '').replace(',', '.'))
  return isNaN(num) ? 0 : num
}
