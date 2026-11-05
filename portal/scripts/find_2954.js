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

async function find2954() {
  const { data: inut } = await supabase
    .from('inutilizacoes')
    .select('*')
    .eq('cliente_id', 'c4c45462-5122-4c64-b2c0-0aff981bf160')
    .order('created_at', { ascending: false });
  console.log('Inutilizacoes da Fernanda:', inut);
}

find2954().catch(console.error);
