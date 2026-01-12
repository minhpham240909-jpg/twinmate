// Study Circle Attendance API - Track who showed up
// This is the core of "social gravity" - making leaving feel like breaking a routine
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

interface RouteParams {
  params: Promise<{ circleId: string }>
}

// Helper to calculate group streak
async function updateGroupStreak(circleId: string): Promise<{ currentStreak: number; longestStreak: number }> {
  // Get all active members
  const members = await prisma.studyCircleMember.findMany({
    where: { circleId, status: 'ACTIVE' },
    select: { userId: true },
  })

  const memberIds = members.map(m => m.userId)
  if (memberIds.length === 0) {
    return { currentStreak: 0, longestStreak: 0 }
  }

  // Get attendance records for the last 90 days, grouped by date
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  const attendanceRecords = await prisma.circleAttendance.findMany({
    where: {
      circleId,
      date: { gte: ninetyDaysAgo },
      didAttend: true,
    },
    select: {
      date: true,
      userId: true,
    },
    orderBy: { date: 'desc' },
  })

  // Group by date
  const attendanceByDate = new Map<string, Set<string>>()
  for (const record of attendanceRecords) {
    const dateKey = record.date.toISOString().split('T')[0]
    if (!attendanceByDate.has(dateKey)) {
      attendanceByDate.set(dateKey, new Set())
    }
    attendanceByDate.get(dateKey)!.add(record.userId)
  }

  // Calculate streak - all members must have attended
  let currentStreak = 0
  let longestStreak = 0
  let tempStreak = 0

  // Start from yesterday (today might not be complete yet)
  const checkDate = new Date()
  checkDate.setDate(checkDate.getDate() - 1)
  checkDate.setHours(0, 0, 0, 0)

  // Check up to 90 days back
  for (let i = 0; i < 90; i++) {
    const dateKey = checkDate.toISOString().split('T')[0]
    const attendees = attendanceByDate.get(dateKey) || new Set()

    // Check if ALL members attended
    const allAttended = memberIds.every(id => attendees.has(id))

    if (allAttended) {
      tempStreak++
      if (currentStreak === 0) {
        currentStreak = tempStreak // Only set current streak if continuous from yesterday
      }
    } else {
      // Streak broken
      if (tempStreak > longestStreak) {
        longestStreak = tempStreak
      }
      if (currentStreak > 0) {
        // Current streak ended
        break
      }
      tempStreak = 0
    }

    checkDate.setDate(checkDate.getDate() - 1)
  }

  // Final check for longest streak
  if (tempStreak > longestStreak) {
    longestStreak = tempStreak
  }

  // Update circle with new streak values
  await prisma.studyCircle.update({
    where: { id: circleId },
    data: {
      currentStreak,
      longestStreak: Math.max(longestStreak, currentStreak),
    },
  })

  return { currentStreak, longestStreak: Math.max(longestStreak, currentStreak) }
}

// Helper to update member's attendance rate
async function updateMemberAttendanceRate(circleId: string, userId: string): Promise<void> {
  // Get attendance stats for last 30 days
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const [attended, total] = await Promise.all([
    prisma.circleAttendance.count({
      where: {
        circleId,
        userId,
        date: { gte: thirtyDaysAgo },
        didAttend: true,
      },
    }),
    prisma.circleAttendance.count({
      where: {
        circleId,
        userId,
        date: { gte: thirtyDaysAgo },
      },
    }),
  ])

  const rate = total > 0 ? (attended / total) * 100 : 0

  await prisma.studyCircleMember.update({
    where: {
      circleId_userId: { circleId, userId },
    },
    data: { attendanceRate: Math.round(rate * 100) / 100 },
  })
}

// GET /api/study-circles/[circleId]/attendance - Get attendance history
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
    const days = parseInt(searchParams.get('days') || '30', 10)
    const limitDays = Math.min(Math.max(days, 7), 90) // 7-90 days

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - limitDays)
    startDate.setHours(0, 0, 0, 0)

    // Get all attendance records (batch query)
    const [attendance, members, circle] = await Promise.all([
      prisma.circleAttendance.findMany({
        where: {
          circleId,
          date: { gte: startDate },
        },
        select: {
          id: true,
          userId: true,
          date: true,
          didAttend: true,
          wasLate: true,
          durationMinutes: true,
          joinedAt: true,
          leftAt: true,
        },
        orderBy: { date: 'desc' },
      }),
      prisma.studyCircleMember.findMany({
        where: { circleId, status: 'ACTIVE' },
        select: {
          userId: true,
          attendanceRate: true,
          totalSessions: true,
          totalStudyTime: true,
        },
      }),
      prisma.studyCircle.findUnique({
        where: { id: circleId },
        select: {
          currentStreak: true,
          longestStreak: true,
        },
      }),
    ])

    // Batch fetch user info
    const userIds = members.map(m => m.userId)
    const users = userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        })
      : []

    const userMap = new Map(users.map(u => [u.id, u]))

    // Group attendance by date
    const attendanceByDate: Record<string, Array<{
      userId: string
      name: string
      avatarUrl: string | null
      didAttend: boolean
      wasLate: boolean
      durationMinutes: number
    }>> = {}

    for (const record of attendance) {
      const dateKey = record.date.toISOString().split('T')[0]
      if (!attendanceByDate[dateKey]) {
        attendanceByDate[dateKey] = []
      }
      const userInfo = userMap.get(record.userId)
      attendanceByDate[dateKey].push({
        userId: record.userId,
        name: userInfo?.name || 'Unknown',
        avatarUrl: userInfo?.avatarUrl || null,
        didAttend: record.didAttend,
        wasLate: record.wasLate,
        durationMinutes: record.durationMinutes,
      })
    }

    // Calculate overall stats
    const memberStats = members.map(m => {
      const userInfo = userMap.get(m.userId)
      return {
        userId: m.userId,
        name: userInfo?.name || 'Unknown',
        avatarUrl: userInfo?.avatarUrl || null,
        attendanceRate: m.attendanceRate,
        totalSessions: m.totalSessions,
        totalStudyTime: m.totalStudyTime,
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        attendanceByDate,
        memberStats,
        groupStreak: {
          current: circle?.currentStreak || 0,
          longest: circle?.longestStreak || 0,
        },
        period: {
          days: limitDays,
          startDate: startDate.toISOString(),
        },
      },
    })
  } catch (error) {
    console.error('[Circle Attendance] GET Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/study-circles/[circleId]/attendance - Record attendance (check-in)
export async function POST(req: NextRequest, { params }: RouteParams) {
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
      select: { status: true, totalSessions: true, totalStudyTime: true },
    })

    if (!membership || membership.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Not a member of this circle' }, { status: 403 })
    }

    const body = await req.json()
    const { action, sessionId, durationMinutes } = body

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Check for existing attendance record today
    const existingRecord = await prisma.circleAttendance.findUnique({
      where: {
        circleId_userId_date: {
          circleId,
          userId: user.id,
          date: today,
        },
      },
    })

    if (action === 'check_in') {
      if (existingRecord?.didAttend) {
        return NextResponse.json({ error: 'Already checked in today' }, { status: 400 })
      }

      // Check if late (if there's a scheduled session)
      let wasLate = false
      if (sessionId) {
        const session = await prisma.circleScheduledSession.findUnique({
          where: { id: sessionId },
          select: { startTime: true },
        })

        if (session) {
          const [hours, minutes] = session.startTime.split(':').map(Number)
          const scheduledTime = new Date(today)
          scheduledTime.setHours(hours, minutes, 0, 0)

          const now = new Date()
          const tenMinutesLate = new Date(scheduledTime.getTime() + 10 * 60 * 1000)
          wasLate = now > tenMinutesLate
        }
      }

      // Create or update attendance record
      const attendanceRecord = await prisma.circleAttendance.upsert({
        where: {
          circleId_userId_date: {
            circleId,
            userId: user.id,
            date: today,
          },
        },
        create: {
          circleId,
          userId: user.id,
          sessionId: sessionId || null,
          date: today,
          joinedAt: new Date(),
          didAttend: true,
          wasLate,
        },
        update: {
          joinedAt: new Date(),
          didAttend: true,
          wasLate,
          sessionId: sessionId || undefined,
        },
      })

      // Update member's session count
      await prisma.studyCircleMember.update({
        where: {
          circleId_userId: { circleId, userId: user.id },
        },
        data: {
          totalSessions: membership.totalSessions + 1,
        },
      })

      // Update circle's last activity
      await prisma.studyCircle.update({
        where: { id: circleId },
        data: { lastActivityAt: new Date() },
      })

      // Update group streak in background (don't block response)
      updateGroupStreak(circleId).catch(console.error)
      updateMemberAttendanceRate(circleId, user.id).catch(console.error)

      return NextResponse.json({
        success: true,
        data: {
          checkInTime: attendanceRecord.joinedAt,
          wasLate,
        },
        message: wasLate ? 'Checked in (late)' : 'Checked in successfully',
      })
    }

    if (action === 'check_out') {
      if (!existingRecord || !existingRecord.didAttend) {
        return NextResponse.json({ error: 'Not checked in today' }, { status: 400 })
      }

      if (existingRecord.leftAt) {
        return NextResponse.json({ error: 'Already checked out' }, { status: 400 })
      }

      const leftAt = new Date()
      const joinedAt = existingRecord.joinedAt || today
      const duration = durationMinutes || Math.round((leftAt.getTime() - joinedAt.getTime()) / 60000)

      // Update attendance record
      await prisma.circleAttendance.update({
        where: { id: existingRecord.id },
        data: {
          leftAt,
          durationMinutes: Math.max(0, duration),
        },
      })

      // Update member's total study time
      await prisma.studyCircleMember.update({
        where: {
          circleId_userId: { circleId, userId: user.id },
        },
        data: {
          totalStudyTime: membership.totalStudyTime + duration,
        },
      })

      return NextResponse.json({
        success: true,
        data: {
          checkOutTime: leftAt,
          durationMinutes: duration,
        },
        message: `Studied for ${duration} minutes`,
      })
    }

    return NextResponse.json({ error: 'Invalid action. Use check_in or check_out' }, { status: 400 })
  } catch (error) {
    console.error('[Circle Attendance] POST Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
