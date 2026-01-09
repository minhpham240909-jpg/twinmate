/**
 * HTTPS Enforcement Utilities
 *
 * Ensures sensitive API calls only occur over HTTPS in production.
 * This prevents API keys and sensitive data from being transmitted in clear text.
 *
 * SECURITY: Critical for protecting:
 * - API keys in request headers
 * - Authentication tokens
 * - User credentials
 * - PII (Personally Identifiable Information)
 */

import { NextRequest, NextResponse } from 'next/server'

const isProduction = process.env.NODE_ENV === 'production'

/**
 * Check if the request is using HTTPS
 * Handles various proxy headers for load balancers and reverse proxies
 */
export function isSecureRequest(request: NextRequest): boolean {
  // In development, allow HTTP
  if (!isProduction) {
    return true
  }

  // Check X-Forwarded-Proto header (common with load balancers)
  const forwardedProto = request.headers.get('x-forwarded-proto')
  if (forwardedProto === 'https') {
    return true
  }

  // Check the actual URL protocol
  const url = new URL(request.url)
  if (url.protocol === 'https:') {
    return true
  }

  // Check CF-Visitor header (Cloudflare)
  const cfVisitor = request.headers.get('cf-visitor')
  if (cfVisitor) {
    try {
      const parsed = JSON.parse(cfVisitor)
      if (parsed.scheme === 'https') {
        return true
      }
    } catch {
      // Ignore parse errors
    }
  }

  // Check X-Forwarded-SSL header
  const forwardedSSL = request.headers.get('x-forwarded-ssl')
  if (forwardedSSL === 'on') {
    return true
  }

  // Check Front-End-Https header (Microsoft IIS)
  const frontEndHttps = request.headers.get('front-end-https')
  if (frontEndHttps === 'on') {
    return true
  }

  return false
}

/**
 * Enforce HTTPS for sensitive API endpoints
 * Returns a 403 response if the request is not secure
 */
export function enforceHttps(request: NextRequest): NextResponse | null {
  if (!isSecureRequest(request)) {
    console.warn('[SECURITY] Blocked insecure request to:', request.nextUrl.pathname)
    return NextResponse.json(
      {
        error: 'HTTPS required',
        message: 'This endpoint requires a secure HTTPS connection.',
        code: 'HTTPS_REQUIRED',
      },
      { status: 403 }
    )
  }
  return null
}

/**
 * Validate that external API URLs use HTTPS
 * Use this when making requests to external services
 */
export function validateSecureUrl(url: string, serviceName: string): void {
  if (!url) {
    throw new Error(`${serviceName} URL is not configured`)
  }

  if (isProduction && !url.startsWith('https://')) {
    throw new Error(
      `SECURITY: ${serviceName} URL must use HTTPS in production. ` +
      `Got: ${url.substring(0, 50)}...`
    )
  }
}

/**
 * Wrapper to ensure fetch calls use HTTPS in production
 */
export async function secureFetch(
  url: string,
  options?: RequestInit,
  serviceName: string = 'External API'
): Promise<Response> {
  validateSecureUrl(url, serviceName)
  return fetch(url, options)
}

/**
 * Check if sensitive headers are present in a request
 * Used to determine if HTTPS should be enforced
 */
export function hasSensitiveHeaders(request: NextRequest): boolean {
  const sensitiveHeaders = [
    'authorization',
    'x-api-key',
    'x-auth-token',
    'cookie',
    'x-csrf-token',
  ]

  return sensitiveHeaders.some(header =>
    request.headers.has(header)
  )
}

/**
 * Middleware helper for route handlers
 * Use at the start of API routes that handle sensitive data
 *
 * @example
 * export async function POST(request: NextRequest) {
 *   const httpsError = requireHttps(request)
 *   if (httpsError) return httpsError
 *   // ... rest of handler
 * }
 */
export function requireHttps(request: NextRequest): NextResponse | null {
  // Skip in development
  if (!isProduction) {
    return null
  }

  // Enforce HTTPS for all sensitive requests
  return enforceHttps(request)
}

/**
 * Get security headers to add to responses
 * These headers help protect against various attacks
 */
export function getSecurityHeaders(): Record<string, string> {
  return {
    // Force HTTPS for 1 year
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    // Prevent MIME type sniffing
    'X-Content-Type-Options': 'nosniff',
    // Prevent clickjacking
    'X-Frame-Options': 'DENY',
    // Enable XSS filter
    'X-XSS-Protection': '1; mode=block',
    // Control referrer information
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    // Permissions policy
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  }
}

/**
 * Add security headers to a response
 */
export function addSecurityHeaders(response: NextResponse): NextResponse {
  const headers = getSecurityHeaders()
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value)
  })
  return response
}
