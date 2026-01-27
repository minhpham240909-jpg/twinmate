/**
 * Structured Logger for Clerva
 * 
 * Provides consistent, structured logging across the application.
 * Replaces scattered console.log/console.error calls with a unified interface.
 * 
 * Features:
 * - Log levels (debug, info, warn, error)
 * - Structured context (component, action, metadata)
 * - Environment-aware (suppresses debug in production)
 * - Consistent formatting
 * - Easy migration from console.* calls
 * - Backward compatible with existing code (default export, createRequestLogger, getCorrelationId)
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  component?: string      // e.g., 'Dashboard', 'AuthContext', 'RoadmapAPI'
  action?: string         // e.g., 'fetchRoadmap', 'submitProof', 'login'
  userId?: string         // User ID if available (for debugging)
  sessionId?: string      // Session ID if available
  requestId?: string      // Request ID for tracing
  correlationId?: string  // Correlation ID for request tracing
  duration?: number       // Duration in ms for performance logging
  [key: string]: unknown  // Additional metadata
}

interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  context?: LogContext
  error?: Error | unknown
}

// Environment detection
const isDev = process.env.NODE_ENV === 'development'
const isServer = typeof window === 'undefined'

// Log level hierarchy (lower = more verbose)
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

// Minimum log level (configurable via env)
const MIN_LOG_LEVEL = process.env.LOG_LEVEL as LogLevel || (isDev ? 'debug' : 'info')

/**
 * Format error for logging
 */
function formatError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: isDev ? error.stack : undefined,
    }
  }
  return { raw: String(error) }
}

/**
 * Format log entry for console output
 */
function formatLogEntry(entry: LogEntry): string {
  const parts: string[] = []
  
  // Timestamp (only in development for readability)
  if (isDev) {
    const time = new Date(entry.timestamp).toLocaleTimeString()
    parts.push(`[${time}]`)
  }
  
  // Level
  parts.push(`[${entry.level.toUpperCase()}]`)
  
  // Component & Action
  if (entry.context?.component) {
    parts.push(`[${entry.context.component}]`)
  }
  if (entry.context?.action) {
    parts.push(`(${entry.context.action})`)
  }
  
  // Message
  parts.push(entry.message)
  
  // Duration if present
  if (entry.context?.duration !== undefined) {
    parts.push(`[${entry.context.duration}ms]`)
  }
  
  return parts.join(' ')
}

/**
 * Check if log level should be output
 */
function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[MIN_LOG_LEVEL]
}

/**
 * Core logging function
 */
function log(level: LogLevel, message: string, context?: LogContext, error?: unknown): void {
  if (!shouldLog(level)) return
  
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    context,
    error,
  }
  
  const formattedMessage = formatLogEntry(entry)
  
  // Use appropriate console method
  switch (level) {
    case 'debug':
      console.debug(formattedMessage, context ? { ...context } : '')
      break
    case 'info':
      console.info(formattedMessage, context ? { ...context } : '')
      break
    case 'warn':
      console.warn(formattedMessage, context ? { ...context } : '')
      break
    case 'error':
      console.error(formattedMessage, {
        ...context,
        error: error ? formatError(error) : undefined,
      })
      break
  }
  
  // In production, could also send to external service here
  // e.g., Sentry, LogRocket, DataDog, etc.
  // if (!isDev && level === 'error') {
  //   sendToErrorTracking(entry)
  // }
}

/**
 * Logger class for creating component-specific loggers
 */
class Logger {
  private component: string
  private defaultContext: Partial<LogContext>
  
  constructor(component: string, defaultContext: Partial<LogContext> = {}) {
    this.component = component
    this.defaultContext = defaultContext
  }
  
  private mergeContext(context?: LogContext): LogContext {
    return {
      component: this.component,
      ...this.defaultContext,
      ...context,
    }
  }
  
  debug(message: string, context?: LogContext): void {
    log('debug', message, this.mergeContext(context))
  }
  
  info(message: string, context?: LogContext): void {
    log('info', message, this.mergeContext(context))
  }
  
  warn(message: string, context?: LogContext): void {
    log('warn', message, this.mergeContext(context))
  }
  
  error(message: string, error?: unknown, context?: LogContext): void {
    log('error', message, this.mergeContext(context), error)
  }
  
  /**
   * Create a child logger with additional default context
   */
  child(additionalContext: Partial<LogContext>): Logger {
    return new Logger(this.component, {
      ...this.defaultContext,
      ...additionalContext,
    })
  }
  
  /**
   * Log with timing - useful for performance monitoring
   */
  timed<T>(action: string, fn: () => T): T {
    const start = Date.now()
    try {
      const result = fn()
      // Handle promises
      if (result instanceof Promise) {
        return result.then((value) => {
          this.debug(`${action} completed`, { action, duration: Date.now() - start })
          return value
        }).catch((error) => {
          this.error(`${action} failed`, error, { action, duration: Date.now() - start })
          throw error
        }) as T
      }
      this.debug(`${action} completed`, { action, duration: Date.now() - start })
      return result
    } catch (error) {
      this.error(`${action} failed`, error, { action, duration: Date.now() - start })
      throw error
    }
  }
  
  /**
   * Async version of timed
   */
  async timedAsync<T>(action: string, fn: () => Promise<T>): Promise<T> {
    const start = Date.now()
    try {
      const result = await fn()
      this.debug(`${action} completed`, { action, duration: Date.now() - start })
      return result
    } catch (error) {
      this.error(`${action} failed`, error, { action, duration: Date.now() - start })
      throw error
    }
  }
}

/**
 * Create a logger for a specific component
 * 
 * @example
 * const logger = createLogger('Dashboard')
 * logger.info('User loaded roadmap', { roadmapId: '123' })
 * logger.error('Failed to save progress', error, { stepId: '456' })
 */
export function createLogger(component: string, defaultContext?: Partial<LogContext>): Logger {
  return new Logger(component, defaultContext)
}

/**
 * Quick logging functions for simple cases
 * Prefer createLogger() for component-specific logging
 */
export const logger = {
  debug: (message: string, context?: LogContext) => log('debug', message, context),
  info: (message: string, context?: LogContext) => log('info', message, context),
  warn: (message: string, context?: LogContext) => log('warn', message, context),
  error: (message: string, error?: unknown, context?: LogContext) => log('error', message, context, error),
}

/**
 * API route logger helper
 * Creates a logger with request context
 * 
 * @example
 * export async function POST(req: Request) {
 *   const log = apiLogger('roadmap/create')
 *   log.info('Creating roadmap')
 *   // ...
 * }
 */
export function apiLogger(route: string, requestId?: string): Logger {
  return createLogger(`API:${route}`, { requestId })
}

/**
 * Hook logger helper
 * Creates a logger for React hooks
 */
export function hookLogger(hookName: string): Logger {
  return createLogger(`Hook:${hookName}`)
}

// ============================================
// BACKWARD COMPATIBILITY EXPORTS
// ============================================

/**
 * Generate a unique ID
 */
function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
}

/**
 * Extract correlation ID from request headers or generate new one
 * Compatible with existing code: getCorrelationId(request)
 */
export function getCorrelationId(request?: Request | { headers?: Headers }): string {
  if (request?.headers) {
    const existing = request.headers.get?.('x-correlation-id') || 
                     request.headers.get?.('x-request-id')
    if (existing) return existing
  }
  return generateId()
}

/**
 * Create a request-specific logger (backward compatible)
 * Compatible with existing code: createRequestLogger(request)
 * 
 * @example
 * export async function POST(request: NextRequest) {
 *   const log = createRequestLogger(request)
 *   log.info('Processing request')
 * }
 */
export function createRequestLogger(request?: Request | { url?: string }): Logger {
  const url = request?.url
  const route = url ? new URL(url).pathname : 'unknown'
  const correlationId = getCorrelationId(request as Request)
  
  return createLogger(`API:${route}`, { correlationId })
}

// Default export for backward compatibility with: import logger from '@/lib/logger'
export default logger

export type { LogLevel, LogContext, LogEntry, Logger }
