import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { CONTENT_LIMITS, STUDY_SESSION } from '@/lib/constants'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { enforceUserAccess } from '@/lib/security/checkUserBan'

const createGroupSchema = z.object({
  name: z.string().min(1).max(CONTENT_LIMITS.GROUP_NAME_MAX),
  subject: z.string().min(1),
  subjectCustomDescription: z.string().max(500).optional(),
  description: z.string().max(CONTENT_LIMITS.GROUP_DESCRIPTION_MAX).optional(),
  skillLevel: z.string().optional(),
  skillLevelCustomDescription: z.string().max(500).optional(),
  maxMembers: z.number().min(2).max(STUDY_SESSION.MAX_PARTICIPANTS).default(10),
  invitedUsernames: z.array(z.string()).optional().default([]),
})

export async function POST(request: NextRequest) {
  // Rate limiting: 5 groups per minute
  const rateLimitResult = await rateLimit(request, { ...RateLimitPresets.strict, keyPrefix: 'groups' })
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many groups created. Please wait a moment.' },
      { status: 429, headers: rateLimitResult.headers }
    )
  }

  try {
    // Verify user is authenticated
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error('[groups/create] Auth error:', authError?.message || 'No user')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is banned or deactivated
    let accessCheck
    try {
      accessCheck = await enforceUserAccess(user.id)
    } catch (accessError) {
      console.error('[groups/create] Access check error:', accessError)
      return NextResponse.json(
        { error: 'Database connection failed during access check', details: accessError instanceof Error ? accessError.message : 'Unknown error' },
        { status: 503 }
      )
    }
    if (!accessCheck.allowed) {
      return NextResponse.json(accessCheck.errorResponse, { status: 403 })
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
    let group
    try {
      group = await prisma.$transaction(async (tx) => {
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
    } catch (dbError) {
      console.error('[groups/create] Database transaction error:', dbError)
      return NextResponse.json(
        { error: 'Failed to create group', details: dbError instanceof Error ? dbError.message : 'Unknown database error' },
        { status: 503 }
      )
    }

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
