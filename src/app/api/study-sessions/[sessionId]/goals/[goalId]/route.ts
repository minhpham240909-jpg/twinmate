import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

// PATCH - Toggle goal completion
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string; goalId: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sessionId, goalId } = await params

    // Verify user is a participant
    const participant = await prisma.sessionParticipant.findFirst({
      where: {
        sessionId,
        userId: user.id,
        status: 'JOINED',
      },
    })

    if (!participant) {
      return NextResponse.json({ error: 'Not a participant' }, { status: 403 })
    }

    // Get current goal
    const currentGoal = await prisma.sessionGoal.findUnique({
      where: { id: goalId },
    })

    if (!currentGoal || currentGoal.sessionId !== sessionId) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
    }

    // Toggle completion
    const goal = await prisma.sessionGoal.update({
      where: { id: goalId },
      data: {
        isCompleted: !currentGoal.isCompleted,
        completedAt: !currentGoal.isCompleted ? new Date() : null,
      },
    })

    return NextResponse.json({
      success: true,
      goal,
    })
  } catch (error) {
    console.error('Error updating goal:', error)
    return NextResponse.json(
      { error: 'Failed to update goal' },
      { status: 500 }
    )
  }
}

// DELETE - Delete a goal
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string; goalId: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sessionId, goalId } = await params

    // Verify user is a participant or host
    const participant = await prisma.sessionParticipant.findFirst({
      where: {
        sessionId,
        userId: user.id,
        status: 'JOINED',
      },
    })

    if (!participant) {
      return NextResponse.json({ error: 'Not a participant' }, { status: 403 })
    }

    // Verify goal exists and belongs to session
    const goal = await prisma.sessionGoal.findUnique({
      where: { id: goalId },
    })

    if (!goal || goal.sessionId !== sessionId) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
    }

    // Delete goal
    await prisma.sessionGoal.delete({
      where: { id: goalId },
    })

    return NextResponse.json({
      success: true,
      message: 'Goal deleted',
    })
  } catch (error) {
    console.error('Error deleting goal:', error)
    return NextResponse.json(
      { error: 'Failed to delete goal' },
      { status: 500 }
    )
  }
}
