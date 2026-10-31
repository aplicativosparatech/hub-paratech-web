import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { obterOuGerarPixFatura } from '@/utils/pix'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { hub_token, fatura_id, force, forcar } = body

    if (!fatura_id) {
      return NextResponse.json({ error: 'Parâmetro obrigatório ausente: fatura_id.' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // 1. Buscar a Fatura e o Cliente vinculado para validar permissões / token
    const { data: fatura, error: fatError } = await supabase
      .from('faturas')
      .select(`
        *,
        clientes (
          id, razao_social, nome_fantasia, cnpj, is_ativo, hub_token
        )
      `)
      .eq('id', fatura_id)
      .single()

    if (fatError || !fatura) {
      return NextResponse.json({ error: 'Fatura não encontrada.' }, { status: 404 })
    }

    const cliente: any = Array.isArray(fatura.clientes) ? fatura.clientes[0] : fatura.clientes

    // Se a requisição veio do Hub Desktop, valida o token
    if (hub_token && cliente?.hub_token && cliente.hub_token !== hub_token) {
      return NextResponse.json({ error: 'Token do Hub inválido para este cliente.' }, { status: 401 })
    }

    if (cliente && !cliente.is_ativo) {
      return NextResponse.json({ error: 'Cliente bloqueado administrativamente.' }, { status: 403 })
    }

    if (fatura.status === 'pago' || fatura.status === 'paga') {
      return NextResponse.json({ error: 'Esta fatura já está quitada.' }, { status: 400 })
    }

    // 2. Gerar ou reutilizar Pix via utilitário centralizado
    const pixResult = await obterOuGerarPixFatura(fatura_id, {
      forcarRegeneracao: Boolean(force || forcar)
    })

    return NextResponse.json({
      qr_code_payload: pixResult.qr_code_payload,
      qr_code_base64: pixResult.qr_code_base64,
      valor: pixResult.valor,
      modo_simulacao: pixResult.modo_simulacao,
      provedor: pixResult.provedor,
      mensagem: pixResult.mensagem
    })
  } catch (error: any) {
    console.error('Erro ao gerar PIX:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
