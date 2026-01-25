/**
 * AI Partner Proactive Suggestion API
 * GET /api/ai-partner/proactive?sessionId=xxx - Get state-based proactive suggestions
 *
 * This uses a smart state machine to determine when AI should:
 * - Ask setup questions (START state)
 * - Offer clarification (STUCK state - user confused)
 * - Re-engage user (STUCK state - user disengaged)
 * - Check progress (PROGRESS_CHECK state - every ~10 min)
 * - Suggest visuals (when topic benefits)
 * - Offer wrap-up (WRAP_UP state - session > 45 min)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { prisma } from '@/lib/prisma'
import { getProactiveSuggestion, ProactiveSuggestion } from '@/lib/ai-partner/openai'

export async function GET(request: NextRequest) {
  try {
    // Rate limiting - moderate for AI proactive suggestions
    const rateLimitResult = await rateLimit(request, RateLimitPresets.moderate)
    if (!rateLimitResult.success) {
      return NextResponse.json({
        type: 'none',
        shouldAsk: false,
      } as ProactiveSuggestion)
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')
    const lastProactiveIndex = parseInt(searchParams.get('lastProactiveIndex') || '0', 10)
    const aiMessagesSinceAsk = parseInt(searchParams.get('aiMessagesSinceAsk') || '0', 10)

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
    }

    // Get session with recent messages
    const session = await prisma.aIPartnerSession.findUnique({
      where: { id: sessionId },
      include: {
        messages: {
          where: { role: { in: ['USER', 'ASSISTANT'] } },
          orderBy: { createdAt: 'desc' },
          take: 20, // Get last 20 messages for context
          select: {
            role: true,
            content: true,
            createdAt: true,
          },
        },
      },
    })

    if (!session || session.userId !== user.id) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    if (session.status !== 'ACTIVE') {
      return NextResponse.json({
        type: 'none',
        shouldAsk: false,
      } as ProactiveSuggestion)
    }

    // Reverse messages to chronological order
    const recentMessages = session.messages.reverse().map(m => ({
      role: m.role.toLowerCase(),
      content: m.content,
      createdAt: m.createdAt,
    }))

    // Get proactive suggestion based on session state
    const suggestion = await getProactiveSuggestion({
      recentMessages,
      subject: session.subject || undefined,
      sessionStartedAt: session.startedAt,
      lastProactiveAskMessageIndex: lastProactiveIndex,
      aiMessageCountSinceLastAsk: aiMessagesSinceAsk,
    })

    return NextResponse.json(suggestion)
  } catch (error) {
    console.error('[AI Partner] Proactive suggestion error:', error)
    return NextResponse.json({
      type: 'none',
      shouldAsk: false,
    } as ProactiveSuggestion)
  }
}
