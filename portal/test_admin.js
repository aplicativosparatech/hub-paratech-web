const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://mdjfzqlnkytmmibjgplb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1kamZ6cWxua3l0bW1pYmpncGxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEwMzQ1NTUsImV4cCI6MjEwNjYxMDU1NX0.aFwHtlKxMcq1IvzMJvd0wzInMVUZlyD-Pvx3MLAUMH8'
)

async function authTest() {
  const { data: { session }, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'paratech@paratech.com.br',
    password: 'admin123'
  })
  
  if (authErr) { console.error("Auth erro:", authErr); return; }
  
  console.log("Logado com sucesso.")

  const { data, error } = await supabase.from('clientes').select('id, razao_social, configuracoes_hub(*)')
  console.log("Clientes:", JSON.stringify(data, null, 2))
  
  if (error) console.error("DB Erro:", error)
}
authTest()
