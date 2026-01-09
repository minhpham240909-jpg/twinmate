/**
 * Activity Tracking API
 * Records user page visits, feature usage, and search queries
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { sanitizeSearchQuery } from '@/lib/security/search-sanitization'

// SECURITY: Content limits for analytics data
const MAX_PATH_LENGTH = 500
const MAX_PAGE_NAME_LENGTH = 200
const MAX_FEATURE_LENGTH = 100
const MAX_CATEGORY_LENGTH = 100
const MAX_ACTION_LENGTH = 100
const MAX_SEARCH_TYPE_LENGTH = 50

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

// SECURITY: Sanitize string with max length
function sanitizeString(str: string | undefined | null, maxLength: number): string | undefined {
  if (!str || typeof str !== 'string') return undefined
  return str.trim().slice(0, maxLength) || undefined
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
  // SECURITY: Sanitize all string inputs
  return prisma.userPageVisit.create({
    data: {
      userId,
      path: sanitizeString(data.path, MAX_PATH_LENGTH) || '/',
      pageName: sanitizeString(data.pageName, MAX_PAGE_NAME_LENGTH),
      referrer: sanitizeString(data.referrer, MAX_PATH_LENGTH),
      sessionId: sanitizeString(data.sessionId, 100),
      deviceId: sanitizeString(data.deviceId, 100),
      query: sanitizeString(data.query, 200),
      enteredAt: data.enteredAt ? new Date(data.enteredAt) : new Date(),
      exitedAt: data.exitedAt ? new Date(data.exitedAt) : null,
      duration: typeof data.duration === 'number' ? Math.min(data.duration, 86400000) : undefined, // Max 24 hours
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
  // SECURITY: Sanitize all string inputs
  return prisma.userFeatureUsage.create({
    data: {
      userId,
      feature: sanitizeString(data.feature, MAX_FEATURE_LENGTH) || 'unknown',
      category: sanitizeString(data.category, MAX_CATEGORY_LENGTH) || 'unknown',
      action: sanitizeString(data.action, MAX_ACTION_LENGTH) || 'unknown',
      targetType: sanitizeString(data.targetType, MAX_CATEGORY_LENGTH),
      targetId: sanitizeString(data.targetId, 100),
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
  // SECURITY: Sanitize search query using dedicated sanitization
  const sanitizedQuery = sanitizeSearchQuery(data.query)

  // SECURITY: Sanitize clicked results (limit count and length)
  const sanitizedClickedResults = (data.clickedResults || [])
    .filter((r): r is string => typeof r === 'string')
    .slice(0, 20) // Max 20 clicked results
    .map(r => r.trim().slice(0, 100)) // Max 100 chars each

  return prisma.userSearchQuery.create({
    data: {
      userId,
      query: sanitizedQuery.sanitized || data.query?.slice(0, 200) || '',
      searchType: sanitizeString(data.searchType, MAX_SEARCH_TYPE_LENGTH) || 'unknown',
      filters: data.filters as Prisma.InputJsonValue | undefined,
      resultCount: typeof data.resultCount === 'number' ? Math.min(data.resultCount, 10000) : undefined,
      clickedResults: sanitizedClickedResults,
      pagePath: sanitizeString(data.pagePath, MAX_PATH_LENGTH),
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
        // PERF: Handle batch tracking with createMany for efficiency (avoids N+1)
        // SECURITY: Limit batch size to prevent abuse
        const MAX_BATCH_SIZE = 50
        const rawEvents = data.events as Array<{ type: string; data: Record<string, unknown> }>
        const events = rawEvents?.slice(0, MAX_BATCH_SIZE) || []

        // Group events by type for batch insertion
        const pageVisitEvents = events.filter(e => e.type === 'page_visit')
        const featureUsageEvents = events.filter(e => e.type === 'feature_usage')
        const searchQueryEvents = events.filter(e => e.type === 'search_query')

        // SECURITY: Prepare batch data with sanitization
        const pageVisitData = pageVisitEvents.map(event => {
          const d = event.data as Parameters<typeof trackPageVisit>[1]
          return {
            userId: user.id,
            path: sanitizeString(d.path, MAX_PATH_LENGTH) || '/',
            pageName: sanitizeString(d.pageName, MAX_PAGE_NAME_LENGTH),
            referrer: sanitizeString(d.referrer, MAX_PATH_LENGTH),
            sessionId: sanitizeString(d.sessionId, 100),
            deviceId: sanitizeString(d.deviceId, 100),
            query: sanitizeString(d.query, 200),
            enteredAt: d.enteredAt ? new Date(d.enteredAt) : new Date(),
            exitedAt: d.exitedAt ? new Date(d.exitedAt) : null,
            duration: typeof d.duration === 'number' ? Math.min(d.duration, 86400000) : undefined,
          }
        })

        const featureUsageData = featureUsageEvents.map(event => {
          const d = event.data as Parameters<typeof trackFeatureUsage>[1]
          return {
            userId: user.id,
            feature: sanitizeString(d.feature, MAX_FEATURE_LENGTH) || 'unknown',
            category: sanitizeString(d.category, MAX_CATEGORY_LENGTH) || 'unknown',
            action: sanitizeString(d.action, MAX_ACTION_LENGTH) || 'unknown',
            targetType: sanitizeString(d.targetType, MAX_CATEGORY_LENGTH),
            targetId: sanitizeString(d.targetId, 100),
            metadata: d.metadata as Prisma.InputJsonValue | undefined,
          }
        })

        const searchQueryData = searchQueryEvents.map(event => {
          const d = event.data as Parameters<typeof trackSearchQuery>[1]
          const sanitizedQ = sanitizeSearchQuery(d.query)
          const sanitizedClicked = (d.clickedResults || [])
            .filter((r): r is string => typeof r === 'string')
            .slice(0, 20)
            .map(r => r.trim().slice(0, 100))
          return {
            userId: user.id,
            query: sanitizedQ.sanitized || d.query?.slice(0, 200) || '',
            searchType: sanitizeString(d.searchType, MAX_SEARCH_TYPE_LENGTH) || 'unknown',
            filters: d.filters as Prisma.InputJsonValue | undefined,
            resultCount: typeof d.resultCount === 'number' ? Math.min(d.resultCount, 10000) : undefined,
            clickedResults: sanitizedClicked,
            pagePath: sanitizeString(d.pagePath, MAX_PATH_LENGTH),
          }
        })

        // Execute batch inserts in a single transaction (1-3 queries instead of N)
        const batchResults = await prisma.$transaction([
          ...(pageVisitData.length > 0
            ? [prisma.userPageVisit.createMany({ data: pageVisitData })]
            : []),
          ...(featureUsageData.length > 0
            ? [prisma.userFeatureUsage.createMany({ data: featureUsageData })]
            : []),
          ...(searchQueryData.length > 0
            ? [prisma.userSearchQuery.createMany({ data: searchQueryData })]
            : []),
        ])

        const totalCount = batchResults.reduce((sum, r) => sum + (r?.count || 0), 0)
        return NextResponse.json({ success: true, count: totalCount })

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
