// API Route: Sign Out
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export async function POST(_request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get user before signing out to update their presence
    const { data: { user } } = await supabase.auth.getUser()

    // Update user's presence status to offline before signing out
    if (user) {
      try {
        await (prisma.userPresence.upsert as any)({
          where: { userId: user.id },
          update: {
            status: 'offline',
            onlineStatus: 'OFFLINE',
            lastSeenAt: new Date(),
          },
          create: {
            userId: user.id,
            status: 'offline',
            onlineStatus: 'OFFLINE',
            lastSeenAt: new Date(),
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