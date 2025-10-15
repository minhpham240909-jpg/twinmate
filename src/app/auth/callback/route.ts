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

      if (data.user) {
        // Sync user to database
        try {
          let dbUser = await prisma.user.findUnique({
            where: { id: data.user.id },
          })

          if (!dbUser) {
            // Create user and profile in transaction
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
            // Update last login
            await prisma.user.update({
              where: { id: data.user.id },
              data: { lastLoginAt: new Date() },
            })
          }
        } catch (dbError) {
          console.error('Database sync error:', dbError)
          // Continue anyway - user can be synced later
        }
      }

      // Redirect to dashboard
      return NextResponse.redirect(new URL('/dashboard', requestUrl.origin))
    } catch (err) {
      console.error('Callback error:', err)
      return NextResponse.redirect(new URL('/auth/error?message=Authentication+failed', requestUrl.origin))
    }
  }

  // No code present, redirect to sign in
  return NextResponse.redirect(new URL('/auth/signin', requestUrl.origin))
}
