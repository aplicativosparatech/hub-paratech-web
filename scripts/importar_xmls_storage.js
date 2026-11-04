const { createClient } = require('../portal/node_modules/@supabase/supabase-js');

const supabaseAdmin = createClient(
  'https://mdjfzqlnkytmmibjgplb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1kamZ6cWxua3l0bW1pYmpncGxiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTAzNDU1NSwiZXhwIjoyMTA2NjEwNTU1fQ.koqUCVtDCFS8MoyGb4oZcSAwtm7JyuA6cxj3lDgDNpE'
);

function extractTag(xml, tag) {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`);
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

function extractChave(xml, fileName) {
  const tagChave = extractTag(xml, 'chNFe') || extractTag(xml, 'chCTe') || extractTag(xml, 'chMDFe');
  if (tagChave && tagChave.replace(/\D/g, '').length === 44) return tagChave.replace(/\D/g, '');

  const idMatch = xml.match(/Id\s*=\s*["'](?:NFe|NFCe|CTe|MDFe)?([A-Za-z0-9]{44})["']/i);
  if (idMatch && idMatch[1]) return idMatch[1].toUpperCase();

  if (fileName) {
    const fnMatch = fileName.match(/(\d{44})/);
    if (fnMatch) return fnMatch[1];
  }
  return null;
}

function calculateMonofasico(xml) {
  const detMatches = xml.match(/<det[^>]*>([\s\S]*?)<\/det>/g) || [];
  let totalMonofasico = 0;
  for (const det of detMatches) {
    const cstPis = extractTag(det, 'CST');
    const isPisMono = cstPis === '04' || cstPis === '06';
    if (isPisMono) {
      const vProd = extractTag(det, 'vProd');
      if (vProd) totalMonofasico += parseFloat(vProd);
    }
  }
  return totalMonofasico;
}

const FORMAS_PAGAMENTO_MAP = {
  '01': 'Dinheiro', '02': 'Cheque', '03': 'Cartão de Crédito', '04': 'Cartão de Débito',
  '05': 'Crédito Loja', '10': 'Vale Alimentação', '11': 'Vale Refeição', '12': 'Vale Presente',
  '13': 'Vale Combustível', '15': 'Boleto Bancário', '16': 'Depósito Bancário', '17': 'PIX',
  '18': 'Transferência bancária', '19': 'Programa de fidelidade', '20': 'PIX', '90': 'Sem Pagamento', '99': 'Outros'
};

function extrairFormasPagamento(xml, valorTotalNota) {
  const pagamentos = [];
  const detPagMatches = xml.match(/<detPag[^>]*>([\s\S]*?)<\/detPag>/g) || [];
  for (const det of detPagMatches) {
    const tPag = extractTag(det, 'tPag');
    const vPag = extractTag(det, 'vPag');
    if (tPag) {
      pagamentos.push({
        codigo: tPag,
        descricao: FORMAS_PAGAMENTO_MAP[tPag] || 'Outros',
        valor: vPag ? parseFloat(vPag) : 0
      });
    }
  }
  if (pagamentos.length === 0 && valorTotalNota > 0) {
    pagamentos.push({ codigo: '99', descricao: 'Outros', valor: valorTotalNota });
  }
  return pagamentos;
}

async function processarTodosXmls() {
  const clienteId = 'c4c45462-5122-4c64-b2c0-0aff981bf160';
  console.log('Iniciando varredura recursiva de arquivos no Storage para o cliente...');

  const allFilePaths = [];

  async function listRecursive(prefix) {
    const { data: items, error } = await supabaseAdmin.storage.from('xmls').list(prefix);
    if (error) { console.error('Erro ao listar:', prefix, error); return; }
    if (!items) return;
    for (const item of items) {
      if (item.id) {
        allFilePaths.push(`${prefix}/${item.name}`);
      } else {
        await listRecursive(`${prefix}/${item.name}`);
      }
    }
  }

  await listRecursive(clienteId);
  console.log(`Encontrados ${allFilePaths.length} arquivos XML no Storage.`);

  let inseridos = 0;
  let erros = 0;
  let ignorados = 0;

  // Processa em lotes de 20 para rapidez e estabilidade
  const batchSize = 25;
  for (let i = 0; i < allFilePaths.length; i += batchSize) {
    const batch = allFilePaths.slice(i, i + batchSize);
    
    await Promise.all(batch.map(async (filePath) => {
      try {
        const { data: blob, error: dlErr } = await supabaseAdmin.storage.from('xmls').download(filePath);
        if (dlErr || !blob) {
          erros++;
          return;
        }

        const xmlString = await blob.text();
        const fileName = filePath.split('/').pop();
        const chave = extractChave(xmlString, fileName);
        if (!chave || chave.length !== 44) {
          ignorados++;
          return;
        }

        const mod = extractTag(xmlString, 'mod') || chave.substring(20, 22);
        const serie = extractTag(xmlString, 'serie') || String(parseInt(chave.substring(22, 25), 10) || 1);
        const numero = extractTag(xmlString, 'nNF') || String(parseInt(chave.substring(25, 34), 10) || 0);
        const valor = extractTag(xmlString, 'vNF');
        const emissao = extractTag(xmlString, 'dhEmi') || extractTag(xmlString, 'dEmi');
        const transmissao = extractTag(xmlString, 'dhRecbto');
        const temAssinatura = xmlString.includes('<Signature');
        const cStat = extractTag(xmlString, 'cStat');
        const xMotivo = extractTag(xmlString, 'xMotivo');
        const nProt = extractTag(xmlString, 'nProt');
        const isAutorizada = (cStat === '100' || xmlString.includes('Autorizado o uso')) && temAssinatura;

        const emitMatch = xmlString.match(/<emit[^>]*>([\s\S]*?)<\/emit>/);
        const emitXml = emitMatch ? emitMatch[1] : '';
        const cnpjEmitente = extractTag(emitXml, 'CNPJ') || extractTag(emitXml, 'CPF');
        const xNomeEmitente = extractTag(emitXml, 'xNome');

        const destMatch = xmlString.match(/<dest[^>]*>([\s\S]*?)<\/dest>/);
        const destXml = destMatch ? destMatch[1] : '';
        const cnpjDestinatario = extractTag(destXml, 'CNPJ') || extractTag(destXml, 'CPF');
        const xNomeDestinatario = extractTag(destXml, 'xNome');

        const valorTotalNum = valor ? parseFloat(valor) : 0;
        const formasPagamento = extrairFormasPagamento(xmlString, valorTotalNum);
        const valorMonofasico = calculateMonofasico(xmlString);

        const tabela = mod === '65' ? 'nfce_saidas' : 'nfe_saidas';

        const dbPayload = {
          cliente_id: clienteId,
          numero: numero || null,
          chave: chave,
          valor: valorTotalNum,
          data_emissao: emissao || null,
          data_transmissao: transmissao || null,
          tem_assinatura: temAssinatura,
          storage_path: filePath,
          is_autorizada: isAutorizada,
          valor_monofasico: valorMonofasico,
          cnpj_emitente: cnpjEmitente || null,
          cnpj_destinatario: cnpjDestinatario || null,
          destinatario_documento: cnpjDestinatario || null,
          destinatario_nome: xNomeDestinatario || (mod === '65' && !cnpjDestinatario ? 'Consumidor Final' : null),
          emitente_nome: xNomeEmitente || null,
          cnpj_divergente: false,
          motivo_divergencia: null,
          status_correcao: null,
          serie: serie,
          cstat: cStat || '100',
          motivo_sefaz: xMotivo || 'Autorizado o uso da NF-e',
          protocolo: nProt || null,
          formas_pagamento: formasPagamento
        };

        const { error: insErr } = await supabaseAdmin.from(tabela).upsert(dbPayload, { onConflict: 'chave' });
        if (insErr) {
          console.error(`Erro ao inserir ${chave}:`, insErr.message);
          erros++;
        } else {
          inseridos++;
        }
      } catch (e) {
        erros++;
      }
    }));

    console.log(`Progresso: ${Math.min(i + batchSize, allFilePaths.length)} / ${allFilePaths.length} processados... (${inseridos} inseridos com sucesso)`);
  }

  console.log(`\n=== FINALIZADO COM SUCESSO ===`);
  console.log(`Total Inseridos no Banco: ${inseridos}`);
  console.log(`Total Erros: ${erros}`);
  console.log(`Total Ignorados: ${ignorados}`);
}

processarTodosXmls();
