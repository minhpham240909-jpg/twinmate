/**
 * Start Arena API
 *
 * POST /api/arena/[id]/start
 *
 * Starts the arena game. Only the host can start.
 * Broadcasts game_starting and first question_start events.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import {
  broadcastGameStarting,
  broadcastQuestionStart,
} from '@/lib/arena/broadcast'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now()

  try {
    const { id: arenaId } = await params

    // Auth check
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Fetch arena
    const arena = await prisma.arenaSession.findUnique({
      where: { id: arenaId },
      include: {
        questions: {
          orderBy: { questionNumber: 'asc' },
        },
        _count: {
          select: { participants: true },
        },
      },
    })

    if (!arena) {
      return NextResponse.json(
        { success: false, error: 'Arena not found' },
        { status: 404 }
      )
    }

    // Check if user is host
    if (arena.hostId !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Only the host can start the game' },
        { status: 403 }
      )
    }

    // Check arena status
    if (arena.status !== 'LOBBY') {
      return NextResponse.json(
        { success: false, error: 'Game has already started or ended' },
        { status: 400 }
      )
    }

    // Check minimum players (at least 1 besides host, or just host for testing)
    if (arena._count.participants < 1) {
      return NextResponse.json(
        { success: false, error: 'Need at least 1 player to start' },
        { status: 400 }
      )
    }

    // Check questions exist
    if (arena.questions.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No questions available' },
        { status: 400 }
      )
    }

    // Update arena status to STARTING
    await prisma.arenaSession.update({
      where: { id: arenaId },
      data: {
        status: 'STARTING',
        startedAt: new Date(),
      },
    })

    // Broadcast game starting (5 second countdown)
    const countdownSeconds = 5
    await broadcastGameStarting(arenaId, countdownSeconds, arena.questions.length)

    // Schedule first question broadcast after countdown
    // In production, use a job queue (e.g., BullMQ) for reliability
    // For now, we'll use a simple setTimeout on the server
    setTimeout(async () => {
      try {
        // Update to IN_PROGRESS and set current question
        await prisma.arenaSession.update({
          where: { id: arenaId },
          data: {
            status: 'IN_PROGRESS',
            currentQuestion: 1,
          },
        })

        const firstQuestion = arena.questions[0]
        if (firstQuestion) {
          await broadcastQuestionStart(
            arenaId,
            1,
            firstQuestion.question,
            firstQuestion.options as string[],
            arena.timePerQuestion,
            firstQuestion.basePoints
          )
        }
      } catch (error) {
        console.error('[Arena Start] Failed to broadcast first question:', error)
      }
    }, countdownSeconds * 1000)

    console.log(`[Arena Start] Arena ${arenaId} starting with ${arena._count.participants} players, ${arena.questions.length} questions`)

    return NextResponse.json({
      success: true,
      message: 'Game starting',
      countdownSeconds,
      questionCount: arena.questions.length,
      playerCount: arena._count.participants,
    })
  } catch (error) {
    console.error('[Arena Start] Error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
    })

    return NextResponse.json(
      { success: false, error: 'Failed to start arena' },
      { status: 500 }
    )
  }
}
