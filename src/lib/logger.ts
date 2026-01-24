/**
 * Production-safe logger with Request Correlation ID support
 * 
 * In development: Uses console.log with correlation IDs
 * In production: Uses Sentry breadcrumbs with correlation IDs
 * 
 * Usage:
 * ```typescript
 * import logger, { createRequestLogger } from '@/lib/logger'
 * 
 * // Basic usage
 * logger.info('User logged in', { userId: '123' })
 * logger.error('API error', error)
 * logger.warn('Deprecated feature used')
 * 
 * // With request correlation (in API routes)
 * const requestLogger = createRequestLogger(request)
 * requestLogger.info('Processing request', { data })
 * requestLogger.error('Request failed', error)
 * ```
 */

import * as Sentry from '@sentry/nextjs'
import { NextRequest } from 'next/server'

type LogLevel = 'debug' | 'info' | 'warning' | 'error'

interface LogData {
  [key: string]: unknown
}

/**
 * Generate a unique correlation ID
 */
export function generateCorrelationId(): string {
  const timestamp = Date.now().toString(36)
  const randomPart = Math.random().toString(36).substring(2, 8)
  return `${timestamp}-${randomPart}`
}

/**
 * Extract or generate correlation ID from request headers
 */
export function getCorrelationId(request?: NextRequest | Request | null): string {
  if (request) {
    // Check for existing correlation ID in headers
    const existingId = request.headers.get('x-correlation-id') || 
                       request.headers.get('x-request-id')
    if (existingId) {
      return existingId
    }
  }
  return generateCorrelationId()
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development'
  private correlationId?: string

  constructor(correlationId?: string) {
    this.correlationId = correlationId
  }

  /**
   * Create a child logger with a correlation ID
   */
  withCorrelationId(correlationId: string): Logger {
    return new Logger(correlationId)
  }

  /**
   * Log informational message
   */
  info(message: string, data?: LogData) {
    this.log('info', message, data)
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error | LogData) {
    if (error instanceof Error) {
      this.log('error', message, { error: error.message, stack: error.stack })
      
      // Capture full error in Sentry with correlation ID
      if (!this.isDevelopment) {
        Sentry.captureException(error, {
          tags: { 
            logger: 'true',
            ...(this.correlationId && { correlationId: this.correlationId }),
          },
          extra: { 
            message,
            correlationId: this.correlationId,
          }
        })
      }
    } else {
      this.log('error', message, error)
    }
  }

  /**
   * Log warning message
   */
  warn(message: string, data?: LogData) {
    this.log('warning', message, data)
  }

  /**
   * Log debug message
   */
  debug(message: string, data?: LogData) {
    this.log('debug', message, data)
  }

  /**
   * Internal log method
   */
  private log(level: LogLevel, message: string, data?: LogData) {
    // Add correlation ID to data if present
    const enrichedData = this.correlationId 
      ? { ...data, correlationId: this.correlationId }
      : data

    if (this.isDevelopment) {
      // Development: Use console with correlation ID prefix
      const consoleMethod = level === 'error' ? console.error : 
                           level === 'warning' ? console.warn : 
                           console.log
      
      const prefix = this.correlationId 
        ? `[${level.toUpperCase()}] [${this.correlationId}]`
        : `[${level.toUpperCase()}]`
      
      if (enrichedData) {
        consoleMethod(`${prefix} ${message}`, enrichedData)
      } else {
        consoleMethod(`${prefix} ${message}`)
      }
    } else {
      // Production: Use Sentry breadcrumbs with correlation ID
      Sentry.addBreadcrumb({
        category: 'app',
        message,
        level: level as Sentry.SeverityLevel,
        data: enrichedData,
      })

      // Set correlation ID as Sentry tag for the current scope
      if (this.correlationId) {
        Sentry.setTag('correlationId', this.correlationId)
      }

      // For errors and warnings, also log to console in production for server logs
      if (level === 'error' || level === 'warning') {
        const consoleMethod = level === 'error' ? console.error : console.warn
        const prefix = this.correlationId 
          ? `[${level.toUpperCase()}] [${this.correlationId}]`
          : `[${level.toUpperCase()}]`
        consoleMethod(`${prefix} ${message}`, enrichedData || '')
      }
    }
  }
}

const logger = new Logger()

export default logger

/**
 * Create a logger with a correlation ID for request tracing
 * 
 * Usage in API routes:
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   const log = createRequestLogger(request)
 *   log.info('Processing request')
 *   // ... handle request
 *   log.info('Request completed')
 * }
 * ```
 */
export function createRequestLogger(request?: NextRequest | Request | null): Logger {
  const correlationId = getCorrelationId(request)
  return new Logger(correlationId)
}

/**
 * Helper to replace console.log calls
 * 
 * @deprecated Use logger.info instead
 */
export const log = logger.info.bind(logger)

/**
 * Helper to replace console.error calls
 * 
 * @deprecated Use logger.error instead
 */
export const logError = logger.error.bind(logger)

/**
 * Helper to replace console.warn calls
 * 
 * @deprecated Use logger.warn instead
 */
export const logWarn = logger.warn.bind(logger)
