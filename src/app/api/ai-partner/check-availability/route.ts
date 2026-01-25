/**
 * AI Partner Check Availability API
 * GET /api/ai-partner/check-availability - Check if matching partners are now available
 *
 * Uses the FULL searchCriteria stored in the AI session to find matching partners.
 * A partner matches if they have AT LEAST ONE matching criteria (subjects, location,
 * skill level, interests, goals, availability, etc.)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

// SearchCriteria type matching what's stored in the session
interface SearchCriteria {
  subjects?: string[]
  subjectDescription?: string
  school?: string
  locationCity?: string
  locationState?: string
  locationCountry?: string
  skillLevel?: string
  studyStyle?: string
  interests?: string[]
  goals?: string[]
  availableDays?: string[]
  availableHours?: string
  ageRange?: string
  role?: string[]
  languages?: string
  searchedName?: string
  userDefinedQualities?: string
}

// GET: Check if partners matching the AI session criteria are now available
export async function GET(request: NextRequest) {
  try {
    // Rate limiting - moderate for polling endpoint
    const rateLimitResult = await rateLimit(request, RateLimitPresets.moderate)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please slow down.' },
        { status: 429, headers: rateLimitResult.headers }
      )
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sessionId = request.nextUrl.searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
    }

    // Get the AI session details including full searchCriteria
    const aiSession = await prisma.aIPartnerSession.findUnique({
      where: { id: sessionId },
      select: {
        userId: true,
        subject: true,
        skillLevel: true,
        status: true,
        searchCriteria: true, // Get the full search criteria used to start the session
      },
    })

    if (!aiSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    if (aiSession.userId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // If session is no longer active, don't check
    if (aiSession.status !== 'ACTIVE') {
      return NextResponse.json({ available: false, partners: [] })
    }

    // Parse the stored search criteria
    const searchCriteria = aiSession.searchCriteria as SearchCriteria | null

    // Check if there's any criteria to match against
    const hasCriteria = searchCriteria && (
      (searchCriteria.subjects && searchCriteria.subjects.length > 0) ||
      searchCriteria.subjectDescription ||
      searchCriteria.school ||
      searchCriteria.locationCity ||
      searchCriteria.locationState ||
      searchCriteria.locationCountry ||
      searchCriteria.skillLevel ||
      searchCriteria.studyStyle ||
      (searchCriteria.interests && searchCriteria.interests.length > 0) ||
      (searchCriteria.goals && searchCriteria.goals.length > 0) ||
      (searchCriteria.availableDays && searchCriteria.availableDays.length > 0) ||
      searchCriteria.availableHours ||
      searchCriteria.ageRange ||
      (searchCriteria.role && searchCriteria.role.length > 0) ||
      searchCriteria.languages ||
      aiSession.subject ||
      aiSession.skillLevel
    )

    // If no criteria at all, don't notify (user didn't specify what they were looking for)
    if (!hasCriteria) {
      return NextResponse.json({ available: false, partners: [], reason: 'no_criteria' })
    }

    // Get online users from UserPresence (active in last 5 minutes)
    const onlinePresence = await prisma.userPresence.findMany({
      where: {
        userId: { not: user.id },
        status: 'online',
        lastSeenAt: {
          gte: new Date(Date.now() - 5 * 60 * 1000)
        }
      },
      select: { userId: true }
    })

    const onlineUserIds = onlinePresence.map(p => p.userId)

    if (onlineUserIds.length === 0) {
      return NextResponse.json({ available: false, partners: [] })
    }

    // Build OR conditions for matching - partner matches if AT LEAST ONE criteria matches
    const orConditions: Prisma.ProfileWhereInput[] = []

    // Match by subjects (from searchCriteria or session subject)
    const subjectsToMatch = searchCriteria?.subjects || (aiSession.subject ? [aiSession.subject] : [])
    if (subjectsToMatch.length > 0) {
      orConditions.push({ subjects: { hasSome: subjectsToMatch } })
    }

    // Match by subject description (partial match on subjects or bio)
    if (searchCriteria?.subjectDescription) {
      orConditions.push({
        OR: [
          { subjects: { hasSome: [searchCriteria.subjectDescription] } },
          { bio: { contains: searchCriteria.subjectDescription, mode: 'insensitive' } },
        ]
      })
    }

    // Match by skill level (from searchCriteria or session skillLevel)
    const skillLevelToMatch = searchCriteria?.skillLevel || aiSession.skillLevel
    if (skillLevelToMatch) {
      orConditions.push({ skillLevel: skillLevelToMatch as any })
    }

    // Match by study style
    if (searchCriteria?.studyStyle) {
      orConditions.push({ studyStyle: searchCriteria.studyStyle as any })
    }

    // Match by school
    if (searchCriteria?.school) {
      orConditions.push({ school: { contains: searchCriteria.school, mode: 'insensitive' } })
    }

    // Match by location - city, state, or country (using snake_case field names from schema)
    if (searchCriteria?.locationCity) {
      orConditions.push({ location_city: { contains: searchCriteria.locationCity, mode: 'insensitive' } })
    }
    if (searchCriteria?.locationState) {
      orConditions.push({ location_state: { contains: searchCriteria.locationState, mode: 'insensitive' } })
    }
    if (searchCriteria?.locationCountry) {
      orConditions.push({ location_country: { contains: searchCriteria.locationCountry, mode: 'insensitive' } })
    }

    // Match by interests
    if (searchCriteria?.interests && searchCriteria.interests.length > 0) {
      orConditions.push({ interests: { hasSome: searchCriteria.interests } })
    }

    // Match by goals
    if (searchCriteria?.goals && searchCriteria.goals.length > 0) {
      orConditions.push({ goals: { hasSome: searchCriteria.goals } })
    }

    // Match by availability days
    if (searchCriteria?.availableDays && searchCriteria.availableDays.length > 0) {
      orConditions.push({ availableDays: { hasSome: searchCriteria.availableDays } })
    }

    // Match by available hours
    if (searchCriteria?.availableHours) {
      orConditions.push({ availableHours: searchCriteria.availableHours as any })
    }

    // Match by role (Student, Professional, etc.) - using 'role' field from schema
    if (searchCriteria?.role && searchCriteria.role.length > 0) {
      orConditions.push({ role: { in: searchCriteria.role } })
    }

    // Match by languages (languages is a String field, not an array)
    if (searchCriteria?.languages) {
      orConditions.push({ languages: { contains: searchCriteria.languages, mode: 'insensitive' } })
    }

    // If no OR conditions were built, fall back to basic criteria
    if (orConditions.length === 0) {
      return NextResponse.json({ available: false, partners: [], reason: 'no_matchable_criteria' })
    }

    // N+1 FIX: Use include to JOIN user data with profile in a single query
    // Instead of fetching users separately and doing client-side lookup
    const matchingProfiles = await prisma.profile.findMany({
      where: {
        userId: { in: onlineUserIds },
        OR: orConditions, // Match if ANY condition is true
      },
      take: 5,
      select: {
        id: true,
        userId: true,
        subjects: true,
        skillLevel: true,
        interests: true,
        goals: true,
        location_city: true,
        location_country: true,
        school: true,
        studyStyle: true,
        role: true,
        // Include user data via relation (single query with JOIN)
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          }
        }
      }
    })

    // Combine profile data with user data and calculate which criteria matched
    const partners = matchingProfiles.map(profile => {
      // User data is now directly available via the relation
      const userData = profile.user

      // Determine which criteria matched for display
      const matchedCriteria: string[] = []

      if (subjectsToMatch.length > 0 && profile.subjects.some(s => subjectsToMatch.includes(s))) {
        matchedCriteria.push('subjects')
      }
      if (skillLevelToMatch && profile.skillLevel === skillLevelToMatch) {
        matchedCriteria.push('skill level')
      }
      if (searchCriteria?.studyStyle && profile.studyStyle === searchCriteria.studyStyle) {
        matchedCriteria.push('study style')
      }
      if (searchCriteria?.locationCity && profile.location_city?.toLowerCase().includes(searchCriteria.locationCity.toLowerCase())) {
        matchedCriteria.push('location')
      }
      if (searchCriteria?.locationCountry && profile.location_country?.toLowerCase().includes(searchCriteria.locationCountry.toLowerCase())) {
        matchedCriteria.push('location')
      }
      if (searchCriteria?.school && profile.school?.toLowerCase().includes(searchCriteria.school.toLowerCase())) {
        matchedCriteria.push('school')
      }
      if (searchCriteria?.interests?.length && profile.interests.some(i => searchCriteria.interests?.includes(i))) {
        matchedCriteria.push('interests')
      }
      if (searchCriteria?.goals?.length && profile.goals.some(g => searchCriteria.goals?.includes(g))) {
        matchedCriteria.push('goals')
      }
      if (searchCriteria?.role?.length && searchCriteria.role.includes(profile.role || '')) {
        matchedCriteria.push('role')
      }

      return {
        id: profile.id,
        userId: profile.userId,
        name: userData?.name || 'Unknown',
        avatarUrl: userData?.avatarUrl || null,
        subjects: profile.subjects,
        skillLevel: profile.skillLevel,
        matchedCriteria: [...new Set(matchedCriteria)], // Remove duplicates
      }
    })

    return NextResponse.json({
      available: partners.length > 0,
      partners,
      searchCriteriaSummary: buildCriteriaSummary(searchCriteria, aiSession.subject, aiSession.skillLevel),
      // Return the full search criteria for "View All" functionality
      searchCriteria: searchCriteria || {
        subjects: aiSession.subject ? [aiSession.subject] : undefined,
        skillLevel: aiSession.skillLevel || undefined,
      },
    })
  } catch (error) {
    console.error('[AI Partner] Check availability error:', error)
    return NextResponse.json(
      { error: 'Failed to check availability' },
      { status: 500 }
    )
  }
}

// Build a human-readable summary of what criteria was being searched for
function buildCriteriaSummary(
  criteria: SearchCriteria | null,
  subject: string | null,
  skillLevel: string | null
): string {
  const parts: string[] = []

  const subjects = criteria?.subjects || (subject ? [subject] : [])
  if (subjects.length > 0) {
    parts.push(subjects.slice(0, 2).join(', '))
  }

  const skill = criteria?.skillLevel || skillLevel
  if (skill) {
    parts.push(skill.charAt(0) + skill.slice(1).toLowerCase())
  }

  if (criteria?.locationCity) parts.push(criteria.locationCity)
  else if (criteria?.locationCountry) parts.push(criteria.locationCountry)

  if (criteria?.school) parts.push(criteria.school)

  if (criteria?.studyStyle) {
    parts.push(criteria.studyStyle.charAt(0) + criteria.studyStyle.slice(1).toLowerCase())
  }

  return parts.length > 0 ? parts.join(' • ') : 'study partner'
}
