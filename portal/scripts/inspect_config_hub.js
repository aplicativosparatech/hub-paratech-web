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

async function main() {
  const { data: config } = await supabase
    .from('configuracoes_hub')
    .select('*')
    .limit(1);
  if (config && config.length > 0) {
    console.log('Colunas de configuracoes_hub:', Object.keys(config[0]));
    console.log('Exemplo de registro:', config[0]);
  }

  const { data: hubLogs } = await supabase
    .from('hub_sync_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);
  console.log('Ultimos hub_sync_logs:', hubLogs);
}

main().catch(console.error);
