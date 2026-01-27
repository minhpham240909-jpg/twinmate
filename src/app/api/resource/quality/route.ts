/**
 * RESOURCE QUALITY API
 *
 * GET /api/resource/quality?subject=X - Get quality scores for a subject
 *
 * Returns resources with quality indicators for smart curation
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { createRequestLogger, getCorrelationId } from '@/lib/logger'

export async function GET(request: NextRequest) {
  const log = createRequestLogger(request)
  const correlationId = getCorrelationId(request)

  try {
    // Rate limiting
    const rateLimitResult = await rateLimit(request, RateLimitPresets.lenient)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: rateLimitResult.headers }
      )
    }

    const { searchParams } = new URL(request.url)
    const subject = searchParams.get('subject')

    if (!subject) {
      return NextResponse.json(
        { error: 'Subject parameter required' },
        { status: 400 }
      )
    }

    // Get top quality resources for this subject
    const resources = await prisma.resourceQuality.findMany({
      where: {
        subject: {
          contains: subject,
          mode: 'insensitive',
        },
        totalShown: { gte: 3 }, // Only show resources with enough data
      },
      orderBy: {
        qualityScore: 'desc',
      },
      take: 20,
      select: {
        resourceType: true,
        resourceTitle: true,
        platformId: true,
        qualityScore: true,
        totalClicks: true,
        helpfulVotes: true,
      },
    })

    // Format response with quality indicators
    const formattedResources = resources.map((r) => ({
      type: r.resourceType,
      title: r.resourceTitle,
      platformId: r.platformId,
      quality: {
        score: Math.round(r.qualityScore),
        badge: getQualityBadge(r.qualityScore, r.helpfulVotes),
        helpfulCount: r.helpfulVotes,
      },
    }))

    log.info('Resource quality fetched', {
      subject,
      resultCount: formattedResources.length,
    })

    return NextResponse.json({
      success: true,
      subject,
      resources: formattedResources,
    }, {
      headers: {
        'x-correlation-id': correlationId,
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
      },
    })

  } catch (error) {
    log.error('Failed to get resource quality', error instanceof Error ? error : { error })
    return NextResponse.json(
      { error: 'Failed to get resource quality' },
      { status: 500 }
    )
  }
}

/**
 * Get quality badge based on score and votes
 */
function getQualityBadge(score: number, helpfulVotes: number): string | null {
  if (score >= 70 && helpfulVotes >= 10) {
    return 'top_pick' // ⭐ Top Pick
  }
  if (score >= 60 && helpfulVotes >= 5) {
    return 'recommended' // 👍 Recommended
  }
  if (helpfulVotes >= 3) {
    return 'helpful' // Helpful
  }
  return null
}
