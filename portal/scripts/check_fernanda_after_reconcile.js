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

async function checkNotas() {
  const fernandaId = 'c4c45462-5122-4c64-b2c0-0aff981bf160';
  const { count: totalNotas } = await supabase
    .from('nfce_saidas')
    .select('*', { count: 'exact', head: true })
    .eq('cliente_id', fernandaId);

  console.log('Total notas Fernanda no banco AGORA:', totalNotas);

  // Verificar especificamente se as notas 4568 a 4574, 4728 a 4791, 4892 a 4895 ou 2954 subiram
  const { data: notasVerificadas } = await supabase
    .from('nfce_saidas')
    .select('numero, chave, data_emissao, created_at')
    .eq('cliente_id', fernandaId)
    .in('numero', ['2954', '4568', '4569', '4570', '4728', '4729', '4892', '4893'])
    .order('created_at', { ascending: false });

  console.log('Notas especificas conferidas:', notasVerificadas);

  // Ver os ultimos uploads de nfce_saidas da Fernanda
  const { data: ultimasCriadas } = await supabase
    .from('nfce_saidas')
    .select('numero, chave, data_emissao, created_at')
    .eq('cliente_id', fernandaId)
    .order('created_at', { ascending: false })
    .limit(10);
  console.log('Ultimas criadas no banco:', ultimasCriadas);
}

checkNotas().catch(console.error);
