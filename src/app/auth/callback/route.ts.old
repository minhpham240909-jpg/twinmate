// Auth Callback Handler for OAuth
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && user) {
      // Check if user exists in database
      let dbUser = await prisma.user.findUnique({
        where: { id: user.id },
      })

      // Create user if doesn't exist (OAuth users)
      if (!dbUser) {
        // Safely handle potentially missing OAuth data
        const email = user.email ?? null
        const name = user.user_metadata?.name || (email ? email.split('@')[0] : 'User')
        const avatarUrl = user.user_metadata?.avatar_url ?? null
        const googleId = user.app_metadata?.provider === 'google' && user.id ? user.id : null

        // Validate email is present (required field)
        if (!email) {
          console.error('OAuth user missing email:', user.id)
          return NextResponse.redirect(new URL('/auth/error?reason=missing_email', request.url))
        }

        // Create user and profile in a single transaction
        try {
          const result = await prisma.$transaction(async (tx) => {
            const newUser = await tx.user.create({
              data: {
                id: user.id,
                email,
                name,
                avatarUrl,
                googleId,
                role: 'FREE',
                emailVerified: true,
              },
            })

            // Create empty profile
            const profile = await tx.profile.create({
              data: {
                userId: newUser.id,
              },
            })

            return { user: newUser, profile }
          })

          dbUser = result.user
        } catch (txError) {
          console.error('Failed to create user and profile:', txError)
          return NextResponse.redirect(new URL('/auth/error?reason=db_error', request.url))
        }
      }

      // Update last login
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      })

      // Always redirect to dashboard
      // TODO: Add onboarding page later for profile completion
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  // Redirect to error page if something went wrong
  return NextResponse.redirect(new URL('/auth/error', request.url))
}