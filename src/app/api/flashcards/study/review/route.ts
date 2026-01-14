import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

/**
 * SM-2 Spaced Repetition Algorithm
 * Based on SuperMemo 2 algorithm
 *
 * @param quality - Rating from 0-5 (0-2 = fail, 3-5 = pass)
 * @param repetitions - Current number of successful repetitions
 * @param easeFactor - Current ease factor (default 2.5)
 * @param intervalDays - Current interval in days
 */
function sm2Algorithm(
  quality: number,
  repetitions: number,
  easeFactor: number,
  intervalDays: number
): { newInterval: number; newEaseFactor: number; newRepetitions: number } {
  // Clamp quality to 0-5
  const q = Math.max(0, Math.min(5, quality))

  let newEaseFactor = easeFactor
  let newInterval = intervalDays
  let newRepetitions = repetitions

  if (q >= 3) {
    // Correct response
    if (repetitions === 0) {
      newInterval = 1
    } else if (repetitions === 1) {
      newInterval = 6
    } else {
      newInterval = Math.round(intervalDays * easeFactor)
    }
    newRepetitions = repetitions + 1
  } else {
    // Incorrect response - reset
    newRepetitions = 0
    newInterval = 1
  }

  // Update ease factor
  // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  newEaseFactor = easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))

  // EF should never be less than 1.3
  if (newEaseFactor < 1.3) {
    newEaseFactor = 1.3
  }

  return {
    newInterval,
    newEaseFactor,
    newRepetitions,
  }
}

/**
 * Calculate next review date
 */
function calculateNextReview(intervalDays: number): Date {
  const next = new Date()
  next.setDate(next.getDate() + intervalDays)
  next.setHours(0, 0, 0, 0) // Start of day
  return next
}

/**
 * Calculate card status based on confidence/repetitions
 */
function calculateStatus(repetitions: number, correctRate: number): string {
  if (repetitions === 0) return 'new'
  if (repetitions < 3) return 'learning'
  if (correctRate >= 0.8 && repetitions >= 5) return 'mastered'
  return 'reviewing'
}

/**
 * Calculate XP earned based on response quality
 */
function calculateXP(quality: number, isNew: boolean): number {
  if (quality < 3) return 1 // Wrong answer, minimal XP
  if (isNew) return 5 // First time seeing card
  if (quality >= 5) return 3 // Perfect recall
  return 2 // Good recall
}

/**
 * POST /api/flashcards/study/review - Submit a card review
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      sessionId,
      cardId,
      quality,        // 0-5 (SM-2 scale) or 'again', 'hard', 'good', 'easy'
      responseTimeMs, // How long it took to answer
      userAnswer,     // For quiz mode
      usedHint = false,
    } = body

    if (!cardId) {
      return NextResponse.json({ error: 'Card ID required' }, { status: 400 })
    }

    // Convert string quality to number if needed
    let qualityScore: number
    if (typeof quality === 'string') {
      const qualityMap: Record<string, number> = {
        'again': 1,
        'hard': 3,
        'good': 4,
        'easy': 5,
      }
      qualityScore = qualityMap[quality.toLowerCase()] ?? 3
    } else {
      qualityScore = quality ?? 3
    }

    // Get card and verify access
    const card = await prisma.flashcardCard.findUnique({
      where: { id: cardId },
      include: {
        deck: {
          select: { userId: true, visibility: true },
        },
      },
    })

    if (!card) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 })
    }

    if (card.deck.userId !== user.id && card.deck.visibility === 'PRIVATE') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get or create card progress
    let progress = await prisma.flashcardCardProgress.findUnique({
      where: {
        userId_cardId: {
          userId: user.id,
          cardId,
        },
      },
    })

    const isNew = !progress

    // Calculate new SM-2 values
    const currentEF = progress?.easeFactor ?? 2.5
    const currentInterval = progress?.intervalDays ?? 1
    const currentReps = progress?.repetitions ?? 0

    const { newInterval, newEaseFactor, newRepetitions } = sm2Algorithm(
      qualityScore,
      currentReps,
      currentEF,
      currentInterval
    )

    const nextReviewDate = calculateNextReview(newInterval)

    // Calculate new stats
    const totalReviews = (progress?.totalReviews ?? 0) + 1
    const correctCount = (progress?.correctCount ?? 0) + (qualityScore >= 3 ? 1 : 0)
    const incorrectCount = (progress?.incorrectCount ?? 0) + (qualityScore < 3 ? 1 : 0)
    const correctRate = correctCount / totalReviews

    const newStatus = calculateStatus(newRepetitions, correctRate)
    const confidence = Math.min(100, Math.round(correctRate * 100))

    // Calculate response time stats
    let avgResponseTime = progress?.averageResponseTime
    let fastestTime = progress?.fastestResponseTime
    let slowestTime = progress?.slowestResponseTime

    if (responseTimeMs) {
      if (!avgResponseTime) {
        avgResponseTime = responseTimeMs
      } else {
        avgResponseTime = Math.round((avgResponseTime * (totalReviews - 1) + responseTimeMs) / totalReviews)
      }
      if (!fastestTime || responseTimeMs < fastestTime) fastestTime = responseTimeMs
      if (!slowestTime || responseTimeMs > slowestTime) slowestTime = responseTimeMs
    }

    // Update or create progress
    if (progress) {
      progress = await prisma.flashcardCardProgress.update({
        where: { id: progress.id },
        data: {
          easeFactor: newEaseFactor,
          intervalDays: newInterval,
          repetitions: newRepetitions,
          nextReviewDate,
          totalReviews,
          correctCount,
          incorrectCount,
          status: newStatus,
          confidence,
          averageResponseTime: avgResponseTime,
          fastestResponseTime: fastestTime,
          slowestResponseTime: slowestTime,
          lastReviewedAt: new Date(),
        },
      })
    } else {
      progress = await prisma.flashcardCardProgress.create({
        data: {
          userId: user.id,
          cardId,
          easeFactor: newEaseFactor,
          intervalDays: newInterval,
          repetitions: newRepetitions,
          nextReviewDate,
          totalReviews,
          correctCount,
          incorrectCount,
          status: newStatus,
          confidence,
          averageResponseTime: avgResponseTime,
          fastestResponseTime: fastestTime,
          slowestResponseTime: slowestTime,
          lastReviewedAt: new Date(),
        },
      })
    }

    // Update session if provided
    if (sessionId) {
      await prisma.flashcardStudySession.update({
        where: { id: sessionId },
        data: {
          cardsStudied: { increment: 1 },
          cardsCorrect: qualityScore >= 3 ? { increment: 1 } : undefined,
          cardsIncorrect: qualityScore < 3 ? { increment: 1 } : undefined,
        },
      })

      // Create quiz attempt record
      await prisma.flashcardQuizAttempt.create({
        data: {
          sessionId,
          cardId,
          questionType: card.questionType,
          userAnswer,
          correctAnswer: card.back,
          isCorrect: qualityScore >= 3,
          responseTimeMs,
          usedHint,
        },
      })
    }

    // Award XP
    const xpEarned = calculateXP(qualityScore, isNew)
    await prisma.profile.update({
      where: { userId: user.id },
      data: { totalPoints: { increment: xpEarned } },
    })

    // Update deck progress
    await updateDeckProgress(user.id, card.deckId)

    return NextResponse.json({
      success: true,
      progress,
      xpEarned,
      nextReviewDate,
      isCorrect: qualityScore >= 3,
    })
  } catch (error) {
    console.error('Review flashcard error:', error)
    return NextResponse.json(
      { error: 'Failed to submit review' },
      { status: 500 }
    )
  }
}

/**
 * Update deck-level progress stats
 */
async function updateDeckProgress(userId: string, deckId: string) {
  try {
    // Get all card progress for this user and deck
    const allProgress = await prisma.flashcardCardProgress.findMany({
      where: {
        userId,
        card: { deckId },
      },
    })

    const deck = await prisma.flashcardDeck.findUnique({
      where: { id: deckId },
      select: { cardCount: true },
    })

    if (!deck) return

    const cardsStudied = allProgress.length
    const cardsMastered = allProgress.filter((p) => p.status === 'mastered').length
    const cardsLearning = allProgress.filter((p) => ['learning', 'reviewing'].includes(p.status)).length
    const cardsNotStarted = deck.cardCount - cardsStudied

    const totalCorrect = allProgress.reduce((sum, p) => sum + p.correctCount, 0)
    const totalReviews = allProgress.reduce((sum, p) => sum + p.totalReviews, 0)
    const averageAccuracy = totalReviews > 0 ? (totalCorrect / totalReviews) * 100 : null

    const masteryPercent = deck.cardCount > 0
      ? (cardsMastered / deck.cardCount) * 100
      : 0

    // Upsert deck progress
    await prisma.flashcardDeckProgress.upsert({
      where: {
        userId_deckId: { userId, deckId },
      },
      update: {
        cardsStudied,
        cardsMastered,
        cardsLearning,
        cardsNotStarted,
        masteryPercent,
        averageAccuracy,
        totalSessions: { increment: 0 }, // Will be updated when session ends
        lastStudiedAt: new Date(),
      },
      create: {
        userId,
        deckId,
        cardsStudied,
        cardsMastered,
        cardsLearning,
        cardsNotStarted,
        masteryPercent,
        averageAccuracy,
        lastStudiedAt: new Date(),
      },
    })

    // Update deck last studied
    await prisma.flashcardDeck.update({
      where: { id: deckId },
      data: {
        lastStudiedAt: new Date(),
        studyCount: { increment: 1 },
      },
    })
  } catch (error) {
    console.error('Update deck progress error:', error)
  }
}
