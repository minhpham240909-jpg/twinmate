/**
 * Study Suggestions API
 *
 * Returns personalized study suggestions based on:
 * - Recent study activity and subjects
 * - Time since last study session
 * - Session performance signals (duration, completion)
 * - User's current streak
 *
 * PERFORMANCE:
 * - Single optimized query
 * - Redis caching for 5 minutes per user
 * - Lightweight response (no AI call needed - rule-based)
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { cacheGet, CacheTTL, CacheKeys } from '@/lib/redis'

interface Suggestion {
  id: string
  type: 'review_needed' | 'continue' | 'new_topic' | 'streak'
  title: string
  description: string
  subject?: string
  priority: number // 0 = highest (struggling), 1 = high, 2 = medium, 3 = low
  actionUrl?: string
}

/**
 * Generate a smarter description based on session signals
 */
function generateSmartDescription(
  daysSince: number,
  wasCompleted: boolean,
  durationMinutes: number | null
): string {
  // Session was abandoned or very short
  if (!wasCompleted) {
    return 'Your last session was cut short - pick up where you left off'
  }

  if (durationMinutes !== null && durationMinutes < 5) {
    return 'Your last session was brief - try a longer focus'
  }

  // Normal completion
  if (daysSince >= 7) {
    return `It's been ${daysSince} days - time to refresh your memory`
  }

  if (daysSince >= 3) {
    return `${daysSince} days since your last session - keep the momentum`
  }

  // Recent and completed well
  if (durationMinutes && durationMinutes >= 15) {
    return 'You were making great progress - keep it up'
  }

  return daysSince === 1 ? 'You studied yesterday - stay consistent' : 'Keep building your understanding'
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Use proper cache key from CacheKeys
    const cacheKey = CacheKeys.STUDY_SUGGESTIONS(user.id)

    // Get from cache or compute
    const suggestions = await cacheGet<Suggestion[]>(
      cacheKey,
      async () => {
        const result: Suggestion[] = []

        // Get recent sessions to understand what the user has been studying
        const recentSessions = await prisma.focusSession.findMany({
          where: {
            userId: user.id,
            status: { in: ['COMPLETED', 'ABANDONED'] },
          },
          select: {
            label: true,
            taskSubject: true,
            actualMinutes: true,
            status: true,
            completedAt: true,
          },
          orderBy: { completedAt: 'desc' },
          take: 20, // Look at last 20 sessions to find patterns
        })

        // Get user's overall streak
        const profile = await prisma.profile.findUnique({
          where: { userId: user.id },
          select: { soloStudyStreak: true, quickFocusStreak: true },
        })
        const userStreak = Math.max(
          profile?.soloStudyStreak || 0,
          profile?.quickFocusStreak || 0
        )

        if (recentSessions.length === 0) {
          // No sessions - suggest starting
          result.push({
            id: 'start-studying',
            type: 'new_topic',
            title: 'Start your first session',
            description: 'Begin your study journey with a focused session',
            priority: 1,
            actionUrl: '/solo-study',
          })
          return result
        }

        // Group sessions by subject/label to find patterns
        const subjectMap = new Map<string, {
          lastSessionDate: Date
          lastWasCompleted: boolean
          lastDuration: number | null
          sessionCount: number
        }>()

        const now = new Date()
        const oneDayMs = 24 * 60 * 60 * 1000

        for (const session of recentSessions) {
          const subject = session.label || session.taskSubject
          if (!subject) continue

          // Extract clean subject name (remove prefixes like "Solo Study: ")
          const cleanSubject = subject
            .replace(/^Solo Study:\s*/i, '')
            .replace(/^Quick Focus:\s*/i, '')
            .trim()

          if (!cleanSubject) continue

          if (!subjectMap.has(cleanSubject)) {
            subjectMap.set(cleanSubject, {
              lastSessionDate: session.completedAt || new Date(),
              lastWasCompleted: session.status === 'COMPLETED',
              lastDuration: session.actualMinutes,
              sessionCount: 1,
            })
          } else {
            const existing = subjectMap.get(cleanSubject)!
            existing.sessionCount++
          }
        }

        // Convert to suggestions
        for (const [subject, data] of subjectMap) {
          const daysSince = Math.floor((now.getTime() - data.lastSessionDate.getTime()) / oneDayMs)

          // Determine if user was struggling
          const isStruggling = !data.lastWasCompleted ||
            (data.lastDuration !== null && data.lastDuration < 5)

          const description = generateSmartDescription(daysSince, data.lastWasCompleted, data.lastDuration)

          if (daysSince >= 3) {
            // Haven't studied in 3+ days - needs review
            result.push({
              id: `review-${subject.slice(0, 20)}`,
              type: 'review_needed',
              title: `Review: ${subject}`,
              description,
              subject,
              priority: isStruggling ? 0 : 1,
              actionUrl: '/solo-study',
            })
          } else if (daysSince >= 0) {
            // Recently studied
            result.push({
              id: `continue-${subject.slice(0, 20)}`,
              type: 'continue',
              title: `Continue: ${subject}`,
              description,
              subject,
              priority: isStruggling ? 2 : 3,
              actionUrl: '/solo-study',
            })
          }
        }

        // Sort by priority (lowest number = highest priority)
        result.sort((a, b) => a.priority - b.priority)

        // STREAK REINFORCEMENT: Add streak message if user has one
        if (userStreak >= 2 && result.length > 0) {
          const topSubject = result[0]
          result.splice(1, 0, {
            id: 'streak-reinforcement',
            type: 'streak',
            title: `${userStreak}-day streak`,
            description: `Keep it going${topSubject.subject ? ` with ${topSubject.subject}` : ''}`,
            subject: topSubject.subject,
            priority: 1,
            actionUrl: '/solo-study',
          })
        }

        // Limit to top 3 suggestions
        return result.slice(0, 3)
      },
      CacheTTL.STUDY_SUGGESTIONS
    )

    return NextResponse.json({
      success: true,
      suggestions,
    })
  } catch (error) {
    console.error('[Study Suggestions API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to get suggestions' },
      { status: 500 }
    )
  }
}
