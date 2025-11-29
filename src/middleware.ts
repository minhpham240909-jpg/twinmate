import { updateSession } from '@/lib/supabase/middleware'
import { type NextRequest, NextResponse } from 'next/server'
import logger from '@/lib/logger'
import { validateContentType } from '@/lib/security/content-type'

export async function middleware(request: NextRequest) {
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
      const host = request.headers.get('host')

      // Verify origin matches host for state-changing requests (CSRF protection)
      // Allow requests without origin (server-to-server) or from same origin
      if (origin && !origin.includes(host || '')) {
        logger.warn('CSRF attempt detected', { origin, host, path: url })
        return NextResponse.json(
          { error: 'Invalid origin' },
          { status: 403 }
        )
      }
    }
  }

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
