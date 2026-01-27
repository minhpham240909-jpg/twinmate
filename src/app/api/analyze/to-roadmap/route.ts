/**
 * ANALYSIS TO ROADMAP API
 *
 * POST /api/analyze/to-roadmap - Create roadmap from analysis result
 *
 * Takes a deep analysis result and creates a learning roadmap.
 * Can use either the client-side analysis or perform new analysis.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { createRequestLogger, getCorrelationId } from '@/lib/logger'
import { createRoadmap } from '@/lib/roadmap-engine/roadmap-service'
import { analysisToRoadmapData } from '@/lib/analysis/analysis-to-roadmap'
import { DeepAnalysisResult } from '@/lib/analysis/deep-content-analyzer'

export async function POST(request: NextRequest) {
  const log = createRequestLogger(request)
  const correlationId = getCorrelationId(request)

  try {
    // Rate limiting - uses roadmap creation limit
    const rateLimitResult = await rateLimit(request, {
      ...RateLimitPresets.hourly,
      keyPrefix: 'roadmap-create',
      max: 30, // 30 roadmaps per hour
    })

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many roadmap creation requests.' },
        { status: 429, headers: rateLimitResult.headers }
      )
    }

    // Auth required
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required to create roadmaps' },
        { status: 401 }
      )
    }

    // Parse request
    const body = await request.json()
    const {
      analysis,
      userGoal,
      userLevel,
      focusAreas,
      targetMinutes,
    } = body as {
      analysis: DeepAnalysisResult
      userGoal?: string
      userLevel?: 'beginner' | 'intermediate' | 'advanced'
      focusAreas?: string[]
      targetMinutes?: number
    }

    // Validate analysis
    if (!analysis || !analysis.overview) {
      return NextResponse.json(
        { error: 'Invalid analysis data provided' },
        { status: 400 }
      )
    }

    log.info('Creating roadmap from analysis', {
      userId: user.id,
      analysisId: analysis.id,
      topic: analysis.overview.mainTopic,
      userGoal: userGoal?.slice(0, 50),
    })

    // Convert analysis to roadmap data
    const roadmapData = analysisToRoadmapData({
      analysis,
      userGoal,
      userLevel,
      focusAreas,
      targetMinutes,
    })

    // Create the roadmap
    const roadmap = await createRoadmap({
      userId: user.id,
      goal: roadmapData.goal,
      subject: roadmapData.subject,
      title: roadmapData.title,
      overview: roadmapData.overview,
      pitfalls: roadmapData.pitfalls,
      successLooksLike: roadmapData.successLooksLike,
      estimatedMinutes: roadmapData.estimatedMinutes,
      steps: roadmapData.steps,
    })

    log.info('Roadmap created from analysis', {
      userId: user.id,
      roadmapId: roadmap.id,
      stepCount: roadmap.steps.length,
    })

    return NextResponse.json({
      success: true,
      roadmap: {
        id: roadmap.id,
        title: roadmap.title,
        goal: roadmap.goal,
        subject: roadmap.subject,
        overview: roadmap.overview,
        status: roadmap.status,
        totalSteps: roadmap.totalSteps,
        estimatedMinutes: roadmap.estimatedMinutes,
        steps: roadmap.steps.map(s => ({
          id: s.id,
          order: s.order,
          title: s.title,
          description: s.description,
          status: s.status,
          duration: s.duration,
        })),
      },
    }, {
      headers: {
        'x-correlation-id': correlationId,
        ...rateLimitResult.headers,
      },
    })

  } catch (error) {
    log.error('Failed to create roadmap from analysis', error instanceof Error ? error : { error })

    return NextResponse.json(
      { error: 'Failed to create roadmap. Please try again.' },
      { status: 500 }
    )
  }
}
