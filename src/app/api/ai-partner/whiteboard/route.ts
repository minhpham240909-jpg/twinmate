/**
 * AI Partner Whiteboard API
 * POST /api/ai-partner/whiteboard - Analyze whiteboard image or get drawing suggestions
 * Uses Redis-based rate limiting for production scalability
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { analyzeWhiteboard, getWhiteboardSuggestions } from '@/lib/ai-partner'
import { rateLimit } from '@/lib/rate-limit'

// POST: Analyze whiteboard image or get drawing suggestions
export async function POST(request: NextRequest) {
  try {
    // Rate limiting - 20 requests per minute using Redis (production-ready)
    const rateLimitResult = await rateLimit(request, {
      max: 20,
      windowMs: 60 * 1000, // 1 minute
      keyPrefix: 'whiteboard',
    })

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a moment before trying again.' },
        { status: 429, headers: rateLimitResult.headers }
      )
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { sessionId, imageBase64, userQuestion, mode } = body

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
    }

    // Mode: 'analyze' (default) or 'suggest' (for empty canvas suggestions)
    const requestMode = mode || 'analyze'

    if (requestMode === 'suggest') {
      // Get drawing suggestions without requiring an image
      const result = await getWhiteboardSuggestions({
        sessionId,
        userId: user.id,
        userQuestion,
      })

      return NextResponse.json({
        success: true,
        mode: 'suggest',
        suggestions: result.suggestions,
        drawingIdeas: result.drawingIdeas,
        visualizationTips: result.visualizationTips,
        messageId: result.messageId,
      }, { headers: rateLimitResult.headers })
    }

    // Default: analyze mode - requires image
    if (!imageBase64) {
      return NextResponse.json({ error: 'Image data required for analysis' }, { status: 400 })
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
      mode: 'analyze',
      analysis: result.analysis,
      suggestions: result.suggestions,
      relatedConcepts: result.relatedConcepts,
      messageId: result.messageId,
    }, { headers: rateLimitResult.headers })
  } catch (error) {
    console.error('[AI Partner] Whiteboard API error:', error)

    if (error instanceof Error) {
      if (error.message === 'Session not found or unauthorized') {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 })
      }
    }

    return NextResponse.json(
      { error: 'Failed to process whiteboard request' },
      { status: 500 }
    )
  }
}
