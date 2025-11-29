// Prisma Client Singleton with optimized connection pooling
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Check if we're in build mode (Next.js sets this during build)
const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build'

// ===== DATABASE SECURITY CONFIGURATION =====

// Connection pool limits
const CONNECTION_POOL_SIZE = parseInt(process.env.DATABASE_POOL_SIZE || '10', 10)

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
    return 'postgresql://dummy:dummy@localhost:5432/dummy'
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

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // SECURITY: Only log errors in production to prevent information leakage
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    // Optimized connection pooling settings
    datasources: {
      db: {
        url: getDatabaseUrl(),
      },
    },
  })

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