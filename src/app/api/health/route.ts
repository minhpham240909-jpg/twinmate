/**
 * Health Check Endpoint
 * Used for monitoring, uptime checks, and deployment verification
 *
 * GET /api/health
 *
 * Returns 200 OK if all systems operational
 * Returns 503 Service Unavailable if any critical service is down
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic' // Always run fresh, don't cache

interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  services: {
    database: ServiceStatus
    supabase: ServiceStatus
    auth: ServiceStatus
  }
  uptime: number
  version: string
}

interface ServiceStatus {
  status: 'up' | 'down'
  responseTime?: number
  error?: string
}

export async function GET() {
  const startTime = Date.now()
  const health: HealthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: { status: 'down' },
      supabase: { status: 'down' },
      auth: { status: 'down' },
    },
    uptime: process.uptime(),
    version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
  }

  // Check Database (Prisma)
  try {
    const dbStart = Date.now()
    await prisma.$queryRaw`SELECT 1`
    health.services.database = {
      status: 'up',
      responseTime: Date.now() - dbStart,
    }
  } catch (error) {
    health.services.database = {
      status: 'down',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
    health.status = 'unhealthy'
  }

  // Check Supabase
  try {
    const supabaseStart = Date.now()
    const supabase = await createClient()
    const { error } = await supabase.from('User').select('id').limit(1)

    if (error) {
      throw error
    }

    health.services.supabase = {
      status: 'up',
      responseTime: Date.now() - supabaseStart,
    }
  } catch (error) {
    health.services.supabase = {
      status: 'down',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
    health.status = health.status === 'unhealthy' ? 'unhealthy' : 'degraded'
  }

  // Check Auth
  try {
    const authStart = Date.now()
    const supabase = await createClient()
    const { error } = await supabase.auth.getSession()

    // Auth service is up if no error (even if no session)
    if (error) {
      throw error
    }

    health.services.auth = {
      status: 'up',
      responseTime: Date.now() - authStart,
    }
  } catch (error) {
    health.services.auth = {
      status: 'down',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
    health.status = health.status === 'unhealthy' ? 'unhealthy' : 'degraded'
  }

  // Return appropriate status code
  const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503

  return NextResponse.json(health, {
    status: statusCode,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Content-Type': 'application/json',
    },
  })
}
