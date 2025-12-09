/**
 * Admin AI Partner Session Detail API
 * GET /api/admin/ai-partner/sessions/[sessionId] - View full session with all messages
 *
 * Returns complete session data including:
 * - All chat messages (user and AI)
 * - Session metadata
 * - User details
 * - Moderation flags
 * - Token usage
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

interface RouteParams {
  params: Promise<{ sessionId: string }>
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

    const { sessionId } = await params

    // Fetch session with all messages
    const session = await prisma.aIPartnerSession.findUnique({
      where: { id: sessionId },
      include: {
        persona: {
          select: {
            id: true,
            name: true,
            description: true,
            tone: true,
          }
        },
        messages: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            role: true,
            content: true,
            messageType: true,
            quizData: true,
            flashcardData: true,
            wasModerated: true,
            wasFlagged: true,
            flagCategories: true,
            moderationResult: true,
            promptTokens: true,
            completionTokens: true,
            totalTokens: true,
            createdAt: true,
          }
        }
      }
    })

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      )
    }

    // Get user details
    const sessionUser = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        createdAt: true,
        profile: {
          select: {
            school: true,
            subjects: true,
            skillLevel: true,
          }
        }
      }
    })

    // Calculate token statistics
    const tokenStats = session.messages.reduce(
      (acc, msg) => ({
        promptTokens: acc.promptTokens + (msg.promptTokens || 0),
        completionTokens: acc.completionTokens + (msg.completionTokens || 0),
        totalTokens: acc.totalTokens + (msg.totalTokens || 0),
      }),
      { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
    )

    // Count message types
    const messageStats = {
      total: session.messages.length,
      user: session.messages.filter(m => m.role === 'USER').length,
      assistant: session.messages.filter(m => m.role === 'ASSISTANT').length,
      system: session.messages.filter(m => m.role === 'SYSTEM').length,
      flagged: session.messages.filter(m => m.wasFlagged).length,
      byType: {
        chat: session.messages.filter(m => m.messageType === 'CHAT').length,
        quiz: session.messages.filter(m => m.messageType === 'QUIZ').length,
        flashcard: session.messages.filter(m => m.messageType === 'FLASHCARD').length,
        whiteboard: session.messages.filter(m => m.messageType === 'WHITEBOARD').length,
        summary: session.messages.filter(m => m.messageType === 'SUMMARY').length,
      }
    }

    // Format duration
    const duration = session.totalDuration ||
      (session.endedAt
        ? Math.floor((new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 1000)
        : Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000))

    // Estimate cost
    const estimatedCost = (
      (tokenStats.promptTokens * 0.15 / 1000000) +
      (tokenStats.completionTokens * 0.60 / 1000000)
    )

    // Log admin view
    await prisma.adminAuditLog.create({
      data: {
        adminId: user.id,
        action: 'VIEW_AI_PARTNER_SESSION_DETAIL',
        targetType: 'AI_SESSION',
        targetId: sessionId,
        details: {
          sessionUserId: session.userId,
          messageCount: session.messages.length,
        },
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        session: {
          id: session.id,
          subject: session.subject,
          skillLevel: session.skillLevel,
          studyGoal: session.studyGoal,
          status: session.status,
          startedAt: session.startedAt,
          endedAt: session.endedAt,
          totalDuration: duration,
          durationFormatted: formatDuration(duration),
          messageCount: session.messageCount,
          quizCount: session.quizCount,
          flashcardCount: session.flashcardCount,
          rating: session.rating,
          feedback: session.feedback,
          flaggedCount: session.flaggedCount,
          wasSafetyBlocked: session.wasSafetyBlocked,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
        },
        persona: session.persona,
        user: sessionUser,
        messages: session.messages,
        messageStats,
        tokenStats: {
          ...tokenStats,
          estimatedCostUSD: estimatedCost.toFixed(6),
        },
      }
    })

  } catch (error) {
    console.error('Error fetching AI Partner session detail:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch session details' },
      { status: 500 }
    )
  }
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) {
    return `${hours}h ${mins}m ${secs}s`
  }
  if (mins > 0) {
    return `${mins}m ${secs}s`
  }
  return `${secs}s`
}
