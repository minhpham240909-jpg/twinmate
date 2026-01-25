/**
 * CLERVA ROADMAP API
 *
 * System-controlled roadmap generation.
 *
 * ARCHITECTURE:
 * 1. System decides: goal type, step structure, constraints
 * 2. AI fills in: content within strict boundaries
 * 3. System validates: output must match schema exactly
 *
 * The AI is a worker, not a decision maker.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { buildRoadmap, generateMission } from '@/lib/roadmap-engine/ai-executor'
import { categorizeGoal, SYSTEM_RULES } from '@/lib/roadmap-engine'
import logger, { createRequestLogger, getCorrelationId } from '@/lib/logger'

// ============================================
// REQUEST TYPES
// ============================================

interface CreateRoadmapRequest {
  goal: string
  timeframe?: string // "1 week", "2 weeks", "1 month"
  level?: 'beginner' | 'intermediate' | 'advanced'
}

interface GetMissionRequest {
  roadmapId: string
  timeAvailable?: number // minutes
}

// ============================================
// POST /api/roadmap - Create a new roadmap
// ============================================

export async function POST(request: NextRequest) {
  const startTime = Date.now()
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

    // Rate limiting
    const rateLimitResult = await rateLimit(request, RateLimitPresets.ai)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please slow down.' },
        { status: 429, headers: rateLimitResult.headers }
      )
    }

    // Parse request
    const body: CreateRoadmapRequest = await request.json()
    const { goal, timeframe = '2 weeks', level = 'intermediate' } = body

    if (!goal || typeof goal !== 'string' || goal.trim().length < 5) {
      return NextResponse.json(
        { error: 'Please provide a clear learning goal (at least 5 characters)' },
        { status: 400 }
      )
    }

    // STEP 1: System categorizes the goal (NOT AI)
    const { type: goalType } = categorizeGoal(goal)
    log.debug('Goal categorized', { goalType, goal: goal.slice(0, 50) })

    // STEP 2: System extracts subject (simple heuristics, NOT AI)
    const subject = extractSubject(goal)

    // STEP 3: AI builds roadmap within strict constraints
    const roadmapResult = await buildRoadmap({
      userGoal: goal,
      userLevel: level,
      timeframe,
      subject,
    })

    if (!roadmapResult.success || !roadmapResult.data) {
      log.error('Roadmap generation failed', {
        error: roadmapResult.error,
        validationErrors: roadmapResult.validationErrors,
      })
      return NextResponse.json(
        {
          error: 'Failed to generate roadmap. Please try again.',
          details: roadmapResult.validationErrors,
        },
        { status: 500 }
      )
    }

    // STEP 4: System transforms AI output to final format
    const roadmap = transformToRoadmap(roadmapResult.data, user.id, goalType)

    // Log performance
    const duration = Date.now() - startTime
    log.info('Roadmap created', {
      duration,
      goalType,
      stepCount: roadmap.steps.length,
    })

    return NextResponse.json({
      success: true,
      roadmap,
      meta: {
        generatedIn: `${duration}ms`,
        goalType,
        systemRules: SYSTEM_RULES.AI_CANNOT_DECIDE,
      },
    }, {
      headers: { 'x-correlation-id': correlationId },
    })

  } catch (error) {
    log.error('Request failed', error instanceof Error ? error : { error })
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

// ============================================
// GET /api/roadmap/mission - Get today's mission
// ============================================

export async function GET(request: NextRequest) {
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

    // Get query params
    const searchParams = request.nextUrl.searchParams
    const timeAvailable = parseInt(searchParams.get('timeAvailable') || '30', 10)

    // For now, return a sample mission structure
    // In full implementation, this would fetch from database
    const sampleStep = {
      id: 'step-1',
      title: 'Master Core Vocabulary',
      description: 'Learn the 50 most common words',
      timeframe: 'Days 1-7',
    }

    const missionResult = await generateMission({
      currentStep: sampleStep,
      userLevel: 'intermediate',
      timeAvailable,
    })

    if (!missionResult.success || !missionResult.data) {
      return NextResponse.json(
        { error: 'Failed to generate mission' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      mission: missionResult.data,
      currentStep: sampleStep,
    }, {
      headers: { 'x-correlation-id': correlationId },
    })

  } catch (error) {
    log.error('Request failed', error instanceof Error ? error : { error })
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Extract subject from goal (system logic, NOT AI)
 */
function extractSubject(goal: string): string {
  const g = goal.toLowerCase()

  // Common subjects
  const subjects = [
    'math', 'mathematics', 'algebra', 'calculus', 'geometry', 'statistics',
    'physics', 'chemistry', 'biology', 'science',
    'english', 'writing', 'reading', 'literature', 'grammar',
    'history', 'geography', 'economics', 'psychology', 'sociology',
    'programming', 'coding', 'python', 'javascript', 'java', 'computer science',
    'spanish', 'french', 'german', 'chinese', 'japanese', 'korean', 'language',
    'music', 'art', 'design',
    'business', 'marketing', 'finance', 'accounting',
  ]

  for (const subject of subjects) {
    if (g.includes(subject)) {
      return subject.charAt(0).toUpperCase() + subject.slice(1)
    }
  }

  // Default to extracting key noun
  const words = goal.split(' ')
  const meaningfulWords = words.filter(w =>
    w.length > 3 &&
    !['want', 'learn', 'study', 'help', 'need', 'understand', 'master', 'improve'].includes(w.toLowerCase())
  )

  return meaningfulWords[0] || 'General'
}

/**
 * Transform AI output to final roadmap structure
 */
function transformToRoadmap(
  aiOutput: {
    goal: string
    totalDuration: string
    steps: Array<{
      order: number
      title: string
      timeframe: string
      description: string
      method: string
      avoid: string[]
      doneWhen: string
    }>
    overallPitfalls: string[]
    successLooksLike: string
  },
  userId: string,
  goalType: string
) {
  return {
    id: `roadmap-${Date.now()}`,
    userId,
    goalType,
    goal: aiOutput.goal,
    totalDuration: aiOutput.totalDuration,
    steps: aiOutput.steps.map((step, index) => ({
      ...step,
      id: `step-${index + 1}`,
      status: index === 0 ? 'current' : 'locked',
      allowedContent: {
        explanation: true,
        practice: true,
        examples: true,
        fullSolutions: false, // System decides this
      },
    })),
    pitfalls: aiOutput.overallPitfalls,
    successLooksLike: aiOutput.successLooksLike,
    currentStepIndex: 0,
    createdAt: new Date().toISOString(),
  }
}
