import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { 
  manifestarDestinatarioSefaz, 
  consultarSefazPorChave, 
  gerarXmlResumoDfe 
} from '@/utils/sefazDfeService'
import { limparDocumento, limparChaveAcesso } from '@/utils/cnpjAlfanumerico'

function extractTag(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`)
  const match = xml.match(regex)
  return match ? match[1].trim() : null
}

function calculateMonofasico(xml: string): number {
  let totalMonofasico = 0
  const detRegex = /<det[^>]*>([\s\S]*?)<\/det>/g
  let match: RegExpExecArray | null

  while ((match = detRegex.exec(xml)) !== null) {
    const itemXml = match[1]
    const hasMonofasicoCST = /<CST>(04|06)<\/CST>/.test(itemXml)

    if (hasMonofasicoCST) {
      const vProdStr = extractTag(itemXml, 'vProd')
      if (vProdStr) {
        const vProd = parseFloat(vProdStr)
        if (!isNaN(vProd)) {
          totalMonofasico += vProd
        }
      }
    }
  }

  return Math.round(totalMonofasico * 100) / 100
}

const tPagNames: Record<string, string> = {
  '01': 'Dinheiro',
  '02': 'Cheque',
  '03': 'Cartão de Crédito',
  '04': 'Cartão de Débito',
  '05': 'Crédito Loja',
  '10': 'Vale Alimentação',
  '11': 'Vale Refeição',
  '12': 'Vale Presente',
  '13': 'Vale Combustível',
  '14': 'Duplicata Mercantil',
  '15': 'Boleto Bancário',
  '16': 'Depósito Bancário',
  '17': 'PIX',
  '18': 'Transferência Bancária',
  '19': 'Cashback / Fidelidade',
  '20': 'PIX',
  '90': 'Sem Pagamento',
  '99': 'Outros'
}

function extrairFormasPagamento(xml: string, valorFallback: number): any[] {
  const pagamentos: any[] = []
  const detPags = xml.match(/<detPag[^>]*>[\s\S]*?<\/detPag>/g) || []

  if (detPags.length === 0) {
    const tPagM = xml.match(/<tPag>(\d+)<\/tPag>/)
    const vPagM = xml.match(/<vPag>([\d.]+)<\/vPag>/)
    if (tPagM || vPagM) {
      const cod = tPagM ? tPagM[1].padStart(2, '0') : '99'
      const valor = vPagM ? parseFloat(vPagM[1]) : Number(valorFallback || 0)
      pagamentos.push({ codigo: cod, nome: tPagNames[cod] || 'Outros', valor })
    }
  } else {
    for (const dp of detPags) {
      const tPagM = dp.match(/<tPag>(\d+)<\/tPag>/)
      const vPagM = dp.match(/<vPag>([\d.]+)<\/vPag>/)
      const cod = tPagM ? tPagM[1].padStart(2, '0') : '99'
      const valor = vPagM ? parseFloat(vPagM[1]) : 0
      pagamentos.push({ codigo: cod, nome: tPagNames[cod] || 'Outros', valor })
    }
  }

  if (pagamentos.length === 0 && valorFallback > 0) {
    pagamentos.push({ codigo: '99', nome: 'Outros', valor: Number(valorFallback) })
  }

  return pagamentos
}

async function processarNotaIndividual({
  supabaseAdmin,
  cliente,
  pfxBuffer,
  chaveRaw
}: {
  supabaseAdmin: any
  cliente: any
  pfxBuffer: Buffer | null
  chaveRaw: string
}) {
  const chave = limparChaveAcesso(chaveRaw)
  if (!chave || chave.length !== 44) {
    return {
      chave: chaveRaw,
      success: false,
      status: 'erro',
      motivo: 'Chave de acesso com tamanho inválido (deve ter 44 dígitos).'
    }
  }

  // 1. Busca a nota em dfe_notas_destinadas
  const { data: dfeNota } = await supabaseAdmin
    .from('dfe_notas_destinadas')
    .select('*')
    .eq('cliente_id', cliente.id)
    .eq('chave', chave)
    .maybeSingle()

  // 2. Verifica se a nota já foi manifestada ou se precisa de Ciência
  let manifestadoAgora = false
  let statusManifestacao = dfeNota?.manifestacao_status || 'SEM_MANIFESTACAO'
  let xmlCompleto: string | null = dfeNota?.xml_completo || null
  let protocolo: string | null = dfeNota?.protocolo || null

  const precisaManifestar = !statusManifestacao || statusManifestacao === 'SEM_MANIFESTACAO'

  if (precisaManifestar && pfxBuffer && cliente.certificado_senha) {
    try {
      const resManifest = await manifestarDestinatarioSefaz({
        cnpj: cliente.cnpj,
        uf: cliente.uf || 'MG',
        pfxBuffer,
        passphrase: cliente.certificado_senha,
        chave,
        tpEvento: '210210' // Ciência da Emissão
      })

      if (resManifest.success) {
        manifestadoAgora = true
        statusManifestacao = 'CIENCIA'
        if (resManifest.nProt) protocolo = resManifest.nProt
        if (resManifest.xmlCompleto) xmlCompleto = resManifest.xmlCompleto
      }
    } catch (manErr: any) {
      console.warn(`Aviso ao manifestar ${chave}:`, manErr?.message)
    }
  }

  // Se já está manifestada ou foi manifestada agora, mas ainda não tem xml_completo, tenta consultar por chave
  if (!xmlCompleto && pfxBuffer && cliente.certificado_senha) {
    try {
      const resBusca = await consultarSefazPorChave({
        cnpj: cliente.cnpj,
        uf: cliente.uf || 'MG',
        pfxBuffer,
        passphrase: cliente.certificado_senha,
        chave
      })
      if (resBusca.xmlCompleto) {
        xmlCompleto = resBusca.xmlCompleto
      }
    } catch (buscaErr: any) {
      console.warn(`Aviso ao consultar XML por chave ${chave}:`, buscaErr?.message)
    }
  }

  // Se ainda assim não obteve o XML físico completo, usa o resumo canônico
  if (!xmlCompleto) {
    xmlCompleto = gerarXmlResumoDfe({
      chave,
      numero: dfeNota?.numero,
      serie: dfeNota?.serie,
      emitente_cnpj: dfeNota?.emitente_cnpj,
      emitente_nome: dfeNota?.emitente_nome,
      emitente_ie: dfeNota?.emitente_ie,
      destinatario_cnpj: cliente.cnpj,
      valor: dfeNota?.valor,
      data_emissao: dfeNota?.data_emissao,
      protocolo: protocolo || dfeNota?.protocolo,
      situacao_nfe: dfeNota?.situacao_nfe
    })
  }

  // 3. Extrair dados fiscais do XML
  const emitMatch = xmlCompleto.match(/<emit[^>]*>([\s\S]*?)<\/emit>/)
  const emitXml = emitMatch ? emitMatch[1] : ''
  const cnpjEmitente = extractTag(emitXml, 'CNPJ') || extractTag(emitXml, 'CPF') || dfeNota?.emitente_cnpj || chave.substring(6, 20)
  const xNomeEmitente = extractTag(emitXml, 'xNome') || dfeNota?.emitente_nome || 'FORNECEDOR'
  const ieEmitente = extractTag(emitXml, 'IE') || dfeNota?.emitente_ie

  let numero = extractTag(xmlCompleto, 'nNF') || dfeNota?.numero || String(parseInt(chave.substring(25, 34), 10) || 1)
  let serie = extractTag(xmlCompleto, 'serie') || dfeNota?.serie || String(parseInt(chave.substring(22, 25), 10) || 1)
  let valorStr = extractTag(xmlCompleto, 'vNF')
  let valor = valorStr ? parseFloat(valorStr) : (dfeNota?.valor || 0)

  let emissao = extractTag(xmlCompleto, 'dhEmi') || extractTag(xmlCompleto, 'dEmi') || dfeNota?.data_emissao || new Date().toISOString()
  let transmissao = extractTag(xmlCompleto, 'dhRecbto') || emissao
  let temAssinatura = xmlCompleto.includes('<Signature')
  let cStat = extractTag(xmlCompleto, 'cStat') || '100'
  let xMotivo = extractTag(xmlCompleto, 'xMotivo') || 'Autorizado o uso da NF-e'
  let nProt = extractTag(xmlCompleto, 'nProt') || protocolo || ('1' + chave.substring(2, 16))

  const valorMonofasico = calculateMonofasico(xmlCompleto)
  const formasPagamento = extrairFormasPagamento(xmlCompleto, valor)

  // 4. Salvar arquivo XML no Supabase Storage (Bucket: xmls)
  let ano = String(new Date().getFullYear())
  let mes = String(new Date().getMonth() + 1).padStart(2, '0')
  let dia = String(new Date().getDate()).padStart(2, '0')

  if (emissao) {
    const match = emissao.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (match) {
      ano = match[1]
      mes = match[2]
      dia = match[3]
    }
  }

  const filePath = `${cliente.id}/nfe_entradas/${ano}/${mes}/${dia}/${chave}.xml`
  const xmlBuffer = Buffer.from(xmlCompleto, 'utf-8')

  const { error: uploadError } = await supabaseAdmin.storage
    .from('xmls')
    .upload(filePath, xmlBuffer, {
      contentType: 'application/xml',
      upsert: true
    })

  if (uploadError) {
    console.warn(`Aviso de upload no Storage para ${chave}:`, uploadError.message)
  }

  // 5. Inserir/Atualizar na tabela nfe_entradas (Guia Entrada de Notas Fiscais)
  const dbPayload: any = {
    cliente_id: cliente.id,
    numero: numero || null,
    serie: serie || null,
    chave: chave,
    valor: valor || 0,
    data_emissao: emissao || null,
    data_transmissao: transmissao || null,
    tem_assinatura: temAssinatura,
    storage_path: filePath,
    is_autorizada: true,
    valor_monofasico: valorMonofasico || 0,
    cnpj_emitente: cnpjEmitente || null,
    cnpj_divergente: false,
    motivo_divergencia: null,
    cstat: cStat,
    motivo_sefaz: xMotivo,
    protocolo: nProt,
    formas_pagamento: formasPagamento
  }

  const { error: dbError } = await supabaseAdmin
    .from('nfe_entradas')
    .upsert(dbPayload, { onConflict: 'chave' })

  if (dbError) {
    console.warn('Erro ao inserir colunas extras em nfe_entradas, tentando payload básico:', dbError.message)
    const fallbackPayload = {
      cliente_id: cliente.id,
      numero: numero || null,
      chave: chave,
      valor: valor || 0,
      data_emissao: emissao || null,
      data_transmissao: transmissao || null,
      tem_assinatura: temAssinatura,
      is_autorizada: true,
      storage_path: filePath
    }
    await supabaseAdmin.from('nfe_entradas').upsert(fallbackPayload, { onConflict: 'chave' })
  }

  // 6. Atualiza dfe_notas_destinadas para refletir ciência e xml completo
  const updateDfePayload: Record<string, any> = {
    manifestacao_status: statusManifestacao === 'SEM_MANIFESTACAO' ? 'CIENCIA' : statusManifestacao,
    tem_xml: true,
    storage_path: filePath,
    updated_at: new Date().toISOString()
  }
  if (protocolo) updateDfePayload.protocolo = protocolo
  if (xmlCompleto) updateDfePayload.xml_completo = xmlCompleto

  await supabaseAdmin
    .from('dfe_notas_destinadas')
    .update(updateDfePayload)
    .eq('cliente_id', cliente.id)
    .eq('chave', chave)

  return {
    chave,
    numero,
    serie,
    fornecedor: xNomeEmitente,
    cnpjEmitente,
    valor,
    valorMonofasico,
    manifestado: manifestadoAgora,
    success: true,
    status: 'sucesso',
    motivo: manifestadoAgora 
      ? 'Ciência registrada na SEFAZ e importada para Entradas' 
      : 'XML obtido e importado com sucesso para Entradas'
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { cliente_id, chave, chaves } = body

    if (!cliente_id) {
      return NextResponse.json({ error: 'Parâmetro cliente_id é obrigatório.' }, { status: 400 })
    }

    const listaChaves: string[] = []
    if (Array.isArray(chaves)) {
      listaChaves.push(...chaves)
    } else if (chave) {
      listaChaves.push(chave)
    }

    if (listaChaves.length === 0) {
      return NextResponse.json({ error: 'Nenhuma chave fornecida para importação ao Hub.' }, { status: 400 })
    }

    const supabaseAdmin = createAdminClient()

    // 1. Busca dados do cliente
    const { data: cliente, error: cliErr } = await supabaseAdmin
      .from('clientes')
      .select('id, razao_social, cnpj, uf, certificado_url, certificado_senha, inscricao_estadual')
      .eq('id', cliente_id)
      .single()

    if (cliErr || !cliente) {
      return NextResponse.json({ error: 'Empresa cliente não encontrada.' }, { status: 404 })
    }

    // 2. Tenta carregar o certificado digital se cadastrado
    let pfxBuffer: Buffer | null = null
    if (cliente.certificado_url && cliente.certificado_senha) {
      try {
        let { data: certBlob } = await supabaseAdmin.storage.from('certificados').download(cliente.certificado_url)
        if (!certBlob) {
          const { data: certBlobXmls } = await supabaseAdmin.storage.from('xmls').download(cliente.certificado_url)
          certBlob = certBlobXmls
        }
        if (certBlob) {
          pfxBuffer = Buffer.from(await certBlob.arrayBuffer())
        }
      } catch (certErr) {
        console.warn('Aviso: Certificado digital não pôde ser carregado:', certErr)
      }
    }

    const resultados: any[] = []
    let totalOk = 0
    let totalManifestadas = 0
    let valorTotalImportado = 0
    let totalMonofasicos = 0

    for (const ch of listaChaves) {
      const res = await processarNotaIndividual({
        supabaseAdmin,
        cliente,
        pfxBuffer,
        chaveRaw: ch
      })

      if (res.success) {
        totalOk++
        if (res.manifestado) totalManifestadas++
        valorTotalImportado += (res.valor || 0)
        totalMonofasicos += (res.valorMonofasico || 0)
      }

      resultados.push(res)
    }

    return NextResponse.json({
      success: totalOk > 0,
      totalProcessadas: listaChaves.length,
      totalSucesso: totalOk,
      totalManifestadas,
      valorTotalImportado: Math.round(valorTotalImportado * 100) / 100,
      totalMonofasicos: Math.round(totalMonofasicos * 100) / 100,
      resultados
    })

  } catch (err: any) {
    console.error('Erro na rota trazer-para-hub:', err)
    return NextResponse.json({
      success: false,
      error: 'Falha ao trazer XMLs para o Hub: ' + (err.message || '')
    }, { status: 500 })
  }
}
