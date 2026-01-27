/**
 * REFINE ROADMAP API
 *
 * POST /api/roadmap/refine - Refine an existing roadmap
 *
 * Refinement types:
 * - faster_pace: Condense steps, shorter durations
 * - more_depth: Add more detail, more resources, deeper explanations
 * - different_focus: Change approach/methodology
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { createRequestLogger } from '@/lib/logger'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 30000,
  maxRetries: 1,
})

type RefinementType = 'faster_pace' | 'more_depth' | 'different_focus'

interface RefineRequest {
  roadmapId: string
  refinementType: RefinementType
}

const REFINEMENT_PROMPTS: Record<RefinementType, string> = {
  faster_pace: `
    The user wants a FASTER PACE version of this roadmap.
    - Combine related steps where possible
    - Reduce step durations by 30-50%
    - Focus on the most essential actions only
    - Remove nice-to-have elements
    - Keep total steps to minimum viable (3-5 steps max)
    - Make each step more action-oriented and direct
  `,
  more_depth: `
    The user wants MORE DEPTH in this roadmap.
    - Add more detailed explanations in each step
    - Include specific resources, examples, or exercises
    - Break complex steps into smaller, more detailed sub-actions
    - Add "why this matters" context to each step
    - Include common pitfalls and how to avoid them
    - Increase step durations to allow for deeper learning
  `,
  different_focus: `
    The user wants a DIFFERENT APPROACH to achieving this goal.
    - Suggest an alternative methodology or learning path
    - If current approach is theoretical, make it more practical (or vice versa)
    - If current approach is solo, suggest collaborative elements (or vice versa)
    - Change the order or prioritization of topics
    - Introduce different resources or platforms
    - Keep the same end goal but take a fresh perspective
  `,
}

export async function POST(request: NextRequest) {
  const log = createRequestLogger(request)

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

    // Rate limiting
    const rateLimitResult = await rateLimit(request, RateLimitPresets.moderate)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a moment.' },
        { status: 429, headers: rateLimitResult.headers }
      )
    }

    const body: RefineRequest = await request.json()
    const { roadmapId, refinementType } = body

    if (!roadmapId || !refinementType) {
      return NextResponse.json(
        { error: 'roadmapId and refinementType are required' },
        { status: 400 }
      )
    }

    if (!['faster_pace', 'more_depth', 'different_focus'].includes(refinementType)) {
      return NextResponse.json(
        { error: 'Invalid refinement type' },
        { status: 400 }
      )
    }

    // Get the existing roadmap
    const existingRoadmap = await prisma.learningRoadmap.findFirst({
      where: {
        id: roadmapId,
        userId: user.id,
      },
      include: {
        steps: {
          orderBy: { order: 'asc' },
        },
      },
    })

    if (!existingRoadmap) {
      return NextResponse.json(
        { error: 'Roadmap not found' },
        { status: 404 }
      )
    }

    // Build context for AI
    const currentSteps = existingRoadmap.steps.map(s => ({
      order: s.order,
      title: s.title,
      description: s.description,
      duration: s.duration,
      method: s.method,
    }))

    const prompt = `
You are refining an existing learning roadmap.

ORIGINAL GOAL: ${existingRoadmap.goal}
ORIGINAL TITLE: ${existingRoadmap.title}
CURRENT STEPS:
${currentSteps.map(s => `${s.order}. ${s.title} (${s.duration} min): ${s.description}`).join('\n')}

REFINEMENT REQUEST:
${REFINEMENT_PROMPTS[refinementType]}

Generate a refined roadmap with the following JSON structure:
{
  "title": "Updated title reflecting the refinement",
  "overview": "Brief overview of the refined approach",
  "steps": [
    {
      "order": 1,
      "title": "Step title",
      "description": "What to do in this step",
      "duration": 10,
      "method": "How to approach this step",
      "doneWhen": "How to know this step is complete"
    }
  ]
}

Important:
- Keep the same overall goal
- Apply the refinement type appropriately
- Return ONLY valid JSON, no markdown or explanation
`

    // Generate refined roadmap
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert learning coach. Generate refined learning roadmaps. Return ONLY valid JSON, no markdown or explanation.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    })

    const text = completion.choices[0]?.message?.content || ''

    // Parse the response
    let refinedData
    try {
      // Clean the response - remove markdown code blocks if present
      const cleanedText = text.replace(/```json\n?|\n?```/g, '').trim()
      refinedData = JSON.parse(cleanedText)
    } catch {
      log.error('Failed to parse AI response', { text })
      return NextResponse.json(
        { error: 'Failed to generate refined roadmap' },
        { status: 500 }
      )
    }

    // Update the roadmap in a transaction
    const updatedRoadmap = await prisma.$transaction(async (tx) => {
      // Delete existing steps
      await tx.roadmapStep.deleteMany({
        where: { roadmapId: existingRoadmap.id },
      })

      // Update roadmap and create new steps
      return tx.learningRoadmap.update({
        where: { id: existingRoadmap.id },
        data: {
          title: refinedData.title || existingRoadmap.title,
          overview: refinedData.overview || existingRoadmap.overview,
          totalSteps: refinedData.steps.length,
          currentStepIndex: 0,
          completedSteps: 0,
          estimatedMinutes: refinedData.steps.reduce((sum: number, s: { duration?: number }) => sum + (s.duration || 5), 0),
          updatedAt: new Date(),
          steps: {
            create: refinedData.steps.map((step: {
              order?: number
              title?: string
              description?: string
              duration?: number
              method?: string
              doneWhen?: string
            }, index: number) => ({
              order: step.order || index + 1,
              title: step.title || `Step ${index + 1}`,
              description: step.description || '',
              duration: step.duration || 5,
              method: step.method,
              doneWhen: step.doneWhen,
              status: index === 0 ? 'CURRENT' : 'LOCKED',
              startedAt: index === 0 ? new Date() : null,
            })),
          },
        },
        include: {
          steps: {
            orderBy: { order: 'asc' },
          },
        },
      })
    })

    log.info('Roadmap refined', {
      roadmapId,
      refinementType,
      newStepCount: updatedRoadmap.steps.length,
    })

    return NextResponse.json({
      success: true,
      roadmap: {
        id: updatedRoadmap.id,
        title: updatedRoadmap.title,
        overview: updatedRoadmap.overview,
        goal: updatedRoadmap.goal,
        totalSteps: updatedRoadmap.totalSteps,
        completedSteps: updatedRoadmap.completedSteps,
        estimatedMinutes: updatedRoadmap.estimatedMinutes,
        steps: updatedRoadmap.steps.map(step => ({
          id: step.id,
          order: step.order,
          title: step.title,
          description: step.description,
          duration: step.duration,
          method: step.method,
          doneWhen: step.doneWhen,
          status: step.status.toLowerCase(),
        })),
      },
      refinementType,
    })

  } catch (error) {
    log.error('Failed to refine roadmap', error instanceof Error ? error : { error })
    return NextResponse.json(
      { error: 'Failed to refine roadmap' },
      { status: 500 }
    )
  }
}
