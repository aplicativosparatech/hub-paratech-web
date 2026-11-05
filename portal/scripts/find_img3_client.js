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

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function findClientImg3() {
  // Buscar notas com numero 3605, 3573, 3647 ou 3650
  const { data: notasNfce } = await supabase
    .from('nfce_saidas')
    .select('cliente_id, numero, chave, data_emissao')
    .in('numero', ['3572', '3573', '3574', '3604', '3606', '3634', '3636', '3646', '3651'])
    .limit(20);
  console.log('Notas NFCe encontradas:', notasNfce);

  const { data: notasNfe } = await supabase
    .from('nfe_saidas')
    .select('cliente_id, numero, chave, data_emissao')
    .in('numero', ['3572', '3573', '3574', '3604', '3606', '3634', '3636', '3646', '3651'])
    .limit(20);
  console.log('Notas NFe encontradas:', notasNfe);

  if (notasNfce && notasNfce.length > 0) {
    const cId = notasNfce[0].cliente_id;
    const { data: cliente } = await supabase
      .from('clientes')
      .select('id, razao_social, nome_fantasia, cnpj')
      .eq('id', cId)
      .single();
    console.log('Cliente encontrado da Imagem 3:', cliente);
  }
}

findClientImg3().catch(console.error);
