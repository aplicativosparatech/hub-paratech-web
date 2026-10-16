import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { executarInutilizacaoSefaz } from '@/utils/sefazInutilizacaoService'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseAdmin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseKey)

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { cliente_id, modelo, serie, nNFIni, nNFFin, justificativa, ano: anoParam } = body

    if (!cliente_id || !modelo || serie === undefined || !nNFIni || !nNFFin) {
      return NextResponse.json({ 
        error: 'Parâmetros obrigatórios ausentes (cliente_id, modelo, serie, nNFIni, nNFFin).' 
      }, { status: 400 })
    }

    if (modelo !== '55' && modelo !== '65') {
      return NextResponse.json({ error: 'Modelo inválido: deve ser 55 (NF-e) ou 65 (NFC-e).' }, { status: 400 })
    }

    const numIni = parseInt(String(nNFIni), 10)
    const numFin = parseInt(String(nNFFin), 10)

    if (numIni <= 0 || numFin <= 0 || numIni > numFin) {
      return NextResponse.json({ error: 'Faixa de numeração inválida (nNFIni deve ser menor ou igual a nNFFin e maior que zero).' }, { status: 400 })
    }

    // 1. Busca dados do cliente e certificado digital
    const { data: cliente, error: cliErr } = await supabaseAdmin
      .from('clientes')
      .select('id, razao_social, cnpj, uf, certificado_url, certificado_senha')
      .eq('id', cliente_id)
      .single()

    if (cliErr || !cliente) {
      return NextResponse.json({ error: 'Cliente não encontrado: ' + (cliErr?.message || '') }, { status: 404 })
    }

    if (!cliente.certificado_url) {
      return NextResponse.json({ 
        error: 'O cliente não possui Certificado Digital A1 cadastrado no portal. Cadastre o certificado na aba Clientes para emitir a inutilização junto à SEFAZ.' 
      }, { status: 400 })
    }

    // 2. Baixa o arquivo .pfx do storage
    let certBlob = null
    const { data: blob1 } = await supabaseAdmin.storage.from('certificados').download(cliente.certificado_url)
    certBlob = blob1

    if (!certBlob) {
      const { data: blob2 } = await supabaseAdmin.storage.from('xmls').download(cliente.certificado_url)
      certBlob = blob2
    }

    if (!certBlob) {
      return NextResponse.json({ error: 'Não foi possível carregar o arquivo do Certificado Digital do storage.' }, { status: 404 })
    }

    const certBuffer = Buffer.from(await certBlob.arrayBuffer())

    // 3. Determina ano atual ou passado
    const ano = anoParam 
      ? String(anoParam).slice(-2) 
      : new Date().getFullYear().toString().slice(-2)

    const just = (justificativa || 'Quebra de sequencia numerica do sistema emissor').trim()

    // 4. Executa a Inutilização junto à SEFAZ
    const resultado = await executarInutilizacaoSefaz({
      cUF: cliente.uf || 'MG',
      ano,
      cnpj: cliente.cnpj,
      mod: modelo,
      serie: String(serie),
      nNFIni: numIni,
      nNFFin: numFin,
      xJust: just,
      pfxBuffer: certBuffer,
      passphrase: cliente.certificado_senha || '',
      tpAmb: '1' // Ambiente de Produção
    })

    // 5. Registra o histórico na tabela inutilizacoes_saidas
    let statusBanco = resultado.cStat
    if (resultado.isHomologada) statusBanco = '102'
    else if (resultado.isJaInutilizado) statusBanco = '204'
    else if (resultado.isUtilizadaNaSefaz) statusBanco = resultado.cStat

    try {
      await supabaseAdmin.from('inutilizacoes_saidas').insert({
        cliente_id: cliente.id,
        modelo,
        serie: String(serie),
        numero_inicial: numIni,
        numero_final: numFin,
        ano,
        justificativa: just,
        protocolo: resultado.nProt || null,
        status_sefaz: statusBanco,
        motivo_sefaz: resultado.xMotivo,
        xml_pedido: resultado.xmlPedido || null,
        xml_retorno: resultado.xmlRetorno || null,
        data_hora: new Date().toISOString()
      })
    } catch (insertErr: any) {
      console.warn('Aviso: Falha ao gravar log em inutilizacoes_saidas:', insertErr.message)
    }

    // 6. Retorna resposta detalhada
    return NextResponse.json({
      success: resultado.success,
      cStat: resultado.cStat,
      xMotivo: resultado.xMotivo,
      nProt: resultado.nProt,
      dhRecbto: resultado.dhRecbto,
      isHomologada: resultado.isHomologada,
      isJaInutilizado: resultado.isJaInutilizado,
      isUtilizadaNaSefaz: resultado.isUtilizadaNaSefaz,
      xmlRetorno: resultado.xmlRetorno
    })

  } catch (err: any) {
    console.error('Erro no endpoint /api/sefaz/inutilizar:', err)
    return NextResponse.json({
      success: false,
      cStat: 'ERRO_INTERNO',
      xMotivo: 'Erro interno ao processar inutilização: ' + (err.message || ''),
      error: err.message
    }, { status: 500 })
  }
}
