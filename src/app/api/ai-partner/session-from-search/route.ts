/**
 * AI Partner Session from Search API
 * POST /api/ai-partner/session-from-search - Create AI session from search criteria
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAISessionFromSearch } from '@/lib/ai-partner'
import type { SearchCriteria } from '@/lib/ai-partner/openai'

// POST: Create AI session from search criteria
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { searchCriteria, studyGoal } = body as {
      searchCriteria: SearchCriteria
      studyGoal?: string
    }

    if (!searchCriteria) {
      return NextResponse.json(
        { error: 'Search criteria is required' },
        { status: 400 }
      )
    }

    // Create AI session with dynamic persona from search criteria
    const result = await createAISessionFromSearch({
      userId: user.id,
      searchCriteria,
      studyGoal,
    })

    return NextResponse.json({
      success: true,
      session: result.session,
      welcomeMessage: result.welcomeMessage,
      personaDescription: result.personaDescription,
    })
  } catch (error) {
    console.error('[AI Partner] Session from search creation error:', error)
    return NextResponse.json(
      { error: 'Failed to create AI session' },
      { status: 500 }
    )
  }
}
