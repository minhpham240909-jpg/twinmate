/**
 * Production-safe logger
 * 
 * In development: Uses console.log
 * In production: Uses Sentry breadcrumbs
 * 
 * Usage:
 * ```typescript
 * import logger from '@/lib/logger'
 * 
 * logger.info('User logged in', { userId: '123' })
 * logger.error('API error', error)
 * logger.warn('Deprecated feature used')
 * ```
 */

import * as Sentry from '@sentry/nextjs'

type LogLevel = 'debug' | 'info' | 'warning' | 'error'

interface LogData {
  [key: string]: any
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development'

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
      
      // Capture full error in Sentry
      if (!this.isDevelopment) {
        Sentry.captureException(error, {
          tags: { logger: 'true' },
          extra: { message }
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
    if (this.isDevelopment) {
      // Development: Use console
      const consoleMethod = level === 'error' ? console.error : 
                           level === 'warning' ? console.warn : 
                           console.log
      
      if (data) {
        consoleMethod(`[${level.toUpperCase()}] ${message}`, data)
      } else {
        consoleMethod(`[${level.toUpperCase()}] ${message}`)
      }
    } else {
      // Production: Use Sentry breadcrumbs
      Sentry.addBreadcrumb({
        category: 'app',
        message,
        level: level as any,
        data,
      })

      // For errors and warnings, also log to console in production for server logs
      if (level === 'error' || level === 'warning') {
        const consoleMethod = level === 'error' ? console.error : console.warn
        consoleMethod(`[${level.toUpperCase()}] ${message}`, data || '')
      }
    }
  }
}

const logger = new Logger()

export default logger

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
