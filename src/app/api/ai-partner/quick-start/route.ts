/**
 * AI Partner Quick Start API
 * POST /api/ai-partner/quick-start - Start a new AI session directly from dashboard
 *
 * Supports two modes:
 * - Continue previous topic: Loads memory from last session's subject
 * - Start new topic: Starts fresh session, AI will ask what to study
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAISession } from '@/lib/ai-partner'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { mode, subject: customSubject } = body as {
      mode: 'continue' | 'new'
      subject?: string
    }

    // Check if user already has an active or paused session
    const existingSession = await prisma.aIPartnerSession.findFirst({
      where: {
        userId: user.id,
        status: { in: ['ACTIVE', 'PAUSED'] },
      },
    })

    if (existingSession) {
      return NextResponse.json({
        success: false,
        error: 'You already have an active session',
        existingSessionId: existingSession.id,
      }, { status: 400 })
    }

    let subject: string | undefined = customSubject

    // If continuing previous topic, get the last session's subject
    if (mode === 'continue') {
      const lastSession = await prisma.aIPartnerSession.findFirst({
        where: {
          userId: user.id,
          status: 'COMPLETED',
        },
        orderBy: { endedAt: 'desc' },
        select: { subject: true },
      })

      if (lastSession?.subject) {
        subject = lastSession.subject
      }
    }

    // Create new session with full memory context
    // The createAISession function will automatically load user's memory
    const result = await createAISession({
      userId: user.id,
      subject: subject || undefined,
      // Don't specify studyGoal - let AI ask naturally
    })

    return NextResponse.json({
      success: true,
      session: {
        id: result.session.id,
        subject: result.session.subject,
        status: result.session.status,
      },
      mode,
      redirectUrl: `/ai-partner/${result.session.id}`,
    })

  } catch (error) {
    console.error('[AI Partner] Quick start error:', error)
    return NextResponse.json(
      { error: 'Failed to start session' },
      { status: 500 }
    )
  }
}
