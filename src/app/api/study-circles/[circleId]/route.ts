// Study Circle Detail API - Get, Update, Delete individual circle
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

interface RouteParams {
  params: Promise<{ circleId: string }>
}

// GET /api/study-circles/[circleId] - Get circle details
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { circleId } = await params

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get circle with all related data in one query (no N+1)
    const circle = await prisma.studyCircle.findUnique({
      where: { id: circleId },
      select: {
        id: true,
        name: true,
        description: true,
        coverImageUrl: true,
        maxMembers: true,
        isPrivate: true,
        inviteCode: true,
        subjects: true,
        goals: true,
        status: true,
        currentStreak: true,
        longestStreak: true,
        lastActivityAt: true,
        createdById: true,
        createdAt: true,
        members: {
          where: { status: { in: ['ACTIVE', 'INVITED'] } },
          select: {
            id: true,
            userId: true,
            role: true,
            status: true,
            attendanceRate: true,
            totalSessions: true,
            totalStudyTime: true,
            joinedAt: true,
          },
          orderBy: [
            { role: 'asc' }, // OWNER first
            { joinedAt: 'asc' },
          ],
        },
        scheduledSessions: {
          where: { isActive: true },
          select: {
            id: true,
            title: true,
            description: true,
            isRecurring: true,
            recurringDays: true,
            startTime: true,
            durationMinutes: true,
            timezone: true,
            scheduledDate: true,
            reminderMinutes: true,
          },
          orderBy: { startTime: 'asc' },
        },
      },
    })

    if (!circle) {
      return NextResponse.json({ error: 'Circle not found' }, { status: 404 })
    }

    // Check if user is a member
    const userMembership = circle.members.find(m => m.userId === user.id)
    if (!userMembership && circle.isPrivate) {
      return NextResponse.json({ error: 'Not authorized to view this circle' }, { status: 403 })
    }

    // Batch fetch user info for all members (avoid N+1)
    const memberUserIds = circle.members.map(m => m.userId)
    const users = memberUserIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: memberUserIds } },
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            presence: {
              select: {
                status: true,
                activityType: true,
                lastSeenAt: true,
              },
            },
          },
        })
      : []

    const userMap = new Map(users.map(u => [u.id, u]))

    // Enrich members with user info
    const enrichedMembers = circle.members.map(member => {
      const userInfo = userMap.get(member.userId)
      return {
        id: member.id,
        userId: member.userId,
        role: member.role,
        status: member.status,
        name: userInfo?.name || 'Unknown',
        avatarUrl: userInfo?.avatarUrl || null,
        isOnline: userInfo?.presence?.status === 'ONLINE',
        activityType: userInfo?.presence?.activityType || null,
        lastSeenAt: userInfo?.presence?.lastSeenAt || null,
        stats: {
          attendanceRate: member.attendanceRate,
          totalSessions: member.totalSessions,
          totalStudyTime: member.totalStudyTime,
        },
        joinedAt: member.joinedAt,
      }
    })

    // Get recent attendance for this circle (last 7 days)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const recentAttendance = await prisma.circleAttendance.findMany({
      where: {
        circleId,
        date: { gte: sevenDaysAgo },
      },
      select: {
        userId: true,
        date: true,
        didAttend: true,
        durationMinutes: true,
      },
      orderBy: { date: 'desc' },
    })

    // Group attendance by date
    const attendanceByDate = recentAttendance.reduce((acc, record) => {
      const dateKey = record.date.toISOString().split('T')[0]
      if (!acc[dateKey]) {
        acc[dateKey] = []
      }
      acc[dateKey].push({
        userId: record.userId,
        didAttend: record.didAttend,
        durationMinutes: record.durationMinutes,
      })
      return acc
    }, {} as Record<string, Array<{ userId: string; didAttend: boolean; durationMinutes: number }>>)

    return NextResponse.json({
      success: true,
      data: {
        id: circle.id,
        name: circle.name,
        description: circle.description,
        coverImageUrl: circle.coverImageUrl,
        subjects: circle.subjects,
        goals: circle.goals,
        status: circle.status,
        isPrivate: circle.isPrivate,
        maxMembers: circle.maxMembers,
        inviteCode: userMembership?.role === 'OWNER' || userMembership?.role === 'ADMIN'
          ? circle.inviteCode
          : null, // Only show invite code to admins
        currentStreak: circle.currentStreak,
        longestStreak: circle.longestStreak,
        lastActivityAt: circle.lastActivityAt,
        createdAt: circle.createdAt,
        isOwner: circle.createdById === user.id,
        isMember: !!userMembership,
        myRole: userMembership?.role || null,
        myMembership: userMembership ? {
          id: userMembership.id,
          role: userMembership.role,
          attendanceRate: userMembership.attendanceRate,
          totalSessions: userMembership.totalSessions,
          totalStudyTime: userMembership.totalStudyTime,
          joinedAt: userMembership.joinedAt,
        } : null,
        members: enrichedMembers,
        memberCount: circle.members.filter(m => m.status === 'ACTIVE').length,
        scheduledSessions: circle.scheduledSessions,
        recentAttendance: attendanceByDate,
      },
    })
  } catch (error) {
    console.error('[Study Circle Detail] GET Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH /api/study-circles/[circleId] - Update circle
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { circleId } = await params

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin/owner of the circle
    const membership = await prisma.studyCircleMember.findUnique({
      where: {
        circleId_userId: {
          circleId,
          userId: user.id,
        },
      },
      select: { role: true, status: true },
    })

    if (!membership || membership.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Not a member of this circle' }, { status: 403 })
    }

    if (membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only owners and admins can update the circle' }, { status: 403 })
    }

    const body = await req.json()
    const {
      name,
      description,
      subjects,
      goals,
      maxMembers,
      isPrivate,
      status,
      coverImageUrl,
    } = body

    // Build update data
    const updateData: Record<string, unknown> = {}

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length < 2 || name.length > 50) {
        return NextResponse.json(
          { error: 'Circle name must be 2-50 characters' },
          { status: 400 }
        )
      }
      updateData.name = name.trim()
    }

    if (description !== undefined) {
      if (description && description.length > 500) {
        return NextResponse.json(
          { error: 'Description must be less than 500 characters' },
          { status: 400 }
        )
      }
      updateData.description = description?.trim() || null
    }

    if (subjects !== undefined) {
      updateData.subjects = Array.isArray(subjects) ? subjects.slice(0, 5) : []
    }

    if (goals !== undefined) {
      updateData.goals = Array.isArray(goals) ? goals.slice(0, 5) : []
    }

    if (maxMembers !== undefined) {
      if (maxMembers < 2 || maxMembers > 10) {
        return NextResponse.json(
          { error: 'Max members must be between 2 and 10' },
          { status: 400 }
        )
      }
      updateData.maxMembers = maxMembers
    }

    if (isPrivate !== undefined) {
      updateData.isPrivate = !!isPrivate
    }

    if (status !== undefined && membership.role === 'OWNER') {
      if (!['ACTIVE', 'PAUSED', 'ARCHIVED'].includes(status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
      }
      updateData.status = status
    }

    if (coverImageUrl !== undefined) {
      updateData.coverImageUrl = coverImageUrl || null
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const updatedCircle = await prisma.studyCircle.update({
      where: { id: circleId },
      data: updateData,
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
      },
    })

    return NextResponse.json({
      success: true,
      data: updatedCircle,
    })
  } catch (error) {
    console.error('[Study Circle Detail] PATCH Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/study-circles/[circleId] - Delete/archive circle (owner only)
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { circleId } = await params

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is owner of the circle
    const circle = await prisma.studyCircle.findUnique({
      where: { id: circleId },
      select: { createdById: true, status: true },
    })

    if (!circle) {
      return NextResponse.json({ error: 'Circle not found' }, { status: 404 })
    }

    if (circle.createdById !== user.id) {
      return NextResponse.json({ error: 'Only the owner can delete this circle' }, { status: 403 })
    }

    // Soft delete by archiving (preserves history)
    await prisma.studyCircle.update({
      where: { id: circleId },
      data: { status: 'ARCHIVED' },
    })

    return NextResponse.json({
      success: true,
      message: 'Circle archived successfully',
    })
  } catch (error) {
    console.error('[Study Circle Detail] DELETE Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
