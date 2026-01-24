/**
 * Study Document Upload API - Upload PDFs and documents
 *
 * Handles:
 * - PDF files (textbooks, notes, worksheets)
 * - Word documents (DOC, DOCX)
 * - Text files
 *
 * Extracts text content for AI processing
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateDocumentFile, FILE_SIZE_LIMITS } from '@/lib/file-validation'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'

// Maximum upload size for documents
const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024 // 10MB
const MAX_UPLOAD_SIZE_MB = 10

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  // Check Content-Length header FIRST
  const contentLength = request.headers.get('content-length')
  if (contentLength) {
    const size = parseInt(contentLength, 10)
    if (size > MAX_UPLOAD_SIZE_BYTES) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_UPLOAD_SIZE_MB}MB.` },
        { status: 413 }
      )
    }
  }

  // Rate limiting: 20 document uploads per hour
  const rateLimitResult = await rateLimit(request, {
    ...RateLimitPresets.ai,
    keyPrefix: 'document-upload',
    max: 20,
  })

  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many uploads. Please wait a moment.' },
      { status: 429, headers: rateLimitResult.headers }
    )
  }

  try {
    // Verify authentication (allow guests with trial system)
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const struggleType = formData.get('struggleType') as string || 'general'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file size
    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      return NextResponse.json(
        { error: `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum is ${MAX_UPLOAD_SIZE_MB}MB.` },
        { status: 413 }
      )
    }

    // Validate document file
    const validation = await validateDocumentFile(file, FILE_SIZE_LIMITS.MESSAGE_FILE)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    // Extract text based on file type
    let extractedContent = ''

    if (file.type === 'text/plain') {
      // Plain text - just read directly
      extractedContent = await file.text()
    } else if (file.type === 'application/pdf') {
      // PDF - extract text using pdf-parse or similar
      extractedContent = await extractPdfText(file)
    } else if (
      file.type === 'application/msword' ||
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      // Word documents - extract text
      extractedContent = await extractWordText(file)
    }

    // Truncate if too long (prevent token overflow)
    // AI preprocessing will further optimize if needed
    const MAX_CHARS = 12000 // Matches guide-me API INPUT_SIZE.MAX
    if (extractedContent.length > MAX_CHARS) {
      // Smart truncation: keep beginning and end
      const keepStart = Math.floor(MAX_CHARS * 0.7)
      const keepEnd = Math.floor(MAX_CHARS * 0.25)
      const startPart = extractedContent.slice(0, keepStart)
      const endPart = extractedContent.slice(-keepEnd)
      extractedContent = `${startPart}\n\n[... middle content summarized ...]\n\n${endPart}`
    }

    // Format based on struggle type
    const formattedContent = formatExtractedContent(extractedContent, struggleType, file.name)

    // Store file reference for authenticated users (non-blocking)
    if (user) {
      const fileName = `documents/${user.id}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}-${validation.sanitizedName}`
      const arrayBuffer = await file.arrayBuffer()

      supabase.storage
        .from('user-uploads')
        .upload(fileName, Buffer.from(arrayBuffer), {
          contentType: file.type,
          upsert: false,
        })
        .catch(err => console.warn('[Document Upload] Storage upload failed (non-critical):', err))
    }

    const duration = Date.now() - startTime
    if (duration > 5000) {
      console.warn(`[Document Upload] Slow processing: ${duration}ms`)
    }

    return NextResponse.json({
      success: true,
      extractedContent: formattedContent,
      originalFileName: file.name,
      fileType: file.type,
      processingTimeMs: duration,
    })

  } catch (error) {
    console.error('[Document Upload] Error:', error)

    if (error instanceof Error && error.message.includes('rate')) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a moment.' },
        { status: 429 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to process document. Please try again or paste the text directly.' },
      { status: 500 }
    )
  }
}

/**
 * Extract text from PDF file
 * Enhanced extraction with multiple strategies for better coverage
 */
async function extractPdfText(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)
    const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes)

    const textMatches: string[] = []

    // Strategy 1: Extract text from BT...ET blocks (PDF text objects)
    const btEtRegex = /BT[\s\S]*?ET/g
    const btEtMatches = text.match(btEtRegex) || []

    for (const match of btEtMatches) {
      // Extract text from Tj operators (single string)
      const tjMatches = match.match(/\(([^)]*)\)\s*Tj/g) || []
      for (const tj of tjMatches) {
        const extracted = tj.match(/\(([^)]*)\)/)?.[1] || ''
        if (extracted.trim()) {
          textMatches.push(decodeEscapedPdfString(extracted))
        }
      }

      // Extract text from TJ operators (array of strings)
      const tjArrayMatches = match.match(/\[([\s\S]*?)\]\s*TJ/gi) || []
      for (const tjArray of tjArrayMatches) {
        const stringParts = tjArray.match(/\(([^)]*)\)/g) || []
        for (const part of stringParts) {
          const extracted = part.match(/\(([^)]*)\)/)?.[1] || ''
          if (extracted.trim()) {
            textMatches.push(decodeEscapedPdfString(extracted))
          }
        }
      }
    }

    // Strategy 2: Extract readable text from streams (for text-based PDFs)
    const plainTextRegex = /stream\s*([\s\S]*?)\s*endstream/g
    let streamMatch
    while ((streamMatch = plainTextRegex.exec(text)) !== null) {
      const streamContent = streamMatch[1]
      // Filter for readable ASCII text and clean up
      const readable = streamContent
        .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      // Only add if it looks like meaningful text (not just PDF commands)
      if (readable.length > 30 && /[a-zA-Z]{3,}/.test(readable)) {
        textMatches.push(readable)
      }
    }

    // Strategy 3: Look for Unicode text markers (ToUnicode CMap)
    const unicodeTextRegex = /<([0-9A-Fa-f]+)>\s*Tj/g
    let unicodeMatch
    while ((unicodeMatch = unicodeTextRegex.exec(text)) !== null) {
      const hexString = unicodeMatch[1]
      const decoded = decodeHexString(hexString)
      if (decoded.trim()) {
        textMatches.push(decoded)
      }
    }

    // Combine and clean up all extracted text
    let extractedText = textMatches
      .join(' ')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\s+/g, ' ')
      .trim()

    // Remove duplicate consecutive words (common PDF artifact)
    extractedText = extractedText.replace(/\b(\w+)\s+\1\b/g, '$1')

    if (!extractedText || extractedText.length < 30) {
      return '[PDF content could not be fully extracted. This may be a scanned PDF or image-based document. For best results, please copy and paste the text directly, or upload a photo for image analysis.]'
    }

    return extractedText
  } catch (error) {
    console.error('[PDF Extract] Error:', error)
    return '[PDF extraction failed. Please copy and paste the text directly.]'
  }
}

/**
 * Decode escaped PDF string characters
 */
function decodeEscapedPdfString(str: string): string {
  return str
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\')
}

/**
 * Decode hex string to text (for Unicode PDF content)
 */
function decodeHexString(hex: string): string {
  try {
    let result = ''
    for (let i = 0; i < hex.length; i += 2) {
      const charCode = parseInt(hex.substring(i, i + 2), 16)
      if (charCode >= 32 && charCode <= 126) {
        result += String.fromCharCode(charCode)
      }
    }
    return result
  } catch {
    return ''
  }
}

/**
 * Extract text from Word documents
 * Enhanced extraction for DOCX (ZIP-based) and DOC formats
 */
async function extractWordText(file: File): Promise<string> {
  try {
    if (file.type === 'application/msword') {
      // Legacy .doc format - extract readable text
      const arrayBuffer = await file.arrayBuffer()
      const bytes = new Uint8Array(arrayBuffer)
      const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes)

      // Extract text between specific DOC markers and filter for readable content
      const textMatches: string[] = []

      // Look for text content (DOC stores text in various ways)
      const readable = text
        .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

      // Filter out very short segments that are likely metadata
      const segments = readable.split(/\s{3,}/)
      for (const segment of segments) {
        if (segment.length > 10 && /[a-zA-Z]{2,}/.test(segment)) {
          textMatches.push(segment)
        }
      }

      const extractedText = textMatches.join(' ').trim()

      if (!extractedText || extractedText.length < 20) {
        return '[Legacy .doc format could not be fully extracted. Please save as .docx or copy and paste the text directly.]'
      }

      return extractedText
    }

    // DOCX is a ZIP file containing XML
    const arrayBuffer = await file.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)
    const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes)

    const textMatches: string[] = []

    // Strategy 1: Extract text from w:t tags (Word text elements)
    const wtRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g
    let match
    while ((match = wtRegex.exec(text)) !== null) {
      if (match[1].trim()) {
        textMatches.push(decodeXmlEntities(match[1]))
      }
    }

    // Strategy 2: Extract any readable text that might be outside w:t tags
    // This catches headers, footers, and other content
    const additionalTextRegex = /<w:instrText[^>]*>([^<]+)<\/w:instrText>/g
    while ((match = additionalTextRegex.exec(text)) !== null) {
      if (match[1].trim() && match[1].length > 3) {
        textMatches.push(decodeXmlEntities(match[1]))
      }
    }

    // Clean up and format the text
    let extractedText = textMatches
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()

    // Decode common XML entities
    extractedText = decodeXmlEntities(extractedText)

    if (!extractedText || extractedText.length < 20) {
      return '[Document content could not be fully extracted. Please copy and paste the text directly.]'
    }

    return extractedText
  } catch (error) {
    console.error('[Word Extract] Error:', error)
    return '[Document extraction failed. Please copy and paste the text directly.]'
  }
}

/**
 * Decode common XML entities
 */
function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
}

/**
 * Format extracted content based on struggle type
 */
function formatExtractedContent(content: string, struggleType: string, fileName: string): string {
  const cleanContent = content.trim()

  if (!cleanContent || cleanContent.startsWith('[')) {
    return cleanContent // Return error messages as-is
  }

  switch (struggleType) {
    case 'dont_understand':
      return `[From document: ${fileName}]\n\nContent to explain:\n${cleanContent}`

    case 'test_coming':
      return `[From document: ${fileName}]\n\nStudy material for flashcards:\n${cleanContent}`

    case 'homework_help':
      return `[From document: ${fileName}]\n\nHomework content:\n${cleanContent}`

    default:
      return `[From document: ${fileName}]\n\n${cleanContent}`
  }
}
