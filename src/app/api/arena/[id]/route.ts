/**
 * Arena State API
 *
 * GET /api/arena/[id]
 *
 * Returns the current state of an arena.
 * Only participants can view arena state.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

interface ArenaQuestion {
  id: string
  questionNumber: number
  question: string
  options: unknown
  correctAnswer: number
  explanation: string | null
  basePoints: number
}

interface ArenaParticipant {
  id: string
  userId: string
  userName: string
  userAvatarUrl: string | null
  totalScore: number
  correctAnswers: number
  currentStreak: number
  bestStreak: number
  isConnected: boolean
  finalRank: number | null
  xpEarned: number
}

export async function GET(
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

    // Fetch arena with participants and questions
    const arena = await prisma.arenaSession.findUnique({
      where: { id: arenaId },
      include: {
        participants: {
          orderBy: { totalScore: 'desc' },
          select: {
            id: true,
            userId: true,
            userName: true,
            userAvatarUrl: true,
            totalScore: true,
            correctAnswers: true,
            currentStreak: true,
            bestStreak: true,
            isConnected: true,
            finalRank: true,
            xpEarned: true,
          },
        },
        questions: {
          orderBy: { questionNumber: 'asc' },
          select: {
            id: true,
            questionNumber: true,
            question: true,
            options: true,
            correctAnswer: true,
            explanation: true,
            basePoints: true,
          },
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

    // Check if user is a participant
    const participant = arena.participants.find((p: ArenaParticipant) => p.userId === user.id)
    if (!participant) {
      return NextResponse.json(
        { success: false, error: 'You are not a participant in this arena' },
        { status: 403 }
      )
    }

    const isHost = arena.hostId === user.id

    // Prepare questions based on game state
    // Only reveal correct answer for completed questions or if game is over
    const questions = arena.questions.map((q: ArenaQuestion) => {
      const shouldRevealAnswer = arena.status === 'COMPLETED' || q.questionNumber < arena.currentQuestion

      return {
        id: q.id,
        questionNumber: q.questionNumber,
        question: q.question,
        options: q.options,
        basePoints: q.basePoints,
        // Only reveal answer for completed questions or if game is over
        // Host always sees answers
        correctAnswer: isHost || shouldRevealAnswer ? q.correctAnswer : undefined,
        explanation: isHost || shouldRevealAnswer ? q.explanation : undefined,
      }
    })

    return NextResponse.json({
      success: true,
      arena: {
        id: arena.id,
        title: arena.title,
        inviteCode: arena.inviteCode,
        contentSource: arena.contentSource,
        questionCount: arena.questionCount,
        timePerQuestion: arena.timePerQuestion,
        maxPlayers: arena.maxPlayers,
        status: arena.status,
        currentQuestion: arena.currentQuestion,
        hostId: arena.hostId,
        startedAt: arena.startedAt,
        endedAt: arena.endedAt,
        createdAt: arena.createdAt,
      },
      participants: arena.participants,
      participantCount: arena._count.participants,
      questions,
      currentParticipant: participant,
      isHost,
      _meta: {
        responseTimeMs: Date.now() - startTime,
      },
    })
  } catch (error) {
    console.error('[Arena Get] Error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
    })

    return NextResponse.json(
      { success: false, error: 'Failed to get arena' },
      { status: 500 }
    )
  }
}
