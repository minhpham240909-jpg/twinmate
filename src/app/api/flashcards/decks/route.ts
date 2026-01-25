import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'

/**
 * GET /api/flashcards/decks - Get user's flashcard decks
 */
export async function GET(request: NextRequest) {
  // Rate limit: lenient for read operations
  const rateLimitResult = await rateLimit(request, RateLimitPresets.lenient)
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

    const { searchParams } = new URL(request.url)
    const visibility = searchParams.get('visibility') // 'all', 'private', 'public'
    const subject = searchParams.get('subject')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build where clause
    const where: Record<string, unknown> = {
      userId: user.id,
    }

    if (visibility && visibility !== 'all') {
      where.visibility = visibility.toUpperCase()
    }

    if (subject) {
      where.subject = subject
    }

    const [decks, total] = await Promise.all([
      prisma.flashcardDeck.findMany({
        where,
        include: {
          _count: {
            select: { cards: true },
          },
          userProgress: {
            where: { userId: user.id },
            take: 1,
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.flashcardDeck.count({ where }),
    ])

    // Transform response
    const transformedDecks = decks.map((deck) => ({
      ...deck,
      cardCount: deck._count.cards,
      progress: deck.userProgress[0] || null,
      _count: undefined,
      userProgress: undefined,
    }))

    return NextResponse.json({
      success: true,
      decks: transformedDecks,
      total,
      hasMore: offset + decks.length < total,
    })
  } catch (error) {
    console.error('Get flashcard decks error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch decks' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/flashcards/decks - Create a new deck
 */
export async function POST(request: NextRequest) {
  // Rate limit: moderate for write operations
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
    const {
      title,
      description,
      subject,
      tags = [],
      visibility = 'PRIVATE',
      color,
      source = 'MANUAL',
    } = body

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    const deck = await prisma.flashcardDeck.create({
      data: {
        userId: user.id,
        title: title.trim(),
        description: description?.trim() || null,
        subject: subject?.trim() || null,
        tags,
        visibility,
        color,
        source,
      },
    })

    return NextResponse.json({
      success: true,
      deck,
    })
  } catch (error) {
    console.error('Create flashcard deck error:', error)
    return NextResponse.json(
      { error: 'Failed to create deck' },
      { status: 500 }
    )
  }
}
