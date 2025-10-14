// Prisma Client Singleton with optimized connection pooling
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    // Optimized connection pooling settings
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  })

// Optimize Prisma for serverless/edge environments
prisma.$connect().catch((e) => {
  console.error('Failed to connect to database:', e)
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// Graceful shutdown
if (typeof window === 'undefined') {
  process.on('beforeExit', async () => {
    await prisma.$disconnect()
  })
}