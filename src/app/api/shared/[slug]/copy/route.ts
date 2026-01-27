/**
 * COPY SHARED ROADMAP API
 *
 * POST /api/shared/[slug]/copy - Copy a shared roadmap to user's account
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { createRequestLogger, getCorrelationId } from '@/lib/logger'
import { copyRoadmap } from '@/lib/sharing/share-service'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const log = createRequestLogger(request)
  const correlationId = getCorrelationId(request)

  try {
    // Rate limiting (stricter for copy action)
    const rateLimitResult = await rateLimit(request, {
      ...RateLimitPresets.strict,
      keyPrefix: 'shared-copy',
    })

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: rateLimitResult.headers }
      )
    }

    // Auth required
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    log.info('Copying shared roadmap', {
      userId: user.id,
      slug,
    })

    // Copy the roadmap
    const newRoadmapId = await copyRoadmap(slug, user.id)

    return NextResponse.json({
      success: true,
      roadmapId: newRoadmapId,
      message: 'Roadmap copied to your account',
    }, {
      status: 201,
      headers: {
        'x-correlation-id': correlationId,
        ...rateLimitResult.headers,
      },
    })

  } catch (error) {
    log.error('Failed to copy roadmap', error instanceof Error ? error : { error })

    if (error instanceof Error) {
      if (error.message === 'Shared roadmap not found') {
        return NextResponse.json(
          { error: 'Shared roadmap not found' },
          { status: 404 }
        )
      }
      if (error.message === 'Cannot copy your own roadmap') {
        return NextResponse.json(
          { error: 'Cannot copy your own roadmap' },
          { status: 400 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Failed to copy roadmap' },
      { status: 500 }
    )
  }
}
