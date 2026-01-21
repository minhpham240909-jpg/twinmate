/**
 * Submit Answer API
 *
 * POST /api/arena/[id]/answer
 *
 * Submits an answer for the current question.
 * Calculates points and updates participant score.
 * Broadcasts answer_submitted event.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { calculatePoints } from '@/lib/arena/scoring'
import { broadcastAnswerSubmitted } from '@/lib/arena/broadcast'

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

    // Parse request body
    const body = await request.json()
    const { questionId, selectedAnswer, responseTimeMs } = body

    // Validate input
    if (!questionId || typeof selectedAnswer !== 'number' || typeof responseTimeMs !== 'number') {
      return NextResponse.json(
        { success: false, error: 'Invalid request body' },
        { status: 400 }
      )
    }

    if (selectedAnswer < 0 || selectedAnswer > 3) {
      return NextResponse.json(
        { success: false, error: 'Invalid answer selection' },
        { status: 400 }
      )
    }

    // Fetch arena, participant, and question in parallel
    const [arena, participant, question] = await Promise.all([
      prisma.arenaSession.findUnique({
        where: { id: arenaId },
        select: {
          id: true,
          status: true,
          currentQuestion: true,
          timePerQuestion: true,
          _count: { select: { participants: true } },
        },
      }),
      prisma.arenaParticipant.findFirst({
        where: { arenaId, userId: user.id },
      }),
      prisma.arenaQuestion.findUnique({
        where: { id: questionId },
        select: {
          id: true,
          arenaId: true,
          questionNumber: true,
          correctAnswer: true,
          explanation: true,
          basePoints: true,
        },
      }),
    ])

    // Validate arena
    if (!arena) {
      return NextResponse.json(
        { success: false, error: 'Arena not found' },
        { status: 404 }
      )
    }

    if (arena.status !== 'IN_PROGRESS') {
      return NextResponse.json(
        { success: false, error: 'Game is not in progress' },
        { status: 400 }
      )
    }

    // Validate participant
    if (!participant) {
      return NextResponse.json(
        { success: false, error: 'You are not a participant' },
        { status: 403 }
      )
    }

    // Validate question
    if (!question || question.arenaId !== arenaId) {
      return NextResponse.json(
        { success: false, error: 'Question not found' },
        { status: 404 }
      )
    }

    // Check if answering the current question
    if (question.questionNumber !== arena.currentQuestion) {
      return NextResponse.json(
        { success: false, error: 'This question is no longer active' },
        { status: 400 }
      )
    }

    // Check if already answered
    const existingAnswer = await prisma.arenaAnswer.findUnique({
      where: {
        questionId_participantId: {
          questionId,
          participantId: participant.id,
        },
      },
    })

    if (existingAnswer) {
      return NextResponse.json(
        { success: false, error: 'Already answered this question' },
        { status: 400 }
      )
    }

    // Calculate if correct
    const isCorrect = selectedAnswer === question.correctAnswer

    // Calculate points
    const points = calculatePoints(
      isCorrect,
      responseTimeMs,
      participant.currentStreak,
      arena.timePerQuestion
    )

    // Update participant streak
    const newStreak = isCorrect ? participant.currentStreak + 1 : 0
    const newBestStreak = Math.max(participant.bestStreak, newStreak)

    // Create answer and update participant in transaction
    const [answer] = await prisma.$transaction([
      prisma.arenaAnswer.create({
        data: {
          questionId,
          participantId: participant.id,
          selectedAnswer,
          isCorrect,
          responseTimeMs,
          basePoints: points.base,
          timeBonus: points.timeBonus,
          streakBonus: points.streakBonus,
          totalPoints: points.total,
        },
      }),
      prisma.arenaParticipant.update({
        where: { id: participant.id },
        data: {
          totalScore: { increment: points.total },
          correctAnswers: { increment: isCorrect ? 1 : 0 },
          currentStreak: newStreak,
          bestStreak: newBestStreak,
        },
      }),
    ])

    // Get answer count for this question
    const answerCount = await prisma.arenaAnswer.count({
      where: { questionId },
    })

    // Broadcast answer submitted
    await broadcastAnswerSubmitted(
      arenaId,
      participant.id,
      answerCount,
      arena._count.participants
    )

    // Get current rank
    const participants = await prisma.arenaParticipant.findMany({
      where: { arenaId },
      orderBy: { totalScore: 'desc' },
      select: { id: true },
    })
    const currentRank = participants.findIndex(p => p.id === participant.id) + 1

    const newTotalScore = participant.totalScore + points.total

    console.log(`[Arena Answer] User ${user.id} answered Q${question.questionNumber} - ${isCorrect ? 'correct' : 'wrong'} - ${points.total} pts`)

    return NextResponse.json({
      success: true,
      isCorrect,
      totalPoints: points.total,
      breakdown: {
        base: points.base,
        timeBonus: points.timeBonus,
        streakBonus: points.streakBonus,
      },
      newStreak,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      newTotalScore,
      currentRank,
    })
  } catch (error) {
    console.error('[Arena Answer] Error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
    })

    return NextResponse.json(
      { success: false, error: 'Failed to submit answer' },
      { status: 500 }
    )
  }
}
