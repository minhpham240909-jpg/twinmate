import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// SECURITY: Validation schema for whiteboard updates
const updateWhiteboardSchema = z.object({
  snapshotUrl: z.string().url('Invalid snapshot URL').max(2048, 'Snapshot URL too long').optional().nullable(),
  thumbnailUrl: z.string().url('Invalid thumbnail URL').max(2048, 'Thumbnail URL too long').optional().nullable(),
})

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params

    // Verify user is authenticated
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if session exists and user is a participant
    const session = await prisma.studySession.findUnique({
      where: { id: sessionId },
      include: {
        participants: {
          where: { userId: user.id }
        }
      }
    })

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    // Only participants can access the whiteboard
    if (session.participants.length === 0) {
      return NextResponse.json(
        { error: 'You are not a participant in this session' },
        { status: 403 }
      )
    }

    // Get or create whiteboard for this session
    let whiteboard = await prisma.sessionWhiteboard.findUnique({
      where: { sessionId }
    })

    // If whiteboard doesn't exist, create it
    if (!whiteboard) {
      whiteboard = await prisma.sessionWhiteboard.create({
        data: {
          sessionId,
          title: `${session.title} - Whiteboard`,
          description: 'Collaborative whiteboard for this study session',
          lastEditedBy: user.id
        }
      })
    }

    return NextResponse.json({
      success: true,
      whiteboard
    })

  } catch (error: any) {
    console.error('[Whiteboard API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to load whiteboard', details: error?.message },
      { status: 500 }
    )
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params

    // Verify user is authenticated
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is a participant
    const session = await prisma.studySession.findUnique({
      where: { id: sessionId },
      include: {
        participants: {
          where: { userId: user.id }
        }
      }
    })

    if (!session || session.participants.length === 0) {
      return NextResponse.json(
        { error: 'Not authorized to edit this whiteboard' },
        { status: 403 }
      )
    }

    const body = await req.json()

    // SECURITY: Validate URLs to prevent XSS/SSRF attacks
    const validation = updateWhiteboardSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid whiteboard data',
          details: validation.error.format()
        },
        { status: 400 }
      )
    }

    const { snapshotUrl, thumbnailUrl } = validation.data

    // Update whiteboard with new snapshot
    const whiteboard = await prisma.sessionWhiteboard.update({
      where: { sessionId },
      data: {
        snapshotUrl,
        thumbnailUrl,
        lastEditedBy: user.id,
        lastSyncedAt: new Date(),
        version: { increment: 1 }
      }
    })

    return NextResponse.json({
      success: true,
      whiteboard
    })

  } catch (error: any) {
    console.error('[Whiteboard API] Update error:', error)
    return NextResponse.json(
      { error: 'Failed to update whiteboard', details: error?.message },
      { status: 500 }
    )
  }
}
