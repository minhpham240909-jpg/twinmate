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

    // Find all groups where user is a member
    const memberships = await prisma.groupMember.findMany({
      where: {
        userId: user.id,
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
                  },
                },
              },
            },
          },
        },
      },
    })

    // Transform data to match frontend interface
    const groups = await Promise.all(
      memberships.map(async (membership) => {
        const group = membership.group

        // Get owner information
        const owner = await prisma.user.findUnique({
          where: { id: group.ownerId },
          select: { name: true },
        })

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
          isMember: true, // Always true since we're fetching user's groups
          isOwner: group.ownerId === user.id,
          membersList: group.members.map(m => ({
            id: m.user.id,
            name: m.user.name,
            avatarUrl: m.user.avatarUrl,
            role: m.role,
          })),
          createdAt: group.createdAt,
        }
      })
    )

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
