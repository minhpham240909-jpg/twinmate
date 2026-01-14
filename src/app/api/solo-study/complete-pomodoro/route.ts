import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/solo-study/complete-pomodoro - Track completed pomodoro
 */
export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { sessionId, focusMinutes = 25, xpEarned = 25 } = body

    // Award XP immediately for completing a pomodoro (stored in Profile)
    await prisma.profile.update({
      where: { userId: user.id },
      data: {
        totalPoints: { increment: xpEarned },
      },
    })

    // Update session if provided
    if (sessionId) {
      await prisma.focusSession.update({
        where: { id: sessionId },
        data: {
          actualMinutes: { increment: focusMinutes },
        },
      })
    }

    return NextResponse.json({
      success: true,
      xpEarned,
    })
  } catch (error) {
    console.error('Complete pomodoro error:', error)
    return NextResponse.json(
      { error: 'Failed to track pomodoro' },
      { status: 500 }
    )
  }
}
