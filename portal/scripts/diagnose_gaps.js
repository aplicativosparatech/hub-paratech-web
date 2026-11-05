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
  console.log('=== VERIFICANDO CLIENTE FERNANDA PINTO ===');
  const fernandaId = 'c4c45462-5122-4c64-b2c0-0aff981bf160';
  const { data: configFernanda } = await supabase
    .from('configuracoes_hub')
    .select('*')
    .eq('cliente_id', fernandaId)
    .single();
  console.log('Config Fernanda:', {
    versao: configFernanda?.versao_hub_instalada,
    build: configFernanda?.build_number,
    ultimo_sync: configFernanda?.ultimo_sync,
    comando_remoto: configFernanda?.comando_remoto,
    pasta_xml: configFernanda?.pasta_xml_padrao
  });

  const { count: countFernanda } = await supabase
    .from('nfce_saidas')
    .select('*', { count: 'exact', head: true })
    .eq('cliente_id', fernandaId);
  console.log('Total notas Fernanda no banco:', countFernanda);

  console.log('\n=== VERIFICANDO CLIENTE DA IMAGEM 3 (notas 3572, 3574, etc.) ===');
  const { data: notas } = await supabase
    .from('nfce_saidas')
    .select('cliente_id, numero_nota, serie, data_emissao')
    .in('numero_nota', [3572, 3574, 3646, 3651])
    .limit(10);
  console.log('Notas encontradas:', notas);

  if (notas && notas.length > 0) {
    const cId = notas[0].cliente_id;
    const { data: cliente } = await supabase
      .from('clientes')
      .select('id, razao_social, nome_fantasia, cnpj')
      .eq('id', cId)
      .single();
    console.log('Cliente Imagem 3:', cliente);

    const { data: configCliente } = await supabase
      .from('configuracoes_hub')
      .select('*')
      .eq('cliente_id', cId)
      .single();
    console.log('Config Cliente Imagem 3:', {
      versao: configCliente?.versao_hub_instalada,
      build: configCliente?.build_number,
      ultimo_sync: configCliente?.ultimo_sync,
      comando_remoto: configCliente?.comando_remoto,
      pasta_xml: configCliente?.pasta_xml_padrao
    });
  }

  console.log('\n=== LISTANDO TODOS OS HUBS ATIVOS E VERSÕES ===');
  const { data: hubs } = await supabase
    .from('configuracoes_hub')
    .select('cliente_id, versao_hub_instalada, build_number, ultimo_sync, comando_remoto, clientes(razao_social, cnpj)')
    .order('ultimo_sync', { ascending: false, nullsFirst: false })
    .limit(15);
  hubs?.forEach(h => {
    console.log(`- ${h.clientes?.razao_social || h.cliente_id} | Versão: ${h.versao_hub_instalada} (b${h.build_number}) | Sync: ${h.ultimo_sync} | Cmd: ${h.comando_remoto}`);
  });
}

main().catch(console.error);
