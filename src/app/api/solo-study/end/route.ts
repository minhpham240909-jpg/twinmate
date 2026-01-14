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
 */
async function updateStreak(userId: string) {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

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

    // Get current profile stats
    const profile = await prisma.profile.findUnique({
      where: { userId },
      select: { studyStreak: true, lastStudyDate: true },
    })

    if (!profile) return

    let newStreak = 1

    // If studied yesterday, increment streak
    if (yesterdaySession) {
      newStreak = (profile.studyStreak || 0) + 1
    } else {
      // Check if already studied today (maintain streak)
      const todaySession = await prisma.focusSession.findFirst({
        where: {
          userId,
          status: 'COMPLETED',
          startedAt: {
            gte: today,
          },
        },
      })

      if (todaySession && profile.lastStudyDate) {
        const lastStudy = new Date(profile.lastStudyDate)
        lastStudy.setHours(0, 0, 0, 0)

        if (lastStudy.getTime() === today.getTime()) {
          // Already updated today
          return
        }
      }
    }

    // Update streak in Profile
    await prisma.profile.update({
      where: { userId },
      data: {
        studyStreak: newStreak,
        lastStudyDate: new Date(),
      },
    })
  } catch (error) {
    console.error('Update streak error:', error)
  }
}
