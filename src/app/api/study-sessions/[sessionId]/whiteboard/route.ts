// API Routes: Session Whiteboard (GET, POST for update)
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateWhiteboardSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(500).optional(),
  snapshotUrl: z.string().url().optional(),
  thumbnailUrl: z.string().url().optional(),
})

// GET /api/study-sessions/[sessionId]/whiteboard
// Get the whiteboard for this session
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await context.params

    // Verify authentication
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify user is a participant in the session
    const participant = await prisma.sessionParticipant.findFirst({
      where: {
        sessionId,
        userId: user.id,
      },
    })

    if (!participant) {
      return NextResponse.json(
        { error: 'Not a participant in this session' },
        { status: 403 }
      )
    }

    // Get or create the session whiteboard
    let whiteboard = await prisma.sessionWhiteboard.findUnique({
      where: { sessionId },
      include: {
        versions: {
          orderBy: { createdAt: 'desc' },
          take: 10, // Last 10 versions
        },
      },
    })

    // If no whiteboard exists, create an empty one
    if (!whiteboard) {
      whiteboard = await prisma.sessionWhiteboard.create({
        data: {
          sessionId,
          title: 'Untitled Whiteboard',
          lastEditedBy: user.id,
          version: 1,
        },
        include: {
          versions: true,
        },
      })
    }

    return NextResponse.json({ whiteboard })
  } catch (error) {
    console.error('[Whiteboard GET] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch whiteboard',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// POST /api/study-sessions/[sessionId]/whiteboard
// Update the whiteboard (create if doesn't exist)
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await context.params

    // Verify authentication
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify user is a participant in the session
    const participant = await prisma.sessionParticipant.findFirst({
      where: {
        sessionId,
        userId: user.id,
      },
    })

    if (!participant) {
      return NextResponse.json(
        { error: 'Not a participant in this session' },
        { status: 403 }
      )
    }

    // Validate request body
    const body = await request.json()
    const validation = updateWhiteboardSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.format() },
        { status: 400 }
      )
    }

    const updateData = validation.data

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      )
    }

    // Update or create whiteboard
    const whiteboard = await prisma.sessionWhiteboard.upsert({
      where: { sessionId },
      update: {
        ...updateData,
        lastEditedBy: user.id,
        lastSyncedAt: new Date(),
        version: { increment: 1 },
      },
      create: {
        sessionId,
        title: updateData.title || 'Untitled Whiteboard',
        description: updateData.description,
        snapshotUrl: updateData.snapshotUrl,
        thumbnailUrl: updateData.thumbnailUrl,
        lastEditedBy: user.id,
        version: 1,
      },
    })

    // Create version snapshot if snapshotUrl was provided
    if (updateData.snapshotUrl) {
      await prisma.sessionWhiteboardVersion.create({
        data: {
          whiteboardId: whiteboard.id,
          version: whiteboard.version,
          snapshotUrl: updateData.snapshotUrl,
          createdBy: user.id,
        },
      })
    }

    console.log(`[Whiteboard POST] Updated whiteboard for session ${sessionId} by user ${user.id}`)

    return NextResponse.json({
      success: true,
      whiteboard,
    })
  } catch (error) {
    console.error('[Whiteboard POST] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to update whiteboard',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
