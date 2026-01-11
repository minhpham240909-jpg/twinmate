/**
 * Admin AI Partner User Data API
 * GET /api/admin/ai-partner/user/[userId] - Get all AI Partner data for a specific user
 *
 * Returns:
 * - All user's AI sessions
 * - Usage statistics
 * - Behavior patterns
 * - Flagged content
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

interface RouteParams {
  params: Promise<{ userId: string }>
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    // Check if user is admin
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const adminUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { isAdmin: true }
    })

    if (!adminUser?.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    const { userId } = await params

    // Verify user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        createdAt: true,
      }
    })

    if (!targetUser) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Max session duration to count (4 hours in seconds)
    // Sessions longer than this are likely left open and shouldn't count as real study time
    const MAX_SESSION_DURATION = 4 * 60 * 60 // 4 hours = 14400 seconds

    // Get all user's AI Partner sessions - fetch separately to handle errors better
    const sessions = await prisma.aIPartnerSession.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        subject: true,
        status: true,
        startedAt: true,
        endedAt: true,
        totalDuration: true,
        messageCount: true,
        quizCount: true,
        flashcardCount: true,
        rating: true,
        feedback: true,
        flaggedCount: true,
        wasSafetyBlocked: true,
        createdAt: true,
        persona: {
          select: { name: true }
        },
      }
    })

    // Get session IDs for message queries
    const sessionIds = sessions.map(s => s.id)

    // Fetch remaining stats in parallel
    const [sessionStats, messageStats, flaggedMessages] = await Promise.all([
      // Aggregate session stats - only count COMPLETED sessions for accurate duration
      prisma.aIPartnerSession.aggregate({
        where: { userId, status: 'COMPLETED' },
        _count: true,
        _sum: {
          messageCount: true,
          quizCount: true,
          flashcardCount: true,
          totalDuration: true,
          flaggedCount: true,
        },
        _avg: {
          rating: true,
          totalDuration: true,
          messageCount: true,
        },
      }),

      // Message type breakdown - only if user has sessions
      sessionIds.length > 0
        ? prisma.aIPartnerMessage.groupBy({
            by: ['messageType'],
            where: {
              sessionId: { in: sessionIds }
            },
            _count: true,
          })
        : Promise.resolve([]),

      // All flagged messages - only if user has sessions
      sessionIds.length > 0
        ? prisma.aIPartnerMessage.findMany({
            where: {
              sessionId: { in: sessionIds },
              wasFlagged: true,
            },
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              content: true,
              role: true,
              flagCategories: true,
              createdAt: true,
              session: {
                select: {
                  id: true,
                  subject: true,
                }
              }
            }
          })
        : Promise.resolve([]),
    ])

    // Get subject breakdown
    const subjectBreakdown = sessions.reduce((acc, s) => {
      const subject = s.subject || 'General'
      acc[subject] = (acc[subject] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Get status breakdown
    const statusBreakdown = sessions.reduce((acc, s) => {
      acc[s.status] = (acc[s.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Calculate usage patterns
    const sessionsWithDates = sessions.map(s => ({
      date: new Date(s.createdAt),
      duration: s.totalDuration || 0,
    }))

    // Day of week usage
    const dayUsage = Array(7).fill(0)
    sessionsWithDates.forEach(s => {
      dayUsage[s.date.getDay()]++
    })

    // Hour of day usage
    const hourUsage = Array(24).fill(0)
    sessionsWithDates.forEach(s => {
      hourUsage[s.date.getHours()]++
    })

    // First and last session dates
    const firstSession = sessions.length > 0 ? sessions[sessions.length - 1] : null
    const lastSession = sessions.length > 0 ? sessions[0] : null

    // Format sessions with duration
    const formattedSessions = sessions.map(s => ({
      ...s,
      durationFormatted: s.totalDuration ? formatDuration(s.totalDuration) : null,
    }))

    // Log admin view
    await prisma.adminAuditLog.create({
      data: {
        adminId: user.id,
        action: 'VIEW_USER_AI_PARTNER_DATA',
        targetType: 'USER',
        targetId: userId,
        details: {
          totalSessions: sessions.length,
          flaggedMessages: flaggedMessages.length,
        },
      }
    })

    // Calculate realistic total duration by capping each session
    // This prevents sessions left open for days from inflating the total
    const realisticTotalDuration = sessions.reduce((total, s) => {
      if (s.status === 'COMPLETED' && s.totalDuration) {
        // Cap each session at max duration
        return total + Math.min(s.totalDuration, MAX_SESSION_DURATION)
      }
      return total
    }, 0)

    // Count all sessions (not just completed)
    const totalSessionCount = sessions.length
    const completedSessionCount = sessions.filter(s => s.status === 'COMPLETED').length

    return NextResponse.json({
      success: true,
      data: {
        user: targetUser,

        // Overall stats
        stats: {
          totalSessions: totalSessionCount,
          completedSessions: completedSessionCount,
          totalMessages: sessionStats._sum.messageCount || 0,
          totalQuizzes: sessionStats._sum.quizCount || 0,
          totalFlashcards: sessionStats._sum.flashcardCount || 0,
          totalDuration: realisticTotalDuration,
          totalDurationFormatted: formatDuration(realisticTotalDuration),
          averageRating: sessionStats._avg.rating ? Number(sessionStats._avg.rating.toFixed(1)) : null,
          averageSessionDuration: completedSessionCount > 0
            ? Math.round(realisticTotalDuration / completedSessionCount)
            : 0,
          averageMessagesPerSession: Math.round(sessionStats._avg.messageCount || 0),
          totalFlaggedMessages: flaggedMessages.length,
          flaggedSessionCount: sessions.filter(s => s.flaggedCount > 0).length,
          safetyBlockedCount: sessions.filter(s => s.wasSafetyBlocked).length,
        },

        // Breakdowns
        breakdowns: {
          byStatus: statusBreakdown,
          bySubject: subjectBreakdown,
          byMessageType: messageStats.reduce((acc, m) => {
            acc[m.messageType] = m._count
            return acc
          }, {} as Record<string, number>),
        },

        // Usage patterns
        usagePatterns: {
          byDayOfWeek: {
            labels: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
            data: dayUsage,
          },
          byHourOfDay: hourUsage,
          firstSessionDate: firstSession?.createdAt || null,
          lastSessionDate: lastSession?.createdAt || null,
          daysSinceFirstSession: firstSession
            ? Math.floor((Date.now() - new Date(firstSession.createdAt).getTime()) / (1000 * 60 * 60 * 24))
            : 0,
        },

        // All sessions
        sessions: formattedSessions,

        // Moderation alerts
        flaggedMessages,

        // Timestamps
        generatedAt: new Date().toISOString(),
      }
    })

  } catch (error) {
    console.error('Error fetching user AI Partner data:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch user AI Partner data' },
      { status: 500 }
    )
  }
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)

  if (hours > 0) {
    return `${hours}h ${mins}m`
  }
  return `${mins}m`
}
