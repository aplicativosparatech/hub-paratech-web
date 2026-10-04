const { Client } = require('pg')

const client = new Client({
  connectionString: 'postgresql://postgres:$Financeiro@paratechsolucoes.2026$@db.mdjfzqlnkytmmibjgplb.supabase.co:5432/postgres'
})

async function run() {
  await client.connect()
  const res = await client.query("UPDATE auth.users SET email_confirmed_at = now() WHERE email = 'paratech@paratech.com.br'")
  console.log('Update result:', res.rowCount)
  await client.end()
}
run()
