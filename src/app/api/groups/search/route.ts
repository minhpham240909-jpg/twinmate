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

    // Search in custom descriptions and group description (improved fuzzy search)
    if (subjectCustomDescription || skillLevelCustomDescription || description) {
      const searchTerms: string[] = []

      if (subjectCustomDescription) searchTerms.push(subjectCustomDescription)
      if (skillLevelCustomDescription) searchTerms.push(skillLevelCustomDescription)
      if (description) searchTerms.push(description)

      // Split all search terms into words for better partial matching
      const keywords = searchTerms
        .flatMap(term => term.toLowerCase().split(/\s+/))
        .filter(word => word.length > 0) // Allow all words, even short ones

      // Create OR conditions for each keyword searching in ALL group fields
      const searchConditions = keywords.map(keyword => ({
        OR: [
          { name: { contains: keyword, mode: 'insensitive' as const } },
          { description: { contains: keyword, mode: 'insensitive' as const } },
          { subjectCustomDescription: { contains: keyword, mode: 'insensitive' as const } },
          { skillLevelCustomDescription: { contains: keyword, mode: 'insensitive' as const } },
          { subject: { contains: keyword, mode: 'insensitive' as const } },
          { skillLevel: { contains: keyword, mode: 'insensitive' as const } },
        ],
      }))

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

    // Get all unique owner IDs
    const ownerIds = [...new Set(groups.map(g => g.ownerId))]

    // Fetch all owners in ONE batch query
    const owners = await prisma.user.findMany({
      where: {
        id: { in: ownerIds }
      },
      select: {
        id: true,
        name: true,
      },
    })

    // Create map for O(1) lookups
    const ownerMap = new Map(owners.map(o => [o.id, o.name]))

    // Get all search keywords for ranking
    const allSearchKeywords: string[] = []
    if (subject) allSearchKeywords.push(...subject.toLowerCase().split(/\s+/))
    if (subjectCustomDescription) allSearchKeywords.push(...subjectCustomDescription.toLowerCase().split(/\s+/))
    if (skillLevelCustomDescription) allSearchKeywords.push(...skillLevelCustomDescription.toLowerCase().split(/\s+/))
    if (description) allSearchKeywords.push(...description.toLowerCase().split(/\s+/))
    const uniqueKeywords = [...new Set(allSearchKeywords)].filter(w => w.length > 0)

    // Get owner information and calculate match scores for ranking
    const groupsWithDetails = groups.map((group) => {
      // Check if current user is a member
      const isMember = group.members.some(member => member.userId === user.id)
      const isOwner = group.ownerId === user.id
      const ownerName = ownerMap.get(group.ownerId) || 'Unknown'

      // Calculate match score for ranking
      let matchScore = 0
      if (uniqueKeywords.length > 0) {
        const groupText = [
          group.name,
          group.description,
          group.subject,
          group.subjectCustomDescription,
          group.skillLevelCustomDescription,
          group.skillLevel,
          ownerName,
        ].filter(Boolean).join(' ').toLowerCase()

        uniqueKeywords.forEach(keyword => {
          if (groupText.includes(keyword)) matchScore++
        })
      }

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
        ownerName,
        ownerId: group.ownerId,
        isMember,
        isOwner,
        createdAt: group.createdAt,
        matchScore,
      }
    })

    // Sort by match score (higher scores first), then by creation date
    groupsWithDetails.sort((a, b) => {
      if (b.matchScore !== a.matchScore) {
        return b.matchScore - a.matchScore
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

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
