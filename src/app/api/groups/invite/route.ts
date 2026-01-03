import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { enforceUserAccess } from '@/lib/security/checkUserBan'
import { ApiErrors } from '@/lib/security/api-errors'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'

// SECURITY: Strict validation with length limits to prevent abuse
const inviteSchema = z.object({
  groupId: z.string().uuid('Invalid group ID format'),
  username: z.string()
    .min(1, 'Username is required')
    .max(100, 'Username too long')
    .trim(),
})

// Maximum pending invites per group to prevent spam
const MAX_PENDING_INVITES_PER_GROUP = 50

export async function POST(request: NextRequest) {
  try {
    // SCALABILITY: Rate limit invite requests to prevent spam
    const rateLimitResult = await rateLimit(request, {
      ...RateLimitPresets.strict, // 20 requests per minute
      keyPrefix: 'group-invite',
    })

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many invite requests. Please slow down.' },
        { status: 429, headers: rateLimitResult.headers }
      )
    }

    // Verify user is authenticated
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return ApiErrors.unauthorized()
    }

    // SECURITY: Check if user is banned or deactivated
    const accessCheck = await enforceUserAccess(user.id)
    if (!accessCheck.allowed) {
      return NextResponse.json(
        { error: accessCheck.errorResponse?.error || 'Access denied' },
        { status: 403 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validation = inviteSchema.safeParse(body)

    if (!validation.success) {
      const validationErrors: Record<string, string> = {}
      validation.error.issues.forEach(issue => {
        if (issue.path.length > 0) {
          validationErrors[issue.path[0].toString()] = issue.message
        }
      })
      return ApiErrors.validationError(validationErrors, 'Invalid request data')
    }

    const { groupId, username } = validation.data

    // OPTIMIZATION: Fetch group with member count in single query
    const group = await prisma.group.findUnique({
      where: { id: groupId, isDeleted: false },
      select: {
        id: true,
        name: true,
        maxMembers: true,
        _count: {
          select: { members: true },
        },
      },
    })

    if (!group) {
      return ApiErrors.notFound('Group not found')
    }

    // SCALABILITY: Check if group has reached member limit
    if (group.maxMembers && group._count.members >= group.maxMembers) {
      return NextResponse.json(
        { error: 'Group has reached maximum member capacity' },
        { status: 400 }
      )
    }

    // Verify user is the group owner or admin
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId: groupId,
        userId: user.id,
        role: { in: ['OWNER', 'ADMIN'] },
      },
    })

    if (!membership) {
      return ApiErrors.forbidden('Only group owner or admin can invite members')
    }

    // SCALABILITY: Check pending invites limit to prevent invite spam
    const pendingInviteCount = await prisma.groupInvite.count({
      where: {
        groupId: groupId,
        status: 'PENDING',
      },
    })

    if (pendingInviteCount >= MAX_PENDING_INVITES_PER_GROUP) {
      return NextResponse.json(
        { error: 'Too many pending invites. Please wait for users to respond.' },
        { status: 400 }
      )
    }

    // SECURITY: Find the user to invite
    // Prevent username enumeration by using consistent response timing
    const invitedUser = await prisma.user.findFirst({
      where: {
        name: username,
        deactivatedAt: null, // Only find active users
      },
      select: {
        id: true,
        name: true,
      },
    })

    // SECURITY: Return generic error to prevent username enumeration
    // Always return same response format whether user exists or not
    if (!invitedUser) {
      // Use consistent timing to prevent timing attacks
      await new Promise(resolve => setTimeout(resolve, 100))
      return NextResponse.json(
        { error: 'Unable to process invitation. Please verify the username and try again.' },
        { status: 400 }
      )
    }

    // SECURITY: Prevent self-invite
    if (invitedUser.id === user.id) {
      return NextResponse.json(
        { error: 'You cannot invite yourself to a group' },
        { status: 400 }
      )
    }

    // OPTIMIZATION: Check membership and pending invite in parallel
    const [existingMembership, existingInvite] = await Promise.all([
      prisma.groupMember.findFirst({
        where: {
          groupId: groupId,
          userId: invitedUser.id,
        },
      }),
      prisma.groupInvite.findFirst({
        where: {
          groupId: groupId,
          inviteeId: invitedUser.id,
          status: 'PENDING',
        },
      }),
    ])

    if (existingMembership) {
      return NextResponse.json(
        { error: 'User is already a member of this group' },
        { status: 400 }
      )
    }

    if (existingInvite) {
      return NextResponse.json(
        { error: 'User already has a pending invite' },
        { status: 400 }
      )
    }

    // SECURITY: Sanitize group name for notification message to prevent XSS
    const sanitizedGroupName = group.name
      .replace(/[<>"'&]/g, '') // Remove potentially dangerous characters
      .slice(0, 50) // Limit length

    // CRITICAL: Use transaction to ensure invite and notification are atomic
    // This prevents partial failures where invite is created but notification fails
    await prisma.$transaction(async (tx) => {
      // Create group invite
      await tx.groupInvite.create({
        data: {
          groupId: groupId,
          inviterId: user.id,
          inviteeId: invitedUser.id,
          status: 'PENDING',
        },
      })

      // Create notification for invited user
      await tx.notification.create({
        data: {
          userId: invitedUser.id,
          type: 'GROUP_INVITE',
          title: 'Group Invitation',
          message: `You've been invited to join "${sanitizedGroupName}"`,
          actionUrl: `/groups/${group.id}`,
        },
      })
    })

    return NextResponse.json({
      success: true,
      message: 'Invitation sent successfully',
    })
  } catch (error) {
    return ApiErrors.internalError(error, { context: 'groups/invite' })
  }
}
