import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'

function isMonofasicoNcmOrCst(xml: string): boolean {
  if (/<CST>04<\/CST>|<CST>06<\/CST>/.test(xml)) return true
  const monofasicoPrefixes = ['2201', '2202', '2203', '2402', '2710', '2711', '3003', '3004', '3303', '3304', '3305', '3307', '4011', '8708']
  const ncms = [...xml.matchAll(/<NCM>(\d+)<\/NCM>/g)].map(m => m[1])
  return ncms.some(ncm => monofasicoPrefixes.some(p => ncm.startsWith(p)))
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const clienteId = searchParams.get('cliente_id')
    const mesAno = searchParams.get('mes') // formato YYYY-MM, ex: '2026-10'
    const somenteTotais = searchParams.get('somente_totais') === 'true'

    if (!clienteId) {
      return NextResponse.json({ error: 'Parâmetro cliente_id é obrigatório.' }, { status: 400 })
    }

    if (!mesAno) {
      return NextResponse.json({ error: 'Parâmetro mes (YYYY-MM) é obrigatório.' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // 1. Busca dados do Cliente
    const { data: cliente, error: errCli } = await supabase
      .from('clientes')
      .select('id, razao_social, nome_fantasia, cnpj, cidade, uf, whatsapp, regime_tributario, ramo_atividade, contabilidades(razao_social)')
      .eq('id', clienteId)
      .single()

    if (errCli || !cliente) {
      console.error('Erro ao buscar cliente:', errCli)
      return NextResponse.json({ error: `Cliente não encontrado: ${errCli?.message || 'registro inexistente.'}` }, { status: 404 })
    }

    const contabNome = Array.isArray(cliente.contabilidades)
      ? cliente.contabilidades[0]?.razao_social
      : (cliente.contabilidades as any)?.razao_social

    const empresaDados = {
      razao_social: cliente.razao_social || cliente.nome_fantasia || 'Empresa',
      nome_fantasia: cliente.nome_fantasia,
      cnpj: cliente.cnpj || '00.000.000/0000-00',
      cidade: cliente.cidade || '—',
      uf: cliente.uf || '—',
      regime_tributario: cliente.regime_tributario || 'simples_nacional',
      contabilidade_nome: contabNome || 'Não vinculada',
      ramo_atividade: cliente.ramo_atividade || ''
    }

    // Calcula intervalo de datas no mês (UTC)
    const [ano, mes] = mesAno.split('-').map(Number)
    const inicioMes = new Date(Date.UTC(ano, mes - 1, 1, 0, 0, 0)).toISOString()
    const fimMes = new Date(Date.UTC(ano, mes, 0, 23, 59, 59, 999)).toISOString()

    // MODO LEVE: Apenas contagens para diagnóstico imediato e sugestão inteligente de relatórios
    if (somenteTotais) {
      const [countNfce, countNfeSaidas, countNfeEntradas, countDfeNotas] = await Promise.all([
        supabase.from('nfce_saidas').select('id', { count: 'exact', head: true }).eq('cliente_id', clienteId).gte('data_emissao', inicioMes).lte('data_emissao', fimMes),
        supabase.from('nfe_saidas').select('id', { count: 'exact', head: true }).eq('cliente_id', clienteId).gte('data_emissao', inicioMes).lte('data_emissao', fimMes),
        supabase.from('nfe_entradas').select('id', { count: 'exact', head: true }).eq('cliente_id', clienteId).gte('data_emissao', inicioMes).lte('data_emissao', fimMes),
        supabase.from('dfe_notas_destinadas').select('id', { count: 'exact', head: true }).eq('cliente_id', clienteId).or(`competencia.eq.${mesAno},and(data_emissao.gte.${inicioMes},data_emissao.lte.${fimMes})`)
      ])

      const totalNfce = countNfce.count || 0
      const totalNfeSaidas = countNfeSaidas.count || 0
      const totalNfeEntradas = (countNfeEntradas.count || 0) + (countDfeNotas.count || 0)
      const totalNfseEntradas = 0
      const totalNfseSaidas = 0

      // Detecção de produtos monofásicos por amostragem rápida
      let temMonofasicos = false
      if (totalNfce > 0 || totalNfeSaidas > 0) {
        const { data: amostras } = await supabase
          .from('nfce_saidas')
          .select('storage_path')
          .eq('cliente_id', clienteId)
          .gte('data_emissao', inicioMes)
          .lte('data_emissao', fimMes)
          .not('storage_path', 'is', null)
          .limit(3)

        if (amostras && amostras.length > 0) {
          for (const item of amostras) {
            if (item.storage_path) {
              const { data: blob } = await supabase.storage.from('xmls').download(item.storage_path)
              if (blob) {
                const txt = await blob.text()
                if (isMonofasicoNcmOrCst(txt)) {
                  temMonofasicos = true
                  break
                }
              }
            }
          }
        }
      }

      const totalDocumentos = totalNfce + totalNfeSaidas + totalNfeEntradas + totalNfseEntradas + totalNfseSaidas

      return NextResponse.json({
        empresa: empresaDados,
        competencia: mesAno,
        totais: {
          totalDocumentos,
          nfce_saidas: totalNfce,
          nfe_saidas: totalNfeSaidas,
          nfe_entradas: totalNfeEntradas,
          nfse_entradas: totalNfseEntradas,
          nfse_saidas: totalNfseSaidas,
          tem_monofasicos: temMonofasicos,
          sugestoes: {
            relNfeEntrada: totalNfeEntradas > 0,
            relNfseEntrada: totalNfseEntradas > 0,
            relNfeSaida: totalNfeSaidas > 0,
            relNfseSaida: totalNfseSaidas > 0,
            relNfceSaida: totalNfce > 0,
            relMonofasicos: temMonofasicos
          }
        }
      })
    }

    // Consulta paralela completa em todas as modalidades fiscais
    const qNfce = supabase
      .from('nfce_saidas')
      .select('*')
      .eq('cliente_id', clienteId)
      .gte('data_emissao', inicioMes)
      .lte('data_emissao', fimMes)
      .order('data_emissao', { ascending: true })

    const qNfeSaidas = supabase
      .from('nfe_saidas')
      .select('*')
      .eq('cliente_id', clienteId)
      .gte('data_emissao', inicioMes)
      .lte('data_emissao', fimMes)
      .order('data_emissao', { ascending: true })

    const qNfeEntradas = supabase
      .from('nfe_entradas')
      .select('*')
      .eq('cliente_id', clienteId)
      .gte('data_emissao', inicioMes)
      .lte('data_emissao', fimMes)
      .order('data_emissao', { ascending: true })

    // Consulta notas destinadas (Distribuição de DF-e) trazidas para a empresa
    const qDfeDestinadas = supabase
      .from('dfe_notas_destinadas')
      .select('*')
      .eq('cliente_id', clienteId)
      .or(`competencia.eq.${mesAno},and(data_emissao.gte.${inicioMes},data_emissao.lte.${fimMes})`)
      .order('data_emissao', { ascending: true })

    // Busca segura para NFS-e
    async function safeQueryNfse(table: string) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .eq('cliente_id', clienteId)
          .gte('data_emissao', inicioMes)
          .lte('data_emissao', fimMes)
          .order('data_emissao', { ascending: true })
        if (error) return []
        return data || []
      } catch {
        return []
      }
    }

    const [resNfce, resNfeSaidas, resNfeEntradas, dataNfseEntradas, dataNfseSaidas, resDfeNotas] = await Promise.all([
      qNfce,
      qNfeSaidas,
      qNfeEntradas,
      safeQueryNfse('nfse_entradas'),
      safeQueryNfse('nfse_saidas'),
      qDfeDestinadas
    ])

    // Normaliza registros de cada modalidade
    const nfceList = (resNfce.data || []).map((n: any) => ({
      id: n.id,
      numero: n.numero || 'S/N',
      serie: n.serie || '1',
      data_emissao: n.data_emissao,
      contato_nome: n.destinatario || n.consumidor || 'Consumidor Final',
      cidade: cliente.cidade,
      uf: cliente.uf,
      valor: Number(n.valor || 0),
      chave: n.chave || '',
      modalidade: 'nfce_saidas' as const,
      storage_path: n.storage_path
    }))

    const nfeSaidasList = (resNfeSaidas.data || []).map((n: any) => ({
      id: n.id,
      numero: n.numero || 'S/N',
      serie: n.serie || '1',
      data_emissao: n.data_emissao,
      contato_nome: n.cliente || n.destinatario || 'Cliente Geral',
      cidade: n.cidade || cliente.cidade,
      uf: n.uf || cliente.uf,
      valor: Number(n.valor || 0),
      chave: n.chave || '',
      modalidade: 'nfe_saidas' as const,
      storage_path: n.storage_path
    }))

    // Mapeamento enriquecido de notas destinadas do DF-e por chave de acesso
    const dfeMap = new Map<string, any>()
    ;(resDfeNotas?.data || []).forEach((d: any) => {
      if (d.chave) dfeMap.set(d.chave, d)
    })

    const nfeEntradasKeys = new Set<string>()
    const nfeEntradasList = (resNfeEntradas?.data || []).map((n: any) => {
      if (n.chave) nfeEntradasKeys.add(n.chave)
      const dfe = n.chave ? dfeMap.get(n.chave) : null

      const contatoNome = dfe?.emitente_nome || n.fornecedor || n.emitente || (n.cnpj_emitente ? `CNPJ ${n.cnpj_emitente}` : 'Fornecedor')

      return {
        id: n.id,
        numero: n.numero || dfe?.numero || 'S/N',
        serie: n.serie || dfe?.serie || '1',
        data_emissao: n.data_emissao || dfe?.data_emissao,
        data_entrada: n.data_entrada || n.data_emissao || dfe?.data_emissao,
        contato_nome: contatoNome,
        cidade: n.cidade || '—',
        uf: n.uf || '—',
        valor: Number(n.valor || dfe?.valor || 0),
        chave: n.chave || '',
        modalidade: 'nfe_entradas' as const,
        storage_path: n.storage_path || dfe?.storage_path,
        conteudo_xml: dfe?.xml_completo
      }
    })

    // Adiciona notas de dfe_notas_destinadas (Distribuição de DF-e) que ainda não foram sincronizadas na tabela nfe_entradas
    ;(resDfeNotas?.data || []).forEach((dfe: any) => {
      if (dfe.chave && !nfeEntradasKeys.has(dfe.chave)) {
        nfeEntradasKeys.add(dfe.chave)
        nfeEntradasList.push({
          id: dfe.id,
          numero: dfe.numero || 'S/N',
          serie: dfe.serie || '1',
          data_emissao: dfe.data_emissao,
          data_entrada: dfe.data_emissao,
          contato_nome: dfe.emitente_nome || (dfe.emitente_cnpj ? `CNPJ ${dfe.emitente_cnpj}` : 'Fornecedor'),
          cidade: '—',
          uf: '—',
          valor: Number(dfe.valor || 0),
          chave: dfe.chave,
          modalidade: 'nfe_entradas' as const,
          storage_path: dfe.storage_path,
          conteudo_xml: dfe.xml_completo
        })
      }
    })

    const nfseEntradasList = dataNfseEntradas.map((n: any) => ({
      id: n.id,
      numero: n.numero || 'S/N',
      data_emissao: n.data_emissao,
      data_entrada: n.data_entrada || n.data_emissao,
      contato_nome: n.fornecedor || n.prestador || 'Prestador de Serviço',
      cidade: n.cidade || '—',
      uf: n.uf || '—',
      valor: Number(n.valor || 0),
      chave: n.chave || n.codigo_verificacao || '',
      modalidade: 'nfse_entradas' as const,
      storage_path: n.storage_path
    }))

    const nfseSaidasList = dataNfseSaidas.map((n: any) => ({
      id: n.id,
      numero: n.numero || 'S/N',
      data_emissao: n.data_emissao,
      contato_nome: n.cliente || n.tomador || 'Tomador do Serviço',
      cidade: n.cidade || cliente.cidade,
      uf: n.uf || cliente.uf,
      valor: Number(n.valor || 0),
      chave: n.chave || n.codigo_verificacao || '',
      modalidade: 'nfse_saidas' as const,
      storage_path: n.storage_path
    }))

    const totalDocumentos =
      nfceList.length +
      nfeSaidasList.length +
      nfeEntradasList.length +
      nfseEntradasList.length +
      nfseSaidasList.length

    // Verificação de monofásicos
    let temMonofasicos = false
    const amostrasSaida = [...nfceList, ...nfeSaidasList].filter(n => n.storage_path).slice(0, 3)
    if (amostrasSaida.length > 0) {
      for (const item of amostrasSaida) {
        if (item.storage_path) {
          const { data: blob } = await supabase.storage.from('xmls').download(item.storage_path)
          if (blob) {
            const txt = await blob.text()
            if (isMonofasicoNcmOrCst(txt)) {
              temMonofasicos = true
              break
            }
          }
        }
      }
    }

    return NextResponse.json({
      empresa: empresaDados,
      competencia: mesAno,
      totais: {
        totalDocumentos,
        nfce_saidas: nfceList.length,
        nfe_saidas: nfeSaidasList.length,
        nfe_entradas: nfeEntradasList.length,
        nfse_entradas: nfseEntradasList.length,
        nfse_saidas: nfseSaidasList.length,
        tem_monofasicos: temMonofasicos,
        sugestoes: {
          relNfeEntrada: nfeEntradasList.length > 0,
          relNfseEntrada: nfseEntradasList.length > 0,
          relNfeSaida: nfeSaidasList.length > 0,
          relNfseSaida: nfseSaidasList.length > 0,
          relNfceSaida: nfceList.length > 0,
          relMonofasicos: temMonofasicos
        }
      },
      documentos: {
        nfce_saidas: nfceList,
        nfe_saidas: nfeSaidasList,
        nfe_entradas: nfeEntradasList,
        nfse_entradas: nfseEntradasList,
        nfse_saidas: nfseSaidasList
      }
    })

  } catch (error: any) {
    console.error('Erro na rota /api/fechamento-fiscal/dados:', error)
    return NextResponse.json({ error: error.message || 'Erro interno no servidor.' }, { status: 500 })
  }
}
