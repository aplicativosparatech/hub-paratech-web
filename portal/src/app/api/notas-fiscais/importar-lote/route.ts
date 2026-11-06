import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'

function extractTag(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([^<]+)<\/${tag}>`, 'i'))
  return match ? match[1].trim() : null
}

function calculateMonofasico(xmlString: string): number {
  try {
    const itensMatches = xmlString.matchAll(/<det\b[^>]*>([\s\S]*?)<\/det>/gi)
    let totalMonofasico = 0

    for (const itemMatch of itensMatches) {
      const itemXml = itemMatch[1]
      const cst = extractTag(itemXml, 'CST')
      const csosn = extractTag(itemXml, 'CSOSN')

      // CST 04 (Monofásico) ou 06 (Alíquota Zero) ou CSOSN correspondente
      const isMonofasico = (cst === '04' || cst === '06' || csosn === '400' || csosn === '500')
      if (isMonofasico) {
        const vProd = extractTag(itemXml, 'vProd')
        if (vProd) {
          totalMonofasico += parseFloat(vProd) || 0
        }
      }
    }
    return totalMonofasico
  } catch {
    return 0
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const clienteId = formData.get('cliente_id') as string

    if (!clienteId) {
      return NextResponse.json({ error: 'Parâmetro cliente_id é obrigatório.' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // 1. Busca os dados cadastrais do cliente
    const { data: cliente, error: cliErr } = await supabase
      .from('clientes')
      .select('id, razao_social, cnpj, cpf')
      .eq('id', clienteId)
      .single()

    if (cliErr || !cliente) {
      return NextResponse.json({ error: 'Cliente não encontrado no portal.' }, { status: 404 })
    }

    const cleanClienteCnpj = (cliente.cnpj || cliente.cpf || '').replace(/\D/g, '')

    // Coleta todos os arquivos enviados
    const files = formData.getAll('files') as File[]
    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'Nenhum arquivo XML foi enviado.' }, { status: 400 })
    }

    const resumo = {
      total: files.length,
      saidasNfe: 0,
      saidasNfce: 0,
      entradas: 0,
      quarentena: 0,
      duplicados: 0,
      erros: 0
    }

    const detalhes: Array<{
      arquivo: string
      numero?: string
      modelo?: string
      chave?: string
      status: string
      motivo?: string
    }> = []

    for (const file of files) {
      const fileName = file.name
      try {
        if (!fileName.toLowerCase().endsWith('.xml')) {
          resumo.erros++
          detalhes.push({ arquivo: fileName, status: 'erro', motivo: 'Arquivo ignorado (não possui extensão .xml)' })
          continue
        }

        const buffer = Buffer.from(await file.arrayBuffer())
        const xmlString = buffer.toString('utf-8')

        if (xmlString.length < 50 || !xmlString.includes('<infNFe')) {
          resumo.erros++
          detalhes.push({ arquivo: fileName, status: 'erro', motivo: 'Conteúdo XML inválido (tag <infNFe> não encontrada)' })
          continue
        }

        // Extrai metadados do XML
        let chave = extractTag(xmlString, 'chNFe')
        if (!chave) {
          const idMatch = xmlString.match(/<infNFe[^>]+Id=["'](NFe)?(\d{44})["']/i)
          if (idMatch) chave = idMatch[2]
        }

        const mod = extractTag(xmlString, 'mod')
        const numero = extractTag(xmlString, 'nNF')
        const serie = extractTag(xmlString, 'serie') || '1'
        let emissao = extractTag(xmlString, 'dhEmi') || extractTag(xmlString, 'dEmi')
        const valorStr = extractTag(xmlString, 'vNF')
        const valor = valorStr ? parseFloat(valorStr) : 0

        const cnpjEmitente = (extractTag(xmlString, 'emit') ? extractTag(xmlString, 'CNPJ') : null) || ''
        const emitenteNome = extractTag(xmlString, 'xNome')

        // Destinatário
        const destMatch = xmlString.match(/<dest\b[^>]*>([\s\S]*?)<\/dest>/i)
        const destXml = destMatch ? destMatch[1] : ''
        const cnpjDestinatario = extractTag(destXml, 'CNPJ') || extractTag(destXml, 'CPF')
        const destinatarioNome = extractTag(destXml, 'xNome')

        // Valida chave e modelo
        if (!chave || chave.length !== 44 || !mod) {
          resumo.erros++
          detalhes.push({ arquivo: fileName, status: 'erro', motivo: 'Não foi possível extrair a chave de 44 dígitos ou o modelo da nota' })
          continue
        }

        // Tags SEFAZ e Assinatura
        const nProt = extractTag(xmlString, 'nProt')
        const cStat = extractTag(xmlString, 'cStat')
        const xMotivo = extractTag(xmlString, 'xMotivo')
        const transmissao = extractTag(xmlString, 'dhRecbto')
        const temAssinatura = xmlString.includes('<Signature')
        const isAutorizada = Boolean(nProt && (cStat === '100' || xmlString.includes('<cStat>100</cStat>')))

        // Identifica o Fluxo: Entrada vs Saída
        const cleanEmitente = cnpjEmitente.replace(/\D/g, '')
        const cleanDest = (cnpjDestinatario || '').replace(/\D/g, '')

        let tipoFluxo: 'saidas' | 'entradas' = 'saidas'
        if (cleanDest === cleanClienteCnpj && cleanEmitente !== cleanClienteCnpj) {
          tipoFluxo = 'entradas'
        }

        let tabelaDestino = ''
        if (tipoFluxo === 'entradas') {
          tabelaDestino = 'nfe_entradas'
        } else {
          tabelaDestino = mod === '65' ? 'nfce_saidas' : 'nfe_saidas'
        }

        // 2. Checagem de Anti-Duplicidade
        const { data: notaExistente } = await supabase
          .from(tabelaDestino)
          .select('id, chave, is_autorizada, protocolo')
          .eq('cliente_id', clienteId)
          .eq('chave', chave)
          .maybeSingle()

        if (notaExistente && notaExistente.is_autorizada) {
          resumo.duplicados++
          detalhes.push({
            arquivo: fileName,
            numero: numero || undefined,
            modelo: mod,
            chave,
            status: 'duplicado',
            motivo: `Nota já existente e autorizada no Portal (Protocolo: ${notaExistente.protocolo || 'SEFAZ'})`
          })
          continue
        }

        // 3. Salva no Storage do Supabase estruturado por Ano/Mês/Dia
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
        } else if (chave.length === 44) {
          ano = '20' + chave.substring(2, 4)
          mes = chave.substring(4, 6)
          dia = '01'
        }

        const storagePath = `${clienteId}/${tabelaDestino}/${ano}/${mes}/${dia}/${file.name}`

        await supabase.storage.from('xmls').upload(storagePath, buffer, {
          contentType: 'application/xml',
          upsert: true
        })

        // 4. Monta o payload do banco de dados
        const valorMonofasico = calculateMonofasico(xmlString)
        let statusCorrecao: string | null = null
        if (!isAutorizada || !temAssinatura) {
          statusCorrecao = !temAssinatura ? 'sem_assinatura' : 'sem_protocolo'
        }

        const dbPayload: any = {
          cliente_id: clienteId,
          numero: numero || null,
          serie: serie || '1',
          chave: chave,
          valor: valor,
          data_emissao: emissao || null,
          data_transmissao: transmissao || null,
          tem_assinatura: temAssinatura,
          storage_path: storagePath,
          is_autorizada: isAutorizada,
          valor_monofasico: valorMonofasico,
          cnpj_emitente: cleanEmitente || null,
          cnpj_destinatario: cleanDest || null,
          destinatario_nome: destinatarioNome || (tipoFluxo === 'saidas' && mod === '65' ? 'Consumidor Final' : null),
          destinatario_documento: cleanDest || null,
          emitente_nome: emitenteNome || null,
          protocolo: nProt || null,
          cstat: cStat || (isAutorizada ? '100' : null),
          motivo_sefaz: xMotivo || (isAutorizada ? 'Autorizado o uso da NF-e' : 'Aguardando protocolo SEFAZ'),
          status_correcao: statusCorrecao
        }

        if (notaExistente) {
          // Atualiza nota incompleta existente com o novo XML
          await supabase.from(tabelaDestino).update(dbPayload).eq('id', notaExistente.id)
        } else {
          // Insere nova nota
          await supabase.from(tabelaDestino).insert([dbPayload])
        }

        // Contabiliza nos totais do relatório
        if (!isAutorizada || !temAssinatura) {
          resumo.quarentena++
          detalhes.push({
            arquivo: fileName,
            numero: numero || undefined,
            modelo: mod,
            chave,
            status: 'quarentena',
            motivo: !temAssinatura ? 'Enviado para Quarentena (Sem Assinatura Digital)' : 'Enviado para Quarentena (Sem Protocolo SEFAZ)'
          })
        } else if (tipoFluxo === 'entradas') {
          resumo.entradas++
          detalhes.push({
            arquivo: fileName,
            numero: numero || undefined,
            modelo: mod,
            chave,
            status: 'adicionado_entradas',
            motivo: 'Adicionado com sucesso em Compras (NF-e Entradas)'
          })
        } else if (mod === '65') {
          resumo.saidasNfce++
          detalhes.push({
            arquivo: fileName,
            numero: numero || undefined,
            modelo: mod,
            chave,
            status: 'adicionado_nfce_saidas',
            motivo: 'Adicionado com sucesso em NFC-e Saídas (Mod 65)'
          })
        } else {
          resumo.saidasNfe++
          detalhes.push({
            arquivo: fileName,
            numero: numero || undefined,
            modelo: mod,
            chave,
            status: 'adicionado_nfe_saidas',
            motivo: 'Adicionado com sucesso em NF-e Saídas (Mod 55)'
          })
        }

      } catch (errFile: any) {
        resumo.erros++
        detalhes.push({
          arquivo: fileName,
          status: 'erro',
          motivo: errFile.message || 'Falha ao processar arquivo'
        })
      }
    }

    return NextResponse.json({
      success: true,
      cliente: {
        id: cliente.id,
        razao_social: cliente.razao_social
      },
      resumo,
      detalhes
    })

  } catch (err: any) {
    console.error('Erro ao importar lote de XMLs:', err)
    return NextResponse.json({ error: err.message || 'Erro interno ao importar XMLs' }, { status: 500 })
  }
}
