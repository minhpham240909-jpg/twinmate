// API Route: Sign Out
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    // Rate limiting - moderate for signout
    const rateLimitResult = await rateLimit(request, RateLimitPresets.moderate)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please slow down.' },
        { status: 429, headers: rateLimitResult.headers }
      )
    }

    const supabase = await createClient()

    // Get user before signing out
    const { data: { user } } = await supabase.auth.getUser()

    // Immediately mark user as offline when signing out
    if (user) {
      try {
        // Mark all device sessions for this user as inactive
        await prisma.deviceSession.updateMany({
          where: {
            userId: user.id,
            isActive: true,
          },
          data: {
            isActive: false,
            updatedAt: new Date(),
          },
        })
        
        // Immediately set user status to offline
        await prisma.userPresence.upsert({
          where: { userId: user.id },
          update: {
            status: 'offline',
            lastSeenAt: new Date(),
            updatedAt: new Date(),
          },
          create: {
            userId: user.id,
            status: 'offline',
            lastSeenAt: new Date(),
            lastActivityAt: new Date(),
          },
        })
      } catch (presenceError) {
        console.error('Error updating presence on signout:', presenceError)
        // Continue with signout even if presence update fails
      }
    }

    const { error } = await supabase.auth.signOut()

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Signed out successfully',
    })
  } catch (error) {
    console.error('Sign out error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}