import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import logger from '@/lib/logger'

// Schema for updating a focus session
const updateFocusSessionSchema = z.object({
  status: z.enum(['COMPLETED', 'ABANDONED']).optional(),
  actualMinutes: z.number().min(0).optional(),
  label: z.string().optional(),
  notes: z.string().optional(),
  // AI task fields
  taskType: z.string().optional(),
  taskSubject: z.string().optional(),
  taskPrompt: z.string().optional(),
  taskDifficulty: z.string().optional(),
  userResponse: z.string().optional(),
  taskCompleted: z.boolean().optional(),
})

/**
 * GET /api/focus/[sessionId]
 * Get a specific focus session
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sessionId } = await params

    const session = await prisma.focusSession.findFirst({
      where: {
        id: sessionId,
        userId: user.id,
      },
    })

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      session,
    })
  } catch (error) {
    logger.error('Error fetching focus session', { error })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/focus/[sessionId]
 * Update a focus session (complete, abandon, add notes)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sessionId } = await params
    const body = await request.json()
    const validation = updateFocusSessionSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.issues },
        { status: 400 }
      )
    }

    // Find the session
    const existingSession = await prisma.focusSession.findFirst({
      where: {
        id: sessionId,
        userId: user.id,
      },
    })

    if (!existingSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const { status, actualMinutes, label, notes, taskType, taskSubject, taskPrompt, taskDifficulty, userResponse, taskCompleted } = validation.data

    // Build update data
    const updateData: Record<string, unknown> = {}

    if (status) {
      updateData.status = status
      updateData.completedAt = new Date()
    }

    if (actualMinutes !== undefined) {
      updateData.actualMinutes = actualMinutes
    }

    if (label !== undefined) {
      updateData.label = label
    }

    if (notes !== undefined) {
      updateData.notes = notes
    }

    // AI task fields
    if (taskType !== undefined) {
      updateData.taskType = taskType
    }

    if (taskSubject !== undefined) {
      updateData.taskSubject = taskSubject
    }

    if (taskPrompt !== undefined) {
      updateData.taskPrompt = taskPrompt
    }

    if (taskDifficulty !== undefined) {
      updateData.taskDifficulty = taskDifficulty
    }

    if (userResponse !== undefined) {
      updateData.userResponse = userResponse
    }

    if (taskCompleted !== undefined) {
      updateData.taskCompleted = taskCompleted
    }

    // Update the session
    const updatedSession = await prisma.focusSession.update({
      where: { id: sessionId },
      data: updateData,
    })

    // Award points and update streak on completion
    if (status === 'COMPLETED') {
      const completedMinutes = actualMinutes || existingSession.durationMinutes
      
      // Points calculation: 10 XP per minute of focus (minimum 10 XP)
      const pointsEarned = Math.max(10, completedMinutes * 10)
      
      // Update profile with points
      await prisma.profile.update({
        where: { userId: user.id },
        data: {
          totalPoints: { increment: pointsEarned },
          lastStudyDate: new Date(),
        },
      })
      
      logger.info('Focus session completed', {
        data: {
          sessionId,
          userId: user.id,
          durationMinutes: existingSession.durationMinutes,
          actualMinutes: completedMinutes,
          pointsEarned,
        },
      })
    }

    return NextResponse.json({
      success: true,
      session: updatedSession,
    })
  } catch (error) {
    logger.error('Error updating focus session', { error })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/focus/[sessionId]
 * Delete a focus session (only if abandoned or for cleanup)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sessionId } = await params

    // Find and delete the session
    const session = await prisma.focusSession.findFirst({
      where: {
        id: sessionId,
        userId: user.id,
      },
    })

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    await prisma.focusSession.delete({
      where: { id: sessionId },
    })

    return NextResponse.json({
      success: true,
      message: 'Session deleted',
    })
  } catch (error) {
    logger.error('Error deleting focus session', { error })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
