/**
 * Voice Transcription API - Convert speech to text for "I'm Stuck" flow
 *
 * Uses OpenAI Whisper for accurate transcription
 * Supports multiple audio formats
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 60000, // 60 second timeout for voice (transcription can be slow)
  maxRetries: 2,
})

// Maximum audio size - 25MB (Whisper limit)
const MAX_AUDIO_SIZE_BYTES = 25 * 1024 * 1024
const MAX_AUDIO_SIZE_MB = 25

// Supported audio formats
const SUPPORTED_FORMATS = [
  'audio/webm',
  'audio/mp4',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/ogg',
  'audio/m4a',
  'video/webm', // MediaRecorder sometimes produces this
]

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  // Check Content-Length header FIRST
  const contentLength = request.headers.get('content-length')
  if (contentLength) {
    const size = parseInt(contentLength, 10)
    if (size > MAX_AUDIO_SIZE_BYTES) {
      return NextResponse.json(
        { error: `Audio too large. Maximum size is ${MAX_AUDIO_SIZE_MB}MB.` },
        { status: 413 }
      )
    }
  }

  // Rate limiting: 50 transcriptions per hour
  const rateLimitResult = await rateLimit(request, {
    ...RateLimitPresets.ai,
    max: 50,
    keyPrefix: 'voice-transcription',
  })

  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many voice requests. Please wait a moment.' },
      { status: 429, headers: rateLimitResult.headers }
    )
  }

  try {
    // Verify authentication
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse form data
    const formData = await request.formData()
    const audioFile = formData.get('audio') as File

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio provided' }, { status: 400 })
    }

    // Validate file size
    if (audioFile.size > MAX_AUDIO_SIZE_BYTES) {
      return NextResponse.json(
        { error: `Audio too large (${(audioFile.size / 1024 / 1024).toFixed(1)}MB). Maximum is ${MAX_AUDIO_SIZE_MB}MB.` },
        { status: 413 }
      )
    }

    // Validate audio format
    const mimeType = audioFile.type.toLowerCase()
    if (!SUPPORTED_FORMATS.some(format => mimeType.includes(format.split('/')[1]))) {
      return NextResponse.json(
        { error: 'Unsupported audio format. Please use WebM, MP3, WAV, or M4A.' },
        { status: 400 }
      )
    }

    // Check minimum size (avoid empty recordings)
    if (audioFile.size < 1000) {
      return NextResponse.json(
        { error: 'Recording too short. Please speak for at least a second.' },
        { status: 400 }
      )
    }

    // Convert to buffer for Whisper
    const arrayBuffer = await audioFile.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Create a File object for OpenAI
    const file = new File([buffer], 'audio.webm', { type: audioFile.type })

    // Transcribe with Whisper
    const transcription = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language: 'en', // Default to English, can be made dynamic
      response_format: 'json',
      prompt: 'This is a student asking for help with studying, homework, or understanding a concept.', // Helps with context
    })

    const text = transcription.text?.trim() || ''

    if (!text) {
      return NextResponse.json(
        { error: 'Could not understand the audio. Please try speaking more clearly.' },
        { status: 400 }
      )
    }

    const duration = Date.now() - startTime
    if (duration > 5000) {
      console.warn(`[Voice API] Slow transcription: ${duration}ms`)
    }

    return NextResponse.json({
      success: true,
      text,
      processingTimeMs: duration,
    })

  } catch (error) {
    console.error('[Voice API] Error:', error)

    // Handle specific OpenAI errors
    if (error instanceof Error) {
      if (error.message.includes('rate')) {
        return NextResponse.json(
          { error: 'Too many requests. Please wait a moment.' },
          { status: 429 }
        )
      }
      if (error.message.includes('audio')) {
        return NextResponse.json(
          { error: 'Could not process audio. Please try again or type your question.' },
          { status: 400 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Failed to transcribe audio. Please try typing your question instead.' },
      { status: 500 }
    )
  }
}
