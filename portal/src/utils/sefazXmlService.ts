import crypto from 'crypto'
import forge from 'node-forge'
import https from 'https'
import { SignedXml } from 'xml-crypto'

export interface SefazConsultaResult {
  success: boolean
  cStat: string
  xMotivo: string
  nProt?: string
  dhRecbto?: string
  digVal?: string
  verAplic?: string
  protXml?: string
  rawXml?: string
  error?: string
}

export interface ProtocoloManualDados {
  nProt: string
  dhRecbto: string
  digVal?: string
  verAplic?: string
  cStat?: string
  xMotivo?: string
}

/**
 * Mapeamento das URLs de Consulta de Protocolo (NFeConsultaProtocolo4) da SEFAZ por UF e Modelo
 */
export function getSefazWsUrl(cUF: string, mod: string, tpAmb: string = '1'): string {
  const isHomologacao = tpAmb === '2'

  // Minas Gerais (31)
  if (cUF === '31') {
    if (mod === '65') {
      return isHomologacao 
        ? 'https://hnfce.fazenda.mg.gov.br/nfce/services/NFeConsultaProtocolo4'
        : 'https://nfce.fazenda.mg.gov.br/nfce/services/NFeConsultaProtocolo4'
    } else {
      return isHomologacao
        ? 'https://hnfe.fazenda.mg.gov.br/nfe2/services/NFeConsultaProtocolo4'
        : 'https://nfe.fazenda.mg.gov.br/nfe2/services/NFeConsultaProtocolo4'
    }
  }

  // São Paulo (35)
  if (cUF === '35') {
    if (mod === '65') {
      return isHomologacao
        ? 'https://homologacao.nfce.fazenda.sp.gov.br/ws/NFeConsultaProtocolo4.asmx'
        : 'https://nfce.fazenda.sp.gov.br/ws/NFeConsultaProtocolo4.asmx'
    } else {
      return isHomologacao
        ? 'https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeconsultaprotocolo4.asmx'
        : 'https://nfe.fazenda.sp.gov.br/ws/nfeconsultaprotocolo4.asmx'
    }
  }

  // Pará (15)
  if (cUF === '15') {
    if (mod === '65') {
      return isHomologacao
        ? 'https://homnfce.sefa.pa.gov.br/ws/NFeConsultaProtocolo4'
        : 'https://nfce.sefa.pa.gov.br/ws/NFeConsultaProtocolo4'
    }
  }

  // Paraná (41)
  if (cUF === '41') {
    return isHomologacao
      ? 'https://homologacao.sefa.pr.gov.br/nfe/NFeConsultaProtocolo4'
      : 'https://nfe.sefa.pr.gov.br/nfe/NFeConsultaProtocolo4'
  }

  // SVRS (Padrão para a maioria dos estados: AC, AL, AP, CE, DF, ES, MA, PA (mod 55), PB, PI, RJ, RN, RO, RR, RS, SC, SE, TO)
  if (mod === '65') {
    return isHomologacao
      ? 'https://nfce-homologacao.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx'
      : 'https://nfce.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx'
  }

  return isHomologacao
    ? 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx'
    : 'https://nfe.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx'
}

/**
 * Extrai a chave privada PEM e o certificado público DER em Base64 a partir do Buffer .pfx
 */
export function parsePfxKeys(pfxBuffer: Buffer, passphrase: string): { privateKeyPem: string; certBase64: string } {
  const p12Der = forge.util.createBuffer(pfxBuffer.toString('binary'))
  const p12Asn1 = forge.asn1.fromDer(p12Der)
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, passphrase)

  // Certificado
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || []
  let cert: any = null
  for (const b of certBags) {
    if (b.cert) {
      const bc = b.cert.getExtension('basicConstraints') as any
      if (!bc || !bc.cA) { cert = b.cert; break }
      if (!cert) cert = b.cert
    }
  }
  if (!cert && certBags[0]) cert = certBags[0].cert
  if (!cert) throw new Error('Certificado X509 não encontrado dentro do arquivo .pfx')

  // Chave Privada
  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] ||
                  p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] || []
  const keyObj = keyBags[0]?.key
  if (!keyObj) throw new Error('Chave privada não encontrada no arquivo .pfx')

  const privateKeyPem = forge.pki.privateKeyToPem(keyObj)
  const certAsn1 = forge.pki.certificateToAsn1(cert)
  const certDer = forge.asn1.toDer(certAsn1).getBytes()
  const certBase64 = Buffer.from(certDer, 'binary').toString('base64')

  return { privateKeyPem, certBase64 }
}

/**
 * Assina digitalmente o XML da NF-e / NFC-e segundo os padrões oficiais W3C XML-DSig / ICP-Brasil da SEFAZ
 */
export function signNFeXml(xmlString: string, pfxBuffer: Buffer, passphrase: string): { signedXml: string; digestValue: string } {
  // Se já tiver assinatura, remove para reassinar com integridade
  let cleanXml = xmlString.replace(/<Signature[\s\S]*?<\/Signature>/g, '')

  const { privateKeyPem, certBase64 } = parsePfxKeys(pfxBuffer, passphrase)

  const infNFeMatch = cleanXml.match(/<infNFe[^>]*>([\s\S]*?)<\/infNFe>/)
  if (!infNFeMatch) throw new Error('Tag <infNFe> não encontrada no XML')

  const fullInfNFe = infNFeMatch[0]
  const idMatch = fullInfNFe.match(/Id=["']([^"']+)["']/)
  const infNFeId = idMatch ? idMatch[1] : ''

  const sig = new SignedXml({
    privateKey: privateKeyPem,
    signatureAlgorithm: 'http://www.w3.org/2000/09/xmldsig#rsa-sha1',
    canonicalizationAlgorithm: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
    getKeyInfoContent: () => `<X509Data><X509Certificate>${certBase64}</X509Certificate></X509Data>`
  })

  sig.addReference({
    xpath: `//*[@Id='${infNFeId}']`,
    transforms: [
      'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
      'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'
    ],
    digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1'
  })

  sig.computeSignature(cleanXml)
  const signedXml = sig.getSignedXml()
  const digestMatch = signedXml.match(/<DigestValue>([\s\S]*?)<\/DigestValue>/)
  const digestValue = digestMatch ? digestMatch[1].trim() : ''

  return { signedXml, digestValue }
}

/**
 * Consulta a situação da NF-e / NFC-e diretamente no WebService oficial da SEFAZ usando o certificado digital A1
 */
export async function consultarSefazProtocolo(
  chave: string,
  pfxBuffer: Buffer,
  passphrase: string,
  tpAmb: string = '1'
): Promise<SefazConsultaResult> {
  const cUF = chave.substring(0, 2)
  const mod = chave.substring(20, 22)
  const wsUrl = getSefazWsUrl(cUF, mod, tpAmb)

  const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body><nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsultaProtocolo4"><consSitNFe versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe"><tpAmb>${tpAmb}</tpAmb><xServ>CONSULTAR</xServ><chNFe>${chave}</chNFe></consSitNFe></nfeDadosMsg></soap12:Body></soap12:Envelope>`

  const agent = new https.Agent({
    pfx: pfxBuffer,
    passphrase,
    rejectUnauthorized: false
  })

  try {
    const urlObj = new URL(wsUrl)
    const options: https.RequestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + (urlObj.search || ''),
      method: 'POST',
      agent,
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8',
        'Content-Length': Buffer.byteLength(soapEnvelope, 'utf8')
      },
      timeout: 15000
    }

    const responseXml = await new Promise<string>((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = ''
        res.on('data', chunk => { data += chunk })
        res.on('end', () => resolve(data))
      })

      req.on('error', err => reject(err))
      req.on('timeout', () => {
        req.destroy()
        reject(new Error('Timeout de comunicação com o WebService da SEFAZ (15s).'))
      })

      req.write(soapEnvelope)
      req.end()
    })

    const extractTag = (xml: string, tag: string) => {
      const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`))
      return match ? match[1].trim() : ''
    }

    const cStat = extractTag(responseXml, 'cStat')
    const xMotivo = extractTag(responseXml, 'xMotivo')
    const nProt = extractTag(responseXml, 'nProt')
    const dhRecbto = extractTag(responseXml, 'dhRecbto')
    const digVal = extractTag(responseXml, 'digVal')
    const verAplic = extractTag(responseXml, 'verAplic')

    const protMatch = responseXml.match(/<protNFe[^>]*>([\s\S]*?)<\/protNFe>/)
    const protXml = protMatch ? protMatch[0] : ''

    const isAutorizada = cStat === '100'

    return {
      success: isAutorizada,
      cStat: cStat || 'DESCONHECIDO',
      xMotivo: xMotivo || 'Resposta sem motivo',
      nProt: nProt || undefined,
      dhRecbto: dhRecbto || undefined,
      digVal: digVal || undefined,
      verAplic: verAplic || undefined,
      protXml: protXml || undefined,
      rawXml: responseXml
    }

  } catch (error: any) {
    return {
      success: false,
      cStat: 'ERRO_COMUNICACAO',
      xMotivo: error.message || 'Falha de conexão com a SEFAZ',
      error: error.message
    }
  }
}

/**
 * Monta o arquivo final oficial <nfeProc versao="4.00"> com a NFe assinada e o protocolo retornado pela SEFAZ
 */
export function gerarProcNFeFinal(
  xmlOriginal: string,
  pfxBuffer: Buffer | null,
  passphrase: string,
  dadosProtocolo: ProtocoloManualDados,
  chaveAcesso: string
): string {
  let xmlBase = xmlOriginal

  // 1. Garante que o XML está assinado
  if (!xmlBase.includes('<Signature')) {
    if (!pfxBuffer) {
      throw new Error('Certificado digital não fornecido para assinar o arquivo.')
    }
    const { signedXml, digestValue } = signNFeXml(xmlBase, pfxBuffer, passphrase)
    xmlBase = signedXml
    if (!dadosProtocolo.digVal) {
      dadosProtocolo.digVal = digestValue
    }
  }

  // 2. Extrai o bloco puro <NFe>...</NFe>
  const nfeMatch = xmlBase.match(/<NFe[^>]*>([\s\S]*?)<\/NFe>/)
  const nfeContent = nfeMatch ? nfeMatch[0] : xmlBase

  // 3. Monta o bloco <protNFe>
  const protNFe = `<protNFe versao="4.00"><infProt><tpAmb>1</tpAmb><verAplic>${dadosProtocolo.verAplic || 'W-1.5.11'}</verAplic><chNFe>${chaveAcesso}</chNFe><dhRecbto>${dadosProtocolo.dhRecbto}</dhRecbto><nProt>${dadosProtocolo.nProt}</nProt><digVal>${dadosProtocolo.digVal || ''}</digVal><cStat>${dadosProtocolo.cStat || '100'}</cStat><xMotivo>${dadosProtocolo.xMotivo || 'Autorizado o uso da NF-e'}</xMotivo></infProt></protNFe>`

  // 4. Envelopa tudo em <nfeProc>
  return `<?xml version="1.0" encoding="UTF-8"?><nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">${nfeContent}${protNFe}</nfeProc>`
}
