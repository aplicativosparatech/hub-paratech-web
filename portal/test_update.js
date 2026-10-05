const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://mdjfzqlnkytmmibjgplb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1kamZ6cWxua3l0bW1pYmpncGxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEwMzQ1NTUsImV4cCI6MjEwNjYxMDU1NX0.aFwHtlKxMcq1IvzMJvd0wzInMVUZlyD-Pvx3MLAUMH8'
)

async function testUpdate() {
  const { data: cliente } = await supabase.from('clientes').select('id').eq('razao_social', 'Deposito Piria').single()
  console.log("Cliente ID:", cliente?.id)

  const { data, error } = await supabase.from('configuracoes_hub').update({ ultima_sincronizacao: new Date().toISOString() }).eq('cliente_id', cliente.id)
  console.log("Update Error:", error)
  console.log("Update Data:", data)
}
testUpdate()
