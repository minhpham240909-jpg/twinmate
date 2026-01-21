/**
 * AI Tutor API - Solo Study Chat Assistant
 *
 * PURPOSE: Help students LEARN during study sessions
 * NEVER: Give direct answers to homework/problems
 *
 * ANTI-CHEAT SYSTEM (Homework Guard V2):
 * - AI-based intent detection (smarter than regex)
 * - Always responds in teaching mode
 * - Explains concepts, never gives answers
 * - Works with any language, any rephrasing
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'
import {
  analyzeRequest,
  getTeachingSystemPrompt,
  getAnalysisBasedPrompt,
} from '@/lib/ai/homework-guard-v2'
import { withRetry, OPENAI_RETRY_OPTIONS } from '@/lib/retry'

// SCALE: OpenAI request timeout (30 seconds) for 2000-3000 concurrent users
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 30000,
  maxRetries: 2,
})

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// Study plan step from "Guide Me" flow
interface StudyPlanStep {
  title: string
  description: string
  duration: number
  tips?: string[]
}

// Study plan context passed from client
interface StudyPlanContext {
  subject: string
  totalMinutes: number
  steps: StudyPlanStep[]
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
    const { message, history = [], studyPlan } = body as {
      message: string
      history?: ChatMessage[]
      studyPlan?: StudyPlanContext
    }

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    // Step 1: Analyze user intent with AI-powered homework guard
    const analysis = await analyzeRequest(message, history)

    // Step 2: Build system prompt with TEACHING MODE always enabled
    // This ensures AI never gives direct answers, only teaches
    let systemPrompt = getTeachingSystemPrompt()

    // Add analysis-based guidance (stronger if answer-seeking detected)
    systemPrompt += getAnalysisBasedPrompt(analysis)

    // Add base tutor personality
    systemPrompt += `

PERSONALITY:
You are a friendly, encouraging AI study tutor. Your role is to:
1. Explain concepts clearly and simply
2. Break down problems into learnable steps
3. Give similar examples (never solve their exact problem)
4. Quiz students to check understanding
5. Be patient and supportive

STYLE:
- Keep responses concise (2-4 paragraphs max)
- Use simple language, avoid jargon
- Always end with a question or prompt for them to try
- Be warm and encouraging`

    // If there's a study plan, add context about it
    if (studyPlan && studyPlan.subject && studyPlan.steps?.length > 0) {
      const stepsContext = studyPlan.steps
        .map((step, index) => {
          let stepText = `Step ${index + 1}: ${step.title} (${step.duration} min)\n   ${step.description}`
          if (step.tips && step.tips.length > 0) {
            stepText += `\n   Tips: ${step.tips.join('; ')}`
          }
          return stepText
        })
        .join('\n')

      systemPrompt += `

IMPORTANT CONTEXT - The student has a personalized study plan:
Subject: ${studyPlan.subject}
Total Duration: ${studyPlan.totalMinutes} minutes

Study Plan Steps:
${stepsContext}

Use this study plan to:
- Reference specific steps when helping the student
- Provide examples relevant to their ${studyPlan.subject} topic
- Help them understand concepts mentioned in their plan
- If they ask about "my plan" or "current step", refer to this plan
- You can suggest moving to the next step when appropriate
- Tailor quizzes and examples to the subject they're studying

You have full access to their study plan and should use it to provide personalized, contextual help.`
    }

    // Build conversation history for OpenAI
    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      {
        role: 'system',
        content: systemPrompt,
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

    // Call OpenAI API with retry logic for reliability
    const result = await withRetry(
      () => openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        max_tokens: 1024,
        temperature: 0.7,
      }),
      { ...OPENAI_RETRY_OPTIONS, context: 'AI Tutor' }
    )

    if (!result.success || !result.data) {
      console.error('AI Tutor: OpenAI call failed after retries', result.error)
      return NextResponse.json(
        { error: 'AI service temporarily unavailable. Please try again.' },
        { status: 503 }
      )
    }

    const responseText = result.data.choices[0]?.message?.content || "I'm sorry, I couldn't process that. Could you try rephrasing?"

    return NextResponse.json({
      success: true,
      response: responseText,
      // Include analysis for debugging/transparency (can remove in production)
      _analysis: {
        intent: analysis.intent,
        confidence: analysis.confidence,
        teachingMode: true, // Always true - we never give direct answers
      },
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
