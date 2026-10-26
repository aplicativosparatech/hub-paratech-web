import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { manifestarDestinatarioSefaz } from '@/utils/sefazDfeService'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { cliente_id, chaves, chave, tipo_evento } = body

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
      return NextResponse.json({ error: 'Nenhuma chave de nota fiscal fornecida para manifestação.' }, { status: 400 })
    }

    const supabaseAdmin = createAdminClient()

    // 1. Busca dados do cliente e certificado digital A1
    const { data: cliente, error: cliErr } = await supabaseAdmin
      .from('clientes')
      .select('id, razao_social, cnpj, uf, certificado_url, certificado_senha')
      .eq('id', cliente_id)
      .single()

    if (cliErr || !cliente) {
      return NextResponse.json({ error: 'Empresa cliente não encontrada.' }, { status: 404 })
    }

    if (!cliente.certificado_url || !cliente.certificado_senha) {
      return NextResponse.json({
        error: 'A empresa não possui Certificado Digital A1 (.pfx) cadastrado. A manifestação na SEFAZ exige assinatura com certificado ICP-Brasil.'
      }, { status: 400 })
    }

    // 2. Baixa o certificado digital
    let { data: certBlob } = await supabaseAdmin.storage.from('certificados').download(cliente.certificado_url)
    if (!certBlob) {
      const { data: certBlobXmls } = await supabaseAdmin.storage.from('xmls').download(cliente.certificado_url)
      certBlob = certBlobXmls
    }

    if (!certBlob) {
      return NextResponse.json({ error: 'Arquivo do certificado digital não encontrado no armazenamento seguro.' }, { status: 404 })
    }

    const pfxBuffer = Buffer.from(await certBlob.arrayBuffer())
    const tpEvento = tipo_evento === '210200' ? '210200' : '210210'

    const resultados: Array<{
      chave: string
      success: boolean
      cStat: string
      xMotivo: string
      teveXml: boolean
      xmlCompleto?: string
    }> = []

    let totalOk = 0
    let totalComXml = 0

    // 3. Processa cada chave
    for (const ch of listaChaves) {
      try {
        const res = await manifestarDestinatarioSefaz({
          cnpj: cliente.cnpj,
          uf: cliente.uf || 'MG',
          pfxBuffer,
          passphrase: cliente.certificado_senha,
          chave: ch,
          tpEvento
        })

        const statusManifestacao = tpEvento === '210200' ? 'CONFIRMADA' : 'CIENCIA'

        // Atualiza no banco de dados a situação da nota
        const updatePayload: Record<string, any> = {
          manifestacao_status: statusManifestacao,
          updated_at: new Date().toISOString()
        }

        if (res.nProt) {
          updatePayload.protocolo = res.nProt
        }

        if (res.xmlCompleto) {
          updatePayload.xml_completo = res.xmlCompleto
          totalComXml++
        }

        await supabaseAdmin
          .from('dfe_notas_destinadas')
          .update(updatePayload)
          .eq('cliente_id', cliente.id)
          .eq('chave', ch)

        if (res.success) {
          totalOk++
        }

        resultados.push({
          chave: ch,
          success: res.success,
          cStat: res.cStat,
          xMotivo: res.xMotivo,
          teveXml: Boolean(res.xmlCompleto),
          xmlCompleto: res.xmlCompleto || undefined
        })
      } catch (itemErr: any) {
        resultados.push({
          chave: ch,
          success: false,
          cStat: 'ERRO',
          xMotivo: itemErr.message || 'Erro ao processar',
          teveXml: false
        })
      }
    }

    return NextResponse.json({
      success: totalOk > 0,
      totalProcessadas: listaChaves.length,
      totalManifestadas: totalOk,
      totalComXmlLiberado: totalComXml,
      resultados
    })

  } catch (err: any) {
    console.error('Erro na rota de manifestação DF-e:', err)
    return NextResponse.json({
      success: false,
      error: 'Falha interna ao registrar manifestação na SEFAZ: ' + (err.message || '')
    }, { status: 500 })
  }
}
