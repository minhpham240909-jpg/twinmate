import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { prisma } from '@/lib/prisma'
import logger from '@/lib/logger'

/**
 * Check if user profile is complete
 * Required fields: bio, age, role, subjects (at least 1), interests (at least 1)
 */
export async function GET(request: NextRequest) {
  try {
    // Rate limiting - lenient for profile completion check
    const rateLimitResult = await rateLimit(request, RateLimitPresets.lenient)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please slow down.' },
        { status: 429, headers: rateLimitResult.headers }
      )
    }
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const profile = await prisma.profile.findUnique({
      where: { userId: user.id },
      select: {
        bio: true,
        age: true,
        role: true,
        subjects: true,
        interests: true,
      },
    })

    if (!profile) {
      return NextResponse.json({
        isComplete: false,
        missingFields: ['profile'],
      })
    }

    const missingFields: string[] = []

    if (!profile.bio || profile.bio.trim().length === 0) {
      missingFields.push('bio')
    }
    if (!profile.age) {
      missingFields.push('age')
    }
    if (!profile.role || profile.role.trim().length === 0) {
      missingFields.push('role')
    }
    if (!profile.subjects || profile.subjects.length === 0) {
      missingFields.push('subjects')
    }
    if (!profile.interests || profile.interests.length === 0) {
      missingFields.push('interests')
    }

    const isComplete = missingFields.length === 0

    return NextResponse.json({
      isComplete,
      missingFields: isComplete ? [] : missingFields,
      profile: {
        hasBio: !!profile.bio,
        hasAge: !!profile.age,
        hasRole: !!profile.role,
        subjectsCount: profile.subjects?.length || 0,
        interestsCount: profile.interests?.length || 0,
      },
    })
  } catch (error) {
    logger.error('Error checking profile completion', { error: error })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
