import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

/**
 * POST /api/focus/ai-explain
 * AI helper for explaining concepts during study sessions
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { sessionId, question, context } = body

    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return NextResponse.json(
        { error: 'Question is required' },
        { status: 400 }
      )
    }

    // Build system prompt
    const systemPrompt = `You are a helpful, encouraging study assistant. Your role is to:
1. Explain concepts clearly and concisely
2. Break down complex topics into simple steps
3. Provide relevant examples
4. Encourage the student
5. Keep responses focused and not too long (aim for 2-4 paragraphs max)

${context ? `The student is currently studying: ${context}` : ''}

Be warm and supportive. Use simple language. If a question is outside academic topics, gently redirect to studying.`

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question.trim() },
      ],
      max_tokens: 500,
      temperature: 0.7,
    })

    const answer = response.choices[0]?.message?.content || 'I apologize, but I could not generate a response. Please try rephrasing your question.'

    return NextResponse.json({
      success: true,
      answer,
      sessionId,
    })
  } catch (error) {
    console.error('[AI EXPLAIN ERROR]', error)
    
    // Check if it's an API key error
    if (error instanceof Error && error.message.includes('API key')) {
      return NextResponse.json(
        { error: 'AI service not configured', answer: 'The AI helper is not available right now. Please check your study materials or try again later.' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to get AI response', answer: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
