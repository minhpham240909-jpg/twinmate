import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { PAGINATION } from '@/lib/constants'
import { validatePaginationLimit, validatePositiveInt } from '@/lib/validation'

// GET /api/history/calls - Get user's call history
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = validatePaginationLimit(searchParams.get('limit'), PAGINATION.HISTORY_LIMIT)
    const offset = validatePositiveInt(searchParams.get('offset'), 0)
    const callType = searchParams.get('callType') // AUDIO, VIDEO
    const callStatus = searchParams.get('callStatus') // COMPLETED, MISSED, CANCELLED, DECLINED

    // Build where clause
    const where = {
      type: 'CALL' as const,
      isDeleted: false,
      OR: [
        { senderId: user.id },
        { recipientId: user.id },
      ],
    }

    if (callType) {
      (where as any).callType = callType
    }

    if (callStatus) {
      (where as any).callStatus = callStatus
    }

    // Get call messages
    const calls = await prisma.message.findMany({
      where,
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
        group: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: {
        callStartedAt: 'desc',
      },
      take: limit,
      skip: offset,
    })

    // Fetch recipient users separately for DMs
    const recipientIds = calls
      .filter(call => call.recipientId)
      .map(call => call.recipientId!)
      .filter((id, index, self) => self.indexOf(id) === index) // Unique IDs

    const recipients = recipientIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: recipientIds } },
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        })
      : []

    const recipientMap = new Map(recipients.map(r => [r.id, r]))

    // Calculate statistics
    const totalCalls = await prisma.message.count({
      where: {
        type: 'CALL',
        isDeleted: false,
        OR: [
          { senderId: user.id },
          { recipientId: user.id },
        ],
      } as any,
    })

    const completedCalls = await prisma.message.count({
      where: {
        type: 'CALL',
        isDeleted: false,
        callStatus: 'COMPLETED',
        OR: [
          { senderId: user.id },
          { recipientId: user.id },
        ],
      } as any,
    })

    const totalDuration = await prisma.message.aggregate({
      where: {
        type: 'CALL',
        isDeleted: false,
        callStatus: 'COMPLETED',
        OR: [
          { senderId: user.id },
          { recipientId: user.id },
        ],
      } as any,
      _sum: {
        callDuration: true,
      },
    })

    const missedCalls = await prisma.message.count({
      where: {
        type: 'CALL',
        isDeleted: false,
        callStatus: 'MISSED',
        recipientId: user.id, // Only missed calls where user was recipient
      } as any,
    })

    return NextResponse.json({
      calls: calls.map(call => ({
        id: call.id,
        callType: call.callType,
        callStatus: call.callStatus,
        callDuration: call.callDuration,
        callStartedAt: call.callStartedAt,
        createdAt: call.createdAt,
        sender: call.sender,
        recipient: call.recipientId ? recipientMap.get(call.recipientId) || null : null,
        group: call.group,
        isOutgoing: call.senderId === user.id,
      })),
      statistics: {
        totalCalls,
        completedCalls,
        missedCalls,
        totalMinutes: Math.round((totalDuration._sum?.callDuration || 0) / 60 * 10) / 10,
      },
      pagination: {
        limit,
        offset,
        hasMore: calls.length === limit,
      },
    })
  } catch (error) {
    console.error('Error fetching calls:', error)
    return NextResponse.json(
      { error: 'Failed to fetch calls' },
      { status: 500 }
    )
  }
}

