/**
 * Last Session API
 *
 * Returns the user's most recent study session for "Continue where you left off"
 * Also returns active session if one exists
 *
 * OPTIMIZED: All queries run in parallel instead of waterfall
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Verify auth
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Calculate yesterday's date for last session query
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    yesterday.setHours(0, 0, 0, 0)

    // Run all queries in parallel for maximum performance
    const [activeSession, lastSession] = await Promise.all([
      // Check for active focus session
      prisma.focusSession.findFirst({
        where: {
          userId: user.id,
          status: 'ACTIVE',
          completedAt: null,
        },
        select: {
          id: true,
          durationMinutes: true,
          startedAt: true,
          label: true,
          mode: true,
          taskSubject: true,
          pausedAt: true,
          pausedTimeRemaining: true,
        },
        orderBy: {
          startedAt: 'desc',
        },
      }),

      // Get last completed session from today or yesterday
      prisma.focusSession.findFirst({
        where: {
          userId: user.id,
          status: 'COMPLETED',
          completedAt: {
            gte: yesterday,
          },
        },
        select: {
          id: true,
          durationMinutes: true,
          completedAt: true,
          label: true,
          mode: true,
          taskSubject: true,
        },
        orderBy: {
          completedAt: 'desc',
        },
      }),
    ])

    // Process active session if exists
    if (activeSession) {
      // MIGRATION: Quick mode sessions are now stateless (Quick Session = instant AI Q&A)
      // Auto-complete any old quick mode sessions since they're obsolete
      if (activeSession.mode === 'quick') {
        await prisma.focusSession.update({
          where: { id: activeSession.id },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            actualMinutes: Math.min(
              activeSession.durationMinutes,
              Math.floor((Date.now() - new Date(activeSession.startedAt).getTime()) / 60000)
            ),
            pausedAt: null,
            pausedTimeRemaining: null,
          },
        })

        // Return no active session - Quick Session is now stateless
        return NextResponse.json({
          success: true,
          hasActiveSession: false,
          activeSession: null,
          lastSession: null,
        })
      }

      let timeRemaining: number

      // If session is paused, use the stored paused time
      if (activeSession.pausedAt && activeSession.pausedTimeRemaining !== null) {
        timeRemaining = activeSession.pausedTimeRemaining
      } else {
        // Session is running, calculate based on elapsed time
        const now = new Date()
        const startedAt = new Date(activeSession.startedAt)
        const elapsedSeconds = Math.floor((now.getTime() - startedAt.getTime()) / 1000)
        const totalSeconds = activeSession.durationMinutes * 60
        timeRemaining = Math.max(0, totalSeconds - elapsedSeconds)
      }

      // If time has fully elapsed, auto-complete the session
      if (timeRemaining <= 0) {
        // Mark session as completed in database
        await prisma.focusSession.update({
          where: { id: activeSession.id },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            actualMinutes: activeSession.durationMinutes,
            pausedAt: null,
            pausedTimeRemaining: null,
          },
        })

        // Determine session type based on label
        const wasFromSoloStudy = activeSession.label?.startsWith('Solo Study') ?? false

        // Return no active session
        return NextResponse.json({
          success: true,
          hasActiveSession: false,
          activeSession: null,
          lastSession: {
            id: activeSession.id,
            subject: activeSession.label || activeSession.taskSubject,
            durationMinutes: activeSession.durationMinutes,
            completedAt: new Date().toISOString(),
            type: wasFromSoloStudy ? 'solo_study' : 'quick_focus',
          },
        })
      }

      // Determine session type based on label - Solo Study sessions have "Solo Study" prefix
      // Both Quick Focus and Solo Study use mode='solo', so we check the label instead
      const isSoloStudy = activeSession.label?.startsWith('Solo Study') ?? false

      return NextResponse.json({
        success: true,
        hasActiveSession: true,
        activeSession: {
          id: activeSession.id,
          subject: activeSession.label || activeSession.taskSubject,
          timeRemaining,
          isPaused: !!activeSession.pausedAt,
          type: isSoloStudy ? 'solo_study' : 'quick_focus',
        },
        lastSession: null,
      })
    }

    // Return last session if exists
    if (lastSession) {
      // Determine session type based on label - Solo Study sessions have "Solo Study" prefix
      const wasFromSoloStudy = lastSession.label?.startsWith('Solo Study') ?? false

      return NextResponse.json({
        success: true,
        hasActiveSession: false,
        activeSession: null,
        lastSession: {
          id: lastSession.id,
          subject: lastSession.label || lastSession.taskSubject,
          durationMinutes: lastSession.durationMinutes,
          completedAt: lastSession.completedAt?.toISOString(),
          type: wasFromSoloStudy ? 'solo_study' : 'quick_focus',
        },
      })
    }

    // No sessions found
    return NextResponse.json({
      success: true,
      hasActiveSession: false,
      activeSession: null,
      lastSession: null,
    })
  } catch (error) {
    console.error('[Last Session API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch session data' },
      { status: 500 }
    )
  }
}
