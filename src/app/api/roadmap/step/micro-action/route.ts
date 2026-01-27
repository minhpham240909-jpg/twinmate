/**
 * STEP MICRO-ACTIONS API
 *
 * Provides lightweight AI-powered assistance for individual roadmap steps:
 * - explain: Break down the step concept in simple terms
 * - example: Give a practical example related to the step
 * - test: Generate a quick comprehension check
 *
 * Design principles:
 * - Fast responses (uses streaming-friendly model)
 * - Context-aware (uses step title, description, and roadmap goal)
 * - Cached responses to reduce API calls and latency
 * - Rate limited to prevent abuse
 */

import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getCurrentUser } from '@/lib/api-auth'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { createRequestLogger, getCorrelationId } from '@/lib/logger'
import { prisma } from '@/lib/prisma'

// ============================================
// TYPES
// ============================================

type MicroActionType = 'explain' | 'example' | 'test'

interface MicroActionRequest {
  stepId: string
  actionType: MicroActionType
  roadmapId: string
}

interface MicroActionResponse {
  success: boolean
  actionType: MicroActionType
  content: string
  cached?: boolean
}

// ============================================
// CACHE CONFIGURATION
// ============================================

// In-memory cache with TTL (production should use Redis)
const responseCache = new Map<string, { content: string; timestamp: number }>()
const CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes

function getCacheKey(stepId: string, actionType: MicroActionType): string {
  return `micro_${stepId}_${actionType}`
}

function getCachedResponse(key: string): string | null {
  const cached = responseCache.get(key)
  if (!cached) return null

  if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
    responseCache.delete(key)
    return null
  }

  return cached.content
}

function setCachedResponse(key: string, content: string): void {
  // Limit cache size to prevent memory issues
  if (responseCache.size > 1000) {
    // Remove oldest entries
    const entries = Array.from(responseCache.entries())
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp)
    entries.slice(0, 200).forEach(([k]) => responseCache.delete(k))
  }

  responseCache.set(key, { content, timestamp: Date.now() })
}

// ============================================
// PROMPT TEMPLATES
// ============================================

function getSystemPrompt(actionType: MicroActionType): string {
  const baseContext = `You are an expert learning assistant. Be concise, clear, and practical.
Avoid jargon unless necessary. Use analogies when helpful.
Never use phrases like "Great question!" or "I'd be happy to help!"
Get straight to the point.`

  switch (actionType) {
    case 'explain':
      return `${baseContext}

Your task: Explain a learning step in 2-3 short paragraphs.
- Start with the core concept
- Explain why it matters
- Connect it to practical application

Keep it under 150 words. No bullet points unless absolutely necessary.`

    case 'example':
      return `${baseContext}

Your task: Provide ONE concrete, practical example.
- Make it realistic and relatable
- Show the concept in action
- Keep it specific, not generic

Keep it under 120 words. Use code snippets only if the topic requires it.`

    case 'test':
      return `${baseContext}

Your task: Create ONE quick comprehension check question.
Format:
**Question:** [The question]
**Answer:** [Brief answer - 1-2 sentences]

The question should test understanding, not memorization.
Make it thought-provoking but answerable in 30 seconds.`
  }
}

function getUserPrompt(
  actionType: MicroActionType,
  stepTitle: string,
  stepDescription: string,
  roadmapGoal: string
): string {
  const context = `
Learning Goal: ${roadmapGoal}
Current Step: ${stepTitle}
Step Description: ${stepDescription}
`.trim()

  switch (actionType) {
    case 'explain':
      return `${context}

Explain this step clearly.`

    case 'example':
      return `${context}

Give a practical example for this step.`

    case 'test':
      return `${context}

Create a quick comprehension check for this step.`
  }
}

// ============================================
// MAIN HANDLER
// ============================================

export async function POST(request: NextRequest) {
  const log = createRequestLogger(request)
  const correlationId = getCorrelationId(request)

  try {
    // Rate limiting - moderate for this endpoint
    const rateLimitResult = await rateLimit(request, RateLimitPresets.moderate)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait before trying again.' },
        { status: 429, headers: rateLimitResult.headers }
      )
    }

    // Authentication
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Parse request
    const body: MicroActionRequest = await request.json()
    const { stepId, actionType, roadmapId } = body

    // Validation
    if (!stepId || !actionType || !roadmapId) {
      return NextResponse.json(
        { error: 'Missing required fields: stepId, actionType, roadmapId' },
        { status: 400 }
      )
    }

    if (!['explain', 'example', 'test'].includes(actionType)) {
      return NextResponse.json(
        { error: 'Invalid actionType. Must be: explain, example, or test' },
        { status: 400 }
      )
    }

    // Check cache first
    const cacheKey = getCacheKey(stepId, actionType)
    const cachedContent = getCachedResponse(cacheKey)

    if (cachedContent) {
      log.info('Micro-action cache hit', { stepId, actionType })
      return NextResponse.json({
        success: true,
        actionType,
        content: cachedContent,
        cached: true,
      } as MicroActionResponse, {
        headers: { 'x-correlation-id': correlationId },
      })
    }

    // Fetch step and roadmap data
    const step = await prisma.roadmapStep.findUnique({
      where: { id: stepId },
      select: {
        id: true,
        title: true,
        description: true,
        roadmapId: true,
      },
    })

    if (!step) {
      return NextResponse.json(
        { error: 'Step not found' },
        { status: 404 }
      )
    }

    // Verify ownership
    const roadmap = await prisma.learningRoadmap.findUnique({
      where: { id: roadmapId },
      select: {
        id: true,
        userId: true,
        goal: true,
        title: true,
      },
    })

    if (!roadmap || roadmap.userId !== user.id) {
      return NextResponse.json(
        { error: 'Roadmap not found or access denied' },
        { status: 403 }
      )
    }

    if (step.roadmapId !== roadmapId) {
      return NextResponse.json(
        { error: 'Step does not belong to this roadmap' },
        { status: 400 }
      )
    }

    // Generate AI response
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Fast and cost-effective for short responses
      messages: [
        {
          role: 'system',
          content: getSystemPrompt(actionType),
        },
        {
          role: 'user',
          content: getUserPrompt(
            actionType,
            step.title,
            step.description || '',
            roadmap.goal
          ),
        },
      ],
      max_tokens: 300,
      temperature: 0.7,
    })

    const content = completion.choices[0]?.message?.content || ''

    if (!content) {
      return NextResponse.json(
        { error: 'Failed to generate response' },
        { status: 500 }
      )
    }

    // Cache the response
    setCachedResponse(cacheKey, content)

    log.info('Micro-action generated', {
      stepId,
      actionType,
      contentLength: content.length,
    })

    return NextResponse.json({
      success: true,
      actionType,
      content,
      cached: false,
    } as MicroActionResponse, {
      headers: { 'x-correlation-id': correlationId },
    })

  } catch (error) {
    log.error('Micro-action failed', error instanceof Error ? error : { error })
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    )
  }
}
