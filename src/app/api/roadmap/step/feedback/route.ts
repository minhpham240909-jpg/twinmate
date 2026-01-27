/**
 * STEP FEEDBACK API - Adaptive AI Feedback
 *
 * POST /api/roadmap/step/feedback - Get adaptive feedback for a step
 *
 * Called when users:
 * - Report struggling with a step
 * - Request help/clarification
 * - Complete a step with difficulty rating <= 2
 *
 * Returns:
 * - AI-generated tips specific to their struggle
 * - Alternative approaches
 * - Optional step breakdown suggestion
 * - Encouragement
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { createRequestLogger, getCorrelationId } from '@/lib/logger'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 30000,
  maxRetries: 1,
})

interface FeedbackRequest {
  stepId: string
  roadmapId: string
  struggleType: 'confused' | 'stuck' | 'overwhelmed' | 'need_help' | 'too_hard'
  specificIssue?: string // Optional description of what specifically is hard
}

interface AdaptiveFeedback {
  encouragement: string
  tips: string[]
  alternativeApproach?: string
  breakdownSuggested: boolean
  breakdownPreview?: {
    title: string
    substeps: string[]
  }
  resources?: {
    type: string
    title: string
    searchQuery: string
  }[]
}

export async function POST(request: NextRequest) {
  const log = createRequestLogger(request)
  const correlationId = getCorrelationId(request)

  try {
    // Auth check
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Rate limiting - use AI preset since this calls OpenAI
    const rateLimitResult = await rateLimit(request, RateLimitPresets.ai)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please slow down.' },
        { status: 429, headers: rateLimitResult.headers }
      )
    }

    // Parse request
    const body: FeedbackRequest = await request.json()

    if (!body.stepId || !body.roadmapId || !body.struggleType) {
      return NextResponse.json(
        { error: 'Missing required fields: stepId, roadmapId, struggleType' },
        { status: 400 }
      )
    }

    // Get the step and roadmap context
    const roadmap = await prisma.learningRoadmap.findFirst({
      where: {
        id: body.roadmapId,
        userId: user.id,
      },
      include: {
        steps: {
          where: { id: body.stepId },
        },
      },
    })

    if (!roadmap || roadmap.steps.length === 0) {
      return NextResponse.json(
        { error: 'Step or roadmap not found' },
        { status: 404 }
      )
    }

    const step = roadmap.steps[0]

    // Get user's learning history for context
    const userMemory = await prisma.aIUserMemory.findUnique({
      where: { userId: user.id },
      select: {
        strugglingTopics: true,
        preferredLearningStyle: true,
      },
    })

    // Generate adaptive feedback using AI
    const feedback = await generateAdaptiveFeedback(
      step,
      roadmap.goal,
      body.struggleType,
      body.specificIssue,
      userMemory?.preferredLearningStyle || undefined
    )

    // Track this struggle for future learning
    await trackStruggle(user.id, step.title, body.struggleType)

    log.info('Adaptive feedback generated', {
      stepId: body.stepId,
      struggleType: body.struggleType,
      breakdownSuggested: feedback.breakdownSuggested,
    })

    return NextResponse.json({
      success: true,
      feedback,
    }, {
      headers: { 'x-correlation-id': correlationId },
    })

  } catch (error) {
    log.error('Failed to generate feedback', error instanceof Error ? error : { error })
    return NextResponse.json(
      { error: 'Failed to generate feedback' },
      { status: 500 }
    )
  }
}

/**
 * Generate adaptive feedback using AI
 */
async function generateAdaptiveFeedback(
  step: { title: string; description: string; method?: string | null; avoid?: string | null; doneWhen?: string | null; duration: number },
  goal: string,
  struggleType: string,
  specificIssue?: string,
  learningStyle?: string
): Promise<AdaptiveFeedback> {
  const struggleDescriptions: Record<string, string> = {
    confused: "doesn't understand what they need to do",
    stuck: "knows what to do but can't make progress",
    overwhelmed: "feels the task is too big or complex",
    need_help: "wants guidance on how to approach this",
    too_hard: "believes this is beyond their current skill level",
  }

  const systemPrompt = `You are Clerva, a supportive but direct learning mentor. A student is struggling with a step in their learning roadmap.

CONTEXT:
- Goal: ${goal}
- Current Step: ${step.title}
- Step Description: ${step.description}
${step.method ? `- Method: ${step.method}` : ''}
${step.avoid ? `- Things to avoid: ${step.avoid}` : ''}
${step.doneWhen ? `- Success criterion: ${step.doneWhen}` : ''}
- Estimated time: ${step.duration} minutes
${learningStyle ? `- User's preferred learning style: ${learningStyle}` : ''}

STRUGGLE TYPE: ${struggleDescriptions[struggleType] || struggleType}
${specificIssue ? `SPECIFIC ISSUE: ${specificIssue}` : ''}

YOUR TASK:
Provide adaptive feedback that helps them overcome this struggle. Be encouraging but realistic.

RESPONSE FORMAT (JSON):
{
  "encouragement": "One sentence of genuine encouragement specific to their situation",
  "tips": ["Tip 1", "Tip 2", "Tip 3"], // 2-4 actionable tips
  "alternativeApproach": "If applicable, suggest a different way to approach this step",
  "breakdownSuggested": true/false, // true if the step should be broken into smaller parts
  "breakdownPreview": { // Only if breakdownSuggested is true
    "title": "Step title broken down",
    "substeps": ["Substep 1", "Substep 2", "Substep 3"]
  },
  "resources": [ // 1-2 resource suggestions
    {
      "type": "video|article|exercise",
      "title": "Resource title",
      "searchQuery": "What to search for on YouTube/Google"
    }
  ]
}

RULES:
1. Be direct but kind - no excessive positivity
2. Tips should be specific and actionable, not generic
3. Suggest breakdown only if the step genuinely needs it (not for simple tasks)
4. Keep it concise - students are already struggling, don't overwhelm them
5. Resources should help with the SPECIFIC struggle, not generic learning`

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Generate adaptive feedback for this student.' },
      ],
      temperature: 0.7,
      max_tokens: 500,
      response_format: { type: 'json_object' },
    })

    const response = completion.choices[0]?.message?.content || '{}'
    const parsed = JSON.parse(response)

    return {
      encouragement: parsed.encouragement || "Every expert was once a beginner. Let's work through this together.",
      tips: (parsed.tips || []).slice(0, 4),
      alternativeApproach: parsed.alternativeApproach,
      breakdownSuggested: parsed.breakdownSuggested || false,
      breakdownPreview: parsed.breakdownSuggested ? parsed.breakdownPreview : undefined,
      resources: parsed.resources?.slice(0, 2),
    }
  } catch (error) {
    console.error('AI feedback generation failed:', error)

    // Return fallback feedback
    return {
      encouragement: "Struggling is part of learning. Let's approach this differently.",
      tips: [
        "Break the task into the smallest possible first step",
        "Try explaining what you DO understand out loud",
        "Take a 5-minute break, then come back with fresh eyes",
      ],
      breakdownSuggested: struggleType === 'overwhelmed' || struggleType === 'too_hard',
      breakdownPreview: struggleType === 'overwhelmed' ? {
        title: `${step.title} (Simplified)`,
        substeps: [
          "Start with the most basic version",
          "Add one element at a time",
          "Verify each addition works before continuing",
        ],
      } : undefined,
    }
  }
}

/**
 * Track struggle for future AI learning
 */
async function trackStruggle(userId: string, stepTitle: string, struggleType: string): Promise<void> {
  try {
    // Update user memory with this struggle
    await prisma.aIUserMemory.upsert({
      where: { userId },
      create: {
        userId,
        strugglingTopics: [stepTitle],
        pendingQuestions: [`struggled:${struggleType}:${stepTitle}`],
      },
      update: {
        strugglingTopics: {
          push: stepTitle,
        },
        pendingQuestions: {
          push: `struggled:${struggleType}:${stepTitle}`,
        },
      },
    })
  } catch (error) {
    // Non-critical, log but don't fail
    console.warn('Failed to track struggle:', error)
  }
}
