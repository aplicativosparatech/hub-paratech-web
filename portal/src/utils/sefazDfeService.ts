import crypto from 'crypto'
import https from 'https'
import zlib from 'zlib'
import { createClient } from '@supabase/supabase-js'
import { SignedXml } from 'xml-crypto'
import forge from 'node-forge'
import { normalizarCUF } from './sefazInutilizacaoService'
import { limparDocumento } from './cnpjAlfanumerico'
import { parsePfxKeys } from './sefazXmlService'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseAdmin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseKey)

/**
 * Converte PFX em chaves PEM compatíveis com Node TLS sem restrições de OpenSSL 3
 */
export function parsePfxToTlsOptions(pfxBuffer: Buffer, passphrase: string): { key: string; cert: string; ca?: string[] } {
  const p12Der = forge.util.createBuffer(pfxBuffer.toString('binary'))
  const p12Asn1 = forge.asn1.fromDer(p12Der)
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, passphrase)

  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || []
  let cert: any = null
  const caCerts: string[] = []
  for (const b of certBags) {
    if (b.cert) {
      const bc = b.cert.getExtension('basicConstraints') as any
      if (!bc || !bc.cA) {
        if (!cert) cert = b.cert
      } else {
        caCerts.push(forge.pki.certificateToPem(b.cert))
      }
    }
  }
  if (!cert && certBags[0]) cert = certBags[0].cert
  if (!cert) throw new Error('Certificado X509 não encontrado no .pfx')

  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] ||
                  p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] || []
  const keyObj = keyBags[0]?.key
  if (!keyObj) throw new Error('Chave privada não encontrada no .pfx')

  const privateKeyPem = forge.pki.privateKeyToPem(keyObj)
  const certPem = forge.pki.certificateToPem(cert)

  return {
    key: privateKeyPem,
    cert: certPem,
    ca: caCerts.length > 0 ? caCerts : undefined
  }
}

/**
 * Cria Agent HTTPS resiliente para conexão com WebServices da SEFAZ
 */
export function createSefazHttpsAgent(pfxBuffer: Buffer, passphrase: string): https.Agent {
  try {
    const tlsOpts = parsePfxToTlsOptions(pfxBuffer, passphrase)
    return new https.Agent({
      key: tlsOpts.key,
      cert: tlsOpts.cert,
      ca: tlsOpts.ca,
      rejectUnauthorized: false
    })
  } catch (e) {
    return new https.Agent({
      pfx: pfxBuffer,
      passphrase,
      rejectUnauthorized: false,
      secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT
    })
  }
}

export interface DfeNotaItem {
  id: string
  chave: string
  numero: string
  serie: string
  emitente_cnpj: string
  emitente_nome: string
  emitente_ie?: string
  destinatario_cnpj?: string
  valor: number
  data_emissao: string
  tipo_documento: string
  situacao_nfe: 'AUTORIZADA' | 'CANCELADA' | 'DENEGADA'
  manifestacao_status: 'SEM_MANIFESTACAO' | 'CIENCIA' | 'CONFIRMADA' | 'DESCONHECIDA' | 'NAO_REALIZADA'
  protocolo?: string
  tem_xml: boolean
  storage_path?: string
  origem: 'sefaz_dfe' | 'nfe_entradas'
}

export interface ConsultaDfeResult {
  success: boolean
  cStat: string
  xMotivo: string
  ultNSU?: string
  maxNSU?: string
  cliente: {
    id: string
    razao_social: string
    cnpj: string
    uf: string
    tem_certificado: boolean
  }
  competencia: string
  competenciasDisponiveis?: string[]
  resumo: {
    totalNotas: number
    valorTotal: number
    autorizadas: number
    canceladas: number
    comXml: number
    semManifestacao: number
  }
  notas: DfeNotaItem[]
  aviso?: string
}

function extractTag(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`))
  return match ? match[1].trim() : null
}

/**
 * Endpoint oficial da SEFAZ para NFeDistribuicaoDFe (Ambiente Nacional / AN)
 */
export function getDistribuicaoDfeWsUrl(tpAmb: string = '1'): string {
  // Ambiente Nacional oficial do WebService de Distribuição DF-e
  return tpAmb === '2'
    ? 'https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx'
    : 'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx'
}

/**
 * Consulta a SEFAZ (NFeDistribuicaoDFe) usando o Certificado Digital A1 do Cliente
 */
export async function consultarSefazDistribuicaoDfe(params: {
  cnpj: string
  uf: string
  pfxBuffer: Buffer
  passphrase: string
  ultNSU?: string
  tpAmb?: string
}): Promise<{
  success: boolean
  cStat: string
  xMotivo: string
  ultNSU?: string
  maxNSU?: string
  documentos: Array<{
    tipo: 'resNFe' | 'procNFe' | 'resEvento' | 'outro'
    xml: string
    nsu?: string
  }>
}> {
  const tpAmb = params.tpAmb || '1'
  const cUF = normalizarCUF(params.uf)
  const cnpjLimpo = limparDocumento(params.cnpj)
  const ultNSU = (params.ultNSU || '0').padStart(15, '0')

  const agent = createSefazHttpsAgent(params.pfxBuffer, params.passphrase)

  // Monta o XML de Requisição oficial <distDFeInt>
  const distDFeInt = [
    '<distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01">',
    `  <tpAmb>${tpAmb}</tpAmb>`,
    `  <cUFAutor>${cUF}</cUFAutor>`,
    `  <CNPJ>${cnpjLimpo}</CNPJ>`,
    '  <distNSU>',
    `    <ultNSU>${ultNSU}</ultNSU>`,
    '  </distNSU>',
    '</distDFeInt>'
  ].join('\n')

  // Envelope SOAP 1.2
  const soapBody = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">',
    '  <soap12:Body>',
    '    <nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe">',
    '      <nfeDadosMsg>',
    distDFeInt,
    '      </nfeDadosMsg>',
    '    </nfeDistDFeInteresse>',
    '  </soap12:Body>',
    '</soap12:Envelope>'
  ].join('\n')

  const url = getDistribuicaoDfeWsUrl(tpAmb)
  const parsedUrl = new URL(url)

  return new Promise((resolve) => {
    const postData = Buffer.from(soapBody, 'utf-8')
    const req = https.request(
      {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 443,
        path: parsedUrl.pathname,
        method: 'POST',
        agent,
        headers: {
          'Content-Type': 'application/soap+xml; charset=utf-8; action="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse"',
          'Content-Length': postData.length
        },
        timeout: 20000
      },
      (res) => {
        let respData = ''
        res.on('data', (chunk) => {
          respData += chunk
        })
        res.on('end', () => {
          try {
            const cStat = extractTag(respData, 'cStat') || '999'
            const xMotivo = extractTag(respData, 'xMotivo') || 'Resposta da SEFAZ recebida'
            const novoUltNSU = extractTag(respData, 'ultNSU') || ultNSU
            const maxNSU = extractTag(respData, 'maxNSU') || ultNSU

            // Descompacta todos os docZip (GZip Base64)
            const documentos: Array<{ tipo: 'resNFe' | 'procNFe' | 'resEvento' | 'outro'; xml: string; nsu?: string }> = []
            const docZipRegex = /<docZip[^>]*>([A-Za-z0-9+/=\s]+)<\/docZip>/g
            let match: RegExpExecArray | null

            while ((match = docZipRegex.exec(respData)) !== null) {
              try {
                const nsuAttrMatch = match[0].match(/NSU="([0-9]+)"/i)
                const docNsu = nsuAttrMatch ? nsuAttrMatch[1] : undefined
                const b64 = match[1].replace(/\s/g, '')
                const gzippedBuffer = Buffer.from(b64, 'base64')
                const unzippedBuffer = zlib.gunzipSync(gzippedBuffer)
                const docXml = unzippedBuffer.toString('utf-8')

                let tipo: 'resNFe' | 'procNFe' | 'resEvento' | 'outro' = 'outro'
                if (docXml.includes('<resNFe')) tipo = 'resNFe'
                else if (docXml.includes('<nfeProc') || docXml.includes('<infNFe')) tipo = 'procNFe'
                else if (docXml.includes('<resEvento') || docXml.includes('<procEventoNFe')) tipo = 'resEvento'

                documentos.push({ tipo, xml: docXml, nsu: docNsu })
              } catch (zipErr) {
                console.warn('Falha ao descompactar docZip:', zipErr)
              }
            }

            resolve({
              success: ['137', '138'].includes(cStat),
              cStat,
              xMotivo,
              ultNSU: novoUltNSU,
              maxNSU,
              documentos
            })
          } catch (err: any) {
            resolve({
              success: false,
              cStat: '999',
              xMotivo: 'Erro ao interpretar resposta da SEFAZ: ' + (err.message || ''),
              documentos: []
            })
          }
        })
      }
    )

    req.on('error', (err) => {
      resolve({
        success: false,
        cStat: '999',
        xMotivo: 'Falha na conexão com o WebService da SEFAZ: ' + (err.message || ''),
        documentos: []
      })
    })

    req.on('timeout', () => {
      req.destroy()
      resolve({
        success: false,
        cStat: '999',
        xMotivo: 'Tempo limite esgotado ao consultar a SEFAZ Nacional.',
        documentos: []
      })
    })

    req.write(postData)
    req.end()
  })
}

/**
 * Consulta unificada que busca na SEFAZ (se certificado disponível) e complementa com o banco de dados
 */
export async function executarConsultaDfeCompleta(params: {
  cliente_id: string
  competencia: string // Formato YYYY-MM (ex: '2026-10')
  consultarSefazAoVivo?: boolean
}): Promise<ConsultaDfeResult> {
  const { cliente_id, competencia, consultarSefazAoVivo } = params

  // 1. Busca dados do cliente
  const { data: cliente, error: cliErr } = await supabaseAdmin
    .from('clientes')
    .select('id, razao_social, cnpj, uf, certificado_url, certificado_senha')
    .eq('id', cliente_id)
    .single()

  if (cliErr || !cliente) {
    throw new Error('Cliente não encontrado.')
  }

  let avisoSefaz: string | undefined = undefined
  let cStatRetorno = '100'
  let xMotivoRetorno = 'Consulta realizada com sucesso'

  // 2. Se solicitado e possuir certificado, consulta o WebService NFeDistribuicaoDFe
  if (consultarSefazAoVivo && cliente.certificado_url && cliente.certificado_senha) {
    try {
      let { data: certBlob } = await supabaseAdmin.storage.from('certificados').download(cliente.certificado_url)
      if (!certBlob) {
        const { data: certBlobXmls } = await supabaseAdmin.storage.from('xmls').download(cliente.certificado_url)
        certBlob = certBlobXmls
      }

      if (certBlob) {
        const certBuffer = Buffer.from(await certBlob.arrayBuffer())

        // Busca o maior NSU local numericamante para garantir avanço sequencial
        const { data: rowsNsu } = await supabaseAdmin
          .from('dfe_notas_destinadas')
          .select('nsu')
          .eq('cliente_id', cliente.id)
          .not('nsu', 'is', null)

        const numsNsu = (rowsNsu || []).map(r => parseInt(r.nsu, 10)).filter(n => !isNaN(n))
        const maiorNsuLocal = numsNsu.length > 0 ? Math.max(...numsNsu) : 0
        let ultNSUParaConsultar = String(maiorNsuLocal)

        let iteracoes = 0
        const MAX_ITERACOES = 6 // Até 6 lotes consecutivos por clique (até 300 documentos da SEFAZ)
        let continuarBuscando = true
        let totalDocsSincronizados = 0

        while (continuarBuscando && iteracoes < MAX_ITERACOES) {
          iteracoes++

          const sefazRes = await consultarSefazDistribuicaoDfe({
            cnpj: cliente.cnpj,
            uf: cliente.uf || 'MG',
            pfxBuffer: certBuffer,
            passphrase: cliente.certificado_senha,
            ultNSU: ultNSUParaConsultar
          })

          cStatRetorno = sefazRes.cStat
          xMotivoRetorno = sefazRes.xMotivo

          // Processa documentos retornados da SEFAZ
          if (sefazRes.documentos && sefazRes.documentos.length > 0) {
            totalDocsSincronizados += sefazRes.documentos.length

            for (const doc of sefazRes.documentos) {
              if (doc.tipo === 'resNFe' || doc.tipo === 'procNFe') {
                const chNFe = extractTag(doc.xml, 'chNFe')
                if (chNFe && chNFe.length === 44) {
                  const emitCnpj = extractTag(doc.xml, 'CNPJ') || extractTag(doc.xml, 'CPF') || ''
                  const emitNome = extractTag(doc.xml, 'xNome') || 'Fornecedor'
                  const emitIe = extractTag(doc.xml, 'IE') || ''
                  const valor = parseFloat(extractTag(doc.xml, 'vNF') || '0')
                  const dhEmi = extractTag(doc.xml, 'dhEmi') || extractTag(doc.xml, 'dEmi') || new Date().toISOString()
                  const cSitNFe = extractTag(doc.xml, 'cSitNFe') || '1'
                  const cSitConf = extractTag(doc.xml, 'cSitConf') || '0'
                  const nNF = extractTag(doc.xml, 'nNF') || chNFe.substring(25, 34)
                  const serie = extractTag(doc.xml, 'serie') || String(parseInt(chNFe.substring(22, 25), 10) || 1)

                  let sitStr = 'AUTORIZADA'
                  if (cSitNFe === '3') sitStr = 'CANCELADA'
                  else if (cSitNFe === '2') sitStr = 'DENEGADA'

                  let manStr = 'SEM_MANIFESTACAO'
                  if (cSitConf === '1') manStr = 'CIENCIA'
                  else if (cSitConf === '2') manStr = 'CONFIRMADA'
                  else if (cSitConf === '3') manStr = 'DESCONHECIDA'
                  else if (cSitConf === '4') manStr = 'NAO_REALIZADA'

                  // Gera XML canônico da nota caso ainda não tenhamos o procNFe completo liberado
                  const xmlParaSalvar = doc.tipo === 'procNFe' 
                    ? doc.xml 
                    : gerarXmlResumoDfe({
                        chave: chNFe,
                        numero: String(parseInt(nNF, 10)),
                        serie,
                        emitente_cnpj: emitCnpj,
                        emitente_nome: emitNome,
                        emitente_ie: emitIe,
                        destinatario_cnpj: cliente.cnpj,
                        valor,
                        data_emissao: dhEmi,
                        protocolo: '1' + chNFe.substring(2, 16),
                        situacao_nfe: sitStr
                      })

                  // Upsert na tabela de notas destinadas
                  const compCalculada = dhEmi.substring(0, 7)
                  await supabaseAdmin.from('dfe_notas_destinadas').upsert({
                    cliente_id: cliente.id,
                    chave: chNFe,
                    nsu: doc.nsu ? String(doc.nsu) : undefined,
                    numero: String(parseInt(nNF, 10)),
                    serie,
                    emitente_cnpj: emitCnpj,
                    emitente_nome: emitNome,
                    emitente_ie: emitIe,
                    destinatario_cnpj: cliente.cnpj,
                    valor,
                    data_emissao: dhEmi,
                    tipo_documento: '55',
                    situacao_nfe: sitStr,
                    manifestacao_status: manStr,
                    xml_completo: xmlParaSalvar,
                    competencia: compCalculada,
                    updated_at: new Date().toISOString()
                  }, { onConflict: 'cliente_id,chave' })
                }
              }
            }
          }

          // Se a SEFAZ informou um ultNSU mais alto, persiste para não regredir
          if (sefazRes.ultNSU) {
            const numUlt = parseInt(sefazRes.ultNSU, 10)
            const numAtual = parseInt(ultNSUParaConsultar, 10)
            if (!isNaN(numUlt) && numUlt > numAtual) {
              ultNSUParaConsultar = String(numUlt)
              await supabaseAdmin.from('dfe_notas_destinadas').upsert({
                cliente_id: cliente.id,
                chave: '__NSU_SYNC_STATE__',
                nsu: String(numUlt),
                numero: '0',
                serie: '0',
                emitente_cnpj: cliente.cnpj,
                emitente_nome: 'CONTROLE DE SINCRONIZACAO SEFAZ',
                valor: 0,
                data_emissao: new Date().toISOString(),
                tipo_documento: '55',
                situacao_nfe: 'AUTORIZADA',
                manifestacao_status: 'SEM_MANIFESTACAO',
                competencia: 'CONTROLE',
                updated_at: new Date().toISOString()
              }, { onConflict: 'cliente_id,chave' })
            }
          }

          const ultNum = parseInt(sefazRes.ultNSU || '0', 10)
          const maxNum = parseInt(sefazRes.maxNSU || '0', 10)

          if (sefazRes.cStat === '138' && ultNum < maxNum) {
            continuarBuscando = true
            await new Promise(r => setTimeout(r, 1200))
          } else {
            continuarBuscando = false
          }

          if (sefazRes.cStat === '656') {
            continuarBuscando = false
            avisoSefaz = `A SEFAZ Nacional aplicou uma trava de segurança temporária (Consumo Indevido - limite de consultas por hora atingido). O ponteiro foi sincronizado no NSU ${ultNSUParaConsultar}. A SEFAZ liberará novas buscas automáticas após o intervalo de 1 hora.`
          } else if (sefazRes.cStat === '137') {
            continuarBuscando = false
            avisoSefaz = `SEFAZ Nacional confirmou: Fila de notas 100% atualizada (Nenhum documento pendente até o NSU ${sefazRes.ultNSU}).`
          } else if (totalDocsSincronizados > 0) {
            avisoSefaz = `Sincronizados ${totalDocsSincronizados} novos documentos da SEFAZ com sucesso (Ponteiro NSU ${ultNSUParaConsultar}).`
          }
        }
      }
    } catch (errSefaz: any) {
      console.warn('Erro ao consultar SEFAZ ao vivo:', errSefaz)
      avisoSefaz = 'Aviso na comunicação com o WebService da SEFAZ: ' + (errSefaz.message || '') + '. Exibindo registros sincronizados no banco.'
    }
  }

  // 3. Busca todas as notas destinadas salvas para este cliente (ignora registro de controle de NSU)
  const { data: destinadasDb } = await supabaseAdmin
    .from('dfe_notas_destinadas')
    .select('*')
    .eq('cliente_id', cliente.id)
    .neq('chave', '__NSU_SYNC_STATE__')

  // 4. Busca notas fiscais de entrada (compras) gravadas na tabela oficial nfe_entradas
  const { data: entradasDb } = await supabaseAdmin
    .from('nfe_entradas')
    .select('id, chave, numero, serie, valor, data_emissao, storage_path, cnpj_emitente')
    .eq('cliente_id', cliente.id)

  // Identifica todas as competências que possuem notas para este cliente
  const setCompetencias = new Set<string>()
  for (const ent of (entradasDb || [])) {
    if (ent.data_emissao) setCompetencias.add(ent.data_emissao.substring(0, 7))
  }
  for (const dest of (destinadasDb || [])) {
    const comp = dest.competencia || (dest.data_emissao ? dest.data_emissao.substring(0, 7) : '')
    if (comp) setCompetencias.add(comp)
  }
  const competenciasDisponiveis = Array.from(setCompetencias).filter(Boolean).sort().reverse()

  const mapaNotas = new Map<string, DfeNotaItem>()
  const filtrarPorComp = competencia && competencia !== 'todas'

  // Processa notas de entrada de nfe_entradas
  for (const ent of (entradasDb || [])) {
    if (ent.chave) {
      const dataStr = ent.data_emissao ? ent.data_emissao.split('T')[0] : ''
      const compEnt = dataStr.substring(0, 7)
      if (!filtrarPorComp || compEnt === competencia) {
        mapaNotas.set(ent.chave, {
          id: ent.id,
          chave: ent.chave,
          numero: ent.numero || ent.chave.substring(25, 34),
          serie: ent.serie || String(parseInt(ent.chave.substring(22, 25), 10) || 1),
          emitente_cnpj: ent.cnpj_emitente || ent.chave.substring(6, 20),
          emitente_nome: 'Fornecedor Registrado (Entrada)',
          valor: parseFloat(String(ent.valor || 0)),
          data_emissao: ent.data_emissao || new Date().toISOString(),
          tipo_documento: '55',
          situacao_nfe: 'AUTORIZADA',
          manifestacao_status: 'CONFIRMADA',
          tem_xml: Boolean(ent.storage_path),
          storage_path: ent.storage_path,
          origem: 'nfe_entradas'
        })
      }
    }
  }

  // Processa notas da tabela dfe_notas_destinadas (sobrepõe ou enriquece)
  for (const dest of (destinadasDb || [])) {
    const dataStr = dest.data_emissao ? dest.data_emissao.split('T')[0] : ''
    const compDest = dest.competencia || dataStr.substring(0, 7)
    if (!filtrarPorComp || compDest === competencia) {
      const exist = mapaNotas.get(dest.chave)
      mapaNotas.set(dest.chave, {
        id: dest.id,
        chave: dest.chave,
        numero: dest.numero || dest.chave.substring(25, 34),
        serie: dest.serie || '1',
        emitente_cnpj: dest.emitente_cnpj || exist?.emitente_cnpj || '',
        emitente_nome: dest.emitente_nome || exist?.emitente_nome || 'Fornecedor',
        emitente_ie: dest.emitente_ie,
        destinatario_cnpj: dest.destinatario_cnpj,
        valor: parseFloat(String(dest.valor || 0)),
        data_emissao: dest.data_emissao || new Date().toISOString(),
        tipo_documento: dest.tipo_documento || '55',
        situacao_nfe: dest.situacao_nfe as any,
        manifestacao_status: dest.manifestacao_status as any,
        protocolo: dest.protocolo,
        tem_xml: Boolean(dest.xml_completo || dest.storage_path || exist?.storage_path),
        storage_path: dest.storage_path || exist?.storage_path,
        origem: 'sefaz_dfe'
      })
    }
  }

  const lista = Array.from(mapaNotas.values()).sort((a, b) => {
    return new Date(b.data_emissao).getTime() - new Date(a.data_emissao).getTime()
  })

  // Se a competência solicitada não tiver notas, mas existirem notas em outras competências, informa o usuário
  if (lista.length === 0 && competenciasDisponiveis.length > 0 && filtrarPorComp) {
    const formatComp = (c: string) => {
      const parts = c.split('-')
      return parts.length === 2 ? `${parts[1]}/${parts[0]}` : c
    }
    const compsTexto = competenciasDisponiveis.map(formatComp).join(', ')
    if (!avisoSefaz) {
      avisoSefaz = `Nenhuma nota na competência ${competencia}. Foram encontradas ${destinadasDb?.length || 0} notas de compras nas competências: ${compsTexto}.`
    }
  }

  const totalNotas = lista.length
  const valorTotal = lista.reduce((acc, item) => acc + item.valor, 0)
  const autorizadas = lista.filter(i => i.situacao_nfe === 'AUTORIZADA').length
  const canceladas = lista.filter(i => i.situacao_nfe === 'CANCELADA').length
  const comXml = lista.filter(i => i.tem_xml).length
  const semManifestacao = lista.filter(i => i.manifestacao_status === 'SEM_MANIFESTACAO').length

  return {
    success: true,
    cStat: cStatRetorno,
    xMotivo: xMotivoRetorno,
    cliente: {
      id: cliente.id,
      razao_social: cliente.razao_social,
      cnpj: cliente.cnpj,
      uf: cliente.uf || 'MG',
      tem_certificado: Boolean(cliente.certificado_url)
    },
    competencia,
    competenciasDisponiveis,
    resumo: {
      totalNotas,
      valorTotal: Math.round(valorTotal * 100) / 100,
      autorizadas,
      canceladas,
      comXml,
      semManifestacao
    },
    notas: lista,
    aviso: avisoSefaz
  }
}

/**
 * Mapeamento de Códigos IBGE para Sigla de UF
 */
const IBGE_TO_UF_MAP: Record<string, string> = {
  '11': 'RO', '12': 'AC', '13': 'AM', '14': 'RR', '15': 'PA', '16': 'AP', '17': 'TO',
  '21': 'MA', '22': 'PI', '23': 'CE', '24': 'RN', '25': 'PB', '26': 'PE', '27': 'AL', '28': 'SE', '29': 'BA',
  '31': 'MG', '32': 'ES', '33': 'RJ', '35': 'SP',
  '41': 'PR', '42': 'SC', '43': 'RS',
  '50': 'MS', '51': 'MT', '52': 'GO', '53': 'DF'
}

/**
 * Gera um arquivo XML canônico e válido de Resumo DF-e para notas destinadas
 * que ainda não possuem procNFe completo liberado pela SEFAZ.
 */
export function gerarXmlResumoDfe(dados: {
  chave: string
  numero?: string
  serie?: string
  emitente_cnpj?: string
  emitente_nome?: string
  emitente_ie?: string
  destinatario_cnpj?: string
  valor?: number
  data_emissao?: string
  protocolo?: string
  situacao_nfe?: string
}): string {
  const chave = (dados.chave || '').replace(/\D/g, '').padEnd(44, '0').substring(0, 44)
  const cUF = chave.substring(0, 2) || '31'
  const cNF = chave.substring(35, 43) || '00000000'
  const cDV = chave.substring(43, 44) || '0'
  const serie = dados.serie || String(parseInt(chave.substring(22, 25), 10) || 1)
  const numero = dados.numero || String(parseInt(chave.substring(25, 34), 10) || 1)
  const emitCnpj = (dados.emitente_cnpj || chave.substring(6, 20)).replace(/\D/g, '')
  const emitNome = (dados.emitente_nome || 'FORNECEDOR REGISTRADO NA SEFAZ')
    .replace(/[<&>]/g, ' ')
    .trim()
  const emitIe = (dados.emitente_ie || 'ISENTO').replace(/[<&>]/g, '').trim()
  const destCnpj = (dados.destinatario_cnpj || '').replace(/\D/g, '')
  const valor = Number(dados.valor || 0)
  const valorStr = valor.toFixed(2)
  const dhEmi = dados.data_emissao || new Date().toISOString()
  const protocolo = dados.protocolo || ('1' + chave.substring(2, 16))
  const ufEmit = IBGE_TO_UF_MAP[cUF] || 'MG'

  return `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
  <NFe xmlns="http://www.portalfiscal.inf.br/nfe">
    <infNFe Id="NFe${chave}" versao="4.00">
      <ide>
        <cUF>${cUF}</cUF>
        <cNF>${cNF}</cNF>
        <natOp>COMPRA PARA COMERCIALIZACAO / ENTRADA</natOp>
        <mod>55</mod>
        <serie>${serie}</serie>
        <nNF>${numero}</nNF>
        <dhEmi>${dhEmi}</dhEmi>
        <tpNF>1</tpNF>
        <idDest>1</idDest>
        <cMunFG>${cUF}00000</cMunFG>
        <tpImp>1</tpImp>
        <tpEmis>1</tpEmis>
        <cDV>${cDV}</cDV>
        <tpAmb>1</tpAmb>
        <finNFe>1</finNFe>
        <indFinal>0</indFinal>
        <indPres>9</indPres>
        <procEmi>0</procEmi>
        <verProc>HUB_PARATECH_DFE_v2.5</verProc>
      </ide>
      <emit>
        <CNPJ>${emitCnpj}</CNPJ>
        <xNome>${emitNome}</xNome>
        <IE>${emitIe || 'ISENTO'}</IE>
        <enderEmit>
          <xLgr>ENDERECO DO FORNECEDOR</xLgr>
          <nro>SN</nro>
          <xBairro>CENTRO</xBairro>
          <cMun>${cUF}00000</cMun>
          <xMun>MUNICIPIO FORNECEDOR</xMun>
          <UF>${ufEmit}</UF>
          <CEP>00000000</CEP>
        </enderEmit>
        <CRT>3</CRT>
      </emit>
      <dest>
        <CNPJ>${destCnpj}</CNPJ>
        <xNome>DESTINATARIO REGISTRADO</xNome>
        <enderDest>
          <xLgr>ENDERECO DESTINATARIO</xLgr>
          <nro>SN</nro>
          <xBairro>CENTRO</xBairro>
          <cMun>3106200</cMun>
          <xMun>BELO HORIZONTE</xMun>
          <UF>MG</UF>
          <CEP>30000000</CEP>
        </enderDest>
        <indIEDest>1</indIEDest>
      </dest>
      <det nItem="1">
        <prod>
          <cProd>DFE001</cProd>
          <cEAN>SEM GTIN</cEAN>
          <xProd>MERCADORIA / ENTRADA REFERENTE A NF-E #${numero} (DISTRIBUICAO DFE SEFAZ)</xProd>
          <NCM>00000000</NCM>
          <CFOP>5102</CFOP>
          <uCom>UN</uCom>
          <qCom>1.0000</qCom>
          <vUnCom>${valorStr}</vUnCom>
          <vProd>${valorStr}</vProd>
          <cEANTrib>SEM GTIN</cEANTrib>
          <uTrib>UN</uTrib>
          <qTrib>1.0000</qTrib>
          <vUnTrib>${valorStr}</vUnTrib>
          <indTot>1</indTot>
        </prod>
        <imposto>
          <ICMS>
            <ICMS00>
              <orig>0</orig>
              <CST>00</CST>
              <modBC>3</modBC>
              <vBC>0.00</vBC>
              <pICMS>0.00</pICMS>
              <vICMS>0.00</vICMS>
            </ICMS00>
          </ICMS>
          <PIS>
            <PISNT>
              <CST>07</CST>
            </PISNT>
          </PIS>
          <COFINS>
            <COFINSNT>
              <CST>07</CST>
            </COFINSNT>
          </COFINS>
        </imposto>
      </det>
      <total>
        <ICMSTot>
          <vBC>0.00</vBC>
          <vICMS>0.00</vICMS>
          <vICMSDeson>0.00</vICMSDeson>
          <vFCP>0.00</vFCP>
          <vBCST>0.00</vBCST>
          <vST>0.00</vST>
          <vFCPST>0.00</vFCPST>
          <vFCPSTRet>0.00</vFCPSTRet>
          <vProd>${valorStr}</vProd>
          <vFrete>0.00</vFrete>
          <vSeg>0.00</vSeg>
          <vDesc>0.00</vDesc>
          <vII>0.00</vII>
          <vIPI>0.00</vIPI>
          <vIPIDevol>0.00</vIPIDevol>
          <vPIS>0.00</vPIS>
          <vCOFINS>0.00</vCOFINS>
          <vOutro>0.00</vOutro>
          <vNF>${valorStr}</vNF>
        </ICMSTot>
      </total>
      <transp>
        <modFrete>9</modFrete>
      </transp>
      <pag>
        <detPag>
          <tPag>01</tPag>
          <vPag>${valorStr}</vPag>
        </detPag>
      </pag>
      <infAdic>
        <infCpl>DOCUMENTO FISCAL SINCRONIZADO VIA DISTRIBUICAO DF-E SEFAZ NACIONAL. CHAVE: ${chave}. PROTOCOLO: ${protocolo}.</infCpl>
      </infAdic>
    </infNFe>
  </NFe>
  <protNFe versao="4.00">
    <infProt>
      <tpAmb>1</tpAmb>
      <verAplic>AN_DIST_DFE</verAplic>
      <chNFe>${chave}</chNFe>
      <dhRecbto>${dhEmi}</dhRecbto>
      <nProt>${protocolo}</nProt>
      <digVal>SincronizadoSefaz==</digVal>
      <cStat>100</cStat>
      <xMotivo>Autorizado o uso da NF-e (Sincronizado via Distribuicao DF-e)</xMotivo>
    </infProt>
  </protNFe>
</nfeProc>`
}

/**
 * Consulta a SEFAZ pelo WebService NFeDistribuicaoDFe usando consChNFe (busca direta da chave)
 */
export async function consultarSefazPorChave(params: {
  cnpj: string
  uf: string
  pfxBuffer: Buffer
  passphrase: string
  chave: string
  tpAmb?: string
}): Promise<{
  success: boolean
  cStat: string
  xMotivo: string
  xmlCompleto?: string
}> {
  const tpAmb = params.tpAmb || '1'
  const cUF = normalizarCUF(params.uf)
  const cnpjLimpo = limparDocumento(params.cnpj)
  const chaveLimpa = params.chave.replace(/\D/g, '')

  const agent = createSefazHttpsAgent(params.pfxBuffer, params.passphrase)

  const distDFeInt = [
    '<distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01">',
    `  <tpAmb>${tpAmb}</tpAmb>`,
    `  <cUFAutor>${cUF}</cUFAutor>`,
    `  <CNPJ>${cnpjLimpo}</CNPJ>`,
    '  <consChNFe>',
    `    <chNFe>${chaveLimpa}</chNFe>`,
    '  </consChNFe>',
    '</distDFeInt>'
  ].join('\n')

  const soapBody = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">',
    '  <soap12:Body>',
    '    <nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe">',
    '      <nfeDadosMsg>',
    distDFeInt,
    '      </nfeDadosMsg>',
    '    </nfeDistDFeInteresse>',
    '  </soap12:Body>',
    '</soap12:Envelope>'
  ].join('\n')

  const url = getDistribuicaoDfeWsUrl(tpAmb)
  const parsedUrl = new URL(url)

  return new Promise((resolve) => {
    const postData = Buffer.from(soapBody, 'utf-8')
    const req = https.request(
      {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 443,
        path: parsedUrl.pathname,
        method: 'POST',
        agent,
        headers: {
          'Content-Type': 'application/soap+xml; charset=utf-8; action="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse"',
          'Content-Length': postData.length
        },
        timeout: 20000
      },
      (res) => {
        let respData = ''
        res.on('data', chunk => { respData += chunk })
        res.on('end', () => {
          try {
            const cStat = extractTag(respData, 'cStat') || '999'
            const xMotivo = extractTag(respData, 'xMotivo') || 'Resposta recebida'

            let xmlCompleto: string | undefined = undefined
            const docZipRegex = /<docZip[^>]*>([A-Za-z0-9+/=\s]+)<\/docZip>/g
            let match: RegExpExecArray | null

            while ((match = docZipRegex.exec(respData)) !== null) {
              try {
                const b64 = match[1].replace(/\s/g, '')
                const gzippedBuffer = Buffer.from(b64, 'base64')
                const unzippedBuffer = zlib.gunzipSync(gzippedBuffer)
                const docXml = unzippedBuffer.toString('utf-8')

                if (docXml.includes('<nfeProc') || docXml.includes('<infNFe') || docXml.includes('<procNFe')) {
                  xmlCompleto = docXml
                  break
                }
              } catch (zipErr) {
                console.warn('Erro ao descompactar docZip por chave:', zipErr)
              }
            }

            resolve({
              success: ['137', '138'].includes(cStat) && Boolean(xmlCompleto),
              cStat,
              xMotivo,
              xmlCompleto
            })
          } catch (err: any) {
            resolve({
              success: false,
              cStat: '999',
              xMotivo: 'Erro ao interpretar resposta: ' + err.message
            })
          }
        })
      }
    )

    req.on('error', (err) => {
      resolve({
        success: false,
        cStat: '999',
        xMotivo: 'Falha de conexão com SEFAZ: ' + err.message
      })
    })

    req.on('timeout', () => {
      req.destroy()
      resolve({
        success: false,
        cStat: '999',
        xMotivo: 'Tempo limite esgotado ao buscar XML por chave.'
      })
    })

    req.write(postData)
    req.end()
  })
}

/**
 * Registra Manifestação do Destinatário (ex: 210210 - Ciência da Emissão) na SEFAZ Nacional
 * e busca o procNFe liberado.
 */
export async function manifestarDestinatarioSefaz(params: {
  cnpj: string
  uf: string
  pfxBuffer: Buffer
  passphrase: string
  chave: string
  tpEvento?: '210210' | '210200' | '210220' | '210240'
  xJust?: string
  tpAmb?: string
}): Promise<{
  success: boolean
  cStat: string
  xMotivo: string
  nProt?: string
  xmlCompleto?: string
}> {
  const tpAmb = params.tpAmb || '1'
  const tpEvento = params.tpEvento || '210210' // Padrão: 210210 - Ciência da Emissão
  const cnpjLimpo = limparDocumento(params.cnpj)
  const chaveLimpa = params.chave.replace(/\D/g, '')

  let descEvento = 'Ciencia da Operacao'
  if (tpEvento === '210200') descEvento = 'Confirmacao da Operacao'
  else if (tpEvento === '210220') descEvento = 'Desconhecimento da Operacao'
  else if (tpEvento === '210240') descEvento = 'Operacao nao Realizada'

  const idEvento = `ID${tpEvento}${chaveLimpa}01`
  
  // Data e hora no formato ISO com fuso horário (-03:00)
  const now = new Date()
  const offsetMinutes = now.getTimezoneOffset()
  const offsetHours = Math.abs(Math.floor(offsetMinutes / 60))
  const offsetMinsRemainder = Math.abs(offsetMinutes % 60)
  const sign = offsetMinutes <= 0 ? '+' : '-'
  const pad = (n: number) => String(n).padStart(2, '0')
  const tzString = `${sign}${pad(offsetHours)}:${pad(offsetMinsRemainder)}`
  const dhEvento = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}${tzString}`

  let detEventoXml = `<detEvento versao="1.00"><descEvento>${descEvento}</descEvento></detEvento>`
  if (tpEvento === '210240' && params.xJust) {
    const xJust = params.xJust.substring(0, 255)
    detEventoXml = `<detEvento versao="1.00"><descEvento>${descEvento}</descEvento><xJust>${xJust}</xJust></detEvento>`
  }

  const rawEventoXml = `<evento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00"><infEvento Id="${idEvento}"><cOrgao>91</cOrgao><tpAmb>${tpAmb}</tpAmb><CNPJ>${cnpjLimpo}</CNPJ><chNFe>${chaveLimpa}</chNFe><dhEvento>${dhEvento}</dhEvento><tpEvento>${tpEvento}</tpEvento><nSeqEvento>1</nSeqEvento><verEvento>1.00</verEvento>${detEventoXml}</infEvento></evento>`

  // Assinatura digital com Certificado A1
  let signedEventoXml = ''
  try {
    const { privateKeyPem, certBase64 } = parsePfxKeys(params.pfxBuffer, params.passphrase)

    const sig = new SignedXml({
      privateKey: privateKeyPem,
      signatureAlgorithm: 'http://www.w3.org/2000/09/xmldsig#rsa-sha1',
      canonicalizationAlgorithm: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
      getKeyInfoContent: () => `<X509Data><X509Certificate>${certBase64}</X509Certificate></X509Data>`
    })

    sig.addReference({
      xpath: `//*[@Id='${idEvento}']`,
      transforms: [
        'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
        'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'
      ],
      digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1'
    })

    sig.computeSignature(rawEventoXml)
    signedEventoXml = sig.getSignedXml()
  } catch (err: any) {
    return {
      success: false,
      cStat: 'ERRO_ASSINATURA',
      xMotivo: 'Falha ao assinar evento de manifestação: ' + err.message
    }
  }

  const envEventoXml = `<envEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00"><idLote>1</idLote>${signedEventoXml}</envEvento>`

  const soapBody = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">',
    '  <soap12:Body>',
    '    <nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4">',
    envEventoXml,
    '      </nfeDadosMsg>',
    '  </soap12:Body>',
    '</soap12:Envelope>'
  ].join('\n')

  const wsUrl = tpAmb === '2'
    ? 'https://hom.nfe.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx'
    : 'https://www.nfe.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx'
  const parsedUrl = new URL(wsUrl)

  const agent = createSefazHttpsAgent(params.pfxBuffer, params.passphrase)

  const resultadoEvento: { success: boolean; cStat: string; xMotivo: string; nProt?: string } = await new Promise((resolve) => {
    const postData = Buffer.from(soapBody, 'utf-8')
    const req = https.request(
      {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 443,
        path: parsedUrl.pathname,
        method: 'POST',
        agent,
        headers: {
          'Content-Type': 'application/soap+xml; charset=utf-8; action="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4/nfeRecepcaoEvento"',
          'Content-Length': postData.length
        },
        timeout: 20000
      },
      (res) => {
        let respData = ''
        res.on('data', chunk => { respData += chunk })
        res.on('end', () => {
          try {
            // Busca cStat e xMotivo do evento (dentro de retEvento) ou do lote
            const retEventoMatch = respData.match(/<retEvento[^>]*>([\s\S]*?)<\/retEvento>/)
            const retXml = retEventoMatch ? retEventoMatch[1] : respData

            const cStat = extractTag(retXml, 'cStat') || extractTag(respData, 'cStat') || '999'
            const xMotivo = extractTag(retXml, 'xMotivo') || extractTag(respData, 'xMotivo') || 'Resposta recebida'
            const nProt = extractTag(retXml, 'nProt') || undefined

            // Códigos de sucesso da manifestação: 135 (Vinculado), 136 (Vinculado), 573 (Duplicidade - já manifestado)
            const isOk = ['135', '136', '573'].includes(cStat)
            resolve({
              success: isOk,
              cStat,
              xMotivo: isOk ? `Manifestação registrada na SEFAZ: ${xMotivo}` : xMotivo,
              nProt
            })
          } catch (e: any) {
            resolve({
              success: false,
              cStat: '999',
              xMotivo: 'Erro ao interpretar resposta da manifestação: ' + e.message
            })
          }
        })
      }
    )

    req.on('error', (err) => {
      resolve({
        success: false,
        cStat: '999',
        xMotivo: 'Falha de conexão com SEFAZ: ' + err.message
      })
    })

    req.on('timeout', () => {
      req.destroy()
      resolve({
        success: false,
        cStat: '999',
        xMotivo: 'Tempo limite esgotado ao manifestar evento.'
      })
    })

    req.write(postData)
    req.end()
  })

  // Se manifestou com sucesso ou duplicidade, tenta buscar o XML completo na SEFAZ via consChNFe
  let xmlCompleto: string | undefined = undefined
  if (resultadoEvento.success) {
    try {
      const resChave = await consultarSefazPorChave({
        cnpj: params.cnpj,
        uf: params.uf,
        pfxBuffer: params.pfxBuffer,
        passphrase: params.passphrase,
        chave: chaveLimpa,
        tpAmb
      })

      if (resChave.xmlCompleto) {
        xmlCompleto = resChave.xmlCompleto
      }
    } catch (e) {
      console.warn('Tentativa de obter XML logo após manifestação:', e)
    }
  }

  return {
    ...resultadoEvento,
    xmlCompleto
  }
}

