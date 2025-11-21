/**
 * Error Sanitization Utility
 * 
 * Sanitizes error messages for production to prevent information leakage
 * while keeping detailed errors for development and logging
 */

import logger from './logger'
import * as Sentry from '@sentry/nextjs'

const isDevelopment = process.env.NODE_ENV === 'development'

/**
 * Generic error messages for production
 */
export const GENERIC_ERRORS = {
  INTERNAL: 'An unexpected error occurred. Please try again later.',
  UNAUTHORIZED: 'Authentication required. Please sign in.',
  FORBIDDEN: 'You do not have permission to perform this action.',
  NOT_FOUND: 'The requested resource was not found.',
  BAD_REQUEST: 'Invalid request. Please check your input.',
  RATE_LIMIT: 'Too many requests. Please try again later.',
  DATABASE: 'A database error occurred. Please try again.',
  VALIDATION: 'Invalid input provided.',
  TIMEOUT: 'The request timed out. Please try again.',
  NETWORK: 'Network error. Please check your connection.',
} as const

/**
 * Sensitive error patterns that should be sanitized
 */
const SENSITIVE_PATTERNS = [
  /prisma/i,
  /database/i,
  /sql/i,
  /query/i,
  /connection/i,
  /password/i,
  /token/i,
  /secret/i,
  /key/i,
  /credential/i,
  /auth.*failed/i,
  /invalid.*signature/i,
  /jwt/i,
  /supabase/i,
  /upstash/i,
  /redis/i,
  /postgres/i,
  /unique constraint/i,
  /foreign key/i,
  /violat(e|ion)/i,
  /P\d{4}/i, // Prisma error codes (e.g. P2002)
  /column.*does not exist/i,
  /relation.*does not exist/i,
]

/**
 * Check if error message contains sensitive information
 */
export function isSensitiveError(message: string): boolean {
  return SENSITIVE_PATTERNS.some(pattern => pattern.test(message))
}

/**
 * Sanitize error for client response
 * Returns generic message in production, detailed message in development
 */
export function sanitizeError(error: unknown, context?: string): {
  message: string
  code?: string
  details?: any
} {
  // Default error response
  let clientMessage = GENERIC_ERRORS.INTERNAL
  let errorCode: string | undefined
  let errorDetails: any

  // Extract error information
  let originalMessage = ''
  let errorObject: Error | null = null

  if (error instanceof Error) {
    originalMessage = error.message
    errorObject = error
  } else if (typeof error === 'string') {
    originalMessage = error
  } else if (error && typeof error === 'object') {
    originalMessage = JSON.stringify(error)
  }

  // Log full error for debugging (development) and monitoring (production)
  if (isDevelopment) {
    console.error(`[Error${context ? ` - ${context}` : ''}]:`, error)
  } else {
    // Log to Sentry in production
    if (errorObject) {
      Sentry.captureException(errorObject, {
        tags: { context: context || 'unknown' },
      })
    } else {
      Sentry.captureMessage(`Error: ${originalMessage}`, {
        level: 'error',
        tags: { context: context || 'unknown' },
      })
    }
    
    // Log to logger for server logs
    logger.error(`Error${context ? ` in ${context}` : ''}`, errorObject || { message: originalMessage })
  }

  // In development, return detailed error
  if (isDevelopment) {
    return {
      message: originalMessage || GENERIC_ERRORS.INTERNAL,
      code: errorCode,
      details: errorObject?.stack,
    }
  }

  // In production, sanitize based on error type
  let finalMessage: string
  if (isSensitiveError(originalMessage)) {
    // Contains sensitive info - use generic message
    finalMessage = GENERIC_ERRORS.INTERNAL
  } else if (originalMessage.length > 0) {
    // Non-sensitive error - can show (truncated)
    finalMessage = originalMessage.substring(0, 200)
  } else {
    finalMessage = clientMessage
  }

  return {
    message: finalMessage,
    code: errorCode,
  }
}

/**
 * Sanitize Prisma errors specifically
 */
export function sanitizePrismaError(error: any): {
  message: string
  code?: string
} {
  // Prisma Client Known Request Errors
  if (error.code) {
    switch (error.code) {
      case 'P2002': // Unique constraint violation
        return {
          message: 'A record with this information already exists.',
          code: 'DUPLICATE',
        }
      case 'P2025': // Record not found
        return {
          message: GENERIC_ERRORS.NOT_FOUND,
          code: 'NOT_FOUND',
        }
      case 'P2003': // Foreign key constraint failed
        return {
          message: 'This operation cannot be completed due to related data.',
          code: 'CONSTRAINT',
        }
      case 'P2014': // Required relation violation
        return {
          message: 'Required information is missing.',
          code: 'REQUIRED',
        }
      default:
        return {
          message: GENERIC_ERRORS.DATABASE,
          code: 'DATABASE_ERROR',
        }
    }
  }

  // Generic database error
  return sanitizeError(error, 'Database')
}

/**
 * Sanitize validation errors (Zod)
 */
export function sanitizeValidationError(error: any): {
  message: string
  code: string
  fields?: Record<string, string>
} {
  if (error.issues && Array.isArray(error.issues)) {
    // Zod validation error
    const fields: Record<string, string> = {}
    error.issues.forEach((issue: any) => {
      const path = issue.path.join('.')
      fields[path] = issue.message
    })

    return {
      message: 'Validation failed. Please check your input.',
      code: 'VALIDATION_ERROR',
      fields: isDevelopment ? fields : undefined,
    }
  }

  return {
    message: GENERIC_ERRORS.VALIDATION,
    code: 'VALIDATION_ERROR',
  }
}

/**
 * Sanitize authentication errors
 */
export function sanitizeAuthError(error: unknown): {
  message: string
  code: string
} {
  const message = error instanceof Error ? error.message : String(error)

  // Common auth error patterns
  if (message.includes('Invalid login credentials')) {
    return {
      message: 'Invalid email or password.',
      code: 'INVALID_CREDENTIALS',
    }
  }

  if (message.includes('Email not confirmed')) {
    return {
      message: 'Please verify your email address before signing in.',
      code: 'EMAIL_NOT_VERIFIED',
    }
  }

  if (message.includes('already registered')) {
    return {
      message: 'An account with this email already exists.',
      code: 'DUPLICATE_EMAIL',
    }
  }

  // Generic auth error
  return {
    message: GENERIC_ERRORS.UNAUTHORIZED,
    code: 'AUTH_ERROR',
  }
}

/**
 * Create safe error response for API routes
 */
export function createErrorResponse(
  error: unknown,
  context?: string,
  status: number = 500
): {
  error: string
  code?: string
  details?: any
  status: number
} {
  const sanitized = sanitizeError(error, context)
  
  return {
    error: sanitized.message,
    code: sanitized.code,
    details: sanitized.details,
    status,
  }
}

/**
 * Wrap async route handlers with error sanitization
 * 
 * Usage:
 * ```typescript
 * export const POST = withErrorHandler(async (req) => {
 *   // Your route logic
 * }, 'User Creation')
 * ```
 */
export function withErrorHandler<T extends (...args: any[]) => Promise<Response>>(
  handler: T,
  context: string
): T {
  return (async (...args: any[]) => {
    try {
      return await handler(...args)
    } catch (error) {
      const response = createErrorResponse(error, context)
      return Response.json(
        { error: response.error, code: response.code },
        { status: response.status }
      )
    }
  }) as T
}
