import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const joinCourseSchema = z.object({
  joinCode: z.string().length(6).toUpperCase(),
})

/**
 * POST /api/courses/join
 * Join a course using a join code
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validation = joinCourseSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid join code format' },
        { status: 400 }
      )
    }

    const { joinCode } = validation.data

    // Find the course by join code
    const course = await prisma.course.findUnique({
      where: { joinCode: joinCode.toUpperCase() },
      include: {
        enrollments: {
          where: { leftAt: null },
          select: { id: true },
        },
      },
    })

    if (!course) {
      return NextResponse.json(
        { error: 'Invalid join code. Please check and try again.' },
        { status: 404 }
      )
    }

    if (!course.isActive) {
      return NextResponse.json(
        { error: 'This course is no longer active.' },
        { status: 400 }
      )
    }

    // Check if already enrolled
    const existingEnrollment = await prisma.courseEnrollment.findUnique({
      where: {
        userId_courseId: {
          userId: user.id,
          courseId: course.id,
        },
      },
    })

    if (existingEnrollment) {
      if (existingEnrollment.leftAt === null) {
        return NextResponse.json(
          { error: 'You are already enrolled in this course.' },
          { status: 400 }
        )
      }

      // Re-enroll (user previously left)
      await prisma.courseEnrollment.update({
        where: { id: existingEnrollment.id },
        data: {
          leftAt: null,
          joinedAt: new Date(),
          role: 'STUDENT',
        },
      })

      return NextResponse.json({
        success: true,
        course: {
          ...course,
          memberCount: course.enrollments.length + 1,
          enrollments: undefined,
        },
        message: `Welcome back to ${course.name}!`,
      })
    }

    // Create new enrollment
    await prisma.courseEnrollment.create({
      data: {
        userId: user.id,
        courseId: course.id,
        role: 'STUDENT',
      },
    })

    return NextResponse.json({
      success: true,
      course: {
        ...course,
        memberCount: course.enrollments.length + 1,
        enrollments: undefined,
      },
      message: `Welcome to ${course.name}!`,
    })
  } catch (error) {
    console.error('[Courses Join] Error:', error)
    return NextResponse.json(
      { error: 'Failed to join course' },
      { status: 500 }
    )
  }
}
