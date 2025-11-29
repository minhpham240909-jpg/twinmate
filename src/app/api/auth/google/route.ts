// API Route: Google OAuth Sign In
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import logger from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get the origin from the request for dynamic redirect
    const requestUrl = new URL(request.url)
    const origin = requestUrl.origin
    const redirectUrl = `${origin}/auth/callback`

    // Note: Supabase handles CSRF protection internally with its own state parameter
    // We don't need to add custom state - it would conflict with Supabase's validation

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    })

    if (error) {
      logger.error('Google OAuth initiation failed', { error: error.message })
      return NextResponse.json(
        { error: 'Failed to initiate sign in. Please try again.' },
        { status: 400 }
      )
    }

    return NextResponse.redirect(data.url)
  } catch (error) {
    logger.error('Google OAuth error', error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    )
  }
}