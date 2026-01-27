/**
 * CONFIDENCE METER API
 *
 * Calculates user's readiness/confidence score for their learning goal.
 * Based on multiple factors:
 * - Progress through roadmap steps
 * - Time spent on completed steps
 * - Difficulty ratings given
 * - Consistency (streak)
 * - Step completion quality
 *
 * Returns a percentage (0-100) with breakdown factors.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/api-auth'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { createRequestLogger, getCorrelationId } from '@/lib/logger'
import { prisma } from '@/lib/prisma'

// ============================================
// TYPES
// ============================================

interface ConfidenceBreakdown {
  progressScore: number      // 0-100: How far through the roadmap
  consistencyScore: number   // 0-100: Based on streak and regularity
  masteryScore: number       // 0-100: Based on difficulty ratings and time spent
  engagementScore: number    // 0-100: Based on notes, feedback, resources used
}

interface ConfidenceResponse {
  success: boolean
  confidence: number         // 0-100 overall confidence
  breakdown: ConfidenceBreakdown
  message: string            // Human-readable summary
  nextMilestone?: {
    percentage: number
    description: string
  }
}

// Type for roadmap step data from Prisma query
interface RoadmapStepData {
  id: string
  status: string
  duration: number | null
  minutesSpent: number | null
  difficultyRating: number | null
  userNotes: string | null
  completedAt: Date | null
}

// ============================================
// CONFIDENCE CALCULATION
// ============================================

function calculateProgressScore(
  completedSteps: number,
  totalSteps: number
): number {
  if (totalSteps === 0) return 0
  // Progress contributes up to 40% of confidence
  // Use sqrt curve to reward early progress more
  const rawProgress = completedSteps / totalSteps
  return Math.round(Math.sqrt(rawProgress) * 100)
}

function calculateConsistencyScore(
  currentStreak: number,
  _longestStreak: number,
  daysSinceStart: number,
  activeDays: number
): number {
  // Consistency based on:
  // - Current streak (50%)
  // - Regularity: activeDays / daysSinceStart (50%)

  // Streak score: caps at 30 days for max contribution
  const streakScore = Math.min(currentStreak / 30, 1) * 50

  // Regularity score
  const regularity = daysSinceStart > 0 ? activeDays / daysSinceStart : 0
  const regularityScore = Math.min(regularity, 1) * 50

  return Math.round(streakScore + regularityScore)
}

function calculateMasteryScore(
  avgDifficultyRating: number | null,
  avgTimePerStep: number,
  expectedTimePerStep: number
): number {
  // Mastery based on:
  // - Difficulty rating (lower = easier = higher mastery) - 60%
  // - Time efficiency (completing in expected time) - 40%

  // Difficulty: 1-5 scale, where 1-2 = easy, 3 = medium, 4-5 = hard
  // Convert to mastery: low difficulty = high mastery
  let difficultyScore = 50 // default if no ratings
  if (avgDifficultyRating !== null) {
    // 1 -> 100, 2 -> 80, 3 -> 60, 4 -> 40, 5 -> 20
    difficultyScore = Math.max(0, 120 - avgDifficultyRating * 20)
  }

  // Time efficiency: ratio of expected to actual
  // If taking too long, lower score. If quick, cap at 100
  let timeScore = 50
  if (avgTimePerStep > 0 && expectedTimePerStep > 0) {
    const ratio = expectedTimePerStep / avgTimePerStep
    timeScore = Math.min(ratio * 100, 100)
  }

  return Math.round(difficultyScore * 0.6 + timeScore * 0.4)
}

function calculateEngagementScore(
  notesCount: number,
  feedbackCount: number,
  resourcesAccessed: number,
  totalSteps: number
): number {
  // Engagement based on:
  // - Notes written per step
  // - Feedback given
  // - Resources accessed

  const notesPerStep = totalSteps > 0 ? notesCount / totalSteps : 0
  const notesScore = Math.min(notesPerStep, 1) * 40 // max 40 for notes

  const feedbackPerStep = totalSteps > 0 ? feedbackCount / totalSteps : 0
  const feedbackScore = Math.min(feedbackPerStep, 1) * 30 // max 30 for feedback

  const resourcesPerStep = totalSteps > 0 ? resourcesAccessed / totalSteps : 0
  const resourcesScore = Math.min(resourcesPerStep, 0.5) * 60 // max 30 for resources

  return Math.round(notesScore + feedbackScore + resourcesScore)
}

function getConfidenceMessage(confidence: number, _progressPercent: number): string {
  if (confidence >= 80) {
    return 'Strong foundation built. Ready to apply these skills.'
  } else if (confidence >= 60) {
    return 'Good progress. Continue building consistency.'
  } else if (confidence >= 40) {
    return 'Developing understanding. Focus on regular practice.'
  } else if (confidence >= 20) {
    return 'Early stage. Building momentum will increase confidence.'
  } else {
    return 'Just starting. Complete more steps to build confidence.'
  }
}

function getNextMilestone(confidence: number): { percentage: number; description: string } | undefined {
  const milestones = [
    { percentage: 25, description: 'Foundation established' },
    { percentage: 50, description: 'Halfway proficient' },
    { percentage: 75, description: 'Strong understanding' },
    { percentage: 90, description: 'Near mastery' },
    { percentage: 100, description: 'Goal achieved' },
  ]

  return milestones.find(m => m.percentage > confidence)
}

// ============================================
// MAIN HANDLER
// ============================================

export async function GET(request: NextRequest) {
  const log = createRequestLogger(request)
  const correlationId = getCorrelationId(request)

  try {
    // Rate limiting
    const rateLimitResult = await rateLimit(request, RateLimitPresets.moderate)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests' },
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

    // Get roadmapId from query params
    const { searchParams } = new URL(request.url)
    const roadmapId = searchParams.get('roadmapId')

    if (!roadmapId) {
      return NextResponse.json(
        { error: 'roadmapId query parameter required' },
        { status: 400 }
      )
    }

    // Fetch roadmap with steps
    const roadmap = await prisma.learningRoadmap.findUnique({
      where: { id: roadmapId },
      include: {
        steps: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            status: true,
            duration: true,
            minutesSpent: true,
            difficultyRating: true,
            userNotes: true,
            completedAt: true,
          },
        },
      },
    })

    if (!roadmap || roadmap.userId !== user.id) {
      return NextResponse.json(
        { error: 'Roadmap not found or access denied' },
        { status: 404 }
      )
    }

    // Fetch learner identity for streak data
    const identity = await prisma.learnerIdentity.findUnique({
      where: { userId: user.id },
      select: {
        currentStreak: true,
        longestStreak: true,
      },
    })

    // Calculate metrics
    const steps = roadmap.steps as RoadmapStepData[]
    const totalSteps = steps.length
    const completedSteps = steps.filter((s: RoadmapStepData) => s.status === 'COMPLETED').length
    const completedStepsData = steps.filter((s: RoadmapStepData) => s.status === 'COMPLETED')

    // Progress score
    const progressScore = calculateProgressScore(completedSteps, totalSteps)

    // Consistency score
    const daysSinceStart = roadmap.createdAt
      ? Math.max(1, Math.floor((Date.now() - roadmap.createdAt.getTime()) / (1000 * 60 * 60 * 24)))
      : 1
    const activeDays = new Set(
      completedStepsData
        .filter((s: RoadmapStepData) => s.completedAt)
        .map((s: RoadmapStepData) => s.completedAt!.toISOString().split('T')[0])
    ).size
    const consistencyScore = calculateConsistencyScore(
      identity?.currentStreak || 0,
      identity?.longestStreak || 0,
      daysSinceStart,
      activeDays
    )

    // Mastery score
    const difficultyRatings = completedStepsData
      .map((s: RoadmapStepData) => s.difficultyRating)
      .filter((r: number | null): r is number => r !== null)
    const avgDifficulty = difficultyRatings.length > 0
      ? difficultyRatings.reduce((a: number, b: number) => a + b, 0) / difficultyRatings.length
      : null

    const totalMinutesSpent = completedStepsData.reduce((sum: number, s: RoadmapStepData) => sum + (s.minutesSpent || 0), 0)
    const avgTimePerStep = completedSteps > 0 ? totalMinutesSpent / completedSteps : 0
    const totalExpectedMinutes = completedStepsData.reduce((sum: number, s: RoadmapStepData) => sum + (s.duration || 15), 0)
    const expectedTimePerStep = completedSteps > 0 ? totalExpectedMinutes / completedSteps : 15

    const masteryScore = calculateMasteryScore(avgDifficulty, avgTimePerStep, expectedTimePerStep)

    // Engagement score
    const notesCount = completedStepsData.filter((s: RoadmapStepData) => s.userNotes && s.userNotes.length > 0).length

    // Fetch resource engagement data from resource_engagements table
    let feedbackCount = 0
    let resourcesAccessed = 0
    
    try {
      // Get resource engagements for this user related to the roadmap's subject
      const resourceEngagements = await prisma.$queryRaw<{ clicked: number; voted: number }[]>`
        SELECT 
          COUNT(CASE WHEN clicked = true THEN 1 END)::int as clicked,
          COUNT(CASE WHEN helpful_vote IS NOT NULL THEN 1 END)::int as voted
        FROM resource_engagements
        WHERE user_id = ${user.id}::uuid
          AND subject = ${roadmap.goal}
      `
      
      if (resourceEngagements.length > 0) {
        resourcesAccessed = resourceEngagements[0].clicked || 0
        feedbackCount = resourceEngagements[0].voted || 0
      }
    } catch {
      // If resource_engagements table doesn't exist or query fails, use fallback
      log.warn('Could not fetch resource engagements, using fallback', { roadmapId })
    }

    // Also count help panel interactions from adaptive feedback requests
    // These indicate the user is actively engaging when stuck
    try {
      const adaptiveFeedbackCount = await prisma.roadmapStep.count({
        where: {
          roadmapId,
          status: 'COMPLETED',
          userNotes: {
            contains: 'struggled',
          },
        },
      })
      feedbackCount += adaptiveFeedbackCount
    } catch {
      // Ignore if userNotes field doesn't support the query
    }

    const engagementScore = calculateEngagementScore(
      notesCount,
      feedbackCount,
      resourcesAccessed,
      completedSteps
    )

    // Calculate overall confidence
    // Weights: Progress 40%, Consistency 25%, Mastery 25%, Engagement 10%
    const confidence = Math.round(
      progressScore * 0.4 +
      consistencyScore * 0.25 +
      masteryScore * 0.25 +
      engagementScore * 0.1
    )

    const progressPercent = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0

    log.info('Confidence calculated', {
      roadmapId,
      confidence,
      progressScore,
      consistencyScore,
      masteryScore,
      engagementScore,
    })

    return NextResponse.json({
      success: true,
      confidence,
      breakdown: {
        progressScore,
        consistencyScore,
        masteryScore,
        engagementScore,
      },
      message: getConfidenceMessage(confidence, progressPercent),
      nextMilestone: getNextMilestone(confidence),
    } as ConfidenceResponse, {
      headers: { 'x-correlation-id': correlationId },
    })

  } catch (error) {
    log.error('Confidence calculation failed', error instanceof Error ? error : { error })
    return NextResponse.json(
      { error: 'Failed to calculate confidence' },
      { status: 500 }
    )
  }
}
