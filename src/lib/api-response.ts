/**
 * STANDARDIZED API RESPONSE HELPERS
 *
 * Ensures consistent response format across all API routes.
 *
 * STANDARD FORMAT:
 * Success: { success: true, data: {...}, message?: string }
 * Error: { success: false, error: string, code?: string, details?: any }
 *
 * USAGE:
 * ```typescript
 * import { apiSuccess, apiError, apiNotFound } from '@/lib/api-response'
 *
 * // Success response
 * return apiSuccess({ user: userData })
 *
 * // Success with message
 * return apiSuccess({ id: newId }, 'Created successfully', 201)
 *
 * // Error responses
 * return apiError('Invalid input', 400)
 * return apiNotFound('User')
 * return apiUnauthorized()
 * ```
 */

import { NextResponse } from 'next/server'

// ============================================================================
// Types
// ============================================================================

export interface ApiSuccessResponse<T = unknown> {
  success: true
  data: T
  message?: string
  meta?: {
    page?: number
    limit?: number
    total?: number
    hasMore?: boolean
  }
}

export interface ApiErrorResponse {
  success: false
  error: string
  code?: string
  details?: unknown
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse

// Error codes for client-side handling
export const ERROR_CODES = {
  // Auth errors
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  AUTH_INVALID: 'AUTH_INVALID',
  AUTH_EXPIRED: 'AUTH_EXPIRED',
  ACCOUNT_DEACTIVATED: 'ACCOUNT_DEACTIVATED',

  // Permission errors
  FORBIDDEN: 'FORBIDDEN',
  ADMIN_REQUIRED: 'ADMIN_REQUIRED',
  OWNERSHIP_REQUIRED: 'OWNERSHIP_REQUIRED',

  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_FIELD: 'MISSING_FIELD',

  // Resource errors
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  CONFLICT: 'CONFLICT',

  // Rate limiting
  RATE_LIMITED: 'RATE_LIMITED',

  // Server errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',

  // Business logic errors
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  FEATURE_DISABLED: 'FEATURE_DISABLED',
} as const

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES]

// ============================================================================
// Success Responses
// ============================================================================

/**
 * Return a successful API response
 */
export function apiSuccess<T>(
  data: T,
  message?: string,
  status: number = 200,
  headers?: Record<string, string>
): NextResponse<ApiSuccessResponse<T>> {
  const response: ApiSuccessResponse<T> = {
    success: true,
    data,
  }

  if (message) {
    response.message = message
  }

  return NextResponse.json(response, {
    status,
    headers,
  })
}

/**
 * Return a successful paginated response
 */
export function apiPaginated<T>(
  data: T[],
  meta: {
    page: number
    limit: number
    total: number
  },
  status: number = 200
): NextResponse<ApiSuccessResponse<T[]>> {
  return NextResponse.json({
    success: true,
    data,
    meta: {
      ...meta,
      hasMore: meta.page * meta.limit < meta.total,
    },
  }, { status })
}

/**
 * Return a successful creation response (201)
 */
export function apiCreated<T>(
  data: T,
  message: string = 'Created successfully'
): NextResponse<ApiSuccessResponse<T>> {
  return apiSuccess(data, message, 201)
}

/**
 * Return a successful deletion response
 */
export function apiDeleted(
  message: string = 'Deleted successfully'
): NextResponse<ApiSuccessResponse<{ deleted: true }>> {
  return apiSuccess({ deleted: true as const }, message)
}

/**
 * Return a no-content response (204)
 */
export function apiNoContent(): NextResponse {
  return new NextResponse(null, { status: 204 })
}

// ============================================================================
// Error Responses
// ============================================================================

/**
 * Return an error response
 */
export function apiError(
  error: string,
  status: number = 400,
  code?: ErrorCode,
  details?: unknown
): NextResponse<ApiErrorResponse> {
  const response: ApiErrorResponse = {
    success: false,
    error,
  }

  if (code) {
    response.code = code
  }

  if (details) {
    response.details = details
  }

  return NextResponse.json(response, { status })
}

/**
 * Return an unauthorized error (401)
 */
export function apiUnauthorized(
  message: string = 'Authentication required'
): NextResponse<ApiErrorResponse> {
  return apiError(message, 401, ERROR_CODES.AUTH_REQUIRED)
}

/**
 * Return a forbidden error (403)
 */
export function apiForbidden(
  message: string = 'Access denied'
): NextResponse<ApiErrorResponse> {
  return apiError(message, 403, ERROR_CODES.FORBIDDEN)
}

/**
 * Return a not found error (404)
 */
export function apiNotFound(
  resource: string = 'Resource'
): NextResponse<ApiErrorResponse> {
  return apiError(`${resource} not found`, 404, ERROR_CODES.NOT_FOUND)
}

/**
 * Return a validation error (400)
 */
export function apiValidationError(
  errors: Record<string, string> | string[],
  message: string = 'Validation failed'
): NextResponse<ApiErrorResponse> {
  return apiError(message, 400, ERROR_CODES.VALIDATION_ERROR, errors)
}

/**
 * Return a rate limit error (429)
 */
export function apiRateLimited(
  retryAfter?: number
): NextResponse<ApiErrorResponse> {
  const headers: Record<string, string> = {}
  if (retryAfter) {
    headers['Retry-After'] = String(retryAfter)
  }

  return NextResponse.json(
    {
      success: false,
      error: 'Too many requests',
      code: ERROR_CODES.RATE_LIMITED,
    } as ApiErrorResponse,
    { status: 429, headers }
  )
}

/**
 * Return a conflict error (409)
 */
export function apiConflict(
  message: string = 'Resource already exists'
): NextResponse<ApiErrorResponse> {
  return apiError(message, 409, ERROR_CODES.CONFLICT)
}

/**
 * Return an internal server error (500)
 */
export function apiServerError(
  message: string = 'Internal server error',
  details?: unknown
): NextResponse<ApiErrorResponse> {
  // Log the details but don't expose them in production
  if (details && process.env.NODE_ENV === 'development') {
    console.error('[API Error]', details)
  }

  return apiError(
    process.env.NODE_ENV === 'production' ? 'Internal server error' : message,
    500,
    ERROR_CODES.INTERNAL_ERROR,
    process.env.NODE_ENV === 'development' ? details : undefined
  )
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Wrap an async handler with error handling
 */
export function withErrorHandling<T>(
  handler: () => Promise<NextResponse<T>>
): Promise<NextResponse<T | ApiErrorResponse>> {
  return handler().catch((error: unknown) => {
    console.error('[API Error]', error)
    return apiServerError(
      error instanceof Error ? error.message : 'Unknown error'
    ) as NextResponse<ApiErrorResponse>
  })
}

/**
 * Helper to check if a response is successful
 */
export function isApiSuccess<T>(
  response: ApiResponse<T>
): response is ApiSuccessResponse<T> {
  return response.success === true
}

/**
 * Helper to check if a response is an error
 */
export function isApiError(
  response: ApiResponse<unknown>
): response is ApiErrorResponse {
  return response.success === false
}
