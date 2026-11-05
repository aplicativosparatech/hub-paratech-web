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

async function testGapsNumeracao() {
  const fernandaId = 'c4c45462-5122-4c64-b2c0-0aff981bf160';
  
  // Vamos ver o código de /api/sefaz/gaps-numeracao/route.ts
  const routeCode = fs.readFileSync('portal/src/app/api/sefaz/gaps-numeracao/route.ts', 'utf8');
  console.log('Tamanho de gaps-numeracao route:', routeCode.length);
}

testGapsNumeracao().catch(console.error);
