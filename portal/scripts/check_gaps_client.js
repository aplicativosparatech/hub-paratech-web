const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf-8');
const envVars = {};
env.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    value = value.trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    envVars[match[1]] = value;
  }
});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const cliId = 'c4c45462-5122-4c64-b2c0-0aff981bf160';
  
  // Notas em volta de 4568-4574
  const { data: n4567 } = await supabase.from('nfce_saidas').select('numero, chave, data_emissao, created_at').eq('cliente_id', cliId).eq('numero', '4567');
  const { data: n4575 } = await supabase.from('nfce_saidas').select('numero, chave, data_emissao, created_at').eq('cliente_id', cliId).eq('numero', '4575');
  console.log('4567:', n4567);
  console.log('4575:', n4575);

  // Notas em volta de 4728-4791
  const { data: n4727 } = await supabase.from('nfce_saidas').select('numero, chave, data_emissao, created_at').eq('cliente_id', cliId).eq('numero', '4727');
  const { data: n4792 } = await supabase.from('nfce_saidas').select('numero, chave, data_emissao, created_at').eq('cliente_id', cliId).eq('numero', '4792');
  console.log('4727:', n4727);
  console.log('4792:', n4792);

  // Notas em volta de 4892-4895
  const { data: n4891 } = await supabase.from('nfce_saidas').select('numero, chave, data_emissao, created_at').eq('cliente_id', cliId).eq('numero', '4891');
  const { data: n4896 } = await supabase.from('nfce_saidas').select('numero, chave, data_emissao, created_at').eq('cliente_id', cliId).eq('numero', '4896');
  console.log('4891:', n4891);
  console.log('4896:', n4896);
}
check();
