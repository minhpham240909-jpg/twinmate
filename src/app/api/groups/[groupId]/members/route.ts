import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const { groupId } = await params

    // Pagination parameters
    const searchParams = request.nextUrl.searchParams
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')))

    // Verify authentication
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if group exists and is not deleted
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { isDeleted: true }
    })

    if (!group || group.isDeleted) {
      return NextResponse.json(
        { error: 'Group not found' },
        { status: 404 }
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

    // Get total count for pagination
    const totalCount = await prisma.groupMember.count({
      where: { groupId }
    })

    // Get members with pagination and their user and presence info
    const skip = (page - 1) * limit
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
            presence: {
              select: {
                status: true
              }
            }
          }
        }
      },
      orderBy: [
        { role: 'asc' }, // OWNER first, then ADMIN, then MEMBER
        { joinedAt: 'asc' }
      ],
      skip,
      take: limit
    })

    // Format the response - use UserPresence.status for accurate online status
    const formattedMembers = members.map(member => ({
      id: member.user.id,
      name: member.user.name,
      avatarUrl: member.user.avatarUrl,
      role: member.role,
      onlineStatus: member.user.presence?.status === 'online' ? 'ONLINE' : 'OFFLINE'
    }))

    return NextResponse.json({
      success: true,
      members: formattedMembers,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: skip + members.length < totalCount
      }
    })
  } catch (error) {
    console.error('Error fetching group members:', error)
    return NextResponse.json(
      { error: 'Failed to fetch group members' },
      { status: 500 }
    )
  }
}

