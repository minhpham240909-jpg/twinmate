/**
 * Health Check Endpoint
 * Used for monitoring, uptime checks, and deployment verification
 *
 * GET /api/health
 * GET /api/health?deep=true - Deep health check with queue status
 *
 * Returns 200 OK if all systems operational
 * Returns 503 Service Unavailable if any critical service is down
 *
 * SCALABILITY: Enhanced for 1000-3000 concurrent user monitoring
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { getHealthStatus } from '@/lib/monitoring/database-health'
import { getQueueStatus } from '@/lib/ai-partner/queue'
import { rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic' // Always run fresh, don't cache

interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  services: {
    database: ServiceStatus
    supabase: ServiceStatus
    auth: ServiceStatus
    redis: ServiceStatus
    openaiQueue?: QueueServiceStatus
  }
  config?: {
    databasePoolSize: number
    queryTimeout: number
  }
  metrics?: {
    queryMetrics: {
      totalQueries: number
      slowQueries: number
      averageQueryTimeMs: number
      queriesPerMinute: number
    }
  }
  uptime: number
  version: string
}

interface ServiceStatus {
  status: 'up' | 'down'
  responseTime?: number
  error?: string
}

interface QueueServiceStatus {
  status: 'up' | 'down'
  healthy: boolean
  activeRequests: number
  queuedRequests: number
  circuitState: string
  requestsPerMinute: number
  averageWaitMs: number
}

export async function GET(request: NextRequest) {
  // SCALABILITY: Rate limit health checks to prevent abuse
  // Allow 60 requests per minute for monitoring tools
  const rateLimitResult = await rateLimit(request, {
    windowMs: 60 * 1000,
    max: 60,
    keyPrefix: 'health',
  })

  if (!rateLimitResult.success) {
    return NextResponse.json(
      { status: 'rate_limited', error: 'Too many health check requests' },
      { status: 429, headers: rateLimitResult.headers }
    )
  }

  const isDeep = request.nextUrl.searchParams.get('deep') === 'true'
  const isAdmin = request.nextUrl.searchParams.get('admin') === 'true'
  
  // SECURITY: Only expose internal config details to admin requests
  // For public health checks, return minimal information
  const health: HealthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: { status: 'down' },
      supabase: { status: 'down' },
      auth: { status: 'down' },
      redis: { status: 'down' },
    },
    // Only include config details for admin requests to prevent information disclosure
    ...(isAdmin ? {
      config: {
        databasePoolSize: parseInt(process.env.DATABASE_POOL_SIZE || '10', 10),
        queryTimeout: parseInt(process.env.DATABASE_QUERY_TIMEOUT || '30', 10),
      },
    } : {}),
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

  // Check Redis (Upstash)
  try {
    const redisStart = Date.now()
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN

    if (redisUrl && redisToken) {
      const response = await fetch(`${redisUrl}/ping`, {
        headers: {
          Authorization: `Bearer ${redisToken}`,
        },
      })

      if (!response.ok) {
        throw new Error(`Redis responded with status ${response.status}`)
      }

      health.services.redis = {
        status: 'up',
        responseTime: Date.now() - redisStart,
      }
    } else {
      // Redis not configured - mark as up but note it's not configured
      health.services.redis = {
        status: 'up',
        responseTime: 0,
        error: 'Not configured (using in-memory fallback)',
      }
    }
  } catch (error) {
    health.services.redis = {
      status: 'down',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
    // Redis being down is degraded, not unhealthy (app can use in-memory fallback)
    health.status = health.status === 'unhealthy' ? 'unhealthy' : 'degraded'
  }

  // Deep health check: Include OpenAI queue status and query metrics
  if (isDeep) {
    try {
      // Get OpenAI queue status
      const queueStatus = getQueueStatus()
      health.services.openaiQueue = {
        status: queueStatus.healthy ? 'up' : 'down',
        healthy: queueStatus.healthy,
        activeRequests: queueStatus.activeRequests,
        queuedRequests: queueStatus.queuedRequests,
        circuitState: queueStatus.circuitState,
        requestsPerMinute: queueStatus.requestsPerMinute,
        averageWaitMs: queueStatus.averageWaitMs,
      }

      if (!queueStatus.healthy) {
        health.status = health.status === 'unhealthy' ? 'unhealthy' : 'degraded'
      }

      // Get database query metrics
      const dbHealthStatus = await getHealthStatus()
      health.metrics = {
        queryMetrics: {
          totalQueries: dbHealthStatus.queries.totalQueries,
          slowQueries: dbHealthStatus.queries.slowQueries,
          averageQueryTimeMs: Math.round(dbHealthStatus.queries.averageQueryTimeMs),
          queriesPerMinute: dbHealthStatus.queries.queriesPerMinute,
        },
      }
    } catch (error) {
      console.error('[Health] Deep check error:', error)
    }
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
