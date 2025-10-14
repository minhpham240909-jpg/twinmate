import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const leaveSchema = z.object({
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
    const validation = leaveSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: validation.error.issues },
        { status: 400 }
      )
    }

    const { groupId } = validation.data

    // Check if group exists
    const group = await prisma.group.findUnique({
      where: { id: groupId },
    })

    if (!group) {
      return NextResponse.json(
        { error: 'Group not found' },
        { status: 404 }
      )
    }

    // Owners cannot leave their own group
    if (group.ownerId === user.id) {
      return NextResponse.json(
        { error: 'Group owners cannot leave. Please delete the group or transfer ownership first.' },
        { status: 400 }
      )
    }

    // Check if user is a member
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId: groupId,
        userId: user.id,
      },
    })

    if (!membership) {
      return NextResponse.json(
        { error: 'You are not a member of this group' },
        { status: 400 }
      )
    }

    // Remove user from group
    await prisma.groupMember.delete({
      where: {
        id: membership.id,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Successfully left group',
    })
  } catch (error) {
    console.error('Leave group error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
