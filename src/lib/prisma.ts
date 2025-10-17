// Prisma Client Singleton with optimized connection pooling
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Check if we're in build mode (Next.js sets this during build)
const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build'

// During build time, DATABASE_URL might not be available
// Use a dummy URL to allow build to complete
const getDatabaseUrl = () => {
  if (isBuildTime) {
    // Return a dummy URL during build to prevent connection attempts
    return 'postgresql://dummy:dummy@localhost:5432/dummy'
  }
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL
  }
  // Fallback dummy URL
  return 'postgresql://dummy:dummy@localhost:5432/dummy'
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
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