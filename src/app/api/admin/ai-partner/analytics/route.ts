/**
 * Admin AI Partner Analytics API
 * GET /api/admin/ai-partner/analytics - Real-time AI Partner statistics
 *
 * Returns comprehensive analytics including:
 * - Total sessions, messages, users
 * - Usage trends over time
 * - Subject distribution
 * - Session ratings and feedback
 * - Flagged/moderated content alerts
 * - Token usage costs
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
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

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const thisWeekStart = new Date(today)
    thisWeekStart.setDate(today.getDate() - today.getDay())
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const last30Days = new Date(today)
    last30Days.setDate(today.getDate() - 30)

    // Run all queries in parallel for real-time performance
    const [
      // Core stats
      totalSessions,
      totalMessages,
      totalUniqueUsers,

      // Time-based stats
      sessionsToday,
      sessionsThisWeek,
      sessionsThisMonth,

      // Status breakdown
      activeSessions,
      pausedSessions,
      completedSessions,
      blockedSessions,

      // Message stats
      userMessages,
      aiMessages,

      // Moderation stats
      flaggedMessages,
      flaggedSessions,
      safetyBlockedSessions,

      // Feature usage
      totalQuizzes,
      totalFlashcards,
      whiteboardMessages,

      // Token usage (cost tracking)
      tokenStats,

      // Ratings
      ratedSessions,

      // Recent feedback
      recentFeedback,

      // Growth data (last 30 days)
      dailyGrowth,

      // Top subjects
      subjectDistribution,

      // Recent flagged content
      recentFlaggedMessages,

      // Active users with sessions
      activeAIUsers,
    ] = await Promise.all([
      // Total counts
      prisma.aIPartnerSession.count(),
      prisma.aIPartnerMessage.count(),
      prisma.aIPartnerSession.findMany({
        select: { userId: true },
        distinct: ['userId'],
      }).then(r => r.length),

      // Time-based
      prisma.aIPartnerSession.count({ where: { createdAt: { gte: today } } }),
      prisma.aIPartnerSession.count({ where: { createdAt: { gte: thisWeekStart } } }),
      prisma.aIPartnerSession.count({ where: { createdAt: { gte: thisMonthStart } } }),

      // Status
      prisma.aIPartnerSession.count({ where: { status: 'ACTIVE' } }),
      prisma.aIPartnerSession.count({ where: { status: 'PAUSED' } }),
      prisma.aIPartnerSession.count({ where: { status: 'COMPLETED' } }),
      prisma.aIPartnerSession.count({ where: { status: 'BLOCKED' } }),

      // Messages by role
      prisma.aIPartnerMessage.count({ where: { role: 'USER' } }),
      prisma.aIPartnerMessage.count({ where: { role: 'ASSISTANT' } }),

      // Moderation
      prisma.aIPartnerMessage.count({ where: { wasFlagged: true } }),
      prisma.aIPartnerSession.count({ where: { flaggedCount: { gt: 0 } } }),
      prisma.aIPartnerSession.count({ where: { wasSafetyBlocked: true } }),

      // Feature usage
      prisma.aIPartnerSession.aggregate({ _sum: { quizCount: true } }),
      prisma.aIPartnerSession.aggregate({ _sum: { flashcardCount: true } }),
      prisma.aIPartnerMessage.count({ where: { messageType: 'WHITEBOARD' } }),

      // Tokens
      prisma.aIPartnerMessage.aggregate({
        _sum: {
          promptTokens: true,
          completionTokens: true,
          totalTokens: true,
        },
      }),

      // Ratings
      prisma.aIPartnerSession.aggregate({
        where: { rating: { not: null } },
        _count: true,
        _avg: { rating: true },
      }),

      // Recent feedback with text (for admin review)
      prisma.aIPartnerSession.findMany({
        where: {
          OR: [
            { rating: { not: null } },
            { feedback: { not: null } },
          ],
        },
        orderBy: { endedAt: 'desc' },
        take: 20,
        select: {
          id: true,
          userId: true,
          subject: true,
          rating: true,
          feedback: true,
          endedAt: true,
          totalDuration: true,
          messageCount: true,
        },
      }),

      // Daily growth for chart
      prisma.$queryRaw<Array<{ date: string; sessions: bigint; messages: bigint; users: bigint }>>`
        SELECT
          DATE("createdAt") as date,
          COUNT(*) as sessions,
          SUM("messageCount") as messages,
          COUNT(DISTINCT "userId") as users
        FROM "AIPartnerSession"
        WHERE "createdAt" >= ${last30Days}
        GROUP BY DATE("createdAt")
        ORDER BY date ASC
      `,

      // Subject distribution
      prisma.aIPartnerSession.groupBy({
        by: ['subject'],
        where: { subject: { not: null } },
        _count: true,
        orderBy: { _count: { subject: 'desc' } },
        take: 10,
      }),

      // Recent flagged messages (for alerts)
      prisma.aIPartnerMessage.findMany({
        where: { wasFlagged: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          content: true,
          role: true,
          flagCategories: true,
          createdAt: true,
          session: {
            select: {
              id: true,
              userId: true,
              subject: true,
            }
          }
        }
      }),

      // Active AI users (currently in session)
      prisma.aIPartnerSession.findMany({
        where: { status: 'ACTIVE' },
        select: {
          id: true,
          userId: true,
          subject: true,
          messageCount: true,
          startedAt: true,
        },
        orderBy: { startedAt: 'desc' },
        take: 10,
      }),
    ])

    // Calculate average session duration
    const avgDuration = await prisma.aIPartnerSession.aggregate({
      where: {
        totalDuration: { not: null },
        status: 'COMPLETED',
      },
      _avg: { totalDuration: true },
    })

    // Calculate token costs (approximate - GPT-4o-mini pricing)
    // Input: $0.15/1M tokens, Output: $0.60/1M tokens
    const totalPromptTokens = tokenStats._sum.promptTokens || 0
    const totalCompletionTokens = tokenStats._sum.completionTokens || 0
    const estimatedCost = (
      (totalPromptTokens * 0.15 / 1000000) +
      (totalCompletionTokens * 0.60 / 1000000)
    )

    // Format daily growth data
    const growthData = dailyGrowth.map(day => ({
      date: day.date,
      sessions: Number(day.sessions),
      messages: Number(day.messages),
      users: Number(day.users),
    }))

    // Format subject distribution
    const subjects = subjectDistribution.map(s => ({
      subject: s.subject || 'General',
      count: s._count,
    }))

    // Fetch user info for recent feedback
    const feedbackUserIds = [...new Set(recentFeedback.map(f => f.userId))]
    const feedbackUsers = await prisma.user.findMany({
      where: { id: { in: feedbackUserIds } },
      select: { id: true, name: true, email: true, avatarUrl: true },
    })
    const userMap = new Map(feedbackUsers.map(u => [u.id, u]))

    // Log admin view
    await prisma.adminAuditLog.create({
      data: {
        adminId: user.id,
        action: 'VIEW_AI_PARTNER_ANALYTICS',
        targetType: 'SYSTEM',
        targetId: 'ai-partner-analytics',
        details: { timestamp: now.toISOString() },
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        // Overview stats
        overview: {
          totalSessions,
          totalMessages,
          totalUniqueUsers,
          activeSessions,
          pausedSessions,
          averageSessionDuration: Math.round(avgDuration._avg.totalDuration || 0),
          averageMessagesPerSession: totalSessions > 0 ? Math.round(totalMessages / totalSessions) : 0,
        },

        // Time-based stats
        timePeriods: {
          sessionsToday,
          sessionsThisWeek,
          sessionsThisMonth,
        },

        // Status breakdown
        statusBreakdown: {
          active: activeSessions,
          paused: pausedSessions,
          completed: completedSessions,
          blocked: blockedSessions,
        },

        // Message stats
        messageStats: {
          total: totalMessages,
          userMessages,
          aiMessages,
          averagePerSession: totalSessions > 0 ? Math.round(totalMessages / totalSessions) : 0,
        },

        // Moderation (alerts for admin)
        moderation: {
          flaggedMessages,
          flaggedSessions,
          safetyBlockedSessions,
          flaggedPercentage: totalMessages > 0 ? ((flaggedMessages / totalMessages) * 100).toFixed(2) : '0.00',
          recentFlagged: recentFlaggedMessages,
        },

        // Feature usage
        features: {
          totalQuizzes: totalQuizzes._sum.quizCount || 0,
          totalFlashcards: totalFlashcards._sum.flashcardCount || 0,
          whiteboardAnalyses: whiteboardMessages,
        },

        // Token usage and costs
        tokens: {
          totalPromptTokens,
          totalCompletionTokens,
          totalTokens: tokenStats._sum.totalTokens || 0,
          estimatedCostUSD: estimatedCost.toFixed(4),
        },

        // User satisfaction
        ratings: {
          totalRated: ratedSessions._count,
          averageRating: ratedSessions._avg.rating ? Number(ratedSessions._avg.rating.toFixed(2)) : null,
          ratingPercentage: totalSessions > 0 ? ((ratedSessions._count / totalSessions) * 100).toFixed(1) : '0',
          recentFeedback: recentFeedback.map(f => {
            const feedbackUser = userMap.get(f.userId)
            return {
              id: f.id,
              userId: f.userId,
              userName: feedbackUser?.name || 'Unknown',
              userEmail: feedbackUser?.email || '',
              userImage: feedbackUser?.avatarUrl || null,
              subject: f.subject,
              rating: f.rating,
              feedback: f.feedback,
              endedAt: f.endedAt,
              totalDuration: f.totalDuration,
              messageCount: f.messageCount,
            }
          }),
        },

        // Charts data
        charts: {
          dailyGrowth: growthData,
          subjectDistribution: subjects,
        },

        // Real-time active sessions
        activeUsers: activeAIUsers,

        // Timestamps
        lastUpdated: now.toISOString(),
      }
    })

  } catch (error) {
    console.error('Error fetching AI Partner analytics:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch AI Partner analytics' },
      { status: 500 }
    )
  }
}
