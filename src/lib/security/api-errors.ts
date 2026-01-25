/**
 * Standardized API Error Responses
 * 
 * Provides consistent error handling that:
 * - Returns user-friendly messages to clients
 * - Logs detailed information server-side
 * - Prevents internal details from leaking
 */

import { NextResponse } from 'next/server'
import logger from '@/lib/logger'

// Standard error codes
export enum ErrorCode {
  // Authentication errors (401)
  UNAUTHORIZED = 'UNAUTHORIZED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  
  // Authorization errors (403)
  FORBIDDEN = 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  CSRF_VIOLATION = 'CSRF_VIOLATION',
  
  // Client errors (400)
  BAD_REQUEST = 'BAD_REQUEST',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  
  // Rate limiting (429)
  RATE_LIMITED = 'RATE_LIMITED',
  
  // Not found (404)
  NOT_FOUND = 'NOT_FOUND',
  
  // Server errors (500)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
}

// User-friendly error messages (safe to show to clients)
const USER_FRIENDLY_MESSAGES: Record<ErrorCode, string> = {
  [ErrorCode.UNAUTHORIZED]: 'Please sign in to continue.',
  [ErrorCode.INVALID_TOKEN]: 'Your session has expired. Please sign in again.',
  [ErrorCode.SESSION_EXPIRED]: 'Your session has expired. Please sign in again.',
  [ErrorCode.FORBIDDEN]: 'You do not have permission to perform this action.',
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: 'You do not have sufficient permissions.',
  [ErrorCode.CSRF_VIOLATION]: 'Invalid request. Please refresh the page and try again.',
  [ErrorCode.BAD_REQUEST]: 'Invalid request. Please check your input and try again.',
  [ErrorCode.VALIDATION_ERROR]: 'Please check your input and try again.',
  [ErrorCode.INVALID_INPUT]: 'Invalid input provided.',
  [ErrorCode.RATE_LIMITED]: 'Too many requests. Please try again later.',
  [ErrorCode.NOT_FOUND]: 'The requested resource was not found.',
  [ErrorCode.INTERNAL_ERROR]: 'An unexpected error occurred. Please try again.',
  [ErrorCode.DATABASE_ERROR]: 'A database error occurred. Please try again.',
  [ErrorCode.EXTERNAL_SERVICE_ERROR]: 'An external service is temporarily unavailable.',
}

// HTTP status codes for each error code
const STATUS_CODES: Record<ErrorCode, number> = {
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.INVALID_TOKEN]: 401,
  [ErrorCode.SESSION_EXPIRED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: 403,
  [ErrorCode.CSRF_VIOLATION]: 403,
  [ErrorCode.BAD_REQUEST]: 400,
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.INVALID_INPUT]: 400,
  [ErrorCode.RATE_LIMITED]: 429,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.DATABASE_ERROR]: 500,
  [ErrorCode.EXTERNAL_SERVICE_ERROR]: 503,
}

interface ApiErrorOptions {
  /** The error code */
  code: ErrorCode
  /** Custom user-facing message (optional) */
  message?: string
  /** Validation errors for form fields */
  validationErrors?: Record<string, string>
  /** Additional headers */
  headers?: Record<string, string>
  /** Internal error details (logged, not sent to client) */
  internalDetails?: any
  /** Log context */
  logContext?: Record<string, any>
}

/**
 * Create a standardized API error response
 */
export function apiError(options: ApiErrorOptions): NextResponse {
  const {
    code,
    message,
    validationErrors,
    headers = {},
    internalDetails,
    logContext = {},
  } = options
  
  const statusCode = STATUS_CODES[code]
  const userMessage = message || USER_FRIENDLY_MESSAGES[code]
  
  // Log the error with full details (server-side only)
  if (statusCode >= 500) {
    logger.error(`API Error: ${code}`, {
      code,
      message: userMessage,
      statusCode,
      internalDetails,
      ...logContext,
    })
  } else if (statusCode >= 400) {
    logger.warn(`API Warning: ${code}`, {
      code,
      statusCode,
      ...logContext,
    })
  }
  
  // Build response body (only safe information)
  const responseBody: Record<string, any> = {
    error: userMessage,
    code,
  }
  
  // Include validation errors if present
  if (validationErrors && Object.keys(validationErrors).length > 0) {
    responseBody.validationErrors = validationErrors
  }
  
  return NextResponse.json(responseBody, {
    status: statusCode,
    headers,
  })
}

/**
 * Quick helper for common errors
 */
export const ApiErrors = {
  unauthorized: (message?: string, logContext?: Record<string, any>) =>
    apiError({ code: ErrorCode.UNAUTHORIZED, message, logContext }),
  
  forbidden: (message?: string, logContext?: Record<string, any>) =>
    apiError({ code: ErrorCode.FORBIDDEN, message, logContext }),
  
  badRequest: (message?: string, validationErrors?: Record<string, string>, logContext?: Record<string, any>) =>
    apiError({ code: ErrorCode.BAD_REQUEST, message, validationErrors, logContext }),
  
  validationError: (validationErrors: Record<string, string>, message?: string) =>
    apiError({ code: ErrorCode.VALIDATION_ERROR, message, validationErrors }),
  
  notFound: (message?: string, logContext?: Record<string, any>) =>
    apiError({ code: ErrorCode.NOT_FOUND, message, logContext }),
  
  rateLimited: (headers: Record<string, string>, message?: string) =>
    apiError({ code: ErrorCode.RATE_LIMITED, message, headers }),
  
  internalError: (internalDetails?: any, logContext?: Record<string, any>) =>
    apiError({ code: ErrorCode.INTERNAL_ERROR, internalDetails, logContext }),
  
  csrfViolation: () =>
    apiError({ code: ErrorCode.CSRF_VIOLATION }),
}

/**
 * Wrap an async handler with standard error handling
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<NextResponse>>(
  handler: T,
  context?: string
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await handler(...args)
    } catch (error) {
      logger.error(`Unhandled error in ${context || 'API handler'}`, 
        error instanceof Error ? error : new Error(String(error))
      )
      return ApiErrors.internalError(error instanceof Error ? error.message : 'Unknown error')
    }
  }) as T
}

/**
 * Safely parse request JSON body with error handling
 * Returns [data, null] on success, [null, error response] on failure
 */
export async function parseRequestBody<T = Record<string, unknown>>(
  request: Request
): Promise<[T, null] | [null, NextResponse]> {
  try {
    const body = await request.json()
    return [body as T, null]
  } catch (error) {
    logger.warn('Failed to parse request body', {
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    return [null, ApiErrors.badRequest('Invalid JSON in request body')]
  }
}

/**
 * Validate sortBy parameter against a whitelist to prevent SQL injection
 */
export function validateSortBy(
  sortBy: string | null | undefined,
  allowedFields: string[],
  defaultField: string = 'createdAt'
): string {
  if (!sortBy) return defaultField
  return allowedFields.includes(sortBy) ? sortBy : defaultField
}

/**
 * Validate sortOrder parameter
 */
export function validateSortOrder(
  sortOrder: string | null | undefined
): 'asc' | 'desc' {
  if (sortOrder === 'asc' || sortOrder === 'desc') return sortOrder
  return 'desc'
}
