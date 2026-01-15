import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/solo-study/end - End a Solo Study session
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
    const { sessionId, totalMinutes = 0, completedPomodoros = 0 } = body

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
    }

    // Verify session belongs to user
    const session = await prisma.focusSession.findUnique({
      where: { id: sessionId },
      select: { userId: true, status: true },
    })

    if (!session || session.userId !== user.id) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Update session
    const updatedSession = await prisma.focusSession.update({
      where: { id: sessionId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        actualMinutes: totalMinutes,
      },
    })

    // Award XP (25 per pomodoro) - stored in Profile
    const xpEarned = completedPomodoros * 25

    if (xpEarned > 0) {
      await prisma.profile.update({
        where: { userId: user.id },
        data: {
          totalPoints: { increment: xpEarned },
        },
      })
    }

    // Update streak in Profile
    await updateStreak(user.id)

    return NextResponse.json({
      success: true,
      session: updatedSession,
      xpEarned,
    })
  } catch (error) {
    console.error('End solo study error:', error)
    return NextResponse.json(
      { error: 'Failed to end session' },
      { status: 500 }
    )
  }
}

/**
 * Update user's study streak (stored in Profile)
 * Now supports streak shields to protect against missed days
 */
async function updateStreak(userId: string) {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    const twoDaysAgo = new Date(today)
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)

    // Get current profile stats (including streak shields)
    const profile = await prisma.profile.findUnique({
      where: { userId },
      select: {
        studyStreak: true,
        lastStudyDate: true,
        streakShields: true,
      },
    })

    if (!profile) return

    // Check if already studied today
    if (profile.lastStudyDate) {
      const lastStudy = new Date(profile.lastStudyDate)
      lastStudy.setHours(0, 0, 0, 0)

      if (lastStudy.getTime() === today.getTime()) {
        // Already updated today, nothing to do
        return
      }
    }

    // Check if user studied yesterday
    const yesterdaySession = await prisma.focusSession.findFirst({
      where: {
        userId,
        status: 'COMPLETED',
        startedAt: {
          gte: yesterday,
          lt: today,
        },
      },
    })

    let newStreak = 1
    let shieldsToUse = 0

    if (yesterdaySession) {
      // Studied yesterday - continue the streak
      newStreak = (profile.studyStreak || 0) + 1
    } else if (profile.lastStudyDate) {
      // Didn't study yesterday - check if we can use a shield
      const lastStudy = new Date(profile.lastStudyDate)
      lastStudy.setHours(0, 0, 0, 0)

      // Calculate days missed
      const daysMissed = Math.floor((today.getTime() - lastStudy.getTime()) / (1000 * 60 * 60 * 24)) - 1

      if (daysMissed > 0 && daysMissed <= (profile.streakShields || 0)) {
        // Use shields to protect streak
        shieldsToUse = daysMissed
        newStreak = (profile.studyStreak || 0) + 1
        console.log(`[Streak] Using ${shieldsToUse} shield(s) to protect streak for user ${userId}`)
      } else if (daysMissed > 0) {
        // No shields or not enough - streak resets
        newStreak = 1
        console.log(`[Streak] Streak reset for user ${userId} (missed ${daysMissed} days, had ${profile.streakShields || 0} shields)`)
      }
    }

    // Update streak and shields in Profile
    await prisma.profile.update({
      where: { userId },
      data: {
        studyStreak: newStreak,
        lastStudyDate: new Date(),
        ...(shieldsToUse > 0 && {
          streakShields: { decrement: shieldsToUse },
        }),
      },
    })

    if (shieldsToUse > 0) {
      console.log(`[Streak] Streak protected! Used ${shieldsToUse} shield(s). New streak: ${newStreak}`)
    }
  } catch (error) {
    console.error('Update streak error:', error)
  }
}
