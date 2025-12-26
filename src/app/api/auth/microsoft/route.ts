// API Route: Microsoft OAuth Sign In
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import logger from '@/lib/logger'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const origin = requestUrl.origin

  try {
    const supabase = await createClient()
    const redirectUrl = `${origin}/auth/callback`

    // Note: Supabase handles CSRF protection internally with its own state parameter
    // We don't need to add custom state - it would conflict with Supabase's validation

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        redirectTo: redirectUrl,
        scopes: 'email profile openid',
        queryParams: {
          // Request offline access for refresh tokens
          prompt: 'select_account',
        },
      },
    })

    if (error) {
      logger.error('Microsoft OAuth initiation failed', { error: error.message })
      // Redirect to error page instead of returning JSON (since browser navigates directly)
      return NextResponse.redirect(
        new URL(`/auth/error?message=${encodeURIComponent(error.message)}`, origin)
      )
    }

    if (!data?.url) {
      logger.error('Microsoft OAuth returned no URL - provider may not be enabled in Supabase')
      return NextResponse.redirect(
        new URL('/auth/error?message=' + encodeURIComponent('Microsoft sign-in is not configured. Please contact support.'), origin)
      )
    }

    return NextResponse.redirect(data.url)
  } catch (error) {
    logger.error('Microsoft OAuth error', error instanceof Error ? error : new Error(String(error)))
    return NextResponse.redirect(
      new URL('/auth/error?message=' + encodeURIComponent('An unexpected error occurred. Please try again.'), origin)
    )
  }
}
