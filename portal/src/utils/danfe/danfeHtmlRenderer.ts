import { DanfeData } from './danfeParser';

function formatMoney(val: number): string {
  return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatCnpjCpf(doc?: string): string {
  if (!doc) return '-';
  const c = doc.replace(/\D/g, '');
  if (c.length === 14) return c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  if (c.length === 11) return c.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  return doc;
}

function formatChave(chave: string): string {
  if (!chave || chave.length !== 44) return chave || '-';
  return chave.replace(/(\d{4})/g, '$1 ').trim();
}

function formatDate(iso?: string): string {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

// RENDERIZADOR COMPLETO DE DANFE NF-e (MODELO 55)
export function renderDanfeNfeHtml(data: DanfeData): string {
  const chaveFormatada = formatChave(data.chave);
  const logoHtml = data.emitente.logoUrl 
    ? `<img src="${data.emitente.logoUrl}" alt="Logomarca" class="danfe-logo" />`
    : `<div class="danfe-logo-placeholder">${data.emitente.razaoSocial.charAt(0)}</div>`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>DANFE - NF-e Nº ${data.numero} - ${data.emitente.razaoSocial}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 8px; color: #000; background: #e2e8f0; }
    
    /* Barra de Ações do Topo (Ocultada na Impressão) */
    .action-bar {
      position: sticky; top: 0; z-index: 100;
      background: #1e293b; color: #fff; padding: 12px 24px;
      display: flex; align-items: center; justify-content: space-between;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.2); font-family: sans-serif;
    }
    .action-bar-title { font-size: 14px; font-weight: bold; display: flex; items-center; gap: 8px; }
    .action-btn {
      background: #2563eb; color: #fff; border: none; padding: 8px 16px;
      border-radius: 8px; font-size: 12px; font-weight: bold; cursor: pointer;
      display: inline-flex; align-items: center; gap: 6px; transition: background 0.2s;
    }
    .action-btn:hover { background: #1d4ed8; }
    .action-btn-secondary { background: #475569; }
    .action-btn-secondary:hover { background: #334155; }

    /* Folha da DANFE em A4 */
    .danfe-sheet {
      width: 210mm; min-height: 297mm; padding: 5mm;
      margin: 15px auto; background: #fff; border: 1px solid #cbd5e1;
      box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
    }

    /* Bordas e Caixas da DANFE Oficial */
    .box { border: 1px solid #000; padding: 2px 3px; margin-bottom: 2px; }
    .box-title { font-size: 6px; font-weight: bold; text-transform: uppercase; margin-bottom: 1px; color: #222; }
    .box-content { font-size: 8px; font-weight: bold; min-height: 10px; }
    .section-title { font-size: 7.5px; font-weight: bold; text-transform: uppercase; background: #fff; padding: 2px 0 1px 0; margin-top: 3px; }

    .flex { display: flex; }
    .flex-1 { flex: 1; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }

    /* Cabeçalho */
    .danfe-logo { max-width: 90px; max-height: 55px; object-fit: contain; }
    .danfe-logo-placeholder {
      width: 45px; height: 45px; background: #0284c7; color: #fff;
      display: flex; align-items: center; justify-content: center;
      font-size: 22px; font-weight: bold; border-radius: 6px; margin: 0 auto;
    }

    /* Tabela de Itens */
    .items-table { width: 100%; border-collapse: collapse; margin-top: 2px; }
    .items-table th { border: 1px solid #000; font-size: 6.5px; font-weight: bold; padding: 2px; background: #f1f5f9; text-transform: uppercase; }
    .items-table td { border: 1px solid #000; font-size: 7px; padding: 2px 3px; }

    /* Código de Barras */
    .barcode-container { height: 40px; margin: 2px 0; }

    @media print {
      body { background: #fff; }
      .action-bar { display: none !important; }
      .danfe-sheet { width: 100%; margin: 0; padding: 0; border: none; box-shadow: none; }
      @page { size: A4 portrait; margin: 5mm; }
    }
  </style>
</head>
<body>

  <!-- Barra de Ações Superior -->
  <div class="action-bar">
    <div class="action-bar-title">
      <span>📄 DANFE - NF-e Nº ${data.numero} (Série ${data.serie})</span>
    </div>
    <div style="display:flex; gap: 8px;">
      <button onclick="window.print()" class="action-btn">
        🖨️ Imprimir / Salvar PDF
      </button>
      <button onclick="window.close()" class="action-btn action-btn-secondary">
        ✕ Fechar
      </button>
    </div>
  </div>

  <!-- Folha Principal -->
  <div class="danfe-sheet">
    
    <!-- Canhoto de Recebimento -->
    <div class="flex box" style="margin-bottom: 4px;">
      <div style="width: 80%; border-right: 1px solid #000; padding-right: 4px;">
        <div style="font-size: 6px;">
          RECEBEMOS DE ${data.emitente.razaoSocial} OS PRODUTOS/SERVIÇOS CONSTANTES DA NOTA FISCAL INDICADA AO LADO
        </div>
        <div class="flex" style="margin-top: 4px;">
          <div style="width: 30%; border-right: 1px solid #000; padding-right: 3px;">
            <div class="box-title">DATA DE RECEBIMENTO</div>
            <div style="height: 12px;"></div>
          </div>
          <div style="width: 70%; padding-left: 4px;">
            <div class="box-title">IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR</div>
            <div style="height: 12px;"></div>
          </div>
        </div>
      </div>
      <div style="width: 20%; text-align: center; padding-left: 4px;">
        <div style="font-weight: bold; font-size: 9px;">NF-e</div>
        <div style="font-weight: bold; font-size: 11px; margin: 2px 0;">Nº ${data.numero}</div>
        <div style="font-size: 7px;">Série ${data.serie}</div>
      </div>
    </div>

    <!-- Cabeçalho Principal (Emitente, DANFE, Código de Barras) -->
    <div class="flex" style="gap: 3px;">
      
      <!-- Emitente e Logo -->
      <div class="box flex" style="width: 48%; gap: 6px; align-items: center;">
        <div style="width: 35%; text-align: center;">
          ${logoHtml}
        </div>
        <div style="width: 65%; font-size: 7px; line-height: 1.2;">
          <div style="font-weight: bold; font-size: 9px; margin-bottom: 2px;">${data.emitente.razaoSocial}</div>
          <div>${data.emitente.logradouro}, ${data.emitente.numero} ${data.emitente.complemento || ''}</div>
          <div>${data.emitente.bairro} - ${data.emitente.municipio}/${data.emitente.uf}</div>
          <div>CEP: ${data.emitente.cep} - Fone: ${data.emitente.telefone || '-'}</div>
        </div>
      </div>

      <!-- Quadro DANFE Oficial -->
      <div class="box text-center" style="width: 17%; padding: 3px;">
        <div style="font-weight: bold; font-size: 12px;">DANFE</div>
        <div style="font-size: 6.5px; line-height: 1.1; margin: 2px 0;">
          Documento Auxiliar da Nota Fiscal Eletrônica
        </div>
        <div class="flex" style="justify-content: center; gap: 4px; margin: 3px 0; font-size: 7px;">
          <div>0 - Entrada<br>1 - Saída</div>
          <div style="border: 1px solid #000; width: 14px; height: 16px; font-size: 11px; font-weight: bold; line-height: 16px;">
            ${data.tipoOperacao}
          </div>
        </div>
        <div style="font-size: 8px; font-weight: bold;">Nº ${data.numero}</div>
        <div style="font-size: 7.5px;">SÉRIE ${data.serie}</div>
        <div style="font-size: 6.5px;">Folha 1/1</div>
      </div>

      <!-- Chave de Acesso e Código de Barras -->
      <div class="box" style="width: 35%;">
        <div class="barcode-container">
          ${data.barcodeSvg || ''}
        </div>
        <div class="box-title">CHAVE DE ACESSO</div>
        <div style="font-size: 7px; font-family: monospace; font-weight: bold; letter-spacing: 0.5px;">
          ${chaveFormatada}
        </div>
        <div style="font-size: 6.5px; text-align: center; margin-top: 3px;">
          Consulta de autenticidade no portal nacional da NF-e:<br>
          <strong>www.nfe.fazenda.gov.br/portal</strong> ou no site da Sefaz Autorizadora
        </div>
      </div>

    </div>

    <!-- Natureza da Operação e Protocolo -->
    <div class="flex" style="gap: 3px;">
      <div class="box flex-1">
        <div class="box-title">NATUREZA DA OPERAÇÃO</div>
        <div class="box-content">${data.naturezaOperacao}</div>
      </div>
      <div class="box" style="width: 35%;">
        <div class="box-title">PROTOCOLO DE AUTORIZAÇÃO DE USO</div>
        <div class="box-content">${data.protocolo || 'AUTORIZADA'} - ${formatDate(data.dataProtocolo || data.dataEmissao)}</div>
      </div>
    </div>

    <!-- Inscrição Estadual e CNPJ Emitente -->
    <div class="flex" style="gap: 3px;">
      <div class="box flex-1">
        <div class="box-title">INSCRIÇÃO ESTADUAL</div>
        <div class="box-content">${data.emitente.inscricaoEstadual}</div>
      </div>
      <div class="box flex-1">
        <div class="box-title">INSCRIÇÃO ESTADUAL DO SUBST. TRIB.</div>
        <div class="box-content">-</div>
      </div>
      <div class="box flex-1">
        <div class="box-title">CNPJ</div>
        <div class="box-content">${formatCnpjCpf(data.emitente.cnpjCpf)}</div>
      </div>
    </div>

    <!-- DESTINATÁRIO / REMETENTE -->
    <div class="section-title">DESTINATÁRIO / REMETENTE</div>
    <div class="flex" style="gap: 3px;">
      <div class="box" style="width: 60%;">
        <div class="box-title">NOME / RAZÃO SOCIAL</div>
        <div class="box-content">${data.destinatario?.razaoSocial || 'CONSUMIDOR FINAL'}</div>
      </div>
      <div class="box" style="width: 25%;">
        <div class="box-title">CNPJ / CPF</div>
        <div class="box-content">${formatCnpjCpf(data.destinatario?.cnpjCpf)}</div>
      </div>
      <div class="box" style="width: 15%;">
        <div class="box-title">DATA DA EMISSÃO</div>
        <div class="box-content">${formatDate(data.dataEmissao).slice(0, 10)}</div>
      </div>
    </div>

    <div class="flex" style="gap: 3px;">
      <div class="box" style="width: 45%;">
        <div class="box-title">ENDEREÇO</div>
        <div class="box-content">${data.destinatario?.logradouro || '-'}, ${data.destinatario?.numero || ''}</div>
      </div>
      <div class="box" style="width: 25%;">
        <div class="box-title">BAIRRO / DISTRITO</div>
        <div class="box-content">${data.destinatario?.bairro || '-'}</div>
      </div>
      <div class="box" style="width: 15%;">
        <div class="box-title">CEP</div>
        <div class="box-content">${data.destinatario?.cep || '-'}</div>
      </div>
      <div class="box" style="width: 15%;">
        <div class="box-title">DATA SAÍDA / ENTRADA</div>
        <div class="box-content">${formatDate(data.dataSaidaEntrada || data.dataEmissao).slice(0, 10)}</div>
      </div>
    </div>

    <!-- CÁLCULO DO IMPOSTO -->
    <div class="section-title">CÁLCULO DO IMPOSTO</div>
    <div class="flex" style="gap: 3px;">
      <div class="box flex-1">
        <div class="box-title">BASE DE CÁLCULO DO ICMS</div>
        <div class="box-content text-right">${formatMoney(data.totais.baseIcms)}</div>
      </div>
      <div class="box flex-1">
        <div class="box-title">VALOR DO ICMS</div>
        <div class="box-content text-right">${formatMoney(data.totais.valorIcms)}</div>
      </div>
      <div class="box flex-1">
        <div class="box-title">BASE CÁLCULO ICMS ST</div>
        <div class="box-content text-right">${formatMoney(data.totais.baseIcmsSt)}</div>
      </div>
      <div class="box flex-1">
        <div class="box-title">VALOR DO ICMS ST</div>
        <div class="box-content text-right">${formatMoney(data.totais.valorIcmsSt)}</div>
      </div>
      <div class="box flex-1">
        <div class="box-title">VALOR TOTAL DOS PRODUTOS</div>
        <div class="box-content text-right">${formatMoney(data.totais.valorProdutos)}</div>
      </div>
    </div>

    <div class="flex" style="gap: 3px;">
      <div class="box flex-1">
        <div class="box-title">VALOR DO FRETE</div>
        <div class="box-content text-right">${formatMoney(data.totais.valorFrete)}</div>
      </div>
      <div class="box flex-1">
        <div class="box-title">VALOR DO SEGURO</div>
        <div class="box-content text-right">${formatMoney(data.totais.valorSeguro)}</div>
      </div>
      <div class="box flex-1">
        <div class="box-title">DESCONTO</div>
        <div class="box-content text-right">${formatMoney(data.totais.desconto)}</div>
      </div>
      <div class="box flex-1">
        <div class="box-title">OUTRAS DESPESAS</div>
        <div class="box-content text-right">${formatMoney(data.totais.outrasDespesas)}</div>
      </div>
      <div class="box flex-1">
        <div class="box-title">VALOR DO IPI</div>
        <div class="box-content text-right">${formatMoney(data.totais.valorIpi)}</div>
      </div>
      <div class="box flex-1" style="background: #f8fafc;">
        <div class="box-title" style="color: #000;">VALOR TOTAL DA NOTA</div>
        <div class="box-content text-right" style="font-size: 10px; font-weight: 900;">R$ ${formatMoney(data.totais.valorTotalNota)}</div>
      </div>
    </div>

    <!-- DADOS DOS PRODUTOS / SERVIÇOS -->
    <div class="section-title">DADOS DOS PRODUTOS / SERVIÇOS</div>
    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 7%;">CÓDIGO</th>
          <th style="width: 35%;">DESCRIÇÃO DO PRODUTO / SERVIÇO</th>
          <th style="width: 8%;">NCM/SH</th>
          <th style="width: 5%;">CST</th>
          <th style="width: 5%;">CFOP</th>
          <th style="width: 4%;">UNID</th>
          <th style="width: 6%;">QTD</th>
          <th style="width: 8%;">VLR. UNIT</th>
          <th style="width: 8%;">VLR. TOTAL</th>
          <th style="width: 7%;">BC ICMS</th>
          <th style="width: 7%;">VLR. ICMS</th>
        </tr>
      </thead>
      <tbody>
        ${data.itens.map(item => `
          <tr>
            <td style="font-family: monospace;">${item.codigo || '-'}</td>
            <td><strong>${item.descricao}</strong></td>
            <td style="font-family: monospace; text-align: center;">${item.ncm}</td>
            <td style="text-align: center;">${item.cstCsosn || '-'}</td>
            <td style="text-align: center;">${item.cfop}</td>
            <td style="text-align: center;">${item.unidade}</td>
            <td style="text-align: right;">${item.quantidade}</td>
            <td style="text-align: right;">${formatMoney(item.valorUnitario)}</td>
            <td style="text-align: right; font-weight: bold;">${formatMoney(item.valorTotal)}</td>
            <td style="text-align: right;">${formatMoney(item.baseIcms)}</td>
            <td style="text-align: right;">${formatMoney(item.valorIcms)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <!-- DADOS ADICIONAIS -->
    <div class="section-title" style="margin-top: 6px;">DADOS ADICIONAIS</div>
    <div class="box" style="min-height: 45px;">
      <div class="box-title">INFORMAÇÕES COMPLEMENTARES / FISCO</div>
      <div style="font-size: 7px; line-height: 1.25; color: #333;">
        ${data.dadosAdicionais || 'DOCUMENTO EMITIDO POR ME OU EPP OPTANTE PELO SIMPLES NACIONAL. NÃO GERA DIREITO A CRÉDITO FISCAL DE IPI.'}
      </div>
    </div>

  </div>

</body>
</html>`;
}

// RENDERIZADOR OFICIAL DE DANFE NFC-e (MODELO 65) - CUPOM TÉRMICO E A4
export function renderDanfeNfceHtml(data: DanfeData): string {
  const chaveFormatada = formatChave(data.chave);
  const logoHtml = data.emitente.logoUrl 
    ? `<img src="${data.emitente.logoUrl}" alt="Logomarca" class="nfce-logo" />` 
    : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>DANFE NFC-e Nº ${data.numero} - ${data.emitente.razaoSocial}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Courier New', Courier, monospace; font-size: 11px; background: #e2e8f0; color: #000; }
    
    .action-bar {
      position: sticky; top: 0; z-index: 100;
      background: #1e293b; color: #fff; padding: 12px 24px;
      display: flex; align-items: center; justify-content: space-between;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.2); font-family: sans-serif;
    }
    .action-bar-title { font-size: 14px; font-weight: bold; }
    .action-btn {
      background: #2563eb; color: #fff; border: none; padding: 8px 16px;
      border-radius: 8px; font-size: 12px; font-weight: bold; cursor: pointer;
    }
    .action-btn:hover { background: #1d4ed8; }

    /* Cupom Fiscal Bobina 80mm centralizado */
    .nfce-cupom {
      width: 80mm; min-height: 120mm; margin: 20px auto; padding: 5mm;
      background: #fff; border: 1px dashed #94a3b8; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
      line-height: 1.25;
    }

    .nfce-header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 6px; }
    .nfce-logo { max-width: 120px; max-height: 50px; object-fit: contain; margin-bottom: 4px; }
    .nfce-title { font-weight: bold; font-size: 12px; }

    .line { border-top: 1px dashed #000; margin: 5px 0; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .flex-between { display: flex; justify-content: space-between; }

    .items-table { width: 100%; font-size: 10px; border-collapse: collapse; margin: 4px 0; }
    .items-table th { text-align: left; border-bottom: 1px dashed #000; font-size: 9px; padding-bottom: 2px; }
    .items-table td { padding: 2px 0; }

    .qr-container { text-align: center; margin: 8px 0; }
    .qr-container img { width: 140px; height: 140px; }

    @media print {
      body { background: #fff; }
      .action-bar { display: none !important; }
      .nfce-cupom { width: 80mm; margin: 0 auto; border: none; box-shadow: none; padding: 2mm; }
      @page { size: auto; margin: 2mm; }
    }
  </style>
</head>
<body>

  <div class="action-bar">
    <div class="action-bar-title">
      🧾 DANFE NFC-e Nº ${data.numero} (Cupom Fiscal)
    </div>
    <div style="display:flex; gap: 8px;">
      <button onclick="window.print()" class="action-btn">
        🖨️ Imprimir Cupom
      </button>
      <button onclick="window.close()" class="action-btn" style="background:#475569;">
        ✕ Fechar
      </button>
    </div>
  </div>

  <div class="nfce-cupom">
    
    <!-- Cabeçalho do Estabelecimento -->
    <div class="nfce-header">
      ${logoHtml}
      <div class="nfce-title">${data.emitente.razaoSocial}</div>
      <div>CNPJ: ${formatCnpjCpf(data.emitente.cnpjCpf)}</div>
      <div>IE: ${data.emitente.inscricaoEstadual}</div>
      <div>${data.emitente.logradouro}, ${data.emitente.numero} - ${data.emitente.bairro}</div>
      <div>${data.emitente.municipio}/${data.emitente.uf}</div>
    </div>

    <div class="text-center" style="font-weight: bold; font-size: 11px;">
      DANFE NFC-e - Documento Auxiliar da Nota Fiscal de Consumidor Eletrônica
    </div>
    <div class="text-center" style="font-size: 9px; margin-top: 2px;">
      Não permite aproveitamento de crédito de ICMS
    </div>

    <div class="line"></div>

    <!-- Itens -->
    <table class="items-table">
      <thead>
        <tr>
          <th>ITEM</th>
          <th>CÓD/DESC</th>
          <th style="text-align: right;">QTDxVL</th>
          <th style="text-align: right;">TOTAL</th>
        </tr>
      </thead>
      <tbody>
        ${data.itens.map(item => `
          <tr>
            <td>${item.nItem}</td>
            <td><strong>${item.descricao}</strong></td>
            <td style="text-align: right;">${item.quantidade}x${formatMoney(item.valorUnitario)}</td>
            <td style="text-align: right; font-weight: bold;">${formatMoney(item.valorTotal)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="line"></div>

    <!-- Totais -->
    <div class="flex-between" style="font-weight: bold;">
      <span>QTD. TOTAL DE ITENS:</span>
      <span>${data.itens.length}</span>
    </div>
    <div class="flex-between" style="font-size: 13px; font-weight: 900; margin: 3px 0;">
      <span>VALOR TOTAL R$:</span>
      <span>${formatMoney(data.totais.valorTotalNota)}</span>
    </div>

    <!-- Formas de Pagamento -->
    <div class="line"></div>
    <div style="font-weight: bold; font-size: 10px; margin-bottom: 2px;">FORMA DE PAGAMENTO:</div>
    ${data.pagamentos.map(p => `
      <div class="flex-between" style="font-size: 10px;">
        <span>${p.descricaoForma}:</span>
        <span>R$ ${formatMoney(p.valor)}</span>
      </div>
    `).join('')}

    <div class="line"></div>

    <!-- Informações da Consulta e Chave -->
    <div class="text-center" style="font-size: 9px;">
      Consulte pela Chave de Acesso em:<br>
      <strong>${data.emitente.uf === 'MG' ? 'https://portalsped.fazenda.mg.gov.br/portalnfce' : 'https://www.nfe.fazenda.gov.br'}</strong>
    </div>

    <div class="text-center" style="font-family: monospace; font-size: 9px; font-weight: bold; margin: 4px 0; word-break: break-all;">
      ${chaveFormatada}
    </div>

    <!-- Consumidor -->
    <div class="line"></div>
    <div style="font-size: 9px;">
      CONSUMIDOR: ${data.destinatario?.cnpjCpf ? formatCnpjCpf(data.destinatario.cnpjCpf) : 'CONSUMIDOR NÃO IDENTIFICADO'}<br>
      ${data.destinatario?.razaoSocial && data.destinatario.razaoSocial !== 'CONSUMIDOR NÃO IDENTIFICADO' ? data.destinatario.razaoSocial : ''}
    </div>

    <!-- Protocolo e Emissão -->
    <div class="line"></div>
    <div class="text-center" style="font-size: 9px;">
      NFC-e Nº ${data.numero} - Série ${data.serie} - Emissão: ${formatDate(data.dataEmissao)}<br>
      Protocolo de Autorização: ${data.protocolo || 'AUTORIZADA'}<br>
      Data de Autorização: ${formatDate(data.dataProtocolo || data.dataEmissao)}
    </div>

    <!-- QR Code Oficial -->
    ${data.qrCodeBase64 ? `
      <div class="qr-container">
        <img src="${data.qrCodeBase64}" alt="QR Code NFC-e" />
        <div style="font-size: 8px;">Consulta via leitor de QR Code</div>
      </div>
    ` : ''}

    <div class="text-center" style="font-size: 8px; margin-top: 6px; color: #475569;">
      Tributos Incidentes (Lei Federal 12.741/2012)<br>
      HubParatech Soluções Fiscais
    </div>

  </div>

</body>
</html>`;
}
