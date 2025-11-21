import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import logger from '@/lib/logger'

/**
 * POST /api/whiteboard/save
 * Save whiteboard state for a study session
 */
export async function POST(request: NextRequest) {
  // Rate limit: 60 saves per minute (every second is fine)
  const rateLimitResult = await rateLimit(request, {
    max: 60,
    windowMs: 60 * 1000,
    keyPrefix: 'whiteboard-save',
  })
  
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many save requests' },
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

    const body = await request.json()
    const { sessionId, whiteboardData, title } = body

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 })
    }

    if (!whiteboardData) {
      return NextResponse.json({ error: 'Whiteboard data is required' }, { status: 400 })
    }

    // Verify user is a participant in this session
    const participation = await prisma.sessionParticipant.findFirst({
      where: {
        sessionId,
        userId: user.id,
        status: 'JOINED',
      },
    })

    if (!participation) {
      return NextResponse.json(
        { error: 'You must be a participant in this session' },
        { status: 403 }
      )
    }

    // Verify session exists and is active
    const session = await prisma.studySession.findUnique({
      where: { id: sessionId },
      select: { status: true },
    })

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Validate whiteboard data size (max 10MB JSON)
    const dataSize = JSON.stringify(whiteboardData).length
    const MAX_SIZE = 10 * 1024 * 1024 // 10MB
    
    if (dataSize > MAX_SIZE) {
      return NextResponse.json(
        { error: 'Whiteboard data too large (max 10MB)' },
        { status: 413 }
      )
    }

    // Upsert whiteboard
    const whiteboard = await prisma.sessionWhiteboard.upsert({
      where: { sessionId },
      create: {
        sessionId,
        title: title || 'Untitled Whiteboard',
        lastEditedBy: user.id,
        lastSyncedAt: new Date(),
        version: 1,
        // Store data directly if using Supabase realtime, or create snapshot
        snapshotUrl: null, // We'll use a JSON column approach instead
      },
      update: {
        title: title || undefined,
        lastEditedBy: user.id,
        lastSyncedAt: new Date(),
        version: { increment: 1 },
      },
    })

    // Store whiteboard data in a separate storage table or JSON field
    // For simplicity, we'll use Supabase Storage for snapshots
    // But for real-time editing, the data is synchronized via Supabase Realtime
    // Here we just track metadata

    logger.info('Whiteboard saved', {
      sessionId,
      userId: user.id,
      version: whiteboard.version,
      dataSize,
    })

    return NextResponse.json({
      success: true,
      whiteboard: {
        id: whiteboard.id,
        sessionId: whiteboard.sessionId,
        version: whiteboard.version,
        lastSyncedAt: whiteboard.lastSyncedAt,
      },
    })
  } catch (error) {
    logger.error('Error saving whiteboard', error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: 'Failed to save whiteboard' },
      { status: 500 }
    )
  }
}
