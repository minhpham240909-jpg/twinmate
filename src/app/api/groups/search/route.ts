import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import {
  buildSmartSearchConditions,
  calculateRelevanceScore,
  expandSearchTerms,
} from '@/lib/matching/smart-search'

const searchSchema = z.object({
  subject: z.string().optional(),
  subjectCustomDescription: z.string().optional(),
  skillLevel: z.string().optional(),
  skillLevelCustomDescription: z.string().optional(),
  description: z.string().optional(),
  query: z.string().optional(), // General search query for smart matching
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
      query,
      page,
      limit,
    } = validation.data

    // Build WHERE clause for filtering
    const whereConditions: {
      AND: Array<Record<string, unknown>>
    } = {
      AND: [
        // Only show PUBLIC groups that are not deleted
        { privacy: 'PUBLIC' },
        { isDeleted: false },
      ],
    }

    // Combine all search terms for smart matching
    const allSearchTerms: string[] = []
    if (query) allSearchTerms.push(query)
    if (subject) allSearchTerms.push(subject)
    if (subjectCustomDescription) allSearchTerms.push(subjectCustomDescription)
    if (skillLevelCustomDescription) allSearchTerms.push(skillLevelCustomDescription)
    if (description) allSearchTerms.push(description)

    const combinedQuery = allSearchTerms.join(' ').trim()

    // Use smart search with synonym expansion for better matching
    if (combinedQuery) {
      // Get expanded terms (e.g., "math" expands to include "mathematics", "algebra", "calculus", etc.)
      const expandedTerms = expandSearchTerms(
        combinedQuery.toLowerCase().split(/\s+/).filter(t => t.length > 0)
      )

      // Filter out common words and duplicates
      const uniqueTerms = [...new Set(expandedTerms)].filter(term =>
        term.length > 1 && !['the', 'a', 'an', 'and', 'or', 'is', 'in', 'to', 'for'].includes(term)
      )

      // Build search conditions for each term across all fields
      if (uniqueTerms.length > 0) {
        const searchConditions = uniqueTerms.map(term => ({
          OR: [
            { name: { contains: term, mode: 'insensitive' as const } },
            { description: { contains: term, mode: 'insensitive' as const } },
            { subjectCustomDescription: { contains: term, mode: 'insensitive' as const } },
            { skillLevelCustomDescription: { contains: term, mode: 'insensitive' as const } },
            { subject: { contains: term, mode: 'insensitive' as const } },
            { skillLevel: { contains: term, mode: 'insensitive' as const } },
          ],
        }))

        whereConditions.AND.push({
          OR: searchConditions,
        })
      }
    }

    // Filter by exact skill level if specified (in addition to text search)
    if (skillLevel && skillLevel !== '') {
      whereConditions.AND.push({
        skillLevel: skillLevel,
      })
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

    // Get owner information and calculate match scores using smart relevance algorithm
    const groupsWithDetails = groups.map((group) => {
      // Check if current user is a member
      const isMember = group.members.some(member => member.userId === user.id)
      const isOwner = group.ownerId === user.id
      const ownerName = ownerMap.get(group.ownerId) || 'Unknown'

      // Calculate match score using smart relevance scoring (with synonym expansion)
      let matchScore = 0
      if (combinedQuery) {
        matchScore = calculateRelevanceScore(combinedQuery, {
          name: group.name,
          description: group.description,
          subject: group.subject,
          subjectCustomDescription: group.subjectCustomDescription,
          skillLevel: group.skillLevel,
          skillLevelCustomDescription: group.skillLevelCustomDescription,
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
