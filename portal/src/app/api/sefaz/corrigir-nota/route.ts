import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { consultarSefazProtocolo, gerarProcNFeFinal } from '@/utils/sefazXmlService'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseAdmin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseKey)

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { nota_id, tabela, manualData } = body

    if (!nota_id || !tabela) {
      return NextResponse.json({ error: 'Parâmetros nota_id e tabela são obrigatórios.' }, { status: 400 })
    }

    if (tabela !== 'nfce_saidas' && tabela !== 'nfe_saidas') {
      return NextResponse.json({ error: 'Tabela inválida: deve ser nfce_saidas ou nfe_saidas.' }, { status: 400 })
    }

    // 1. Busca a nota fiscal
    const { data: nota, error: notaErr } = await supabaseAdmin
      .from(tabela)
      .select('*')
      .eq('id', nota_id)
      .single()

    if (notaErr || !nota) {
      return NextResponse.json({ error: 'Nota fiscal não encontrada: ' + (notaErr?.message || '') }, { status: 404 })
    }

    // 2. Busca o cliente
    const { data: cliente, error: cliErr } = await supabaseAdmin
      .from('clientes')
      .select('id, razao_social, cnpj, certificado_url, certificado_senha')
      .eq('id', nota.cliente_id)
      .single()

    if (cliErr || !cliente) {
      return NextResponse.json({ error: 'Cliente da nota não encontrado.' }, { status: 404 })
    }

    // 3. Baixa o XML original do Storage
    if (!nota.storage_path) {
      return NextResponse.json({ error: 'Nota não possui caminho de armazenamento (storage_path).' }, { status: 400 })
    }

    const { data: fileData, error: fileErr } = await supabaseAdmin
      .storage
      .from('xmls')
      .download(nota.storage_path)

    if (fileErr || !fileData) {
      return NextResponse.json({ error: 'Erro ao baixar arquivo XML original do storage: ' + (fileErr?.message || '') }, { status: 500 })
    }

    const arrayBuffer = await fileData.arrayBuffer()
    const xmlOriginal = Buffer.from(arrayBuffer).toString('utf-8')

    // 4. Baixa o Certificado Digital A1 se cadastrado
    let certBuffer: Buffer | null = null
    if (cliente.certificado_url) {
      let { data: certBlob } = await supabaseAdmin
        .storage
        .from('certificados')
        .download(cliente.certificado_url)

      if (!certBlob) {
        const { data: certBlobXmls } = await supabaseAdmin
          .storage
          .from('xmls')
          .download(cliente.certificado_url)
        certBlob = certBlobXmls
      }

      if (certBlob) {
        const ab = await certBlob.arrayBuffer()
        certBuffer = Buffer.from(ab)
      }
    }

    // === CASO A: Correção Manual Informada pelo Usuário ===
    if (manualData) {
      if (!manualData.nProt || !manualData.dhRecbto) {
        return NextResponse.json({ error: 'Protocolo e Data/Hora de recebimento são obrigatórios para correção manual.' }, { status: 400 })
      }

      if (!xmlOriginal.includes('<Signature') && !certBuffer) {
        return NextResponse.json({ error: 'Este XML não está assinado digitalmente e o cliente não possui certificado cadastrado no Portal para assinar.' }, { status: 400 })
      }

      const xmlCorrigido = gerarProcNFeFinal(
        xmlOriginal,
        certBuffer,
        cliente.certificado_senha || '',
        manualData,
        nota.chave
      )

      // Atualiza o arquivo no Storage com o XML oficial corrigido
      await supabaseAdmin
        .storage
        .from('xmls')
        .upload(nota.storage_path, Buffer.from(xmlCorrigido, 'utf-8'), {
          contentType: 'application/xml',
          upsert: true
        })

      // Atualiza o registro no Banco
      await supabaseAdmin.from(tabela).update({
        is_autorizada: true,
        tem_assinatura: true,
        protocolo: manualData.nProt,
        cstat: manualData.cStat || '100',
        motivo_sefaz: manualData.xMotivo || 'Autorizado o uso da NF-e',
        status_correcao: 'corrigido_manualmente'
      }).eq('id', nota.id)

      return NextResponse.json({
        success: true,
        tipo: 'manual',
        message: 'Arquivo assinado e protocolo anexado com sucesso!'
      })
    }

    // === CASO B: Consulta e Correção Automática via SEFAZ ===
    if (!certBuffer) {
      return NextResponse.json({ 
        error: `O cliente "${cliente.razao_social}" não possui certificado digital A1 (.pfx) cadastrado no Portal. Faça o upload do certificado no cadastro da empresa para habilitar a consulta automática à SEFAZ.` 
      }, { status: 400 })
    }

    const sefazRes = await consultarSefazProtocolo(
      nota.chave,
      certBuffer,
      cliente.certificado_senha || ''
    )

    if (!sefazRes.success || sefazRes.cStat !== '100') {
      // Registra a resposta da SEFAZ
      await supabaseAdmin.from(tabela).update({
        cstat: sefazRes.cStat,
        motivo_sefaz: sefazRes.xMotivo,
        status_correcao: `sefaz_${sefazRes.cStat}: ${sefazRes.xMotivo}`
      }).eq('id', nota.id)

      return NextResponse.json({
        success: false,
        cStat: sefazRes.cStat,
        xMotivo: sefazRes.xMotivo,
        error: `SEFAZ retornou Status ${sefazRes.cStat}: ${sefazRes.xMotivo}`
      }, { status: 422 })
    }

    // SEFAZ autorizou (cStat 100) -> Gera o XML completo com assinatura e protocolo!
    const dadosProtocolo = {
      nProt: sefazRes.nProt || '',
      dhRecbto: sefazRes.dhRecbto || new Date().toISOString(),
      digVal: sefazRes.digVal,
      verAplic: sefazRes.verAplic || 'W-1.5.0',
      cStat: '100',
      xMotivo: sefazRes.xMotivo || 'Autorizado o uso da NF-e'
    }

    const xmlOficial = gerarProcNFeFinal(
      xmlOriginal,
      certBuffer,
      cliente.certificado_senha || '',
      dadosProtocolo,
      nota.chave
    )

    // Sobrescreve no Storage
    await supabaseAdmin
      .storage
      .from('xmls')
      .upload(nota.storage_path, Buffer.from(xmlOficial, 'utf-8'), {
        contentType: 'application/xml',
        upsert: true
      })

    // Atualiza no banco
    await supabaseAdmin.from(tabela).update({
      is_autorizada: true,
      tem_assinatura: true,
      protocolo: sefazRes.nProt,
      cstat: '100',
      motivo_sefaz: sefazRes.xMotivo,
      status_correcao: 'corrigido_sefaz'
    }).eq('id', nota.id)

    return NextResponse.json({
      success: true,
      tipo: 'sefaz',
      nProt: sefazRes.nProt,
      dhRecbto: sefazRes.dhRecbto,
      message: `Nota autorizada confirmada pela SEFAZ! Protocolo: ${sefazRes.nProt}`
    })

  } catch (error: any) {
    console.error('Erro na correção de nota:', error)
    return NextResponse.json({ error: error.message || 'Erro interno na correção da nota' }, { status: 500 })
  }
}
