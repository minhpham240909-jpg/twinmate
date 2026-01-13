import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import logger from '@/lib/logger'

/**
 * POST /api/focus/[sessionId]/join
 * Join/Accept invitation to a quick focus session
 *
 * Features:
 * - Real-time joining without page refresh
 * - Automatic status update from INVITED to JOINED
 * - Security checks to prevent unauthorized access
 * - Prevents duplicate joins
 */
export async function POST(
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

    // Verify the focus session exists and is still active
    const focusSession = await prisma.focusSession.findFirst({
      where: {
        id: sessionId,
        status: 'ACTIVE', // Can only join active sessions
      },
    })

    if (!focusSession) {
      return NextResponse.json(
        { error: 'Session not found or no longer active' },
        { status: 404 }
      )
    }

    // Check if user was invited to this session
    const invitation = await prisma.focusSessionParticipant.findUnique({
      where: {
        focusSessionId_userId: {
          focusSessionId: sessionId,
          userId: user.id,
        },
      },
    })

    if (!invitation) {
      return NextResponse.json(
        { error: 'You were not invited to this session' },
        { status: 403 }
      )
    }

    // Check if already joined
    if (invitation.status === 'JOINED') {
      return NextResponse.json({
        success: true,
        message: 'Already joined',
        alreadyJoined: true,
      })
    }

    // Check if declined
    if (invitation.status === 'DECLINED') {
      return NextResponse.json(
        { error: 'You declined this invitation' },
        { status: 400 }
      )
    }

    // Update invitation status to JOINED
    const updatedParticipant = await prisma.focusSessionParticipant.update({
      where: {
        focusSessionId_userId: {
          focusSessionId: sessionId,
          userId: user.id,
        },
      },
      data: {
        status: 'JOINED',
        joinedAt: new Date(),
      },
    })

    logger.info('User joined focus session', {
      data: {
        sessionId,
        userId: user.id,
        participantId: updatedParticipant.id,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Successfully joined the session',
      participant: {
        id: updatedParticipant.id,
        status: updatedParticipant.status,
        joinedAt: updatedParticipant.joinedAt,
      },
    })
  } catch (error) {
    logger.error('Error joining focus session', { error })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/focus/[sessionId]/join
 * Decline invitation to a quick focus session
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

    // Check if user has an invitation
    const invitation = await prisma.focusSessionParticipant.findUnique({
      where: {
        focusSessionId_userId: {
          focusSessionId: sessionId,
          userId: user.id,
        },
      },
    })

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 }
      )
    }

    // Update invitation status to DECLINED
    await prisma.focusSessionParticipant.update({
      where: {
        focusSessionId_userId: {
          focusSessionId: sessionId,
          userId: user.id,
        },
      },
      data: {
        status: 'DECLINED',
      },
    })

    logger.info('User declined focus session invitation', {
      data: {
        sessionId,
        userId: user.id,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Invitation declined',
    })
  } catch (error) {
    logger.error('Error declining focus session invitation', { error })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
