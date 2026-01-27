/**
 * SINGLE SHARE API
 *
 * PATCH  /api/share/[id] - Update share visibility
 * DELETE /api/share/[id] - Unshare a roadmap
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { createRequestLogger, getCorrelationId } from '@/lib/logger'
import {
  updateShareVisibility,
  unshareRoadmap,
} from '@/lib/sharing/share-service'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const log = createRequestLogger(request)
  const correlationId = getCorrelationId(request)

  try {
    // Rate limiting
    const rateLimitResult = await rateLimit(request, {
      ...RateLimitPresets.moderate,
      keyPrefix: 'share-update',
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

    // Parse request body
    const body = await request.json()
    const { isPublic } = body

    if (typeof isPublic !== 'boolean') {
      return NextResponse.json(
        { error: 'isPublic must be a boolean' },
        { status: 400 }
      )
    }

    // Update visibility
    const shared = await updateShareVisibility(id, user.id, isPublic)

    if (!shared) {
      return NextResponse.json(
        { error: 'Shared roadmap not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      shared: {
        id: shared.id,
        shareCode: shared.shareCode,
        isPublic: shared.isPublic,
        shareUrl: `${process.env.NEXT_PUBLIC_APP_URL || ''}/shared/${shared.shareCode}`,
      },
    }, {
      headers: {
        'x-correlation-id': correlationId,
        ...rateLimitResult.headers,
      },
    })

  } catch (error) {
    log.error('Failed to update share', error instanceof Error ? error : { error })
    return NextResponse.json(
      { error: 'Failed to update share' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const log = createRequestLogger(request)
  const correlationId = getCorrelationId(request)

  try {
    // Rate limiting
    const rateLimitResult = await rateLimit(request, {
      ...RateLimitPresets.moderate,
      keyPrefix: 'share-delete',
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

    // Unshare
    const deleted = await unshareRoadmap(id, user.id)

    if (!deleted) {
      return NextResponse.json(
        { error: 'Shared roadmap not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Roadmap unshared',
    }, {
      headers: {
        'x-correlation-id': correlationId,
        ...rateLimitResult.headers,
      },
    })

  } catch (error) {
    log.error('Failed to unshare roadmap', error instanceof Error ? error : { error })
    return NextResponse.json(
      { error: 'Failed to unshare roadmap' },
      { status: 500 }
    )
  }
}
