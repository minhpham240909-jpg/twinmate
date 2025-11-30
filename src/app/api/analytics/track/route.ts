/**
 * Activity Tracking API
 * Records user page visits, feature usage, and search queries
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

// Rate limiting maps (in-memory for simplicity)
const rateLimits = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(userId: string, limit: number = 100, windowMs: number = 60000): boolean {
  const now = Date.now()
  const userLimit = rateLimits.get(userId)

  if (!userLimit || userLimit.resetAt < now) {
    rateLimits.set(userId, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (userLimit.count >= limit) {
    return false
  }

  userLimit.count++
  return true
}

// Track page visit
async function trackPageVisit(userId: string, data: {
  path: string
  pageName?: string
  referrer?: string
  sessionId?: string
  deviceId?: string
  query?: string
  enteredAt?: string
  exitedAt?: string
  duration?: number
}) {
  return prisma.userPageVisit.create({
    data: {
      userId,
      path: data.path,
      pageName: data.pageName,
      referrer: data.referrer,
      sessionId: data.sessionId,
      deviceId: data.deviceId,
      query: data.query,
      enteredAt: data.enteredAt ? new Date(data.enteredAt) : new Date(),
      exitedAt: data.exitedAt ? new Date(data.exitedAt) : null,
      duration: data.duration,
    }
  })
}

// Track feature usage
async function trackFeatureUsage(userId: string, data: {
  feature: string
  category: string
  action: string
  targetType?: string
  targetId?: string
  metadata?: Record<string, unknown>
}) {
  return prisma.userFeatureUsage.create({
    data: {
      userId,
      feature: data.feature,
      category: data.category,
      action: data.action,
      targetType: data.targetType,
      targetId: data.targetId,
      metadata: data.metadata as Prisma.InputJsonValue | undefined,
    }
  })
}

// Track search query
async function trackSearchQuery(userId: string, data: {
  query: string
  searchType: string
  filters?: Record<string, unknown>
  resultCount?: number
  clickedResults?: string[]
  pagePath?: string
}) {
  return prisma.userSearchQuery.create({
    data: {
      userId,
      query: data.query,
      searchType: data.searchType,
      filters: data.filters as Prisma.InputJsonValue | undefined,
      resultCount: data.resultCount,
      clickedResults: data.clickedResults || [],
      pagePath: data.pagePath,
    }
  })
}

// Update page visit exit time
async function updatePageVisitExit(visitId: string, exitedAt: string, duration: number) {
  return prisma.userPageVisit.update({
    where: { id: visitId },
    data: {
      exitedAt: new Date(exitedAt),
      duration,
    }
  })
}

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check rate limit
    if (!checkRateLimit(user.id)) {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { type, data, visitId } = body

    let result

    switch (type) {
      case 'page_visit':
        result = await trackPageVisit(user.id, data)
        return NextResponse.json({ success: true, visitId: result.id })

      case 'page_exit':
        if (!visitId) {
          return NextResponse.json(
            { success: false, error: 'visitId required for page_exit' },
            { status: 400 }
          )
        }
        result = await updatePageVisitExit(visitId, data.exitedAt, data.duration)
        return NextResponse.json({ success: true })

      case 'feature_usage':
        result = await trackFeatureUsage(user.id, data)
        return NextResponse.json({ success: true })

      case 'search_query':
        result = await trackSearchQuery(user.id, data)
        return NextResponse.json({ success: true, queryId: result.id })

      case 'batch':
        // Handle batch tracking for efficiency
        const results = await Promise.all(
          (data.events as Array<{ type: string; data: Record<string, unknown> }>).map(async (event) => {
            switch (event.type) {
              case 'page_visit':
                return trackPageVisit(user.id, event.data as Parameters<typeof trackPageVisit>[1])
              case 'feature_usage':
                return trackFeatureUsage(user.id, event.data as Parameters<typeof trackFeatureUsage>[1])
              case 'search_query':
                return trackSearchQuery(user.id, event.data as Parameters<typeof trackSearchQuery>[1])
              default:
                return null
            }
          })
        )
        return NextResponse.json({ success: true, count: results.filter(Boolean).length })

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid tracking type' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Error tracking activity:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to track activity' },
      { status: 500 }
    )
  }
}
