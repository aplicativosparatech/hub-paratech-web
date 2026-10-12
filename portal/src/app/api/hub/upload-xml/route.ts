import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseAdmin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseKey)

function extractTag(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`)
  const match = xml.match(regex)
  return match ? match[1].trim() : null
}

function calculateMonofasico(xml: string): number {
  let totalMonofasico = 0
  // Pega cada bloco de item <det nItem="...">...</det>
  const detRegex = /<det[^>]*>([\s\S]*?)<\/det>/g
  let match: RegExpExecArray | null

  while ((match = detRegex.exec(xml)) !== null) {
    const itemXml = match[1]
    
    // Verifica se possui CST 04 (Monofásico) ou 06 (Alíquota Zero) no PIS ou COFINS
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

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const token = formData.get('hub_token') as string
    const tipoPasta = formData.get('tipo_pasta') as string // 'vendas' ou 'compras'
    const file = formData.get('xml_file') as File

    if (!token || !file || !tipoPasta) {
      return NextResponse.json({ error: 'Faltam dados (token, tipo_pasta ou xml_file)' }, { status: 400 })
    }

    // 1. Validar Cliente e configurações
    const { data: cliente } = await supabaseAdmin
      .from('clientes')
      .select('id, cnpj, razao_social, inscricao_estadual, is_ativo, configuracoes_hub(auto_excluir_divergentes)')
      .eq('hub_token', token)
      .single()

    if (!cliente) return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
    if (!cliente.is_ativo) return NextResponse.json({ error: 'Cliente bloqueado/inativo' }, { status: 403 })

    // 2. Extrair dados do XML
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const xmlString = buffer.toString('utf-8')

    // Extrair emitente (<emit>)
    const emitMatch = xmlString.match(/<emit[^>]*>([\s\S]*?)<\/emit>/)
    const emitXml = emitMatch ? emitMatch[1] : ''
    const cnpjEmitente = extractTag(emitXml, 'CNPJ') || extractTag(emitXml, 'CPF')
    const xNomeEmitente = extractTag(emitXml, 'xNome')
    const ieEmitente = extractTag(emitXml, 'IE')

    // Limpar caracteres não-numéricos para comparação precisa
    const cleanClienteDoc = (cliente.cnpj || '').replace(/\D/g, '')
    const cleanEmitDoc = (cnpjEmitente || '').replace(/\D/g, '')
    const cleanClienteIE = (cliente.inscricao_estadual || '').replace(/\D/g, '')
    const cleanEmitIE = (ieEmitente || '').replace(/\D/g, '')

    // Se for pasta de vendas, o emitente (<emit>) DEVE ser estritamente a empresa do cliente cadastrado
    let isCnpjDivergente = false
    let motivoDivergencia = ''

    if (tipoPasta === 'vendas') {
      if (!cleanEmitDoc) {
        isCnpjDivergente = true
        motivoDivergencia = 'Tag <emit> do XML não contém CNPJ ou CPF válido.'
      } else if (cleanClienteDoc && cleanEmitDoc !== cleanClienteDoc) {
        isCnpjDivergente = true
        motivoDivergencia = `Emitente (${cnpjEmitente || 'Desconhecido'}${xNomeEmitente ? ' - ' + xNomeEmitente : ''}) não pertence à empresa (${cliente.cnpj} - ${cliente.razao_social || ''}).`
      } else if (cleanClienteIE && cleanEmitIE && cleanClienteIE !== cleanEmitIE && cleanEmitIE.toUpperCase() !== 'ISENTO') {
        isCnpjDivergente = true
        motivoDivergencia = `Inscrição Estadual do emitente (${ieEmitente}) diverge da cadastrada no sistema (${cliente.inscricao_estadual}).`
      }
    }

    // Se a opção de auto-excluir estiver ativada nas configurações e for divergente
    const hubConfig = Array.isArray(cliente.configuracoes_hub) ? cliente.configuracoes_hub[0] : cliente.configuracoes_hub
    if (isCnpjDivergente && hubConfig?.auto_excluir_divergentes) {
      return NextResponse.json({ 
        ignored: true, 
        deleted: true,
        reason: 'XML excluído: ' + motivoDivergencia + ' (Auto-exclusão ativada nas configurações do Portal)' 
      }, { status: 200 })
    }

    const mod = extractTag(xmlString, 'mod')
    const serie = extractTag(xmlString, 'serie')
    const numero = extractTag(xmlString, 'nNF')
    const chave = extractTag(xmlString, 'chNFe')
    const valor = extractTag(xmlString, 'vNF')
    const emissao = extractTag(xmlString, 'dhEmi') || extractTag(xmlString, 'dEmi')
    const transmissao = extractTag(xmlString, 'dhRecbto')
    const temAssinatura = xmlString.includes('<Signature')

    // Tags de Autorização SEFAZ (<protNFe>)
    const cStat = extractTag(xmlString, 'cStat')
    const xMotivo = extractTag(xmlString, 'xMotivo')
    const nProt = extractTag(xmlString, 'nProt')

    // Nota considerada oficialmente autorizada pela SEFAZ
    const isAutorizada = (cStat === '100' || xmlString.includes('Autorizado o uso da NF-e') || xmlString.includes('Autorizado o uso da NFC-e')) && temAssinatura

    // Cálculo dos Produtos Monofásicos (CST 04 / 06)
    const valorMonofasico = calculateMonofasico(xmlString)

    if (!chave || !mod) {
      return NextResponse.json({ error: 'XML inválido: não encontrou tag mod ou chNFe' }, { status: 400 })
    }

    // Identificar a Tabela Destino
    let tabela = ''
    if (tipoPasta === 'compras') {
      tabela = 'nfe_entradas'
    } else {
      // Vendas
      if (mod === '65') tabela = 'nfce_saidas'
      else if (mod === '55') tabela = 'nfe_saidas'
      else return NextResponse.json({ error: 'Modelo de nota não suportado: ' + mod }, { status: 400 })
    }

    // 3. Upload para o Supabase Storage (Bucket: xmls) estruturado por Ano/Mês
    const dataEmissaoObj = emissao ? new Date(emissao) : new Date()
    const ano = dataEmissaoObj.getFullYear()
    const mes = String(dataEmissaoObj.getMonth() + 1).padStart(2, '0')
    const dia = String(dataEmissaoObj.getDate()).padStart(2, '0')
    
    const filePath = `${cliente.id}/${tabela}/${ano}/${mes}/${dia}/${file.name}`
    
    const { error: uploadError } = await supabaseAdmin.storage.from('xmls').upload(filePath, buffer, {
      contentType: 'application/xml',
      upsert: true
    })

    if (uploadError) {
      return NextResponse.json({ error: 'Erro no Storage: ' + uploadError.message }, { status: 500 })
    }

    // 4. Inserir no Banco de Dados com metadados para relatórios
    const dbPayload: any = {
      cliente_id: cliente.id,
      numero: numero || null,
      chave: chave,
      valor: valor ? parseFloat(valor) : 0,
      data_emissao: emissao || null,
      data_transmissao: transmissao || null,
      tem_assinatura: temAssinatura,
      storage_path: filePath,
      cnpj_emitente: cnpjEmitente || null,
      cnpj_divergente: isCnpjDivergente,
      motivo_divergencia: isCnpjDivergente ? motivoDivergencia : null
    }

    // Adiciona colunas extras se existirem na tabela
    if (serie) dbPayload.serie = serie
    if (cStat) dbPayload.cstat = cStat
    if (xMotivo) dbPayload.motivo_sefaz = xMotivo
    if (nProt) dbPayload.protocolo = nProt
    dbPayload.is_autorizada = isAutorizada
    dbPayload.valor_monofasico = valorMonofasico

    const { error: dbError } = await supabaseAdmin.from(tabela).upsert(dbPayload, { onConflict: 'chave' })

    if (dbError) {
      // Se falhar por causa de colunas novas ainda não criadas, faz fallback para o payload básico
      console.warn('Erro ao inserir colunas extras, tentando payload básico:', dbError.message)
      const fallbackPayload = {
        cliente_id: cliente.id,
        numero: numero || null,
        chave: chave,
        valor: valor ? parseFloat(valor) : 0,
        data_emissao: emissao || null,
        data_transmissao: transmissao || null,
        tem_assinatura: temAssinatura,
        storage_path: filePath
      }
      await supabaseAdmin.from(tabela).upsert(fallbackPayload, { onConflict: 'chave' })
    }

    return NextResponse.json({ 
      success: true, 
      tabela, 
      chave, 
      serie, 
      numero, 
      isAutorizada, 
      valorMonofasico 
    })

  } catch (error: any) {
    console.error('Upload Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
