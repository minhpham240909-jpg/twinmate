import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

// SCALABILITY: Bounds to prevent unbounded queries
const MAX_PARTNERS = 100
const MAX_GROUPS = 50
const MAX_GROUP_MEMBERS = 200

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get active study partners (ACCEPTED matches) - bounded
    const matches = await prisma.match.findMany({
      where: {
        OR: [
          { senderId: user.id, status: 'ACCEPTED' },
          { receiverId: user.id, status: 'ACCEPTED' },
        ],
      },
      take: MAX_PARTNERS,
    })

    // Get user details for partners with presence status
    const partnerIds = matches.map((match) =>
      match.senderId === user.id ? match.receiverId : match.senderId
    )

    // Create a Set for O(1) partner lookup
    const partnerIdSet = new Set(partnerIds)

    const partnerUsers = await prisma.user.findMany({
      where: {
        id: { in: partnerIds },
      },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        presence: {
          select: {
            status: true,
          },
        },
      },
    })

    // Map to include onlineStatus at top level
    const partnersWithStatus = partnerUsers.map((p) => ({
      id: p.id,
      name: p.name,
      avatarUrl: p.avatarUrl,
      onlineStatus: p.presence?.status === 'online' ? 'ONLINE' : 'OFFLINE',
    }))

    // Get all group IDs the user belongs to first (single query) - bounded
    const userGroupMemberships = await prisma.groupMember.findMany({
      where: { userId: user.id },
      select: { groupId: true },
      take: MAX_GROUPS,
      orderBy: { joinedAt: 'desc' },
    })

    const groupIds = userGroupMemberships.map(gm => gm.groupId)

    // Get all members from those groups in a single query (excluding current user) - bounded
    const allGroupMembers = groupIds.length > 0
      ? await prisma.groupMember.findMany({
          where: {
            groupId: { in: groupIds },
            userId: { not: user.id },
          },
          select: {
            user: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
                presence: {
                  select: {
                    status: true,
                  },
                },
              },
            },
          },
          take: MAX_GROUP_MEMBERS,
        })
      : []

    // Deduplicate using Map for O(n) instead of O(n²)
    const uniqueGroupMembersMap = new Map<string, typeof allGroupMembers[0]['user'] & { onlineStatus: string }>()

    for (const gm of allGroupMembers) {
      // Skip if already a partner or already added
      if (!partnerIdSet.has(gm.user.id) && !uniqueGroupMembersMap.has(gm.user.id)) {
        uniqueGroupMembersMap.set(gm.user.id, {
          ...gm.user,
          onlineStatus: gm.user.presence?.status === 'online' ? 'ONLINE' : 'OFFLINE',
        })
      }
    }

    const uniqueGroupMembers = Array.from(uniqueGroupMembersMap.values()).map(u => ({
      id: u.id,
      name: u.name,
      avatarUrl: u.avatarUrl,
      onlineStatus: u.onlineStatus,
    }))

    return NextResponse.json({
      success: true,
      partners: partnersWithStatus,
      groupMembers: uniqueGroupMembers,
    })
  } catch (error) {
    console.error('Error fetching available invites:', error)
    return NextResponse.json(
      { error: 'Failed to fetch available invites' },
      { status: 500 }
    )
  }
}
