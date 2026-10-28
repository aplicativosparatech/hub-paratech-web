import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const sistemaId = (formData.get('sistema_id') as string) || 'geral'
    const versao = (formData.get('versao') as string) || '1.0.0'

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Sanitiza nome do arquivo
    const nomeLimpo = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `${sistemaId}/${versao}_${Date.now()}_${nomeLimpo}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { data: uploadData, error: errUpload } = await supabase.storage
      .from('instaladores')
      .upload(path, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: true
      })

    if (errUpload) {
      console.error('Erro no upload para bucket instaladores:', errUpload)
      return NextResponse.json({ error: errUpload.message }, { status: 500 })
    }

    // Obtém URL pública
    const { data: urlData } = supabase.storage
      .from('instaladores')
      .getPublicUrl(path)

    return NextResponse.json({
      sucesso: true,
      url: urlData.publicUrl,
      path: uploadData.path,
      tamanho_bytes: file.size,
      nome_original: file.name
    })

  } catch (error: any) {
    console.error('Erro no upload de instalador:', error)
    return NextResponse.json({ error: error.message || 'Erro interno no upload' }, { status: 500 })
  }
}
