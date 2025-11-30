import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { enforceUserAccess } from '@/lib/security/checkUserBan'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    // Authenticate user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is banned or deactivated
    const accessCheck = await enforceUserAccess(user.id)
    if (!accessCheck.allowed) {
      return NextResponse.json(accessCheck.errorResponse, { status: 403 })
    }

    const { sessionId } = await params

    // Check if session exists
    const session = await prisma.studySession.findUnique({
      where: { id: sessionId },
      include: {
        participants: {
          where: { status: 'JOINED' },
        },
      },
    })

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // SECURITY: Verify user has permission to join this session
    const isHost = session.createdBy === user.id

    if (!isHost) {
      // Check if user was invited
      const invitation = await prisma.sessionParticipant.findUnique({
        where: {
          sessionId_userId: {
            sessionId,
            userId: user.id,
          },
        },
        select: {
          status: true,
        },
      })

      // If there's an existing participant record, they must have been INVITED
      const wasInvited = invitation?.status === 'INVITED'

      // If not invited and session is private, verify they're an accepted partner
      if (!wasInvited && !session.isPublic) {
        const isAcceptedPartner = await prisma.match.findFirst({
          where: {
            OR: [
              { senderId: user.id, receiverId: session.createdBy, status: 'ACCEPTED' },
              { senderId: session.createdBy, receiverId: user.id, status: 'ACCEPTED' },
            ],
          },
        })

        if (!isAcceptedPartner) {
          console.warn(
            `[Join Session] User ${user.id} attempted to join session ${sessionId} without invitation or partner relationship`
          )
          return NextResponse.json(
            { error: 'You must be invited or be an accepted partner to join this session' },
            { status: 403 }
          )
        }
      }
    }

    // Atomically check capacity and add participant to prevent race conditions
    await prisma.$transaction(async (tx) => {
      // Re-check capacity inside transaction
      const currentParticipantCount = await tx.sessionParticipant.count({
        where: { sessionId, status: 'JOINED' },
      })

      if (currentParticipantCount >= session.maxParticipants) {
        throw new Error('SESSION_FULL')
      }

      // Check if already a participant
      const existing = await tx.sessionParticipant.findUnique({
        where: {
          sessionId_userId: {
            sessionId,
            userId: user.id,
          },
        },
      })

      if (existing && existing.status === 'JOINED') {
        // Already joined - return early
        throw new Error('ALREADY_JOINED')
      }

      // Update or create participant
      if (existing) {
        // Preserve original joinedAt timestamp if it exists
        await tx.sessionParticipant.update({
          where: { id: existing.id },
          data: {
            status: 'JOINED',
            joinedAt: existing.joinedAt ?? new Date(), // Preserve original or set new
          },
        })
      } else {
        await tx.sessionParticipant.create({
          data: {
            sessionId,
            userId: user.id,
            role: 'PARTICIPANT',
            status: 'JOINED',
            joinedAt: new Date(),
          },
        })
      }
    }).catch((txError: Error) => {
      if (txError.message === 'SESSION_FULL') {
        return NextResponse.json({ error: 'Session is full' }, { status: 400 })
      }
      if (txError.message === 'ALREADY_JOINED') {
        return NextResponse.json({
          success: true,
          message: 'Already joined',
          session: {
            id: session.id,
            agoraChannel: session.agoraChannel,
          },
        })
      }
      throw txError // Re-throw other errors
    })

    // Get user info for notification
    const joiningUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { name: true },
    })

    // Notify host and other participants
    // Browser notifications handled by real-time subscription on client

    return NextResponse.json({
      success: true,
      message: 'Joined session successfully',
      session: {
        id: session.id,
        title: session.title,
        agoraChannel: session.agoraChannel,
        status: session.status,
      },
    })
  } catch (error) {
    console.error('Error joining session:', error)
    return NextResponse.json(
      { error: 'Failed to join session' },
      { status: 500 }
    )
  }
}
