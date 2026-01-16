import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import logger from '@/lib/logger'
import { invalidateUserCache } from '@/lib/redis'

// Minimum completion percentage required for rewards (80%)
const COMPLETION_THRESHOLD = 0.8

// Schema for updating a focus session
const updateFocusSessionSchema = z.object({
  status: z.enum(['COMPLETED', 'ABANDONED']).optional(),
  actualMinutes: z.number().min(0).optional(),
  label: z.string().optional(),
  notes: z.string().optional(),
  // AI task fields
  taskType: z.string().optional(),
  taskSubject: z.string().optional(),
  taskPrompt: z.string().optional(),
  taskDifficulty: z.string().optional(),
  userResponse: z.string().optional(),
  taskCompleted: z.boolean().optional(),
})

/**
 * GET /api/focus/[sessionId]
 * Get a specific focus session
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sessionId } = await params

    const session = await prisma.focusSession.findFirst({
      where: {
        id: sessionId,
        userId: user.id,
      },
    })

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      session,
    })
  } catch (error) {
    logger.error('Error fetching focus session', { error })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/focus/[sessionId]
 * Update a focus session (complete, abandon, add notes)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sessionId } = await params
    const body = await request.json()
    const validation = updateFocusSessionSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.issues },
        { status: 400 }
      )
    }

    // Find the session
    const existingSession = await prisma.focusSession.findFirst({
      where: {
        id: sessionId,
        userId: user.id,
      },
    })

    if (!existingSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const { status, actualMinutes, label, notes, taskType, taskSubject, taskPrompt, taskDifficulty, userResponse, taskCompleted } = validation.data

    // Build update data
    const updateData: Record<string, unknown> = {}

    if (status) {
      updateData.status = status
      updateData.completedAt = new Date()
    }

    if (actualMinutes !== undefined) {
      updateData.actualMinutes = actualMinutes
    }

    if (label !== undefined) {
      updateData.label = label
    }

    if (notes !== undefined) {
      updateData.notes = notes
    }

    // AI task fields
    if (taskType !== undefined) {
      updateData.taskType = taskType
    }

    if (taskSubject !== undefined) {
      updateData.taskSubject = taskSubject
    }

    if (taskPrompt !== undefined) {
      updateData.taskPrompt = taskPrompt
    }

    if (taskDifficulty !== undefined) {
      updateData.taskDifficulty = taskDifficulty
    }

    if (userResponse !== undefined) {
      updateData.userResponse = userResponse
    }

    if (taskCompleted !== undefined) {
      updateData.taskCompleted = taskCompleted
    }

    // Update the session
    const updatedSession = await prisma.focusSession.update({
      where: { id: sessionId },
      data: updateData,
    })

    // Calculate completion percentage for rewards
    const targetMinutes = existingSession.durationMinutes || 7
    const completedMinutes = actualMinutes || 0
    const completionRatio = completedMinutes / targetMinutes
    const isFullyCompleted = completionRatio >= COMPLETION_THRESHOLD

    let pointsEarned = 0
    let coinsEarned = 0
    let streakUpdated = false

    // Only award rewards if session was fully completed (>= 80%)
    if (status === 'COMPLETED' && isFullyCompleted) {
      // Points calculation: 10 XP per minute of focus (minimum 10 XP)
      pointsEarned = Math.max(10, completedMinutes * 10)

      // Coins: 5 per completed session
      coinsEarned = 5

      // Update profile with points and coins
      await prisma.profile.update({
        where: { userId: user.id },
        data: {
          totalPoints: { increment: pointsEarned },
          coins: { increment: coinsEarned },
        },
      })

      // Update Quick Focus streak (separate from Solo Study streak)
      await updateQuickFocusStreak(user.id)
      streakUpdated = true

      logger.info('Quick Focus session completed with rewards', {
        data: {
          sessionId,
          userId: user.id,
          durationMinutes: targetMinutes,
          actualMinutes: completedMinutes,
          completionPercentage: Math.round(completionRatio * 100),
          pointsEarned,
          coinsEarned,
        },
      })
    } else if (status === 'COMPLETED') {
      // Session ended but not enough time for rewards
      logger.info('Quick Focus session ended early - no rewards', {
        data: {
          sessionId,
          userId: user.id,
          durationMinutes: targetMinutes,
          actualMinutes: completedMinutes,
          completionPercentage: Math.round(completionRatio * 100),
        },
      })
    }

    // Invalidate user cache (stats changed)
    await invalidateUserCache(user.id)

    return NextResponse.json({
      success: true,
      session: updatedSession,
      pointsEarned,
      coinsEarned,
      streakUpdated,
      isFullyCompleted,
      completionPercentage: Math.round(completionRatio * 100),
      message: isFullyCompleted
        ? 'Great job completing your focus session!'
        : status === 'COMPLETED'
          ? `Session ended early (${Math.round(completionRatio * 100)}% completed). Complete at least 80% to earn rewards.`
          : undefined,
    })
  } catch (error) {
    logger.error('Error updating focus session', { error })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/focus/[sessionId]
 * Delete a focus session (only if abandoned or for cleanup)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sessionId } = await params

    // Find and delete the session
    const session = await prisma.focusSession.findFirst({
      where: {
        id: sessionId,
        userId: user.id,
      },
    })

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    await prisma.focusSession.delete({
      where: { id: sessionId },
    })

    return NextResponse.json({
      success: true,
      message: 'Session deleted',
    })
  } catch (error) {
    logger.error('Error deleting focus session', { error })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Update user's QUICK FOCUS streak (separate from Solo Study streak)
 * Stored in Profile.quickFocusStreak field
 * Supports streak shields to protect against missed days
 */
async function updateQuickFocusStreak(userId: string) {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    // Get current profile stats (including streak shields)
    const profile = await prisma.profile.findUnique({
      where: { userId },
      select: {
        quickFocusStreak: true,
        lastQuickFocusDate: true,
        streakShields: true,
      },
    })

    if (!profile) return

    // Check if already completed a quick focus session today
    if (profile.lastQuickFocusDate) {
      const lastFocus = new Date(profile.lastQuickFocusDate)
      lastFocus.setHours(0, 0, 0, 0)

      if (lastFocus.getTime() === today.getTime()) {
        // Already updated today, nothing to do
        return
      }
    }

    // Check if user completed a quick focus session yesterday
    // Only count COMPLETED sessions with mode != 'solo' (quick focus uses ai_guided or default)
    const yesterdaySession = await prisma.focusSession.findFirst({
      where: {
        userId,
        status: 'COMPLETED',
        mode: { not: 'solo' }, // Quick focus sessions (not solo study)
        startedAt: {
          gte: yesterday,
          lt: today,
        },
      },
    })

    let newStreak = 1
    let shieldsToUse = 0

    if (yesterdaySession) {
      // Focused yesterday - continue the streak
      newStreak = (profile.quickFocusStreak || 0) + 1
    } else if (profile.lastQuickFocusDate) {
      // Didn't focus yesterday - check if we can use a shield
      const lastFocus = new Date(profile.lastQuickFocusDate)
      lastFocus.setHours(0, 0, 0, 0)

      // Calculate days missed
      const daysMissed = Math.floor((today.getTime() - lastFocus.getTime()) / (1000 * 60 * 60 * 24)) - 1

      if (daysMissed > 0 && daysMissed <= (profile.streakShields || 0)) {
        // Use shields to protect streak
        shieldsToUse = daysMissed
        newStreak = (profile.quickFocusStreak || 0) + 1
        logger.info(`[Quick Focus Streak] Using ${shieldsToUse} shield(s) to protect streak`, { userId })
      } else if (daysMissed > 0) {
        // No shields or not enough - streak resets
        newStreak = 1
        logger.info(`[Quick Focus Streak] Streak reset`, { userId, daysMissed, shields: profile.streakShields || 0 })
      }
    }

    // Update quick focus streak and shields in Profile
    await prisma.profile.update({
      where: { userId },
      data: {
        quickFocusStreak: newStreak,
        lastQuickFocusDate: new Date(),
        ...(shieldsToUse > 0 && {
          streakShields: { decrement: shieldsToUse },
        }),
      },
    })

    if (shieldsToUse > 0) {
      logger.info(`[Quick Focus Streak] Streak protected!`, { userId, shieldsUsed: shieldsToUse, newStreak })
    }
  } catch (error) {
    logger.error('Update quick focus streak error', { error })
  }
}
