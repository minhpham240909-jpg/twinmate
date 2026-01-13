import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import logger from '@/lib/logger'

// Schema for creating a focus session
const createFocusSessionSchema = z.object({
  durationMinutes: z.number().min(1).max(120).default(7),
  label: z.string().optional(),
  mode: z.enum(['solo', 'ai_guided']).default('solo'),
})

/**
 * POST /api/focus
 * Create a new focus session (instant start)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const validation = createFocusSessionSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.issues },
        { status: 400 }
      )
    }

    const { durationMinutes, label, mode } = validation.data

    // Check for any existing active focus session
    const existingActive = await prisma.focusSession.findFirst({
      where: {
        userId: user.id,
        status: 'ACTIVE',
      },
    })

    if (existingActive) {
      // Return existing active session instead of creating new one
      return NextResponse.json({
        success: true,
        session: existingActive,
        message: 'Existing active session found',
      })
    }

    // Create new focus session
    const session = await prisma.focusSession.create({
      data: {
        userId: user.id,
        durationMinutes,
        label,
        mode,
        status: 'ACTIVE',
        startedAt: new Date(),
      },
    })

    logger.info('Focus session started', {
      data: {
        sessionId: session.id,
        userId: user.id,
        durationMinutes,
      },
    })

    return NextResponse.json({
      success: true,
      session,
    })
  } catch (error) {
    logger.error('Error creating focus session', { error })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/focus
 * Get user's focus session history and stats
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50)

    // Get active session if any
    const activeSession = await prisma.focusSession.findFirst({
      where: {
        userId: user.id,
        status: 'ACTIVE',
      },
    })

    // Get recent completed sessions
    const recentSessions = await prisma.focusSession.findMany({
      where: {
        userId: user.id,
        status: 'COMPLETED',
      },
      orderBy: { completedAt: 'desc' },
      take: limit,
    })

    // Calculate stats
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const todaySessions = await prisma.focusSession.findMany({
      where: {
        userId: user.id,
        status: 'COMPLETED',
        completedAt: { gte: today },
      },
    })

    const todayMinutes = todaySessions.reduce(
      (sum: number, s: { actualMinutes: number | null; durationMinutes: number }) =>
        sum + (s.actualMinutes || s.durationMinutes),
      0
    )

    const allTimeSessions = await prisma.focusSession.count({
      where: {
        userId: user.id,
        status: 'COMPLETED',
      },
    })

    return NextResponse.json({
      success: true,
      activeSession,
      recentSessions,
      stats: {
        todaySessions: todaySessions.length,
        todayMinutes,
        allTimeSessions,
      },
    })
  } catch (error) {
    logger.error('Error fetching focus sessions', { error })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
