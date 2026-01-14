import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

/**
 * POST /api/ai/tutor - AI Tutor for Solo Study
 * Provides study help, explanations, quizzes, and study tips
 */
export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { message, history = [] } = body

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    // Build conversation history for OpenAI
    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      {
        role: 'system',
        content: `You are a friendly and helpful AI study tutor. Your role is to:
1. Explain concepts clearly and simply
2. Provide practical examples
3. Quiz students to test understanding
4. Share effective study techniques
5. Be encouraging and supportive

Guidelines:
- Keep responses concise but informative (2-4 paragraphs max)
- Use simple language and avoid jargon
- Break down complex topics into digestible parts
- If asked to quiz, provide clear questions and wait for answers
- Be patient and encouraging
- If you don't know something, say so honestly

Remember: You're helping a student who is actively studying, so be helpful but don't distract them from their work.`,
      },
    ]

    // Add history (last 10 messages)
    for (const msg of history.slice(-10) as ChatMessage[]) {
      messages.push({
        role: msg.role,
        content: msg.content,
      })
    }

    // Add current message
    messages.push({
      role: 'user',
      content: message,
    })

    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 1024,
      temperature: 0.7,
    })

    const responseText = response.choices[0]?.message?.content || "I'm sorry, I couldn't process that. Could you try rephrasing?"

    return NextResponse.json({
      success: true,
      response: responseText,
    })
  } catch (error) {
    console.error('AI Tutor error:', error)

    // Check if it's an API key error
    if (error instanceof Error && error.message.includes('API key')) {
      return NextResponse.json(
        { error: 'AI service not configured', response: 'The AI tutor is not available right now. Please try again later.' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to get AI response' },
      { status: 500 }
    )
  }
}
