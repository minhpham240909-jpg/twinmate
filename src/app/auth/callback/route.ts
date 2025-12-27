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
  const cookieStore = await cookies()

  // Note: Supabase handles OAuth CSRF protection internally with its own state parameter
  // We don't need custom state validation - Supabase validates it during code exchange

  if (code) {
    try {
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

        // Create redirect response and attach all cookies
        const response = NextResponse.redirect(new URL(redirectPath, requestUrl.origin))

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
