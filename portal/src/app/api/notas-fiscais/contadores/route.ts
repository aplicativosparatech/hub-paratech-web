import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { obterIntervaloMesBrasil } from '@/utils/dateBrasil'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const clienteId = searchParams.get('cliente_id')
    const mesAno = searchParams.get('mes') // formato YYYY-MM

    if (!clienteId) {
      return NextResponse.json({
        totalNfeSaidas: 0,
        totalNfceSaidas: 0,
        totalSaidas: 0,
        totalEntradas: 0,
        totalCorrecao: 0,
        totalInutilizar: 0
      })
    }

    const supabase = createAdminClient()

    let startDate: string | null = null
    let endDate: string | null = null

    if (mesAno && /^\d{4}-\d{2}$/.test(mesAno)) {
      const intervalo = obterIntervaloMesBrasil(mesAno)
      startDate = intervalo.startDate
      endDate = intervalo.endDate
    }

    // Queries de contagem exata e leve
    let qNfeSaidas = supabase
      .from('nfe_saidas')
      .select('id', { count: 'exact', head: true })
      .eq('cliente_id', clienteId)
      .eq('is_autorizada', true)

    let qNfceSaidas = supabase
      .from('nfce_saidas')
      .select('id', { count: 'exact', head: true })
      .eq('cliente_id', clienteId)
      .eq('is_autorizada', true)

    let qEntradas = supabase
      .from('nfe_entradas')
      .select('id', { count: 'exact', head: true })
      .eq('cliente_id', clienteId)

    // Correção: notas incompletas ou pendentes da empresa
    let qCorrecaoNfe = supabase
      .from('nfe_saidas')
      .select('id', { count: 'exact', head: true })
      .eq('cliente_id', clienteId)
      .or('is_autorizada.eq.false,tem_assinatura.eq.false')

    let qCorrecaoNfce = supabase
      .from('nfce_saidas')
      .select('id', { count: 'exact', head: true })
      .eq('cliente_id', clienteId)
      .or('is_autorizada.eq.false,tem_assinatura.eq.false')

    if (startDate && endDate) {
      qNfeSaidas = qNfeSaidas.gte('data_emissao', startDate).lte('data_emissao', endDate)
      qNfceSaidas = qNfceSaidas.gte('data_emissao', startDate).lte('data_emissao', endDate)
      qEntradas = qEntradas.gte('data_emissao', startDate).lte('data_emissao', endDate)
      qCorrecaoNfe = qCorrecaoNfe.gte('data_emissao', startDate).lte('data_emissao', endDate)
      qCorrecaoNfce = qCorrecaoNfce.gte('data_emissao', startDate).lte('data_emissao', endDate)
    }

    const [resNfe, resNfce, resEntradas, resCorrNfe, resCorrNfce] = await Promise.all([
      qNfeSaidas,
      qNfceSaidas,
      qEntradas,
      qCorrecaoNfe,
      qCorrecaoNfce
    ])

    const totalNfeSaidas = resNfe.count || 0
    const totalNfceSaidas = resNfce.count || 0
    const totalSaidas = totalNfeSaidas + totalNfceSaidas
    const totalEntradas = resEntradas.count || 0
    const totalCorrecao = (resCorrNfe.count || 0) + (resCorrNfce.count || 0)

    return NextResponse.json({
      totalNfeSaidas,
      totalNfceSaidas,
      totalSaidas,
      totalEntradas,
      totalCorrecao,
      totalInutilizar: 0 // preenchido dinamicamente se necessário
    })

  } catch (err: any) {
    console.error('Erro ao buscar contadores de notas:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
