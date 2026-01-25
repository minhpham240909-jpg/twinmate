import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { notifyPartnersStartedStudying } from '@/lib/notifications/send'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'

/**
 * POST /api/flashcards/study - Start a study session
 */
export async function POST(request: NextRequest) {
  // Rate limit: moderate for study session starts
  const rateLimitResult = await rateLimit(request, RateLimitPresets.moderate)
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: rateLimitResult.headers }
    )
  }
  
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { deckId, studyMode = 'flip' } = body

    if (!deckId) {
      return NextResponse.json({ error: 'Deck ID required' }, { status: 400 })
    }

    // Verify deck access
    const deck = await prisma.flashcardDeck.findUnique({
      where: { id: deckId },
      select: { userId: true, visibility: true, cardCount: true },
    })

    if (!deck) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 })
    }

    if (deck.userId !== user.id && deck.visibility === 'PRIVATE') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Create study session
    const session = await prisma.flashcardStudySession.create({
      data: {
        userId: user.id,
        deckId,
        studyMode,
      },
    })

    // Get cards for study based on mode
    // PERF: Added limits to prevent loading thousands of cards into memory
    // PERF: Run spaced repetition queries in parallel with Promise.all
    const MAX_CARDS_PER_SESSION = 100 // Reasonable limit for a study session

    let cards
    if (studyMode === 'spaced') {
      // Spaced repetition: get due cards first, then new cards
      // PERF: Run both queries in parallel instead of sequential
      const [dueCards, newCards] = await Promise.all([
        prisma.flashcardCard.findMany({
          where: {
            deckId,
            userProgress: {
              some: {
                userId: user.id,
                nextReviewDate: { lte: new Date() },
              },
            },
          },
          include: {
            userProgress: {
              where: { userId: user.id },
              take: 1,
            },
          },
          orderBy: { position: 'asc' },
          take: MAX_CARDS_PER_SESSION, // PERF: Limit due cards
        }),
        prisma.flashcardCard.findMany({
          where: {
            deckId,
            userProgress: {
              none: { userId: user.id },
            },
          },
          take: 10, // Limit new cards per session
          orderBy: { position: 'asc' },
        }),
      ])

      cards = [...dueCards, ...newCards.map((c) => ({ ...c, userProgress: [] }))]
    } else {
      // Regular flip/quiz: get cards with limit
      // PERF: Added take limit to prevent loading 1000s of cards
      cards = await prisma.flashcardCard.findMany({
        where: { deckId },
        include: {
          userProgress: {
            where: { userId: user.id },
            take: 1,
          },
        },
        orderBy: { position: 'asc' },
        take: MAX_CARDS_PER_SESSION, // PERF: Limit cards per session
      })
    }

    // Transform cards
    const transformedCards = cards.map((card) => ({
      ...card,
      progress: card.userProgress?.[0] || null,
      userProgress: undefined,
    }))

    // Notify partners that user started studying flashcards (async)
    notifyPartnersStartedStudying(user.id, 'flashcards').catch(() => {})

    return NextResponse.json({
      success: true,
      session,
      cards: transformedCards,
    })
  } catch (error) {
    console.error('Start flashcard study error:', error)
    return NextResponse.json(
      { error: 'Failed to start study session' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/flashcards/study - Get due cards for spaced repetition
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const deckId = searchParams.get('deckId')

    // Get all due cards for user
    const where: Record<string, unknown> = {
      userId: user.id,
      nextReviewDate: { lte: new Date() },
    }

    if (deckId) {
      where.card = { deckId }
    }

    const dueProgress = await prisma.flashcardCardProgress.findMany({
      where,
      include: {
        card: {
          include: {
            deck: {
              select: { id: true, title: true, color: true },
            },
          },
        },
      },
      orderBy: { nextReviewDate: 'asc' },
      take: 50,
    })

    // Group by deck
    const byDeck = dueProgress.reduce((acc, progress) => {
      const deck = progress.card.deck
      if (!acc[deck.id]) {
        acc[deck.id] = {
          deck,
          cards: [],
          dueCount: 0,
        }
      }
      acc[deck.id].cards.push({
        ...progress.card,
        progress,
        deck: undefined,
      })
      acc[deck.id].dueCount++
      return acc
    }, {} as Record<string, { deck: { id: string; title: string; color: string | null }; cards: unknown[]; dueCount: number }>)

    return NextResponse.json({
      success: true,
      totalDue: dueProgress.length,
      decks: Object.values(byDeck),
    })
  } catch (error) {
    console.error('Get due flashcards error:', error)
    return NextResponse.json(
      { error: 'Failed to get due cards' },
      { status: 500 }
    )
  }
}
