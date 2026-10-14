/**
 * Módulo de Tratamento, Validação e Formatação para CNPJ Alfanumérico e Tradicional
 * em conformidade com a Instrução Normativa RFB nº 2.229/2024 e Notas Técnicas SEFAZ/ENCAT.
 * 
 * Estrutura do CNPJ Alfanumérico (14 caracteres):
 * - Posições 1 a 8: Raiz do CNPJ (letras maiúsculas e números [0-9A-Z])
 * - Posições 9 a 12: Ordem do Estabelecimento/Filial [0-9A-Z]
 * - Posições 13 e 14: Dígitos Verificadores (estritamente numéricos [0-9])
 * 
 * Regra do DV (Módulo 11 da Receita Federal):
 * - Caracteres convertidos para valor numérico pela tabela ASCII: valor = charCode - 48
 *   Ex: '0'..'9' = 0..9, 'A' = 17, 'B' = 18, ..., 'Z' = 42.
 */

/**
 * Remove qualquer caractere que não seja letra (A-Z) ou número (0-9).
 * Preserva as letras do novo CNPJ Alfanumérico.
 */
export function limparDocumento(doc?: string | null): string {
  if (!doc) return ''
  return doc.toString().replace(/[^A-Za-z0-9]/g, '').toUpperCase()
}

/**
 * Remove caracteres especiais da Chave de Acesso da NF-e / NFC-e (44 caracteres),
 * preservando as letras do CNPJ emitente que agora podem compor a chave (posições 7 a 20).
 */
export function limparChaveAcesso(chave?: string | null): string {
  if (!chave) return ''
  return chave.toString().replace(/[^A-Za-z0-9]/g, '').toUpperCase()
}

/**
 * Identifica se um documento é um CNPJ Alfanumérico (contém ao menos uma letra nas 12 primeiras posições).
 */
export function isCnpjAlfanumerico(doc?: string | null): boolean {
  const clean = limparDocumento(doc)
  if (clean.length !== 14) return false
  const raizEOrdem = clean.substring(0, 12)
  return /[A-Z]/.test(raizEOrdem)
}

/**
 * Aplica máscara visual oficial da Receita Federal:
 * - CNPJ (Tradicional ou Alfanumérico): XX.XXX.XXX/XXXX-XX
 * - CPF: XXX.XXX.XXX-XX
 */
export function formatarCnpjCpf(doc?: string | null): string {
  if (!doc) return ''
  const clean = limparDocumento(doc)

  if (clean.length === 14) {
    return clean.replace(
      /^([A-Z0-9]{2})([A-Z0-9]{3})([A-Z0-9]{3})([A-Z0-9]{4})(\d{2})$/,
      '$1.$2.$3/$4-$5'
    )
  }

  if (clean.length === 11 && /^\d+$/.test(clean)) {
    return clean.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
  }

  return doc
}

/**
 * Calcula os Dígitos Verificadores do CNPJ (Tradicional e Alfanumérico)
 * utilizando o algoritmo oficial Módulo 11 da Receita Federal do Brasil.
 */
export function calcularDvCnpj(clean12: string): string {
  if (clean12.length !== 12) return ''

  // Valores ASCII - 48
  const valores = clean12.split('').map(c => c.charCodeAt(0) - 48)

  // 1º Dígito Verificador (pesos: 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2)
  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const soma1 = valores.reduce((acc, v, i) => acc + v * pesos1[i], 0)
  const resto1 = soma1 % 11
  const dv1 = resto1 < 2 ? 0 : 11 - resto1

  // 2º Dígito Verificador (pesos: 6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2)
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const valoresComDv1 = [...valores, dv1]
  const soma2 = valoresComDv1.reduce((acc, v, i) => acc + v * pesos2[i], 0)
  const resto2 = soma2 % 11
  const dv2 = resto2 < 2 ? 0 : 11 - resto2

  return `${dv1}${dv2}`
}

/**
 * Validação matemática oficial de CNPJ (Suporta tanto o formato numérico antigo quanto o novo alfanumérico).
 */
export function validarCnpj(doc?: string | null): boolean {
  const clean = limparDocumento(doc)
  if (clean.length !== 14) return false

  // As 12 primeiras posições aceitam [0-9A-Z], os 2 últimos DEVEM ser numéricos
  if (!/^[A-Z0-9]{12}\d{2}$/.test(clean)) return false

  // Rejeita sequências repetidas triviais apenas para numéricos (ex: 00000000000000)
  if (/^(\d)\1{13}$/.test(clean)) return false

  const base = clean.substring(0, 12)
  const dvEsperado = clean.substring(12, 14)
  const dvCalculado = calcularDvCnpj(base)

  return dvEsperado === dvCalculado
}

/**
 * Validação padrão de CPF (Pessoa Física / Produtor Rural).
 */
export function validarCpf(doc?: string | null): boolean {
  const clean = limparDocumento(doc)
  if (clean.length !== 11 || !/^\d{11}$/.test(clean)) return false

  // Rejeita números repetidos (11111111111, etc.)
  if (/^(\d)\1{10}$/.test(clean)) return false

  let soma = 0
  for (let i = 0; i < 9; i++) soma += parseInt(clean.charAt(i), 10) * (10 - i)
  let resto = (soma * 10) % 11
  if (resto === 10 || resto === 11) resto = 0
  if (resto !== parseInt(clean.charAt(9), 10)) return false

  soma = 0
  for (let i = 0; i < 10; i++) soma += parseInt(clean.charAt(i), 10) * (11 - i)
  resto = (soma * 10) % 11
  if (resto === 10 || resto === 11) resto = 0
  if (resto !== parseInt(clean.charAt(10), 10)) return false

  return true
}

/**
 * Valida se um documento é um CNPJ válido (tradicional ou alfanumérico) ou um CPF válido.
 */
export function validarDocumentoFiscal(doc?: string | null): {
  valido: boolean
  tipo: 'CNPJ_TRADICIONAL' | 'CNPJ_ALFANUMERICO' | 'CPF' | 'INVALIDO'
} {
  const clean = limparDocumento(doc)

  if (clean.length === 14) {
    const ok = validarCnpj(clean)
    if (ok) {
      return {
        valido: true,
        tipo: isCnpjAlfanumerico(clean) ? 'CNPJ_ALFANUMERICO' : 'CNPJ_TRADICIONAL'
      }
    }
  } else if (clean.length === 11) {
    const ok = validarCpf(clean)
    if (ok) {
      return { valido: true, tipo: 'CPF' }
    }
  }

  return { valido: false, tipo: 'INVALIDO' }
}

/**
 * Valida a Chave de Acesso de NF-e (Mod 55) ou NFC-e (Mod 65) com 44 caracteres,
 * respeitando as posições alfanuméricas do CNPJ do emitente (posições 7 a 20).
 */
export function validarChaveAcessoNfe(chave?: string | null): boolean {
  const clean = limparChaveAcesso(chave)
  if (clean.length !== 44) return false

  // Formato: 6 números (UF + AAMM) + 14 caracteres alfanuméricos (CNPJ emitente) + 24 números restantes
  return /^[0-9]{6}[A-Z0-9]{14}[0-9]{24}$/.test(clean)
}

/**
 * Compara dois documentos fiscais de forma insensível a maiúsculas/minúsculas e pontuações,
 * garantindo compatibilidade total com caracteres alfanuméricos.
 */
export function compararDocumentos(doc1?: string | null, doc2?: string | null): boolean {
  const c1 = limparDocumento(doc1)
  const c2 = limparDocumento(doc2)
  if (!c1 || !c2) return false
  return c1 === c2
}
