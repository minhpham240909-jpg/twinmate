// Debug endpoint to check environment variables (REMOVE AFTER FIXING)
import { NextResponse } from 'next/server'

export async function GET() {
  // Only show masked values for security
  const envCheck = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL
      ? `${process.env.NEXT_PUBLIC_SUPABASE_URL.substring(0, 20)}...`
      : '❌ MISSING',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      ? `${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(0, 15)}...`
      : '❌ MISSING',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY
      ? `${process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 15)}...`
      : '❌ MISSING',
    DATABASE_URL: process.env.DATABASE_URL
      ? `${process.env.DATABASE_URL.substring(0, 20)}...`
      : '❌ MISSING',
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID
      ? `${process.env.GOOGLE_CLIENT_ID.substring(0, 15)}...`
      : '❌ MISSING',
    NEXT_PUBLIC_AGORA_APP_ID: process.env.NEXT_PUBLIC_AGORA_APP_ID
      ? `${process.env.NEXT_PUBLIC_AGORA_APP_ID.substring(0, 10)}...`
      : '❌ MISSING',
    AGORA_APP_CERTIFICATE: process.env.AGORA_APP_CERTIFICATE
      ? `${process.env.AGORA_APP_CERTIFICATE.substring(0, 10)}...`
      : '❌ MISSING',
    CLEANUP_API_KEY: process.env.CLEANUP_API_KEY
      ? `${process.env.CLEANUP_API_KEY.substring(0, 10)}...`
      : '❌ MISSING',

    // Check for wrong variable names that might still exist
    WRONG_NEXT_PUBLIC_SUPABASE_KEY: process.env.NEXT_PUBLIC_SUPABASE_KEY
      ? '⚠️ OLD VARIABLE STILL EXISTS - DELETE THIS'
      : '✅ Not found (good)',
    WRONG_SUPABASE_SECRET_KEY: (process.env as any).SUPABASE_SECRET_KEY
      ? '⚠️ OLD VARIABLE STILL EXISTS - DELETE THIS'
      : '✅ Not found (good)',
  }

  return NextResponse.json(envCheck, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    }
  })
}
