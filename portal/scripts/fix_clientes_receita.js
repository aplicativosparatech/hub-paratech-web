const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split(/\r?\n/).forEach(line => {
  const idx = line.indexOf('=');
  if (idx > 0) {
    const k = line.substring(0, idx).trim();
    let v = line.substring(idx + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.substring(1, v.length - 1);
    }
    env[k] = v;
  }
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

function limparDocumento(doc) {
  return String(doc || '').replace(/[^\w]/g, '').trim();
}

async function consultarCnpj(cnpjLimpo) {
  // 1. Tenta publica.cnpj.ws
  try {
    const res = await fetch(`https://publica.cnpj.ws/cnpj/${cnpjLimpo}`, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'HubParatech/2.5' }
    });
    if (res.ok) {
      const d = await res.json();
      const est = d.estabelecimento;
      let ie = '';
      if (Array.isArray(est?.inscricoes_estaduais) && est.inscricoes_estaduais.length > 0) {
        const ativa = est.inscricoes_estaduais.find(i => i.ativo);
        ie = (ativa || est.inscricoes_estaduais[0])?.inscricao_estadual || '';
      }
      return {
        razao_social: d.razao_social || '',
        nome_fantasia: est?.nome_fantasia || d.razao_social || '',
        cidade: est?.cidade?.nome || '',
        uf: est?.estado?.sigla || '',
        cep: est?.cep || '',
        logradouro: `${est?.tipo_logradouro || ''} ${est?.logradouro || ''}`.trim(),
        numero: est?.numero || '',
        bairro: est?.bairro || '',
        inscricao_estadual: ie,
        ramo_atividade: est?.atividade_principal?.descricao || '',
        telefone: est?.ddd1 && est?.telefone1 ? `(${est.ddd1}) ${est.telefone1}` : '',
        whatsapp: est?.ddd1 && est?.telefone1 ? `55${est.ddd1}${est.telefone1.replace(/\D/g, '')}` : '',
        email_fiscal: est?.email || ''
      };
    }
  } catch (err) {}

  // 2. Fallback BrasilAPI
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'HubParatech/2.5' }
    });
    if (res.ok) {
      const d = await res.json();
      return {
        razao_social: d.razao_social || '',
        nome_fantasia: d.nome_fantasia || d.razao_social || '',
        cidade: d.municipio || '',
        uf: d.uf || '',
        cep: d.cep || '',
        logradouro: `${d.descricao_tipo_de_logradouro || ''} ${d.logradouro || ''}`.trim(),
        numero: d.numero || '',
        bairro: d.bairro || '',
        ramo_atividade: d.cnae_fiscal_descricao || '',
        telefone: d.ddd_telefone_1 ? `(${d.ddd_telefone_1.slice(0, 2)}) ${d.ddd_telefone_1.slice(2)}` : '',
        whatsapp: d.ddd_telefone_1 ? `55${d.ddd_telefone_1.replace(/\D/g, '')}` : '',
        email_fiscal: d.email || ''
      };
    }
  } catch (err) {}

  // 3. Fallback ReceitaWS
  try {
    const res = await fetch(`https://receitaws.com.br/v1/cnpj/${cnpjLimpo}`, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'HubParatech/2.5' }
    });
    if (res.ok) {
      const d = await res.json();
      if (d.status !== 'ERROR') {
        return {
          razao_social: d.nome || '',
          nome_fantasia: d.fantasia || d.nome || '',
          cidade: d.municipio || '',
          uf: d.uf || '',
          cep: d.cep || '',
          logradouro: d.logradouro || '',
          numero: d.numero || '',
          bairro: d.bairro || '',
          ramo_atividade: d.atividade_principal?.[0]?.text || '',
          telefone: d.telefone || '',
          whatsapp: (d.telefone || '').replace(/\D/g, ''),
          email_fiscal: d.email || ''
        };
      }
    }
  } catch (err) {}

  return null;
}

async function main() {
  const { data: clientes, error } = await supabase.from('clientes').select('*');
  if (error) {
    console.error('Erro ao ler clientes:', error);
    return;
  }

  console.log(`Verificando ${clientes.length} clientes...`);

  for (const c of clientes) {
    const docLimpo = limparDocumento(c.cnpj);
    if (!docLimpo || docLimpo.length !== 14) continue;

    // Se o cliente tem nome fictício (ex: contém "0142", "0121", "0113", "0107", "0169", "0148", "0165", etc.)
    const ehFicticio = /\b\d{4}\b/.test(c.razao_social) || 
                       c.razao_social.includes('PADARIA & CONFEITARIA CENTRAL') ||
                       c.razao_social.includes('LOJA DE MATERIAIS DE CONSTRUCAO') ||
                       c.razao_social.includes('DISTRIBUIDORA DE BEBIDAS 0') ||
                       c.razao_social.includes('DROGARIA & FARMACIA POPULAR 0') ||
                       c.razao_social.includes('RESTAURANTE & CHURRASCARIA 0') ||
                       c.razao_social.includes('SUPERMERCADO & CONVENIENCIA 0');

    if (ehFicticio) {
      console.log(`[ATUALIZAR] CNPJ: ${c.cnpj} (Nome atual: "${c.razao_social}")`);
      const dadosReais = await consultarCnpj(docLimpo);
      if (dadosReais && dadosReais.razao_social) {
        console.log(`  -> DADOS REAIS ENCONTRADOS: "${dadosReais.razao_social}" (Fantasia: "${dadosReais.nome_fantasia}")`);
        const updatePayload = {
          razao_social: dadosReais.razao_social,
          nome_fantasia: dadosReais.nome_fantasia || dadosReais.razao_social,
          cidade: dadosReais.cidade || c.cidade,
          uf: dadosReais.uf || c.uf,
          cep: dadosReais.cep || c.cep,
          logradouro: dadosReais.logradouro || c.logradouro,
          numero: dadosReais.numero || c.numero,
          bairro: dadosReais.bairro || c.bairro,
          ramo_atividade: dadosReais.ramo_atividade || c.ramo_atividade
        };
        if (dadosReais.inscricao_estadual) updatePayload.inscricao_estadual = dadosReais.inscricao_estadual;
        if (dadosReais.telefone) updatePayload.whatsapp = dadosReais.whatsapp || dadosReais.telefone;
        if (dadosReais.email_fiscal) updatePayload.email_fiscal = dadosReais.email_fiscal;

        const { error: updErr } = await supabase.from('clientes').update(updatePayload).eq('id', c.id);
        if (updErr) {
          console.error(`  Erro ao atualizar cliente ${c.id}:`, updErr);
        } else {
          console.log(`  -> Atualizado com sucesso no banco!`);
        }
      } else {
        console.log(`  -> Não foi possível consultar dados na RFB para ${c.cnpj}`);
      }
      // Pausa para respeitar rate limits das APIs
      await new Promise(r => setTimeout(r, 600));
    }
  }

  console.log('--- Concluído ---');
}

main();
