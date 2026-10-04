const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://mdjfzqlnkytmmibjgplb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1kamZ6cWxua3l0bW1pYmpncGxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEwMzQ1NTUsImV4cCI6MjEwNjYxMDU1NX0.aFwHtlKxMcq1IvzMJvd0wzInMVUZlyD-Pvx3MLAUMH8'
)

async function run() {
  const { data, error } = await supabase.auth.signUp({
    email: 'paratech@paratech.com.br',
    password: 'admin123'
  })
  console.log(data, error)
}
run()
