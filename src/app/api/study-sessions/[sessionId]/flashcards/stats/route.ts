// API Route: Flashcard Statistics
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

// GET /api/study-sessions/[sessionId]/flashcards/stats
// Get statistics about the user's flashcards in this session
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await context.params

    // Verify authentication
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify user is a participant in the session
    const participant = await prisma.sessionParticipant.findFirst({
      where: {
        sessionId,
        userId: user.id,
      },
    })

    if (!participant) {
      return NextResponse.json(
        { error: 'Not a participant in this session' },
        { status: 403 }
      )
    }

    // Get all flashcards for this user in this session
    // SCALABILITY: Limit to prevent unbounded queries
    const flashcards = await prisma.sessionFlashcard.findMany({
      where: {
        sessionId,
        userId: user.id,
      },
      take: 1000,
    })

    const now = new Date()
    now.setHours(0, 0, 0, 0)

    // Calculate statistics
    const totalCards = flashcards.length
    const dueCards = flashcards.filter(card =>
      !card.nextReviewDate || card.nextReviewDate <= now
    ).length
    const newCards = flashcards.filter(card => card.reviewCount === 0).length
    const reviewedCards = flashcards.filter(card => card.reviewCount > 0).length

    const totalReviews = flashcards.reduce((sum, card) => sum + card.reviewCount, 0)
    const totalCorrect = flashcards.reduce((sum, card) => sum + card.correctCount, 0)
    const totalIncorrect = flashcards.reduce((sum, card) => sum + card.incorrectCount, 0)

    const accuracyRate = totalReviews > 0
      ? Math.round((totalCorrect / totalReviews) * 100)
      : 0

    // Count by difficulty
    const easyCards = flashcards.filter(card => card.difficulty === 0).length
    const mediumCards = flashcards.filter(card => card.difficulty === 1).length
    const hardCards = flashcards.filter(card => card.difficulty === 2).length

    // Find next review date
    const cardsWithFutureReviews = flashcards
      .filter(card => card.nextReviewDate && card.nextReviewDate > now)
      .sort((a, b) => a.nextReviewDate!.getTime() - b.nextReviewDate!.getTime())

    const nextReviewDate = cardsWithFutureReviews.length > 0
      ? cardsWithFutureReviews[0].nextReviewDate
      : null

    // Calculate retention (cards with repetitions >= 3 are considered "learned")
    const learnedCards = flashcards.filter(card => card.repetitions >= 3).length
    const retentionRate = reviewedCards > 0
      ? Math.round((learnedCards / reviewedCards) * 100)
      : 0

    return NextResponse.json({
      stats: {
        total: totalCards,
        due: dueCards,
        new: newCards,
        reviewed: reviewedCards,
        learned: learnedCards,
        totalReviews,
        totalCorrect,
        totalIncorrect,
        accuracyRate,
        retentionRate,
        byDifficulty: {
          easy: easyCards,
          medium: mediumCards,
          hard: hardCards,
        },
        nextReviewDate,
      },
    })
  } catch (error) {
    console.error('[Flashcards Stats] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch flashcard statistics',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
