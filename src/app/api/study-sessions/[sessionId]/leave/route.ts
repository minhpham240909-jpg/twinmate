import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

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

    const { sessionId } = await params

    // Check if session exists
    const session = await prisma.studySession.findUnique({
      where: { id: sessionId },
      include: {
        participants: {
          where: { status: 'JOINED' },
          orderBy: { joinedAt: 'asc' },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
              },
            },
          },
        },
        creator: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Check if user is a participant
    const userParticipant = session.participants.find(p => p.userId === user.id)
    if (!userParticipant) {
      return NextResponse.json({ error: 'Not a participant' }, { status: 403 })
    }

    const isHost = session.createdBy === user.id
    const participantCount = session.participants.length

    // Scenario: Host is the only person left
    if (isHost && participantCount === 1) {
      // Hard delete the session (no history)
      await prisma.studySession.delete({
        where: { id: sessionId },
      })

      return NextResponse.json({
        success: true,
        message: 'Session deleted (no participants left)',
        action: 'deleted',
      })
    }

    // Scenario: Host leaving but others remain
    if (isHost && participantCount > 1) {
      // Find the oldest participant (first one who joined after filtering out current user)
      const newHost = session.participants.find(p => p.userId !== user.id)

      if (!newHost) {
        return NextResponse.json({ error: 'Could not find new host' }, { status: 500 })
      }

      // Transfer host
      await prisma.studySession.update({
        where: { id: sessionId },
        data: {
          createdBy: newHost.userId,
        },
      })

      // Remove current host from participants
      await prisma.sessionParticipant.update({
        where: { id: userParticipant.id },
        data: { status: 'LEFT' },
      })

      // Create system message about host transfer
      await prisma.sessionMessage.create({
        data: {
          sessionId,
          senderId: user.id,
          content: `${session.creator.name} has left the session. ${newHost.user.name} is now the host.`,
          type: 'SYSTEM',
        },
      })

      return NextResponse.json({
        success: true,
        message: 'Left session and transferred host',
        action: 'left_transferred',
        newHost: {
          id: newHost.userId,
          name: newHost.user.name,
        },
      })
    }

    // Scenario: Normal participant leaving
    await prisma.sessionParticipant.update({
      where: { id: userParticipant.id },
      data: { status: 'LEFT' },
    })

    // Create system message
    await prisma.sessionMessage.create({
      data: {
        sessionId,
        senderId: user.id,
        content: `${user.user_metadata?.name || user.email} has left the session.`,
        type: 'SYSTEM',
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Left session successfully',
      action: 'left',
    })
  } catch (error) {
    console.error('Error leaving session:', error)
    return NextResponse.json(
      { error: 'Failed to leave session' },
      { status: 500 }
    )
  }
}
