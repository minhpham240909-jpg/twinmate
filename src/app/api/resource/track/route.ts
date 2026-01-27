/**
 * RESOURCE TRACKING API
 *
 * POST /api/resource/track - Track resource click or helpfulness vote
 *
 * This powers smart resource curation by tracking:
 * - Which resources users click
 * - Which resources users find helpful
 * - Aggregating quality scores for recommendations
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { createRequestLogger, getCorrelationId } from '@/lib/logger'

interface TrackRequest {
  action: 'click' | 'helpful' | 'not_helpful'
  resourceType: string
  resourceTitle: string
  platformId?: string
  url?: string
  searchQuery?: string
  subject?: string
  stepTitle?: string
}

export async function POST(request: NextRequest) {
  const log = createRequestLogger(request)
  const correlationId = getCorrelationId(request)

  try {
    // Rate limiting - lenient for tracking
    const rateLimitResult = await rateLimit(request, RateLimitPresets.lenient)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: rateLimitResult.headers }
      )
    }

    // Auth check (optional - allow anonymous tracking)
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Parse request
    const body: TrackRequest = await request.json()

    if (!body.action || !body.resourceType || !body.resourceTitle) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Find or create engagement record
    const engagement = await prisma.resourceEngagement.upsert({
      where: {
        id: `${user?.id || 'anon'}-${body.resourceTitle}-${body.platformId || 'unknown'}`.slice(0, 36),
      },
      create: {
        id: `${user?.id || 'anon'}-${body.resourceTitle}-${body.platformId || 'unknown'}`.slice(0, 36),
        resourceType: body.resourceType,
        resourceTitle: body.resourceTitle,
        platformId: body.platformId,
        url: body.url,
        searchQuery: body.searchQuery,
        subject: body.subject,
        stepTitle: body.stepTitle,
        userId: user?.id,
        clicked: body.action === 'click',
        clickedAt: body.action === 'click' ? new Date() : undefined,
        helpfulVote: body.action === 'helpful' ? true : body.action === 'not_helpful' ? false : undefined,
        votedAt: body.action !== 'click' ? new Date() : undefined,
      },
      update: {
        clicked: body.action === 'click' ? true : undefined,
        clickedAt: body.action === 'click' ? new Date() : undefined,
        helpfulVote: body.action === 'helpful' ? true : body.action === 'not_helpful' ? false : undefined,
        votedAt: body.action !== 'click' ? new Date() : undefined,
      },
    })

    // Update aggregated quality score (async, non-blocking)
    updateResourceQuality(body).catch((error) => {
      log.warn('Failed to update resource quality', { error })
    })

    log.info('Resource tracked', {
      action: body.action,
      resourceTitle: body.resourceTitle,
      platformId: body.platformId,
      userId: user?.id || 'anonymous',
    })

    return NextResponse.json({
      success: true,
      engagementId: engagement.id,
    }, {
      headers: { 'x-correlation-id': correlationId },
    })

  } catch (error) {
    log.error('Failed to track resource', error instanceof Error ? error : { error })
    return NextResponse.json(
      { error: 'Failed to track resource' },
      { status: 500 }
    )
  }
}

/**
 * Update aggregated resource quality score
 */
async function updateResourceQuality(data: TrackRequest): Promise<void> {
  if (!data.subject) return

  const existing = await prisma.resourceQuality.findFirst({
    where: {
      resourceTitle: data.resourceTitle,
      platformId: data.platformId || null,
      subject: data.subject,
    },
  })

  if (existing) {
    // Update existing record
    const updates: {
      totalShown?: { increment: number }
      totalClicks?: { increment: number }
      helpfulVotes?: { increment: number }
      notHelpfulVotes?: { increment: number }
    } = {}

    if (data.action === 'click') {
      updates.totalClicks = { increment: 1 }
    } else if (data.action === 'helpful') {
      updates.helpfulVotes = { increment: 1 }
    } else if (data.action === 'not_helpful') {
      updates.notHelpfulVotes = { increment: 1 }
    }

    const updated = await prisma.resourceQuality.update({
      where: { id: existing.id },
      data: updates,
    })

    // Recalculate quality score
    const clickRate = updated.totalShown > 0 ? updated.totalClicks / updated.totalShown : 0
    const helpfulRate = (updated.helpfulVotes + updated.notHelpfulVotes) > 0
      ? updated.helpfulVotes / (updated.helpfulVotes + updated.notHelpfulVotes)
      : 0.5

    // Score formula: 40% click rate + 60% helpful rate (scaled to 0-100)
    const qualityScore = (clickRate * 40) + (helpfulRate * 60)

    await prisma.resourceQuality.update({
      where: { id: existing.id },
      data: { qualityScore },
    })
  } else {
    // Create new record
    await prisma.resourceQuality.create({
      data: {
        resourceType: data.resourceType,
        resourceTitle: data.resourceTitle,
        platformId: data.platformId,
        subject: data.subject,
        totalShown: 1,
        totalClicks: data.action === 'click' ? 1 : 0,
        helpfulVotes: data.action === 'helpful' ? 1 : 0,
        notHelpfulVotes: data.action === 'not_helpful' ? 1 : 0,
        qualityScore: 50, // Start at neutral
      },
    })
  }
}
