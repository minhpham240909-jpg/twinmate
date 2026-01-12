// Study Circle Sessions API - Scheduled/Recurring study sessions
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

interface RouteParams {
  params: Promise<{ circleId: string }>
}

// Helper to validate time format (HH:MM)
function isValidTimeFormat(time: string): boolean {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(time)
}

// Helper to validate day names
const VALID_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
function isValidDay(day: string): boolean {
  return VALID_DAYS.includes(day)
}

// GET /api/study-circles/[circleId]/sessions - Get scheduled sessions
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { circleId } = await params

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is a member
    const membership = await prisma.studyCircleMember.findUnique({
      where: {
        circleId_userId: { circleId, userId: user.id },
      },
      select: { status: true },
    })

    if (!membership || membership.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Not a member of this circle' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const includeInactive = searchParams.get('includeInactive') === 'true'

    // Get sessions
    const sessions = await prisma.circleScheduledSession.findMany({
      where: {
        circleId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: [
        { isActive: 'desc' },
        { startTime: 'asc' },
      ],
    })

    // Get today's attendance for these sessions (batch query)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const todayAttendance = await prisma.circleAttendance.findMany({
      where: {
        circleId,
        date: today,
      },
      select: {
        sessionId: true,
        userId: true,
        didAttend: true,
        joinedAt: true,
      },
    })

    // Group attendance by session
    const attendanceBySession = todayAttendance.reduce((acc, record) => {
      const key = record.sessionId || 'unscheduled'
      if (!acc[key]) acc[key] = []
      acc[key].push(record)
      return acc
    }, {} as Record<string, typeof todayAttendance>)

    // Get current day of week
    const currentDay = VALID_DAYS[today.getDay() === 0 ? 6 : today.getDay() - 1]

    // Format sessions with today's status
    const formattedSessions = sessions.map(session => {
      const todayRecords = attendanceBySession[session.id] || []
      const isScheduledToday = session.isRecurring
        ? session.recurringDays.includes(currentDay)
        : session.scheduledDate?.toDateString() === today.toDateString()

      return {
        ...session,
        isScheduledToday,
        todayAttendance: {
          total: todayRecords.length,
          attended: todayRecords.filter(r => r.didAttend).length,
          records: todayRecords,
        },
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        sessions: formattedSessions,
        currentDay,
      },
    })
  } catch (error) {
    console.error('[Circle Sessions] GET Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/study-circles/[circleId]/sessions - Create scheduled session
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { circleId } = await params

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is admin/owner
    const membership = await prisma.studyCircleMember.findUnique({
      where: {
        circleId_userId: { circleId, userId: user.id },
      },
      select: { role: true, status: true },
    })

    if (!membership || membership.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Not a member of this circle' }, { status: 403 })
    }

    if (membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only owners and admins can create sessions' }, { status: 403 })
    }

    const body = await req.json()
    const {
      title,
      description,
      isRecurring = true,
      recurringDays = [],
      startTime,
      durationMinutes = 60,
      timezone = 'UTC',
      scheduledDate,
      reminderMinutes = 15,
    } = body

    // Validation
    if (!title || typeof title !== 'string' || title.trim().length < 2) {
      return NextResponse.json(
        { error: 'Title must be at least 2 characters' },
        { status: 400 }
      )
    }

    if (title.length > 100) {
      return NextResponse.json(
        { error: 'Title must be less than 100 characters' },
        { status: 400 }
      )
    }

    if (!startTime || !isValidTimeFormat(startTime)) {
      return NextResponse.json(
        { error: 'Start time must be in HH:MM format (24-hour)' },
        { status: 400 }
      )
    }

    if (durationMinutes < 15 || durationMinutes > 480) {
      return NextResponse.json(
        { error: 'Duration must be between 15 and 480 minutes' },
        { status: 400 }
      )
    }

    if (isRecurring) {
      if (!Array.isArray(recurringDays) || recurringDays.length === 0) {
        return NextResponse.json(
          { error: 'Recurring sessions must have at least one day' },
          { status: 400 }
        )
      }

      if (!recurringDays.every(isValidDay)) {
        return NextResponse.json(
          { error: 'Invalid day name. Use full day names (e.g., Monday)' },
          { status: 400 }
        )
      }
    } else {
      if (!scheduledDate) {
        return NextResponse.json(
          { error: 'One-time sessions must have a scheduled date' },
          { status: 400 }
        )
      }

      const date = new Date(scheduledDate)
      if (isNaN(date.getTime()) || date < new Date()) {
        return NextResponse.json(
          { error: 'Scheduled date must be in the future' },
          { status: 400 }
        )
      }
    }

    // Check session limit per circle
    const existingSessions = await prisma.circleScheduledSession.count({
      where: { circleId, isActive: true },
    })

    if (existingSessions >= 10) {
      return NextResponse.json(
        { error: 'Maximum 10 active sessions per circle' },
        { status: 400 }
      )
    }

    // Create session
    const session = await prisma.circleScheduledSession.create({
      data: {
        circleId,
        title: title.trim(),
        description: description?.trim() || null,
        isRecurring,
        recurringDays: isRecurring ? recurringDays : [],
        startTime,
        durationMinutes,
        timezone,
        scheduledDate: !isRecurring ? new Date(scheduledDate) : null,
        reminderMinutes: Math.max(0, Math.min(60, reminderMinutes)),
        createdById: user.id,
      },
    })

    // Update circle's last activity
    await prisma.studyCircle.update({
      where: { id: circleId },
      data: { lastActivityAt: new Date() },
    })

    return NextResponse.json({
      success: true,
      data: session,
    })
  } catch (error) {
    console.error('[Circle Sessions] POST Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH /api/study-circles/[circleId]/sessions - Update session
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { circleId } = await params

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is admin/owner
    const membership = await prisma.studyCircleMember.findUnique({
      where: {
        circleId_userId: { circleId, userId: user.id },
      },
      select: { role: true, status: true },
    })

    if (!membership || membership.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Not a member of this circle' }, { status: 403 })
    }

    if (membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only owners and admins can update sessions' }, { status: 403 })
    }

    const body = await req.json()
    const {
      sessionId,
      title,
      description,
      recurringDays,
      startTime,
      durationMinutes,
      reminderMinutes,
      isActive,
    } = body

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
    }

    // Verify session belongs to circle
    const session = await prisma.circleScheduledSession.findFirst({
      where: { id: sessionId, circleId },
    })

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Build update data
    const updateData: Record<string, unknown> = {}

    if (title !== undefined) {
      if (typeof title !== 'string' || title.trim().length < 2 || title.length > 100) {
        return NextResponse.json(
          { error: 'Title must be 2-100 characters' },
          { status: 400 }
        )
      }
      updateData.title = title.trim()
    }

    if (description !== undefined) {
      updateData.description = description?.trim() || null
    }

    if (recurringDays !== undefined && session.isRecurring) {
      if (!Array.isArray(recurringDays) || recurringDays.length === 0) {
        return NextResponse.json(
          { error: 'Recurring sessions must have at least one day' },
          { status: 400 }
        )
      }
      if (!recurringDays.every(isValidDay)) {
        return NextResponse.json(
          { error: 'Invalid day name' },
          { status: 400 }
        )
      }
      updateData.recurringDays = recurringDays
    }

    if (startTime !== undefined) {
      if (!isValidTimeFormat(startTime)) {
        return NextResponse.json(
          { error: 'Start time must be in HH:MM format' },
          { status: 400 }
        )
      }
      updateData.startTime = startTime
    }

    if (durationMinutes !== undefined) {
      if (durationMinutes < 15 || durationMinutes > 480) {
        return NextResponse.json(
          { error: 'Duration must be 15-480 minutes' },
          { status: 400 }
        )
      }
      updateData.durationMinutes = durationMinutes
    }

    if (reminderMinutes !== undefined) {
      updateData.reminderMinutes = Math.max(0, Math.min(60, reminderMinutes))
    }

    if (isActive !== undefined) {
      updateData.isActive = !!isActive
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const updatedSession = await prisma.circleScheduledSession.update({
      where: { id: sessionId },
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      data: updatedSession,
    })
  } catch (error) {
    console.error('[Circle Sessions] PATCH Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/study-circles/[circleId]/sessions - Delete session
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { circleId } = await params

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is admin/owner
    const membership = await prisma.studyCircleMember.findUnique({
      where: {
        circleId_userId: { circleId, userId: user.id },
      },
      select: { role: true, status: true },
    })

    if (!membership || membership.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Not a member of this circle' }, { status: 403 })
    }

    if (membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only owners and admins can delete sessions' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const sessionId = searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
    }

    // Verify session belongs to circle
    const session = await prisma.circleScheduledSession.findFirst({
      where: { id: sessionId, circleId },
    })

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Soft delete by deactivating (preserves attendance history)
    await prisma.circleScheduledSession.update({
      where: { id: sessionId },
      data: { isActive: false },
    })

    return NextResponse.json({
      success: true,
      message: 'Session deleted',
    })
  } catch (error) {
    console.error('[Circle Sessions] DELETE Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
