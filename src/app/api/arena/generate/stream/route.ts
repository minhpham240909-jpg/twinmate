/**
 * Streaming Question Generation API
 *
 * POST /api/arena/generate/stream
 *
 * Streams questions as they are generated, providing real-time feedback.
 * Uses Server-Sent Events (SSE) for streaming.
 *
 * Features:
 * - Topic caching: Same topic returns cached questions instantly
 * - Streaming: Questions appear one by one as generated
 * - Background generation support: Can be called ahead of time
 */

import { NextRequest } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { cacheGet, cacheSet, CacheKeys, CacheTTL, isRedisAvailable } from '@/lib/redis'
import type { GeneratedQuestion, ArenaContentSource } from '@/lib/arena/types'

// SCALE: OpenAI request timeout (60 seconds for streaming) for 2000-3000 concurrent users
const OPENAI_STREAM_TIMEOUT = 60000 // Longer for streaming

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: OPENAI_STREAM_TIMEOUT,
  maxRetries: 2,
})

const DEFAULT_MODEL = 'gpt-4o-mini'

// In-memory cache fallback for when Redis is unavailable
const memoryCache = new Map<string, { data: GeneratedQuestion[]; expiresAt: number }>()

// Normalize topic for cache key
function normalizeTopicKey(topic: string): string {
  return topic.toLowerCase().trim().replace(/\s+/g, '_').slice(0, 100)
}

// Check memory cache
function getFromMemoryCache(key: string): GeneratedQuestion[] | null {
  const cached = memoryCache.get(key)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data
  }
  if (cached) {
    memoryCache.delete(key)
  }
  return null
}

// Set memory cache
function setMemoryCache(key: string, data: GeneratedQuestion[], ttlSeconds: number): void {
  // Limit memory cache size
  if (memoryCache.size > 100) {
    const firstKey = memoryCache.keys().next().value
    if (firstKey) memoryCache.delete(firstKey)
  }
  memoryCache.set(key, { data, expiresAt: Date.now() + ttlSeconds * 1000 })
}

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Parse request
    const body = await request.json()
    const {
      source,
      topic,
      count = 10,
      difficulty = 'medium',
    } = body as {
      source: ArenaContentSource
      topic?: string
      count?: number
      difficulty?: 'easy' | 'medium' | 'hard'
    }

    // Only AI_GENERATED supports streaming with caching
    if (source !== 'AI_GENERATED' || !topic) {
      return new Response(JSON.stringify({ error: 'Streaming only supports AI_GENERATED with topic' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Check cache first
    const cacheKey = CacheKeys.ARENA_TOPIC_QUESTIONS(topic, difficulty, count)
    const normalizedKey = `arena:questions:${normalizeTopicKey(topic)}:${difficulty}:${count}`

    // Try Redis cache
    let cachedQuestions: GeneratedQuestion[] | null = null

    if (isRedisAvailable()) {
      try {
        cachedQuestions = await cacheGet<GeneratedQuestion[]>(
          normalizedKey,
          async () => null as unknown as GeneratedQuestion[],
          0
        )
      } catch (err) {
        console.error('[Arena Stream] Redis error:', err)
      }
    }

    // Try memory cache if Redis miss
    if (!cachedQuestions) {
      cachedQuestions = getFromMemoryCache(normalizedKey)
    }

    // If cached, stream all questions instantly
    if (cachedQuestions && cachedQuestions.length >= count) {
      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        async start(controller) {
          // Send cached questions with slight delay for UI effect
          for (let i = 0; i < Math.min(count, cachedQuestions!.length); i++) {
            const event = {
              type: 'question',
              index: i,
              question: cachedQuestions![i],
              cached: true,
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
            // Small delay for visual feedback (50ms between cached questions)
            await new Promise(resolve => setTimeout(resolve, 50))
          }

          // Send complete event
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'complete', total: count, cached: true })}\n\n`))
          controller.close()
        },
      })

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      })
    }

    // No cache - generate with streaming
    const encoder = new TextEncoder()
    const questions: GeneratedQuestion[] = []

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Generate in batches of 3 for faster perceived speed
          const batchSize = 3
          const batches = Math.ceil(count / batchSize)

          for (let batch = 0; batch < batches; batch++) {
            const remaining = count - questions.length
            const batchCount = Math.min(batchSize, remaining)

            if (batchCount <= 0) break

            const systemPrompt = `You are a quiz generator for a competitive learning game.
Generate ${batchCount} multiple choice questions about the topic.

RULES:
1. Each question must have exactly 4 options
2. Questions should be ${difficulty} difficulty
3. Include a brief explanation for each correct answer
4. Questions should be engaging and test real understanding
5. Avoid yes/no questions - make them thought-provoking
6. For math/science, use LaTeX with $..$ for inline and $$...$$ for display
7. Make questions diverse - don't repeat similar patterns

Return JSON array: [{"question":"text","options":["A","B","C","D"],"correctAnswer":0-3,"explanation":"why correct"}]`

            const previousQuestions = questions.slice(-2).map(q => q.question.slice(0, 40)).join('; ')

            const userPrompt = `Topic: ${topic}
Difficulty: ${difficulty}
${previousQuestions ? `Different from: ${previousQuestions}` : ''}

Generate ${batchCount} unique quiz questions.`

            try {
              const completion = await openai.chat.completions.create({
                model: DEFAULT_MODEL,
                messages: [
                  { role: 'system', content: systemPrompt },
                  { role: 'user', content: userPrompt },
                ],
                temperature: 0.8,
                max_tokens: 1500,
                response_format: { type: 'json_object' },
              })

              const content = completion.choices[0]?.message?.content || '{"questions":[]}'
              const parsed = JSON.parse(content)
              const newQuestions = Array.isArray(parsed) ? parsed : (parsed.questions || [])

              // Stream each question as it's generated
              for (const q of newQuestions) {
                if (q.question && q.options && q.options.length === 4 && questions.length < count) {
                  const question: GeneratedQuestion = {
                    question: q.question,
                    options: q.options,
                    correctAnswer: typeof q.correctAnswer === 'number' ? q.correctAnswer : 0,
                    explanation: q.explanation || 'Correct answer.',
                  }
                  questions.push(question)

                  // Send question event
                  const event = {
                    type: 'question',
                    index: questions.length - 1,
                    question,
                    cached: false,
                  }
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
                }
              }
            } catch (batchError) {
              console.error('[Arena Stream] Batch error:', batchError)
              // Send error event but continue
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: 'Batch generation failed, retrying...' })}\n\n`))
            }
          }

          // Cache the generated questions
          if (questions.length > 0) {
            // Cache in Redis
            if (isRedisAvailable()) {
              cacheSet(normalizedKey, questions, CacheTTL.ARENA_TOPIC_QUESTIONS).catch(err => {
                console.error('[Arena Stream] Failed to cache:', err)
              })
            }
            // Also cache in memory
            setMemoryCache(normalizedKey, questions, CacheTTL.ARENA_TOPIC_QUESTIONS)
          }

          // Send complete event
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'complete', total: questions.length, cached: false })}\n\n`))
          controller.close()
        } catch (error) {
          console.error('[Arena Stream] Generation error:', error)
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: 'Generation failed' })}\n\n`))
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error('[Arena Stream] Error:', error)
    return new Response(JSON.stringify({ error: 'Failed to start generation' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
