import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { obterOuGerarPixFatura } from '@/utils/pix'
import { calcularCompetenciaEMesAnterior } from '@/utils/billing'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: 'ID da fatura não fornecido' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data: fatura, error } = await supabase
      .from('faturas')
      .select(`
        id, competencia, data_vencimento, valor, valor_original, valor_multa, valor_juros,
        status, qr_code_payload, pago_em, created_at,
        clientes (
          razao_social, nome_fantasia, cnpj, nome_sistema_utilizado
        )
      `)
      .eq('id', id)
      .single()

    if (error || !fatura) {
      return NextResponse.json({ error: 'Fatura não encontrada' }, { status: 404 })
    }

    const cliente: any = Array.isArray(fatura.clientes) ? fatura.clientes[0] : fatura.clientes

    // Se estiver pendente e sem Pix, gera automaticamente
    let qrCodePayload = fatura.qr_code_payload
    if (!qrCodePayload && fatura.status === 'pendente') {
      try {
        const pixRes = await obterOuGerarPixFatura(id)
        qrCodePayload = pixRes.qr_code_payload
      } catch (errPix) {
        console.error('Falha ao gerar Pix para fatura pública:', errPix)
      }
    }

    const { mesAnteriorNome } = calcularCompetenciaEMesAnterior(new Date(), fatura.competencia)

    return NextResponse.json({
      success: true,
      fatura: {
        id: fatura.id,
        competencia: fatura.competencia,
        mesAnteriorReferencia: mesAnteriorNome,
        data_vencimento: fatura.data_vencimento,
        valor: Number(fatura.valor),
        valor_original: fatura.valor_original ? Number(fatura.valor_original) : Number(fatura.valor),
        valor_multa: Number(fatura.valor_multa || 0),
        valor_juros: Number(fatura.valor_juros || 0),
        status: fatura.status,
        qr_code_payload: qrCodePayload,
        pago_em: fatura.pago_em,
        created_at: fatura.created_at
      },
      cliente: {
        razao_social: cliente?.razao_social || 'Cliente Paratech',
        nome_fantasia: cliente?.nome_fantasia || cliente?.razao_social || 'Cliente',
        cnpj: cliente?.cnpj || '',
        nome_sistema_utilizado: cliente?.nome_sistema_utilizado || 'MEI Simples'
      }
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 })
  }
}
