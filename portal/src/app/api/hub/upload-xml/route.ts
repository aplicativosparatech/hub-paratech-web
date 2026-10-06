import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
// Usaremos a Service Role Key para inserir no banco com segurança na API
const supabaseAdmin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseKey)

function extractTag(xml: string, tag: string) {
  const regex = new RegExp(`<${tag}[^>]*>(.*?)</${tag}>`)
  const match = xml.match(regex)
  return match ? match[1] : null
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

    // 1. Validar Cliente
    const { data: cliente } = await supabaseAdmin.from('clientes').select('id, is_ativo').eq('hub_token', token).single()
    if (!cliente) return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
    if (!cliente.is_ativo) return NextResponse.json({ error: 'Cliente bloqueado/inativo' }, { status: 403 })

    // 2. Extrair dados do XML
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const xmlString = buffer.toString('utf-8')

    const mod = extractTag(xmlString, 'mod')
    const numero = extractTag(xmlString, 'nNF')
    const chave = extractTag(xmlString, 'chNFe')
    const valor = extractTag(xmlString, 'vNF')
    const emissao = extractTag(xmlString, 'dhEmi') || extractTag(xmlString, 'dEmi')
    const transmissao = extractTag(xmlString, 'dhRecbto')
    const temAssinatura = xmlString.includes('<Signature')

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

    // 3. Upload para o Supabase Storage (Bucket: xmls)
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

    // 4. Inserir no Banco de Dados
    const dbPayload = {
      cliente_id: cliente.id,
      numero: numero || null,
      chave: chave,
      valor: valor ? parseFloat(valor) : 0,
      data_emissao: emissao || null,
      data_transmissao: transmissao || null,
      tem_assinatura: temAssinatura,
      storage_path: filePath
    }

    const { error: dbError } = await supabaseAdmin.from(tabela).upsert(dbPayload, { onConflict: 'chave' })

    if (dbError) {
      return NextResponse.json({ error: 'Erro no Banco de Dados: ' + dbError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, tabela, chave })

  } catch (error: any) {
    console.error('Upload Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
