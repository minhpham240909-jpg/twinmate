import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

// Pagination defaults for large classes
const DEFAULT_PAGE_SIZE = 50
const MAX_PAGE_SIZE = 100

/**
 * GET /api/courses/[courseId]
 * Get course details with classmates (the social anchor!)
 *
 * Supports pagination for large classes (500+ students):
 * - ?page=1&limit=50 for paginated classmates
 * - Always returns studying/online classmates first (no pagination)
 * - Paginated "all" list for browsing
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { courseId } = await params
    const { searchParams } = new URL(request.url)

    // Pagination params
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(searchParams.get('limit') || String(DEFAULT_PAGE_SIZE))))
    const skip = (page - 1) * limit

    // Check if user is enrolled
    const enrollment = await prisma.courseEnrollment.findUnique({
      where: {
        userId_courseId: {
          userId: user.id,
          courseId,
        },
      },
    })

    if (!enrollment || enrollment.leftAt !== null) {
      return NextResponse.json(
        { error: 'You are not enrolled in this course' },
        { status: 403 }
      )
    }

    // Get course info and total member count
    const [course, totalMembers] = await Promise.all([
      prisma.course.findUnique({
        where: { id: courseId },
        select: {
          id: true,
          name: true,
          code: true,
          section: true,
          institution: true,
          semester: true,
          joinCode: true,
        },
      }),
      prisma.courseEnrollment.count({
        where: { courseId, leftAt: null },
      }),
    ])

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }

    const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000)

    // OPTIMIZATION: For large classes, fetch in two queries:
    // 1. Online/studying classmates (always shown, no pagination) - limited to 20
    // 2. Paginated all classmates list

    // Query 1: Get online/studying classmates (up to 20, prioritized)
    const activeClassmates = await prisma.courseEnrollment.findMany({
      where: {
        courseId,
        leftAt: null,
        userId: { not: user.id },
        user: {
          presence: {
            lastSeenAt: { gte: threeMinutesAgo },
          },
        },
      },
      include: {
        user: {
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
        },
      },
      orderBy: { weeklyStudyMinutes: 'desc' },
      take: 20, // Limit active classmates display
    })

    // Query 2: Get paginated all classmates
    const paginatedClassmates = await prisma.courseEnrollment.findMany({
      where: {
        courseId,
        leftAt: null,
        userId: { not: user.id },
      },
      include: {
        user: {
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
        },
      },
      orderBy: [
        { weeklyStudyMinutes: 'desc' },
        { currentStreak: 'desc' },
      ],
      skip,
      take: limit,
    })

    // Transform active classmates
    const transformClassmate = (e: typeof activeClassmates[0]) => {
      const isOnline = e.user.presence?.lastSeenAt &&
        new Date(e.user.presence.lastSeenAt) > threeMinutesAgo
      const isStudying = e.user.presence?.activityType === 'studying' ||
        e.user.presence?.activityType === 'with_ai'

      return {
        id: e.user.id,
        name: e.user.name,
        avatarUrl: e.user.avatarUrl,
        role: e.role,
        isOnline,
        isStudying,
        activityType: isOnline ? e.user.presence?.activityType : null,
        weeklyMinutes: e.weeklyStudyMinutes,
        weeklySessions: e.weeklySessions,
        currentStreak: e.currentStreak,
      }
    }

    const activeTransformed = activeClassmates.map(transformClassmate)
    const studyingNow = activeTransformed.filter(c => c.isStudying)
    const onlineNow = activeTransformed.filter(c => c.isOnline && !c.isStudying)
    const allClassmates = paginatedClassmates.map(transformClassmate)

    // Calculate pagination info
    const totalClassmates = totalMembers - 1 // Exclude current user
    const totalPages = Math.ceil(totalClassmates / limit)

    return NextResponse.json({
      success: true,
      course: {
        id: course.id,
        name: course.name,
        code: course.code,
        section: course.section,
        institution: course.institution,
        semester: course.semester,
        joinCode: enrollment.role === 'INSTRUCTOR' ? course.joinCode : undefined,
        memberCount: totalMembers,
      },
      userEnrollment: {
        role: enrollment.role,
        weeklyMinutes: enrollment.weeklyStudyMinutes,
        weeklySessions: enrollment.weeklySessions,
        currentStreak: enrollment.currentStreak,
        totalMinutes: enrollment.totalStudyMinutes,
      },
      classmates: {
        studyingNow,
        onlineNow,
        all: allClassmates,
      },
      pagination: {
        page,
        limit,
        totalClassmates,
        totalPages,
        hasMore: page < totalPages,
      },
    })
  } catch (error) {
    console.error('[Course GET] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch course' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/courses/[courseId]
 * Leave a course
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { courseId } = await params

    // Find enrollment
    const enrollment = await prisma.courseEnrollment.findUnique({
      where: {
        userId_courseId: {
          userId: user.id,
          courseId,
        },
      },
    })

    if (!enrollment || enrollment.leftAt !== null) {
      return NextResponse.json(
        { error: 'You are not enrolled in this course' },
        { status: 404 }
      )
    }

    // Soft delete - mark as left
    await prisma.courseEnrollment.update({
      where: { id: enrollment.id },
      data: { leftAt: new Date() },
    })

    return NextResponse.json({
      success: true,
      message: 'You have left the course',
    })
  } catch (error) {
    console.error('[Course DELETE] Error:', error)
    return NextResponse.json(
      { error: 'Failed to leave course' },
      { status: 500 }
    )
  }
}
