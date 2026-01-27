/**
 * Cron Job: Daily Learning Nudges
 *
 * Sends guidance-focused push notifications based on user state:
 * - Users with flashcards due for review → pushReviewDue
 * - Users mid-progress on a topic → pushMissionIncomplete
 * - New users who haven't returned → pushActivationNudge
 *
 * Philosophy: Guide, don't pressure. No streak reminders, no guilt.
 * Max 1 notification per user per day.
 *
 * Recommended cron schedule: Daily at 6 PM (18:00)
 *
 * Security: This endpoint requires a cron secret to prevent abuse
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import logger from '@/lib/logger'
import { pushReviewDue, pushActivationNudge, pushMissionReady } from '@/lib/web-push'

// Verify cron secret to prevent unauthorized access
function verifyCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    // SECURITY FIX: Require secret even in development
    console.warn('[CRON SECURITY] CRON_SECRET not set - rejecting request. Set CRON_SECRET in .env')
    return false
  }

  const authHeader = request.headers.get('authorization')
  if (!authHeader) return false

  const token = authHeader.replace('Bearer ', '')

  const crypto = require('crypto')
  const tokenBuffer = Buffer.from(token)
  const secretBuffer = Buffer.from(cronSecret)

  if (tokenBuffer.length !== secretBuffer.length) {
    return false
  }

  return crypto.timingSafeEqual(tokenBuffer, secretBuffer)
}

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()

  try {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    // Track notifications sent to avoid duplicates
    const notifiedUsers = new Set<string>()
    let reviewDueSent = 0
    let activationSent = 0
    let missionSent = 0
    let errorCount = 0

    // ==========================================
    // 1. REVIEW DUE - Users with flashcards to review
    // OPTIMIZED: Batch query users with push, then filter in-memory
    // ==========================================
    
    // First, get all users with push subscriptions
    const usersWithPush = await prisma.pushSubscription.findMany({
      select: { userId: true },
      distinct: ['userId'],
    })
    const pushUserIds = new Set(usersWithPush.map(u => u.userId))

    // Then get cards due for review (includes card -> deck for topic)
    const cardsToReview = await prisma.flashcardCardProgress.findMany({
      where: {
        nextReviewDate: { lte: new Date() },
        status: { in: ['learning', 'reviewing'] },
        userId: { in: Array.from(pushUserIds) }, // Only users with push
      },
      select: {
        userId: true,
        card: {
          select: {
            deck: { select: { title: true } },
          },
        },
      },
      take: 500,
    })

    // Group by user in-memory (no additional queries)
    const userCardCounts = new Map<string, { count: number; topic: string }>()
    for (const progress of cardsToReview) {
      const userId = progress.userId
      const existing = userCardCounts.get(userId)
      if (existing) {
        existing.count++
      } else {
        userCardCounts.set(userId, {
          count: 1,
          topic: progress.card.deck?.title || 'your cards',
        })
      }
    }

    // Send notifications
    for (const [userId, data] of userCardCounts) {
      if (data.count < 3 || notifiedUsers.has(userId)) continue

      try {
        await pushReviewDue(userId, data.topic, data.count)
        notifiedUsers.add(userId)
        reviewDueSent++
      } catch (error) {
        errorCount++
        logger.warn('Failed to send review due notification', {
          userId,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    // ==========================================
    // 2. ACTIVATION NUDGE - New users (24-72h old)
    // without any AI sessions
    // ==========================================
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

    // Get new users with push subscriptions
    const newUsersWithPush = await prisma.user.findMany({
      where: {
        createdAt: { gte: threeDaysAgo, lte: oneDayAgo },
        pushSubscriptions: { some: {} },
      },
      select: { id: true },
      take: 100,
    })

    // Get users who have AI sessions (to exclude)
    const usersWithSessions = await prisma.aIPartnerSession.findMany({
      where: {
        userId: { in: newUsersWithPush.map(u => u.id) },
      },
      select: { userId: true },
      distinct: ['userId'],
    })
    const usersWithSessionIds = new Set(usersWithSessions.map(u => u.userId))

    // Filter to users without sessions
    const newUsersWithoutSessions = newUsersWithPush.filter(
      u => !usersWithSessionIds.has(u.id)
    )

    const variants: ('stuck' | 'quick' | 'easy')[] = ['stuck', 'quick', 'easy']
    for (let i = 0; i < Math.min(newUsersWithoutSessions.length, 50); i++) {
      const user = newUsersWithoutSessions[i]
      if (notifiedUsers.has(user.id)) continue

      try {
        const variant = variants[i % variants.length]
        await pushActivationNudge(user.id, variant)
        notifiedUsers.add(user.id)
        activationSent++
      } catch (error) {
        errorCount++
        logger.warn('Failed to send activation nudge', {
          userId: user.id,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    // ==========================================
    // 3. MISSION READY - Active users who haven't
    // studied today
    // ==========================================
    
    // Get active users with push subscriptions
    const activeProfiles = await prisma.profile.findMany({
      where: {
        totalPoints: { gt: 0 },
        userId: { in: Array.from(pushUserIds) },
      },
      select: { userId: true },
      take: 100,
    })

    // Get users who studied today (to exclude)
    const usersStudiedToday = await prisma.aIPartnerSession.findMany({
      where: {
        userId: { in: activeProfiles.map(p => p.userId) },
        startedAt: { gte: todayStart },
      },
      select: { userId: true },
      distinct: ['userId'],
    })
    const studiedTodayIds = new Set(usersStudiedToday.map(u => u.userId))

    // Filter to users who haven't studied today
    const usersToNotify = activeProfiles.filter(
      p => !studiedTodayIds.has(p.userId) && !notifiedUsers.has(p.userId)
    )

    // Get last session topics in batch
    const lastSessions = await prisma.aIPartnerSession.findMany({
      where: {
        userId: { in: usersToNotify.map(u => u.userId) },
      },
      orderBy: { startedAt: 'desc' },
      select: { userId: true, subject: true },
      distinct: ['userId'],
    })
    const lastSessionMap = new Map(lastSessions.map(s => [s.userId, s.subject]))

    for (let i = 0; i < Math.min(usersToNotify.length, 50); i++) {
      const profile = usersToNotify[i]

      try {
        const topic = lastSessionMap.get(profile.userId) || 'your learning'
        await pushMissionReady(profile.userId, topic, 10)
        notifiedUsers.add(profile.userId)
        missionSent++
      } catch (error) {
        errorCount++
        logger.warn('Failed to send mission ready notification', {
          userId: profile.userId,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    const duration = Date.now() - startTime

    logger.info('Daily learning nudges cron completed', {
      reviewDueSent,
      activationSent,
      missionSent,
      totalSent: notifiedUsers.size,
      errorCount,
      duration,
    })

    return NextResponse.json({
      success: true,
      notifications: {
        reviewDue: reviewDueSent,
        activation: activationSent,
        missionReady: missionSent,
        total: notifiedUsers.size,
      },
      errors: errorCount,
      duration,
    })
  } catch (error) {
    logger.error('Daily learning nudges cron failed', error instanceof Error ? error : { error })

    return NextResponse.json(
      { success: false, error: 'Failed to send learning nudges' },
      { status: 500 }
    )
  }
}
