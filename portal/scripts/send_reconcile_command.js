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

async function setReconcileCommand() {
  const fernandaId = 'c4c45462-5122-4c64-b2c0-0aff981bf160';
  const { data, error } = await supabase
    .from('configuracoes_hub')
    .update({
      comando_remoto: 'reconciliar_gaps',
      comando_remoto_em: new Date().toISOString()
    })
    .eq('cliente_id', fernandaId)
    .select();

  if (error) {
    console.error('Erro ao agendar comando:', error);
  } else {
    console.log('Comando reconciliar_gaps agendado com sucesso para Fernanda Pinto!', data);
  }
}

setReconcileCommand().catch(console.error);
