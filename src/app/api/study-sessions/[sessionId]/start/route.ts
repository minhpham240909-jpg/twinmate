import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { notifySessionParticipants } from '@/lib/notifications'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sessionId } = await params

    // Get session
    const session = await prisma.studySession.findUnique({
      where: { id: sessionId },
    })

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Verify user is host
    if (session.createdBy !== user.id) {
      return NextResponse.json({ error: 'Only host can start session' }, { status: 403 })
    }

    // Start session
    const updatedSession = await prisma.studySession.update({
      where: { id: sessionId },
      data: {
        status: 'ACTIVE',
        startedAt: new Date(),
      },
    })

    // Notify all participants
    await notifySessionParticipants(
      sessionId,
      'SESSION_STARTED',
      'Session Started',
      `${session.title} has started!`,
      user.id
    )

    return NextResponse.json({
      success: true,
      session: updatedSession,
    })
  } catch (error) {
    console.error('Error starting session:', error)
    return NextResponse.json(
      { error: 'Failed to start session' },
      { status: 500 }
    )
  }
}
