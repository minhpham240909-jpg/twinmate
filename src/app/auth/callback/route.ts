import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

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

          // Check if this is an email confirmation (user already exists but email wasn't verified)
          const isEmailConfirmation = dbUser && !dbUser.emailVerified

          if (!dbUser) {
            // Create user and profile in transaction (OAuth flow)
            const email = data.user.email!
            const result = await prisma.$transaction(async (tx) => {
              const newUser = await tx.user.create({
                data: {
                  id: data.user.id,
                  email: email,
                  name: data.user.user_metadata?.name || email.split('@')[0],
                  avatarUrl: data.user.user_metadata?.avatar_url,
                  googleId: data.user.app_metadata?.provider === 'google' ? data.user.id : null,
                  role: 'FREE',
                  emailVerified: true,
                },
              })

              await tx.profile.create({
                data: { userId: newUser.id },
              })

              return newUser
            })

            dbUser = result
          } else {
            // Update user: mark email as verified and update last login
            await prisma.user.update({
              where: { id: data.user.id },
              data: {
                emailVerified: true,
                lastLoginAt: new Date(),
              },
            })

            if (isEmailConfirmation) {
              console.log('[Auth Callback] ✅ Email confirmed for user:', data.user.email)
            }
          }
        } catch (dbError) {
          console.error('Database sync error:', dbError)
          // Continue anyway - user can be synced later
        }

        // Set custom cookies with access and refresh tokens and redirect to dashboard
        const response = NextResponse.redirect(new URL('/dashboard', requestUrl.origin))

        const expires = new Date(data.session.expires_at! * 1000)

        response.cookies.set('sb-access-token', data.session.access_token, {
          expires,
          path: '/',
          sameSite: 'lax',
          httpOnly: false, // Allow JavaScript to read for session sync
        })

        response.cookies.set('sb-refresh-token', data.session.refresh_token, {
          expires,
          path: '/',
          sameSite: 'lax',
          httpOnly: false, // Allow JavaScript to read for session sync
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
