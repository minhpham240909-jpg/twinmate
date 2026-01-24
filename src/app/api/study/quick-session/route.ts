/**
 * Quick Session AI API
 *
 * Instant AI Q&A for quick study help:
 * - Intent-based responses (Explain, Solve, Review, Plan)
 * - Single-turn Q&A (no conversation history)
 * - Fast, focused responses optimized for teens
 *
 * SCALE: Stateless design - no database writes for the Q&A itself
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'
import { z } from 'zod'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 30000, // 30 second timeout
  maxRetries: 2,
})

// Valid intents for Quick Session
const INTENTS = ['explain', 'solve', 'review', 'plan'] as const
type Intent = typeof INTENTS[number]

// Request schema
const quickSessionSchema = z.object({
  intent: z.enum(INTENTS),
  question: z.string().min(1).max(2000),
  subject: z.string().max(100).optional(),
})

// Intent-specific system prompts (counselor-like, specific, actionable)
const INTENT_PROMPTS: Record<Intent, string> = {
  explain: `You are a patient tutor explaining a concept to a student.

RULES:
- Start with the simplest explanation possible
- Use ONE clear analogy or example
- Break into 2-3 short bullet points if needed
- End with "Does this help?" or similar warm closing
- Keep response under 150 words
- Use simple language (8th grade reading level)
- Never use jargon without explaining it`,

  solve: `You are a problem-solving coach helping a student work through a problem.

RULES:
- Show the solution step-by-step (numbered 1, 2, 3...)
- Explain the "why" for each step briefly
- Highlight the key insight or trick
- If there's a formula, show it clearly
- Keep response under 200 words
- End with a quick tip for similar problems`,

  review: `You are a study coach helping a student review and memorize material.

RULES:
- Summarize the key points in 3-5 bullets
- Highlight what's most likely to appear on a test
- Create a simple mnemonic or memory trick if possible
- Suggest one quick practice exercise
- Keep response under 150 words
- Be encouraging about their review effort`,

  plan: `You are an academic advisor helping a student create a study plan.

RULES:
- Break the topic into 3-5 specific, actionable steps
- Estimate time for each step (5-15 min chunks)
- Prioritize: what to do first, what can wait
- Suggest one specific resource if relevant
- Keep response under 150 words
- Make it feel achievable, not overwhelming`,
}

/**
 * POST /api/study/quick-session
 * Get instant AI help based on intent
 */
export async function POST(request: NextRequest) {
  // Parse body early so it's available in catch block
  let parsedBody: { intent?: string; question?: string; subject?: string } = {}

  try {
    // Auth check
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse and validate request
    parsedBody = await request.json()
    const validation = quickSessionSchema.safeParse(parsedBody)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.issues },
        { status: 400 }
      )
    }

    const { intent, question, subject } = validation.data

    // Build context-aware prompt
    const systemPrompt = INTENT_PROMPTS[intent]
    const userPrompt = subject
      ? `Subject: ${subject}\n\nQuestion: ${question}`
      : question

    // Generate AI response with timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-5-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 400,
        temperature: 0.7,
      })

      clearTimeout(timeoutId)

      const answer = response.choices[0]?.message?.content

      if (!answer) {
        throw new Error('No response generated')
      }

      return NextResponse.json({
        success: true,
        intent,
        answer,
      })
    } catch (aiError) {
      clearTimeout(timeoutId)
      throw aiError
    }
  } catch (error) {
    console.error('[Quick Session API] Error:', error)

    // Fallback responses by intent
    const fallbackResponses: Record<Intent, string> = {
      explain: "I couldn't process that right now. Try breaking your question into smaller parts, or check your textbook for the basics first.",
      solve: "I couldn't solve that right now. Try writing out what you know so far, and identify where you're stuck.",
      review: "I couldn't generate a review right now. Try making flashcards of the main concepts you remember.",
      plan: "I couldn't create a plan right now. Start by listing 3 things you need to learn, then tackle them one at a time.",
    }

    // Use already-parsed body (don't re-read the stream)
    const intent = (parsedBody.intent as Intent) || 'explain'

    return NextResponse.json({
      success: false,
      intent,
      answer: fallbackResponses[intent],
      error: 'AI service unavailable',
    })
  }
}
