import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { generateCsrfToken } from '@/lib/csrf'

/**
 * GET /api/csrf - Get CSRF token for the current session
 * Client must call this before making any state-changing requests
 */
export async function GET(request: NextRequest) {
  try {
    // Rate limiting - lenient for CSRF token generation
    const rateLimitResult = await rateLimit(request, RateLimitPresets.lenient)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please slow down.' },
        { status: 429, headers: rateLimitResult.headers }
      )
    }
    const token = await generateCsrfToken()
    
    if (!token) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }
    
    return NextResponse.json({ csrfToken: token })
  } catch (error) {
    console.error('Error getting CSRF token:', error)
    return NextResponse.json(
      { error: 'Failed to generate CSRF token' },
      { status: 500 }
    )
  }
}
