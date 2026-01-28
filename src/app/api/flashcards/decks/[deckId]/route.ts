import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { prisma } from '@/lib/prisma'

interface RouteParams {
  params: Promise<{ deckId: string }>
}

/**
 * GET /api/flashcards/decks/[deckId] - Get a specific deck with cards
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // Rate limiting - lenient for read operations
    const rateLimitResult = await rateLimit(request, RateLimitPresets.lenient)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please slow down.' },
        { status: 429, headers: rateLimitResult.headers }
      )
    }

    const { deckId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Single query with card progress included - no N+1
    const deck = await prisma.flashcardDeck.findUnique({
      where: { id: deckId },
      include: {
        cards: {
          orderBy: { position: 'asc' },
          include: {
            // Include progress for this user directly - eliminates N+1
            userProgress: {
              where: { userId: user.id },
              take: 1,
            },
          },
        },
        userProgress: {
          where: { userId: user.id },
          take: 1,
        },
        _count: {
          select: { cards: true },
        },
      },
    })

    if (!deck) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 })
    }

    // Check access - must own deck or deck must be public/unlisted
    if (deck.userId !== user.id && deck.visibility === 'PRIVATE') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Map cards with progress from the included relation
    const cardsWithProgress = deck.cards.map((card) => ({
      ...card,
      progress: card.userProgress[0] || null,
      userProgress: undefined, // Remove the raw array from response
    }))

    return NextResponse.json({
      success: true,
      deck: {
        ...deck,
        cards: cardsWithProgress,
        cardCount: deck._count.cards,
        progress: deck.userProgress[0] || null,
        _count: undefined,
        userProgress: undefined,
      },
    })
  } catch (error) {
    console.error('Get flashcard deck error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch deck' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/flashcards/decks/[deckId] - Update a deck
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    // Rate limiting - moderate for updates
    const rateLimitResult = await rateLimit(request, RateLimitPresets.moderate)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please slow down.' },
        { status: 429, headers: rateLimitResult.headers }
      )
    }

    const { deckId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify ownership
    const existingDeck = await prisma.flashcardDeck.findUnique({
      where: { id: deckId },
      select: { userId: true },
    })

    if (!existingDeck) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 })
    }

    if (existingDeck.userId !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const body = await request.json()
    const { title, description, subject, tags, visibility, color } = body

    const updateData: Record<string, unknown> = {}
    if (title !== undefined) updateData.title = title.trim()
    if (description !== undefined) updateData.description = description?.trim() || null
    if (subject !== undefined) updateData.subject = subject?.trim() || null
    if (tags !== undefined) updateData.tags = tags
    if (visibility !== undefined) updateData.visibility = visibility
    if (color !== undefined) updateData.color = color

    const deck = await prisma.flashcardDeck.update({
      where: { id: deckId },
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      deck,
    })
  } catch (error) {
    console.error('Update flashcard deck error:', error)
    return NextResponse.json(
      { error: 'Failed to update deck' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/flashcards/decks/[deckId] - Delete a deck
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    // Rate limiting - strict for delete operations
    const rateLimitResult = await rateLimit(request, RateLimitPresets.strict)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please slow down.' },
        { status: 429, headers: rateLimitResult.headers }
      )
    }

    const { deckId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify ownership
    const existingDeck = await prisma.flashcardDeck.findUnique({
      where: { id: deckId },
      select: { userId: true },
    })

    if (!existingDeck) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 })
    }

    if (existingDeck.userId !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Delete deck (cascades to cards, progress, sessions)
    await prisma.flashcardDeck.delete({
      where: { id: deckId },
    })

    return NextResponse.json({
      success: true,
      message: 'Deck deleted',
    })
  } catch (error) {
    console.error('Delete flashcard deck error:', error)
    return NextResponse.json(
      { error: 'Failed to delete deck' },
      { status: 500 }
    )
  }
}
