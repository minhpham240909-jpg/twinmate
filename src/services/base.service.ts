/**
 * Base Database Service
 * 
 * Provides common functionality for all services including:
 * - Retry logic for transient failures
 * - Error handling and taxonomy
 * - Performance tracking
 * - Centralized database access
 */

import { prisma } from '@/lib/prisma'
import { PrismaClient } from '@prisma/client'

export interface RetryOptions {
  maxRetries?: number
  initialDelayMs?: number
  maxDelayMs?: number
  backoffMultiplier?: number
  retryableErrors?: string[]
}

export const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelayMs: 100,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
  retryableErrors: [
    'P1001', // Can't reach database
    'P1002', // Database timeout
    'P1008', // Operations timed out
    'P1017', // Server closed connection
    'P2024', // Connection pool timeout
    'P2034', // Transaction failed (can retry)
  ],
}

/**
 * Sleep helper for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Calculate exponential backoff delay
 */
function calculateDelay(
  attemptNumber: number,
  options: Required<RetryOptions>
): number {
  const delay = Math.min(
    options.initialDelayMs * Math.pow(options.backoffMultiplier, attemptNumber - 1),
    options.maxDelayMs
  )
  
  // Add jitter to prevent thundering herd
  const jitter = Math.random() * 0.3 * delay
  return delay + jitter
}

/**
 * Check if error is retryable
 */
function isRetryableError(error: any, retryableCodes: string[]): boolean {
  // Prisma errors have a code property
  if (error?.code && retryableCodes.includes(error.code)) {
    return true
  }
  
  // Network errors
  if (error?.message?.includes('ECONNREFUSED') ||
      error?.message?.includes('ETIMEDOUT') ||
      error?.message?.includes('ENOTFOUND')) {
    return true
  }
  
  return false
}

/**
 * Base service class with common database operations
 */
export class DatabaseService {
  protected db: PrismaClient

  constructor() {
    this.db = prisma
  }

  /**
   * Execute a database operation with automatic retry on transient failures
   * 
   * @example
   * const user = await this.withRetry(
   *   async () => await this.db.user.findUnique({ where: { id } }),
   *   { maxRetries: 3 }
   * )
   */
  protected async withRetry<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const opts = { ...DEFAULT_RETRY_OPTIONS, ...options }
    let lastError: any

    for (let attempt = 1; attempt <= opts.maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error: any) {
        lastError = error

        // Don't retry if it's not a retryable error
        if (!isRetryableError(error, opts.retryableErrors)) {
          throw error
        }

        // Don't retry on last attempt
        if (attempt === opts.maxRetries) {
          console.error(
            `Operation failed after ${opts.maxRetries} attempts`,
            {
              error: error?.message,
              code: error?.code,
            }
          )
          throw error
        }

        // Calculate delay with exponential backoff
        const delay = calculateDelay(attempt, opts)
        
        console.warn(
          `Database operation failed, retrying (${attempt}/${opts.maxRetries})...`,
          {
            error: error?.message,
            code: error?.code,
            retryAfter: `${Math.round(delay)}ms`,
          }
        )

        await sleep(delay)
      }
    }

    throw lastError
  }

  /**
   * Execute multiple operations in a transaction with retry
   * 
   * @example
   * await this.withTransaction(async (tx) => {
   *   await tx.user.create({ data: { ... } })
   *   await tx.profile.create({ data: { ... } })
   * })
   */
  protected async withTransaction<T>(
    operation: (tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'>) => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    return await this.withRetry<T>(
      async () => await this.db.$transaction(operation) as T,
      {
        ...options,
        // Transactions might take longer, so use more lenient defaults
        maxRetries: options.maxRetries ?? 2,
        maxDelayMs: options.maxDelayMs ?? 10000,
      }
    )
  }

  /**
   * Check if database is accessible
   * Useful for health checks
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.db.$queryRaw`SELECT 1`
      return true
    } catch (error) {
      console.error('Database health check failed:', error)
      return false
    }
  }

  /**
   * Get database connection info (for debugging)
   */
  async getConnectionInfo(): Promise<{
    connected: boolean
    activeConnections?: number
  }> {
    try {
      const result = await this.db.$queryRaw<Array<{ count: bigint }>>`
        SELECT count(*)::int as count
        FROM pg_stat_activity
        WHERE datname = current_database()
      `
      
      return {
        connected: true,
        activeConnections: Number(result[0]?.count ?? 0),
      }
    } catch (error) {
      return {
        connected: false,
      }
    }
  }
}

/**
 * Service error types for better error handling
 */
export class ServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message)
    this.name = 'ServiceError'
  }
}

export class NotFoundError extends ServiceError {
  constructor(resource: string, identifier?: string) {
    super(
      `${resource}${identifier ? ` with ID ${identifier}` : ''} not found`,
      'NOT_FOUND',
      404
    )
    this.name = 'NotFoundError'
  }
}

export class ValidationError extends ServiceError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', 400, details)
    this.name = 'ValidationError'
  }
}

export class UnauthorizedError extends ServiceError {
  constructor(message: string = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401)
    this.name = 'UnauthorizedError'
  }
}

export class ForbiddenError extends ServiceError {
  constructor(message: string = 'Forbidden') {
    super(message, 'FORBIDDEN', 403)
    this.name = 'ForbiddenError'
  }
}

export class ConflictError extends ServiceError {
  constructor(message: string, details?: any) {
    super(message, 'CONFLICT', 409, details)
    this.name = 'ConflictError'
  }
}

export class RateLimitError extends ServiceError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 'RATE_LIMIT', 429)
    this.name = 'RateLimitError'
  }
}

/**
 * Type helper for service results
 */
export type ServiceResult<T> = {
  success: true
  data: T
} | {
  success: false
  error: ServiceError
}

/**
 * Wrap a service method to return a ServiceResult
 */
export async function toServiceResult<T>(
  operation: () => Promise<T>
): Promise<ServiceResult<T>> {
  try {
    const data = await operation()
    return { success: true, data }
  } catch (error) {
    if (error instanceof ServiceError) {
      return { success: false, error }
    }
    
    // Convert unknown errors to ServiceError
    return {
      success: false,
      error: new ServiceError(
        error instanceof Error ? error.message : 'Unknown error',
        'INTERNAL_ERROR',
        500
      ),
    }
  }
}

