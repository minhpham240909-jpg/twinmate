/**
 * Sentry Error Monitoring Utilities
 * Provides helpers for capturing errors in API routes and client code
 *
 * Usage in API routes:
 * ```typescript
 * import { captureAPIError } from '@/lib/monitoring/sentry'
 *
 * export async function GET(request: NextRequest) {
 *   try {
 *     // ... your API logic
 *   } catch (error) {
 *     captureAPIError(error, {
 *       endpoint: '/api/posts',
 *       method: 'GET',
 *       userId: user?.id,
 *     })
 *     return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
 *   }
 * }
 * ```
 */

import * as Sentry from '@sentry/nextjs'

export interface APIErrorContext {
  endpoint?: string
  method?: string
  userId?: string
  requestId?: string
  [key: string]: unknown
}

/**
 * Capture an error in an API route with additional context
 */
export function captureAPIError(
  error: unknown,
  context: APIErrorContext = {}
): void {
  // Only capture errors in production
  if (process.env.NODE_ENV !== 'production') {
    console.error('[API Error]', context, error)
    return
  }

  // Convert error to Error object if needed
  const errorObj = error instanceof Error ? error : new Error(String(error))

  // Capture with Sentry
  Sentry.captureException(errorObj, {
    tags: {
      type: 'api_error',
      endpoint: context.endpoint,
      method: context.method,
    },
    user: context.userId ? { id: context.userId } : undefined,
    extra: {
      ...context,
      timestamp: new Date().toISOString(),
    },
  })
}

/**
 * Capture a message (non-error event) with context
 */
export function captureMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
  context?: Record<string, unknown>
): void {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[${level.toUpperCase()}]`, message, context)
    return
  }

  Sentry.captureMessage(message, {
    level,
    extra: context,
  })
}

/**
 * Set user context for all subsequent error reports
 */
export function setUserContext(userId: string, email?: string, name?: string): void {
  Sentry.setUser({
    id: userId,
    email,
    username: name,
  })
}

/**
 * Clear user context (e.g., on logout)
 */
export function clearUserContext(): void {
  Sentry.setUser(null)
}

/**
 * Add breadcrumb for debugging context
 */
export function addBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, unknown>
): void {
  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level: 'info',
  })
}
