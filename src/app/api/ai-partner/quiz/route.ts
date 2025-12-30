/**
 * AI Partner Quiz API
 * POST /api/ai-partner/quiz - Generate quiz question(s)
 * Supports both topic-based and conversation-based quiz generation
 * Also supports interactive quiz mode with mixed question types
 * Supports regeneration with excluded questions for "Try Again" feature
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateQuiz, generateQuizFromConversation, generateInteractiveQuiz } from '@/lib/ai-partner'

// POST: Generate quiz question(s)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { sessionId, topic, difficulty, fromConversation, count, questionType, interactive, excludeQuestions } = body

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
    }

    // Validate difficulty if provided
    const validDifficulties = ['easy', 'medium', 'hard']
    if (difficulty && !validDifficulties.includes(difficulty)) {
      return NextResponse.json({ error: 'Invalid difficulty' }, { status: 400 })
    }

    // Validate question type if provided
    const validQuestionTypes = ['multiple_choice', 'open_ended', 'both']
    if (questionType && !validQuestionTypes.includes(questionType)) {
      return NextResponse.json({ error: 'Invalid question type' }, { status: 400 })
    }

    // Limit quiz count
    const quizCount = Math.min(Math.max(count || 5, 1), 10)

    // Interactive mode: Generate mixed quiz for interactive quiz sessions
    if (interactive) {
      const result = await generateInteractiveQuiz({
        sessionId,
        userId: user.id,
        count: quizCount,
        difficulty: difficulty || 'medium',
        questionType: questionType || 'both',
        excludeQuestions: excludeQuestions || [], // Pass excluded questions for regeneration
      })

      return NextResponse.json({
        success: true,
        questions: result.questions,
        messageId: result.messageId,
        source: 'interactive',
      })
    }

    // Generate from conversation context if requested
    if (fromConversation) {
      const result = await generateQuizFromConversation({
        sessionId,
        userId: user.id,
        count: quizCount,
        difficulty: difficulty || 'medium',
      })

      return NextResponse.json({
        success: true,
        questions: result.questions,
        messageId: result.messageId,
        source: 'conversation',
      })
    }

    // Generate single topic-based quiz question
    const quiz = await generateQuiz({
      sessionId,
      userId: user.id,
      topic,
      difficulty,
    })

    return NextResponse.json({
      success: true,
      quiz,
      source: 'topic',
    })
  } catch (error) {
    console.error('[AI Partner] Generate quiz error:', error)

    if (error instanceof Error) {
      if (error.message === 'Session not found or unauthorized') {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 })
      }
      if (error.message.includes('Not enough conversation')) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
    }

    return NextResponse.json(
      { error: 'Failed to generate quiz' },
      { status: 500 }
    )
  }
}
