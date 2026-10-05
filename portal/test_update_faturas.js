const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://mdjfzqlnkytmmibjgplb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1kamZ6cWxua3l0bW1pYmpncGxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEwMzQ1NTUsImV4cCI6MjEwNjYxMDU1NX0.aFwHtlKxMcq1IvzMJvd0wzInMVUZlyD-Pvx3MLAUMH8'
)

async function run() {
  const { data: { session }, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'paratech@paratech.com.br',
    password: 'admin123'
  })
  
  if (authErr) { console.error("Auth erro:", authErr); return; }
  
  const id = 'dd2281c4-a04e-4174-8e36-8a8b4234032f' // Replace with a real ID from above
  const { data, error } = await supabase.from('faturas').update({ confianca_qtd: 1 }).eq('id', id).select()
  console.log("Update Error:", error)
  console.log("Update Data:", data)
}
run()
