import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Sanitize environment variables
const sanitizeEnvVar = (value: string | undefined): string => {
  if (!value) return ''
  return value.replace(/[\r\n\s]+/g, '').trim()
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const token_hash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type')
  const cookieStore = await cookies()

  const url = sanitizeEnvVar(process.env.NEXT_PUBLIC_SUPABASE_URL) || 'https://placeholder.supabase.co'
  const key = sanitizeEnvVar(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) || 'placeholder'

  // Track cookies that need to be set on the redirect response
  const cookiesToSetOnResponse: Array<{ name: string; value: string; options: any }> = []

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        // Store cookies to set on the redirect response
        cookiesToSet.forEach(({ name, value, options }) => {
          cookiesToSetOnResponse.push({ name, value, options })
          // Also set on cookieStore for immediate use
          try {
            cookieStore.set(name, value, options)
          } catch {
            // Ignore errors in server components
          }
        })
      },
    },
  })

  // Handle email confirmation (signup, email change, etc.)
  // Supabase sends token_hash and type parameters for email verification
  if (token_hash && type) {
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash,
        type: type as 'signup' | 'email' | 'recovery' | 'invite' | 'email_change',
      })

      if (error) {
        console.error('Email verification error:', error)
        return NextResponse.redirect(
          new URL('/auth/error?message=' + encodeURIComponent(error.message), requestUrl.origin)
        )
      }

      if (data.user && data.session) {
        // Email confirmed and user is now logged in!
        console.log('[Auth Callback] Email verified for user:', data.user.email)

        // Update database to mark email as verified
        try {
          await prisma.user.update({
            where: { id: data.user.id },
            data: {
              emailVerified: true,
              lastLoginAt: new Date(),
            },
          })
        } catch (dbError) {
          console.error('Database update error:', dbError)
          // Continue anyway - user is authenticated
        }

        // Redirect to dashboard (user is now logged in automatically!)
        const redirectUrl = new URL('/dashboard', requestUrl.origin)
        redirectUrl.searchParams.set('auth_callback', 'true')
        redirectUrl.searchParams.set('email_verified', 'true')

        const response = NextResponse.redirect(redirectUrl)

        // Set all session cookies on the redirect response
        cookiesToSetOnResponse.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, {
            ...options,
            path: '/',
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
          })
        })

        // Set verification success cookie
        response.cookies.set('auth_verified', 'true', {
          path: '/',
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          maxAge: 30,
          httpOnly: true,
        })

        return response
      }

      // If type is recovery (password reset), redirect to reset password page
      if (type === 'recovery') {
        return NextResponse.redirect(new URL('/auth/reset-password', requestUrl.origin))
      }

      // Email verified but no session - redirect to sign in
      return NextResponse.redirect(
        new URL('/auth?message=' + encodeURIComponent('Email verified! Please sign in.'), requestUrl.origin)
      )
    } catch (err) {
      console.error('Email verification error:', err)
      return NextResponse.redirect(
        new URL('/auth/error?message=Email+verification+failed', requestUrl.origin)
      )
    }
  }

  // Handle OAuth callback (code exchange)
  if (code) {
    try {
      // Exchange the code for a session - this triggers setAll with session cookies
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)

      if (error) {
        console.error('Auth callback error:', error)
        return NextResponse.redirect(new URL('/auth/error?message=' + encodeURIComponent(error.message), requestUrl.origin))
      }

      if (data.user && data.session) {
        // Sync user to database
        let redirectPath = '/dashboard'

        try {
          let dbUser = await prisma.user.findUnique({
            where: { id: data.user.id },
          })

          const provider = data.user.app_metadata?.provider
          const isGoogleOAuth = provider === 'google'
          const isMicrosoftOAuth = provider === 'azure'
          const isOAuthProvider = isGoogleOAuth || isMicrosoftOAuth
          const isEmailConfirmedBySupabase = data.user.email_confirmed_at !== null

          if (!dbUser) {
            // Create user and profile in transaction
            const email = data.user.email!
            const emailVerified = isOAuthProvider ? true : isEmailConfirmedBySupabase
            const userName = data.user.user_metadata?.full_name
              || data.user.user_metadata?.name
              || email.split('@')[0]
            const avatarUrl = data.user.user_metadata?.avatar_url
              || data.user.user_metadata?.picture
              || null

            const result = await prisma.$transaction(async (tx) => {
              const newUser = await tx.user.create({
                data: {
                  id: data.user.id,
                  email: email,
                  name: userName,
                  avatarUrl: avatarUrl,
                  googleId: isGoogleOAuth ? data.user.id : null,
                  microsoftId: isMicrosoftOAuth ? data.user.id : null,
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
            redirectPath = '/dashboard'
            console.log('[Auth Callback] Created new user:', email)
          } else {
            // Existing user - update lastLoginAt
            await prisma.user.update({
              where: { id: data.user.id },
              data: {
                emailVerified: isEmailConfirmedBySupabase || isOAuthProvider,
                lastLoginAt: new Date(),
              },
            })

            // Check if user is admin and redirect accordingly
            redirectPath = dbUser.isAdmin ? '/admin' : '/dashboard'
          }
        } catch (dbError) {
          console.error('Database sync error:', dbError)
          // Continue anyway - user can be synced later
        }

        // Create redirect response with auth_callback flag
        // This flag tells middleware to skip redundant getUser() verification
        // since we JUST authenticated and cookies are fresh
        const redirectUrl = new URL(redirectPath, requestUrl.origin)
        redirectUrl.searchParams.set('auth_callback', 'true')

        const response = NextResponse.redirect(redirectUrl)

        // CRITICAL: Set all session cookies on the redirect response
        // This ensures the browser receives the auth cookies with the redirect
        cookiesToSetOnResponse.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, {
            ...options,
            // Ensure cookies work across the domain
            path: '/',
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
          })
        })

        // Set a short-lived cookie to confirm successful auth callback
        // This cookie is checked by middleware to trust fresh auth
        response.cookies.set('auth_verified', 'true', {
          path: '/',
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          maxAge: 30, // Only valid for 30 seconds
          httpOnly: true,
        })

        return response
      }

      // If no session, redirect to signin
      return NextResponse.redirect(new URL('/auth', requestUrl.origin))
    } catch (err) {
      console.error('Callback error:', err)
      return NextResponse.redirect(new URL('/auth/error?message=Authentication+failed', requestUrl.origin))
    }
  }

  // No code or token_hash present, redirect to sign in
  return NextResponse.redirect(new URL('/auth', requestUrl.origin))
}
