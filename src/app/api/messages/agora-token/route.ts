import { NextRequest, NextResponse } from 'next/server'
import { RtcTokenBuilder, RtcRole } from 'agora-token'
import { createClient } from '@/lib/supabase/server'
import { corsHeaders, handleCorsPreFlight } from '@/lib/cors'
import { prisma } from '@/lib/prisma'

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

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin')
  const headers = corsHeaders(origin)

  try {
    // Verify user is authenticated
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error('[Agora Token] Auth error:', authError)
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
      console.warn(`[Agora Token] Access denied for user ${user.id} to channel ${channelName}: ${validation.error}`)
      return NextResponse.json(
        { error: validation.error },
        { status: 403, headers }
      )
    }

    console.log(`[Agora Token] Access validated for ${validation.type} call:`, { channelName, userId: user.id })

    // Get Agora credentials
    const sanitize = (val: string | undefined) => val?.replace(/[\r\n\s]+/g, '').trim() || ''
    const appId = sanitize(process.env.NEXT_PUBLIC_AGORA_APP_ID)
    const appCertificate = sanitize(process.env.AGORA_APP_CERTIFICATE)

    if (!appId || !appCertificate) {
      console.error('[Agora Token] Missing credentials!')
      return NextResponse.json(
        { error: 'Agora credentials not configured' },
        { status: 500, headers }
      )
    }

    // Generate UID if not provided
    const userUid = uid || Math.floor(Math.random() * 100000)

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

    console.log('[Agora Token] Token generated successfully for', validation.type, 'call')

    return NextResponse.json(
      {
        token,
        appId,
        channelName,
        uid: userUid,
        expiresAt: privilegeExpiredTs,
        success: true
      },
      { headers }
    )

  } catch (error: unknown) {
    console.error('[Agora Token] Fatal error:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: 'Failed to generate Agora token', details: errorMessage },
      { status: 500, headers }
    )
  }
}
