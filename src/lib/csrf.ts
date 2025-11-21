import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * CSRF Token Validation
 * 
 * This module provides CSRF protection for state-changing requests (POST, PUT, DELETE).
 * Uses the 'double submit cookie' pattern with Supabase session as the source of truth.
 * 
 * Implementation:
 * 1. Client includes X-CSRF-Token header in requests
 * 2. Server validates token against user's session
 * 3. Tokens are derived from the user's session ID (no need to store separately)
 */

const CSRF_HEADER = 'x-csrf-token'
const CSRF_SECRET = process.env.CSRF_SECRET || 'default-csrf-secret-change-in-production'

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
    const token = await hashToken(session.access_token + CSRF_SECRET)
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
    const expectedToken = await hashToken(session.access_token + CSRF_SECRET)
    
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

/**
 * Exclude certain routes from CSRF protection
 * (e.g., webhook endpoints, public APIs)
 */
export function shouldSkipCsrfProtection(pathname: string): boolean {
  const skipPatterns = [
    '/api/auth/google', // OAuth callback
    '/api/cron/',       // Cron jobs
    '/api/webhooks/',   // Webhooks (if added)
    '/api/health',      // Health check
  ]
  
  return skipPatterns.some(pattern => pathname.startsWith(pattern))
}
