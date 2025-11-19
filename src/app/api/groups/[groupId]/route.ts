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

    // Fetch group with members
    const group = await prisma.group.findUnique({
      where: { id: groupId },
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
              }
            }
          },
          orderBy: [
            { role: 'asc' }, // OWNER first, then ADMIN, then MEMBER
            { joinedAt: 'asc' }
          ]
        }
      }
    })

    if (!group || group.isDeleted) {
      return NextResponse.json(
        { error: 'Group not found' },
        { status: 404 }
      )
    }

    // Fetch owner info
    const owner = await prisma.user.findUnique({
      where: { id: group.ownerId },
      select: {
        id: true,
        name: true,
        avatarUrl: true
      }
    })

    // Check if current user is a member
    const membership = group.members.find(m => m.userId === user.id)
    const isMember = !!membership
    const isOwner = group.ownerId === user.id

    // Format members list
    const membersList = group.members.map(m => ({
      id: m.user.id,
      name: m.user.name,
      avatarUrl: m.user.avatarUrl,
      role: m.role,
      onlineStatus: m.user.presence?.status === 'online' ? 'ONLINE' : 'OFFLINE',
      joinedAt: m.joinedAt
    }))

    // Return group data
    return NextResponse.json({
      success: true,
      group: {
        id: group.id,
        name: group.name,
        description: group.description,
        subject: group.subject,
        subjectCustomDescription: group.subjectCustomDescription,
        skillLevel: group.skillLevel,
        skillLevelCustomDescription: group.skillLevelCustomDescription,
        maxMembers: group.maxMembers,
        memberCount: group.members.length,
        avatarUrl: group.avatarUrl,
        owner: {
          id: owner?.id || group.ownerId,
          name: owner?.name || 'Unknown',
          avatarUrl: owner?.avatarUrl || null
        },
        members: membersList,
        isMember,
        isOwner,
        userRole: membership?.role || null,
        createdAt: group.createdAt
      }
    })
  } catch (error) {
    console.error('Error fetching group:', error)
    return NextResponse.json(
      { error: 'Failed to fetch group details' },
      { status: 500 }
    )
  }
}
