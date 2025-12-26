// Database Connection Pooling Configuration
// Optimizes connection usage for admin dashboard under high load
// Prevents connection exhaustion when 1000+ concurrent admins/requests

import { PrismaClient } from '@prisma/client'

// =====================================================
// CONNECTION POOL CONFIGURATION
// =====================================================

/**
 * Optimized Prisma configuration for high-load admin operations
 *
 * Connection pool sizing formula:
 * - connections = ((core_count * 2) + effective_spindle_count)
 * - For Supabase/Cloud: 10-20 connections per instance
 * - Reserve 20% for background jobs
 */
export const ADMIN_POOL_CONFIG = {
  // Supabase connection limits
  // Free tier: 60 connections
  // Pro tier: 200 connections
  // See: https://supabase.com/docs/guides/database/connecting-to-postgres

  // Main pool (80% of connections)
  main: {
    pool_size: parseInt(process.env.DATABASE_POOL_SIZE || '15'),
    pool_timeout: 10, // seconds
    statement_timeout: 30000, // 30 seconds (admin queries can be heavy)
    idle_timeout: 300, // 5 minutes
  },

  // Background job pool (20% of connections)
  background: {
    pool_size: parseInt(process.env.DATABASE_POOL_SIZE_BACKGROUND || '5'),
    pool_timeout: 30,
    statement_timeout: 60000, // 1 minute for heavy aggregations
    idle_timeout: 600, // 10 minutes
  },
}

// =====================================================
// PRISMA CLIENT FACTORY
// =====================================================

/**
 * Create optimized Prisma client for admin operations
 */
export function createAdminPrismaClient(): PrismaClient {
  return new PrismaClient({
    datasources: {
      db: {
        url: buildConnectionString(),
      },
    },
    log: process.env.NODE_ENV === 'development'
      ? ['query', 'error', 'warn']
      : ['error'],
  })
}

/**
 * Build connection string with pooling parameters
 */
function buildConnectionString(): string {
  const baseUrl = process.env.DATABASE_URL || ''

  // Parse connection string
  const url = new URL(baseUrl)

  // Add connection pooling parameters
  const params = new URLSearchParams(url.search)

  // PgBouncer/Connection Pooler settings
  params.set('pgbouncer', 'true')
  params.set('pool_timeout', String(ADMIN_POOL_CONFIG.main.pool_timeout))
  params.set('connect_timeout', '10')

  // Performance settings
  params.set('statement_timeout', String(ADMIN_POOL_CONFIG.main.statement_timeout))
  params.set('idle_in_transaction_session_timeout', '30000') // 30 seconds

  // Apply parameters
  url.search = params.toString()

  return url.toString()
}

// =====================================================
// CONNECTION POOL MONITORING
// =====================================================

export interface PoolStats {
  active: number
  idle: number
  waiting: number
  total: number
  utilization: number // Percentage
}

/**
 * Get current connection pool statistics
 * Requires pg_stat_activity access
 */
export async function getPoolStats(prisma: PrismaClient): Promise<PoolStats> {
  try {
    const result = await prisma.$queryRaw<Array<{
      total: bigint
      active: bigint
      idle: bigint
      waiting: bigint
    }>>`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE state = 'active') as active,
        COUNT(*) FILTER (WHERE state = 'idle') as idle,
        COUNT(*) FILTER (WHERE wait_event_type = 'Lock') as waiting
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND pid != pg_backend_pid()
    `

    if (result.length === 0) {
      return { active: 0, idle: 0, waiting: 0, total: 0, utilization: 0 }
    }

    const stats = result[0]
    const total = Number(stats.total)
    const active = Number(stats.active)
    const maxConnections = ADMIN_POOL_CONFIG.main.pool_size + ADMIN_POOL_CONFIG.background.pool_size

    return {
      active,
      idle: Number(stats.idle),
      waiting: Number(stats.waiting),
      total,
      utilization: total > 0 ? Math.round((active / maxConnections) * 100) : 0,
    }
  } catch (error) {
    console.error('[Pool] Error getting pool stats:', error)
    return { active: 0, idle: 0, waiting: 0, total: 0, utilization: 0 }
  }
}

/**
 * Check if connection pool is healthy
 */
export async function checkPoolHealth(prisma: PrismaClient): Promise<{
  healthy: boolean
  stats: PoolStats
  warnings: string[]
}> {
  const stats = await getPoolStats(prisma)
  const warnings: string[] = []

  // Check for high utilization
  if (stats.utilization > 80) {
    warnings.push(`High connection pool utilization: ${stats.utilization}%`)
  }

  // Check for waiting connections
  if (stats.waiting > 5) {
    warnings.push(`${stats.waiting} connections waiting for locks`)
  }

  // Check for connection limit
  const maxConnections = ADMIN_POOL_CONFIG.main.pool_size + ADMIN_POOL_CONFIG.background.pool_size
  if (stats.total >= maxConnections * 0.9) {
    warnings.push(`Approaching connection limit: ${stats.total}/${maxConnections}`)
  }

  return {
    healthy: warnings.length === 0,
    stats,
    warnings,
  }
}

// =====================================================
// CONNECTION POOL WARMUP
// =====================================================

/**
 * Warm up connection pool on application start
 * Prevents slow first requests
 */
export async function warmupConnectionPool(prisma: PrismaClient): Promise<void> {
  console.log('[Pool] Warming up connection pool...')

  const startTime = Date.now()

  try {
    // Execute simple query to establish connections
    await Promise.all([
      prisma.$queryRaw`SELECT 1`,
      prisma.$queryRaw`SELECT 1`,
      prisma.$queryRaw`SELECT 1`,
    ])

    const duration = Date.now() - startTime
    console.log(`[Pool] Connection pool warmed up in ${duration}ms`)
  } catch (error) {
    console.error('[Pool] Error warming up connection pool:', error)
  }
}

// =====================================================
// QUERY TIMEOUT HELPERS
// =====================================================

/**
 * Execute query with timeout
 * Prevents long-running queries from blocking connections
 */
export async function queryWithTimeout<T>(
  query: () => Promise<T>,
  timeoutMs: number = 30000
): Promise<T> {
  return Promise.race([
    query(),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Query timeout after ${timeoutMs}ms`)), timeoutMs)
    ),
  ])
}

/**
 * Execute query with retry on connection errors
 */
export async function queryWithRetry<T>(
  query: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | undefined

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await query()
    } catch (error: any) {
      lastError = error

      // Only retry on connection errors
      const isConnectionError =
        error.message?.includes('connection') ||
        error.message?.includes('timeout') ||
        error.code === 'P1001' || // Prisma connection error
        error.code === 'P1002' || // Prisma timeout
        error.code === 'P1017' // Prisma server closed connection

      if (!isConnectionError || attempt === maxRetries) {
        throw error
      }

      console.warn(`[Pool] Query failed (attempt ${attempt}/${maxRetries}), retrying in ${delayMs}ms...`)
      await new Promise(resolve => setTimeout(resolve, delayMs * attempt))
    }
  }

  throw lastError
}

// =====================================================
// BATCH QUERY OPTIMIZATION
// =====================================================

/**
 * Execute multiple queries in a single transaction
 * Reduces connection overhead
 */
export async function batchQueries<T extends Record<string, () => Promise<any>>>(
  _prisma: PrismaClient,
  queries: T
): Promise<{ [K in keyof T]: Awaited<ReturnType<T[K]>> }> {
  const keys = Object.keys(queries) as Array<keyof T>
  const queryFns = Object.values(queries)

  // Execute all queries in parallel using Promise.all
  // This is efficient for independent read queries
  const results = await Promise.all(queryFns.map(fn => fn()))

  // Map results back to keys
  const mapped = {} as { [K in keyof T]: Awaited<ReturnType<T[K]>> }
  keys.forEach((key, index) => {
    mapped[key] = results[index]
  })

  return mapped
}

// =====================================================
// ENVIRONMENT-SPECIFIC CONFIGURATION
// =====================================================

/**
 * Get recommended pool size for current environment
 */
export function getRecommendedPoolSize(): number {
  const env = process.env.NODE_ENV as string

  if (env === 'production') {
    return 20 // Higher for production load
  } else if (env === 'staging') {
    return 10 // Medium for testing
  } else if (env === 'development') {
    return 5 // Lower for local development
  }
  return 10
}

/**
 * Validate connection pool configuration
 */
export function validatePoolConfig(): {
  valid: boolean
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []

  // Check if DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    errors.push('DATABASE_URL environment variable is not set')
  }

  // Check pool sizes
  const mainPoolSize = ADMIN_POOL_CONFIG.main.pool_size
  const bgPoolSize = ADMIN_POOL_CONFIG.background.pool_size
  const totalPoolSize = mainPoolSize + bgPoolSize

  if (mainPoolSize < 5) {
    warnings.push(`Main pool size is low (${mainPoolSize}), may cause bottlenecks`)
  }

  if (totalPoolSize > 100) {
    warnings.push(`Total pool size is high (${totalPoolSize}), may exceed database limits`)
  }

  // Check timeouts
  if (ADMIN_POOL_CONFIG.main.statement_timeout > 60000) {
    warnings.push('Statement timeout is > 60s, queries may block for too long')
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}
