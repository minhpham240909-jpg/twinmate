/**
 * Admin AI Partner Analytics API
 * GET /api/admin/ai-partner/analytics - Real-time AI Partner statistics
 *
 * Returns comprehensive analytics including:
 * - Total sessions, messages, users
 * - Usage trends over time
 * - Subject distribution (normalized to merge similar names)
 * - Session ratings and feedback
 * - Flagged/moderated content alerts
 * - Token usage costs
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { adminRateLimit } from '@/lib/admin/rate-limit'

/**
 * Normalize a subject name for comparison
 * - Lowercase
 * - Trim whitespace
 * - Remove extra spaces
 * - Handle common abbreviations
 */
function normalizeSubjectKey(subject: string): string {
  if (!subject) return 'general'

  let normalized = subject
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space

  // Common abbreviations mapping (expand abbreviations to full form for matching)
  // This handles common shortcuts - but ALL subjects are normalized by case/whitespace
  const abbreviations: Record<string, string> = {
    // Computer Science & Tech
    'cs': 'computer science',
    'comp sci': 'computer science',
    'compsci': 'computer science',
    'it': 'information technology',
    'ai': 'artificial intelligence',
    'ml': 'machine learning',
    'ds': 'data science',
    'ux': 'user experience',
    'ui': 'user interface',
    'db': 'database',
    'os': 'operating systems',
    'oop': 'object oriented programming',
    'dsa': 'data structures and algorithms',
    'se': 'software engineering',
    'web dev': 'web development',
    'webdev': 'web development',

    // Mathematics
    'math': 'mathematics',
    'maths': 'mathematics',
    'stats': 'statistics',
    'calc': 'calculus',
    'alg': 'algebra',
    'trig': 'trigonometry',
    'geom': 'geometry',
    'precalc': 'precalculus',
    'pre-calc': 'precalculus',

    // Sciences
    'bio': 'biology',
    'chem': 'chemistry',
    'phys': 'physics',
    'env sci': 'environmental science',
    'envsci': 'environmental science',
    'astro': 'astronomy',
    'neuro': 'neuroscience',
    'biochem': 'biochemistry',
    'orgo': 'organic chemistry',
    'organic chem': 'organic chemistry',

    // Social Sciences & Humanities
    'econ': 'economics',
    'psych': 'psychology',
    'soc': 'sociology',
    'anthro': 'anthropology',
    'poli sci': 'political science',
    'polisci': 'political science',
    'poly sci': 'political science',
    'gov': 'government',
    'govt': 'government',
    'civics': 'government',
    'phil': 'philosophy',
    'philo': 'philosophy',

    // History & Geography
    'hist': 'history',
    'geo': 'geography',
    'geog': 'geography',
    'world hist': 'world history',
    'us hist': 'us history',
    'us history': 'united states history',
    'american hist': 'american history',
    'euro hist': 'european history',
    'art hist': 'art history',

    // Languages & Literature
    'eng': 'english',
    'lit': 'literature',
    'eng lit': 'english literature',
    'lang': 'language',
    'lang arts': 'language arts',
    'ela': 'english language arts',
    'span': 'spanish',
    'french': 'french',
    'ger': 'german',
    'lat': 'latin',
    'esl': 'english as second language',

    // Arts
    'art': 'art',
    'fine arts': 'fine arts',
    'vis arts': 'visual arts',
    'visual arts': 'visual arts',
    'music': 'music',
    'music theory': 'music theory',
    'drama': 'drama',
    'theater': 'theater',
    'theatre': 'theater',
    'film': 'film studies',
    'photo': 'photography',

    // Business & Professional
    'acct': 'accounting',
    'mgmt': 'management',
    'mktg': 'marketing',
    'fin': 'finance',
    'hr': 'human resources',
    'bus': 'business',
    'biz': 'business',
    'bus admin': 'business administration',
    'mba': 'business administration',
    'entrepreneurship': 'entrepreneurship',

    // Health & Medicine
    'health': 'health',
    'med': 'medicine',
    'nursing': 'nursing',
    'nutrition': 'nutrition',
    'anatomy': 'anatomy',
    'physio': 'physiology',
    'pharm': 'pharmacology',
    'public health': 'public health',

    // Other Common
    'pe': 'physical education',
    'phys ed': 'physical education',
    'law': 'law',
    'criminal justice': 'criminal justice',
    'cj': 'criminal justice',
    'comm': 'communications',
    'communications': 'communications',
    'journalism': 'journalism',
    'education': 'education',
    'ed': 'education',
    'engineering': 'engineering',
    'engr': 'engineering',
    'architecture': 'architecture',
    'arch': 'architecture',
  }

  // Check if the normalized subject matches any abbreviation
  if (abbreviations[normalized]) {
    return abbreviations[normalized]
  }

  return normalized
}

/**
 * Get the best display name for a subject
 * Prefers: Title Case > Most common form > First occurrence
 */
function getBestDisplayName(variations: Array<{ name: string; count: number }>): string {
  if (variations.length === 0) return 'General'
  if (variations.length === 1) return toTitleCase(variations[0].name)

  // Sort by count descending to get most common first
  const sorted = [...variations].sort((a, b) => b.count - a.count)

  // Check if any variation is already in proper title case
  const titleCaseMatch = sorted.find(v => v.name === toTitleCase(v.name))
  if (titleCaseMatch) return titleCaseMatch.name

  // Otherwise, use the most common variation but convert to title case
  return toTitleCase(sorted[0].name)
}

/**
 * Convert string to Title Case
 */
function toTitleCase(str: string): string {
  if (!str) return ''
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting (default preset: 100 requests/minute)
    const rateLimitResult = await adminRateLimit(request, 'default')
    if (rateLimitResult) return rateLimitResult

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

    // FIX: Track query errors instead of silently catching them
    const queryErrors: string[] = []
    const safeQuery = async <T>(name: string, query: Promise<T>, fallback: T): Promise<T> => {
      try {
        return await query
      } catch (error) {
        queryErrors.push(`${name}: ${error instanceof Error ? error.message : 'Unknown error'}`)
        console.warn(`[AI Analytics] Query failed: ${name}`, error)
        return fallback
      }
    }

    // Run queries in batches to prevent database overload (max 15 parallel per batch)
    // Batch 1: Core counts (15 queries)
    const [
      totalSessions,
      totalMessages,
      totalUniqueUsers,
      sessionsToday,
      sessionsThisWeek,
      sessionsThisMonth,
      activeSessions,
      pausedSessions,
      completedSessions,
      blockedSessions,
      userMessages,
      aiMessages,
      flaggedMessages,
      flaggedSessions,
      safetyBlockedSessions,
    ] = await Promise.all([
      safeQuery('totalSessions', prisma.aIPartnerSession.count(), 0),
      safeQuery('totalMessages', prisma.aIPartnerMessage.count(), 0),
      safeQuery('totalUniqueUsers', prisma.aIPartnerSession.findMany({
        select: { userId: true },
        distinct: ['userId'],
      }).then(r => r.length), 0),
      safeQuery('sessionsToday', prisma.aIPartnerSession.count({ where: { createdAt: { gte: today } } }), 0),
      safeQuery('sessionsThisWeek', prisma.aIPartnerSession.count({ where: { createdAt: { gte: thisWeekStart } } }), 0),
      safeQuery('sessionsThisMonth', prisma.aIPartnerSession.count({ where: { createdAt: { gte: thisMonthStart } } }), 0),
      safeQuery('activeSessions', prisma.aIPartnerSession.count({ where: { status: 'ACTIVE' } }), 0),
      safeQuery('pausedSessions', prisma.aIPartnerSession.count({ where: { status: 'PAUSED' } }), 0),
      safeQuery('completedSessions', prisma.aIPartnerSession.count({ where: { status: 'COMPLETED' } }), 0),
      safeQuery('blockedSessions', prisma.aIPartnerSession.count({ where: { status: 'BLOCKED' } }), 0),
      safeQuery('userMessages', prisma.aIPartnerMessage.count({ where: { role: 'USER' } }), 0),
      safeQuery('aiMessages', prisma.aIPartnerMessage.count({ where: { role: 'ASSISTANT' } }), 0),
      safeQuery('flaggedMessages', prisma.aIPartnerMessage.count({ where: { wasFlagged: true } }), 0),
      safeQuery('flaggedSessions', prisma.aIPartnerSession.count({ where: { flaggedCount: { gt: 0 } } }), 0),
      safeQuery('safetyBlockedSessions', prisma.aIPartnerSession.count({ where: { wasSafetyBlocked: true } }), 0),
    ])

    // Batch 2: Feature usage and aggregates (12 queries)
    const [
      totalQuizzes,
      totalFlashcards,
      whiteboardMessages,
      totalGeneratedImages,
      totalUploadedImages,
      recentGeneratedImages,
      tokenStats,
      ratedSessions,
      recentFeedback,
      dailyGrowth,
      subjectDistribution,
      recentFlaggedMessages,
    ] = await Promise.all([
      safeQuery('totalQuizzes', prisma.aIPartnerSession.aggregate({ _sum: { quizCount: true } }), { _sum: { quizCount: null } }),
      safeQuery('totalFlashcards', prisma.aIPartnerSession.aggregate({ _sum: { flashcardCount: true } }), { _sum: { flashcardCount: null } }),
      safeQuery('whiteboardMessages', prisma.aIPartnerMessage.count({ where: { messageType: 'WHITEBOARD' } }), 0),
      safeQuery('totalGeneratedImages', prisma.aIPartnerMessage.count({ where: { messageType: 'IMAGE', imageType: 'generated' } }), 0),
      safeQuery('totalUploadedImages', prisma.aIPartnerMessage.count({ where: { messageType: 'IMAGE', imageType: 'uploaded' } }), 0),
      safeQuery('recentGeneratedImages', prisma.aIPartnerMessage.findMany({
        where: { messageType: 'IMAGE', imageType: 'generated', imageUrl: { not: null } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true, imageUrl: true, imagePrompt: true, createdAt: true,
          session: { select: { id: true, userId: true, subject: true } },
        },
      }), []),
      safeQuery('tokenStats', prisma.aIPartnerMessage.aggregate({
        _sum: { promptTokens: true, completionTokens: true, totalTokens: true },
      }), { _sum: { promptTokens: null, completionTokens: null, totalTokens: null } }),
      safeQuery('ratedSessions', prisma.aIPartnerSession.aggregate({
        where: { rating: { not: null } },
        _count: true,
        _avg: { rating: true },
      }), { _count: 0, _avg: { rating: null } }),
      safeQuery('recentFeedback', prisma.aIPartnerSession.findMany({
        where: { OR: [{ rating: { not: null } }, { feedback: { not: null } }] },
        orderBy: { endedAt: 'desc' },
        take: 20,
        select: { id: true, userId: true, subject: true, rating: true, feedback: true, endedAt: true, totalDuration: true, messageCount: true },
      }), []),
      safeQuery('dailyGrowth', prisma.$queryRaw<Array<{ date: string; sessions: bigint; messages: bigint; users: bigint }>>`
        SELECT DATE("createdAt") as date, COUNT(*) as sessions, SUM("messageCount") as messages, COUNT(DISTINCT "userId") as users
        FROM "AIPartnerSession" WHERE "createdAt" >= ${last30Days}
        GROUP BY DATE("createdAt") ORDER BY date ASC
      `, []),
      safeQuery('subjectDistribution', prisma.aIPartnerSession.groupBy({
        by: ['subject'],
        where: { subject: { not: null } },
        _count: true,
      }), []),
      safeQuery('recentFlaggedMessages', prisma.aIPartnerMessage.findMany({
        where: { wasFlagged: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true, content: true, role: true, flagCategories: true, createdAt: true,
          session: { select: { id: true, userId: true, subject: true } }
        }
      }), []),
    ])

    // Batch 3: Active users (1 query)
    const activeAIUsers = await safeQuery('activeAIUsers', prisma.aIPartnerSession.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, userId: true, subject: true, messageCount: true, startedAt: true },
      orderBy: { startedAt: 'desc' },
      take: 10,
    }), [])

    // Max focus time to consider realistic (4 hours)
    const MAX_FOCUS_TIME = 4 * 60 * 60 // 4 hours = 14400 seconds

    // Calculate average FOCUS TIME (Pomodoro timer time) - NOT total session duration
    // focusTime is only counted when user explicitly clicks Start Timer during the session
    // If user never starts the timer, focusTime is null (not counted in analytics)
    const avgFocusTime = await safeQuery('avgFocusTime', prisma.aIPartnerSession.aggregate({
      where: {
        focusTime: { not: null, gt: 0, lte: MAX_FOCUS_TIME }, // Only sessions where timer was used
        status: 'COMPLETED',
      },
      _avg: { focusTime: true },
    }), { _avg: { focusTime: null } })

    // Also get total focus time across all sessions for overview
    const totalFocusTime = await safeQuery('totalFocusTime', prisma.aIPartnerSession.aggregate({
      where: {
        focusTime: { not: null, gt: 0 },
        status: 'COMPLETED',
      },
      _sum: { focusTime: true },
      _count: true,
    }), { _sum: { focusTime: null }, _count: 0 })

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

    // Normalize and merge similar subjects
    // Step 1: Group by normalized key
    const subjectGroups = new Map<string, { variations: Array<{ name: string; count: number }>; totalCount: number }>()

    for (const s of subjectDistribution) {
      const originalName = s.subject || 'General'
      const normalizedKey = normalizeSubjectKey(originalName)
      const count = s._count

      if (!subjectGroups.has(normalizedKey)) {
        subjectGroups.set(normalizedKey, { variations: [], totalCount: 0 })
      }

      const group = subjectGroups.get(normalizedKey)!
      group.variations.push({ name: originalName, count })
      group.totalCount += count
    }

    // Step 2: Convert to array with best display names, sorted by total count
    const subjects = Array.from(subjectGroups.entries())
      .map(([_key, group]) => ({
        subject: getBestDisplayName(group.variations),
        count: group.totalCount,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10) // Top 10 subjects after merging

    // Fetch user info for recent feedback (userId is a string, not a relation)
    // This is acceptable since the list is small (20 users max)
    const feedbackUserIds = [...new Set(recentFeedback.map(f => f.userId))]
    const feedbackUsers = feedbackUserIds.length > 0
      ? await safeQuery('feedbackUsers', prisma.user.findMany({
          where: { id: { in: feedbackUserIds } },
          select: { id: true, name: true, email: true, avatarUrl: true },
        }), [])
      : []
    const userMap = new Map(feedbackUsers.map(u => [u.id, u]))

    // Log admin view (don't block response on audit log failure)
    safeQuery('auditLog', prisma.adminAuditLog.create({
      data: {
        adminId: user.id,
        action: 'VIEW_AI_PARTNER_ANALYTICS',
        targetType: 'SYSTEM',
        targetId: 'ai-partner-analytics',
        details: { timestamp: now.toISOString() },
      }
    }), null)

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
          // Focus time is the Pomodoro timer time - only counted when user clicks Start Timer
          // This is the REAL study time, not just time the session was open
          averageFocusTime: Math.round(avgFocusTime._avg.focusTime || 0), // Average focus time per session (in seconds)
          totalFocusTime: totalFocusTime._sum.focusTime || 0, // Total focus time across all sessions (in seconds)
          sessionsWithTimer: totalFocusTime._count || 0, // Number of sessions where timer was actually used
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
          generatedImages: totalGeneratedImages,
          uploadedImages: totalUploadedImages,
          totalImages: totalGeneratedImages + totalUploadedImages,
        },

        // Image generation details
        imageGeneration: {
          totalGenerated: totalGeneratedImages,
          totalUploaded: totalUploadedImages,
          recentImages: recentGeneratedImages.map(img => ({
            id: img.id,
            imageUrl: img.imageUrl,
            prompt: img.imagePrompt,
            createdAt: img.createdAt,
            sessionId: img.session.id,
            userId: img.session.userId,
            subject: img.session.subject,
          })),
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

        // FIX: Include query errors so admins know if data is incomplete
        _queryErrors: queryErrors.length > 0 ? queryErrors : undefined,
        _dataComplete: queryErrors.length === 0,
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
