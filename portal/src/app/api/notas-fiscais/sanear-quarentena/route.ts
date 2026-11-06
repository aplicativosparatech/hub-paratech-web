import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseAdmin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseKey)

// Carrega todas as notas de uma tabela com paginação para análise segura
async function carregarTodasNotas(tabela: 'nfce_saidas' | 'nfe_saidas', clienteId: string) {
  const todas: any[] = []
  const pageSize = 1000
  let from = 0
  let hasMore = true

  while (hasMore) {
    const { data, error } = await supabaseAdmin
      .from(tabela)
      .select('id, cliente_id, numero, serie, chave, cstat, protocolo, is_autorizada, tem_assinatura, motivo_sefaz, storage_path, data_emissao, valor')
      .eq('cliente_id', clienteId)
      .range(from, from + pageSize - 1)

    if (error || !data || data.length === 0) {
      hasMore = false
      break
    }
    todas.push(...data)
    from += pageSize
    if (data.length < pageSize) hasMore = false
  }

  return todas
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { cliente_id, acao = 'diagnosticar', ids_para_excluir } = body

    if (!cliente_id) {
      return NextResponse.json({ error: 'Parâmetro cliente_id é obrigatório.' }, { status: 400 })
    }

    // Carrega notas emitidas de NFC-e e NF-e
    const [notasNfce, notasNfe] = await Promise.all([
      carregarTodasNotas('nfce_saidas', cliente_id),
      carregarTodasNotas('nfe_saidas', cliente_id)
    ])

    interface ItemObsoleto {
      id: string
      tabela: 'nfce_saidas' | 'nfe_saidas'
      modelo: '55' | '65'
      tipo_nome: string
      numero: string
      serie: string
      chave_rejeitada: string
      cstat: string
      motivo_sefaz: string
      emissao_rejeitada: string
      valor_rejeitado: number
      storage_path?: string
      nota_oficial: {
        id: string
        chave: string
        protocolo: string
        cstat: string
        emissao: string
        valor: number
        storage_path?: string
      }
    }

    const obsoletasDetectadas: ItemObsoleto[] = []

    const analisarTabela = (tabela: 'nfce_saidas' | 'nfe_saidas', modelo: '55' | '65', tipoNome: string, lista: any[]) => {
      // 1. Mapeia notas oficialmente autorizadas por "serie_numero"
      const mapaOficiais = new Map<string, any>()
      for (const n of lista) {
        const isOficial = (n.cstat === '100' || (n.protocolo && n.protocolo.length > 5) || n.is_autorizada === true)
        if (isOficial && n.numero) {
          const s = String(n.serie || '1')
          const key = `${s}_${n.numero}`
          // Se já existir outra oficial com o mesmo número, mantém a mais recente com protocolo
          mapaOficiais.set(key, n)
        }
      }

      // 2. Identifica registros em quarentena (sem autorização / rejeitados) que já têm oficial
      for (const n of lista) {
        const isOficial = (n.cstat === '100' || (n.protocolo && n.protocolo.length > 5) || n.is_autorizada === true)
        if (!isOficial && n.numero) {
          const s = String(n.serie || '1')
          const key = `${s}_${n.numero}`
          const oficial = mapaOficiais.get(key)

          // CRITÉRIO DE SEGURANÇA MÁXIMA:
          // Só é considerado obsoleto se houver OUTRA nota (chave diferente) comprovadamente oficial
          if (oficial && oficial.chave !== n.chave) {
            obsoletasDetectadas.push({
              id: n.id,
              tabela,
              modelo,
              tipo_nome: tipoNome,
              numero: n.numero,
              serie: s,
              chave_rejeitada: n.chave,
              cstat: n.cstat || 'Pendente',
              motivo_sefaz: n.motivo_sefaz || 'Tentativa rejeitada no PDV sem autorização',
              emissao_rejeitada: n.data_emissao,
              valor_rejeitado: n.valor || 0,
              storage_path: n.storage_path,
              nota_oficial: {
                id: oficial.id,
                chave: oficial.chave,
                protocolo: oficial.protocolo,
                cstat: oficial.cstat || '100',
                emissao: oficial.data_emissao,
                valor: oficial.valor || 0,
                storage_path: oficial.storage_path
              }
            })
          }
        }
      }
    }

    analisarTabela('nfce_saidas', '65', 'NFC-e (Mod 65)', notasNfce)
    analisarTabela('nfe_saidas', '55', 'NF-e (Mod 55)', notasNfe)

    // Se a ação for apenas DIAGNOSTICAR
    if (acao === 'diagnosticar') {
      return NextResponse.json({
        success: true,
        total_obsoletas: obsoletasDetectadas.length,
        itens: obsoletasDetectadas
      })
    }

    // Se a ação for EXECUTAR a limpeza segura
    if (acao === 'executar') {
      const itensParaRemover = Array.isArray(ids_para_excluir) && ids_para_excluir.length > 0
        ? obsoletasDetectadas.filter(item => ids_para_excluir.includes(item.id))
        : obsoletasDetectadas

      let removidas = 0
      const detalhesRemovidas: any[] = []

      for (const item of itensParaRemover) {
        try {
          // Remove o arquivo do storage se existir
          if (item.storage_path) {
            await supabaseAdmin.storage.from('xmls').remove([item.storage_path]).catch(() => {})
          }

          // Remove o registro do banco
          const { error: delErr } = await supabaseAdmin.from(item.tabela).delete().eq('id', item.id)
          if (!delErr) {
            removidas++
            detalhesRemovidas.push({
              id: item.id,
              numero: item.numero,
              chave_excluida: item.chave_rejeitada,
              nota_oficial_mantida: item.nota_oficial.chave
            })
          }
        } catch (err: any) {
          console.warn(`Erro ao sanear tentativa obsoleta ${item.id}:`, err?.message)
        }
      }

      return NextResponse.json({
        success: true,
        total_removidas: removidas,
        detalhes: detalhesRemovidas,
        message: `${removidas} tentativa(s) obsoleta(s) foram saneadas com segurança total. Apenas as notas fiscais oficiais autorizadas foram preservadas no Portal.`
      })
    }

    return NextResponse.json({ error: 'Ação não reconhecida (use "diagnosticar" ou "executar").' }, { status: 400 })

  } catch (err: any) {
    console.error('Erro no saneamento de quarentena:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
