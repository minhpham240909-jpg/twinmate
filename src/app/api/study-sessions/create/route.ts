import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { enforceUserAccess } from '@/lib/security/checkUserBan'
import { invalidateSessionCache } from '@/lib/cache'
import logger from '@/lib/logger'

export async function POST(request: NextRequest) {
  // SECURITY: Rate limiting to prevent session spam (10 sessions per minute)
  const rateLimitResult = await rateLimit(request, RateLimitPresets.strict)
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many session creation requests. Please slow down.' },
      {
        status: 429,
        headers: rateLimitResult.headers
      }
    )
  }

  try {
    // Authenticate user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is banned or deactivated
    const accessCheck = await enforceUserAccess(user.id)
    if (!accessCheck.allowed) {
      return NextResponse.json(accessCheck.errorResponse, { status: 403 })
    }

    // Parse request body
    const body = await request.json()
    const { title, description, type, subject, tags, inviteUserIds } = body

    // Validate required fields
    if (!title || !type) {
      return NextResponse.json(
        { error: 'Missing required fields: title, type' },
        { status: 400 }
      )
    }

    // Generate unique Agora channel name
    const agoraChannel = `study${user.id.replace(/-/g, '').slice(0, 30)}${Date.now().toString().slice(-6)}`

    // Calculate waiting lobby expiration time (30 minutes from now)
    const waitingStartedAt = new Date()
    const waitingExpiresAt = new Date(waitingStartedAt.getTime() + 30 * 60 * 1000) // 30 minutes

    // Create study session in WAITING status
    const session = await prisma.studySession.create({
      data: {
        title,
        description: description || null,
        type,
        status: 'WAITING', // Start in waiting lobby
        createdBy: user.id,
        userId: user.id, // For backward compatibility
        subject: subject || null,
        tags: tags || [],
        agoraChannel,
        maxParticipants: 10,
        isPublic: false,
        waitingStartedAt,
        waitingExpiresAt,
        startedAt: null, // Will be set when host clicks "Start"
      },
    })

    // Add creator as first participant (HOST)
    await prisma.sessionParticipant.create({
      data: {
        sessionId: session.id,
        userId: user.id,
        role: 'HOST',
        status: 'JOINED',
        joinedAt: new Date(),
      },
    })

    // SECURITY: Validate and invite other users if provided
    // Only accepted partners can be invited to sessions
    let invitesSent = 0
    const inviteErrors: string[] = []

    if (inviteUserIds && Array.isArray(inviteUserIds) && inviteUserIds.length > 0) {
      // Get all accepted partners for the current user
      const acceptedMatches = await prisma.match.findMany({
        where: {
          OR: [
            { senderId: user.id, status: 'ACCEPTED' },
            { receiverId: user.id, status: 'ACCEPTED' }
          ]
        },
        select: {
          senderId: true,
          receiverId: true
        }
      })

      const acceptedPartnerIds = new Set(
        acceptedMatches.map(match =>
          match.senderId === user.id ? match.receiverId : match.senderId
        )
      )

      for (const inviteeId of inviteUserIds) {
        try {
          // SECURITY: Verify invitee is an accepted partner
          if (!acceptedPartnerIds.has(inviteeId)) {
            inviteErrors.push(`User ${inviteeId}: Not an accepted partner`)
            logger.warn('User attempted to invite non-partner to study session', { userId: user.id, inviteeId })
            continue
          }

          await prisma.sessionParticipant.create({
            data: {
              sessionId: session.id,
              userId: inviteeId,
              role: 'PARTICIPANT',
              status: 'INVITED',
            },
          })

          // Get inviter info
          const inviter = await prisma.user.findUnique({
            where: { id: user.id },
            select: { name: true },
          })

          // Create notification
          await prisma.notification.create({
            data: {
              userId: inviteeId,
              type: 'SESSION_INVITE',
              title: 'Study Session Invite',
              message: `${inviter?.name || 'Someone'} invited you to "${session.title}"`,
              actionUrl: `/study-sessions`,
              relatedUserId: user.id,
            },
          })

          invitesSent++
        } catch (error) {
          logger.error('Error inviting user to session', error instanceof Error ? error : { error, inviteeId })
          inviteErrors.push(`User ${inviteeId}: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }
    }

    // FIX: Invalidate session caches for creator and all invited users
    const allUserIds = [user.id, ...(inviteUserIds || [])]
    await Promise.all(
      allUserIds.map(userId => invalidateSessionCache(session.id, userId))
    )

    return NextResponse.json({
      success: true,
      session: {
        id: session.id,
        title: session.title,
        status: session.status,
        agoraChannel: session.agoraChannel,
        createdAt: session.createdAt,
      },
      invitesSent,
      inviteErrors: inviteErrors.length > 0 ? inviteErrors : undefined,
    })
  } catch (error) {
    logger.error('Error creating session', error instanceof Error ? error : { error })
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    )
  }
}
