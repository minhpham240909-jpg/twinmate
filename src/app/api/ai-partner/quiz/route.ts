/**
 * AI Partner Quiz API
 * POST /api/ai-partner/quiz - Generate quiz question
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateQuiz } from '@/lib/ai-partner'

// POST: Generate a quiz question
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { sessionId, topic, difficulty } = body

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
    }

    // Validate difficulty if provided
    const validDifficulties = ['easy', 'medium', 'hard']
    if (difficulty && !validDifficulties.includes(difficulty)) {
      return NextResponse.json({ error: 'Invalid difficulty' }, { status: 400 })
    }

    const quiz = await generateQuiz({
      sessionId,
      userId: user.id,
      topic,
      difficulty,
    })

    return NextResponse.json({
      success: true,
      quiz,
    })
  } catch (error) {
    console.error('[AI Partner] Generate quiz error:', error)

    if (error instanceof Error) {
      if (error.message === 'Session not found or unauthorized') {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 })
      }
    }

    return NextResponse.json(
      { error: 'Failed to generate quiz' },
      { status: 500 }
    )
  }
}
