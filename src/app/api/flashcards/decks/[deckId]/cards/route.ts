import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

interface RouteParams {
  params: Promise<{ deckId: string }>
}

/**
 * GET /api/flashcards/decks/[deckId]/cards - Get cards in a deck
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { deckId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify deck access
    const deck = await prisma.flashcardDeck.findUnique({
      where: { id: deckId },
      select: { userId: true, visibility: true },
    })

    if (!deck) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 })
    }

    if (deck.userId !== user.id && deck.visibility === 'PRIVATE') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const difficulty = searchParams.get('difficulty')
    const withProgress = searchParams.get('withProgress') === 'true'

    // Build where clause
    const where: Record<string, unknown> = { deckId }
    if (difficulty) {
      where.difficulty = difficulty.toUpperCase()
    }

    const cards = await prisma.flashcardCard.findMany({
      where,
      orderBy: { position: 'asc' },
    })

    // Get progress if requested
    let cardsWithProgress = cards
    if (withProgress) {
      const cardIds = cards.map((c) => c.id)
      const progress = await prisma.flashcardCardProgress.findMany({
        where: {
          userId: user.id,
          cardId: { in: cardIds },
        },
      })
      const progressMap = new Map(progress.map((p) => [p.cardId, p]))
      cardsWithProgress = cards.map((card) => ({
        ...card,
        progress: progressMap.get(card.id) || null,
      }))
    }

    return NextResponse.json({
      success: true,
      cards: cardsWithProgress,
      total: cards.length,
    })
  } catch (error) {
    console.error('Get flashcard cards error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch cards' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/flashcards/decks/[deckId]/cards - Add card(s) to a deck
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { deckId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify deck ownership
    const deck = await prisma.flashcardDeck.findUnique({
      where: { id: deckId },
      select: { userId: true, cardCount: true },
    })

    if (!deck) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 })
    }

    if (deck.userId !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const body = await request.json()
    const { cards: cardsData } = body

    // Support single card or array of cards
    const cardsArray = Array.isArray(cardsData) ? cardsData : [cardsData]

    if (cardsArray.length === 0) {
      return NextResponse.json({ error: 'At least one card is required' }, { status: 400 })
    }

    // Get current max position
    const lastCard = await prisma.flashcardCard.findFirst({
      where: { deckId },
      orderBy: { position: 'desc' },
      select: { position: true },
    })
    let currentPosition = lastCard?.position ?? -1

    // Create cards
    const createdCards = await prisma.$transaction(async (tx) => {
      const cards = []
      for (const cardData of cardsArray) {
        const { front, back, hint, explanation, difficulty = 'MEDIUM', questionType = 'FLIP', multipleChoiceOptions, source = 'MANUAL' } = cardData

        if (!front || !back) {
          throw new Error('Front and back are required for each card')
        }

        currentPosition++
        const card = await tx.flashcardCard.create({
          data: {
            deckId,
            front: front.trim(),
            back: back.trim(),
            hint: hint?.trim() || null,
            explanation: explanation?.trim() || null,
            difficulty,
            questionType,
            multipleChoiceOptions,
            position: currentPosition,
            source,
          },
        })
        cards.push(card)
      }

      // Update deck card count
      await tx.flashcardDeck.update({
        where: { id: deckId },
        data: { cardCount: { increment: cards.length } },
      })

      return cards
    })

    return NextResponse.json({
      success: true,
      cards: createdCards,
      count: createdCards.length,
    })
  } catch (error) {
    console.error('Add flashcard cards error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add cards' },
      { status: 500 }
    )
  }
}
