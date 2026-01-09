import { updateSession } from '@/lib/supabase/middleware'
import { type NextRequest, NextResponse } from 'next/server'
import logger from '@/lib/logger'
import { validateContentType } from '@/lib/security/content-type'

// SECURITY: Production check for HTTPS enforcement
const isProduction = process.env.NODE_ENV === 'production'

/**
 * Check if request is secure (HTTPS)
 * Handles proxy headers from load balancers
 */
function isSecureRequest(request: NextRequest): boolean {
  if (!isProduction) return true

  // Check X-Forwarded-Proto (most common with proxies/load balancers)
  const forwardedProto = request.headers.get('x-forwarded-proto')
  if (forwardedProto === 'https') return true

  // Check URL protocol
  const url = new URL(request.url)
  if (url.protocol === 'https:') return true

  // Check Cloudflare header
  const cfVisitor = request.headers.get('cf-visitor')
  if (cfVisitor) {
    try {
      const parsed = JSON.parse(cfVisitor)
      if (parsed.scheme === 'https') return true
    } catch {
      // Ignore parse errors
    }
  }

  return false
}

/**
 * Get security headers for responses
 */
function getSecurityHeaders(): Record<string, string> {
  return {
    // HSTS: Force HTTPS for 1 year
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    // Prevent MIME sniffing
    'X-Content-Type-Options': 'nosniff',
    // Prevent clickjacking
    'X-Frame-Options': 'DENY',
    // XSS filter
    'X-XSS-Protection': '1; mode=block',
    // Referrer policy
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  }
}

export async function middleware(request: NextRequest) {
  // NOTE: www to non-www redirect should be configured in Vercel Dashboard
  // Do NOT add it here - it causes redirect loops with Vercel's edge redirects

  // SECURITY: Enforce HTTPS in production for sensitive API endpoints
  if (isProduction && request.nextUrl.pathname.startsWith('/api')) {
    // Check if request has sensitive headers (API keys, auth tokens)
    const hasSensitiveData =
      request.headers.has('authorization') ||
      request.headers.has('x-api-key') ||
      request.headers.has('x-csrf-token') ||
      request.method !== 'GET' // All state-changing requests need HTTPS

    if (hasSensitiveData && !isSecureRequest(request)) {
      logger.warn('Blocked insecure API request', {
        path: request.nextUrl.pathname,
        method: request.method,
      })
      return NextResponse.json(
        { error: 'HTTPS required for this endpoint' },
        { status: 403 }
      )
    }
  }

  // Security: Check for suspicious patterns in URL
  const url = request.nextUrl.pathname
  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /onerror=/i,
    /onclick=/i,
    /\.\.\/\.\.\/\.\.\//i, // Path traversal
    /\.\.\\/i,
  ]

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(url)) {
      const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
      logger.warn('Suspicious URL pattern detected', { url, ip })
      return NextResponse.json(
        { error: 'Invalid request' },
        { status: 400 }
      )
    }
  }

  // Security: Validate Content-Type header for POST/PUT/PATCH requests
  if (request.nextUrl.pathname.startsWith('/api')) {
    const contentTypeValidation = validateContentType(request)
    if (!contentTypeValidation.valid) {
      logger.warn('Invalid Content-Type header', { 
        path: url, 
        method: request.method,
        contentType: request.headers.get('content-type')
      })
      return NextResponse.json(
        { error: contentTypeValidation.error },
        { status: 415 } // Unsupported Media Type
      )
    }
  }

  // Security: Add additional security headers for specific routes
  const response = await updateSession(request)
  
  // Add CSRF protection for state-changing API routes
  if (request.method !== 'GET' && request.nextUrl.pathname.startsWith('/api')) {
    // Routes that legitimately accept external requests (webhooks, OAuth, etc.)
    const csrfExemptRoutes = [
      '/api/auth/callback',
      '/api/auth/google',
      '/api/cron/',
      '/api/webhooks/',
      '/api/health',
      '/api/stripe/webhook',
    ]

    const isExempt = csrfExemptRoutes.some(route => url.startsWith(route))

    if (!isExempt) {
      const origin = request.headers.get('origin')
      const requestHost = request.headers.get('host')

      // Verify origin matches host for state-changing requests (CSRF protection)
      // Allow requests without origin (server-to-server) or from same origin
      if (origin && requestHost) {
        // Normalize both origin and host for comparison (handle www vs non-www)
        const normalizedOrigin = origin.replace('https://', '').replace('http://', '').replace('www.', '')
        const normalizedHost = requestHost.replace('www.', '')

        if (!normalizedOrigin.startsWith(normalizedHost)) {
          logger.warn('CSRF attempt detected', { origin, host: requestHost, path: url })
          return NextResponse.json(
            { error: 'Invalid origin' },
            { status: 403 }
          )
        }
      }
    }
  }

  // SECURITY: Add security headers to all responses
  const securityHeaders = getSecurityHeaders()
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value)
  })

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder static assets
     *
     * NOTE: API routes ARE included for CSRF protection
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
