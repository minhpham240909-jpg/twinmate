import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import logger from '@/lib/logger'

// Schema for inviting users to focus session
const inviteFocusSessionSchema = z.object({
  partnerIds: z.array(z.string().uuid()).min(1).max(10), // Max 10 partners per session
})

/**
 * POST /api/focus/[sessionId]/invite
 * Invite partners to join a quick focus session
 *
 * Features:
 * - Real-time invitation without page refresh
 * - Maximum 10 partners per session
 * - Prevents duplicate invitations
 * - Creates notifications for invitees
 * - Optimized to prevent N+1 queries
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sessionId } = await params
    const body = await request.json()
    const validation = inviteFocusSessionSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.issues },
        { status: 400 }
      )
    }

    const { partnerIds } = validation.data

    // Verify the focus session exists and user is the owner
    const focusSession = await prisma.focusSession.findFirst({
      where: {
        id: sessionId,
        userId: user.id,
        status: 'ACTIVE', // Can only invite to active sessions
      },
    })

    if (!focusSession) {
      return NextResponse.json(
        { error: 'Session not found or not active' },
        { status: 404 }
      )
    }

    // PERFORMANCE OPTIMIZATION: Batch query to check existing participants
    // This prevents N+1 queries by fetching all at once
    const existingParticipants = await prisma.focusSessionParticipant.findMany({
      where: {
        focusSessionId: sessionId,
        userId: { in: partnerIds },
      },
      select: { userId: true },
    })

    const existingUserIds = new Set(existingParticipants.map((p: { userId: string }) => p.userId))

    // Filter out already invited users
    const newPartnerIds = partnerIds.filter(id => !existingUserIds.has(id))

    if (newPartnerIds.length === 0) {
      return NextResponse.json(
        { error: 'All selected partners are already invited' },
        { status: 400 }
      )
    }

    // PERFORMANCE OPTIMIZATION: Verify all users exist and are partners (batch query)
    const partners = await prisma.match.findMany({
      where: {
        OR: [
          { senderId: user.id, receiverId: { in: newPartnerIds }, status: 'ACCEPTED' },
          { receiverId: user.id, senderId: { in: newPartnerIds }, status: 'ACCEPTED' },
        ],
      },
      select: {
        senderId: true,
        receiverId: true,
        sender: { select: { id: true, name: true, avatarUrl: true } },
        receiver: { select: { id: true, name: true, avatarUrl: true } },
      },
    })

    // Map partner IDs to verify all are valid partners
    const validPartnerIds = new Set<string>()
    partners.forEach(match => {
      const partnerId = match.senderId === user.id ? match.receiverId : match.senderId
      validPartnerIds.add(partnerId)
    })

    const invalidPartnerIds = newPartnerIds.filter(id => !validPartnerIds.has(id))

    if (invalidPartnerIds.length > 0) {
      logger.warn('Attempted to invite non-partners to focus session', {
        data: {
          sessionId,
          userId: user.id,
          invalidPartnerIds,
        },
      })
      return NextResponse.json(
        { error: 'Some selected users are not your partners' },
        { status: 403 }
      )
    }

    // PERFORMANCE OPTIMIZATION: Batch create participants and notifications
    // Using transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Create participant records
      const participants = await tx.focusSessionParticipant.createMany({
        data: newPartnerIds.map(partnerId => ({
          focusSessionId: sessionId,
          userId: partnerId,
          role: 'PARTICIPANT',
          status: 'INVITED',
        })),
      })

      // Get host profile for notification
      const hostProfile = await tx.profile.findUnique({
        where: { userId: user.id },
        select: { user: { select: { name: true } } },
      })

      // Create notifications for all invited partners
      await tx.notification.createMany({
        data: newPartnerIds.map(partnerId => ({
          userId: partnerId,
          type: 'FOCUS_SESSION_INVITE',
          title: 'Quick Focus Invitation',
          message: `${hostProfile?.user.name || 'Someone'} invited you to a 5-minute focus session`,
          actionUrl: `/focus/${sessionId}`,
        })),
      })

      return { count: participants.count }
    })

    logger.info('Focus session invitations sent', {
      data: {
        sessionId,
        hostId: user.id,
        invitedCount: result.count,
        invitedUserIds: newPartnerIds,
      },
    })

    return NextResponse.json({
      success: true,
      message: `${result.count} invitation${result.count === 1 ? '' : 's'} sent`,
      invitedCount: result.count,
    })
  } catch (error) {
    logger.error('Error inviting partners to focus session', { error })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/focus/[sessionId]/invite
 * Get list of invited and joined participants for a focus session
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sessionId } = await params

    // Verify the focus session exists and user has access (owner or participant)
    const [focusSession, userParticipation] = await Promise.all([
      prisma.focusSession.findFirst({
        where: { id: sessionId },
      }),
      prisma.focusSessionParticipant.findFirst({
        where: {
          focusSessionId: sessionId,
          userId: user.id,
        },
      }),
    ])

    if (!focusSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Check if user has access (is owner or is a participant)
    const hasAccess = focusSession.userId === user.id || userParticipation !== null

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // PERFORMANCE OPTIMIZATION: Single query with join to get all participants with user details
    const participants = await prisma.focusSessionParticipant.findMany({
      where: { focusSessionId: sessionId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: [
        { joinedAt: 'asc' },
        { createdAt: 'asc' },
      ],
    })

    // Separate participants by status
    const invited = participants.filter((p: { status: string }) => p.status === 'INVITED')
    const joined = participants.filter((p: { status: string }) => p.status === 'JOINED')
    const declined = participants.filter((p: { status: string }) => p.status === 'DECLINED')

    return NextResponse.json({
      success: true,
      participants: {
        invited: invited.map((p: { id: string; user: { id: string; name: string; avatarUrl: string | null }; createdAt: Date }) => ({
          id: p.id,
          userId: p.user.id,
          name: p.user.name,
          avatarUrl: p.user.avatarUrl,
          invitedAt: p.createdAt,
        })),
        joined: joined.map((p: { id: string; user: { id: string; name: string; avatarUrl: string | null }; joinedAt: Date | null }) => ({
          id: p.id,
          userId: p.user.id,
          name: p.user.name,
          avatarUrl: p.user.avatarUrl,
          joinedAt: p.joinedAt,
        })),
        declined: declined.map((p: { id: string; user: { id: string; name: string; avatarUrl: string | null } }) => ({
          id: p.id,
          userId: p.user.id,
          name: p.user.name,
          avatarUrl: p.user.avatarUrl,
        })),
      },
      isHost: focusSession.userId === user.id,
    })
  } catch (error) {
    logger.error('Error fetching focus session participants', { error })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
