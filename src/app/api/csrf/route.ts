import { NextResponse } from 'next/server'
import { generateCsrfToken } from '@/lib/csrf'

/**
 * GET /api/csrf - Get CSRF token for the current session
 * Client must call this before making any state-changing requests
 */
export async function GET() {
  try {
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
