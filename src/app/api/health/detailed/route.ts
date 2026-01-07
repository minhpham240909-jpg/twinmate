/**
 * Detailed Health Check API
 * Use this to diagnose 500 errors after deployment
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const checks: Record<string, { ok: boolean; error?: string; value?: string }> = {}

  // Check environment variables
  const requiredEnvVars = [
    'DATABASE_URL',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'UPSTASH_REDIS_REST_URL',
    'NEXT_PUBLIC_APP_URL',
  ]

  for (const envVar of requiredEnvVars) {
    const value = process.env[envVar]
    checks[envVar] = {
      ok: !!value,
      value: value ? `${value.slice(0, 20)}...` : 'NOT SET',
    }
  }

  // Check database connection
  try {
    await prisma.$queryRaw`SELECT 1`
    checks['DATABASE_CONNECTION'] = { ok: true }
  } catch (error) {
    checks['DATABASE_CONNECTION'] = {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }

  // Check Redis (if configured)
  if (process.env.UPSTASH_REDIS_REST_URL) {
    try {
      const response = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/ping`, {
        headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` },
      })
      checks['REDIS_CONNECTION'] = { ok: response.ok }
    } catch (error) {
      checks['REDIS_CONNECTION'] = {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  const allOk = Object.values(checks).every((c) => c.ok)

  return NextResponse.json({
    status: allOk ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    checks,
  }, { status: allOk ? 200 : 500 })
}

