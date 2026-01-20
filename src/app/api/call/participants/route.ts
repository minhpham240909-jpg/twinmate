import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import logger from '@/lib/logger'

/**
 * Generate consistent UID from userId (same as in agora-token/route.ts)
 */
function generateConsistentUid(userId: string): number {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash) % 1000000000
}

/**
 * POST /api/call/participants - Get participant names for a call
 *
 * Request body:
 * - channelName: The Agora channel name
 * - uids: Array of Agora UIDs to look up (optional, returns all if not provided)
 *
 * Response:
 * - participants: Map of UID -> { name, avatarUrl, userId }
 */
export async function POST(req: NextRequest) {
  // Rate limit: 60 requests per minute (lenient - called during calls)
  const rateLimitResult = await rateLimit(req, RateLimitPresets.moderate)
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait.' },
      { status: 429, headers: rateLimitResult.headers }
    )
  }

  try {
    // Verify user is authenticated
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { channelName, uids } = body

    if (!channelName) {
      return NextResponse.json({ error: 'Channel name is required' }, { status: 400 })
    }

    // Determine channel type and get participants
    let participants: Array<{ id: string; name: string | null; avatarUrl: string | null }> = []

    if (channelName.startsWith('dm')) {
      // DM call - get both users from the match
      const userMatches = await prisma.match.findMany({
        where: {
          OR: [
            { senderId: user.id, status: 'ACCEPTED' },
            { receiverId: user.id, status: 'ACCEPTED' }
          ]
        },
        include: {
          sender: {
            select: { id: true, name: true, avatarUrl: true }
          },
          receiver: {
            select: { id: true, name: true, avatarUrl: true }
          }
        }
      })

      // Find the matching DM channel
      for (const match of userMatches) {
        const otherId = match.senderId === user.id ? match.receiverId : match.senderId
        const expectedChannel = `dm${[user.id, otherId].sort().join('').replace(/-/g, '').slice(0, 60)}`

        if (expectedChannel === channelName) {
          participants = [
            match.sender,
            match.receiver
          ]
          break
        }
      }
    } else if (channelName.startsWith('grp')) {
      // Group call - get all group members
      // Extract groupId from channel name to avoid N+1 query loop
      // Channel format: grp{groupIdWithoutDashes} (first 60 chars)
      const channelGroupPart = channelName.slice(3) // Remove 'grp' prefix

      // Get user's groups with their full groupIds
      const userGroups = await prisma.groupMember.findMany({
        where: { userId: user.id },
        select: { groupId: true }
      })

      // Find matching group by comparing channel names
      const matchingGroup = userGroups.find(ug => {
        const expectedChannel = `grp${ug.groupId.replace(/-/g, '').slice(0, 60)}`
        return expectedChannel === channelName
      })

      if (matchingGroup) {
        // Single query to get all group members
        const groupMembers = await prisma.groupMember.findMany({
          where: { groupId: matchingGroup.groupId },
          include: {
            user: {
              select: { id: true, name: true, avatarUrl: true }
            }
          }
        })
        participants = groupMembers.map(m => m.user)
      }
    } else {
      // Study session - get session participants
      const session = await prisma.studySession.findFirst({
        where: { agoraChannel: channelName },
        include: {
          participants: {
            where: { status: 'JOINED' },
            include: {
              user: {
                select: { id: true, name: true, avatarUrl: true }
              }
            }
          }
        }
      })

      if (session) {
        participants = session.participants.map(p => p.user)
      }
    }

    // Build the UID -> user info mapping
    const participantMap: Record<number, { name: string; avatarUrl: string | null; userId: string }> = {}

    for (const participant of participants) {
      const uid = generateConsistentUid(participant.id)
      participantMap[uid] = {
        name: participant.name || 'Unknown User',
        avatarUrl: participant.avatarUrl,
        userId: participant.id
      }
    }

    // If specific UIDs were requested, filter to those
    if (uids && Array.isArray(uids) && uids.length > 0) {
      const filteredMap: Record<number, { name: string; avatarUrl: string | null; userId: string }> = {}
      for (const uid of uids) {
        if (participantMap[uid]) {
          filteredMap[uid] = participantMap[uid]
        }
      }
      return NextResponse.json({ participants: filteredMap, success: true })
    }

    return NextResponse.json({ participants: participantMap, success: true })
  } catch (error) {
    console.error('[Call Participants] Error:', error)
    return NextResponse.json(
      { error: 'Failed to get participant info' },
      { status: 500 }
    )
  }
}
