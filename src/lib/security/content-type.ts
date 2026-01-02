/**
 * Content-Type Validation Middleware
 * 
 * Ensures that POST/PUT/PATCH requests have the correct Content-Type header.
 * Prevents attacks that try to bypass validation by sending malformed requests.
 */

import { NextRequest, NextResponse } from 'next/server'
import logger from '@/lib/logger'

// Valid content types for JSON API requests
const VALID_JSON_CONTENT_TYPES = [
  'application/json',
  'application/json; charset=utf-8',
  'application/json;charset=utf-8',
  'application/json; charset=UTF-8',
  'application/json;charset=UTF-8',
]

// Valid content types for form data (file uploads)
const VALID_FORM_CONTENT_TYPES = [
  'multipart/form-data',
  'application/x-www-form-urlencoded',
]

// Routes that accept form data (file uploads)
const FORM_DATA_ROUTES = [
  '/api/upload',
  '/api/messages/upload-file',
]

// Routes that accept EITHER form data OR JSON (flexible routes)
const FLEXIBLE_ROUTES = [
  '/api/groups/', // Group routes can be JSON (create) or form-data (avatar upload)
]

// Routes exempt from content-type validation
const EXEMPT_ROUTES = [
  '/api/auth/callback',
  '/api/auth/google',
  '/api/cron/',
  '/api/webhooks/',
  '/api/health',
  '/api/graphql', // GraphQL has its own content negotiation
]

/**
 * Check if a route accepts form data only
 */
export function isFormDataRoute(pathname: string): boolean {
  return FORM_DATA_ROUTES.some(route => pathname.includes(route))
}

/**
 * Check if a route accepts either form data or JSON
 */
export function isFlexibleRoute(pathname: string): boolean {
  return FLEXIBLE_ROUTES.some(route => pathname.includes(route))
}

/**
 * Check if a route is exempt from content-type validation
 */
export function isExemptRoute(pathname: string): boolean {
  return EXEMPT_ROUTES.some(route => pathname.startsWith(route))
}

/**
 * Validate Content-Type header for a request
 */
export function validateContentType(request: NextRequest): {
  valid: boolean
  error?: string
} {
  const method = request.method.toUpperCase()
  const pathname = request.nextUrl.pathname
  
  // Only validate state-changing methods
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return { valid: true }
  }
  
  // Skip validation for exempt routes
  if (isExemptRoute(pathname)) {
    return { valid: true }
  }
  
  const contentType = request.headers.get('content-type')
  
  // DELETE requests don't always need a body/content-type
  if (method === 'DELETE' && !contentType) {
    return { valid: true }
  }

  // POST requests with empty body (like starting a call) may not have content-type
  // Check if the request has a body by looking at content-length
  const contentLength = request.headers.get('content-length')
  if (method === 'POST' && (!contentLength || contentLength === '0') && !contentType) {
    return { valid: true }
  }
  
  // Check if route expects form data only
  if (isFormDataRoute(pathname)) {
    if (!contentType) {
      return { valid: false, error: 'Content-Type header is required' }
    }

    // Check if content type starts with any valid form type
    const hasValidFormType = VALID_FORM_CONTENT_TYPES.some(
      type => contentType.toLowerCase().startsWith(type)
    )

    if (!hasValidFormType) {
      return {
        valid: false,
        error: 'Invalid Content-Type for file upload. Expected multipart/form-data',
      }
    }

    return { valid: true }
  }

  // Check if route accepts either form data or JSON (flexible routes)
  if (isFlexibleRoute(pathname)) {
    if (!contentType) {
      return { valid: false, error: 'Content-Type header is required' }
    }

    const normalizedContentType = contentType.toLowerCase().trim()

    // Accept either JSON or form data
    const hasValidFormType = VALID_FORM_CONTENT_TYPES.some(
      type => normalizedContentType.startsWith(type)
    )
    const isValidJson = VALID_JSON_CONTENT_TYPES.some(
      type => normalizedContentType.startsWith(type.toLowerCase())
    )

    if (!hasValidFormType && !isValidJson) {
      return {
        valid: false,
        error: 'Invalid Content-Type. Expected application/json or multipart/form-data',
      }
    }

    return { valid: true }
  }

  // For JSON API routes
  if (!contentType) {
    return { valid: false, error: 'Content-Type header is required' }
  }

  // Check if content type is valid JSON
  const normalizedContentType = contentType.toLowerCase().trim()
  const isValidJson = VALID_JSON_CONTENT_TYPES.some(
    type => normalizedContentType.startsWith(type.toLowerCase())
  )

  if (!isValidJson) {
    logger.warn('Invalid Content-Type header', {
      pathname,
      method,
      contentType,
    })
    return {
      valid: false,
      error: 'Invalid Content-Type. Expected application/json',
    }
  }

  return { valid: true }
}

/**
 * Middleware wrapper for content-type validation
 */
export function withContentTypeValidation(
  handler: (request: NextRequest) => Promise<NextResponse>
): (request: NextRequest) => Promise<NextResponse> {
  return async (request: NextRequest) => {
    const validation = validateContentType(request)
    
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 415 } // Unsupported Media Type
      )
    }
    
    return handler(request)
  }
}

