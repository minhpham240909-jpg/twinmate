import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { PAGINATION } from '@/lib/constants'
import { validatePaginationLimit, validatePositiveInt } from '@/lib/validation'

// GET /api/history/groups - Get user's group activity history
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = validatePaginationLimit(searchParams.get('limit'), PAGINATION.HISTORY_LIMIT)
    const offset = validatePositiveInt(searchParams.get('offset'), 0)

    // Get groups user has joined
    const memberships = await prisma.groupMember.findMany({
      where: {
        userId: user.id,
        group: {
          isDeleted: false,
        } as any,
      },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            description: true,
            subject: true,
            avatarUrl: true,
            privacy: true,
            maxMembers: true,
            ownerId: true,
            createdAt: true,
            updatedAt: true,
            members: {
              take: 100, // Limit members to prevent unbounded queries
              select: {
                id: true,
                userId: true,
                role: true,
                joinedAt: true,
              },
            },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
      take: limit,
      skip: offset,
    })

    // Get groups user has created
    const createdGroups = await prisma.group.findMany({
      where: {
        ownerId: user.id,
        isDeleted: false,
      } as any,
      include: {
        members: {
          take: 100, // Limit members to prevent unbounded queries
          select: {
            id: true,
            userId: true,
            role: true,
            joinedAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    // Get group invites
    const invites = await prisma.groupInvite.findMany({
      where: {
        inviteeId: user.id,
      },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    return NextResponse.json({
      joinedGroups: memberships.map(m => ({
        ...m.group,
        userRole: m.role,
        joinedAt: m.joinedAt,
      })),
      createdGroups: createdGroups.map(g => ({
        ...g,
        memberCount: g.members.length,
      })),
      invites: invites.map(invite => ({
        id: invite.id,
        status: invite.status,
        message: invite.message,
        createdAt: invite.createdAt,
        respondedAt: invite.respondedAt,
        group: invite.group,
      })),
      statistics: {
        totalJoined: memberships.length,
        totalCreated: createdGroups.length,
        pendingInvites: invites.filter(i => i.status === 'PENDING').length,
      },
    })
  } catch (error) {
    console.error('Error fetching groups:', error)
    return NextResponse.json(
      { error: 'Failed to fetch groups' },
      { status: 500 }
    )
  }
}

