import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { corsHeaders, handleCorsPreFlight } from '@/lib/cors'

// Handle CORS preflight
export async function OPTIONS(request: NextRequest) {
  return handleCorsPreFlight(request)
}

// GET - Get timer state for a session
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const origin = request.headers.get('origin')
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sessionId } = await params

    // Check if user is a participant
    const participant = await prisma.sessionParticipant.findFirst({
      where: {
        sessionId,
        userId: user.id,
      },
    })

    if (!participant) {
      return NextResponse.json(
        { error: 'Not a participant of this session' },
        { status: 403, headers: corsHeaders(origin) }
      )
    }

    // Get timer
    let timer = await prisma.sessionTimer.findUnique({
      where: { sessionId },
    })

    // Calculate actual time remaining based on lastStartedAt timestamp
    if (timer && (timer.state === 'RUNNING' || timer.state === 'BREAK')) {
      if (timer.lastStartedAt) {
        const now = new Date()
        const elapsedSeconds = Math.floor(
          (now.getTime() - new Date(timer.lastStartedAt).getTime()) / 1000
        )
        const actualTimeRemaining = Math.max(0, timer.timeRemaining - elapsedSeconds)

        // Update the timer object we return (not the database yet)
        timer = {
          ...timer,
          timeRemaining: actualTimeRemaining,
        }
      }
    }

    return NextResponse.json(
      {
        success: true,
        timer,
      },
      { headers: corsHeaders(origin) }
    )
  } catch (error) {
    console.error('Error fetching timer:', error)
    return NextResponse.json(
      { error: 'Failed to fetch timer' },
      { status: 500, headers: corsHeaders(origin) }
    )
  }
}

// POST - Create or update timer
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const origin = request.headers.get('origin')
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: corsHeaders(origin) }
      )
    }

    const { sessionId } = await params
    const body = await request.json()

    // Check if user is host
    const session = await prisma.studySession.findUnique({
      where: { id: sessionId },
    })

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404, headers: corsHeaders(origin) }
      )
    }

    if (session.createdBy !== user.id) {
      return NextResponse.json(
        { error: 'Only the host can set timer settings' },
        { status: 403, headers: corsHeaders(origin) }
      )
    }

    // Get user's settings for defaults
    const userSettings = await prisma.userSettings.findUnique({
      where: { userId: user.id },
    })

    // Use provided values or fall back to user settings, then to app defaults
    const studyDuration = body.studyDuration || userSettings?.defaultStudyDuration || 25
    const breakDuration = body.breakDuration || userSettings?.defaultBreakDuration || 5

    // Create or update timer
    const timer = await prisma.sessionTimer.upsert({
      where: { sessionId },
      create: {
        sessionId,
        studyDuration,
        breakDuration,
        timeRemaining: studyDuration * 60, // Convert to seconds
        state: 'IDLE',
        currentCycle: 1,
        isBreakTime: false,
      },
      update: {
        studyDuration,
        breakDuration,
        timeRemaining: studyDuration * 60, // Reset time when settings change
        state: 'IDLE',
        currentCycle: 1,
        isBreakTime: false,
      },
    })

    return NextResponse.json(
      {
        success: true,
        timer,
      },
      { headers: corsHeaders(origin) }
    )
  } catch (error) {
    console.error('Error creating/updating timer:', error)
    return NextResponse.json(
      { error: 'Failed to create/update timer' },
      { status: 500, headers: corsHeaders(origin) }
    )
  }
}

// DELETE - Delete timer
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const origin = request.headers.get('origin')
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: corsHeaders(origin) }
      )
    }

    const { sessionId } = await params

    // Check if user is host
    const session = await prisma.studySession.findUnique({
      where: { id: sessionId },
    })

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404, headers: corsHeaders(origin) }
      )
    }

    if (session.createdBy !== user.id) {
      return NextResponse.json(
        { error: 'Only the host can delete the timer' },
        { status: 403, headers: corsHeaders(origin) }
      )
    }

    // Delete timer
    await prisma.sessionTimer.delete({
      where: { sessionId },
    })

    return NextResponse.json(
      {
        success: true,
        message: 'Timer deleted successfully',
      },
      { headers: corsHeaders(origin) }
    )
  } catch (error) {
    console.error('Error deleting timer:', error)
    return NextResponse.json(
      { error: 'Failed to delete timer' },
      { status: 500, headers: corsHeaders(origin) }
    )
  }
}
