// Prisma Client Singleton with optimized connection pooling
// Configured for 3,000+ concurrent users
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  dbCircuitBreaker: DatabaseCircuitBreaker | undefined
}

// ===== DATABASE CIRCUIT BREAKER =====
// Prevents cascade failures when database is overloaded or unavailable
// Opens circuit after consecutive failures, allowing system to degrade gracefully

interface CircuitBreakerState {
  failures: number
  lastFailure: number
  isOpen: boolean
  openedAt: number
}

class DatabaseCircuitBreaker {
  private state: CircuitBreakerState = {
    failures: 0,
    lastFailure: 0,
    isOpen: false,
    openedAt: 0,
  }

  // Configuration
  private readonly FAILURE_THRESHOLD = 5 // Open after 5 consecutive failures
  private readonly RESET_TIMEOUT_MS = 30000 // Try again after 30 seconds
  private readonly FAILURE_WINDOW_MS = 60000 // Failures must occur within 1 minute

  /**
   * Check if circuit is open (database should not be called)
   */
  isCircuitOpen(): boolean {
    if (!this.state.isOpen) return false

    // Check if we should try again (half-open state)
    const now = Date.now()
    if (now - this.state.openedAt > this.RESET_TIMEOUT_MS) {
      console.log('[DB Circuit Breaker] Transitioning to half-open state, allowing next request')
      return false // Allow one request through to test
    }

    return true
  }

  /**
   * Record a successful database operation
   */
  recordSuccess(): void {
    if (this.state.isOpen) {
      console.log('[DB Circuit Breaker] Circuit closed after successful request')
    }
    this.state = {
      failures: 0,
      lastFailure: 0,
      isOpen: false,
      openedAt: 0,
    }
  }

  /**
   * Record a failed database operation
   */
  recordFailure(error: unknown): void {
    const now = Date.now()

    // Reset failures if outside window
    if (now - this.state.lastFailure > this.FAILURE_WINDOW_MS) {
      this.state.failures = 0
    }

    this.state.failures++
    this.state.lastFailure = now

    console.error(
      `[DB Circuit Breaker] Database failure (${this.state.failures}/${this.FAILURE_THRESHOLD}):`,
      error instanceof Error ? error.message : 'Unknown error'
    )

    // Open circuit if threshold reached
    if (this.state.failures >= this.FAILURE_THRESHOLD && !this.state.isOpen) {
      this.state.isOpen = true
      this.state.openedAt = now
      console.error(
        '[DB Circuit Breaker] CIRCUIT OPENED - Database requests will fail fast for',
        this.RESET_TIMEOUT_MS / 1000,
        'seconds'
      )
    }
  }

  /**
   * Get current circuit state for monitoring
   */
  getState(): { isOpen: boolean; failures: number; openedAt: number } {
    return {
      isOpen: this.state.isOpen,
      failures: this.state.failures,
      openedAt: this.state.openedAt,
    }
  }
}

// Singleton circuit breaker
export const dbCircuitBreaker =
  globalForPrisma.dbCircuitBreaker ?? new DatabaseCircuitBreaker()

globalForPrisma.dbCircuitBreaker = dbCircuitBreaker

// Check if we're in build mode (Next.js sets this during build)
const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build'

// ===== DATABASE CONNECTION POOLING CONFIGURATION =====
// Optimized for serverless deployment on Vercel
//
// CRITICAL: Serverless environments scale horizontally (100s of instances)
// - Each instance creates its own connection pool
// - 100 instances × 25 connections = 2,500 connections (EXCEEDS PostgreSQL limit!)
// - Supabase PgBouncer (port 6543) handles connection pooling for us
//
// Production: Use 1-2 connections per serverless instance
// - PgBouncer manages the actual connection pool to PostgreSQL
// - Prevents connection exhaustion under high load
//
// Development: Use 10 connections (local development, no scaling)
//
// Recommended .env settings:
// DATABASE_QUERY_TIMEOUT=30     # Max query time in seconds
// DATABASE_CONNECTION_TIMEOUT=10 # Connection acquisition timeout

// Connection pool limits - optimized for serverless at 2000-3000 concurrent users
// PERF: Increased from 1 to 5 connections per serverless instance
// With PgBouncer on Supabase, each instance can safely use 5-10 connections
// 100 instances × 5 connections = 500 connections (well within PgBouncer limits)
const CONNECTION_POOL_SIZE = process.env.VERCEL_ENV === 'production'
  ? parseInt(process.env.DATABASE_POOL_SIZE || '5', 10)  // 5 connections per serverless instance
  : parseInt(process.env.DATABASE_POOL_SIZE || '10', 10) // 10 for local development

// Query timeout in seconds (prevents long-running queries)
const QUERY_TIMEOUT_SECONDS = parseInt(process.env.DATABASE_QUERY_TIMEOUT || '30', 10)

// Connection timeout in seconds
const CONNECTION_TIMEOUT_SECONDS = parseInt(process.env.DATABASE_CONNECTION_TIMEOUT || '10', 10)

/**
 * Build database URL with connection pooling and timeout parameters
 */
const getDatabaseUrl = () => {
  if (isBuildTime) {
    // Return a dummy URL during build to prevent connection attempts
    return 'postgresql://dummy:dummy@localhost:5432/dummy'
  }

  const baseUrl = process.env.DATABASE_URL
  if (!baseUrl) {
    console.error('[Prisma] DATABASE_URL is not set!')
    return 'postgresql://dummy:dummy@localhost:5432/dummy'
  }

  // Log connection info for debugging (without password)
  try {
    const debugUrl = new URL(baseUrl)
    console.log('[Prisma] Connecting to:', debugUrl.host, 'port:', debugUrl.port)
  } catch {
    console.log('[Prisma] Using DATABASE_URL (could not parse for logging)')
  }

  // Parse and enhance the connection string with security parameters
  try {
    const url = new URL(baseUrl)

    // Add connection pool parameters
    url.searchParams.set('connection_limit', CONNECTION_POOL_SIZE.toString())
    url.searchParams.set('pool_timeout', CONNECTION_TIMEOUT_SECONDS.toString())

    // Add statement timeout (query timeout)
    url.searchParams.set('statement_timeout', (QUERY_TIMEOUT_SECONDS * 1000).toString())

    // Add connection timeout
    url.searchParams.set('connect_timeout', CONNECTION_TIMEOUT_SECONDS.toString())

    return url.toString()
  } catch {
    // If URL parsing fails, return base URL
    return baseUrl
  }
}

// ===== QUERY PERFORMANCE MONITORING =====
// Tracks slow queries and provides visibility into database performance

const SLOW_QUERY_THRESHOLD_MS = parseInt(process.env.SLOW_QUERY_THRESHOLD_MS || '1000', 10)
const VERY_SLOW_QUERY_THRESHOLD_MS = parseInt(process.env.VERY_SLOW_QUERY_THRESHOLD_MS || '3000', 10)

// Query metrics for monitoring
interface QueryMetrics {
  totalQueries: number
  slowQueries: number
  verySlowQueries: number
  totalDurationMs: number
  slowestQueryMs: number
  slowestQueryModel: string | null
  lastReset: Date
}

class QueryPerformanceMonitor {
  private metrics: QueryMetrics = {
    totalQueries: 0,
    slowQueries: 0,
    verySlowQueries: 0,
    totalDurationMs: 0,
    slowestQueryMs: 0,
    slowestQueryModel: null,
    lastReset: new Date(),
  }

  recordQuery(model: string, action: string, durationMs: number): void {
    this.metrics.totalQueries++
    this.metrics.totalDurationMs += durationMs

    if (durationMs > this.metrics.slowestQueryMs) {
      this.metrics.slowestQueryMs = durationMs
      this.metrics.slowestQueryModel = `${model}.${action}`
    }

    if (durationMs >= VERY_SLOW_QUERY_THRESHOLD_MS) {
      this.metrics.verySlowQueries++
      console.error(`[DB PERF] VERY SLOW QUERY (${durationMs}ms): ${model}.${action}`)
    } else if (durationMs >= SLOW_QUERY_THRESHOLD_MS) {
      this.metrics.slowQueries++
      console.warn(`[DB PERF] Slow query (${durationMs}ms): ${model}.${action}`)
    }
  }

  getMetrics(): QueryMetrics & { averageQueryMs: number } {
    return {
      ...this.metrics,
      averageQueryMs: this.metrics.totalQueries > 0
        ? Math.round(this.metrics.totalDurationMs / this.metrics.totalQueries)
        : 0,
    }
  }

  resetMetrics(): void {
    this.metrics = {
      totalQueries: 0,
      slowQueries: 0,
      verySlowQueries: 0,
      totalDurationMs: 0,
      slowestQueryMs: 0,
      slowestQueryModel: null,
      lastReset: new Date(),
    }
  }
}

export const queryMonitor = new QueryPerformanceMonitor()

// Create Prisma client with performance monitoring
const createPrismaClient = () => {
  const client = new PrismaClient({
    // SECURITY: Only log errors in production to prevent information leakage
    // Use 'query' event for performance monitoring in all environments
    log: [
      { emit: 'event', level: 'query' },
      { emit: 'stdout', level: 'error' },
      ...(process.env.NODE_ENV === 'development' ? [{ emit: 'stdout' as const, level: 'warn' as const }] : []),
    ],
    // Optimized connection pooling settings
    datasources: {
      db: {
        url: getDatabaseUrl(),
      },
    },
  })

  // Add query performance monitoring via event listener
  // This replaces the deprecated $use middleware
  client.$on('query' as never, (e: { query: string; duration: number; params: string }) => {
    // Record metrics for all queries
    // Extract model name from query if possible
    const queryLower = e.query.toLowerCase()
    let model = 'unknown'

    // Try to extract table/model name from common query patterns
    const fromMatch = queryLower.match(/from\s+"?public"?\."?(\w+)"?/i)
    const intoMatch = queryLower.match(/into\s+"?public"?\."?(\w+)"?/i)
    const updateMatch = queryLower.match(/update\s+"?public"?\."?(\w+)"?/i)
    const deleteMatch = queryLower.match(/delete\s+from\s+"?public"?\."?(\w+)"?/i)

    if (fromMatch) model = fromMatch[1]
    else if (intoMatch) model = intoMatch[1]
    else if (updateMatch) model = updateMatch[1]
    else if (deleteMatch) model = deleteMatch[1]

    // Determine action type
    let action = 'query'
    if (queryLower.startsWith('select')) action = 'findMany'
    else if (queryLower.startsWith('insert')) action = 'create'
    else if (queryLower.startsWith('update')) action = 'update'
    else if (queryLower.startsWith('delete')) action = 'delete'

    queryMonitor.recordQuery(model, action, e.duration)

    // Development: Log slow queries
    if (process.env.NODE_ENV === 'development' && e.duration > 100) {
      console.log(`[Prisma Query] ${e.duration}ms - ${e.query.substring(0, 100)}...`)
    }
  })

  return client
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

// Only connect if we're NOT in build mode and have a real DATABASE_URL
if (!isBuildTime && process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('dummy')) {
  prisma.$connect().catch((e) => {
    console.error('Failed to connect to database:', e)
  })
}

// Always cache the Prisma client in global scope to prevent multiple instances
globalForPrisma.prisma = prisma

// Graceful shutdown
if (typeof window === 'undefined') {
  process.on('beforeExit', async () => {
    await prisma.$disconnect()
  })
}

/**
 * Execute a database operation with circuit breaker protection
 * Use this for critical paths where you want automatic failover
 *
 * @example
 * const user = await withCircuitBreaker(
 *   () => prisma.user.findUnique({ where: { id } }),
 *   null // fallback value if circuit is open
 * )
 */
export async function withCircuitBreaker<T>(
  operation: () => Promise<T>,
  fallback: T
): Promise<T> {
  // Check if circuit is open
  if (dbCircuitBreaker.isCircuitOpen()) {
    console.warn('[DB Circuit Breaker] Circuit is open, returning fallback')
    return fallback
  }

  try {
    const result = await operation()
    dbCircuitBreaker.recordSuccess()
    return result
  } catch (error) {
    dbCircuitBreaker.recordFailure(error)
    throw error
  }
}