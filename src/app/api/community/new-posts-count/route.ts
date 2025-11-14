import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

// GET /api/community/new-posts-count - Get count of new posts from partners/groups
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's partner IDs (accepted matches)
    const partnerMatches = await prisma.match.findMany({
      where: {
        OR: [
          { senderId: user.id, status: 'ACCEPTED' },
          { receiverId: user.id, status: 'ACCEPTED' },
        ],
      },
      select: {
        senderId: true,
        receiverId: true,
      },
    })

    const partnerIds = partnerMatches.map(match =>
      match.senderId === user.id ? match.receiverId : match.senderId
    )

    // Get user's group member IDs
    const userGroups = await prisma.groupMember.findMany({
      where: {
        userId: user.id,
      },
      select: {
        groupId: true,
      },
    })
    const userGroupIds = userGroups.map(g => g.groupId)

    const groupMemberIds = await prisma.groupMember.findMany({
      where: {
        groupId: { in: userGroupIds },
        userId: { not: user.id }, // Exclude self
      },
      select: {
        userId: true,
      },
    })
    const groupMemberUserIds = [...new Set(groupMemberIds.map(m => m.userId))]

    // Combine partner and group member IDs
    const relevantUserIds = [...new Set([...partnerIds, ...groupMemberUserIds])]

    // If no partners or group members, return count of 0
    if (relevantUserIds.length === 0) {
      return NextResponse.json({
        success: true,
        count: 0,
      })
    }

    // Count posts from partners and group members created in the last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const count = await prisma.post.count({
      where: {
        userId: { in: relevantUserIds },
        createdAt: { gte: oneDayAgo },
        isDeleted: false,
      },
    })

    return NextResponse.json({
      success: true,
      count,
    })
  } catch (error) {
    console.error('Error counting new community posts:', error)
    return NextResponse.json(
      { error: 'Failed to count new posts' },
      { status: 500 }
    )
  }
}
