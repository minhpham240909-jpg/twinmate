/**
 * Next Question API
 *
 * POST /api/arena/[id]/next
 *
 * Advances to the next question (or ends the game).
 * Called by host or automatically when time expires.
 * Broadcasts question_end, leaderboard_update, and either question_start or game_end.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { calculateXPReward, calculateCombinedScore, getCurrentWeekStart } from '@/lib/arena/scoring'
import {
  broadcastQuestionEnd,
  broadcastLeaderboardUpdate,
  broadcastQuestionStart,
  broadcastGameEnd,
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

    // Fetch arena with questions and participants
    const arena = await prisma.arenaSession.findUnique({
      where: { id: arenaId },
      include: {
        questions: {
          orderBy: { questionNumber: 'asc' },
        },
        participants: {
          orderBy: { totalScore: 'desc' },
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
        { success: false, error: 'Only the host can advance questions' },
        { status: 403 }
      )
    }

    // Check arena status
    if (arena.status !== 'IN_PROGRESS') {
      return NextResponse.json(
        { success: false, error: 'Game is not in progress' },
        { status: 400 }
      )
    }

    const currentQuestionNum = arena.currentQuestion
    const currentQuestion = arena.questions.find(q => q.questionNumber === currentQuestionNum)

    if (!currentQuestion) {
      return NextResponse.json(
        { success: false, error: 'Current question not found' },
        { status: 400 }
      )
    }

    // Get stats for the current question
    const questionAnswers = await prisma.arenaAnswer.findMany({
      where: { questionId: currentQuestion.id },
    })

    const correctCount = questionAnswers.filter(a => a.isCorrect).length
    const avgResponseTime = questionAnswers.length > 0
      ? Math.round(questionAnswers.reduce((sum, a) => sum + a.responseTimeMs, 0) / questionAnswers.length)
      : 0

    // Broadcast question end
    await broadcastQuestionEnd(
      arenaId,
      currentQuestionNum,
      currentQuestion.correctAnswer,
      currentQuestion.explanation || undefined,
      {
        correctCount,
        totalAnswered: questionAnswers.length,
        avgResponseTime,
      }
    )

    // Get previous rankings for change calculation
    const previousRankings = new Map(
      arena.participants.map((p, i) => [p.id, i + 1])
    )

    // Refetch participants with updated scores
    const updatedParticipants = await prisma.arenaParticipant.findMany({
      where: { arenaId },
      orderBy: { totalScore: 'desc' },
    })

    // Calculate rank changes
    const rankings = updatedParticipants.map((p, i) => {
      const prevRank = previousRankings.get(p.id) || (i + 1)
      const change = prevRank - (i + 1) // Positive = moved up
      return {
        rank: i + 1,
        participantId: p.id,
        userName: p.userName,
        avatarUrl: p.userAvatarUrl,
        score: p.totalScore,
        change,
        streak: p.currentStreak,
      }
    })

    // Broadcast leaderboard update
    await broadcastLeaderboardUpdate(arenaId, rankings, currentQuestionNum)

    // Check if this was the last question
    const isLastQuestion = currentQuestionNum >= arena.questions.length

    if (isLastQuestion) {
      // Game over - calculate final rankings and XP
      const totalPlayers = updatedParticipants.length
      const weekStart = getCurrentWeekStart()

      // Pre-calculate all XP rewards and rankings
      const rankingsData = updatedParticipants.map((p, i) => {
        const rank = i + 1
        const xpEarned = calculateXPReward(p.totalScore, rank, totalPlayers)
        return { participant: p, rank, xpEarned }
      })

      // Batch fetch all existing weekly stats in ONE query
      const existingStats = await prisma.arenaWeeklyStats.findMany({
        where: {
          userId: { in: updatedParticipants.map(p => p.userId) },
          weekStart,
        },
        select: { userId: true, totalXP: true, correctAnswers: true, bestStreak: true, gamesPlayed: true, gamesWon: true },
      })
      const statsMap = new Map(existingStats.map(s => [s.userId, s]))

      // Prepare all database operations
      const participantUpdates = rankingsData.map(({ participant, rank, xpEarned }) =>
        prisma.arenaParticipant.update({
          where: { id: participant.id },
          data: { finalRank: rank, xpEarned },
        })
      )

      const weeklyStatsUpserts = rankingsData.map(({ participant, rank, xpEarned }) => {
        const currentStats = statsMap.get(participant.userId)
        const newTotalXP = (currentStats?.totalXP || 0) + xpEarned
        const newCorrectAnswers = (currentStats?.correctAnswers || 0) + participant.correctAnswers
        const newBestStreak = Math.max(currentStats?.bestStreak || 0, participant.bestStreak)
        const newCombinedScore = calculateCombinedScore(newTotalXP, newCorrectAnswers, newBestStreak)

        return prisma.arenaWeeklyStats.upsert({
          where: { userId_weekStart: { userId: participant.userId, weekStart } },
          update: {
            totalXP: newTotalXP,
            correctAnswers: newCorrectAnswers,
            bestStreak: newBestStreak,
            gamesPlayed: { increment: 1 },
            gamesWon: rank === 1 ? { increment: 1 } : undefined,
            combinedScore: newCombinedScore,
          },
          create: {
            userId: participant.userId,
            weekStart,
            totalXP: xpEarned,
            correctAnswers: participant.correctAnswers,
            bestStreak: participant.bestStreak,
            gamesPlayed: 1,
            gamesWon: rank === 1 ? 1 : 0,
            combinedScore: calculateCombinedScore(xpEarned, participant.correctAnswers, participant.bestStreak),
          },
        })
      })

      // Execute ALL database operations in a single transaction (batch instead of N+1)
      await prisma.$transaction([...participantUpdates, ...weeklyStatsUpserts])

      // Build final rankings response
      const finalRankings = rankingsData.map(({ participant, rank, xpEarned }) => ({
        rank,
        participantId: participant.id,
        userName: participant.userName,
        avatarUrl: participant.userAvatarUrl,
        score: participant.totalScore,
        correctAnswers: participant.correctAnswers,
        bestStreak: participant.bestStreak,
        xpEarned,
      }))

      // Update arena to completed
      await prisma.arenaSession.update({
        where: { id: arenaId },
        data: {
          status: 'COMPLETED',
          endedAt: new Date(),
        },
      })

      // Calculate total stats
      const totalCorrect = updatedParticipants.reduce((sum, p) => sum + p.correctAnswers, 0)
      const totalPossible = arena.questions.length * updatedParticipants.length
      const avgAccuracy = totalPossible > 0 ? (totalCorrect / totalPossible) * 100 : 0
      const totalXPAwarded = finalRankings.reduce((sum, r) => sum + r.xpEarned, 0)

      // Broadcast game end
      await broadcastGameEnd(arenaId, finalRankings, {
        totalQuestions: arena.questions.length,
        avgAccuracy: Math.round(avgAccuracy),
        totalXPAwarded,
      })

      console.log(`[Arena Next] Game ${arenaId} completed - ${totalXPAwarded} XP awarded`)

      return NextResponse.json({
        success: true,
        gameOver: true,
        finalRankings,
        stats: {
          totalQuestions: arena.questions.length,
          avgAccuracy: Math.round(avgAccuracy),
          totalXPAwarded,
        },
      })
    } else {
      // Move to next question
      const nextQuestionNum = currentQuestionNum + 1
      const nextQuestion = arena.questions.find(q => q.questionNumber === nextQuestionNum)

      if (!nextQuestion) {
        return NextResponse.json(
          { success: false, error: 'Next question not found' },
          { status: 500 }
        )
      }

      // Update arena
      await prisma.arenaSession.update({
        where: { id: arenaId },
        data: {
          currentQuestion: nextQuestionNum,
        },
      })

      // Reset current streaks for players who didn't answer
      // (They should have answered by now if playing)

      // Short delay before broadcasting next question (let leaderboard sink in)
      await new Promise(resolve => setTimeout(resolve, 3000))

      // Broadcast next question
      await broadcastQuestionStart(
        arenaId,
        nextQuestionNum,
        nextQuestion.question,
        nextQuestion.options as string[],
        arena.timePerQuestion,
        nextQuestion.basePoints
      )

      console.log(`[Arena Next] Arena ${arenaId} advancing to Q${nextQuestionNum}/${arena.questions.length}`)

      return NextResponse.json({
        success: true,
        gameOver: false,
        questionNumber: nextQuestionNum,
        totalQuestions: arena.questions.length,
      })
    }
  } catch (error) {
    console.error('[Arena Next] Error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
    })

    return NextResponse.json(
      { success: false, error: 'Failed to advance question' },
      { status: 500 }
    )
  }
}
