/**
 * Guide Me AI API - Streaming Version
 *
 * Returns responses as Server-Sent Events (SSE) for real-time updates.
 * This keeps users engaged by showing partial content as it generates.
 *
 * Events sent:
 * - status: Processing status updates
 * - partial: Partial content chunks
 * - complete: Final complete response
 * - error: Error messages
 */

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import OpenAI from 'openai'
import { v4 as uuidv4 } from 'uuid'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 60000, // 60 seconds for streaming
})

// Input size thresholds
const INPUT_SIZE = {
  SMALL: 500,
  MEDIUM: 2000,
  LARGE: 8000,
  MAX: 12000,
} as const

type StruggleType = 'dont_understand' | 'test_coming' | 'homework_help' | 'general'

export async function POST(request: NextRequest) {
  // Create a readable stream for SSE
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      try {
        // Send initial status
        sendEvent('status', { message: 'Starting...', progress: 5 })

        // Auth check
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        const isGuest = !user

        // Rate limiting
        if (isGuest) {
          const guestRateLimitResult = await rateLimit(request, {
            max: 3,
            windowMs: 24 * 60 * 60 * 1000,
            keyPrefix: 'guest-trial-stream',
          })
          if (!guestRateLimitResult.success) {
            sendEvent('error', {
              error: 'Trial limit reached',
              trialExhausted: true,
              message: 'Sign up to continue using Clerva!'
            })
            controller.close()
            return
          }
        } else {
          const rateLimitResult = await rateLimit(request, RateLimitPresets.ai)
          if (!rateLimitResult.success) {
            sendEvent('error', { error: 'Too many requests. Please slow down.' })
            controller.close()
            return
          }
        }

        sendEvent('status', { message: 'Analyzing your question...', progress: 15 })

        // Parse request
        const body = await request.json()
        const { question, subject, struggleType = 'general', actionType = 'auto' } = body

        if (!question || typeof question !== 'string' || question.trim().length < 3) {
          sendEvent('error', { error: 'Please provide a question or topic' })
          controller.close()
          return
        }

        // Preprocess input
        const { question: processedQuestion, maxTokens, isLarge } = preprocessInput(question)

        sendEvent('status', {
          message: isLarge ? 'Processing detailed content...' : 'Generating response...',
          progress: 25
        })

        // Determine action type
        const determinedActionType = actionType === 'auto'
          ? determineActionType(question, struggleType)
          : actionType

        // Build prompt
        const { systemPrompt, responseFormat } = buildPrompt(
          processedQuestion,
          subject,
          struggleType,
          determinedActionType,
          isLarge
        )

        sendEvent('status', { message: 'Creating your learning pack...', progress: 40 })

        // Stream the response
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Student's question: "${processedQuestion}"\n\nRespond in this exact JSON format:\n${responseFormat}` },
          ],
          temperature: 0.7,
          max_tokens: maxTokens,
          response_format: { type: 'json_object' },
          stream: true,
        })

        let fullContent = ''
        let chunkCount = 0

        for await (const chunk of completion) {
          const content = chunk.choices[0]?.delta?.content || ''
          fullContent += content
          chunkCount++

          // Send progress updates every few chunks
          if (chunkCount % 5 === 0) {
            const progress = Math.min(40 + (chunkCount * 2), 90)
            sendEvent('status', { message: 'Generating...', progress })
          }

          // Try to parse partial JSON to show early content
          if (chunkCount % 10 === 0 && fullContent.length > 50) {
            const partialData = extractPartialContent(fullContent, determinedActionType)
            if (partialData) {
              sendEvent('partial', partialData)
            }
          }
        }

        sendEvent('status', { message: 'Finalizing...', progress: 95 })

        // Parse final response
        try {
          const parsed = JSON.parse(fullContent)
          const result = transformResponse(parsed, determinedActionType)

          // Send 100% progress before complete
          sendEvent('status', { message: 'Done!', progress: 100 })

          sendEvent('complete', {
            success: true,
            action: result,
            xpEarned: isGuest ? 0 : 10,
            streakUpdated: false,
            isGuest,
          })
        } catch {
          // If JSON parsing fails, create fallback
          // Still send 100% progress to avoid stalling
          sendEvent('status', { message: 'Done!', progress: 100 })

          sendEvent('complete', {
            success: true,
            action: createFallbackResponse(determinedActionType, question),
            xpEarned: 0,
            streakUpdated: false,
            isGuest,
          })
        }

        controller.close()

      } catch (error) {
        console.error('[Guide Me Stream] Error:', error)
        // Send 100% progress even on error to avoid stalling
        sendEvent('status', { message: 'Retrying...', progress: 100 })
        sendEvent('error', {
          error: 'Something went wrong. Please try again.',
          fallback: createFallbackResponse('explanation', '')
        })
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}

function preprocessInput(rawQuestion: string): { question: string; maxTokens: number; isLarge: boolean } {
  let question = rawQuestion.trim()
  const originalLength = question.length

  const isLarge = originalLength >= INPUT_SIZE.MEDIUM

  if (originalLength > INPUT_SIZE.MAX) {
    const keepStart = Math.floor(INPUT_SIZE.MAX * 0.6)
    const keepEnd = Math.floor(INPUT_SIZE.MAX * 0.35)
    question = `${question.slice(0, keepStart)}\n\n[...]\n\n${question.slice(-keepEnd)}`
  }

  question = question
    .replace(/\[From document:.*?\]/g, '')
    .replace(/\[PDF content.*?\]/g, '')
    .replace(/TOPIC:|CONTENT:|KEY ELEMENTS:|CONTEXT:/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  const maxTokens = originalLength < INPUT_SIZE.SMALL ? 600
    : originalLength < INPUT_SIZE.MEDIUM ? 800
    : 1000

  return { question, maxTokens, isLarge }
}

function determineActionType(question: string, struggleType: StruggleType): string {
  const q = question.toLowerCase()

  const explanationKeywords = ['what is', 'explain', 'understand', 'why', 'how does', 'meaning']
  const flashcardKeywords = ['memorize', 'quiz', 'test me', 'flashcard', 'review']
  const roadmapKeywords = ['how to', 'steps', 'solve', 'approach', 'plan']

  if (explanationKeywords.some(kw => q.includes(kw))) return 'explanation'
  if (flashcardKeywords.some(kw => q.includes(kw))) return 'flashcards'
  if (roadmapKeywords.some(kw => q.includes(kw))) return 'roadmap'

  switch (struggleType) {
    case 'dont_understand': return 'explanation'
    case 'test_coming': return 'flashcards'
    case 'homework_help': return 'roadmap'
    default: return 'explanation'
  }
}

function buildPrompt(
  question: string,
  subject: string | undefined,
  struggleType: StruggleType,
  actionType: string,
  isLarge: boolean
): { systemPrompt: string; responseFormat: string } {
  const subjectContext = subject ? `Subject: ${subject}\n` : ''
  const largeHint = isLarge ? '\nNote: Focus on the CORE question and provide a thorough but focused response.\n' : ''

  const struggleMap = {
    dont_understand: "The student doesn't understand this concept",
    test_coming: "The student has a test and needs to TEST understanding",
    homework_help: "The student needs a roadmap/plan to approach this",
    general: "The student is stuck and needs guidance",
  }

  if (actionType === 'explanation') {
    return {
      systemPrompt: `You are a Socratic tutor. Guide the student to DISCOVER understanding - NEVER give direct answers.
${subjectContext}Situation: ${struggleMap[struggleType]}${largeHint}

Create a Learning Pack:
1. CORE IDEA: One clear concept sentence
2. KEY POINTS: 2-4 supporting ideas
3. STEPS (optional): How to think about this
4. EXAMPLE (optional): A SIMILAR worked example
5. CHECK QUESTION: Make them apply what they learned

NEVER give homework answers. Teach concepts so they can solve it themselves.`,
      responseFormat: `{
  "title": "Understanding [topic]",
  "core": { "idea": "...", "keyPoints": ["...", "..."] },
  "steps": [{ "step": "...", "why": "..." }],
  "example": { "problem": "...", "solution": "..." },
  "checkQuestion": { "question": "...", "hint": "..." },
  "nextSuggestion": "..."
}`
    }
  } else if (actionType === 'flashcards') {
    return {
      systemPrompt: `You are a Socratic tutor creating flashcards that TEST UNDERSTANDING, not memory.
${subjectContext}Situation: ${struggleMap[struggleType]}${largeHint}

Create 2-3 cards that:
- Ask WHY and HOW questions
- Test if they can APPLY concepts
- Use scenarios, not definitions`,
      responseFormat: `{
  "cards": [{ "question": "...", "answer": "...", "hint": "..." }],
  "nextSuggestion": "..."
}`
    }
  } else {
    return {
      systemPrompt: `You are a Socratic tutor creating a LEARNING ROADMAP.
${subjectContext}Situation: ${struggleMap[struggleType]}${largeHint}

Create 2-4 ACTIONABLE steps:
- Each step teaches HOW TO THINK
- Include progressive hints
- NEVER give the answer`,
      responseFormat: `{
  "title": "Plan: [goal]",
  "encouragement": "...",
  "steps": [{ "order": 1, "duration": 5, "title": "...", "description": "...", "hints": ["...", "..."] }],
  "totalMinutes": 15,
  "nextSuggestion": "..."
}`
    }
  }
}

function extractPartialContent(content: string, actionType: string): Record<string, unknown> | null {
  try {
    // Try to extract title or first meaningful content
    if (actionType === 'explanation') {
      const titleMatch = content.match(/"title"\s*:\s*"([^"]+)"/)
      const ideaMatch = content.match(/"idea"\s*:\s*"([^"]+)"/)
      if (titleMatch || ideaMatch) {
        return {
          type: 'explanation',
          title: titleMatch?.[1] || 'Loading...',
          coreIdea: ideaMatch?.[1] || null,
        }
      }
    } else if (actionType === 'flashcards') {
      const questionMatch = content.match(/"question"\s*:\s*"([^"]+)"/)
      if (questionMatch) {
        return {
          type: 'flashcards',
          firstQuestion: questionMatch[1],
        }
      }
    } else {
      const titleMatch = content.match(/"title"\s*:\s*"([^"]+)"/)
      const encouragementMatch = content.match(/"encouragement"\s*:\s*"([^"]+)"/)
      if (titleMatch || encouragementMatch) {
        return {
          type: 'roadmap',
          title: titleMatch?.[1] || 'Loading...',
          encouragement: encouragementMatch?.[1] || null,
        }
      }
    }
  } catch {
    // Ignore parsing errors for partial content
  }
  return null
}

function transformResponse(parsed: Record<string, unknown>, actionType: string): Record<string, unknown> {
  if (actionType === 'explanation') {
    const core = parsed.core as { idea?: string; keyPoints?: string[] } | undefined
    return {
      type: 'explanation',
      title: parsed.title || 'Understanding the concept',
      core: {
        idea: core?.idea || '',
        keyPoints: core?.keyPoints || [],
      },
      steps: parsed.steps || [],
      example: parsed.example || null,
      checkQuestion: parsed.checkQuestion || null,
      nextSuggestion: parsed.nextSuggestion || "Ready to try it yourself?",
    }
  } else if (actionType === 'flashcards') {
    const cards = (parsed.cards as Array<{ question?: string; answer?: string; hint?: string }> || []).map(c => ({
      id: uuidv4(),
      question: c.question || '',
      answer: c.answer || '',
      hint: c.hint,
    }))
    return {
      type: 'flashcards',
      cards,
      nextSuggestion: parsed.nextSuggestion || "Try these without hints first!",
    }
  } else {
    const steps = (parsed.steps as Array<{ order?: number; duration?: number; title?: string; description?: string; hints?: string[] }> || []).map((s, i) => ({
      id: uuidv4(),
      order: s.order || i + 1,
      duration: s.duration || 5,
      title: s.title || `Step ${i + 1}`,
      description: s.description || '',
      hints: s.hints || [],
    }))
    return {
      type: 'roadmap',
      title: parsed.title || 'Your learning plan',
      encouragement: parsed.encouragement || "You've got this!",
      steps,
      totalMinutes: steps.reduce((sum, s) => sum + s.duration, 0),
      nextSuggestion: parsed.nextSuggestion || "Let me know how it goes!",
    }
  }
}

function createFallbackResponse(actionType: string, question: string): Record<string, unknown> {
  if (actionType === 'flashcards') {
    return {
      type: 'flashcards',
      cards: [
        { id: uuidv4(), question: 'What is the key concept here?', answer: 'Think about the core idea.', hint: 'Focus on fundamentals.' },
        { id: uuidv4(), question: 'How would you explain this to someone else?', answer: 'Use simple language.', hint: 'Teaching is learning.' },
      ],
      nextSuggestion: "Try these cards!",
    }
  } else if (actionType === 'roadmap') {
    return {
      type: 'roadmap',
      title: question ? `Plan: ${question.slice(0, 40)}` : 'Your study plan',
      encouragement: "Let's break this down step by step!",
      steps: [
        { id: uuidv4(), order: 1, duration: 5, title: 'Identify the gap', description: 'Write down what confuses you', hints: ['What feels unclear?', 'Pinpoint the moment you get lost'] },
        { id: uuidv4(), order: 2, duration: 5, title: 'Find an example', description: 'Look at a worked example', hints: ['Check your notes', 'Follow each step'] },
        { id: uuidv4(), order: 3, duration: 5, title: 'Try it yourself', description: 'Attempt a similar problem', hints: ['Use the approach you learned', 'Even partial attempts help'] },
      ],
      totalMinutes: 15,
      nextSuggestion: "Start with step 1!",
    }
  } else {
    return {
      type: 'explanation',
      title: question ? `Understanding: ${question.slice(0, 50)}` : 'Quick explanation',
      core: {
        idea: 'Breaking down complex concepts into understandable pieces helps build real understanding.',
        keyPoints: [
          'Identify key terms and what they mean',
          'Look for patterns between concepts',
          'Explain it in your own words',
        ],
      },
      steps: [
        { step: 'Identify key terms', why: 'Vocabulary is the foundation' },
        { step: 'Find patterns', why: 'Patterns reveal deeper structure' },
      ],
      checkQuestion: { question: 'What part still feels unclear?', hint: 'Focus on what makes you hesitate.' },
      nextSuggestion: "Want to work through an example?",
    }
  }
}
