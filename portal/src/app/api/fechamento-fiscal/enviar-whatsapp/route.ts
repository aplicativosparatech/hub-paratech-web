import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { sendWhatsAppMessage } from '@/utils/whatsapp'

function formatCurrency(val: number) {
  return Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { cliente_id, competencia, whatsapp, resumo, empresa } = body

    if (!cliente_id && !empresa) {
      return NextResponse.json({ error: 'Identificação da empresa é obrigatória.' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // 1. Busca dados do cliente caso não tenham sido passados
    let nomeEmpresa = empresa?.nome_fantasia || empresa?.razao_social
    let cnpjEmpresa = empresa?.cnpj
    let numeroDestino = (whatsapp || '').replace(/\D/g, '')

    if ((!nomeEmpresa || !numeroDestino) && cliente_id) {
      const { data: cli } = await supabase
        .from('clientes')
        .select('razao_social, nome_fantasia, cnpj, whatsapp')
        .eq('id', cliente_id)
        .single()

      if (cli) {
        if (!nomeEmpresa) nomeEmpresa = cli.nome_fantasia || cli.razao_social
        if (!cnpjEmpresa) cnpjEmpresa = cli.cnpj
        if (!numeroDestino && cli.whatsapp) numeroDestino = cli.whatsapp.replace(/\D/g, '')
      }
    }

    if (!numeroDestino) {
      return NextResponse.json({
        error: 'Número de WhatsApp de destino não informado nem encontrado no cadastro da empresa.'
      }, { status: 400 })
    }

    // 2. Garante o formato DDI + DDD + Número para o disparo
    let targetPhone = numeroDestino
    if (!targetPhone.startsWith('55') && (targetPhone.length === 10 || targetPhone.length === 11)) {
      targetPhone = '55' + targetPhone
    }

    // 3. Formata competência
    let compFormatada = competencia || 'Mês Atual'
    if (competencia && competencia.includes('-')) {
      const [ano, mes] = competencia.split('-')
      const nomesMeses = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
      ]
      const idx = Number(mes) - 1
      if (idx >= 0 && idx < 12) {
        compFormatada = `${nomesMeses[idx]} de ${ano} (${mes}/${ano})`
      }
    }

    // 4. Monta demonstrativo dos documentos fiscais
    const det = resumo?.detalhes || {}
    const nfeEnt = det.nfeEntrada || { qtd: 0, valor: 0 }
    const nfseEnt = det.nfseEntrada || { qtd: 0, valor: 0 }
    const nfeSai = det.nfeSaida || { qtd: 0, valor: 0 }
    const nfceSai = det.nfceSaida || { qtd: 0, valor: 0 }
    const nfseSai = det.nfseSaida || { qtd: 0, valor: 0 }
    const monof = det.monofasicos || { qtd: 0, valor: 0 }

    const totalXmls = resumo?.totalXmls ?? (nfeEnt.qtd + nfseEnt.qtd + nfeSai.qtd + nfceSai.qtd + nfseSai.qtd)
    const valorMovimentado = resumo?.valorTotal ?? (nfeSai.valor + nfceSai.valor + nfseSai.valor + nfeEnt.valor)

    const linhasDemonstrativo: string[] = []

    if (nfeEnt.qtd > 0) {
      linhasDemonstrativo.push(`📥 *NF-e Compras (Entradas):* ${nfeEnt.qtd} notas (${formatCurrency(nfeEnt.valor)})`)
    }
    if (nfseEnt.qtd > 0) {
      linhasDemonstrativo.push(`📥 *NFS-e Tomados (Serviços):* ${nfseEnt.qtd} notas (${formatCurrency(nfseEnt.valor)})`)
    }
    if (nfeSai.qtd > 0) {
      linhasDemonstrativo.push(`📤 *NF-e Vendas (Mod 55):* ${nfeSai.qtd} notas (${formatCurrency(nfeSai.valor)})`)
    }
    if (nfceSai.qtd > 0) {
      linhasDemonstrativo.push(`📤 *NFC-e Consumidor (Mod 65):* ${nfceSai.qtd} notas (${formatCurrency(nfceSai.valor)})`)
    }
    if (nfseSai.qtd > 0) {
      linhasDemonstrativo.push(`📤 *NFS-e Prestados (Serviços):* ${nfseSai.qtd} notas (${formatCurrency(nfseSai.valor)})`)
    }
    if (monof.qtd > 0) {
      linhasDemonstrativo.push(`✨ *Produtos Monofásicos PIS/COFINS:* ${monof.qtd} itens segredados (${formatCurrency(monof.valor)})`)
    }

    const demonstrativoTexto = linhasDemonstrativo.length > 0
      ? linhasDemonstrativo.join('\n')
      : '• Nenhum documento emitido na competência.'

    // 5. Monta o corpo da mensagem com padrão corporativo elegante
    const mensagem = [
      `📦 *FECHAMENTO FISCAL MENSAL CONCLUÍDO*`,
      `━━━━━━━━━━━━━━━━━━━━━━━━`,
      `🏢 *Empresa:* ${nomeEmpresa || 'Empresa Cliente'}`,
      cnpjEmpresa ? `📄 *CNPJ:* ${cnpjEmpresa}` : null,
      `📅 *Competência:* ${compFormatada}`,
      `━━━━━━━━━━━━━━━━━━━━━━━━`,
      ``,
      `📊 *Demonstrativo de Documentos Apurados:*`,
      demonstrativoTexto,
      ``,
      `📁 *Resumo do Pacote ZIP:*`,
      `• *Total de XMLs Arquivados:* ${totalXmls}`,
      resumo?.totalRelatorios ? `• *Relatórios Consolidados:* ${resumo.totalRelatorios}` : null,
      `• *Movimentação Contábil Geral:* ${formatCurrency(valorMovimentado)}`,
      ``,
      `✅ *Status:* Todos os documentos foram auditados, organizados por modalidade sem pastas vazias e empacotados em conformidade contábil.`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━━━━━`,
      `_HUB PARATECH - Automação & Inteligência Fiscal_`
    ].filter(Boolean).join('\n')

    // 6. Dispara mensagem usando a API ativa do WhatsApp
    await sendWhatsAppMessage({
      to: targetPhone,
      message: mensagem
    })

    return NextResponse.json({
      success: true,
      message: `Fechamento Fiscal enviado com sucesso para o WhatsApp ${targetPhone}!`,
      destinatario: targetPhone
    })

  } catch (err: any) {
    console.error('Erro ao enviar fechamento via WhatsApp:', err)
    return NextResponse.json({
      success: false,
      error: err.message || 'Falha ao comunicar com a API do WhatsApp.'
    }, { status: 500 })
  }
}
