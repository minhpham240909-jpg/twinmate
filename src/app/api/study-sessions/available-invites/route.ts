import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get active study partners (ACCEPTED matches)
    const matches = await prisma.match.findMany({
      where: {
        OR: [
          { senderId: user.id, status: 'ACCEPTED' },
          { receiverId: user.id, status: 'ACCEPTED' },
        ],
      },
    })

    // Get user details for partners
    const partnerIds = matches.map((match) =>
      match.senderId === user.id ? match.receiverId : match.senderId
    )

    const partnerUsers = await prisma.user.findMany({
      where: {
        id: { in: partnerIds },
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
      },
    })

    // Get group members
    const groupMembers = await prisma.groupMember.findMany({
      where: {
        userId: user.id,
      },
      include: {
        group: {
          include: {
            members: {
              where: {
                userId: { not: user.id }, // Exclude current user
              },
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    avatarUrl: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    // Extract unique group member users
    const groupMemberUsers = groupMembers.flatMap((gm) =>
      gm.group.members.map((m) => m.user)
    )

    // Remove duplicates (user might be both partner and group member)
    const uniqueGroupMembers = groupMemberUsers.filter(
      (gUser, index, self) =>
        index === self.findIndex((u) => u.id === gUser.id) &&
        !partnerUsers.some((p) => p.id === gUser.id)
    )

    return NextResponse.json({
      success: true,
      partners: partnerUsers,
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
