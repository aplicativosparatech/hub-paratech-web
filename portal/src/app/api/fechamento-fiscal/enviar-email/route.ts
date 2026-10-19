import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { sendEmail } from '@/utils/email'

function formatCurrency(val: number) {
  return Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { cliente_id, competencia, email, resumo, empresa } = body

    if (!cliente_id && !empresa) {
      return NextResponse.json({ error: 'Identificação da empresa é obrigatória.' }, { status: 400 })
    }

    const supabase = createAdminClient()

    let nomeEmpresa = empresa?.nome_fantasia || empresa?.razao_social
    let cnpjEmpresa = empresa?.cnpj
    let emailDestino = (email || '').trim()

    // 1. Se o e-mail não veio no corpo, busca na empresa e na contabilidade vinculada
    if (!emailDestino && cliente_id) {
      const { data: cli } = await supabase
        .from('clientes')
        .select('razao_social, nome_fantasia, cnpj, email, email_fiscal, contabilidade_id')
        .eq('id', cliente_id)
        .single()

      if (cli) {
        if (!nomeEmpresa) nomeEmpresa = cli.nome_fantasia || cli.razao_social
        if (!cnpjEmpresa) cnpjEmpresa = cli.cnpj
        
        // Verifica se há contabilidade vinculada com permissão de envio de e-mail ativa
        if (cli.contabilidade_id) {
          const { data: contab } = await supabase
            .from('contabilidades')
            .select('email_fiscal, email, permitir_envio_email, envio_email_ativo')
            .eq('id', cli.contabilidade_id)
            .single()

          if (contab && contab.permitir_envio_email !== false && contab.envio_email_ativo !== false) {
            emailDestino = contab.email_fiscal || contab.email || ''
          }
        }

        // Se a contabilidade não definiu ou não está vinculada, usa o e-mail fiscal do cliente
        if (!emailDestino) {
          emailDestino = cli.email_fiscal || cli.email || ''
        }
      }
    }

    if (!emailDestino || !emailDestino.includes('@')) {
      return NextResponse.json({
        error: 'Nenhum endereço de e-mail de destino válido foi encontrado para este cliente ou escritório contábil.'
      }, { status: 400 })
    }

    // 2. Formata a competência
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

    // 3. Monta métricas
    const det = resumo?.detalhes || {}
    const nfeEnt = det.nfeEntrada || { qtd: 0, valor: 0 }
    const nfseEnt = det.nfseEntrada || { qtd: 0, valor: 0 }
    const nfeSai = det.nfeSaida || { qtd: 0, valor: 0 }
    const nfceSai = det.nfceSaida || { qtd: 0, valor: 0 }
    const nfseSai = det.nfseSaida || { qtd: 0, valor: 0 }
    const monof = det.monofasicos || { qtd: 0, valor: 0 }

    const totalXmls = resumo?.totalXmls ?? (nfeEnt.qtd + nfseEnt.qtd + nfeSai.qtd + nfceSai.qtd + nfseSai.qtd)
    const valorMovimentado = resumo?.valorTotal ?? (nfeSai.valor + nfceSai.valor + nfseSai.valor + nfeEnt.valor)
    const tamanhoMb = resumo?.tamanhoMb || '0.00'

    // 4. Constrói template HTML responsivo corporativo de alto padrão
    const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Fechamento Fiscal - ${nomeEmpresa}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; color: #1e293b; margin: 0; padding: 24px; }
        .wrapper { max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 20px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05); }
        .header { background: linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #4338ca 100%); color: #ffffff; padding: 36px 28px; text-align: left; }
        .tag-pill { display: inline-block; background: rgba(255, 255, 255, 0.15); border: 1px solid rgba(255, 255, 255, 0.25); color: #c7d2fe; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; padding: 4px 10px; border-radius: 9999px; margin-bottom: 12px; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
        .header p { margin: 6px 0 0; font-size: 14px; color: #e0e7ff; }
        .body-content { padding: 32px 28px; }
        .company-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px 20px; margin-bottom: 24px; }
        .company-title { font-size: 16px; font-weight: 800; color: #0f172a; margin-bottom: 4px; }
        .company-cnpj { font-size: 13px; color: #64748b; font-family: monospace; font-weight: 600; }
        .section-title { font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #475569; margin: 24px 0 12px; display: flex; align-items: center; }
        .grid-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; }
        .stat-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; }
        .stat-card.highlight { background: #f5f3ff; border-color: #ddd6fe; }
        .stat-label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 4px; }
        .stat-val { font-size: 18px; font-weight: 800; color: #0f172a; }
        .stat-val.primary { color: #4338ca; }
        .table-docs { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 24px; }
        .table-docs th { text-align: left; padding: 10px 12px; background: #f8fafc; border-bottom: 2px solid #e2e8f0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; }
        .table-docs td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; color: #334155; }
        .table-docs td.qty { text-align: center; font-weight: 700; }
        .table-docs td.val { text-align: right; font-weight: 700; color: #0f172a; }
        .clean-assurance { background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px; padding: 16px; margin-bottom: 24px; display: flex; align-items: flex-start; gap: 12px; }
        .clean-text { font-size: 12px; color: #065f46; line-height: 1.5; }
        .clean-text strong { color: #047857; }
        .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px 28px; text-align: center; font-size: 12px; color: #94a3b8; }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="header">
          <div class="tag-pill">Fechamento Fiscal Mensal</div>
          <h1>${nomeEmpresa}</h1>
          <p>Competência Apurada: <strong>${compFormatada}</strong></p>
        </div>

        <div class="body-content">
          <div class="company-box">
            <div class="company-title">${nomeEmpresa}</div>
            <div class="company-cnpj">CNPJ: ${cnpjEmpresa || 'Não informado'}</div>
          </div>

          <div class="grid-cards">
            <div class="stat-card highlight">
              <div class="stat-label">Movimentação Total</div>
              <div class="stat-val primary">${formatCurrency(valorMovimentado)}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Total de XMLs Auditados</div>
              <div class="stat-val">${totalXmls} <span style="font-size: 12px; font-weight: 500; color: #64748b;">(${tamanhoMb} MB)</span></div>
            </div>
          </div>

          <div class="section-title">Detalhamento dos Documentos da Competência</div>
          <table class="table-docs">
            <thead>
              <tr>
                <th>Operação / Modalidade</th>
                <th style="text-align: center;">Qtd</th>
                <th style="text-align: right;">Total Apurado</th>
              </tr>
            </thead>
            <tbody>
              ${nfeSai.qtd > 0 ? `
              <tr>
                <td><strong>NF-e Vendas Mercantis</strong> (Mod. 55)</td>
                <td class="qty">${nfeSai.qtd}</td>
                <td class="val">${formatCurrency(nfeSai.valor)}</td>
              </tr>` : ''}
              ${nfceSai.qtd > 0 ? `
              <tr>
                <td><strong>NFC-e Vendas Consumidor</strong> (Mod. 65)</td>
                <td class="qty">${nfceSai.qtd}</td>
                <td class="val">${formatCurrency(nfceSai.valor)}</td>
              </tr>` : ''}
              ${nfseSai.qtd > 0 ? `
              <tr>
                <td><strong>NFS-e Serviços Prestados</strong></td>
                <td class="qty">${nfseSai.qtd}</td>
                <td class="val">${formatCurrency(nfseSai.valor)}</td>
              </tr>` : ''}
              ${nfeEnt.qtd > 0 ? `
              <tr>
                <td><strong>NF-e Compras / Entradas</strong> (Mod. 55)</td>
                <td class="qty">${nfeEnt.qtd}</td>
                <td class="val">${formatCurrency(nfeEnt.valor)}</td>
              </tr>` : ''}
              ${nfseEnt.qtd > 0 ? `
              <tr>
                <td><strong>NFS-e Serviços Tomados</strong></td>
                <td class="qty">${nfseEnt.qtd}</td>
                <td class="val">${formatCurrency(nfseEnt.valor)}</td>
              </tr>` : ''}
              ${monof.qtd > 0 ? `
              <tr style="background: #faf5ff;">
                <td><strong style="color: #6b21a8;">Produtos Monofásicos PIS/COFINS</strong> (Segregação)</td>
                <td class="qty" style="color: #6b21a8;">${monof.qtd}</td>
                <td class="val" style="color: #6b21a8;">${formatCurrency(monof.valor)}</td>
              </tr>` : ''}
            </tbody>
          </table>

          <div class="clean-assurance">
            <div class="clean-text">
              <strong>✓ Garantia de Conformidade Contábil:</strong> Todos os arquivos XML foram auditados, validados contra a SEFAZ e organizados rigorosamente por pasta de modalidade, sem pastas vazias, garantindo integridade imediata para importação no sistema contábil (Domínio, Alterdata, Fortes, Questor, etc.).
            </div>
          </div>
        </div>

        <div class="footer">
          Este fechamento foi gerado e transmitido automaticamente através da plataforma <strong>Hub Paratech</strong>.<br>
          Em caso de dúvidas fiscais ou solicitação de novos relatórios, consulte o painel do cliente.
        </div>
      </div>
    </body>
    </html>
    `

    const subject = `📦 Fechamento Fiscal (${compFormatada}) - ${nomeEmpresa}`

    const result = await sendEmail({
      to: emailDestino,
      subject,
      html
    })

    return NextResponse.json({
      success: true,
      message: `Fechamento Fiscal enviado com sucesso para ${emailDestino}!`,
      destinatario: emailDestino,
      detalhes: result
    })

  } catch (err: any) {
    console.error('Erro ao enviar fechamento via E-mail (Resend):', err)
    return NextResponse.json({
      success: false,
      error: err.message || 'Falha ao comunicar com a API do Resend.'
    }, { status: 500 })
  }
}
