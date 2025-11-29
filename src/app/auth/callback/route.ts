import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateOAuthState, clearOAuthStateCookie } from '@/lib/security/oauth-state'
import logger from '@/lib/logger'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const stateFromCallback = requestUrl.searchParams.get('state')

  // Validate OAuth state parameter to prevent CSRF attacks
  // Note: We only validate if state was provided (backwards compatible)
  if (stateFromCallback) {
    const stateValidation = await validateOAuthState(stateFromCallback)
    if (!stateValidation.valid) {
      logger.warn('OAuth state validation failed', { reason: stateValidation.reason })
      return NextResponse.redirect(
        new URL('/auth/error?message=' + encodeURIComponent('Invalid authentication request. Please try again.'), requestUrl.origin)
      )
    }
  } else {
    // Clear any existing state cookie if no state was provided
    await clearOAuthStateCookie()
  }

  if (code) {
    try {
      const supabase = await createClient()

      // Exchange the code for a session
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)

      if (error) {
        console.error('Auth callback error:', error)
        return NextResponse.redirect(new URL('/auth/error?message=' + encodeURIComponent(error.message), requestUrl.origin))
      }

      if (data.user && data.session) {
        // Sync user to database
        try {
          let dbUser = await prisma.user.findUnique({
            where: { id: data.user.id },
          })

          const isGoogleOAuth = data.user.app_metadata?.provider === 'google'
          const isEmailConfirmedBySupabase = data.user.email_confirmed_at !== null

          if (!dbUser) {
            // Create user and profile in transaction
            const email = data.user.email!

            // Email verification strategy:
            // - Google OAuth: Trust Google's verification (emailVerified = true)
            // - Email/Password: Require email confirmation (emailVerified set by Supabase callback)
            const emailVerified = isGoogleOAuth ? true : isEmailConfirmedBySupabase

            const result = await prisma.$transaction(async (tx) => {
              const newUser = await tx.user.create({
                data: {
                  id: data.user.id,
                  email: email,
                  name: data.user.user_metadata?.name || email.split('@')[0],
                  avatarUrl: data.user.user_metadata?.avatar_url,
                  googleId: isGoogleOAuth ? data.user.id : null,
                  role: 'FREE',
                  emailVerified,
                },
              })

              await tx.profile.create({
                data: { userId: newUser.id },
              })

              return newUser
            })

            dbUser = result
            console.log('[Auth Callback] Created new user:', email, 'via', isGoogleOAuth ? 'Google OAuth' : 'Email/Password')
            
            // Redirect new users to onboarding
            const response = NextResponse.redirect(new URL('/onboarding', requestUrl.origin))
            const expires = new Date(data.session.expires_at! * 1000)
            
            response.cookies.set('sb-access-token', data.session.access_token, {
              expires,
              path: '/',
              sameSite: 'lax',
              httpOnly: true, // SECURITY: Prevent XSS attacks from stealing tokens
              secure: process.env.NODE_ENV === 'production',
            })

            response.cookies.set('sb-refresh-token', data.session.refresh_token, {
              expires,
              path: '/',
              sameSite: 'lax',
              httpOnly: true, // SECURITY: Prevent XSS attacks from stealing tokens
              secure: process.env.NODE_ENV === 'production',
            })

            return response
          } else {
            // Existing user - update emailVerified if confirmed by Supabase
            const wasUnverified = !dbUser.emailVerified
            const nowVerified = isEmailConfirmedBySupabase || isGoogleOAuth

            await prisma.user.update({
              where: { id: data.user.id },
              data: {
                emailVerified: nowVerified,
                lastLoginAt: new Date(),
              },
            })

            if (wasUnverified && nowVerified) {
              console.log('[Auth Callback] ✅ Email confirmed for user:', data.user.email)
            }

            // Check if user is admin and redirect accordingly
            const redirectUrl = dbUser.isAdmin ? '/admin' : '/dashboard'
            const response = NextResponse.redirect(new URL(redirectUrl, requestUrl.origin))

            const expires = new Date(data.session.expires_at! * 1000)

            response.cookies.set('sb-access-token', data.session.access_token, {
              expires,
              path: '/',
              sameSite: 'lax',
              httpOnly: true, // SECURITY: Prevent XSS attacks from stealing tokens
              secure: process.env.NODE_ENV === 'production',
            })

            response.cookies.set('sb-refresh-token', data.session.refresh_token, {
              expires,
              path: '/',
              sameSite: 'lax',
              httpOnly: true, // SECURITY: Prevent XSS attacks from stealing tokens
              secure: process.env.NODE_ENV === 'production',
            })

            // Removed email logging for privacy
            return response
          }
        } catch (dbError) {
          console.error('Database sync error:', dbError)
          // Continue anyway - user can be synced later
        }

        // Fallback: redirect to dashboard if db check failed
        const response = NextResponse.redirect(new URL('/dashboard', requestUrl.origin))

        const expires = new Date(data.session.expires_at! * 1000)

        response.cookies.set('sb-access-token', data.session.access_token, {
          expires,
          path: '/',
          sameSite: 'lax',
          httpOnly: true, // SECURITY: Prevent XSS attacks from stealing tokens
          secure: process.env.NODE_ENV === 'production',
        })

        response.cookies.set('sb-refresh-token', data.session.refresh_token, {
          expires,
          path: '/',
          sameSite: 'lax',
          httpOnly: true, // SECURITY: Prevent XSS attacks from stealing tokens
          secure: process.env.NODE_ENV === 'production',
        })

        console.log('[OAuth Callback] ✅ Cookies set, redirecting to dashboard')
        return response
      }

      // If no session, redirect to signin
      return NextResponse.redirect(new URL('/auth/signin', requestUrl.origin))
    } catch (err) {
      console.error('Callback error:', err)
      return NextResponse.redirect(new URL('/auth/error?message=Authentication+failed', requestUrl.origin))
    }
  }

  // No code present, redirect to sign in
  return NextResponse.redirect(new URL('/auth/signin', requestUrl.origin))
}
