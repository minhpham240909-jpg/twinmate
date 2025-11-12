import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const { groupId } = await params

    // Verify authentication
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is a member of the group
    const membership = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId: user.id
        }
      }
    })

    if (!membership) {
      return NextResponse.json(
        { error: 'You are not a member of this group' },
        { status: 403 }
      )
    }

    // Get all members with their user and profile info
    const members = await prisma.groupMember.findMany({
      where: {
        groupId
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            profile: {
              select: {
                onlineStatus: true
              }
            }
          }
        }
      },
      orderBy: [
        { role: 'asc' }, // OWNER first, then ADMIN, then MEMBER
        { joinedAt: 'asc' }
      ]
    })

    // Format the response
    const formattedMembers = members.map(member => ({
      id: member.user.id,
      name: member.user.name,
      avatarUrl: member.user.avatarUrl,
      role: member.role,
      onlineStatus: member.user.profile?.onlineStatus || 'OFFLINE'
    }))

    return NextResponse.json({
      success: true,
      members: formattedMembers
    })
  } catch (error) {
    console.error('Error fetching group members:', error)
    return NextResponse.json(
      { error: 'Failed to fetch group members' },
      { status: 500 }
    )
  }
}

