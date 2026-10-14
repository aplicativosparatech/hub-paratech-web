import forge from 'node-forge'
import { limparDocumento, formatarCnpjCpf } from './cnpjAlfanumerico'

export interface CertificadoDados {
  titular: string
  documento: string
  commonName: string
  dataValidade: string // Formato YYYY-MM-DD para input date
  dataValidadeFormatada: string // Formato DD/MM/AAAA para exibição
  dataEmissao: string
  diasRestantes: number
  isVencido: boolean
}

/**
 * Lê e decodifica um certificado digital A1 (.pfx / .p12),
 * extraindo o titular, CNPJ/CPF e a data de vencimento.
 */
export function parsePfxBuffer(buffer: Buffer, senha: string): CertificadoDados {
  const p12Der = forge.util.createBuffer(buffer.toString('binary'))
  const p12Asn1 = forge.asn1.fromDer(p12Der)
  
  let p12: any
  try {
    p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, senha)
  } catch (err: any) {
    throw new Error('Senha do certificado incorreta ou arquivo .pfx corrompido.')
  }

  // Obter bags de certificados
  const bags = p12.getBags({ bagType: forge.pki.oids.certBag })
  const certBags = bags[forge.pki.oids.certBag] || []
  if (!certBags || certBags.length === 0) {
    throw new Error('Nenhum certificado encontrado dentro do arquivo .pfx')
  }

  // Procurar o certificado folha (não CA)
  let leafCert: any = null
  for (const bag of certBags) {
    if (bag.cert) {
      const bc = bag.cert.getExtension('basicConstraints') as any
      if (!bc || !bc.cA) {
        leafCert = bag.cert
        break
      }
      if (!leafCert) leafCert = bag.cert
    }
  }

  if (!leafCert && certBags[0]) {
    leafCert = certBags[0].cert
  }

  if (!leafCert) {
    throw new Error('Não foi possível ler as propriedades do certificado.')
  }

  // Extrair atributos do Subject
  const subjectAttributes = leafCert.subject?.attributes || []
  const cnAttr = subjectAttributes.find((a: any) => a.name === 'commonName' || a.shortName === 'CN')
  const commonName: string = cnAttr ? String(cnAttr.value) : ''

  let titular = commonName
  let documento = ''

  // Padrão ICP-Brasil: "NOME DO TITULAR OU EMPRESA:00000000000190"
  if (commonName.includes(':')) {
    const parts = commonName.split(':')
    titular = parts[0].trim()
    const rawDoc = limparDocumento(parts[parts.length - 1].trim())
    documento = formatarCnpjCpf(rawDoc) || rawDoc
  }

  // Validade
  const notAfter: Date = leafCert.validity?.notAfter || new Date()
  const notBefore: Date = leafCert.validity?.notBefore || new Date()

  const ano = notAfter.getFullYear()
  const mes = String(notAfter.getMonth() + 1).padStart(2, '0')
  const dia = String(notAfter.getDate()).padStart(2, '0')
  const dataValidade = `${ano}-${mes}-${dia}`
  const dataValidadeFormatada = `${dia}/${mes}/${ano}`

  const hoje = new Date()
  const diffTime = notAfter.getTime() - hoje.getTime()
  const diasRestantes = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  return {
    titular,
    documento,
    commonName,
    dataValidade,
    dataValidadeFormatada,
    dataEmissao: notBefore.toISOString(),
    diasRestantes,
    isVencido: diasRestantes < 0
  }
}
