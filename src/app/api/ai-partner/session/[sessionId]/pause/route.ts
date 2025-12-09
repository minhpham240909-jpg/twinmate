/**
 * AI Partner Pause Session API
 * POST /api/ai-partner/session/[sessionId]/pause - Pause an active session
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { pauseSession } from '@/lib/ai-partner'

interface RouteParams {
  params: Promise<{ sessionId: string }>
}

// POST: Pause session
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sessionId } = await params

    const result = await pauseSession({
      sessionId,
      userId: user.id,
    })

    return NextResponse.json({
      success: result.success,
    })
  } catch (error) {
    console.error('[AI Partner] Pause session error:', error)

    if (error instanceof Error) {
      if (error.message === 'Session not found or unauthorized') {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 })
      }
      if (error.message === 'Session is not active') {
        return NextResponse.json({ error: 'Session is not active' }, { status: 400 })
      }
    }

    return NextResponse.json(
      { error: 'Failed to pause session' },
      { status: 500 }
    )
  }
}
