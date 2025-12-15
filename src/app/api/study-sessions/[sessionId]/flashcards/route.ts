// API Routes: Session Flashcards (GET list, POST create)
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { getInitialSpacedRepetitionData } from '@/lib/spaced-repetition'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { CONTENT_LIMITS } from '@/lib/constants'

const createFlashcardSchema = z.object({
  front: z.string().min(1, 'Front side is required').max(CONTENT_LIMITS.FLASHCARD_FRONT_MAX),
  back: z.string().min(1, 'Back side is required').max(CONTENT_LIMITS.FLASHCARD_BACK_MAX),
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

    // SECURITY: Verify user is a JOINED participant (not just INVITED)
    // Combined query: Get participant status AND session in ONE query
    const participantWithSession = await prisma.sessionParticipant.findFirst({
      where: {
        sessionId,
        userId: user.id,
        status: 'JOINED', // Only JOINED participants can view flashcards
      },
      include: {
        session: {
          select: { id: true, createdBy: true }
        }
      }
    })

    if (!participantWithSession) {
      return NextResponse.json(
        { error: 'Not a participant in this session' },
        { status: 403 }
      )
    }

    // Session is guaranteed to exist if participant exists (FK constraint)
    // Note: session data available via participantWithSession.session if needed

    // Get URL search params for filtering
    const searchParams = request.nextUrl.searchParams
    const dueOnly = searchParams.get('due') === 'true'

    // Build where clause - fetch ALL cards for this session
    const where: any = {
      sessionId,
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
  // SECURITY: Rate limiting to prevent flashcard spam (20 flashcards per minute)
  const rateLimitResult = await rateLimit(request, RateLimitPresets.moderate)
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many flashcard creation requests. Please slow down.' },
      { status: 429, headers: rateLimitResult.headers }
    )
  }

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

    // SECURITY: Verify user is a JOINED participant
    // Combined query: Get participant status AND session in ONE query (avoids N+1)
    const participantWithSession = await prisma.sessionParticipant.findFirst({
      where: {
        sessionId,
        userId: user.id,
        status: 'JOINED', // Only JOINED participants can create flashcards
      },
      include: {
        session: {
          select: { id: true, createdBy: true }
        }
      }
    })

    if (!participantWithSession) {
      return NextResponse.json(
        { error: 'Not a participant in this session' },
        { status: 403 }
      )
    }

    // Session is guaranteed to exist if participant exists (FK constraint)
    // Note: Any participant can create cards (host-only restriction removed)
    // Session data available via participantWithSession.session if needed

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
