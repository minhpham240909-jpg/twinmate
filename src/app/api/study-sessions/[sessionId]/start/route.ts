import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { rateLimit } from '@/lib/rate-limit'

// Rate limit: 10 session starts per minute per user
const SESSION_START_RATE_LIMIT = {
  max: 10,
  windowMs: 60000,
  keyPrefix: 'session-start',
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    // Apply rate limiting
    const rateLimitResult = await rateLimit(request, SESSION_START_RATE_LIMIT)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many session start requests. Please slow down.' },
        { status: 429, headers: rateLimitResult.headers }
      )
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sessionId } = await params

    // Use transaction to prevent race conditions when starting session
    const updatedSession = await prisma.$transaction(async (tx) => {
      // Get session inside transaction
      const session = await tx.studySession.findUnique({
        where: { id: sessionId },
      })

      if (!session) {
        throw new Error('SESSION_NOT_FOUND')
      }

      // Verify user is host
      if (session.createdBy !== user.id) {
        throw new Error('NOT_HOST')
      }

      // Check if already started
      if (session.status === 'ACTIVE') {
        throw new Error('ALREADY_STARTED')
      }

      // Start session
      return await tx.studySession.update({
        where: { id: sessionId },
        data: {
          status: 'ACTIVE',
          startedAt: new Date(),
        },
      })
    }).catch((txError: Error) => {
      if (txError.message === 'SESSION_NOT_FOUND') {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 })
      }
      if (txError.message === 'NOT_HOST') {
        return NextResponse.json({ error: 'Only host can start session' }, { status: 403 })
      }
      if (txError.message === 'ALREADY_STARTED') {
        return NextResponse.json({ error: 'Session already started' }, { status: 400 })
      }
      throw txError
    })

    // If error response was returned from transaction, return it
    if (updatedSession instanceof NextResponse) {
      return updatedSession
    }

    // Get session for notification
    const session = await prisma.studySession.findUnique({
      where: { id: sessionId },
      select: { title: true }
    })

    // Notify all participants
    // Browser notifications handled by real-time subscription on client

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
