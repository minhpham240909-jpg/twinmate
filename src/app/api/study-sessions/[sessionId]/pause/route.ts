import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: Request,
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
      return NextResponse.json({ error: 'Only host can pause session' }, { status: 403 })
    }

    // Calculate current duration
    const startedAt = session.startedAt ? new Date(session.startedAt) : new Date()
    const now = new Date()
    const durationMinutes = Math.floor((now.getTime() - startedAt.getTime()) / (1000 * 60))

    // Pause session (back to SCHEDULED)
    const updatedSession = await prisma.studySession.update({
      where: { id: sessionId },
      data: {
        status: 'SCHEDULED',
        durationMinutes: (session.durationMinutes || 0) + durationMinutes,
      },
    })

    return NextResponse.json({
      success: true,
      session: updatedSession,
    })
  } catch (error) {
    console.error('Error pausing session:', error)
    return NextResponse.json(
      { error: 'Failed to pause session' },
      { status: 500 }
    )
  }
}
