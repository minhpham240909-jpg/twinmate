import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const joinSchema = z.object({
  groupId: z.string(),
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
    const validation = joinSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: validation.error.issues },
        { status: 400 }
      )
    }

    const { groupId } = validation.data

    // Check if group exists and is public
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: true,
      },
    })

    if (!group) {
      return NextResponse.json(
        { error: 'Group not found' },
        { status: 404 }
      )
    }

    if (group.privacy !== 'PUBLIC') {
      return NextResponse.json(
        { error: 'This group is not public' },
        { status: 403 }
      )
    }

    // Check if user is already a member
    const existingMember = group.members.find(member => member.userId === user.id)
    if (existingMember) {
      return NextResponse.json(
        { error: 'You are already a member of this group' },
        { status: 400 }
      )
    }

    // Atomically check capacity and add member in a transaction to prevent race conditions
    try {
      await prisma.$transaction(async (tx) => {
        // Re-check capacity inside transaction (prevents concurrent joins exceeding max)
        const currentMemberCount = await tx.groupMember.count({
          where: { groupId },
        })

        if (currentMemberCount >= group.maxMembers) {
          throw new Error('GROUP_FULL')
        }

        // Add user to group
        await tx.groupMember.create({
          data: {
            groupId: groupId,
            userId: user.id,
            role: 'MEMBER',
          },
        })

        // Create notification for group owner
        await tx.notification.create({
          data: {
            userId: group.ownerId,
            type: 'MATCH_ACCEPTED',
            title: 'New Member',
            message: `Someone joined your group "${group.name}"`,
            actionUrl: `/groups/${groupId}`,
          },
        })
      })
    } catch (txError: unknown) {
      if (txError instanceof Error && txError.message === 'GROUP_FULL') {
        return NextResponse.json(
          { error: 'Group is full' },
          { status: 400 }
        )
      }
      // Re-throw other errors
      throw txError
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully joined group',
      groupId,
    })
  } catch (error) {
    console.error('Join group error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
