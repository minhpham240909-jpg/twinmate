/**
 * DEEP CONTENT ANALYSIS API
 *
 * POST /api/analyze/deep - Perform deep analysis on files/URLs
 *
 * Features:
 * - Multi-file batch processing (up to 10 files)
 * - High-detail vision for images/diagrams
 * - OCR for scanned PDFs
 * - Deep URL content extraction
 * - Organized, structured output
 *
 * Security:
 * - Rate limited (20 per hour - expensive AI operation)
 * - File size validation
 * - Input sanitization
 * - Auth required for full features
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { createRequestLogger, getCorrelationId } from '@/lib/logger'
import {
  analyzeContentDeep,
  ContentFile,
  ContentType,
  DeepAnalysisRequest,
} from '@/lib/analysis/deep-content-analyzer'

// Limits
const MAX_FILES = 10
const MAX_TOTAL_SIZE_MB = 50
const MAX_SINGLE_FILE_MB = 20
const MAX_TEXT_LENGTH = 50000
const MAX_URL_COUNT = 5

// Allowed MIME types
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
]

const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]

export async function POST(request: NextRequest) {
  const log = createRequestLogger(request)
  const correlationId = getCorrelationId(request)
  const startTime = Date.now()

  try {
    // Rate limiting - expensive operation, strict limits
    const rateLimitResult = await rateLimit(request, {
      ...RateLimitPresets.hourly,
      keyPrefix: 'deep-analyze',
      max: 20, // 20 deep analyses per hour
    })

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: 'Too many analysis requests. Deep analysis is resource-intensive.',
          retryAfter: rateLimitResult.headers['Retry-After'],
        },
        { status: 429, headers: rateLimitResult.headers }
      )
    }

    // Auth check - allow guests with limited features
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Parse request body
    const body = await request.json()

    const {
      files: rawFiles,
      urls,
      text,
      userGoal,
      userLevel,
      focusAreas,
      options,
    } = body as {
      files?: Array<{
        name: string
        data: string
        mimeType: string
        size?: number
      }>
      urls?: string[]
      text?: string
      userGoal?: string
      userLevel?: 'beginner' | 'intermediate' | 'advanced'
      focusAreas?: string[]
      options?: {
        analyzeVisuals?: boolean
        extractOCR?: boolean
        organizeMultiple?: boolean
      }
    }

    // Validate input - must have at least one source
    if (
      (!rawFiles || rawFiles.length === 0) &&
      (!urls || urls.length === 0) &&
      !text
    ) {
      return NextResponse.json(
        { error: 'No content provided. Please upload files, URLs, or text.' },
        { status: 400 }
      )
    }

    // Build content files array
    const contentFiles: ContentFile[] = []
    let totalSize = 0

    // Process uploaded files
    if (rawFiles && rawFiles.length > 0) {
      if (rawFiles.length > MAX_FILES) {
        return NextResponse.json(
          { error: `Maximum ${MAX_FILES} files allowed per request.` },
          { status: 400 }
        )
      }

      for (const file of rawFiles) {
        // Validate file
        const validation = validateFile(file)
        if (!validation.valid) {
          return NextResponse.json(
            { error: `Invalid file "${file.name}": ${validation.error}` },
            { status: 400 }
          )
        }

        const fileSize = file.size || estimateBase64Size(file.data)
        totalSize += fileSize

        if (fileSize > MAX_SINGLE_FILE_MB * 1024 * 1024) {
          return NextResponse.json(
            { error: `File "${file.name}" exceeds ${MAX_SINGLE_FILE_MB}MB limit.` },
            { status: 413 }
          )
        }

        contentFiles.push({
          id: generateFileId(),
          type: detectContentType(file.mimeType),
          name: sanitizeFileName(file.name),
          data: file.data,
          mimeType: file.mimeType,
          size: fileSize,
        })
      }

      if (totalSize > MAX_TOTAL_SIZE_MB * 1024 * 1024) {
        return NextResponse.json(
          { error: `Total upload size exceeds ${MAX_TOTAL_SIZE_MB}MB limit.` },
          { status: 413 }
        )
      }
    }

    // Process URLs
    if (urls && urls.length > 0) {
      if (urls.length > MAX_URL_COUNT) {
        return NextResponse.json(
          { error: `Maximum ${MAX_URL_COUNT} URLs allowed per request.` },
          { status: 400 }
        )
      }

      for (const url of urls) {
        const validation = validateUrl(url)
        if (!validation.valid) {
          return NextResponse.json(
            { error: `Invalid URL "${url}": ${validation.error}` },
            { status: 400 }
          )
        }

        contentFiles.push({
          id: generateFileId(),
          type: 'url',
          name: new URL(url).hostname,
          data: url,
        })
      }
    }

    // Process text input
    if (text) {
      if (text.length > MAX_TEXT_LENGTH) {
        return NextResponse.json(
          { error: `Text input exceeds ${MAX_TEXT_LENGTH} character limit.` },
          { status: 400 }
        )
      }

      contentFiles.push({
        id: generateFileId(),
        type: 'text',
        name: 'Direct Text Input',
        data: text,
      })
    }

    // Guest limitations
    if (!user) {
      // Guests: limit to 3 files and disable some features
      if (contentFiles.length > 3) {
        return NextResponse.json(
          {
            error: 'Sign in to analyze more than 3 items at once.',
            requiresAuth: true,
          },
          { status: 403 }
        )
      }
    }

    log.info('Starting deep analysis', {
      userId: user?.id || 'guest',
      fileCount: contentFiles.length,
      fileTypes: contentFiles.map(f => f.type),
      userGoal: userGoal?.slice(0, 50),
    })

    // Perform deep analysis
    const analysisRequest: DeepAnalysisRequest = {
      files: contentFiles,
      userGoal,
      userLevel: userLevel || 'intermediate',
      focusAreas: focusAreas || [],
      analyzeVisuals: options?.analyzeVisuals !== false,
      extractOCR: options?.extractOCR !== false,
      organizeMultiple: options?.organizeMultiple !== false,
    }

    const result = await analyzeContentDeep(analysisRequest)

    const processingTime = Date.now() - startTime

    log.info('Deep analysis complete', {
      userId: user?.id || 'guest',
      analysisId: result.id,
      success: result.success,
      processingTimeMs: processingTime,
      sectionsFound: result.sections.length,
    })

    // Store analysis for authenticated users (non-blocking)
    if (user && result.success) {
      storeAnalysisRecord(user.id, result).catch(err =>
        log.warn('Failed to store analysis record', { error: err })
      )
    }

    return NextResponse.json(
      {
        success: result.success,
        analysis: {
          id: result.id,
          overview: result.overview,
          sections: result.sections,
          diagrams: result.diagrams,
          extractedText: {
            structured: result.extractedText.structured,
            wordCount: result.extractedText.wordCount,
          },
          learningContext: result.learningContext,
          organization: result.organization,
          explanations: result.explanations,
        },
        processingTimeMs: processingTime,
        errors: result.errors,
      },
      {
        headers: {
          'x-correlation-id': correlationId,
          ...rateLimitResult.headers,
        },
      }
    )

  } catch (error) {
    log.error('Deep analysis failed', error instanceof Error ? error : { error })

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid request format. Please check your input.' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Analysis failed. Please try again with different content.' },
      { status: 500 }
    )
  }
}

// ============================================
// VALIDATION HELPERS
// ============================================

interface ValidationResult {
  valid: boolean
  error?: string
}

function validateFile(file: { name: string; data: string; mimeType: string }): ValidationResult {
  // Check name
  if (!file.name || file.name.length > 255) {
    return { valid: false, error: 'Invalid file name' }
  }

  // Check MIME type
  const isImage = ALLOWED_IMAGE_TYPES.includes(file.mimeType)
  const isDocument = ALLOWED_DOCUMENT_TYPES.includes(file.mimeType)

  if (!isImage && !isDocument) {
    return {
      valid: false,
      error: `Unsupported file type: ${file.mimeType}. Allowed: images (jpg, png, gif, webp, heic), documents (pdf, doc, docx, txt)`,
    }
  }

  // Check data
  if (!file.data || file.data.length === 0) {
    return { valid: false, error: 'Empty file data' }
  }

  return { valid: true }
}

function validateUrl(url: string): ValidationResult {
  try {
    const parsed = new URL(url)

    // Only allow http/https
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { valid: false, error: 'Only HTTP/HTTPS URLs allowed' }
    }

    // Block localhost and private IPs
    const hostname = parsed.hostname.toLowerCase()
    if (
      hostname === 'localhost' ||
      hostname.startsWith('127.') ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('172.')
    ) {
      return { valid: false, error: 'Private/local URLs not allowed' }
    }

    return { valid: true }
  } catch {
    return { valid: false, error: 'Invalid URL format' }
  }
}

function detectContentType(mimeType: string): ContentType {
  if (ALLOWED_IMAGE_TYPES.includes(mimeType)) {
    return 'image'
  }
  if (mimeType === 'application/pdf') {
    return 'pdf'
  }
  if (
    mimeType === 'application/msword' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return 'document'
  }
  if (mimeType === 'text/plain') {
    return 'text'
  }
  return 'text'
}

function sanitizeFileName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\.\./g, '_')
    .slice(0, 100)
}

function generateFileId(): string {
  return `file-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
}

function estimateBase64Size(base64: string): number {
  // Remove data URL prefix if present
  const base64Data = base64.includes(',') ? base64.split(',')[1] : base64
  // Base64 encodes 3 bytes in 4 characters
  return Math.floor((base64Data.length * 3) / 4)
}

// ============================================
// STORAGE (Non-blocking)
// ============================================

async function storeAnalysisRecord(
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result: any
): Promise<void> {
  // This would store analysis metadata in the database
  // For now, just log it - can add DB storage later
  console.log('[Deep Analysis] Would store record for user', userId, 'analysis', result.id)
}
