import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createGroupSchema = z.object({
  name: z.string().min(1),
  subject: z.string().min(1),
  subjectCustomDescription: z.string().optional(),
  description: z.string().optional(),
  skillLevel: z.string().optional(),
  skillLevelCustomDescription: z.string().optional(),
  maxMembers: z.number().min(2).max(50).default(10),
  invitedUsernames: z.array(z.string()).optional().default([]),
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
    const validation = createGroupSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: validation.error.issues },
        { status: 400 }
      )
    }

    const {
      name,
      subject,
      subjectCustomDescription,
      description,
      skillLevel,
      skillLevelCustomDescription,
      maxMembers,
      invitedUsernames,
    } = validation.data

    // Create group and add creator as member in a single transaction
    const group = await prisma.$transaction(async (tx) => {
      const newGroup = await tx.group.create({
        data: {
          name,
          subject,
          subjectCustomDescription: subjectCustomDescription || null,
          description: description || null,
          skillLevel: skillLevel || null,
          skillLevelCustomDescription: skillLevelCustomDescription || null,
          maxMembers,
          ownerId: user.id,
          privacy: 'PUBLIC',
        },
      })

      // Add creator as first member (owner)
      await tx.groupMember.create({
        data: {
          groupId: newGroup.id,
          userId: user.id,
          role: 'OWNER',
        },
      })

      return newGroup
    })

    // Send invites to specified users
    if (invitedUsernames.length > 0) {
      // Find users by username
      const invitedUsers = await prisma.user.findMany({
        where: {
          name: {
            in: invitedUsernames,
          },
        },
        select: {
          id: true,
          name: true,
        },
      })

      // Create group invites
      const invitePromises = invitedUsers.map((invitedUser) =>
        prisma.groupInvite.create({
          data: {
            groupId: group.id,
            inviterId: user.id,
            inviteeId: invitedUser.id,
            status: 'PENDING',
          },
        })
      )

      await Promise.all(invitePromises)

      // Create notifications for invited users
      const notificationPromises = invitedUsers.map((invitedUser) =>
        prisma.notification.create({
          data: {
            userId: invitedUser.id,
            type: 'GROUP_INVITE',
            title: 'Group Invitation',
            message: `You've been invited to join "${group.name}"`,
            actionUrl: `/groups/${group.id}`,
          },
        })
      )

      await Promise.all(notificationPromises)
    }

    return NextResponse.json({
      success: true,
      group: {
        id: group.id,
        name: group.name,
        subject: group.subject,
      },
      invitesSent: invitedUsernames.length,
    })
  } catch (error) {
    console.error('Group creation error:', error)
    // Return detailed error for debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    )
  }
}
