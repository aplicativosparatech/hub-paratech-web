import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'

// Cache em memória no processo Node.js para evitar downloads repetidos do Storage
const memCache = new Map<string, {
  destinatario_nome: string | null
  destinatario_documento: string | null
  emitente_nome: string | null
  emitente_documento: string | null
}>()

function extractTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))
  return match ? match[1].trim() : ''
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { ids, tabela } = body as { ids: string[]; tabela: string }

    if (!Array.isArray(ids) || ids.length === 0 || !tabela) {
      return NextResponse.json({ dados: {} })
    }

    const supabaseAdmin = createAdminClient()

    // 1. Verificar quais IDs já estão no cache em memória
    const resultado: Record<string, any> = {}
    const idsFaltantes: string[] = []

    for (const id of ids) {
      const cacheKey = `${tabela}:${id}`
      if (memCache.has(cacheKey)) {
        resultado[id] = memCache.get(cacheKey)
      } else {
        idsFaltantes.push(id)
      }
    }

    if (idsFaltantes.length === 0) {
      return NextResponse.json({ dados: resultado })
    }

    // 2. Buscar registros no banco de dados para os faltantes
    const { data: notas, error } = await supabaseAdmin
      .from(tabela)
      .select('id, storage_path, chave, numero, cnpj_emitente, cnpj_destinatario')
      .in('id', idsFaltantes)

    if (error || !notas) {
      return NextResponse.json({ dados: resultado })
    }

    // 3. Processar em paralelo com limite de concorrência
    await Promise.all(
      notas.map(async (n: any) => {
        const cacheKey = `${tabela}:${n.id}`

        // Para NFC-e, se não houver storage_path, o padrão é Consumidor Final
        if (!n.storage_path) {
          const info = {
            destinatario_nome: tabela.startsWith('nfce_') ? 'Consumidor Final' : null,
            destinatario_documento: n.cnpj_destinatario || null,
            emitente_nome: null,
            emitente_documento: n.cnpj_emitente || null
          }
          memCache.set(cacheKey, info)
          resultado[n.id] = info
          return
        }

        try {
          const { data: fileData, error: errStorage } = await supabaseAdmin.storage
            .from('xmls')
            .download(n.storage_path)

          if (!errStorage && fileData) {
            const arrayBuffer = await fileData.arrayBuffer()
            const xmlString = Buffer.from(arrayBuffer).toString('utf-8')

            // Extração de destinatário (<dest>)
            const destMatch = xmlString.match(/<dest[^>]*>([\s\S]*?)<\/dest>/)
            const destXml = destMatch ? destMatch[1] : ''
            const destDoc = extractTag(destXml, 'CNPJ') || extractTag(destXml, 'CPF') || n.cnpj_destinatario || null
            const destNome = extractTag(destXml, 'xNome') || (tabela.startsWith('nfce_') ? (destDoc ? null : 'Consumidor Final') : null)

            // Extração de emitente (<emit>)
            const emitMatch = xmlString.match(/<emit[^>]*>([\s\S]*?)<\/emit>/)
            const emitXml = emitMatch ? emitMatch[1] : ''
            const emitDoc = extractTag(emitXml, 'CNPJ') || extractTag(emitXml, 'CPF') || n.cnpj_emitente || null
            const emitNome = extractTag(emitXml, 'xNome') || null

            const info = {
              destinatario_nome: destNome || (tabela.startsWith('nfce_') ? 'Consumidor Final' : null),
              destinatario_documento: destDoc,
              emitente_nome: emitNome,
              emitente_documento: emitDoc
            }

            memCache.set(cacheKey, info)
            resultado[n.id] = info
            return
          }
        } catch (e) {
          console.warn('Erro ao processar XML da nota no storage:', n.id, e)
        }

        // Fallback básico caso o download falhe
        const info = {
          destinatario_nome: tabela.startsWith('nfce_') ? 'Consumidor Final' : null,
          destinatario_documento: n.cnpj_destinatario || null,
          emitente_nome: null,
          emitente_documento: n.cnpj_emitente || null
        }
        memCache.set(cacheKey, info)
        resultado[n.id] = info
      })
    )

    return NextResponse.json({ dados: resultado })
  } catch (err: any) {
    console.error('Erro em /api/notas-fiscais/destinatarios:', err)
    return NextResponse.json({ error: err.message, dados: {} }, { status: 500 })
  }
}
