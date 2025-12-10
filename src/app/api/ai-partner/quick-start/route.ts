/**
 * AI Partner Quick Start API
 * POST /api/ai-partner/quick-start - Start a new AI session directly from dashboard
 *
 * Supports two modes:
 * - Continue previous topic: Loads ALL search criteria from last session (subjects, location, interests, etc.)
 * - Start new topic: Starts fresh session, AI will ask what to study
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAISession, createAISessionFromSearch } from '@/lib/ai-partner'
import type { SearchCriteria } from '@/lib/ai-partner/openai'
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

    // If continuing previous topic, get ALL search criteria from last session
    if (mode === 'continue') {
      const lastSession = await prisma.aIPartnerSession.findFirst({
        where: {
          userId: user.id,
          status: 'COMPLETED',
        },
        orderBy: { endedAt: 'desc' },
        select: {
          subject: true,
          searchCriteria: true,
          skillLevel: true,
          studyGoal: true,
        },
      })

      // If last session has searchCriteria, use createAISessionFromSearch for full restoration
      if (lastSession?.searchCriteria && typeof lastSession.searchCriteria === 'object') {
        const searchCriteria = lastSession.searchCriteria as SearchCriteria

        const result = await createAISessionFromSearch({
          userId: user.id,
          searchCriteria,
          studyGoal: lastSession.studyGoal || undefined,
        })

        return NextResponse.json({
          success: true,
          session: {
            id: result.session.id,
            subject: result.session.subject,
            status: result.session.status,
          },
          mode,
          searchCriteria, // Return so frontend knows what was restored
          redirectUrl: `/ai-partner/${result.session.id}`,
        })
      }

      // Fallback: If no searchCriteria, just use subject
      if (lastSession?.subject) {
        const result = await createAISession({
          userId: user.id,
          subject: lastSession.subject,
          skillLevel: lastSession.skillLevel || undefined,
          studyGoal: lastSession.studyGoal || undefined,
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
      }
    }

    // New topic mode OR continue mode with no previous session
    // Create new session - AI will ask what they want to study
    const result = await createAISession({
      userId: user.id,
      subject: customSubject || undefined,
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
