import crypto from 'crypto'
import https from 'https'
import zlib from 'zlib'
import { createClient } from '@supabase/supabase-js'
import { normalizarCUF } from './sefazInutilizacaoService'
import { limparDocumento } from './cnpjAlfanumerico'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseAdmin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseKey)

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
  }>
}> {
  const tpAmb = params.tpAmb || '1'
  const cUF = normalizarCUF(params.uf)
  const cnpjLimpo = limparDocumento(params.cnpj)
  const ultNSU = (params.ultNSU || '0').padStart(15, '0')

  const agent = new https.Agent({
    pfx: params.pfxBuffer,
    passphrase: params.passphrase,
    rejectUnauthorized: false,
    secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT
  })

  // Monta o XML de Requisição oficial <distDFeInt>
  const distDFeInt = [
    '<distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01">',
    `  <tpAmb>${tpAmb}</tpAmb>`,
    `  <cUFAuthor>${cUF}</cUFAuthor>`,
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
        timeout: 15000
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
            const documentos: Array<{ tipo: 'resNFe' | 'procNFe' | 'resEvento' | 'outro'; xml: string }> = []
            const docZipRegex = /<docZip[^>]*>([A-Za-z0-9+/=\s]+)<\/docZip>/g
            let match: RegExpExecArray | null

            while ((match = docZipRegex.exec(respData)) !== null) {
              try {
                const b64 = match[1].replace(/\s/g, '')
                const gzippedBuffer = Buffer.from(b64, 'base64')
                const unzippedBuffer = zlib.gunzipSync(gzippedBuffer)
                const docXml = unzippedBuffer.toString('utf-8')

                let tipo: 'resNFe' | 'procNFe' | 'resEvento' | 'outro' = 'outro'
                if (docXml.includes('<resNFe')) tipo = 'resNFe'
                else if (docXml.includes('<nfeProc') || docXml.includes('<infNFe')) tipo = 'procNFe'
                else if (docXml.includes('<resEvento')) tipo = 'resEvento'

                documentos.push({ tipo, xml: docXml })
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
        const sefazRes = await consultarSefazDistribuicaoDfe({
          cnpj: cliente.cnpj,
          uf: cliente.uf || 'MG',
          pfxBuffer: certBuffer,
          passphrase: cliente.certificado_senha,
          ultNSU: '0'
        })

        cStatRetorno = sefazRes.cStat
        xMotivoRetorno = sefazRes.xMotivo

        // Processa documentos retornados da SEFAZ
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

              // Upsert na tabela de notas destinadas
              const compCalculada = dhEmi.substring(0, 7)
              await supabaseAdmin.from('dfe_notas_destinadas').upsert({
                cliente_id: cliente.id,
                chave: chNFe,
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
                xml_completo: doc.tipo === 'procNFe' ? doc.xml : null,
                competencia: compCalculada,
                updated_at: new Date().toISOString()
              }, { onConflict: 'cliente_id,chave' })
            }
          }
        }

        if (sefazRes.cStat === '656') {
          avisoSefaz = 'SEFAZ retornou Consumo Indevido (Aguarde até 1 hora antes de nova consulta ao WebService). Exibindo base de dados local.'
        } else if (sefazRes.cStat === '137') {
          avisoSefaz = 'SEFAZ Nacional confirmou: Nenhum novo documento localizado nos últimos dias.'
        }
      }
    } catch (errSefaz: any) {
      console.warn('Erro ao consultar SEFAZ ao vivo:', errSefaz)
      avisoSefaz = 'Não foi possível comunicar com o WebService da SEFAZ: ' + (errSefaz.message || '') + '. Exibindo registros sincronizados no banco.'
    }
  }

  // 3. Busca todas as notas destinadas salvas para este cliente
  const { data: destinadasDb } = await supabaseAdmin
    .from('dfe_notas_destinadas')
    .select('*')
    .eq('cliente_id', cliente.id)

  // 4. Busca notas fiscais de entrada (compras) gravadas na tabela oficial nfe_entradas
  const { data: entradasDb } = await supabaseAdmin
    .from('nfe_entradas')
    .select('id, chave, numero, serie, valor, data_emissao, storage_path, cnpj_emitente')
    .eq('cliente_id', cliente.id)

  const mapaNotas = new Map<string, DfeNotaItem>()

  // Processa notas de entrada de nfe_entradas
  for (const ent of (entradasDb || [])) {
    if (ent.chave) {
      const dataStr = ent.data_emissao ? ent.data_emissao.split('T')[0] : ''
      const compEnt = dataStr.substring(0, 7)
      if (!competencia || compEnt === competencia) {
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
    if (!competencia || compDest === competencia) {
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
