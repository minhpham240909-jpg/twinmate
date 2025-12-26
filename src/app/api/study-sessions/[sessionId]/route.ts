import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export async function GET(
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

    // SECURITY: Check authorization BEFORE loading sensitive data
    // First, verify user is a participant (lightweight query)
    const participantCheck = await prisma.sessionParticipant.findFirst({
      where: {
        sessionId,
        userId: user.id,
        status: 'JOINED',
      },
    })

    // Return 404 (not 403) to prevent session enumeration
    if (!participantCheck) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // NOW load the full session data (user is authorized)
    const session = await prisma.studySession.findUnique({
      where: { id: sessionId },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
        participants: {
          where: {
            status: 'JOINED',
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
                presence: {
                  select: {
                    status: true,
                  },
                },
              },
            },
          },
        },
        goals: {
          orderBy: {
            order: 'asc',
          },
        },
        timer: true,
      },
    })

    // Should not happen (participant exists but session doesn't)
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Format participants with online status
    const formattedParticipants = session.participants.map(p => ({
      id: p.id,
      userId: p.user.id,
      name: p.user.name,
      avatarUrl: p.user.avatarUrl,
      role: p.role,
      joinedAt: p.joinedAt,
      onlineStatus: p.user.presence?.status === 'online' ? 'ONLINE' : 'OFFLINE',
    }))

    return NextResponse.json({
      success: true,
      session: {
        id: session.id,
        title: session.title,
        description: session.description,
        type: session.type,
        status: session.status,
        subject: session.subject,
        tags: session.tags,
        scheduledAt: session.scheduledAt,
        waitingExpiresAt: session.waitingExpiresAt, // IMPORTANT: For countdown timer
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        durationMinutes: session.durationMinutes,
        agoraChannel: session.agoraChannel,
        maxParticipants: session.maxParticipants,
        createdBy: session.creator,
        participants: formattedParticipants,
        goals: session.goals,
        timer: session.timer,
      },
    })
  } catch (error) {
    console.error('Error fetching session:', error)
    return NextResponse.json(
      { error: 'Failed to fetch session' },
      { status: 500 }
    )
  }
}

export async function DELETE(
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

    // Get session to verify user is a participant or creator
    const session = await prisma.studySession.findUnique({
      where: { id: sessionId },
      include: {
        participants: {
          where: {
            userId: user.id,
          },
        },
      },
    })

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Check if user is the creator or a participant
    const isCreator = session.createdBy === user.id
    const isParticipant = session.participants.length > 0

    if (!isCreator && !isParticipant) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Only allow deletion of completed or cancelled sessions
    if (session.status !== 'COMPLETED' && session.status !== 'CANCELLED') {
      return NextResponse.json(
        { error: 'Can only delete completed or cancelled sessions' },
        { status: 400 }
      )
    }

    // Delete the session (cascade will handle related records)
    await prisma.studySession.delete({
      where: { id: sessionId },
    })

    return NextResponse.json({
      success: true,
      message: 'Session deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting session:', error)
    return NextResponse.json(
      { error: 'Failed to delete session' },
      { status: 500 }
    )
  }
}
