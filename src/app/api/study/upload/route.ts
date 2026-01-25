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
      model: 'gpt-4o-mini',
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
      max_tokens: 1500, // Increased for thorough extraction
      temperature: 0.3, // Lower temperature for more accurate extraction
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
 * Enhanced prompts for thorough extraction of all educational content
 */
function getAnalysisPrompt(struggleType: string): string {
  const basePrompt = `You are an expert educational content analyzer. Your job is to THOROUGHLY extract ALL relevant content from this image so a student can get help with it.

=== EXTRACTION RULES ===

1. TEXT EXTRACTION:
   - Extract ALL visible text, exactly as written
   - Include headers, titles, labels, and captions
   - For handwriting: do your BEST to read it, even if partially unclear
   - Preserve mathematical notation: use proper symbols (×, ÷, √, π, etc.)
   - For equations: use clear format like "2x + 3 = 7" or "f(x) = x²"

2. MATHEMATICAL CONTENT:
   - Extract complete equations, formulas, and expressions
   - Include all given values and variables
   - Note what needs to be solved (find x, calculate area, etc.)
   - Preserve fractions, exponents, and special notation

3. DIAGRAMS & FIGURES:
   - Describe what the diagram shows
   - Extract any labels, measurements, or annotations
   - Note relationships between elements
   - For graphs: describe axes, scale, and key points

4. TABLES & DATA:
   - Extract table headers and values
   - Preserve the structure and relationships
   - Note any patterns or important values

5. MULTIPLE CHOICE / QUESTIONS:
   - Extract the question AND all answer choices
   - Include any instructions or context
   - Note the question number if visible

BE THOROUGH: It's better to extract too much than too little. The student needs complete information to get help.

`

  switch (struggleType) {
    case 'dont_understand':
      return basePrompt + `The student doesn't understand something in this image and needs the concept explained.

EXTRACT EVERYTHING, then organize as:

TOPIC: [Identify the main concept/subject - be specific, e.g., "Quadratic equations" not just "Math"]

CONTENT: [Extract ALL text, equations, problems, or content shown. Be complete and precise.]

KEY ELEMENTS:
- [List specific formulas, definitions, or rules shown]
- [Any examples or worked problems]
- [Diagrams or visual elements described]

CONTEXT: [What subject is this? What chapter/topic might this be from? Any clues about difficulty level?]

CONFUSION POINTS: [What parts might be confusing? Where might students typically get stuck?]`

    case 'test_coming':
      return basePrompt + `The student has a test coming up and shared this study material. Extract content for creating flashcards and review materials.

EXTRACT EVERYTHING, then organize as:

SUBJECT: [Specific subject and topic area]

KEY CONCEPTS:
1. [First key concept with definition/explanation if shown]
2. [Second key concept]
3. [Continue for all concepts visible]

FORMULAS/RULES:
- [Any formulas, equations, or rules shown]

VOCABULARY:
- [Key terms with definitions if provided]

EXAMPLES:
- [Any example problems or worked solutions]

CONTENT: [Full extraction of all text and information shown]

TEST-WORTHY ITEMS: [What from this content is likely to appear on a test?]`

    case 'homework_help':
      return basePrompt + `The student needs help with homework shown in this image. Extract the COMPLETE problem so they can get step-by-step guidance.

EXTRACT EVERYTHING, then organize as:

PROBLEM TYPE: [Be specific: "Solving linear equations", "Finding area of composite shapes", "Essay prompt about Civil War causes", etc.]

PROBLEM STATEMENT: [Extract the EXACT problem/question as written. Include ALL parts.]

GIVEN INFORMATION:
- [List all given values, data, or constraints]
- [Include any formulas or hints provided]
- [Note any diagrams or figures with their labels]

WHAT TO FIND: [What is the student being asked to do/solve/answer?]

ANSWER CHOICES: [If multiple choice, list ALL options]

ADDITIONAL CONTEXT: [Any instructions, point values, or other relevant info]

IMPORTANT: Extract the COMPLETE problem. Missing information means the student can't get proper help.`

    default:
      return basePrompt + `Extract all educational content from this image.

EXTRACT EVERYTHING, then organize as:

CONTENT TYPE: [What type of educational content is this? Be specific.]

SUBJECT/TOPIC: [What subject area and specific topic?]

MAIN CONTENT:
[Extract ALL text, equations, diagrams, or other content shown. Be thorough and complete.]

KEY ELEMENTS:
- [Important formulas, definitions, or concepts]
- [Examples or problems]
- [Visual elements described]

STRUCTURE: [How is the content organized? Sections, steps, etc.]

ADDITIONAL NOTES: [Any other relevant observations that might help the student]`
  }
}
