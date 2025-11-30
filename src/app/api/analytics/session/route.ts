/**
 * Session Analytics API
 * Creates and updates user session analytics
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

// Create or update session analytics
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const {
      sessionId,
      action,
      deviceId,
      userAgent,
      ipAddress,
      // Increments for updates
      pagesVisited,
      featuresUsed,
      searchesMade,
      messagesSent,
      postsCreated,
      activeTime,
    } = body

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'sessionId required' },
        { status: 400 }
      )
    }

    if (action === 'start') {
      // Create new session
      const session = await prisma.userSessionAnalytics.upsert({
        where: { sessionId },
        update: {
          // Session already exists, just update timestamp
          updatedAt: new Date(),
        },
        create: {
          userId: user.id,
          sessionId,
          deviceId,
          userAgent,
          ipAddress,
          startedAt: new Date(),
        }
      })

      return NextResponse.json({ success: true, session })
    }

    if (action === 'update') {
      // Update session stats
      const session = await prisma.userSessionAnalytics.update({
        where: { sessionId },
        data: {
          ...(pagesVisited !== undefined && { pagesVisited: { increment: pagesVisited } }),
          ...(featuresUsed !== undefined && { featuresUsed: { increment: featuresUsed } }),
          ...(searchesMade !== undefined && { searchesMade: { increment: searchesMade } }),
          ...(messagesSent !== undefined && { messagesSent: { increment: messagesSent } }),
          ...(postsCreated !== undefined && { postsCreated: { increment: postsCreated } }),
          ...(activeTime !== undefined && { activeTime: { increment: activeTime } }),
        }
      })

      return NextResponse.json({ success: true, session })
    }

    if (action === 'end') {
      // End session
      const session = await prisma.userSessionAnalytics.update({
        where: { sessionId },
        data: {
          endedAt: new Date(),
          totalDuration: Math.floor((Date.now() - new Date(body.startedAt || Date.now()).getTime()) / 1000),
        }
      })

      // Also update daily activity summary
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      await prisma.userActivitySummary.upsert({
        where: {
          userId_date: {
            userId: user.id,
            date: today
          }
        },
        update: {
          totalSessions: { increment: 1 },
          totalDuration: { increment: session.totalDuration || 0 },
          totalPageViews: { increment: session.pagesVisited },
          searchCount: { increment: session.searchesMade },
          messagesSent: { increment: session.messagesSent },
          postsCreated: { increment: session.postsCreated },
        },
        create: {
          userId: user.id,
          date: today,
          totalSessions: 1,
          totalDuration: session.totalDuration || 0,
          totalPageViews: session.pagesVisited,
          searchCount: session.searchesMade,
          messagesSent: session.messagesSent,
          postsCreated: session.postsCreated,
        }
      })

      return NextResponse.json({ success: true, session })
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error managing session:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to manage session' },
      { status: 500 }
    )
  }
}

// Get current session stats
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')

    if (sessionId) {
      const session = await prisma.userSessionAnalytics.findUnique({
        where: { sessionId }
      })
      return NextResponse.json({ success: true, session })
    }

    // Get recent sessions for user
    const sessions = await prisma.userSessionAnalytics.findMany({
      where: { userId: user.id },
      orderBy: { startedAt: 'desc' },
      take: 10
    })

    return NextResponse.json({ success: true, sessions })
  } catch (error) {
    console.error('Error fetching session:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch session' },
      { status: 500 }
    )
  }
}
