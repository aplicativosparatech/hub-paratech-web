import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function reset() {
  console.log("Tentando criar admin...")
  const { data, error } = await supabase.auth.signUp({
    email: 'admin@paratech.com.br',
    password: 'admin'
  })
  if (error) {
    console.log("Erro (talvez já exista):", error.message)
    // Talvez possamos tentar atualizar a senha de admin@paratech.com.br via API Auth Admin
    // mas não temos a chave secreta. 
  } else {
    console.log("Sucesso!", data)
  }
}
reset()
