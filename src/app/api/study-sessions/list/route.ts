import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { SessionStatus, SessionType } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get query params
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const type = searchParams.get('type')

    // Find sessions where user is a participant (only JOINED, not INVITED)
    const participantRecords = await prisma.sessionParticipant.findMany({
      where: {
        userId: user.id,
        status: 'JOINED',
      },
      select: {
        sessionId: true,
        role: true,
        status: true,
      },
    })

    const sessionIds = participantRecords.map(p => p.sessionId)

    // Get full session details
    const sessions = await prisma.studySession.findMany({
      where: {
        id: { in: sessionIds },
        ...(status && { status: status as SessionStatus }),
        ...(type && { type: type as SessionType }),
      },
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
          select: {
            id: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Format response
    const formattedSessions = sessions.map(session => {
      const participantRecord = participantRecords.find(p => p.sessionId === session.id)
      return {
        id: session.id,
        title: session.title,
        description: session.description,
        status: session.status,
        type: session.type,
        subject: session.subject,
        tags: session.tags,
        scheduledAt: session.scheduledAt,
        startedAt: session.startedAt,
        participantCount: session.participants.length,
        maxParticipants: session.maxParticipants,
        isHost: participantRecord?.role === 'HOST',
        createdBy: session.creator,
      }
    })

    return NextResponse.json({
      success: true,
      sessions: formattedSessions,
      total: formattedSessions.length,
    })
  } catch (error) {
    console.error('Error fetching sessions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sessions' },
      { status: 500 }
    )
  }
}
