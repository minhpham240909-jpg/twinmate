/**
 * CLERVA INPUT ANALYZER
 *
 * Analyzes various input types (URLs, videos, PDFs, images) to extract
 * learning context for roadmap generation.
 *
 * PHILOSOPHY:
 * - Inputs expand understanding
 * - Roadmaps control behavior
 * - Users do the work
 *
 * This service does NOT:
 * - Summarize content for users
 * - Explain/transcribe content
 * - Replace the user's work
 *
 * This service DOES:
 * - Extract learning context from inputs
 * - Identify what the user is trying to learn
 * - Detect prerequisites, topics, and complexity
 * - Feed this context into roadmap generation
 */

import OpenAI from 'openai'
import logger from '@/lib/logger'
import { fetchWithBackoff } from '@/lib/api/timeout'

// ============================================
// TYPES
// ============================================

export type InputType = 'url' | 'youtube' | 'pdf' | 'image' | 'text' | 'unknown'

export interface AnalyzedInput {
  type: InputType
  source: string // Original URL or identifier
  extractedContext: {
    topic: string // Main topic/subject detected
    subtopics: string[] // Related subtopics
    complexity: 'beginner' | 'intermediate' | 'advanced'
    prerequisites: string[] // What user should know first
    keyConceptsCount: number // Rough estimate of concepts to learn
    contentType: 'lecture' | 'tutorial' | 'documentation' | 'textbook' | 'exercise' | 'general'
    estimatedStudyMinutes: number // Rough time to properly study this
  }
  roadmapHints: {
    focusAreas: string[] // What parts matter most for learning
    skipSections: string[] // Low-value sections to skip
    suggestedApproach: string // How to use this material
    warningsForStudent: string[] // Common mistakes with this type of content
  }
  rawExtract?: string // First portion of extracted text (for AI context)
  analyzedAt: Date
  success: boolean
  error?: string
}

export interface InputAnalysisRequest {
  input: string // URL, or base64 image, or text
  inputType?: InputType // Optional hint about input type
  userGoal?: string // What user wants to achieve
  userLevel?: string // User's current level
}

// ============================================
// CONFIGURATION
// ============================================

const OPENAI_TIMEOUT_MS = 30000
const MAX_CONTENT_CHARS = 8000 // Limit content sent to AI
const YOUTUBE_PATTERN = /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
const PDF_PATTERN = /\.pdf(?:\?|$)/i

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: OPENAI_TIMEOUT_MS,
  maxRetries: 1,
})

// ============================================
// MAIN ANALYZER
// ============================================

/**
 * Analyze input and extract learning context for roadmap generation
 */
export async function analyzeInput(request: InputAnalysisRequest): Promise<AnalyzedInput> {
  const startTime = Date.now()
  const { input, inputType, userGoal, userLevel } = request

  try {
    // 1. Detect input type
    const detectedType = inputType || detectInputType(input)

    // 2. Extract content based on type
    let extractedContent: string
    let source = input

    switch (detectedType) {
      case 'youtube':
        extractedContent = await extractYouTubeContext(input)
        break
      case 'url':
        extractedContent = await extractWebPageContext(input)
        break
      case 'pdf':
        extractedContent = await extractPDFContext(input)
        break
      case 'image':
        extractedContent = await extractImageContext(input)
        break
      case 'text':
      default:
        extractedContent = input.slice(0, MAX_CONTENT_CHARS)
        source = 'direct-text'
    }

    // 3. Analyze extracted content with AI
    const analysis = await analyzeContentWithAI(extractedContent, userGoal, userLevel)

    logger.info('[Input Analyzer] Analysis complete', {
      type: detectedType,
      durationMs: Date.now() - startTime,
      topic: analysis.extractedContext.topic,
    })

    return {
      ...analysis,
      type: detectedType,
      source,
      analyzedAt: new Date(),
      success: true,
    }
  } catch (error) {
    logger.error('[Input Analyzer] Analysis failed', error instanceof Error ? error : { error })

    return {
      type: 'unknown',
      source: input.slice(0, 100),
      extractedContext: {
        topic: 'Unknown topic',
        subtopics: [],
        complexity: 'intermediate',
        prerequisites: [],
        keyConceptsCount: 5,
        contentType: 'general',
        estimatedStudyMinutes: 30,
      },
      roadmapHints: {
        focusAreas: ['Review the core concepts'],
        skipSections: [],
        suggestedApproach: 'Start from the beginning and work through systematically',
        warningsForStudent: ['Content could not be fully analyzed'],
      },
      analyzedAt: new Date(),
      success: false,
      error: error instanceof Error ? error.message : 'Analysis failed',
    }
  }
}

// ============================================
// INPUT TYPE DETECTION
// ============================================

function detectInputType(input: string): InputType {
  const trimmed = input.trim()

  // Check for YouTube
  if (YOUTUBE_PATTERN.test(trimmed)) {
    return 'youtube'
  }

  // Check for URL
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    // Check if PDF
    if (PDF_PATTERN.test(trimmed)) {
      return 'pdf'
    }
    return 'url'
  }

  // Check for base64 image
  if (trimmed.startsWith('data:image/') || trimmed.startsWith('/9j/') || trimmed.startsWith('iVBOR')) {
    return 'image'
  }

  // Default to text
  return 'text'
}

// ============================================
// CONTENT EXTRACTORS
// ============================================

/**
 * Extract context from YouTube video
 * Uses video metadata and transcript if available
 */
async function extractYouTubeContext(url: string): Promise<string> {
  const match = url.match(YOUTUBE_PATTERN)
  if (!match) {
    return `YouTube video URL: ${url}`
  }

  const videoId = match[1]

  try {
    // Try to get video info via oEmbed (no API key needed)
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
    const response = await fetchWithBackoff(oembedUrl, {}, { timeoutPerAttemptMs: 5000, maxRetries: 2 })
    const data = await response.json()

    const context = `
VIDEO TITLE: ${data.title || 'Unknown'}
CHANNEL: ${data.author_name || 'Unknown'}
VIDEO ID: ${videoId}

[This is a YouTube video. The roadmap should guide the student on HOW to effectively learn from this video, not summarize it.]
`
    return context.trim()
  } catch {
    // Fallback if oEmbed fails
    return `YouTube video (ID: ${videoId}). The roadmap should guide the student on how to effectively learn from this video content.`
  }
}

/**
 * Extract context from web page
 */
async function extractWebPageContext(url: string): Promise<string> {
  try {
    const response = await fetchWithBackoff(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ClervBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    }, { timeoutPerAttemptMs: 8000, maxRetries: 2 })

    const html = await response.text()

    // Extract meaningful content (title, meta, main text)
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    const title = titleMatch ? titleMatch[1].trim() : ''

    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)
    const description = descMatch ? descMatch[1].trim() : ''

    // Extract main text (simplified - removes tags)
    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_CONTENT_CHARS)

    return `
URL: ${url}
TITLE: ${title}
DESCRIPTION: ${description}

CONTENT PREVIEW:
${textContent.slice(0, 2000)}

[This is web content. The roadmap should guide the student on how to effectively use this resource for learning.]
`.trim()
  } catch {
    return `Web page at: ${url}. The roadmap should guide the student on how to approach learning from web resources.`
  }
}

/**
 * Extract context from PDF
 * Note: Full PDF parsing requires additional libraries
 * This provides basic context for now
 */
async function extractPDFContext(url: string): Promise<string> {
  // For now, we provide context about the PDF without full parsing
  // Full PDF parsing would require pdf-parse or similar library
  return `
PDF DOCUMENT: ${url}

[This is a PDF document. The roadmap should guide the student on:
1. How to identify the most important sections
2. What to focus on vs. what to skim
3. How to take effective notes
4. How to verify understanding before moving on]
`.trim()
}

/**
 * Extract context from image (homework, whiteboard, worksheet)
 * Uses GPT-4 Vision for analysis
 */
async function extractImageContext(imageData: string): Promise<string> {
  try {
    // Prepare image for vision API
    let imageUrl: string
    if (imageData.startsWith('data:image/')) {
      imageUrl = imageData
    } else if (imageData.startsWith('http')) {
      imageUrl = imageData
    } else {
      // Assume base64 without prefix
      imageUrl = `data:image/jpeg;base64,${imageData}`
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are analyzing an educational image (homework, whiteboard, worksheet, etc.) to help create a learning roadmap.

DO NOT solve the problem or give answers.
DO extract:
1. What subject/topic this is about
2. What type of content (homework, notes, diagram, etc.)
3. What concepts are being tested
4. Estimated difficulty level
5. What prerequisites might be needed

Be concise. Return factual observations only.`,
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: imageUrl, detail: 'low' }, // Low detail for faster processing
            },
            {
              type: 'text',
              text: 'Analyze this educational content. What topic is it about? What concepts does it test? What level is it?',
            },
          ],
        },
      ],
      max_tokens: 300,
    })

    const analysis = response.choices[0]?.message?.content || ''

    return `
IMAGE ANALYSIS:
${analysis}

[This is an image-based educational content. The roadmap should guide the student on:
1. The concept being tested
2. The approach to solve this TYPE of problem
3. What to practice before attempting
DO NOT solve it for them.]
`.trim()
  } catch (error) {
    logger.warn('[Input Analyzer] Image analysis failed', { error: error instanceof Error ? error.message : String(error) })
    return 'Educational image content. The roadmap should guide the student through the problem-solving approach.'
  }
}

// ============================================
// AI ANALYSIS
// ============================================

/**
 * Analyze extracted content with AI to generate learning context
 */
async function analyzeContentWithAI(
  content: string,
  userGoal?: string,
  userLevel?: string
): Promise<Omit<AnalyzedInput, 'type' | 'source' | 'analyzedAt' | 'success' | 'error'>> {
  const systemPrompt = `You analyze educational content to help create learning roadmaps.

Your job is to extract LEARNING CONTEXT, not to summarize or explain the content.

From the provided content, determine:
1. Main topic and subtopics
2. Complexity level (beginner/intermediate/advanced)
3. Prerequisites needed
4. Content type (lecture, tutorial, documentation, textbook, exercise)
5. Estimated study time
6. What parts to focus on vs. skip
7. Common student mistakes with this type of content

${userGoal ? `User's goal: ${userGoal}` : ''}
${userLevel ? `User's level: ${userLevel}` : ''}

Return JSON only.`

  const userPrompt = `Analyze this content for learning roadmap generation:

${content.slice(0, MAX_CONTENT_CHARS)}

Return this exact JSON structure:
{
  "extractedContext": {
    "topic": "main topic",
    "subtopics": ["subtopic1", "subtopic2"],
    "complexity": "beginner|intermediate|advanced",
    "prerequisites": ["prereq1", "prereq2"],
    "keyConceptsCount": 5,
    "contentType": "lecture|tutorial|documentation|textbook|exercise|general",
    "estimatedStudyMinutes": 30
  },
  "roadmapHints": {
    "focusAreas": ["what to focus on"],
    "skipSections": ["what to skip"],
    "suggestedApproach": "how to use this for learning",
    "warningsForStudent": ["common mistakes"]
  }
}`

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3, // Lower temperature for more consistent analysis
      max_tokens: 500,
      response_format: { type: 'json_object' },
    })

    const result = JSON.parse(completion.choices[0]?.message?.content || '{}')

    return {
      extractedContext: {
        topic: result.extractedContext?.topic || 'Unknown topic',
        subtopics: result.extractedContext?.subtopics || [],
        complexity: result.extractedContext?.complexity || 'intermediate',
        prerequisites: result.extractedContext?.prerequisites || [],
        keyConceptsCount: result.extractedContext?.keyConceptsCount || 5,
        contentType: result.extractedContext?.contentType || 'general',
        estimatedStudyMinutes: result.extractedContext?.estimatedStudyMinutes || 30,
      },
      roadmapHints: {
        focusAreas: result.roadmapHints?.focusAreas || ['Core concepts'],
        skipSections: result.roadmapHints?.skipSections || [],
        suggestedApproach: result.roadmapHints?.suggestedApproach || 'Work through systematically',
        warningsForStudent: result.roadmapHints?.warningsForStudent || [],
      },
      rawExtract: content.slice(0, 500), // Store first 500 chars for context
    }
  } catch (error) {
    logger.error('[Input Analyzer] AI analysis failed', error instanceof Error ? error : { error })

    // Return safe defaults
    return {
      extractedContext: {
        topic: 'Educational content',
        subtopics: [],
        complexity: 'intermediate',
        prerequisites: [],
        keyConceptsCount: 5,
        contentType: 'general',
        estimatedStudyMinutes: 30,
      },
      roadmapHints: {
        focusAreas: ['Review core concepts'],
        skipSections: [],
        suggestedApproach: 'Start from the beginning',
        warningsForStudent: [],
      },
    }
  }
}

// ============================================
// UTILITY: Format analysis for roadmap prompt
// ============================================

/**
 * Format analyzed input for inclusion in roadmap generation prompt
 */
export function formatInputForRoadmap(analysis: AnalyzedInput): string {
  if (!analysis.success) {
    return ''
  }

  const { extractedContext, roadmapHints } = analysis

  return `
=== ANALYZED INPUT CONTEXT ===
Source: ${analysis.type.toUpperCase()} content
Topic: ${extractedContext.topic}
${extractedContext.subtopics.length > 0 ? `Subtopics: ${extractedContext.subtopics.join(', ')}` : ''}
Complexity: ${extractedContext.complexity}
Content type: ${extractedContext.contentType}
Estimated study time: ${extractedContext.estimatedStudyMinutes} minutes
${extractedContext.prerequisites.length > 0 ? `Prerequisites: ${extractedContext.prerequisites.join(', ')}` : ''}

=== ROADMAP GUIDANCE ===
Focus on: ${roadmapHints.focusAreas.join('; ')}
${roadmapHints.skipSections.length > 0 ? `Skip/skim: ${roadmapHints.skipSections.join('; ')}` : ''}
Approach: ${roadmapHints.suggestedApproach}
${roadmapHints.warningsForStudent.length > 0 ? `Warn student: ${roadmapHints.warningsForStudent.join('; ')}` : ''}

IMPORTANT: Create a roadmap to help the student UNDERSTAND and USE this material.
DO NOT summarize or explain the content itself.
The roadmap teaches HOW to learn from this input, not WHAT the input says.
`
}

/**
 * Check if input contains analyzable content
 */
export function hasAnalyzableContent(input: string): boolean {
  if (!input || typeof input !== 'string') return false

  const trimmed = input.trim()
  if (trimmed.length < 10) return false

  // Check for URL patterns
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return true

  // Check for base64 image
  if (trimmed.startsWith('data:image/')) return true

  // Check for YouTube patterns
  if (YOUTUBE_PATTERN.test(trimmed)) return true

  return false
}
