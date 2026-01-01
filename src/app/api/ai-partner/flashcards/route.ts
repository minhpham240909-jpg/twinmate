/**
 * AI Partner Flashcards API
 * POST /api/ai-partner/flashcards - Generate flashcards
 * POST /api/ai-partner/flashcards/from-conversation - Generate from chat context
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateFlashcardsForSession, generateFlashcardsFromConversation } from '@/lib/ai-partner'

// POST: Generate flashcards for a topic or from conversation
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { sessionId, topic, count, fromConversation, difficulty } = body

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
    }

    // Limit flashcard count (max 20)
    const flashcardCount = Math.min(Math.max(count || 5, 1), 20)

    // Validate difficulty level
    const validDifficulties = ['easy', 'medium', 'hard'] as const
    const flashcardDifficulty = validDifficulties.includes(difficulty) ? difficulty : 'medium'

    // Generate from conversation context if requested
    if (fromConversation) {
      const result = await generateFlashcardsFromConversation({
        sessionId,
        userId: user.id,
        count: flashcardCount,
        difficulty: flashcardDifficulty,
      })

      return NextResponse.json({
        success: true,
        flashcards: result.flashcards,
        messageId: result.messageId,
        source: 'conversation',
      })
    }

    // Generate from specific topic
    if (!topic || typeof topic !== 'string') {
      return NextResponse.json({ error: 'Topic required' }, { status: 400 })
    }

    const result = await generateFlashcardsForSession({
      sessionId,
      userId: user.id,
      topic: topic.trim(),
      count: flashcardCount,
      difficulty: flashcardDifficulty,
    })

    return NextResponse.json({
      success: true,
      flashcards: result.flashcards,
      messageId: result.messageId,
      source: 'topic',
    })
  } catch (error) {
    console.error('[AI Partner] Generate flashcards error:', error)

    if (error instanceof Error) {
      if (error.message === 'Session not found or unauthorized') {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 })
      }
    }

    return NextResponse.json(
      { error: 'Failed to generate flashcards' },
      { status: 500 }
    )
  }
}
