/**
 * Utilitários para Upload e Manipulação Segura de Arquivos no Supabase Storage / S3
 */

/**
 * Sanitiza o nome do arquivo para upload seguro no Supabase Storage.
 * Remove acentos, caracteres especiais, substitui espaços por underlines e garante uma chave 100% válida no S3.
 */
export function sanitizarNomeArquivoStorage(nomeOriginal: string, prefixo: string = ''): string {
  if (!nomeOriginal) return `${prefixo ? `${prefixo}_` : ''}${Date.now()}_arquivo.png`
  
  const ultimoPonto = nomeOriginal.lastIndexOf('.')
  const extensao = ultimoPonto !== -1 ? nomeOriginal.slice(ultimoPonto).toLowerCase().trim() : '.png'
  const nomeBase = ultimoPonto !== -1 ? nomeOriginal.slice(0, ultimoPonto) : nomeOriginal

  const nomeLimpo = nomeBase
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')   // apenas letras, números, hífen e underline
    .replace(/_+/g, '_')            // remove duplicidades de underlines
    .replace(/^_+|_+$/g, '')        // remove underlines das pontas
    .slice(0, 50)                   // limita tamanho

  const safeBase = nomeLimpo || 'logo'
  const safePrefixo = prefixo ? `${prefixo}_` : ''
  return `${safePrefixo}${Date.now()}_${safeBase}${extensao}`
}
