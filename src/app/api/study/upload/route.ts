/**
 * Study Upload API - Upload images for "I'm Stuck" flow
 *
 * Handles:
 * - Homework photos
 * - Screenshot uploads
 * - Handwritten notes
 *
 * Uses OpenAI Vision to extract text and context from images
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateImageFile, FILE_SIZE_LIMITS } from '@/lib/file-validation'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 30000, // 30 second timeout
  maxRetries: 2,
})

// Maximum upload size
const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024 // 10MB for study images
const MAX_UPLOAD_SIZE_MB = 10

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  // Check Content-Length header FIRST
  const contentLength = request.headers.get('content-length')
  if (contentLength) {
    const size = parseInt(contentLength, 10)
    if (size > MAX_UPLOAD_SIZE_BYTES) {
      return NextResponse.json(
        { error: `Image too large. Maximum size is ${MAX_UPLOAD_SIZE_MB}MB.` },
        { status: 413 }
      )
    }
  }

  // Rate limiting: 30 uploads per hour for study images
  const rateLimitResult = await rateLimit(request, {
    ...RateLimitPresets.ai,
    keyPrefix: 'study-upload',
  })

  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many uploads. Please wait a moment.' },
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
    const file = formData.get('file') as File
    const struggleType = formData.get('struggleType') as string || 'general'

    if (!file) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 })
    }

    // Validate file size
    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      return NextResponse.json(
        { error: `Image too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum is ${MAX_UPLOAD_SIZE_MB}MB.` },
        { status: 413 }
      )
    }

    // Validate image file
    const validation = await validateImageFile(file, FILE_SIZE_LIMITS.POST_IMAGE)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    // Convert to base64 for OpenAI Vision
    const arrayBuffer = await file.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    const mimeType = file.type || 'image/jpeg'
    const dataUrl = `data:${mimeType};base64,${base64}`

    // Use OpenAI Vision to analyze the image
    const analysisPrompt = getAnalysisPrompt(struggleType)

    const visionResponse = await openai.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: analysisPrompt,
            },
            {
              type: 'image_url',
              image_url: {
                url: dataUrl,
                detail: 'high', // Use high detail for better text recognition
              },
            },
          ],
        },
      ],
      max_tokens: 1000,
    })

    const extractedContent = visionResponse.choices[0]?.message?.content || ''

    // Also upload to storage for reference (non-blocking)
    const fileName = `study/${user.id}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.jpg`

    // Fire and forget - don't wait for storage upload
    supabase.storage
      .from('user-uploads')
      .upload(fileName, Buffer.from(arrayBuffer), {
        contentType: mimeType,
        upsert: false,
      })
      .catch(err => console.warn('[Study Upload] Storage upload failed (non-critical):', err))

    const duration = Date.now() - startTime
    if (duration > 5000) {
      console.warn(`[Study Upload] Slow processing: ${duration}ms`)
    }

    return NextResponse.json({
      success: true,
      extractedContent,
      processingTimeMs: duration,
    })

  } catch (error) {
    console.error('[Study Upload] Error:', error)

    // Return a helpful error message
    if (error instanceof Error && error.message.includes('rate')) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a moment.' },
        { status: 429 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to process image. Please try again or type your question instead.' },
      { status: 500 }
    )
  }
}

/**
 * Get the appropriate analysis prompt based on struggle type
 */
function getAnalysisPrompt(struggleType: string): string {
  const basePrompt = `Analyze this image and extract the relevant educational content.

IMPORTANT: Extract text, equations, diagrams, or problems shown in the image.
Be specific about what you see. If there's handwriting, do your best to read it.
If it's a math problem, extract the exact equation or problem statement.
If it's text from a book or notes, extract the key content.

`

  switch (struggleType) {
    case 'dont_understand':
      return basePrompt + `The student doesn't understand something in this image.
Identify the main concept or topic shown.
Format your response as:
TOPIC: [main topic/concept]
CONTENT: [extracted text, equations, or description of what's shown]
CONTEXT: [any additional relevant context]`

    case 'test_coming':
      return basePrompt + `The student has a test coming up and shared this study material.
Extract key terms, concepts, or problems that would be good for review.
Format your response as:
SUBJECT: [subject area]
KEY CONCEPTS: [list of main concepts shown]
CONTENT: [extracted text or problems]`

    case 'homework_help':
      return basePrompt + `The student needs help with homework shown in this image.
Extract the problem or question exactly as written.
Format your response as:
PROBLEM TYPE: [type of problem - math, essay, science, etc.]
PROBLEM: [exact problem statement or question]
GIVEN INFO: [any given information or context]`

    default:
      return basePrompt + `Extract the educational content from this image.
Format your response as:
CONTENT TYPE: [what type of content this is]
MAIN CONTENT: [extracted text, equations, or description]
ADDITIONAL NOTES: [any other relevant information]`
  }
}
