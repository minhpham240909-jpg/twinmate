import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
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

    // Find all groups where user is a member (exclude deleted groups)
    const memberships = await prisma.groupMember.findMany({
      where: {
        userId: user.id,
        group: {
          isDeleted: false,
        },
      },
      include: {
        group: {
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    avatarUrl: true,
                    presence: {
                      select: {
                        status: true
                      }
                    }
                  },
                },
              },
            },
          },
        },
      },
    })

    // Get all unique owner IDs
    const ownerIds = [...new Set(memberships.map(m => m.group.ownerId))]

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

    // Transform data to match frontend interface (no more async/await needed!)
    const groups = memberships.map((membership) => {
      const group = membership.group

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
        ownerName: ownerMap.get(group.ownerId) || 'Unknown',
        ownerId: group.ownerId,
        isMember: true, // Always true since we're fetching user's groups
        isOwner: group.ownerId === user.id,
        membersList: group.members.map(m => ({
          id: m.user.id,
          name: m.user.name,
          avatarUrl: m.user.avatarUrl,
          role: m.role,
          onlineStatus: m.user.presence?.status === 'online' ? 'ONLINE' : 'OFFLINE',
        })),
        createdAt: group.createdAt,
      }
    })

    return NextResponse.json({
      success: true,
      groups,
    })
  } catch (error) {
    console.error('Fetch my groups error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
