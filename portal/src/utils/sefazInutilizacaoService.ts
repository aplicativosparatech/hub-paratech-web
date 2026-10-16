import crypto from 'crypto'
import https from 'https'
import { SignedXml } from 'xml-crypto'
import { parsePfxKeys } from './sefazXmlService'

export interface SefazInutilizacaoResult {
  success: boolean
  cStat: string
  xMotivo: string
  nProt?: string
  dhRecbto?: string
  xmlPedido?: string
  xmlRetorno?: string
  isHomologada: boolean
  isJaInutilizado: boolean
  isUtilizadaNaSefaz: boolean // Código 206, 256 ou 241 (A nota já existe na SEFAZ!)
  error?: string
}

export const UF_TO_IBGE: Record<string, string> = {
  RO: '11', AC: '12', AM: '13', RR: '14', PA: '15', AP: '16', TO: '17',
  MA: '21', PI: '22', CE: '23', RN: '24', PB: '25', PE: '26', AL: '27', SE: '28', BA: '29',
  MG: '31', ES: '32', RJ: '33', SP: '35',
  PR: '41', SC: '42', RS: '43',
  MS: '50', MT: '51', GO: '52', DF: '53'
}

export function normalizarCUF(ufOuCodigo: string): string {
  if (!ufOuCodigo) return '31' // Padrão MG
  const limpo = ufOuCodigo.trim().toUpperCase()
  if (/^\d{2}$/.test(limpo)) return limpo
  return UF_TO_IBGE[limpo] || '31'
}

/**
 * URLs do WebService de Inutilização (NFeInutilizacao4) por UF e Modelo
 */
export function getSefazInutilizacaoWsUrl(cUF: string, mod: string, tpAmb: string = '1'): string {
  const isHomologacao = tpAmb === '2'

  // Minas Gerais (31)
  if (cUF === '31') {
    if (mod === '65') {
      return isHomologacao
        ? 'https://hnfce.fazenda.mg.gov.br/nfce/services/NFeInutilizacao4'
        : 'https://nfce.fazenda.mg.gov.br/nfce/services/NFeInutilizacao4'
    } else {
      return isHomologacao
        ? 'https://hnfe.fazenda.mg.gov.br/nfe2/services/NFeInutilizacao4'
        : 'https://nfe.fazenda.mg.gov.br/nfe2/services/NFeInutilizacao4'
    }
  }

  // São Paulo (35)
  if (cUF === '35') {
    if (mod === '65') {
      return isHomologacao
        ? 'https://homologacao.nfce.fazenda.sp.gov.br/ws/NFeInutilizacao4.asmx'
        : 'https://nfce.fazenda.sp.gov.br/ws/NFeInutilizacao4.asmx'
    } else {
      return isHomologacao
        ? 'https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeinutilizacao4.asmx'
        : 'https://nfe.fazenda.sp.gov.br/ws/nfeinutilizacao4.asmx'
    }
  }

  // Paraná (41)
  if (cUF === '41') {
    return isHomologacao
      ? 'https://homologacao.sefa.pr.gov.br/nfe/NFeInutilizacao4'
      : 'https://nfe.sefa.pr.gov.br/nfe/NFeInutilizacao4'
  }

  // SVRS (Padrão para a maioria dos estados: AC, AL, AP, CE, DF, ES, MA, PA, PB, PI, RJ, RN, RO, RR, RS, SC, SE, TO)
  if (mod === '65') {
    return isHomologacao
      ? 'https://nfce-homologacao.svrs.rs.gov.br/ws/nfeinutilizacao/nfeinutilizacao4.asmx'
      : 'https://nfce.svrs.rs.gov.br/ws/nfeinutilizacao/nfeinutilizacao4.asmx'
  }

  return isHomologacao
    ? 'https://nfe-homologacao.svrs.rs.gov.br/ws/nfeinutilizacao/nfeinutilizacao4.asmx'
    : 'https://nfe.svrs.rs.gov.br/ws/nfeinutilizacao/nfeinutilizacao4.asmx'
}

/**
 * Constrói e assina o XML de Inutilização (<inutNFe>) segundo o padrão oficial SEFAZ
 */
export function buildAndSignInutNFeXml(params: {
  cUF: string
  ano: string // 2 dígitos (ex: '26')
  cnpj: string // 14 dígitos
  mod: string // '55' ou '65'
  serie: string | number
  nNFIni: number
  nNFFin: number
  xJust: string
  pfxBuffer: Buffer
  passphrase: string
  tpAmb?: string
}): { signedXml: string; infInutId: string } {
  const tpAmb = params.tpAmb || '1'
  const cUF = normalizarCUF(params.cUF)
  const ano = params.ano.replace(/\D/g, '').slice(-2)
  const cnpj = params.cnpj.replace(/\D/g, '').padStart(14, '0')
  const mod = params.mod
  const serieNum = parseInt(String(params.serie), 10) || 1
  const serieStr = String(serieNum).padStart(3, '0')
  const nIniStr = String(params.nNFIni).padStart(9, '0')
  const nFinStr = String(params.nNFFin).padStart(9, '0')

  // Justificativa mínima de 15 caracteres exigida pela SEFAZ
  let xJust = params.xJust.trim()
  if (xJust.length < 15) {
    xJust = (xJust + ' - Quebra de sequencia numerica').trim()
  }
  if (xJust.length < 15) {
    xJust = 'Quebra de sequencia numerica do sistema emissor'
  }
  if (xJust.length > 255) {
    xJust = xJust.substring(0, 255)
  }

  // Id oficial SEFAZ: ID + cUF(2) + ano(2) + CNPJ(14) + mod(2) + serie(3) + nNFIni(9) + nNFFin(9) = 43 caracteres
  const infInutId = `ID${cUF}${ano}${cnpj}${mod}${serieStr}${nIniStr}${nFinStr}`

  const rawXml = `<inutNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><infInut Id="${infInutId}"><tpAmb>${tpAmb}</tpAmb><xServ>INUTILIZAR</xServ><cUF>${cUF}</cUF><ano>${ano}</ano><CNPJ>${cnpj}</CNPJ><mod>${mod}</mod><serie>${serieNum}</serie><nNFIni>${params.nNFIni}</nNFIni><nNFFin>${params.nNFFin}</nNFFin><xJust>${xJust}</xJust></infInut></inutNFe>`

  // Assinatura Digital W3C XML-DSig usando Canonicalização C14N estrita
  const { privateKeyPem, certBase64 } = parsePfxKeys(params.pfxBuffer, params.passphrase)

  const sig = new SignedXml({
    privateKey: privateKeyPem,
    signatureAlgorithm: 'http://www.w3.org/2000/09/xmldsig#rsa-sha1',
    canonicalizationAlgorithm: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
    getKeyInfoContent: () => `<X509Data><X509Certificate>${certBase64}</X509Certificate></X509Data>`
  })

  sig.addReference({
    xpath: `//*[@Id='${infInutId}']`,
    transforms: [
      'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
      'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'
    ],
    digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1'
  })

  sig.computeSignature(rawXml)
  const signedXml = sig.getSignedXml()

  return { signedXml, infInutId }
}

/**
 * Envia o pedido de Inutilização diretamente para o WebService oficial da SEFAZ
 */
export async function executarInutilizacaoSefaz(params: {
  cUF: string
  ano: string
  cnpj: string
  mod: string
  serie: string | number
  nNFIni: number
  nNFFin: number
  xJust: string
  pfxBuffer: Buffer
  passphrase: string
  tpAmb?: string
}): Promise<SefazInutilizacaoResult> {
  const tpAmb = params.tpAmb || '1'
  const cUF = normalizarCUF(params.cUF)
  const mod = params.mod
  const wsUrl = getSefazInutilizacaoWsUrl(cUF, mod, tpAmb)

  let signedXml = ''
  try {
    const resBuild = buildAndSignInutNFeXml(params)
    signedXml = resBuild.signedXml
  } catch (err: any) {
    return {
      success: false,
      cStat: 'ERRO_ASSINATURA',
      xMotivo: 'Falha ao assinar XML de Inutilização: ' + (err.message || ''),
      isHomologada: false,
      isJaInutilizado: false,
      isUtilizadaNaSefaz: false,
      error: err.message
    }
  }

  const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body><nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeInutilizacao4">${signedXml}</nfeDadosMsg></soap12:Body></soap12:Envelope>`

  const agent = new https.Agent({
    pfx: params.pfxBuffer,
    passphrase: params.passphrase,
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
      timeout: 18000
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
        reject(new Error('Tempo limite esgotado com a SEFAZ (18s).'))
      })

      req.write(soapEnvelope)
      req.end()
    })

    const extractTag = (xml: string, tag: string) => {
      const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`))
      return match ? match[1].trim() : ''
    }

    const cStat = extractTag(responseXml, 'cStat')
    let xMotivo = extractTag(responseXml, 'xMotivo')
    let nProt = extractTag(responseXml, 'nProt')
    const dhRecbto = extractTag(responseXml, 'dhRecbto')

    // Se o protocolo estiver embutido no texto da SEFAZ (ex: código 563 com "nProt: 131262498609951")
    if (!nProt && xMotivo) {
      const matchProt = xMotivo.match(/nProt:\s*(\d+)/i)
      if (matchProt) {
        nProt = matchProt[1]
      }
    }

    // Análise de códigos de retorno da SEFAZ
    const isHomologada = cStat === '102' // 102: Inutilização de número homologado
    // 204 ou 563: Já existe pedido de Inutilização homologado na SEFAZ para esta faixa!
    const isJaInutilizado = cStat === '204' || cStat === '563'
    // 206: Número de NF-e já está utilizado em venda
    // 256: Uma numeração de NF-e a ser inutilizada já está na Base de Dados da SEFAZ
    // 241: Um número da faixa já foi utilizado
    const isUtilizadaNaSefaz = ['206', '256', '241'].includes(cStat)

    // Formata mensagem elegante e amigável para o usuário
    let motivoLimpo = xMotivo || 'Sem retorno de motivo da SEFAZ'
    if (isJaInutilizado) {
      motivoLimpo = `Confirmado pela SEFAZ: Numeração já se encontra homologada e inutilizada${nProt ? ` (Protocolo: ${nProt})` : ''}`
    } else if (isHomologada) {
      motivoLimpo = `Inutilização homologada com sucesso pela SEFAZ${nProt ? ` (Protocolo: ${nProt})` : ''}`
    } else if (motivoLimpo.startsWith('Rejeição:')) {
      motivoLimpo = motivoLimpo.replace(/^Rejeição:\s*/i, '').trim()
    }

    const success = isHomologada || isJaInutilizado

    return {
      success,
      cStat: cStat || 'DESCONHECIDO',
      xMotivo: motivoLimpo,
      nProt: nProt || undefined,
      dhRecbto: dhRecbto || undefined,
      xmlPedido: signedXml,
      xmlRetorno: responseXml,
      isHomologada,
      isJaInutilizado,
      isUtilizadaNaSefaz
    }

  } catch (error: any) {
    return {
      success: false,
      cStat: 'ERRO_COMUNICACAO',
      xMotivo: error.message || 'Falha de conexão com a SEFAZ',
      isHomologada: false,
      isJaInutilizado: false,
      isUtilizadaNaSefaz: false,
      xmlPedido: signedXml,
      error: error.message
    }
  }
}
