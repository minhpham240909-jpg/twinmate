/**
 * USER IDENTITY API
 *
 * GET: Fetch user's learner identity
 * POST: Create/update learner identity (from discovery flow)
 *
 * This powers the "This app knows ME" feeling.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Validation schema for identity creation/update
const identitySchema = z.object({
  archetype: z.string().min(1).max(100),
  strengths: z.array(z.string().max(100)).max(10),
  preferredStudyTime: z.enum(['morning', 'afternoon', 'evening', 'night']).optional(),
  learningStyle: z.string().max(50).optional(),
})

// GET: Fetch user's identity
export async function GET(request: NextRequest) {
  try {
    const rateLimitResult = await rateLimit(request, RateLimitPresets.lenient)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: rateLimitResult.headers }
      )
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch LearnerIdentity
    const identity = await prisma.learnerIdentity.findUnique({
      where: { userId: user.id },
      select: {
        archetype: true,
        strengths: true,
        growthAreas: true,
        preferredStudyTime: true,
        consistencyScore: true,
        currentStreak: true,
        longestStreak: true,
        totalMissionsCompleted: true,
        totalMissionsFailed: true,
        archetypeUnlockedAt: true,
        lastMissionAt: true,
      },
    })

    // Also fetch LearningProfile for additional data
    const learningProfile = await prisma.learningProfile.findUnique({
      where: { userId: user.id },
      select: {
        strengths: true,
        weaknesses: true,
        recommendedFocus: true,
        learningVelocity: true,
        preferredDifficulty: true,
      },
    })

    // Merge data for complete identity picture
    const hasIdentity = identity?.archetype || (identity?.strengths && identity.strengths.length > 0)

    return NextResponse.json({
      success: true,
      hasIdentity,
      identity: identity ? {
        archetype: identity.archetype,
        strengths: identity.strengths || [],
        growthAreas: identity.growthAreas || learningProfile?.weaknesses || [],
        preferredStudyTime: identity.preferredStudyTime,
        consistencyScore: identity.consistencyScore,
        currentStreak: identity.currentStreak,
        longestStreak: identity.longestStreak,
        totalMissionsCompleted: identity.totalMissionsCompleted,
        totalMissionsFailed: identity.totalMissionsFailed,
        archetypeUnlockedAt: identity.archetypeUnlockedAt?.toISOString(),
        lastMissionAt: identity.lastMissionAt?.toISOString(),
      } : null,
      learningProfile: learningProfile ? {
        strengths: learningProfile.strengths,
        weaknesses: learningProfile.weaknesses,
        recommendedFocus: learningProfile.recommendedFocus,
        learningVelocity: learningProfile.learningVelocity,
        preferredDifficulty: learningProfile.preferredDifficulty,
      } : null,
    })
  } catch (error) {
    console.error('Error fetching identity:', error)
    return NextResponse.json(
      { error: 'Failed to fetch identity' },
      { status: 500 }
    )
  }
}

// POST: Create or update identity (from discovery flow)
export async function POST(request: NextRequest) {
  try {
    const rateLimitResult = await rateLimit(request, RateLimitPresets.moderate)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: rateLimitResult.headers }
      )
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validation = identitySchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { archetype, strengths, preferredStudyTime, learningStyle } = validation.data

    // Upsert LearnerIdentity
    const identity = await prisma.learnerIdentity.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        archetype,
        strengths,
        growthAreas: [], // Will be populated as user learns
        preferredStudyTime: preferredStudyTime || 'morning',
        archetypeUnlockedAt: new Date(),
        // Initialize stats
        averageSessionMinutes: 15,
        consistencyScore: 50, // Start at neutral
        totalMissionsCompleted: 0,
        totalMissionsFailed: 0,
        totalMissionsSkipped: 0,
        currentStreak: 0,
        longestStreak: 0,
        daysSinceLastMission: 0,
      },
      update: {
        archetype,
        strengths,
        preferredStudyTime: preferredStudyTime || undefined,
        // Only update archetypeUnlockedAt if this is the first archetype
        archetypeUnlockedAt: undefined, // Keep existing
      },
    })

    // Also update LearningProfile with strengths
    await prisma.learningProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        strengths,
        weaknesses: [],
        recommendedFocus: [],
        preferredDifficulty: 'adaptive',
      },
      update: {
        strengths,
      },
    })

    return NextResponse.json({
      success: true,
      identity: {
        archetype: identity.archetype,
        strengths: identity.strengths,
        preferredStudyTime: identity.preferredStudyTime,
        archetypeUnlockedAt: identity.archetypeUnlockedAt?.toISOString(),
      },
      message: `Welcome, ${archetype}! Your learning identity has been created.`,
    })
  } catch (error) {
    console.error('Error saving identity:', error)
    return NextResponse.json(
      { error: 'Failed to save identity' },
      { status: 500 }
    )
  }
}

// PATCH: Update specific identity fields (for ongoing learning)
export async function PATCH(request: NextRequest) {
  try {
    const rateLimitResult = await rateLimit(request, RateLimitPresets.moderate)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: rateLimitResult.headers }
      )
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Partial update schema
    const updateSchema = z.object({
      archetype: z.string().min(1).max(100).optional(),
      strengths: z.array(z.string().max(100)).max(10).optional(),
      growthAreas: z.array(z.string().max(100)).max(10).optional(),
      consistencyScore: z.number().min(0).max(100).optional(),
      currentStreak: z.number().min(0).optional(),
      longestStreak: z.number().min(0).optional(),
      totalMissionsCompleted: z.number().min(0).optional(),
      totalMissionsFailed: z.number().min(0).optional(),
    })

    const validation = updateSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const updateData = validation.data

    // Update identity
    const identity = await prisma.learnerIdentity.update({
      where: { userId: user.id },
      data: {
        ...updateData,
        lastMissionAt: new Date(),
      },
    })

    // Update longest streak if current exceeds it
    if (updateData.currentStreak && updateData.currentStreak > (identity.longestStreak || 0)) {
      await prisma.learnerIdentity.update({
        where: { userId: user.id },
        data: { longestStreak: updateData.currentStreak },
      })
    }

    return NextResponse.json({
      success: true,
      identity: {
        archetype: identity.archetype,
        strengths: identity.strengths,
        growthAreas: identity.growthAreas,
        consistencyScore: identity.consistencyScore,
        currentStreak: identity.currentStreak,
      },
    })
  } catch (error) {
    console.error('Error updating identity:', error)
    return NextResponse.json(
      { error: 'Failed to update identity' },
      { status: 500 }
    )
  }
}
