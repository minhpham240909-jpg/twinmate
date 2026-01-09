import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * CSRF Token Validation
 *
 * This module provides CSRF protection for state-changing requests (POST, PUT, DELETE).
 *
 * Two patterns are supported:
 * 1. Session-based CSRF (for authenticated users):
 *    - Uses the 'double submit cookie' pattern with Supabase session as the source of truth
 *    - Client includes X-CSRF-Token header in requests
 *    - Server validates token against user's session
 *
 * 2. Pre-auth CSRF (for signin/signup forms):
 *    - Uses a signed cookie + header pattern
 *    - Server generates a random token stored in httpOnly cookie
 *    - Client includes the same token in the request body
 *    - Server validates that cookie token matches request token
 */

const CSRF_HEADER = 'x-csrf-token'
const CSRF_SECRET = process.env.CSRF_SECRET
const PRE_AUTH_CSRF_COOKIE = 'pre_auth_csrf'
const PRE_AUTH_CSRF_TTL = 60 * 15 // 15 minutes
const isProduction = process.env.NODE_ENV === 'production'

// SECURITY FIX: Secure secret management with proper signing
// - Production: MUST have CSRF_SECRET configured (fails hard if not)
// - Development: Uses runtime-generated secret per server instance
let runtimeSecret: string | null = null
let secretValidationLogged = false

/**
 * Get the effective CSRF secret with proper security guarantees
 * - In production: Throws if CSRF_SECRET not configured
 * - In development: Generates a unique runtime secret if not configured
 */
function getEffectiveSecret(): string {
  // Production: MUST have proper CSRF_SECRET configured
  if (isProduction) {
    if (!CSRF_SECRET || CSRF_SECRET.length < 32) {
      throw new Error(
        'CSRF_SECRET must be configured in production (min 32 characters). ' +
        'Set CSRF_SECRET environment variable to enable CSRF protection.'
      )
    }
    return CSRF_SECRET
  }

  // Development: Use CSRF_SECRET if available, otherwise generate runtime secret
  if (CSRF_SECRET && CSRF_SECRET.length >= 32) {
    return CSRF_SECRET
  }

  // Generate a unique runtime secret for this server instance (dev only)
  if (!runtimeSecret) {
    const randomBytes = new Uint8Array(32)
    crypto.getRandomValues(randomBytes)
    runtimeSecret = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('')
    if (!secretValidationLogged) {
      console.warn('[CSRF] Development mode: Using generated runtime secret. Configure CSRF_SECRET for persistent tokens.')
      secretValidationLogged = true
    }
  }

  return runtimeSecret
}

// Log warning once at startup if production is misconfigured
if (isProduction && (!CSRF_SECRET || CSRF_SECRET.length < 32)) {
  console.error('🔴 CRITICAL: CSRF_SECRET not configured or too short!')
  console.error('   Application will throw errors on CSRF operations.')
  console.error('   Set CSRF_SECRET in environment variables (min 32 characters)')
}

/**
 * Generate a CSRF token for the current user session
 */
export async function generateCsrfToken(): Promise<string | null> {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session?.access_token) {
      return null
    }

    // Use a simple hash of session token + secret
    // This is secure because:
    // 1. Session token is cryptographically secure
    // 2. Secret is server-side only
    // 3. Token changes when session changes
    const secret = getEffectiveSecret()
    const token = await hashToken(session.access_token + secret)
    return token
  } catch (error) {
    console.error('Error generating CSRF token:', error)
    return null
  }
}

/**
 * Validate CSRF token from request headers
 */
export async function validateCsrfToken(req: NextRequest): Promise<boolean> {
  try {
    // Get token from header
    const clientToken = req.headers.get(CSRF_HEADER)
    if (!clientToken) {
      return false
    }

    // Get user session
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session?.access_token) {
      return false
    }

    // Generate expected token
    const secret = getEffectiveSecret()
    const expectedToken = await hashToken(session.access_token + secret)
    
    // Compare tokens (timing-safe comparison)
    return timingSafeEqual(clientToken, expectedToken)
  } catch (error) {
    console.error('Error validating CSRF token:', error)
    return false
  }
}

/**
 * CSRF protection middleware for API routes
 * Only validates for state-changing methods (POST, PUT, DELETE, PATCH)
 */
export async function withCsrfProtection(
  req: NextRequest,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  const method = req.method.toUpperCase()
  
  // Only protect state-changing methods
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    const isValid = await validateCsrfToken(req)
    
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid or missing CSRF token' },
        { status: 403 }
      )
    }
  }
  
  return handler()
}

/**
 * Simple hash function using Web Crypto API
 */
async function hashToken(input: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }

  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }

  return result === 0
}

// ============================================================================
// PRE-AUTH CSRF (for signin/signup - users not authenticated yet)
// ============================================================================

/**
 * Generate a pre-auth CSRF token for unauthenticated forms (signin/signup)
 * Returns the token and sets it in an httpOnly cookie
 */
export async function generatePreAuthCsrfToken(): Promise<{ token: string; cookieValue: string }> {
  const secret = getEffectiveSecret()

  // Generate a random token
  const randomBytes = new Uint8Array(32)
  crypto.getRandomValues(randomBytes)
  const token = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('')

  // Create a signed version for the cookie (token + signature)
  const timestamp = Date.now()
  const dataToSign = `${token}:${timestamp}`
  const signature = await hashToken(dataToSign + secret)
  const cookieValue = `${token}:${timestamp}:${signature}`

  return { token, cookieValue }
}

/**
 * Validate a pre-auth CSRF token from request against the cookie
 */
export async function validatePreAuthCsrfToken(request: NextRequest): Promise<boolean> {
  try {
    // Get token from request body or header
    const clientToken = request.headers.get(CSRF_HEADER)
    if (!clientToken) {
      console.warn('[CSRF] Pre-auth validation failed: No client token in header')
      return false
    }

    // Get signed token from cookie
    const cookieValue = request.cookies.get(PRE_AUTH_CSRF_COOKIE)?.value
    if (!cookieValue) {
      console.warn('[CSRF] Pre-auth validation failed: No cookie found. Cookie name:', PRE_AUTH_CSRF_COOKIE)
      console.warn('[CSRF] Available cookies:', request.cookies.getAll().map(c => c.name).join(', '))
      return false
    }

    // Parse the cookie value: token:timestamp:signature
    const parts = cookieValue.split(':')
    if (parts.length !== 3) {
      console.warn('[CSRF] Pre-auth validation failed: Invalid cookie format, parts:', parts.length)
      return false
    }

    const [storedToken, timestamp, signature] = parts

    // Verify timestamp is not expired (15 minutes)
    const tokenAge = Date.now() - parseInt(timestamp, 10)
    if (isNaN(tokenAge) || tokenAge > PRE_AUTH_CSRF_TTL * 1000 || tokenAge < 0) {
      console.warn('[CSRF] Pre-auth validation failed: Token expired or invalid timestamp. Age:', tokenAge, 'ms, Max:', PRE_AUTH_CSRF_TTL * 1000, 'ms')
      return false
    }

    // Verify signature
    const secret = getEffectiveSecret()
    const expectedSignature = await hashToken(`${storedToken}:${timestamp}` + secret)
    if (!timingSafeEqual(signature, expectedSignature)) {
      console.warn('[CSRF] Pre-auth validation failed: Signature mismatch')
      return false
    }

    // Verify client token matches stored token
    const tokensMatch = timingSafeEqual(clientToken, storedToken)
    if (!tokensMatch) {
      console.warn('[CSRF] Pre-auth validation failed: Client token does not match stored token')
    }
    return tokensMatch
  } catch (error) {
    console.error('Error validating pre-auth CSRF token:', error)
    return false
  }
}

/**
 * Get the pre-auth CSRF cookie name (exported for use in API routes)
 */
export function getPreAuthCsrfCookieName(): string {
  return PRE_AUTH_CSRF_COOKIE
}

/**
 * Get the pre-auth CSRF cookie options
 */
export function getPreAuthCsrfCookieOptions() {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: PRE_AUTH_CSRF_TTL,
  }
}

/**
 * Wrapper for pre-auth routes (signin/signup) with CSRF protection
 */
export async function withPreAuthCsrfProtection(
  req: NextRequest,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  // In development without CSRF_SECRET, allow requests but log warning
  // In production, getEffectiveSecret() will throw if not configured
  if (!isProduction && (!CSRF_SECRET || CSRF_SECRET.length < 32)) {
    console.warn('[CSRF] Development mode: Skipping pre-auth CSRF validation - CSRF_SECRET not configured')
    return handler()
  }

  const isValid = await validatePreAuthCsrfToken(req)

  if (!isValid) {
    // Log security event
    console.warn(`[CSRF] Invalid pre-auth token attempt: ${req.method} ${new URL(req.url).pathname}`)

    return NextResponse.json(
      { error: 'Invalid or missing CSRF token. Please refresh the page and try again.' },
      { status: 403 }
    )
  }

  return handler()
}

/**
 * Exclude certain routes from CSRF protection
 * (e.g., webhook endpoints, public APIs)
 */
export function shouldSkipCsrfProtection(pathname: string): boolean {
  const skipPatterns = [
    '/api/auth/google',     // OAuth callback
    '/api/auth/microsoft',  // OAuth callback
    '/api/auth/callback',   // Auth callback
    '/api/cron/',           // Cron jobs (protected by CRON_SECRET)
    '/api/webhooks/',       // Webhooks (protected by webhook signatures)
    '/api/health',          // Health check
    '/api/stripe/webhook',  // Stripe webhook (protected by Stripe signature)
  ]

  return skipPatterns.some(pattern => pathname.startsWith(pattern))
}

/**
 * Type-safe API route handler with built-in CSRF protection
 *
 * Usage:
 * ```typescript
 * import { withCsrf } from '@/lib/csrf'
 *
 * export const POST = withCsrf(async (request) => {
 *   // Your handler logic here
 *   return NextResponse.json({ success: true })
 * })
 * ```
 */
export function withCsrf(
  handler: (request: NextRequest) => Promise<NextResponse>
): (request: NextRequest) => Promise<NextResponse> {
  return async (request: NextRequest) => {
    const method = request.method.toUpperCase()

    // Only protect state-changing methods
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      // Skip CSRF for excluded routes
      const pathname = new URL(request.url).pathname
      if (!shouldSkipCsrfProtection(pathname)) {
        const isValid = await validateCsrfToken(request)

        if (!isValid) {
          // In production, log the attempt for security monitoring
          if (isProduction) {
            console.warn(`[CSRF] Invalid token attempt: ${method} ${pathname}`)
          }

          return NextResponse.json(
            { error: 'Invalid or missing CSRF token' },
            { status: 403 }
          )
        }
      }
    }

    return handler(request)
  }
}
