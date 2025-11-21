import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import logger from '@/lib/logger'

/**
 * GET /api/whiteboard/load?sessionId=xxx
 * Load whiteboard state for a study session
 */
export async function GET(request: NextRequest) {
  // Rate limit: 30 loads per minute
  const rateLimitResult = await rateLimit(request, {
    max: 30,
    windowMs: 60 * 1000,
    keyPrefix: 'whiteboard-load',
  })
  
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many load requests' },
      { status: 429, headers: rateLimitResult.headers }
    )
  }

  try {
    // Authenticate user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 })
    }

    // Verify user is a participant in this session
    const participation = await prisma.sessionParticipant.findFirst({
      where: {
        sessionId,
        userId: user.id,
      },
    })

    if (!participation) {
      return NextResponse.json(
        { error: 'You must be a participant in this session' },
        { status: 403 }
      )
    }

    // Load whiteboard
    const whiteboard = await prisma.sessionWhiteboard.findUnique({
      where: { sessionId },
      select: {
        id: true,
        sessionId: true,
        title: true,
        description: true,
        snapshotUrl: true,
        thumbnailUrl: true,
        lastSyncedAt: true,
        lastEditedBy: true,
        version: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!whiteboard) {
      // No whiteboard exists yet - return empty state
      return NextResponse.json({
        success: true,
        exists: false,
        whiteboard: null,
      })
    }

    // If snapshotUrl exists, you would fetch the actual canvas data from Supabase Storage
    // For now, return metadata
    // In a real-time setup, the actual drawing data would be synced via Supabase Realtime

    logger.info('Whiteboard loaded', {
      sessionId,
      userId: user.id,
      version: whiteboard.version,
    })

    return NextResponse.json({
      success: true,
      exists: true,
      whiteboard: {
        id: whiteboard.id,
        sessionId: whiteboard.sessionId,
        title: whiteboard.title,
        description: whiteboard.description,
        snapshotUrl: whiteboard.snapshotUrl,
        thumbnailUrl: whiteboard.thumbnailUrl,
        lastSyncedAt: whiteboard.lastSyncedAt,
        lastEditedBy: whiteboard.lastEditedBy,
        version: whiteboard.version,
        createdAt: whiteboard.createdAt,
        updatedAt: whiteboard.updatedAt,
      },
    })
  } catch (error) {
    logger.error('Error loading whiteboard', error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: 'Failed to load whiteboard' },
      { status: 500 }
    )
  }
}
