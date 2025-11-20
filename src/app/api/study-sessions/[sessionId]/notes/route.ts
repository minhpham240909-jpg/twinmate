// API Routes: Session Notes (GET, POST/PATCH for update)
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { CONTENT_LIMITS } from '@/lib/constants'

// SECURITY: Enforce reasonable content size limits to prevent memory exhaustion
const updateNoteSchema = z.object({
  title: z.string().min(1, 'Title is required').max(CONTENT_LIMITS.SESSION_TITLE_MAX).optional(),
  content: z.string().max(CONTENT_LIMITS.NOTES_MAX_LENGTH, 'Note content too large').optional(),
})

// GET /api/study-sessions/[sessionId]/notes
// Get the shared note for this session
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

    // Get or create the session note
    let note = await prisma.sessionNote.findUnique({
      where: { sessionId },
    })

    // If no note exists, create an empty one
    if (!note) {
      note = await prisma.sessionNote.create({
        data: {
          sessionId,
          title: 'Untitled Note',
          content: '',
          lastEditedBy: user.id,
          version: 1,
        },
      })
    }

    return NextResponse.json({ note })
  } catch (error) {
    console.error('[Notes GET] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch note',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// POST /api/study-sessions/[sessionId]/notes
// Update the shared note (create if doesn't exist)
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
    const validation = updateNoteSchema.safeParse(body)

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

    // Update or create note
    const note = await prisma.sessionNote.upsert({
      where: { sessionId },
      update: {
        ...updateData,
        lastEditedBy: user.id,
        lastEditedAt: new Date(),
        version: { increment: 1 },
      },
      create: {
        sessionId,
        title: updateData.title || 'Untitled Note',
        content: updateData.content || '',
        lastEditedBy: user.id,
        version: 1,
      },
    })

    console.log(`[Notes POST] Updated note for session ${sessionId} by user ${user.id}`)

    return NextResponse.json({
      success: true,
      note,
    })
  } catch (error) {
    console.error('[Notes POST] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to update note',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
