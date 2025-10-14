import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const searchSchema = z.object({
  subject: z.string().optional(),
  subjectCustomDescription: z.string().optional(),
  skillLevel: z.string().optional(),
  skillLevelCustomDescription: z.string().optional(),
  description: z.string().optional(),
  page: z.number().optional().default(1),
  limit: z.number().optional().default(20),
})

export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validation = searchSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: validation.error.issues },
        { status: 400 }
      )
    }

    const {
      subject,
      subjectCustomDescription,
      skillLevel,
      skillLevelCustomDescription,
      description,
      page,
      limit,
    } = validation.data

    // Build WHERE clause for filtering
    const whereConditions: {
      AND: Array<Record<string, unknown>>
    } = {
      AND: [
        // Only show PUBLIC groups
        { privacy: 'PUBLIC' },
      ],
    }

    // Filter by subject
    if (subject && subject.trim() !== '') {
      whereConditions.AND.push({
        subject: {
          contains: subject,
          mode: 'insensitive',
        },
      })
    }

    // Filter by skill level
    if (skillLevel && skillLevel !== '') {
      whereConditions.AND.push({
        skillLevel: skillLevel,
      })
    }

    // Search in custom descriptions and group description
    if (subjectCustomDescription || skillLevelCustomDescription || description) {
      const searchTerms: string[] = []

      if (subjectCustomDescription) searchTerms.push(subjectCustomDescription)
      if (skillLevelCustomDescription) searchTerms.push(skillLevelCustomDescription)
      if (description) searchTerms.push(description)

      // Create OR conditions for each search term
      const searchConditions = searchTerms.flatMap(term => {
        const keywords = term.toLowerCase().split(/\s+/).filter(word => word.length > 2)

        return keywords.map(keyword => ({
          OR: [
            { description: { contains: keyword, mode: 'insensitive' as const } },
            { subjectCustomDescription: { contains: keyword, mode: 'insensitive' as const } },
            { skillLevelCustomDescription: { contains: keyword, mode: 'insensitive' as const } },
            { subject: { contains: keyword, mode: 'insensitive' as const } },
          ],
        }))
      })

      if (searchConditions.length > 0) {
        whereConditions.AND.push({
          OR: searchConditions,
        })
      }
    }

    // Calculate pagination
    const skip = (page - 1) * limit

    // Fetch matching groups with owner and member count
    const groups = await prisma.group.findMany({
      where: whereConditions,
      include: {
        members: {
          select: {
            userId: true,
            role: true,
            user: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip: skip,
      take: limit,
    })

    // Get total count for pagination
    const totalCount = await prisma.group.count({
      where: whereConditions,
    })

    // Get owner information for each group
    const groupsWithDetails = await Promise.all(
      groups.map(async (group) => {
        const owner = await prisma.user.findUnique({
          where: { id: group.ownerId },
          select: { name: true },
        })

        // Check if current user is a member
        const isMember = group.members.some(member => member.userId === user.id)
        const isOwner = group.ownerId === user.id

        return {
          id: group.id,
          name: group.name,
          description: group.description,
          subject: group.subject,
          subjectCustomDescription: group.subjectCustomDescription,
          skillLevel: group.skillLevel,
          skillLevelCustomDescription: group.skillLevelCustomDescription,
          maxMembers: group.maxMembers,
          memberCount: group.members.length,
          ownerName: owner?.name || 'Unknown',
          ownerId: group.ownerId,
          isMember,
          isOwner,
          createdAt: group.createdAt,
        }
      })
    )

    return NextResponse.json({
      success: true,
      groups: groupsWithDetails,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    })
  } catch (error) {
    console.error('Group search error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
