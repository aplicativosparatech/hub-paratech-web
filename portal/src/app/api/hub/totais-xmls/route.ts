import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseKey)

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // 1. Tenta carregar pela view otimizada v_hub_xml_totais
    const { data: viewData, error: viewError } = await supabase
      .from('v_hub_xml_totais')
      .select('cliente_id, total_nfce, total_nfe, total_entradas, total_geral')

    if (!viewError && viewData) {
      const mapaTotais: Record<string, { nfce: number; nfe: number; entradas: number; total: number }> = {}
      for (const row of viewData) {
        mapaTotais[row.cliente_id] = {
          nfce: Number(row.total_nfce || 0),
          nfe: Number(row.total_nfe || 0),
          entradas: Number(row.total_entradas || 0),
          total: Number(row.total_geral || 0)
        }
      }
      return NextResponse.json({ success: true, totais: mapaTotais })
    }

    // 2. Fallback resiliente: Carrega direto das tabelas caso a view ainda não tenha sido criada no banco
    const [resNfce, resNfe, resEntradas] = await Promise.all([
      supabase.from('nfce_saidas').select('cliente_id').limit(100000),
      supabase.from('nfe_saidas').select('cliente_id').limit(100000),
      supabase.from('nfe_entradas').select('cliente_id').limit(100000)
    ])

    const mapaTotais: Record<string, { nfce: number; nfe: number; entradas: number; total: number }> = {}

    const initClient = (id: string) => {
      if (!mapaTotais[id]) {
        mapaTotais[id] = { nfce: 0, nfe: 0, entradas: 0, total: 0 }
      }
    }

    for (const item of (resNfce.data || [])) {
      if (!item.cliente_id) continue
      initClient(item.cliente_id)
      mapaTotais[item.cliente_id].nfce++
      mapaTotais[item.cliente_id].total++
    }

    for (const item of (resNfe.data || [])) {
      if (!item.cliente_id) continue
      initClient(item.cliente_id)
      mapaTotais[item.cliente_id].nfe++
      mapaTotais[item.cliente_id].total++
    }

    for (const item of (resEntradas.data || [])) {
      if (!item.cliente_id) continue
      initClient(item.cliente_id)
      mapaTotais[item.cliente_id].entradas++
      mapaTotais[item.cliente_id].total++
    }

    return NextResponse.json({ success: true, totais: mapaTotais })
  } catch (err: any) {
    console.error('Erro ao buscar totais de XMLs por tipo:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
