import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: NextRequest,
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

    // Check if session exists and user is host
    const session = await prisma.studySession.findUnique({
      where: { id: sessionId },
    })

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    if (session.createdBy !== user.id) {
      return NextResponse.json({ error: 'Only the host can end the session' }, { status: 403 })
    }

    if (session.status === 'COMPLETED') {
      return NextResponse.json({ error: 'Session already ended' }, { status: 400 })
    }

    if (!session.startedAt) {
      return NextResponse.json({ error: 'Session has not been started yet' }, { status: 400 })
    }

    // Calculate duration
    const endedAt = new Date()
    const startedAt = new Date(session.startedAt)
    const durationMinutes = Math.floor((endedAt.getTime() - startedAt.getTime()) / 60000)

    // Update session
    const updatedSession = await prisma.studySession.update({
      where: { id: sessionId },
      data: {
        status: 'COMPLETED',
        endedAt,
        durationMinutes,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Session ended successfully',
      session: {
        id: updatedSession.id,
        status: updatedSession.status,
        endedAt: updatedSession.endedAt,
        durationMinutes: updatedSession.durationMinutes,
      },
    })
  } catch (error) {
    console.error('Error ending session:', error)
    return NextResponse.json(
      { error: 'Failed to end session' },
      { status: 500 }
    )
  }
}
