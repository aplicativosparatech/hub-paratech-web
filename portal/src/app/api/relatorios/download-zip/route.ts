import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import JSZip from 'jszip'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const clienteId = searchParams.get('cliente_id')
    const mesAno = searchParams.get('mes') // Ex: "2026-10"

    if (!clienteId) {
      return NextResponse.json({ error: 'cliente_id é obrigatório' }, { status: 400 })
    }

    const supabase = createAdminClient()

    let startDate: string | null = null
    let endDate: string | null = null

    if (mesAno) {
      const [ano, mes] = mesAno.split('-').map(Number)
      startDate = new Date(Date.UTC(ano, mes - 1, 1, 0, 0, 0)).toISOString()
      endDate = new Date(Date.UTC(ano, mes, 0, 23, 59, 59, 999)).toISOString()
    }

    // Busca notas dos 3 tipos
    let qNfe = supabase.from('nfe_saidas').select('chave, numero, storage_path').eq('cliente_id', clienteId)
    let qNfce = supabase.from('nfce_saidas').select('chave, numero, storage_path').eq('cliente_id', clienteId)
    let qEntradas = supabase.from('nfe_entradas').select('chave, numero, storage_path').eq('cliente_id', clienteId)

    if (startDate && endDate) {
      qNfe = qNfe.gte('data_emissao', startDate).lte('data_emissao', endDate)
      qNfce = qNfce.gte('data_emissao', startDate).lte('data_emissao', endDate)
      qEntradas = qEntradas.gte('data_emissao', startDate).lte('data_emissao', endDate)
    }

    const [resNfe, resNfce, resEntradas] = await Promise.all([qNfe, qNfce, qEntradas])

    const nfeList = resNfe.data || []
    const nfceList = resNfce.data || []
    const entradasList = resEntradas.data || []

    const totalNotas = nfeList.length + nfceList.length + entradasList.length
    if (totalNotas === 0) {
      return NextResponse.json({ error: 'Nenhum XML encontrado para este período.' }, { status: 404 })
    }

    const zip = new JSZip()
    const folderNfe = zip.folder('NFe_Saidas')
    const folderNfce = zip.folder('NFCe_Saidas')
    const folderEntradas = zip.folder('NFe_Entradas')

    // Helper para baixar do Storage e adicionar no Zip
    async function addFilesToZip(items: any[], folder: any) {
      for (const item of items) {
        if (!item.storage_path) continue
        try {
          const { data, error } = await supabase.storage.from('xmls').download(item.storage_path)
          if (!error && data) {
            const arrayBuffer = await data.arrayBuffer()
            folder.file(`${item.chave || item.numero}.xml`, arrayBuffer)
          }
        } catch (e) {
          console.warn(`Erro ao baixar XML ${item.storage_path}:`, e)
        }
      }
    }

    await Promise.all([
      addFilesToZip(nfeList, folderNfe),
      addFilesToZip(nfceList, folderNfce),
      addFilesToZip(entradasList, folderEntradas)
    ])

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })

    const filename = `XMLs_${mesAno || 'periodo'}_${clienteId.slice(0, 8)}.zip`

    return new Response(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    })

  } catch (error: any) {
    console.error('Erro ao gerar ZIP de XMLs:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
