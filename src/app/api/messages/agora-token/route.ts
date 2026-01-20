import { NextRequest, NextResponse } from 'next/server'
import { RtcTokenBuilder, RtcRole } from 'agora-token'
import { createClient } from '@/lib/supabase/server'
import { corsHeaders, handleCorsPreFlight } from '@/lib/cors'
import { prisma } from '@/lib/prisma'
import { getCached, setCached } from '@/lib/cache'
import logger from '@/lib/logger'
import { rateLimit } from '@/lib/rate-limit'

// Maximum users per call room - prevents overload at scale
const MAX_USERS_PER_CALL = {
  dm: 2,      // DM calls are always 1-on-1
  group: 8,   // Group calls limited to 8 for quality
  study: 8,   // Study sessions limited to 8
} as const

// Cache Agora tokens briefly to reduce DB churn on repeated joins/refreshes
const AGORA_TOKEN_CACHE_TTL_SECONDS = 10 * 60 // 10 minutes

// Handle CORS preflight
export async function OPTIONS(req: NextRequest) {
  return handleCorsPreFlight(req)
}

/**
 * Validate channel access based on channel type
 * Channel naming conventions:
 * - Study Sessions: stored in StudySession.agoraChannel
 * - DM Calls: dm{sortedUserIds} (e.g., dm123abc456def)
 * - Group Calls: grp{groupId} (e.g., grpabc123def456)
 */
async function validateChannelAccess(
  channelName: string,
  userId: string
): Promise<{ valid: boolean; error?: string; type?: 'study' | 'dm' | 'group' }> {
  // Check if it's a DM call channel (starts with 'dm')
  if (channelName.startsWith('dm')) {
    // DM channels contain both user IDs sorted and joined
    // We need to verify the current user has an accepted match with the other user
    // Since the channel is dm{sortedIds}, we check if user has any accepted matches
    const acceptedMatch = await prisma.match.findFirst({
      where: {
        OR: [
          { senderId: userId, status: 'ACCEPTED' },
          { receiverId: userId, status: 'ACCEPTED' }
        ]
      },
      select: { id: true, senderId: true, receiverId: true }
    })

    if (!acceptedMatch) {
      return { valid: false, error: 'No active partnership found for this call' }
    }

    // Verify the channel name matches one of the user's partnerships
    // Channel format: dm{[id1, id2].sort().join('').replace(/-/g, '').slice(0, 60)}
    const partnerId = acceptedMatch.senderId === userId
      ? acceptedMatch.receiverId
      : acceptedMatch.senderId

    const expectedChannel = `dm${[userId, partnerId].sort().join('').replace(/-/g, '').slice(0, 60)}`

    // Check if this channel matches any of the user's partnerships
    const allMatches = await prisma.match.findMany({
      where: {
        OR: [
          { senderId: userId, status: 'ACCEPTED' },
          { receiverId: userId, status: 'ACCEPTED' }
        ]
      },
      select: { senderId: true, receiverId: true }
    })

    const validChannels = allMatches.map(match => {
      const otherId = match.senderId === userId ? match.receiverId : match.senderId
      return `dm${[userId, otherId].sort().join('').replace(/-/g, '').slice(0, 60)}`
    })

    if (!validChannels.includes(channelName)) {
      return { valid: false, error: 'You are not authorized to join this call' }
    }

    return { valid: true, type: 'dm' }
  }

  // Check if it's a Group call channel (starts with 'grp')
  if (channelName.startsWith('grp')) {
    // Group channels: grp{groupId.replace(/-/g, '').slice(0, 60)}
    // We need to verify the user is a member of the group

    // Get all groups the user is a member of
    const userGroups = await prisma.groupMember.findMany({
      where: { userId },
      select: { groupId: true }
    })

    if (userGroups.length === 0) {
      return { valid: false, error: 'You are not a member of any groups' }
    }

    // Check if the channel matches any of the user's groups
    const validChannels = userGroups.map(g =>
      `grp${g.groupId.replace(/-/g, '').slice(0, 60)}`
    )

    if (!validChannels.includes(channelName)) {
      return { valid: false, error: 'You are not a member of this group' }
    }

    return { valid: true, type: 'group' }
  }

  // Otherwise, assume it's a Study Session channel
  const session = await prisma.studySession.findFirst({
    where: { agoraChannel: channelName },
    select: { id: true, status: true }
  })

  if (!session) {
    return { valid: false, error: 'Study session not found' }
  }

  // Verify user is a JOINED participant
  const participant = await prisma.sessionParticipant.findFirst({
    where: {
      sessionId: session.id,
      userId: userId,
      status: 'JOINED'
    }
  })

  if (!participant) {
    return { valid: false, error: 'You are not authorized to join this study session' }
  }

  return { valid: true, type: 'study' }
}

/**
 * Check current participant count for a channel
 * Uses UserPresence with currentActivity to track who's in a call
 */
async function getChannelParticipantCount(
  channelName: string,
  callType: 'dm' | 'group' | 'study'
): Promise<number> {
  try {
    // For study sessions, we can check SessionParticipant with status JOINED
    if (callType === 'study') {
      const session = await prisma.studySession.findFirst({
        where: { agoraChannel: channelName },
        select: { id: true }
      })

      if (session) {
        const count = await prisma.sessionParticipant.count({
          where: {
            sessionId: session.id,
            status: 'JOINED',
            // Only count users who joined recently (within last 5 minutes)
            joinedAt: {
              gte: new Date(Date.now() - 5 * 60 * 1000)
            }
          }
        })
        return count
      }
    }

    // For DM and Group calls, check UserPresence with currentActivity containing the channel
    // This is a best-effort check as presence data may be slightly stale
    const activeUsers = await prisma.userPresence.count({
      where: {
        status: 'online',
        isPrivate: false,
        activityType: 'in_call',
        activityDetails: {
          contains: channelName
        },
        lastSeenAt: {
          gte: new Date(Date.now() - 2 * 60 * 1000) // Active within last 2 minutes
        }
      }
    })

    return activeUsers
  } catch (error) {
    logger.error('[Agora Token] Error checking participant count', error instanceof Error ? error : { error })
    // On error, return 0 to allow the call (fail open for better UX)
    return 0
  }
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin')
  const headers = corsHeaders(origin)

  // Rate limit: 10 token requests per minute (strict - tokens are sensitive)
  const rateLimitResult = await rateLimit(req, { max: 10, windowMs: 60 * 1000, keyPrefix: 'agora-token' })
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many token requests. Please wait.' },
      { status: 429, headers: { ...headers, ...rateLimitResult.headers } }
    )
  }

  try {
    // Verify user is authenticated
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      logger.warn('[Agora Token] Auth error', { error: authError?.message })
      return NextResponse.json(
        { error: 'Unauthorized', details: authError?.message },
        { status: 401, headers }
      )
    }

    const body = await req.json()
    const { channelName, uid, role = 'publisher' } = body

    if (!channelName) {
      return NextResponse.json(
        { error: 'Channel name is required' },
        { status: 400, headers }
      )
    }

    // Validate channel access based on channel type
    const validation = await validateChannelAccess(channelName, user.id)

    if (!validation.valid) {
      logger.warn('[Agora Token] Access denied', {
        userId: user.id,
        channelName,
        error: validation.error,
      })
      return NextResponse.json(
        { error: validation.error },
        { status: 403, headers }
      )
    }

    logger.info('[Agora Token] Access validated', { type: validation.type, channelName, userId: user.id })

    // Check participant limit before allowing join
    const callType = validation.type!
    const maxParticipants = MAX_USERS_PER_CALL[callType]
    const currentParticipants = await getChannelParticipantCount(channelName, callType)

    if (currentParticipants >= maxParticipants) {
      logger.warn('[Agora Token] Call room full', { channelName, currentParticipants, maxParticipants, callType })
      return NextResponse.json(
        {
          error: `This ${callType === 'dm' ? 'call' : 'room'} is full. Maximum ${maxParticipants} participants allowed.`,
          code: 'ROOM_FULL',
          currentParticipants,
          maxParticipants,
        },
        { status: 403, headers }
      )
    }

    logger.info('[Agora Token] Room capacity check passed', { channelName, currentParticipants, maxParticipants, callType })

    // Get Agora credentials
    const sanitize = (val: string | undefined) => val?.replace(/[\r\n\s]+/g, '').trim() || ''
    const appId = sanitize(process.env.NEXT_PUBLIC_AGORA_APP_ID)
    const appCertificate = sanitize(process.env.AGORA_APP_CERTIFICATE)

    if (!appId || !appCertificate) {
      logger.error('[Agora Token] Missing credentials')
      return NextResponse.json(
        { error: 'Agora credentials not configured' },
        { status: 500, headers }
      )
    }

    // Generate UID from userId for consistent mapping
    // This allows us to map Agora UID back to the actual user
    // We use a hash of the userId to create a consistent numeric UID
    const generateConsistentUid = (userId: string): number => {
      let hash = 0
      for (let i = 0; i < userId.length; i++) {
        const char = userId.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash = hash & hash // Convert to 32bit integer
      }
      // Ensure positive number and within Agora's UID range (0 to 2^32-1)
      return Math.abs(hash) % 1000000000
    }

    const userUid = uid || generateConsistentUid(user.id)

    // Token caching (5–10 minutes TTL)
    const cacheKey = `v1:agora-token:${user.id}:${channelName}:${role}:${userUid}`
    const nowSec = Math.floor(Date.now() / 1000)
    const cached = await getCached<{
      token: string
      appId: string
      channelName: string
      uid: number
      expiresAt: number
      success: true
    }>(cacheKey)

    if (cached && cached.expiresAt > nowSec + 60) {
      return NextResponse.json(cached, { headers })
    }

    // Token expiration (24 hours)
    const expirationTimeInSeconds = 86400
    const currentTimestamp = Math.floor(Date.now() / 1000)
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds

    // Build token
    const agoraRole = role === 'audience' ? RtcRole.SUBSCRIBER : RtcRole.PUBLISHER
    const token = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      channelName,
      userUid,
      agoraRole,
      privilegeExpiredTs,
      privilegeExpiredTs
    )

    logger.info('[Agora Token] Token generated', { type: validation.type, channelName, userId: user.id })

    const payload = {
      token,
      appId,
      channelName,
      uid: userUid,
      expiresAt: privilegeExpiredTs,
      success: true as const,
    }

    await setCached(cacheKey, payload, AGORA_TOKEN_CACHE_TTL_SECONDS)

    return NextResponse.json(
      payload,
      { headers }
    )

  } catch (error: unknown) {
    logger.error('[Agora Token] Fatal error', error instanceof Error ? error : { error })
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: 'Failed to generate Agora token', details: errorMessage },
      { status: 500, headers }
    )
  }
}
