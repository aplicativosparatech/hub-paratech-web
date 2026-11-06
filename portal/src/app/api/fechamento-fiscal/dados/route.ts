import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { obterIntervaloMesBrasil } from '@/utils/dateBrasil'

function isMonofasicoNcmOrCst(xml: string): boolean {
  if (/<CST>04<\/CST>|<CST>06<\/CST>/.test(xml)) return true
  const monofasicoPrefixes = ['2201', '2202', '2203', '2402', '2710', '2711', '3003', '3004', '3303', '3304', '3305', '3307', '4011', '8708']
  const ncms = [...xml.matchAll(/<NCM>(\d+)<\/NCM>/g)].map(m => m[1])
  return ncms.some(ncm => monofasicoPrefixes.some(p => ncm.startsWith(p)))
}

function detectarQuebrasFechamento(
  notas: Array<{ numero: string | null; serie?: string | null; chave?: string | null }>,
  modeloRotulo: string,
  numInicialMinimo: number = 1
) {
  const grupos = new Map<string, number[]>()

  for (const n of notas) {
    let num: number | null = null
    let serie = n.serie || '1'

    if (n.chave && n.chave.length === 44) {
      serie = String(parseInt(n.chave.substring(22, 25), 10) || 1)
      num = parseInt(n.chave.substring(25, 34), 10)
    } else if (n.numero) {
      num = parseInt(String(n.numero).replace(/\D/g, ''), 10)
    }

    if (num && !isNaN(num) && num >= numInicialMinimo) {
      const arr = grupos.get(serie) || []
      arr.push(num)
      grupos.set(serie, arr)
    }
  }

  const quebras: Array<{
    modelo: string
    serie: string
    esperado_de: number
    esperado_ate: number
    quantidade_faltante: number
    anterior_emitido: number
    posterior_emitido: number
  }> = []

  grupos.forEach((numeros, serie) => {
    const ordenados = [...new Set(numeros)].sort((a, b) => a - b)
    for (let i = 0; i < ordenados.length - 1; i++) {
      const atual = ordenados[i]
      const prox = ordenados[i + 1]
      if (prox > atual + 1) {
        quebras.push({
          modelo: modeloRotulo,
          serie,
          esperado_de: atual + 1,
          esperado_ate: prox - 1,
          quantidade_faltante: prox - atual - 1,
          anterior_emitido: atual,
          posterior_emitido: prox
        })
      }
    }
  })

  return quebras
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
      .select('id, razao_social, nome_fantasia, cnpj, cidade, uf, whatsapp, regime_tributario, ramo_atividade, numero_inicial_nfe, numero_inicial_nfce, data_inicio_monitoramento, contabilidades(razao_social)')
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

    // Calcula intervalo exato de datas no mês considerando o fuso oficial de Brasília (UTC-3)
    const { startDate: inicioMes, endDate: fimMes } = obterIntervaloMesBrasil(mesAno)

    // MODO LEVE: Apenas contagens para diagnóstico imediato e sugestão inteligente de relatórios
    if (somenteTotais) {
      const [countNfce, countNfeSaidas, countNfeEntradas, countDfeNotas, notasNfceNums, notasNfeNums, resInuts] = await Promise.all([
        supabase.from('nfce_saidas').select('id', { count: 'exact', head: true }).eq('cliente_id', clienteId).gte('data_emissao', inicioMes).lte('data_emissao', fimMes),
        supabase.from('nfe_saidas').select('id', { count: 'exact', head: true }).eq('cliente_id', clienteId).gte('data_emissao', inicioMes).lte('data_emissao', fimMes),
        supabase.from('nfe_entradas').select('id', { count: 'exact', head: true }).eq('cliente_id', clienteId).gte('data_emissao', inicioMes).lte('data_emissao', fimMes),
        supabase.from('dfe_notas_destinadas').select('id', { count: 'exact', head: true }).eq('cliente_id', clienteId).or(`competencia.eq.${mesAno},and(data_emissao.gte.${inicioMes},data_emissao.lte.${fimMes})`),
        supabase.from('nfce_saidas').select('numero, chave, serie').eq('cliente_id', clienteId).gte('data_emissao', inicioMes).lte('data_emissao', fimMes),
        supabase.from('nfe_saidas').select('numero, chave, serie').eq('cliente_id', clienteId).gte('data_emissao', inicioMes).lte('data_emissao', fimMes),
        supabase.from('inutilizacoes_saidas').select('id, modelo, serie, numero_inicial, numero_final, status_sefaz, data_hora, created_at').eq('cliente_id', clienteId).in('status_sefaz', ['102', '204', '563'])
      ])

      const totalNfce = countNfce.count || 0
      const totalNfeSaidas = countNfeSaidas.count || 0
      const totalNfeEntradas = (countNfeEntradas.count || 0) + (countDfeNotas.count || 0)
      const totalNfseEntradas = 0
      const totalNfseSaidas = 0

      // Detecção de Quebras na competência
      const numIniNfce = cliente.numero_inicial_nfce || 1
      const numIniNfe = cliente.numero_inicial_nfe || 1
      const quebrasNfce = detectarQuebrasFechamento(notasNfceNums.data || [], 'NFC-e (Mod 65)', numIniNfce)
      const quebrasNfe = detectarQuebrasFechamento(notasNfeNums.data || [], 'NF-e (Mod 55)', numIniNfe)
      const totalQuebras = quebrasNfce.length + quebrasNfe.length

      // Detecção de Inutilizações na competência
      const inutsNoMes = (resInuts.data || []).filter((inut: any) => {
        const d = inut.data_hora || inut.created_at
        return d && d >= inicioMes && d <= fimMes
      })
      const inutsNfce = inutsNoMes.filter((i: any) => i.modelo === '65' || i.modelo === 'NFC-e')
      const inutsNfe = inutsNoMes.filter((i: any) => i.modelo === '55' || i.modelo === 'NF-e')
      const totalInuts = inutsNoMes.length

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
          quebras_total: totalQuebras,
          quebras_nfce: quebrasNfce.length,
          quebras_nfe: quebrasNfe.length,
          inutilizadas_total: totalInuts,
          inutilizadas_nfce: inutsNfce.length,
          inutilizadas_nfe: inutsNfe.length,
          sugestoes: {
            relNfeEntrada: totalNfeEntradas > 0,
            relNfseEntrada: totalNfseEntradas > 0,
            relNfeSaida: totalNfeSaidas > 0,
            relNfseSaida: totalNfseSaidas > 0,
            relNfceSaida: totalNfce > 0,
            relMonofasicos: temMonofasicos,
            relQuebraSequencia: totalQuebras > 0,
            relNotasInutilizadas: totalInuts > 0
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

    // Inutilizações na SEFAZ e Quebras de Sequência da competência
    const { data: rawInutsCompleto } = await supabase
      .from('inutilizacoes_saidas')
      .select('id, modelo, serie, numero_inicial, numero_final, ano, justificativa, protocolo, status_sefaz, motivo_sefaz, data_hora, created_at')
      .eq('cliente_id', clienteId)
      .in('status_sefaz', ['102', '204', '563'])

    const inutsCompletoMes = (rawInutsCompleto || []).filter((inut: any) => {
      const d = inut.data_hora || inut.created_at
      return d && d >= inicioMes && d <= fimMes
    })
    const inutsNfceCompleto = inutsCompletoMes.filter((i: any) => i.modelo === '65' || i.modelo === 'NFC-e')
    const inutsNfeCompleto = inutsCompletoMes.filter((i: any) => i.modelo === '55' || i.modelo === 'NF-e')

    const numIniNfce = cliente.numero_inicial_nfce || 1
    const numIniNfe = cliente.numero_inicial_nfe || 1
    const quebrasNfceCompleto = detectarQuebrasFechamento(nfceList, 'NFC-e (Mod 65)', numIniNfce)
    const quebrasNfeCompleto = detectarQuebrasFechamento(nfeSaidasList, 'NF-e (Mod 55)', numIniNfe)
    const totalQuebrasCompleto = quebrasNfceCompleto.length + quebrasNfeCompleto.length

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
        quebras_total: totalQuebrasCompleto,
        quebras_nfce: quebrasNfceCompleto.length,
        quebras_nfe: quebrasNfeCompleto.length,
        inutilizadas_total: inutsCompletoMes.length,
        inutilizadas_nfce: inutsNfceCompleto.length,
        inutilizadas_nfe: inutsNfeCompleto.length,
        sugestoes: {
          relNfeEntrada: nfeEntradasList.length > 0,
          relNfseEntrada: nfseEntradasList.length > 0,
          relNfeSaida: nfeSaidasList.length > 0,
          relNfseSaida: nfseSaidasList.length > 0,
          relNfceSaida: nfceList.length > 0,
          relMonofasicos: temMonofasicos,
          relQuebraSequencia: totalQuebrasCompleto > 0,
          relNotasInutilizadas: inutsCompletoMes.length > 0
        }
      },
      documentos: {
        nfce_saidas: nfceList,
        nfe_saidas: nfeSaidasList,
        nfe_entradas: nfeEntradasList,
        nfse_entradas: nfseEntradasList,
        nfse_saidas: nfseSaidasList
      },
      quebras_sequencia: {
        total: totalQuebrasCompleto,
        nfce: quebrasNfceCompleto,
        nfe: quebrasNfeCompleto
      },
      inutilizadas: {
        total: inutsCompletoMes.length,
        nfce: inutsNfceCompleto,
        nfe: inutsNfeCompleto
      }
    })

  } catch (error: any) {
    console.error('Erro na rota /api/fechamento-fiscal/dados:', error)
    return NextResponse.json({ error: error.message || 'Erro interno no servidor.' }, { status: 500 })
  }
}
