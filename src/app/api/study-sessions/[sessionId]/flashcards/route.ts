// API Routes: Session Flashcards (GET list, POST create)
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { getInitialSpacedRepetitionData } from '@/lib/spaced-repetition'

const createFlashcardSchema = z.object({
  front: z.string().min(1, 'Front side is required').max(5000),
  back: z.string().min(1, 'Back side is required').max(5000),
  difficulty: z.number().int().min(0).max(2).default(0), // 0=easy, 1=medium, 2=hard
})

// GET /api/study-sessions/[sessionId]/flashcards
// Get all flashcards for the current user in this session
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

    // Get URL search params for filtering
    const searchParams = request.nextUrl.searchParams
    const dueOnly = searchParams.get('due') === 'true'

    // Build where clause
    const where: any = {
      sessionId,
      userId: user.id,
    }

    // If dueOnly, filter for cards that are due for review
    if (dueOnly) {
      const now = new Date()
      now.setHours(0, 0, 0, 0)

      where.OR = [
        { nextReviewDate: null }, // Never reviewed
        { nextReviewDate: { lte: now } }, // Due date has passed
      ]
    }

    // Get flashcards for this user in this session
    const flashcards = await prisma.sessionFlashcard.findMany({
      where,
      orderBy: [
        { nextReviewDate: 'asc' },
        { createdAt: 'desc' },
      ],
    })

    return NextResponse.json({
      flashcards,
      count: flashcards.length,
    })
  } catch (error) {
    console.error('[Flashcards GET] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch flashcards',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// POST /api/study-sessions/[sessionId]/flashcards
// Create a new flashcard for the current user
export async function POST(
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

    // Validate request body
    const body = await request.json()
    const validation = createFlashcardSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.format() },
        { status: 400 }
      )
    }

    const { front, back, difficulty } = validation.data

    // Get initial spaced repetition data
    const spacedRepData = getInitialSpacedRepetitionData()

    // Create flashcard
    const flashcard = await prisma.sessionFlashcard.create({
      data: {
        sessionId,
        userId: user.id,
        front,
        back,
        difficulty,
        easeFactor: spacedRepData.easeFactor,
        intervalDays: spacedRepData.intervalDays,
        repetitions: spacedRepData.repetitions,
        nextReviewDate: spacedRepData.nextReviewDate,
      },
    })

    console.log(`[Flashcards POST] Created flashcard ${flashcard.id} for user ${user.id} in session ${sessionId}`)

    return NextResponse.json({
      success: true,
      flashcard,
    }, { status: 201 })
  } catch (error) {
    console.error('[Flashcards POST] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to create flashcard',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
