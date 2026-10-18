import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { executarConsultaDfeCompleta } from '@/utils/sefazDfeService'
import { auditarLoteProdutos } from '@/utils/tributario/auditorEngine'
import { APP_VERSION } from '@/utils/version'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseAdmin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseKey)

// 1. GET: Descoberta de APIs e Healthcheck
export async function GET() {
  return NextResponse.json({
    status: 'online',
    name: 'Hub Paratech Master Gateway API (Global)',
    version: APP_VERSION,
    description: 'API Global Unificada para integração de ERPs, PDVs, Flutter, Tauri/Rust e WebApps sem necessidade do hub.exe.',
    timestamp: new Date().toISOString(),
    supported_actions: [
      { action: 'ping', desc: 'Verifica conectividade e versão do Hub Paratech' },
      { action: 'upload_xml', desc: 'Ingestão e processamento de XMLs de NF-e, NFC-e, CT-e e MDF-e' },
      { action: 'consultar_dfe', desc: 'Consulta em tempo real notas de fornecedores emitidas contra o CNPJ na SEFAZ Nacional' },
      { action: 'manifestar_dfe', desc: 'Manifestação do destinatário na SEFAZ (Ciência, Confirmação, etc.)' },
      { action: 'status_sefaz', desc: 'Disponibilidade e tempo de resposta dos servidores da SEFAZ por UF' },
      { action: 'inutilizar_numeracao', desc: 'Inutilização oficial de faixas de NF-e e NFC-e na SEFAZ' },
      { action: 'corrigir_nota', desc: 'Emissão de Carta de Correção Eletrônica (CC-e) na SEFAZ' },
      { action: 'auditar_produtos', desc: 'Auditoria tributária em lote (NCM, CEST, PIS/COFINS, IBS/CBS)' },
      { action: 'chat_robotech', desc: 'Consultas em linguagem natural ao Agente de IA Robotech' },
      { action: 'gerar_pix', desc: 'Geração de cobrança PIX com QR Code dinâmico e Copia e Cola' }
    ]
  })
}

// 2. POST: Gateway Master Unificado (Router de Ações)
export async function POST(request: Request) {
  try {
    let body: any = {}
    const contentType = request.headers.get('content-type') || ''
    
    // Leitura flexível do corpo (JSON ou Form-Data)
    if (contentType.includes('application/json')) {
      body = await request.json().catch(() => ({}))
    } else if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      body.action = (formData.get('action') as string) || 'upload_xml'
      body.hub_token = formData.get('hub_token') as string
      body.tipo_pasta = formData.get('tipo_pasta') as string
      body.file = formData.get('xml_file') as File
    }

    // Identificação do token (via Header x-hub-token, Authorization Bearer ou Body)
    const headerToken = request.headers.get('x-hub-token') || ''
    const authHeader = request.headers.get('authorization') || ''
    const bearerToken = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.substring(7).trim() : ''
    const hubToken = headerToken || bearerToken || body.hub_token || ''

    const action = (body.action || new URL(request.url).searchParams.get('action') || 'ping').toLowerCase()

    // Ação: PING (Pública / Sem exigência de token)
    if (action === 'ping') {
      return NextResponse.json({
        success: true,
        action: 'ping',
        data: {
          status: 'online',
          version: APP_VERSION,
          servidor: 'Hub Paratech Cloud (Vercel / Supabase)',
          timestamp: new Date().toISOString()
        }
      })
    }

    // Ação: STATUS_SEFAZ (Pública / Sem exigência de token obrigatório)
    if (action === 'status_sefaz') {
      const uf = (body.params?.uf || body.uf || 'MG').toUpperCase()
      const statusUrl = new URL('/api/sefaz/status', request.url)
      const resStatus = await fetch(statusUrl.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uf })
      })
      const dataStatus = await resStatus.json().catch(() => ({ online: true, uf }))

      return NextResponse.json({
        success: resStatus.ok,
        action: 'status_sefaz',
        data: dataStatus
      })
    }

    // Para ações operacionais, busca cliente pelo hub_token ou cliente_id
    let cliente: any = null
    if (hubToken) {
      const { data } = await supabaseAdmin
        .from('clientes')
        .select('id, cnpj, razao_social, nome_fantasia, is_ativo, certificado_url, certificado_senha')
        .eq('hub_token', hubToken)
        .maybeSingle()
      cliente = data
    } else if (body.params?.cliente_id || body.cliente_id) {
      const cId = body.params?.cliente_id || body.cliente_id
      const { data } = await supabaseAdmin
        .from('clientes')
        .select('id, cnpj, razao_social, nome_fantasia, is_ativo, certificado_url, certificado_senha')
        .eq('id', cId)
        .maybeSingle()
      cliente = data
    }

    // Validação de token para ações restritas
    if (!cliente && ['upload_xml', 'consultar_dfe', 'manifestar_dfe', 'inutilizar_numeracao', 'corrigir_nota'].includes(action)) {
      return NextResponse.json({
        success: false,
        action,
        error: 'Não autorizado: É necessário fornecer um hub_token válido (via header x-hub-token ou body).'
      }, { status: 401 })
    }

    // =========================================================================
    // EXECUÇÃO DAS AÇÕES
    // =========================================================================

    // 1. UPLOAD_XML
    if (action === 'upload_xml') {
      const formData = new FormData()
      formData.append('hub_token', hubToken || cliente?.hub_token)
      formData.append('tipo_pasta', body.params?.tipo_pasta || body.tipo_pasta || 'vendas')

      if (body.file) {
        formData.append('xml_file', body.file)
      } else if (body.params?.xml_content || body.xml_content) {
        const content = body.params?.xml_content || body.xml_content
        const blob = new Blob([content], { type: 'application/xml' })
        formData.append('xml_file', blob, 'nota.xml')
      } else if (body.params?.xml_base64 || body.xml_base64) {
        const b64 = body.params?.xml_base64 || body.xml_base64
        const content = Buffer.from(b64, 'base64').toString('utf-8')
        const blob = new Blob([content], { type: 'application/xml' })
        formData.append('xml_file', blob, 'nota.xml')
      } else {
        return NextResponse.json({ success: false, error: 'Parâmetro xml_content, xml_base64 ou xml_file ausente.' }, { status: 400 })
      }

      const uploadUrl = new URL('/api/hub/upload-xml', request.url)
      const res = await fetch(uploadUrl.toString(), {
        method: 'POST',
        body: formData
      })
      const uploadResult = await res.json()

      return NextResponse.json({
        success: res.ok,
        action: 'upload_xml',
        data: uploadResult
      }, { status: res.status })
    }

    // 2. CONSULTAR_DFE
    if (action === 'consultar_dfe') {
      const competencia = body.params?.competencia || body.competencia || new Date().toISOString().substring(0, 7)
      const aoVivo = body.params?.ao_vivo ?? body.ao_vivo ?? true

      const resultado = await executarConsultaDfeCompleta({
        cliente_id: cliente.id,
        competencia,
        consultarSefazAoVivo: Boolean(aoVivo)
      })

      return NextResponse.json({
        success: resultado.success,
        action: 'consultar_dfe',
        data: resultado
      })
    }

    // 3. MANIFESTAR_DFE
    if (action === 'manifestar_dfe') {
      const chave = body.params?.chave || body.chave
      const tipoEvento = body.params?.tipo_evento || body.tipo_evento || '210200'

      const manifestUrl = new URL('/api/sefaz/distribuicao-dfe/manifestar', request.url)
      const resManifest = await fetch(manifestUrl.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_id: cliente.id,
          chave,
          tipo_evento: tipoEvento
        })
      })
      const dataManifest = await resManifest.json()

      return NextResponse.json({
        success: resManifest.ok,
        action: 'manifestar_dfe',
        data: dataManifest
      })
    }

    // 4. INUTILIZAR_NUMERACAO
    if (action === 'inutilizar_numeracao') {
      const paramsInut = body.params || body
      const inutUrl = new URL('/api/sefaz/inutilizar', request.url)
      const resInut = await fetch(inutUrl.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_id: cliente.id,
          ...paramsInut
        })
      })
      const dataInut = await resInut.json()

      return NextResponse.json({
        success: resInut.ok,
        action: 'inutilizar_numeracao',
        data: dataInut
      })
    }

    // 5. CORRIGIR_NOTA (CC-e)
    if (action === 'corrigir_nota') {
      const paramsCce = body.params || body
      const cceUrl = new URL('/api/sefaz/corrigir-nota', request.url)
      const resCce = await fetch(cceUrl.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_id: cliente.id,
          ...paramsCce
        })
      })
      const dataCce = await resCce.json()

      return NextResponse.json({
        success: resCce.ok,
        action: 'corrigir_nota',
        data: dataCce
      })
    }

    // 6. AUDITAR_PRODUTOS
    if (action === 'auditar_produtos') {
      const produtos = body.params?.produtos || body.produtos || []
      const resultadoAuditoria = auditarLoteProdutos(produtos)

      return NextResponse.json({
        success: true,
        action: 'auditar_produtos',
        data: resultadoAuditoria
      })
    }

    // 7. CHAT_ROBOTECH
    if (action === 'chat_robotech') {
      const message = body.params?.message || body.message || ''
      const chatUrl = new URL('/api/botech/chat', request.url)
      
      const resChat = await fetch(chatUrl.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          context: { clienteId: cliente?.id }
        })
      })
      const chatData = await resChat.json()

      return NextResponse.json({
        success: resChat.ok,
        action: 'chat_robotech',
        data: chatData
      })
    }

    // 8. GERAR_PIX
    if (action === 'gerar_pix') {
      const faturaId = body.params?.fatura_id || body.fatura_id
      const pixUrl = new URL('/api/pagamentos/gerar-pix', request.url)
      
      const resPix = await fetch(pixUrl.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fatura_id: faturaId })
      })
      const pixData = await resPix.json()

      return NextResponse.json({
        success: resPix.ok,
        action: 'gerar_pix',
        data: pixData
      })
    }

    return NextResponse.json({
      success: false,
      error: `Ação '${action}' não reconhecida. Consulte GET /api/hub/v1 para a lista de ações suportadas.`
    }, { status: 400 })

  } catch (err: any) {
    console.error('Erro no Master Gateway /api/hub/v1:', err)
    return NextResponse.json({
      success: false,
      error: 'Falha interna no Gateway Hub Paratech: ' + (err.message || '')
    }, { status: 500 })
  }
}
