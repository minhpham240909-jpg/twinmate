// API Routes: Private Session Notes (GET, POST/PATCH for update)
// Each user has their own private notes - only visible to themselves
// Notes can be shared to screen but not accessed by other users via API
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
// Get the current user's private note for this session
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

    // Get the user's private note for this session
    let note = await prisma.sessionNote.findUnique({
      where: {
        sessionId_userId: {
          sessionId,
          userId: user.id,
        },
      },
    })

    // If no note exists, create an empty one for this user
    if (!note) {
      note = await prisma.sessionNote.create({
        data: {
          sessionId,
          userId: user.id,
          title: 'My Notes',
          content: '',
          version: 1,
        },
      })
    }

    return NextResponse.json({
      note,
      isPrivate: true, // Indicate to frontend that notes are private
    })
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
// Update the current user's private note (create if doesn't exist)
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

    // Update or create the user's private note
    const note = await prisma.sessionNote.upsert({
      where: {
        sessionId_userId: {
          sessionId,
          userId: user.id,
        },
      },
      update: {
        ...updateData,
        lastEditedAt: new Date(),
        version: { increment: 1 },
      },
      create: {
        sessionId,
        userId: user.id,
        title: updateData.title || 'My Notes',
        content: updateData.content || '',
        version: 1,
      },
    })

    console.log(`[Notes POST] Updated private note for session ${sessionId} by user ${user.id}`)

    return NextResponse.json({
      success: true,
      note,
      isPrivate: true,
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
