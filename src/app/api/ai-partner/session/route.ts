/**
 * AI Partner Session API
 * POST /api/ai-partner/session - Create new AI session
 * GET /api/ai-partner/session - Get user's sessions
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  createAISession,
  getUserSessions,
  getDefaultPersona,
} from '@/lib/ai-partner'
import type { SkillLevel } from '@prisma/client'

// POST: Create new AI partner session
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { subject, skillLevel, studyGoal, personaId } = body

    // Validate skill level if provided
    const validSkillLevels: SkillLevel[] = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']
    if (skillLevel && !validSkillLevels.includes(skillLevel)) {
      return NextResponse.json({ error: 'Invalid skill level' }, { status: 400 })
    }

    // Ensure default persona exists
    await getDefaultPersona()

    // Create session
    const result = await createAISession({
      userId: user.id,
      subject,
      skillLevel,
      studyGoal,
      personaId,
    })

    return NextResponse.json({
      success: true,
      session: result.session,
      welcomeMessage: result.welcomeMessage,
    })
  } catch (error) {
    console.error('[AI Partner] Create session error:', error)
    return NextResponse.json(
      { error: 'Failed to create AI session' },
      { status: 500 }
    )
  }
}

// GET: Get user's AI sessions
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status') as 'ACTIVE' | 'COMPLETED' | undefined

    const sessions = await getUserSessions(user.id, { limit, status })

    return NextResponse.json({
      success: true,
      sessions,
    })
  } catch (error) {
    console.error('[AI Partner] Get sessions error:', error)
    return NextResponse.json(
      { error: 'Failed to get sessions' },
      { status: 500 }
    )
  }
}
