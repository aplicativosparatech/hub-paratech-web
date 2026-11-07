import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Credenciais fixas do Supabase Cloud para espelhamento Dual-Write
const CLOUD_SUPABASE_URL = "https://mdjfzqlnkytmmibjgplb.supabase.co"
const CLOUD_SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1kamZ6cWxua3l0bW1pYmpncGxiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTAzNDU1NSwiZXhwIjoyMTA2NjEwNTU1fQ.koqUCVtDCFS8MoyGb4oZcSAwtm7JyuA6cxj3lDgDNpE"

// Credenciais da VPS
const VPS_SUPABASE_URL = "https://supabase.paratechsolucoes.com.br"
const VPS_SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3OTQwMDc4MTQsImV4cCI6MTk1MTY4NzgxNH0.kTG0qaI-7UON657hdIXfIFZKY1aIsXtneBFZTv3rz0s"

let cloudClient: SupabaseClient | null = null
let vpsClient: SupabaseClient | null = null

export function getCloudSupabase(): SupabaseClient {
  if (!cloudClient) {
    cloudClient = createClient(CLOUD_SUPABASE_URL, CLOUD_SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false }
    })
  }
  return cloudClient
}

export function getVpsSupabase(): SupabaseClient {
  if (!vpsClient) {
    vpsClient = createClient(VPS_SUPABASE_URL, VPS_SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false }
    })
  }
  return vpsClient
}

/**
 * Identifica o cliente espelho oposto com base no ambiente atual
 */
export function getMirrorSupabase(): SupabaseClient {
  const currentUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  if (currentUrl.includes('paratechsolucoes.com.br')) {
    // Estamos rodando na VPS -> O espelho é o Cloud
    return getCloudSupabase()
  } else {
    // Estamos rodando na Vercel -> O espelho é a VPS
    return getVpsSupabase()
  }
}

/**
 * Replica de forma não-bloqueante uma operação no banco espelho
 */
export async function replicateDualWrite(
  table: string,
  operation: 'upsert' | 'insert' | 'update',
  data: any,
  matchKey?: { column: string; value: any }
) {
  try {
    const mirror = getMirrorSupabase()
    if (operation === 'upsert') {
      await mirror.from(table).upsert(data, { onConflict: matchKey?.column })
    } else if (operation === 'insert') {
      await mirror.from(table).insert(data)
    } else if (operation === 'update' && matchKey) {
      await mirror.from(table).update(data).eq(matchKey.column, matchKey.value)
    }
  } catch (err: any) {
    console.error(`[DualWrite Error] Falha ao replicar em ${table}:`, err?.message || err)
  }
}
