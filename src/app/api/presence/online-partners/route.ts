import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 2. Get user's connections (partners)
    const connections = await prisma.match.findMany({
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

    // 3. Extract partner IDs
    const partnerIds = connections.map((conn) =>
      conn.senderId === user.id ? conn.receiverId : conn.senderId
    )

    // 4. Get presence status for all partners
    const presences = await prisma.userPresence.findMany({
      where: {
        userId: {
          in: partnerIds,
        },
      },
      select: {
        userId: true,
        status: true,
        lastSeenAt: true,
        lastActivityAt: true,
        isPrivate: true,
      },
    })

    // 5. Format response
    const presenceMap = presences.reduce((acc, presence) => {
      acc[presence.userId] = {
        status: presence.isPrivate ? 'offline' : presence.status, // Hide if private
        lastSeenAt: presence.lastSeenAt.toISOString(),
        lastActivityAt: presence.lastActivityAt.toISOString(),
        isPrivate: presence.isPrivate,
      }
      return acc
    }, {} as Record<string, any>)

    return NextResponse.json({
      success: true,
      presences: presenceMap,
      total: partnerIds.length,
    })
  } catch (error) {
    console.error('[GET ONLINE PARTNERS ERROR]', error)

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
