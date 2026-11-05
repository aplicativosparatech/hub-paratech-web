const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('portal/.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const parts = line.split('=');
  const k = parts[0];
  const v = parts.slice(1).join('=');
  if (k && v) env[k.trim()] = v.trim().replace(/^["']|["']$/g, '');
});

const supabaseAdmin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function testGaps() {
  const tokenFernanda = '4efd6ae978eb30669b36336e8b4e427d'; // vamos buscar o token da Fernanda
  const { data: cliente } = await supabaseAdmin
    .from('clientes')
    .select('id, razao_social, hub_token, data_inicio_monitoramento, numero_inicial_nfe, numero_inicial_nfce')
    .eq('id', 'c4c45462-5122-4c64-b2c0-0aff981bf160')
    .single();

  console.log('Cliente:', cliente);

  // Buscar todas as notas de Fernanda
  let allNotas = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    let q = supabaseAdmin
      .from('nfce_saidas')
      .select('id, numero, chave, data_emissao')
      .eq('cliente_id', cliente.id)
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);
    
    if (cliente.data_inicio_monitoramento) {
      q = q.gte('data_emissao', cliente.data_inicio_monitoramento);
    }

    const { data, error } = await q;
    if (error || !data || data.length === 0) break;
    allNotas.push(...data);
    from += pageSize;
    if (data.length < pageSize) break;
  }

  console.log('Total notas carregadas:', allNotas.length);

  const minNum = cliente.numero_inicial_nfce || 1;
  const nums = [];
  for (const n of allNotas) {
    let num = null;
    if (n.chave && n.chave.length === 44) {
      num = parseInt(n.chave.substring(25, 34), 10);
    } else if (n.numero) {
      num = parseInt(String(n.numero).replace(/\D/g, ''), 10);
    }
    if (num && !isNaN(num) && num >= minNum) {
      nums.push(num);
    }
  }

  const sortedNums = Array.from(new Set(nums)).sort((a, b) => a - b);
  console.log(`Menor nota: ${sortedNums[0]}, Maior nota: ${sortedNums[sortedNums.length - 1]}`);

  const gaps = [];
  // Gaps intermediários
  for (let i = 0; i < sortedNums.length - 1; i++) {
    const atual = sortedNums[i];
    const prox = sortedNums[i + 1];
    if (prox - atual > 1) {
      gaps.push({
        numero_inicial: atual + 1,
        numero_final: prox - 1,
        quantidade: prox - atual - 1
      });
    }
  }

  console.log('Gaps encontrados:', gaps);
}

testGaps().catch(console.error);
