/**
 * AI Partner Whiteboard API
 * POST /api/ai-partner/whiteboard - Analyze whiteboard image
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { analyzeWhiteboard } from '@/lib/ai-partner'

// POST: Analyze whiteboard image
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { sessionId, imageBase64, userQuestion } = body

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
    }

    if (!imageBase64) {
      return NextResponse.json({ error: 'Image data required' }, { status: 400 })
    }

    // Validate base64 image data (should be reasonably sized)
    // Max ~5MB base64 (which is ~3.75MB actual image)
    if (imageBase64.length > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Image too large' }, { status: 400 })
    }

    const result = await analyzeWhiteboard({
      sessionId,
      userId: user.id,
      imageBase64,
      userQuestion,
    })

    return NextResponse.json({
      success: true,
      analysis: result.analysis,
      suggestions: result.suggestions,
      relatedConcepts: result.relatedConcepts,
      messageId: result.messageId,
    })
  } catch (error) {
    console.error('[AI Partner] Analyze whiteboard error:', error)

    if (error instanceof Error) {
      if (error.message === 'Session not found or unauthorized') {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 })
      }
    }

    return NextResponse.json(
      { error: 'Failed to analyze whiteboard' },
      { status: 500 }
    )
  }
}
