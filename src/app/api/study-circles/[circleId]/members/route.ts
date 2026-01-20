// Study Circle Members API - Join, Leave, Invite, Remove members
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import logger from '@/lib/logger'

interface RouteParams {
  params: Promise<{ circleId: string }>
}

// POST /api/study-circles/[circleId]/members - Join circle or invite member
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { circleId } = await params

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { action, inviteCode, userId: targetUserId } = body

    // Get circle info
    // PERF: Added take limit to prevent loading 1000+ members into memory
    const circle = await prisma.studyCircle.findUnique({
      where: { id: circleId },
      select: {
        id: true,
        name: true,
        maxMembers: true,
        isPrivate: true,
        inviteCode: true,
        status: true,
        members: {
          where: { status: 'ACTIVE' },
          select: { userId: true, role: true },
          take: 500, // PERF: Limit to max reasonable circle size
        },
      },
    })

    if (!circle) {
      return NextResponse.json({ error: 'Circle not found' }, { status: 404 })
    }

    if (circle.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'This circle is not active' }, { status: 400 })
    }

    const currentMemberCount = circle.members.length
    const userMembership = circle.members.find(m => m.userId === user.id)

    // Handle different actions
    switch (action) {
      case 'join': {
        // Check if already a member
        if (userMembership) {
          return NextResponse.json({ error: 'Already a member of this circle' }, { status: 400 })
        }

        // Check if circle is full
        if (currentMemberCount >= circle.maxMembers) {
          return NextResponse.json({ error: 'This circle is full' }, { status: 400 })
        }

        // For private circles, require invite code
        if (circle.isPrivate) {
          if (!inviteCode || inviteCode !== circle.inviteCode) {
            return NextResponse.json({ error: 'Invalid invite code' }, { status: 403 })
          }
        }

        // Check user's circle limit
        const userCircleCount = await prisma.studyCircleMember.count({
          where: {
            userId: user.id,
            status: 'ACTIVE',
            circle: { status: 'ACTIVE' },
          },
        })

        if (userCircleCount >= 10) {
          return NextResponse.json(
            { error: 'You can only be in up to 10 active study circles' },
            { status: 400 }
          )
        }

        // Join the circle
        await prisma.studyCircleMember.create({
          data: {
            circleId,
            userId: user.id,
            role: 'MEMBER',
            status: 'ACTIVE',
          },
        })

        // Update circle's last activity
        await prisma.studyCircle.update({
          where: { id: circleId },
          data: { lastActivityAt: new Date() },
        })

        return NextResponse.json({
          success: true,
          message: `Successfully joined ${circle.name}`,
        })
      }

      case 'invite': {
        // Only admins/owners can invite
        if (!userMembership || (userMembership.role !== 'OWNER' && userMembership.role !== 'ADMIN')) {
          return NextResponse.json({ error: 'Only owners and admins can invite members' }, { status: 403 })
        }

        if (!targetUserId) {
          return NextResponse.json({ error: 'User ID required for invite' }, { status: 400 })
        }

        // Check if target user exists
        const targetUser = await prisma.user.findUnique({
          where: { id: targetUserId },
          select: { id: true, deactivatedAt: true },
        })

        if (!targetUser || targetUser.deactivatedAt) {
          return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        // Check if already a member or invited
        const existingMembership = await prisma.studyCircleMember.findUnique({
          where: {
            circleId_userId: { circleId, userId: targetUserId },
          },
        })

        if (existingMembership) {
          if (existingMembership.status === 'ACTIVE') {
            return NextResponse.json({ error: 'User is already a member' }, { status: 400 })
          }
          if (existingMembership.status === 'INVITED') {
            return NextResponse.json({ error: 'User has already been invited' }, { status: 400 })
          }
        }

        // Check if circle is full
        if (currentMemberCount >= circle.maxMembers) {
          return NextResponse.json({ error: 'This circle is full' }, { status: 400 })
        }

        // Create invite
        if (existingMembership) {
          await prisma.studyCircleMember.update({
            where: { id: existingMembership.id },
            data: { status: 'INVITED', leftAt: null },
          })
        } else {
          await prisma.studyCircleMember.create({
            data: {
              circleId,
              userId: targetUserId,
              role: 'MEMBER',
              status: 'INVITED',
            },
          })
        }

        // TODO: Send notification to invited user

        return NextResponse.json({
          success: true,
          message: 'Invitation sent',
        })
      }

      case 'accept_invite': {
        // Check for pending invite
        const invite = await prisma.studyCircleMember.findUnique({
          where: {
            circleId_userId: { circleId, userId: user.id },
          },
        })

        if (!invite || invite.status !== 'INVITED') {
          return NextResponse.json({ error: 'No pending invitation found' }, { status: 404 })
        }

        // Check circle capacity
        if (currentMemberCount >= circle.maxMembers) {
          return NextResponse.json({ error: 'This circle is now full' }, { status: 400 })
        }

        // Accept invite
        await prisma.studyCircleMember.update({
          where: { id: invite.id },
          data: { status: 'ACTIVE' },
        })

        // Update circle's last activity
        await prisma.studyCircle.update({
          where: { id: circleId },
          data: { lastActivityAt: new Date() },
        })

        return NextResponse.json({
          success: true,
          message: `Successfully joined ${circle.name}`,
        })
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('[Study Circle Members] POST Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/study-circles/[circleId]/members - Leave circle or remove member
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { circleId } = await params

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const targetUserId = searchParams.get('userId')

    // Get circle and membership info
    // PERF: Added take limit to prevent loading 1000+ members into memory
    const circle = await prisma.studyCircle.findUnique({
      where: { id: circleId },
      select: {
        id: true,
        createdById: true,
        members: {
          where: { status: 'ACTIVE' },
          select: { userId: true, role: true },
          take: 500, // PERF: Limit to max reasonable circle size
        },
      },
    })

    if (!circle) {
      return NextResponse.json({ error: 'Circle not found' }, { status: 404 })
    }

    const userMembership = circle.members.find(m => m.userId === user.id)

    // If no targetUserId, user is leaving themselves
    if (!targetUserId || targetUserId === user.id) {
      if (!userMembership) {
        return NextResponse.json({ error: 'Not a member of this circle' }, { status: 400 })
      }

      // Owner cannot leave if there are other members (must transfer or delete)
      if (userMembership.role === 'OWNER' && circle.members.length > 1) {
        return NextResponse.json(
          { error: 'Transfer ownership before leaving, or archive the circle' },
          { status: 400 }
        )
      }

      // Leave the circle
      await prisma.studyCircleMember.update({
        where: {
          circleId_userId: { circleId, userId: user.id },
        },
        data: {
          status: 'LEFT',
          leftAt: new Date(),
        },
      })

      // If owner and last member, archive the circle
      if (userMembership.role === 'OWNER' && circle.members.length === 1) {
        await prisma.studyCircle.update({
          where: { id: circleId },
          data: { status: 'ARCHIVED' },
        })
      }

      return NextResponse.json({
        success: true,
        message: 'Successfully left the circle',
      })
    }

    // Removing another member (admin/owner only)
    if (!userMembership || (userMembership.role !== 'OWNER' && userMembership.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Only owners and admins can remove members' }, { status: 403 })
    }

    const targetMembership = circle.members.find(m => m.userId === targetUserId)
    if (!targetMembership) {
      return NextResponse.json({ error: 'User is not a member' }, { status: 404 })
    }

    // Cannot remove owner
    if (targetMembership.role === 'OWNER') {
      return NextResponse.json({ error: 'Cannot remove the owner' }, { status: 403 })
    }

    // Admins cannot remove other admins (only owner can)
    if (targetMembership.role === 'ADMIN' && userMembership.role !== 'OWNER') {
      return NextResponse.json({ error: 'Only the owner can remove admins' }, { status: 403 })
    }

    // Remove member
    await prisma.studyCircleMember.update({
      where: {
        circleId_userId: { circleId, userId: targetUserId },
      },
      data: {
        status: 'REMOVED',
        leftAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Member removed successfully',
    })
  } catch (error) {
    console.error('[Study Circle Members] DELETE Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH /api/study-circles/[circleId]/members - Update member role
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { circleId } = await params

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { userId: targetUserId, role: newRole } = body

    if (!targetUserId || !newRole) {
      return NextResponse.json({ error: 'User ID and role are required' }, { status: 400 })
    }

    if (!['ADMIN', 'MEMBER'].includes(newRole)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    // Get circle and membership info
    // PERF: Added take limit to prevent loading 1000+ members into memory
    const circle = await prisma.studyCircle.findUnique({
      where: { id: circleId },
      select: {
        createdById: true,
        members: {
          where: { status: 'ACTIVE' },
          select: { userId: true, role: true },
          take: 500, // PERF: Limit to max reasonable circle size
        },
      },
    })

    if (!circle) {
      return NextResponse.json({ error: 'Circle not found' }, { status: 404 })
    }

    const userMembership = circle.members.find(m => m.userId === user.id)

    // Only owner can change roles
    if (!userMembership || userMembership.role !== 'OWNER') {
      return NextResponse.json({ error: 'Only the owner can change member roles' }, { status: 403 })
    }

    // Cannot change owner's role
    if (targetUserId === circle.createdById) {
      return NextResponse.json({ error: 'Cannot change owner role' }, { status: 400 })
    }

    const targetMembership = circle.members.find(m => m.userId === targetUserId)
    if (!targetMembership) {
      return NextResponse.json({ error: 'User is not a member' }, { status: 404 })
    }

    // Update role
    await prisma.studyCircleMember.update({
      where: {
        circleId_userId: { circleId, userId: targetUserId },
      },
      data: { role: newRole },
    })

    return NextResponse.json({
      success: true,
      message: `Member role updated to ${newRole}`,
    })
  } catch (error) {
    console.error('[Study Circle Members] PATCH Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
