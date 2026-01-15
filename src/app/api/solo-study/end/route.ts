import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

// Minimum completion percentage required for rewards (80%)
const COMPLETION_THRESHOLD = 0.8

/**
 * POST /api/solo-study/end - End a Solo Study session
 *
 * Rewards are only given if user completes >= 80% of target time.
 * Early exits save the session but don't award XP/coins/streak.
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

    // Verify session belongs to user and get target duration
    const session = await prisma.focusSession.findUnique({
      where: { id: sessionId },
      select: { userId: true, status: true, durationMinutes: true },
    })

    if (!session || session.userId !== user.id) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Calculate completion percentage
    const targetMinutes = session.durationMinutes || 25
    const completionRatio = totalMinutes / targetMinutes
    const isFullyCompleted = completionRatio >= COMPLETION_THRESHOLD

    // Determine session status based on completion
    const sessionStatus = isFullyCompleted ? 'COMPLETED' : 'ABANDONED'

    // Update session
    const updatedSession = await prisma.focusSession.update({
      where: { id: sessionId },
      data: {
        status: sessionStatus,
        completedAt: new Date(),
        actualMinutes: totalMinutes,
      },
    })

    let xpEarned = 0
    let coinsEarned = 0
    let streakUpdated = false

    // Only award rewards if session was fully completed (>= 80%)
    if (isFullyCompleted) {
      // Award XP (25 per pomodoro) - stored in Profile
      xpEarned = completedPomodoros * 25

      // Award coins (10 per completed pomodoro)
      coinsEarned = completedPomodoros * 10

      if (xpEarned > 0 || coinsEarned > 0) {
        await prisma.profile.update({
          where: { userId: user.id },
          data: {
            totalPoints: { increment: xpEarned },
            coins: { increment: coinsEarned },
          },
        })
      }

      // Update solo study streak (separate from quick focus streak)
      await updateSoloStudyStreak(user.id)
      streakUpdated = true
    }

    return NextResponse.json({
      success: true,
      session: updatedSession,
      xpEarned,
      coinsEarned,
      streakUpdated,
      isFullyCompleted,
      completionPercentage: Math.round(completionRatio * 100),
      message: isFullyCompleted
        ? 'Great job completing your session!'
        : `Session ended early (${Math.round(completionRatio * 100)}% completed). Complete at least 80% to earn rewards.`,
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
 * Update user's SOLO STUDY streak (separate from Quick Focus streak)
 * Stored in Profile.soloStudyStreak field
 * Supports streak shields to protect against missed days
 */
async function updateSoloStudyStreak(userId: string) {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    // Get current profile stats (including streak shields)
    const profile = await prisma.profile.findUnique({
      where: { userId },
      select: {
        soloStudyStreak: true,
        lastSoloStudyDate: true,
        streakShields: true,
      },
    })

    if (!profile) return

    // Check if already completed a solo study session today
    if (profile.lastSoloStudyDate) {
      const lastStudy = new Date(profile.lastSoloStudyDate)
      lastStudy.setHours(0, 0, 0, 0)

      if (lastStudy.getTime() === today.getTime()) {
        // Already updated today, nothing to do
        return
      }
    }

    // Check if user completed a solo study session yesterday
    // Only count COMPLETED sessions (not ABANDONED)
    const yesterdaySession = await prisma.focusSession.findFirst({
      where: {
        userId,
        status: 'COMPLETED',
        mode: 'solo', // Only solo study sessions
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
      newStreak = (profile.soloStudyStreak || 0) + 1
    } else if (profile.lastSoloStudyDate) {
      // Didn't study yesterday - check if we can use a shield
      const lastStudy = new Date(profile.lastSoloStudyDate)
      lastStudy.setHours(0, 0, 0, 0)

      // Calculate days missed
      const daysMissed = Math.floor((today.getTime() - lastStudy.getTime()) / (1000 * 60 * 60 * 24)) - 1

      if (daysMissed > 0 && daysMissed <= (profile.streakShields || 0)) {
        // Use shields to protect streak
        shieldsToUse = daysMissed
        newStreak = (profile.soloStudyStreak || 0) + 1
        console.log(`[Solo Study Streak] Using ${shieldsToUse} shield(s) to protect streak for user ${userId}`)
      } else if (daysMissed > 0) {
        // No shields or not enough - streak resets
        newStreak = 1
        console.log(`[Solo Study Streak] Streak reset for user ${userId} (missed ${daysMissed} days, had ${profile.streakShields || 0} shields)`)
      }
    }

    // Update solo study streak and shields in Profile
    await prisma.profile.update({
      where: { userId },
      data: {
        soloStudyStreak: newStreak,
        lastSoloStudyDate: new Date(),
        ...(shieldsToUse > 0 && {
          streakShields: { decrement: shieldsToUse },
        }),
      },
    })

    if (shieldsToUse > 0) {
      console.log(`[Solo Study Streak] Streak protected! Used ${shieldsToUse} shield(s). New streak: ${newStreak}`)
    }
  } catch (error) {
    console.error('Update solo study streak error:', error)
  }
}
