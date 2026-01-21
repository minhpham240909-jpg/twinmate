/**
 * My Arena Sessions API
 *
 * GET /api/arena/my-sessions
 *
 * Returns all active arena sessions the user is participating in.
 * Used to show "Active Games" section on the Arcade page.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Auth check
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Find all active sessions where user is a participant
    const participations = await prisma.arenaParticipant.findMany({
      where: {
        userId: user.id,
        arena: {
          status: {
            in: ['LOBBY', 'STARTING', 'IN_PROGRESS'],
          },
        },
      },
      include: {
        arena: {
          select: {
            id: true,
            title: true,
            status: true,
            inviteCode: true,
            currentQuestion: true,
            questionCount: true,
            createdAt: true,
            _count: {
              select: { participants: true },
            },
          },
        },
      },
      orderBy: {
        arena: {
          createdAt: 'desc',
        },
      },
    })

    // Transform to response format
    const sessions = participations.map((p) => ({
      id: p.arena.id,
      title: p.arena.title,
      status: p.arena.status,
      inviteCode: p.arena.inviteCode,
      currentQuestion: p.arena.currentQuestion,
      questionCount: p.arena.questionCount,
      participantCount: p.arena._count.participants,
      myScore: p.totalScore,
      myStreak: p.currentStreak,
      createdAt: p.arena.createdAt.toISOString(),
    }))

    return NextResponse.json({
      success: true,
      sessions,
    })
  } catch (error) {
    console.error('[My Sessions] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch sessions' }, { status: 500 })
  }
}
