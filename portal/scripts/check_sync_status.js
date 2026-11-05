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
  const fernandaId = 'c4c45462-5122-4c64-b2c0-0aff981bf160';
  const { data: configFernanda } = await supabase
    .from('configuracoes_hub')
    .select('*')
    .eq('cliente_id', fernandaId)
    .single();
  console.log('Config Fernanda:', {
    versao_hub_instalada: configFernanda?.versao_hub_instalada,
    ultima_sincronizacao: configFernanda?.ultima_sincronizacao,
    comando_remoto: configFernanda?.comando_remoto,
    comando_remoto_em: configFernanda?.comando_remoto_em,
    pastas_vendas: configFernanda?.pastas_vendas
  });

  const { data: clientesRecentes } = await supabase
    .from('configuracoes_hub')
    .select('cliente_id, versao_hub_instalada, ultima_sincronizacao, comando_remoto, clientes(razao_social, cnpj)')
    .not('ultima_sincronizacao', 'is', null)
    .order('ultima_sincronizacao', { ascending: false });
  console.log('Clientes que sincronizaram:', clientesRecentes);
}

main().catch(console.error);
