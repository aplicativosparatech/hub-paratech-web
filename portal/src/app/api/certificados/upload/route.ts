import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { parsePfxBuffer } from '@/utils/certParser'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const clienteId = (formData.get('clienteId') as string) || 'novo'
    const senha = (formData.get('senha') as string) || ''

    if (!file) {
      return NextResponse.json({ success: false, error: 'Nenhum arquivo enviado.' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    let certInfo = null
    if (senha) {
      try {
        certInfo = parsePfxBuffer(buffer, senha)
      } catch (err: any) {
        // Se a senha falhar, retorna erro antes de salvar
        return NextResponse.json({ success: false, error: err.message }, { status: 400 })
      }
    }

    const supabase = createAdminClient()
    const certName = `cert_${clienteId}_${Date.now()}.pfx`
    const storagePath = `certificados/${certName}`

    // Upload seguro com Service Role no Supabase Storage
    let { error: uploadError } = await supabase.storage
      .from('certificados')
      .upload(storagePath, buffer, {
        contentType: 'application/x-pkcs12',
        upsert: true
      })

    if (uploadError) {
      // Fallback para o bucket xmls
      const resXmls = await supabase.storage
        .from('xmls')
        .upload(storagePath, buffer, {
          contentType: 'application/x-pkcs12',
          upsert: true
        })
      uploadError = resXmls.error
    }

    if (uploadError) {
      return NextResponse.json({ success: false, error: 'Erro no armazenamento: ' + uploadError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      storagePath,
      certInfo
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Erro ao enviar certificado.' },
      { status: 500 }
    )
  }
}
