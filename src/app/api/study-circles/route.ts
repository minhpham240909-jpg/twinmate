// Study Circles API - Social Accountability Groups
// Stable groups of 3-6 people who study together regularly
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { nanoid } from 'nanoid'

// GET /api/study-circles - Get user's study circles
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const includeArchived = searchParams.get('includeArchived') === 'true'

    // Get all circles where user is a member (single query, no N+1)
    const memberships = await prisma.studyCircleMember.findMany({
      where: {
        userId: user.id,
        status: 'ACTIVE',
      },
      select: {
        circleId: true,
        role: true,
        attendanceRate: true,
        totalSessions: true,
        totalStudyTime: true,
        joinedAt: true,
        circle: {
          select: {
            id: true,
            name: true,
            description: true,
            coverImageUrl: true,
            maxMembers: true,
            isPrivate: true,
            subjects: true,
            goals: true,
            status: true,
            currentStreak: true,
            longestStreak: true,
            lastActivityAt: true,
            createdById: true,
            createdAt: true,
            // Get member count and basic member info in subquery
            members: {
              where: { status: 'ACTIVE' },
              select: {
                userId: true,
                role: true,
              },
            },
          },
        },
      },
    })

    // Filter archived if needed
    const filteredMemberships = includeArchived
      ? memberships
      : memberships.filter(m => m.circle.status !== 'ARCHIVED')

    // Get user info for all members (batch query to avoid N+1)
    const allMemberIds = [...new Set(
      filteredMemberships.flatMap(m => m.circle.members.map(member => member.userId))
    )]

    const users = allMemberIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: allMemberIds } },
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            presence: {
              select: {
                status: true,
                activityType: true,
              },
            },
          },
        })
      : []

    const userMap = new Map(users.map(u => [u.id, u]))

    // Format response
    const circles = filteredMemberships.map(membership => {
      const circle = membership.circle
      const memberCount = circle.members.length

      // Enrich members with user info
      const enrichedMembers = circle.members.map(member => {
        const userInfo = userMap.get(member.userId)
        return {
          userId: member.userId,
          role: member.role,
          name: userInfo?.name || 'Unknown',
          avatarUrl: userInfo?.avatarUrl || null,
          isOnline: userInfo?.presence?.status === 'ONLINE',
          activityType: userInfo?.presence?.activityType || null,
        }
      })

      return {
        id: circle.id,
        name: circle.name,
        description: circle.description,
        coverImageUrl: circle.coverImageUrl,
        subjects: circle.subjects,
        goals: circle.goals,
        status: circle.status,
        isPrivate: circle.isPrivate,
        maxMembers: circle.maxMembers,
        memberCount,
        currentStreak: circle.currentStreak,
        longestStreak: circle.longestStreak,
        lastActivityAt: circle.lastActivityAt,
        createdAt: circle.createdAt,
        isOwner: circle.createdById === user.id,
        myRole: membership.role,
        myStats: {
          attendanceRate: membership.attendanceRate,
          totalSessions: membership.totalSessions,
          totalStudyTime: membership.totalStudyTime,
          joinedAt: membership.joinedAt,
        },
        members: enrichedMembers,
      }
    })

    // Sort: Active circles first, then by last activity
    circles.sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === 'ACTIVE' ? -1 : 1
      }
      const aTime = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0
      const bTime = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0
      return bTime - aTime
    })

    return NextResponse.json({
      success: true,
      data: {
        circles,
        total: circles.length,
      },
    })
  } catch (error) {
    console.error('[Study Circles] GET Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/study-circles - Create a new study circle
export async function POST(req: NextRequest) {
  try {
    // Rate limit: 5 circles per hour
    const rateLimitResult = await rateLimit(req, {
      ...RateLimitPresets.strict,
      keyPrefix: 'study-circles-create',
      max: 5,
      windowMs: 60 * 60 * 1000, // 1 hour
    })
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many circles created. Please wait.' },
        { status: 429, headers: rateLimitResult.headers }
      )
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const {
      name,
      description,
      subjects = [],
      goals = [],
      maxMembers = 6,
      isPrivate = true,
    } = body

    // Validation
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return NextResponse.json(
        { error: 'Circle name must be at least 2 characters' },
        { status: 400 }
      )
    }

    if (name.length > 50) {
      return NextResponse.json(
        { error: 'Circle name must be less than 50 characters' },
        { status: 400 }
      )
    }

    if (description && description.length > 500) {
      return NextResponse.json(
        { error: 'Description must be less than 500 characters' },
        { status: 400 }
      )
    }

    if (maxMembers < 2 || maxMembers > 10) {
      return NextResponse.json(
        { error: 'Max members must be between 2 and 10' },
        { status: 400 }
      )
    }

    // Check user's existing active circles (limit to prevent abuse)
    const existingCircles = await prisma.studyCircleMember.count({
      where: {
        userId: user.id,
        status: 'ACTIVE',
        circle: { status: 'ACTIVE' },
      },
    })

    if (existingCircles >= 10) {
      return NextResponse.json(
        { error: 'You can only be in up to 10 active study circles' },
        { status: 400 }
      )
    }

    // Generate unique invite code
    const inviteCode = nanoid(8)

    // Create circle with owner as first member (transaction)
    const circle = await prisma.$transaction(async (tx) => {
      const newCircle = await tx.studyCircle.create({
        data: {
          name: name.trim(),
          description: description?.trim() || null,
          subjects: Array.isArray(subjects) ? subjects.slice(0, 5) : [],
          goals: Array.isArray(goals) ? goals.slice(0, 5) : [],
          maxMembers: Math.min(Math.max(maxMembers, 2), 10),
          isPrivate,
          inviteCode,
          createdById: user.id,
          lastActivityAt: new Date(),
        },
      })

      // Add creator as owner
      await tx.studyCircleMember.create({
        data: {
          circleId: newCircle.id,
          userId: user.id,
          role: 'OWNER',
          status: 'ACTIVE',
        },
      })

      return newCircle
    })

    return NextResponse.json({
      success: true,
      data: {
        id: circle.id,
        name: circle.name,
        inviteCode: circle.inviteCode,
      },
    })
  } catch (error) {
    console.error('[Study Circles] POST Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
