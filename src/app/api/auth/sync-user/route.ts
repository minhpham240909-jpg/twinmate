// API Route: Sync authenticated Supabase user to our database
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      console.error('[sync-user] Auth error:', error?.message || 'No user')
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Check if user exists in database
    let dbUser
    try {
      dbUser = await prisma.user.findUnique({
        where: { id: user.id },
      })
    } catch (dbError) {
      console.error('[sync-user] Database connection error:', dbError)
      return NextResponse.json(
        { error: 'Database connection failed', details: dbError instanceof Error ? dbError.message : 'Unknown error' },
        { status: 503 }
      )
    }

    // Create user if doesn't exist
    if (!dbUser) {
      const email = user.email ?? null
      const name = user.user_metadata?.name || (email ? email.split('@')[0] : 'User')
      const avatarUrl = user.user_metadata?.avatar_url ?? null
      const googleId = user.app_metadata?.provider === 'google' && user.id ? user.id : null

      if (!email) {
        return NextResponse.json(
          { error: 'Email is required' },
          { status: 400 }
        )
      }

      // Create user and profile in transaction
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

          await tx.profile.create({
            data: {
              userId: newUser.id,
            },
          })

          return newUser
        })

        dbUser = result
      } catch (txError) {
        console.error('Failed to create user:', txError)
        return NextResponse.json(
          { error: 'Database error' },
          { status: 500 }
        )
      }
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    })

    return NextResponse.json({ success: true, user: dbUser })
  } catch (error) {
    console.error('[sync-user] Unexpected error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorName = error instanceof Error ? error.name : 'UnknownError'
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage, type: errorName },
      { status: 500 }
    )
  }
}
