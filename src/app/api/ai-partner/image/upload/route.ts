/**
 * AI Partner Image Upload API
 * POST /api/ai-partner/image/upload - Upload and analyze an image in chat
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendMessageWithImage } from '@/lib/ai-partner'

// Max image size: 10MB
const MAX_IMAGE_SIZE = 10 * 1024 * 1024

// Allowed MIME types
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
]

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { sessionId, content, imageBase64, imageMimeType } = body

    // Validate required fields
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
    }

    if (!imageBase64) {
      return NextResponse.json({ error: 'Image data required' }, { status: 400 })
    }

    if (!imageMimeType || !ALLOWED_MIME_TYPES.includes(imageMimeType)) {
      return NextResponse.json(
        { error: 'Invalid image type. Allowed: JPEG, PNG, GIF, WebP' },
        { status: 400 }
      )
    }

    // Check image size (base64 is ~33% larger than binary)
    const approximateSize = (imageBase64.length * 3) / 4
    if (approximateSize > MAX_IMAGE_SIZE) {
      return NextResponse.json(
        { error: 'Image too large. Maximum size is 10MB' },
        { status: 400 }
      )
    }

    // Process the image message
    const result = await sendMessageWithImage({
      sessionId,
      userId: user.id,
      content: content || '',
      imageBase64,
      imageMimeType,
    })

    return NextResponse.json({
      success: true,
      userMessage: result.userMessage,
      aiMessage: result.aiMessage,
      imageAnalysis: result.imageAnalysis,
    })
  } catch (error) {
    console.error('[AI Partner] Image upload error:', error)

    if (error instanceof Error) {
      if (error.message === 'Session not found') {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 })
      }
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
      }
      if (error.message === 'Session is not active') {
        return NextResponse.json({ error: 'Session has ended' }, { status: 400 })
      }
      if (error.message.includes('Failed to')) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    }

    return NextResponse.json(
      { error: 'Failed to process image' },
      { status: 500 }
    )
  }
}
