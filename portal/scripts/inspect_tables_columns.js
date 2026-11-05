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
  const { data: rowNfce } = await supabase.from('nfce_saidas').select('*').limit(1);
  if (rowNfce && rowNfce.length > 0) {
    console.log('Colunas de nfce_saidas:', Object.keys(rowNfce[0]));
    console.log('Exemplo nfce_saidas:', {
      numero: rowNfce[0].numero,
      numero_nota: rowNfce[0].numero_nota,
      chave: rowNfce[0].chave,
      chave_acesso: rowNfce[0].chave_acesso,
      serie: rowNfce[0].serie
    });
  }

  const { data: rowNfe } = await supabase.from('nfe_saidas').select('*').limit(1);
  if (rowNfe && rowNfe.length > 0) {
    console.log('Colunas de nfe_saidas:', Object.keys(rowNfe[0]));
    console.log('Exemplo nfe_saidas:', {
      numero: rowNfe[0].numero,
      numero_nota: rowNfe[0].numero_nota,
      chave: rowNfe[0].chave,
      chave_acesso: rowNfe[0].chave_acesso,
      serie: rowNfe[0].serie
    });
  }
}

main().catch(console.error);
