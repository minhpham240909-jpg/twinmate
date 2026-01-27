import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { pushMissionReady, pushMissionIncomplete, isWebPushConfigured } from '@/lib/web-push'

/**
 * POST /api/push/mission-reminder
 *
 * Triggers a mission reminder notification for the current user.
 * Called when user returns to the app or on scheduled intervals.
 *
 * This endpoint is idempotent - calling multiple times won't spam the user
 * because we track the last notification sent time.
 */
export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isWebPushConfigured()) {
      return NextResponse.json({
        success: false,
        reason: 'push_not_configured'
      })
    }

    // Check if user has push subscriptions
    const subscriptionCount = await prisma.pushSubscription.count({
      where: {
        userId: user.id,
        isActive: true,
      },
    })

    if (subscriptionCount === 0) {
      return NextResponse.json({
        success: false,
        reason: 'no_subscriptions'
      })
    }

    // Get user's active roadmap
    const activeRoadmap = await prisma.learningRoadmap.findFirst({
      where: {
        userId: user.id,
        status: 'ACTIVE',
      },
    })

    if (!activeRoadmap) {
      return NextResponse.json({
        success: false,
        reason: 'no_active_roadmap'
      })
    }

    // Get the current step separately
    const currentStep = await prisma.roadmapStep.findFirst({
      where: {
        roadmapId: activeRoadmap.id,
        status: 'CURRENT',
      },
    })

    if (!currentStep) {
      return NextResponse.json({
        success: false,
        reason: 'no_current_step'
      })
    }

    // Check if we've sent a notification recently (within last 4 hours)
    // This prevents notification spam
    const recentNotification = await prisma.notification.findFirst({
      where: {
        userId: user.id,
        type: 'MISSION_REMINDER',
        createdAt: {
          gte: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
        },
      },
    })

    if (recentNotification) {
      return NextResponse.json({
        success: false,
        reason: 'notification_sent_recently',
        lastSentAt: recentNotification.createdAt,
      })
    }

    // Calculate progress percentage
    const totalSteps = await prisma.roadmapStep.count({
      where: { roadmapId: activeRoadmap.id },
    })
    const completedSteps = await prisma.roadmapStep.count({
      where: { roadmapId: activeRoadmap.id, status: 'COMPLETED' },
    })
    const progressPercent = Math.round((completedSteps / totalSteps) * 100)

    // Decide which notification to send based on progress
    const estimatedMinutes = currentStep.duration || 10
    const topic = activeRoadmap.title || currentStep.title

    if (progressPercent > 50) {
      // User is more than halfway - encourage completion
      await pushMissionIncomplete(user.id, topic, progressPercent)
    } else {
      // Normal mission ready notification
      await pushMissionReady(user.id, topic, estimatedMinutes)
    }

    // Record that we sent a notification (for rate limiting)
    await prisma.notification.create({
      data: {
        userId: user.id,
        type: 'MISSION_REMINDER',
        title: 'Mission Reminder',
        message: `Reminder for: ${topic}`,
        metadata: {
          roadmapId: activeRoadmap.id,
          stepId: currentStep.id,
          progressPercent,
        },
      },
    })

    return NextResponse.json({
      success: true,
      topic,
      progressPercent,
    })
  } catch (error) {
    console.error('Error sending mission reminder:', error)
    return NextResponse.json(
      { error: 'Failed to send mission reminder' },
      { status: 500 }
    )
  }
}
