/**
 * Study Captain API - Weekly Recognition Badge
 * 
 * Calculates and awards the "Study Captain" badge to the top performer
 * in each study circle weekly. Strengthens class-level identity.
 * 
 * GET: Fetch current and past captains for a circle
 * POST: Calculate and award captain for the current week (admin/cron)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import logger from '@/lib/logger'

// Get start and end of current ISO week (Monday to Sunday)
function getCurrentWeekBounds(): { weekStart: Date; weekEnd: Date } {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek // Adjust to Monday
  
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() + diff)
  weekStart.setHours(0, 0, 0, 0)
  
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)
  
  return { weekStart, weekEnd }
}

// Generate inspirational achievement message based on stats
function generateAchievementMessage(
  userName: string,
  totalMinutes: number,
  sessionsAttended: number
): string {
  const hours = Math.floor(totalMinutes / 60)
  const messages = [
    hours >= 10
      ? `${userName} led with an incredible ${hours}+ hours of focused study!`
      : hours >= 5
      ? `${userName} showed amazing dedication with ${hours}+ hours this week!`
      : `${userName} set the pace with ${totalMinutes} minutes of quality study time!`,
    sessionsAttended >= 5
      ? `Attended ${sessionsAttended} sessions - true commitment!`
      : sessionsAttended >= 3
      ? `Consistently showed up for ${sessionsAttended} sessions!`
      : `Making every session count!`,
  ]
  
  return messages[0]
}

interface RouteContext {
  params: Promise<{ circleId: string }>
}

/**
 * GET /api/study-circles/[circleId]/captain
 * Fetch current and past Study Captains for a circle
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { circleId } = await context.params

    // Verify user is a member of this circle
    const membership = await prisma.studyCircleMember.findUnique({
      where: {
        circleId_userId: { circleId, userId: user.id },
      },
    })

    if (!membership) {
      return NextResponse.json(
        { error: 'Not a member of this circle' },
        { status: 403 }
      )
    }

    // Fetch captains with user info
    const captains = await prisma.studyCaptain.findMany({
      where: { circleId },
      orderBy: { weekStart: 'desc' },
      take: 10, // Last 10 weeks
    })

    // Get user info for all captains in one query (avoid N+1)
    const userIds = [...new Set(captains.map(c => c.userId))]
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, avatarUrl: true },
    })
    const userMap = Object.fromEntries(users.map(u => [u.id, u]))

    // Enrich captains with user info
    const enrichedCaptains = captains.map(captain => ({
      ...captain,
      user: userMap[captain.userId] || null,
    }))

    // Get current week bounds
    const { weekStart, weekEnd } = getCurrentWeekBounds()
    const currentCaptain = enrichedCaptains.find(
      c => new Date(c.weekStart).getTime() === weekStart.getTime()
    )

    return NextResponse.json({
      success: true,
      currentCaptain: currentCaptain || null,
      pastCaptains: enrichedCaptains.filter(c => c !== currentCaptain),
      weekBounds: { weekStart, weekEnd },
    })
  } catch (error) {
    logger.error('Study Captain GET Error', { error })
    return NextResponse.json(
      { error: 'Failed to fetch captains' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/study-circles/[circleId]/captain
 * Calculate and award Study Captain for the current week
 * Can be triggered manually or via cron job
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { circleId } = await context.params

    // Verify circle exists and user is admin/owner
    const circle = await prisma.studyCircle.findUnique({
      where: { id: circleId },
      include: {
        members: {
          where: { status: 'ACTIVE' },
          select: { userId: true, role: true, totalStudyTime: true },
        },
      },
    })

    if (!circle) {
      return NextResponse.json({ error: 'Circle not found' }, { status: 404 })
    }

    // Only owner/admin can trigger captain calculation
    const userMembership = circle.members.find(m => m.userId === user.id)
    if (!userMembership || !['OWNER', 'ADMIN'].includes(userMembership.role)) {
      return NextResponse.json(
        { error: 'Only circle admins can award captain badges' },
        { status: 403 }
      )
    }

    const { weekStart, weekEnd } = getCurrentWeekBounds()

    // Check if captain already awarded for this week
    const existingCaptain = await prisma.studyCaptain.findUnique({
      where: { circleId_weekStart: { circleId, weekStart } },
    })

    if (existingCaptain) {
      return NextResponse.json({
        success: true,
        message: 'Captain already awarded for this week',
        captain: existingCaptain,
      })
    }

    // Calculate study time for each member this week from attendance records
    const weekAttendance = await prisma.circleAttendance.groupBy({
      by: ['userId'],
      where: {
        circleId,
        date: { gte: weekStart, lte: weekEnd },
        didAttend: true,
      },
      _sum: { durationMinutes: true },
      _count: { id: true },
    })

    if (weekAttendance.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No attendance this week - no captain awarded',
        captain: null,
      })
    }

    // Find the top performer
    const topPerformer = weekAttendance.reduce((max, current) => {
      const currentMinutes = current._sum.durationMinutes || 0
      const maxMinutes = max._sum.durationMinutes || 0
      return currentMinutes > maxMinutes ? current : max
    }, weekAttendance[0])

    // Get user info for the captain
    const captainUser = await prisma.user.findUnique({
      where: { id: topPerformer.userId },
      select: { id: true, name: true, avatarUrl: true },
    })

    if (!captainUser) {
      return NextResponse.json(
        { error: 'Captain user not found' },
        { status: 404 }
      )
    }

    // Mark previous captains as inactive
    await prisma.studyCaptain.updateMany({
      where: { circleId, isActive: true },
      data: { isActive: false },
    })

    // Create the new captain
    const newCaptain = await prisma.studyCaptain.create({
      data: {
        circleId,
        userId: topPerformer.userId,
        weekStart,
        weekEnd,
        totalStudyMinutes: topPerformer._sum.durationMinutes || 0,
        sessionsAttended: topPerformer._count.id,
        achievementMessage: generateAchievementMessage(
          captainUser.name,
          topPerformer._sum.durationMinutes || 0,
          topPerformer._count.id
        ),
        isActive: true,
      },
    })

    // Create notification for the captain (inspirational tone)
    await prisma.notification.create({
      data: {
        userId: topPerformer.userId,
        type: 'BADGE_EARNED',
        title: '🏆 You\'re the Study Captain!',
        message: `Congrats! You led "${circle.name}" this week with your dedication. Keep inspiring the team!`,
        actionUrl: `/study-circles/${circleId}`,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Study Captain awarded!',
      captain: {
        ...newCaptain,
        user: captainUser,
      },
    })
  } catch (error) {
    logger.error('Study Captain POST Error', { error })
    return NextResponse.json(
      { error: 'Failed to calculate captain' },
      { status: 500 }
    )
  }
}
