import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  // Note: Supabase handles OAuth CSRF protection internally with its own state parameter
  // We don't need custom state validation - Supabase validates it during code exchange

  if (code) {
    try {
      const supabase = await createClient()

      // Exchange the code for a session
      // Supabase SSR handles session cookies automatically via the setAll callback
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)

      if (error) {
        console.error('Auth callback error:', error)
        return NextResponse.redirect(new URL('/auth/error?message=' + encodeURIComponent(error.message), requestUrl.origin))
      }

      if (data.user && data.session) {
        // Sync user to database
        let redirectPath = '/dashboard'
        let isNewUser = false

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

            // Email verification strategy:
            // - OAuth providers (Google, Microsoft): Trust provider's verification (emailVerified = true)
            // - Email/Password: Require email confirmation (emailVerified set by Supabase callback)
            const emailVerified = isOAuthProvider ? true : isEmailConfirmedBySupabase

            // Get user name from OAuth metadata
            // Microsoft uses 'full_name' or 'name', Google uses 'name'
            const userName = data.user.user_metadata?.full_name
              || data.user.user_metadata?.name
              || email.split('@')[0]

            // Get avatar URL - Microsoft uses 'picture' or 'avatar_url'
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
            isNewUser = true
            redirectPath = '/dashboard'
            const authMethod = isGoogleOAuth ? 'Google OAuth' : isMicrosoftOAuth ? 'Microsoft OAuth' : 'Email/Password'
            console.log('[Auth Callback] Created new user:', email, 'via', authMethod)
          } else {
            // Existing user - update emailVerified if confirmed by Supabase or OAuth provider
            const wasUnverified = !dbUser.emailVerified
            const nowVerified = isEmailConfirmedBySupabase || isOAuthProvider

            await prisma.user.update({
              where: { id: data.user.id },
              data: {
                emailVerified: nowVerified,
                lastLoginAt: new Date(),
              },
            })

            if (wasUnverified && nowVerified) {
              console.log('[Auth Callback] Email confirmed for user:', data.user.email)
            }

            // Check if user is admin and redirect accordingly
            redirectPath = dbUser.isAdmin ? '/admin' : '/dashboard'
          }
        } catch (dbError) {
          console.error('Database sync error:', dbError)
          // Continue anyway - user can be synced later
        }

        // Direct server-side redirect for fastest navigation
        // The session cookies are already set by Supabase SSR
        return NextResponse.redirect(new URL(redirectPath, requestUrl.origin))
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
