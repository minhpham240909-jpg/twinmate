import { NextResponse } from 'next/server'
import {
  generatePreAuthCsrfToken,
  getPreAuthCsrfCookieName,
  getPreAuthCsrfCookieOptions,
} from '@/lib/csrf'

/**
 * GET /api/csrf/pre-auth - Get CSRF token for pre-authentication forms (signin/signup)
 * This is different from the session-based CSRF token - it works without authentication
 */
export async function GET() {
  try {
    const { token, cookieValue } = await generatePreAuthCsrfToken()

    const response = NextResponse.json({ csrfToken: token })

    // Set the signed token in an httpOnly cookie
    response.cookies.set(
      getPreAuthCsrfCookieName(),
      cookieValue,
      getPreAuthCsrfCookieOptions()
    )

    return response
  } catch (error) {
    console.error('Error generating pre-auth CSRF token:', error)
    return NextResponse.json(
      { error: 'Failed to generate CSRF token' },
      { status: 500 }
    )
  }
}
