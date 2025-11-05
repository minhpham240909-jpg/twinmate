// API Route: Review Flashcard and Update Spaced Repetition
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { calculateNextReview, simplifiedQualityToSM2 } from '@/lib/spaced-repetition'

const reviewFlashcardSchema = z.object({
  quality: z.enum(['easy', 'medium', 'hard', 'again']),
  // Alternative: accept numeric quality (0-5) directly
  numericQuality: z.number().int().min(0).max(5).optional(),
})

// POST /api/study-sessions/[sessionId]/flashcards/[cardId]/review
// Record a review and update spaced repetition data
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string; cardId: string }> }
) {
  try {
    const { sessionId, cardId } = await context.params

    // Verify authentication
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify the flashcard exists and belongs to the user
    const existingCard = await prisma.sessionFlashcard.findUnique({
      where: { id: cardId },
    })

    if (!existingCard) {
      return NextResponse.json(
        { error: 'Flashcard not found' },
        { status: 404 }
      )
    }

    if (existingCard.userId !== user.id) {
      return NextResponse.json(
        { error: 'You can only review your own flashcards' },
        { status: 403 }
      )
    }

    if (existingCard.sessionId !== sessionId) {
      return NextResponse.json(
        { error: 'Flashcard does not belong to this session' },
        { status: 400 }
      )
    }

    // Validate request body
    const body = await request.json()
    const validation = reviewFlashcardSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.format() },
        { status: 400 }
      )
    }

    const { quality, numericQuality } = validation.data

    // Convert quality to SM-2 scale (0-5)
    const sm2Quality = numericQuality !== undefined
      ? numericQuality
      : simplifiedQualityToSM2(quality)

    // Calculate next review using SM-2 algorithm
    const currentData = {
      easeFactor: existingCard.easeFactor,
      intervalDays: existingCard.intervalDays,
      repetitions: existingCard.repetitions,
      nextReviewDate: existingCard.nextReviewDate || new Date(),
    }

    const nextReviewData = calculateNextReview(currentData, sm2Quality)

    // Determine if this was a correct or incorrect response
    const isCorrect = sm2Quality >= 3

    // Update flashcard with new spaced repetition data
    const updatedCard = await prisma.sessionFlashcard.update({
      where: { id: cardId },
      data: {
        // Spaced repetition fields
        easeFactor: nextReviewData.easeFactor,
        intervalDays: nextReviewData.intervalDays,
        repetitions: nextReviewData.repetitions,
        nextReviewDate: nextReviewData.nextReviewDate,
        // Review tracking
        lastReviewed: new Date(),
        reviewCount: { increment: 1 },
        correctCount: isCorrect ? { increment: 1 } : undefined,
        incorrectCount: !isCorrect ? { increment: 1 } : undefined,
      },
    })

    console.log(
      `[Flashcard Review] User ${user.id} reviewed card ${cardId} with quality ${sm2Quality}. ` +
      `Next review: ${nextReviewData.nextReviewDate.toISOString()}, Interval: ${nextReviewData.intervalDays} days`
    )

    return NextResponse.json({
      success: true,
      flashcard: updatedCard,
      review: {
        quality: sm2Quality,
        qualityLabel: quality,
        wasCorrect: isCorrect,
        nextReviewDate: nextReviewData.nextReviewDate,
        intervalDays: nextReviewData.intervalDays,
        repetitions: nextReviewData.repetitions,
      },
    })
  } catch (error) {
    console.error('[Flashcard Review] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to record review',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
