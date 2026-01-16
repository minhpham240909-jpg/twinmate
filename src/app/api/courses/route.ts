import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

/**
 * GET /api/courses
 * Get user's enrolled courses or search for courses
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const institution = searchParams.get('institution')

    if (search) {
      // Search for courses to join
      const courses = await prisma.course.findMany({
        where: {
          isActive: true,
          OR: [
            { isPublic: true },
            { institution: institution || undefined },
          ],
          AND: [
            {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { code: { contains: search, mode: 'insensitive' } },
              ],
            },
          ],
        },
        include: {
          enrollments: {
            where: { leftAt: null },
            select: { id: true },
          },
        },
        orderBy: { name: 'asc' },
        take: 20,
      })

      return NextResponse.json({
        success: true,
        courses: courses.map(c => ({
          ...c,
          memberCount: c.enrollments.length,
          enrollments: undefined,
        })),
      })
    }

    // Get user's enrolled courses
    const enrollments = await prisma.courseEnrollment.findMany({
      where: {
        userId: user.id,
        leftAt: null,
      },
      include: {
        course: {
          include: {
            enrollments: {
              where: { leftAt: null },
              select: { id: true },
            },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    })

    return NextResponse.json({
      success: true,
      enrollments: enrollments.map(e => ({
        ...e,
        course: {
          ...e.course,
          memberCount: e.course.enrollments.length,
          enrollments: undefined,
        },
      })),
    })
  } catch (error) {
    console.error('[Courses GET] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch courses' },
      { status: 500 }
    )
  }
}

// Schema for creating a course
const createCourseSchema = z.object({
  name: z.string().min(1).max(200),
  code: z.string().min(1).max(20),
  section: z.string().max(20).optional(),
  institution: z.string().min(1).max(200),
  department: z.string().max(100).optional(),
  semester: z.string().max(50).optional(),
  year: z.number().int().min(2020).max(2100).optional(),
  description: z.string().max(1000).optional(),
  credits: z.number().int().min(0).max(20).optional(),
  isPublic: z.boolean().optional(),
})

/**
 * POST /api/courses
 * Create a new course (user becomes instructor)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validation = createCourseSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.issues },
        { status: 400 }
      )
    }

    const data = validation.data

    // Generate a unique join code
    const joinCode = generateJoinCode()

    // Create course and enroll user as instructor in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const course = await tx.course.create({
        data: {
          name: data.name,
          code: data.code.toUpperCase(),
          section: data.section,
          institution: data.institution,
          department: data.department,
          semester: data.semester,
          year: data.year,
          description: data.description,
          credits: data.credits,
          isPublic: data.isPublic ?? false,
          joinCode,
        },
      })

      // Enroll creator as instructor
      await tx.courseEnrollment.create({
        data: {
          userId: user.id,
          courseId: course.id,
          role: 'INSTRUCTOR',
        },
      })

      return course
    })

    return NextResponse.json({
      success: true,
      course: result,
      message: 'Course created! Share the join code with your classmates.',
    })
  } catch (error) {
    console.error('[Courses POST] Error:', error)

    // Check for unique constraint violation
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json(
        { error: 'A course with this code already exists for this institution/semester' },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create course' },
      { status: 500 }
    )
  }
}

/**
 * Generate a 6-character join code
 */
function generateJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // No confusing chars
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}
