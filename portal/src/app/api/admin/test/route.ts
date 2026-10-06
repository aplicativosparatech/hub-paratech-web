import { NextResponse } from 'next/server'

export async function GET() {
  const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY
  const hasUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL
  const hasAnonKey = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  return NextResponse.json({
    SUPABASE_URL: hasUrl ? '✅ OK' : '❌ FALTANDO',
    SUPABASE_ANON_KEY: hasAnonKey ? '✅ OK' : '❌ FALTANDO',
    SUPABASE_SERVICE_ROLE_KEY: hasServiceKey ? '✅ OK' : '❌ FALTANDO - CAUSA DO ERRO DE LOGIN',
    status: hasServiceKey ? 'Tudo certo! Sistema operacional.' : 'ATENÇÃO: Adicione SUPABASE_SERVICE_ROLE_KEY na Vercel!'
  })
}
