/**
 * AI Partner Image Generation API
 * POST /api/ai-partner/image/generate - Generate educational image with DALL-E 3
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { generateImageForSession, checkImageSuggestion, VALID_IMAGE_STYLES } from '@/lib/ai-partner'

export async function POST(request: NextRequest) {
  try {
    // Rate limit - DALL-E image generation is expensive
    const rateLimitResult = await rateLimit(request, RateLimitPresets.ai)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many image requests. Please wait before generating more.' },
        { status: 429, headers: rateLimitResult.headers }
      )
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { sessionId, prompt, style = 'diagram' } = body

    // Validate required fields
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
    }

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Image prompt required' }, { status: 400 })
    }

    if (prompt.length < 10) {
      return NextResponse.json(
        { error: 'Please provide a more detailed description (at least 10 characters)' },
        { status: 400 }
      )
    }

    if (prompt.length > 1000) {
      return NextResponse.json(
        { error: 'Description too long (max 1000 characters)' },
        { status: 400 }
      )
    }

    // Validate style
    if (!VALID_IMAGE_STYLES.includes(style)) {
      return NextResponse.json(
        { error: `Invalid style. Options: ${VALID_IMAGE_STYLES.join(', ')}` },
        { status: 400 }
      )
    }

    // Generate the image
    const result = await generateImageForSession({
      sessionId,
      userId: user.id,
      prompt: prompt.trim(),
      style,
    })

    return NextResponse.json({
      success: true,
      imageUrl: result.imageUrl,
      messageId: result.messageId,
      revisedPrompt: result.revisedPrompt,
    })
  } catch (error) {
    console.error('[AI Partner] Image generation error:', error)

    if (error instanceof Error) {
      if (error.message === 'Session not found or unauthorized') {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 })
      }
      if (error.message === 'Session is not active') {
        return NextResponse.json({ error: 'Session has ended' }, { status: 400 })
      }
      if (error.message.includes('content_policy')) {
        return NextResponse.json(
          { error: 'The image request was blocked. Please try a different description.' },
          { status: 400 }
        )
      }
      if (error.message.includes('rate_limit')) {
        return NextResponse.json(
          { error: 'Too many requests. Please wait a moment and try again.' },
          { status: 429 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Failed to generate image. Please try again.' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/ai-partner/image/generate?sessionId=xxx
 * Check if AI should suggest generating an image
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
    }

    const suggestion = await checkImageSuggestion({
      sessionId,
      userId: user.id,
    })

    return NextResponse.json(suggestion)
  } catch (error) {
    console.error('[AI Partner] Image suggestion check error:', error)
    return NextResponse.json({ shouldSuggest: false })
  }
}
