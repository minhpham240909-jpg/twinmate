/**
 * Guide Me AI API - MVP Core Feature
 *
 * Single endpoint for the "I'm Stuck" flow that generates micro-actions:
 * - Explanation (Explain Pack): Concept breakdown to build understanding
 * - Flashcards (Test Prep Sprint): Cards that test understanding, not memory
 * - Roadmap (Guide Me): Step-by-step learning plan for ANY educational goal
 *
 * Design principles:
 * - Under 1 minute to get help
 * - NEVER give direct answers - guide students to discover understanding
 * - Different from ChatGPT/Gemini: We teach, not answer
 * - Smart enough to detect what type of help is needed
 * - LEARNS from user behavior and adapts over time
 *
 * CRITICAL: Clerva exists to make students LEARN, not to do their work.
 * A student who copies an answer learns nothing.
 * A student who discovers the answer learns forever.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import OpenAI from 'openai'
import { v4 as uuidv4 } from 'uuid'
import {
  buildMemoryContext,
  getOrCreateUserMemory,
  addToUserMemoryArray,
  updateUserMemoryField,
  saveMemories,
} from '@/lib/ai-partner/memory'
import type { AIMemoryCategory } from '@prisma/client'
import logger, { createRequestLogger, getCorrelationId } from '@/lib/logger'
import {
  analyzeInput,
  hasAnalyzableContent,
  formatInputForRoadmap,
  type AnalyzedInput,
} from '@/lib/roadmap-engine/input-analyzer'

// Type for extracted memory entries
interface ExtractedMemory {
  category: AIMemoryCategory
  content: string
  importance: number
  context?: string
}

// OpenAI client with timeout to prevent hanging requests at scale
const OPENAI_TIMEOUT_MS = 45000 // 45 seconds for complex inputs
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: OPENAI_TIMEOUT_MS,
  maxRetries: 1, // Single retry to keep response fast
})

// Input size thresholds for adaptive processing
const INPUT_SIZE = {
  SMALL: 500,    // < 500 chars - quick response
  MEDIUM: 2000,  // 500-2000 chars - standard response
  LARGE: 8000,   // 2000-8000 chars - comprehensive response
  MAX: 12000,    // > 8000 chars - truncate intelligently
} as const

// Types
type MicroActionType = 'explanation' | 'flashcards' | 'roadmap' | 'auto'
type StruggleType = 'dont_understand' | 'test_coming' | 'homework_help' | 'general'

interface ExplanationAction {
  type: 'explanation'
  title: string
  // NEW: Structured Learning Pack format
  core: {
    idea: string // The main concept in one clear sentence
    keyPoints: string[] // 2-4 supporting key points
  }
  steps?: { // Optional step-by-step breakdown
    step: string
    why: string // Why this step matters
  }[]
  example?: { // Optional worked example
    problem: string
    solution: string
  }
  checkQuestion?: { // Optional self-check question
    question: string
    hint: string
  }
  // Legacy field for backwards compatibility
  points?: string[] // 3-5 bullet points (deprecated, use core.keyPoints)
  followUp?: string // Optional follow-up question to guide deeper learning
  acknowledgment?: string // Natural recognition of their effort (only when earned)
  nextSuggestion?: string // Automatic "what's next" in tutor voice
}

interface FlashcardAction {
  type: 'flashcards'
  cards: {
    id: string
    question: string
    answer: string
    hint?: string
  }[]
  acknowledgment?: string // Natural recognition of their effort (only when earned)
  nextSuggestion?: string // Automatic "what's next" in tutor voice
}

interface RoadmapAction {
  type: 'roadmap'
  title: string
  overview?: string // Brief approach summary
  encouragement: string
  steps: {
    id: string
    order: number
    duration: number // minutes
    timeframe: string // "Days 1-3", "Week 1", etc.
    title: string
    description: string
    method?: string // Specific how-to
    avoid?: string // What NOT to do
    doneWhen?: string // Success criterion
    hints: string[] // Progressive hints (legacy, kept for compatibility)
  }[]
  pitfalls?: string[] // Overall things to avoid
  successLooksLike?: string // What completion looks like
  totalMinutes: number
  acknowledgment?: string // Natural recognition of their effort (only when earned)
  nextSuggestion?: string // Automatic "what's next" in tutor voice
}

type MicroAction = ExplanationAction | FlashcardAction | RoadmapAction

// Secondary action suggestion - shown as optional next step
interface SecondaryActionSuggestion {
  type: 'flashcards' | 'explanation' | 'roadmap'
  reason: string // Why this is suggested
  prompt: string // Pre-filled prompt to use if user taps
}

interface GuideRequest {
  question: string // What the user is stuck on
  subject?: string // Optional subject context
  struggleType?: StruggleType // Type of struggle
  actionType?: MicroActionType // Preferred action type (or 'auto' to let AI decide)
  inputUrl?: string // Optional URL/video/PDF to analyze for roadmap context
  inputImage?: string // Optional base64 image (homework, worksheet, etc.)
}

interface GuideResponse {
  success: boolean
  action: MicroAction
  secondaryAction?: SecondaryActionSuggestion // Optional secondary output suggestion
  xpEarned: number
  streakUpdated: boolean
  encouragement: string
}

// XP reward for completing a micro-action
const XP_PER_ACTION = 10

// Guest trial limit (server-side enforcement)
const GUEST_TRIAL_LIMIT = 3

// ============================================
// Response Cache for Common Queries
// ============================================
// Simple in-memory cache with TTL to speed up repeated queries
// This reduces AI calls for common questions like "what is photosynthesis"

interface CacheEntry {
  response: MicroAction
  timestamp: number
  hits: number
}

const responseCache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes
const CACHE_MAX_SIZE = 100 // Limit memory usage

/**
 * Generate a cache key from the query parameters
 * Only cache short, generic queries (not personalized content)
 */
function getCacheKey(question: string, actionType: string, struggleType: string): string | null {
  // Only cache short queries (likely to be common questions)
  if (question.length > 200) return null

  // Don't cache if it looks personalized (contains "my", "I", names, etc.)
  const personalPatterns = /\b(my|mine|i'm|i am|i have|i need|help me|my homework|my test|my class)\b/i
  if (personalPatterns.test(question)) return null

  // Normalize the question for consistent caching
  const normalized = question.toLowerCase().trim().replace(/[^\w\s]/g, '')
  return `${normalized}:${actionType}:${struggleType}`
}

/**
 * Get cached response if available and not expired
 */
function getCachedResponse(key: string): MicroAction | null {
  const entry = responseCache.get(key)
  if (!entry) return null

  // Check if expired
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    responseCache.delete(key)
    return null
  }

  // Update hit count and move to end (LRU behavior)
  entry.hits++
  entry.timestamp = Date.now() // Update last access time
  
  // Move to end of Map (most recently used)
  responseCache.delete(key)
  responseCache.set(key, entry)
  
  return entry.response
}

/**
 * Cache a response for future use (LRU eviction)
 */
function cacheResponse(key: string, response: MicroAction): void {
  // If key exists, update and move to end
  if (responseCache.has(key)) {
    responseCache.delete(key)
  }
  
  // Evict least recently used entries if at capacity
  if (responseCache.size >= CACHE_MAX_SIZE) {
    // Remove 25% of oldest entries for efficiency
    const entriesToRemove = Math.max(1, Math.floor(CACHE_MAX_SIZE * 0.25))
    const keys = Array.from(responseCache.keys()).slice(0, entriesToRemove)
    keys.forEach(k => responseCache.delete(k))
  }

  responseCache.set(key, {
    response,
    timestamp: Date.now(),
    hits: 1,
  })
}
const GUEST_RATE_LIMIT_WINDOW = 24 * 60 * 60 * 1000 // 24 hours

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const log = createRequestLogger(request)
  const correlationId = getCorrelationId(request)

  try {
    // Check if user is authenticated
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Determine if this is a guest or authenticated user
    const isGuest = !user

    if (isGuest) {
      // GUEST MODE: Stricter rate limiting by IP
      // Allow 3 requests per 24 hours per IP for trial
      const guestRateLimitResult = await rateLimit(request, {
        max: GUEST_TRIAL_LIMIT,
        windowMs: GUEST_RATE_LIMIT_WINDOW,
        keyPrefix: 'guest-trial',
      })

      if (!guestRateLimitResult.success) {
        return NextResponse.json(
          {
            error: 'Trial limit reached',
            trialExhausted: true,
            message: 'Sign up to continue using Clerva!',
          },
          { status: 403, headers: guestRateLimitResult.headers }
        )
      }
    } else {
      // AUTHENTICATED USER: Normal rate limiting
      const rateLimitResult = await rateLimit(request, RateLimitPresets.ai)
      if (!rateLimitResult.success) {
        return NextResponse.json(
          { error: 'Too many requests. Please slow down.' },
          { status: 429, headers: rateLimitResult.headers }
        )
      }
    }

    const body: GuideRequest = await request.json()
    const { question, subject, struggleType = 'general', actionType = 'auto', inputUrl, inputImage } = body

    if (!question || typeof question !== 'string' || question.trim().length < 3) {
      return NextResponse.json({ error: 'Please provide a question or topic' }, { status: 400 })
    }

    // Analyze input material if provided (URL, video, PDF, image)
    // This extracts learning context to enhance roadmap quality
    let analyzedInput: AnalyzedInput | undefined
    const inputToAnalyze = inputUrl || inputImage

    if (inputToAnalyze && hasAnalyzableContent(inputToAnalyze)) {
      try {
        log.debug('Analyzing input material', { type: inputUrl ? 'url' : 'image' })
        analyzedInput = await analyzeInput({
          input: inputToAnalyze,
          userGoal: question,
          userLevel: undefined, // Will be filled from profile below
        })
        if (analyzedInput.success) {
          log.info('Input analysis complete', {
            type: analyzedInput.type,
            topic: analyzedInput.extractedContext.topic,
          })
        }
      } catch (err) {
        log.warn('Input analysis failed, continuing without', { error: err instanceof Error ? err.message : String(err) })
        // Continue without analyzed input - graceful degradation
      }
    }

    // Get user context (only for authenticated users)
    let userContext = ''
    let memoryContext = ''

    // Only fetch user context for authenticated users
    if (!isGuest && user) {
      try {
        // Fetch profile AND AI memory in parallel for speed
        const [profile, aiMemoryContext, aiUserMemory] = await Promise.all([
          prisma.profile.findUnique({
            where: { userId: user.id },
            select: {
              skillLevel: true,
              studyStyle: true,
              subjects: true,
              interests: true,
              goals: true,
              school: true,
            },
          }),
          buildMemoryContext(user.id, subject), // Get AI memory about this user
          getOrCreateUserMemory(user.id), // Get user's learning history
        ])

        memoryContext = aiMemoryContext

        if (profile) {
          const contextParts = []
          if (profile.skillLevel) contextParts.push(`Level: ${profile.skillLevel}`)
          if (profile.studyStyle) contextParts.push(`Style: ${profile.studyStyle}`)
          if (profile.subjects && profile.subjects.length > 0) {
            contextParts.push(`Studies: ${profile.subjects.slice(0, 3).join(', ')}`)
          }
          if (profile.goals && profile.goals.length > 0) {
            contextParts.push(`Goals: ${profile.goals.slice(0, 2).join(', ')}`)
          }
          userContext = contextParts.join(', ')
        }

        // Add AI memory insights
        if (aiUserMemory) {
          if (aiUserMemory.strugglingTopics.length > 0) {
            userContext += `\nNote: User has struggled with: ${aiUserMemory.strugglingTopics.slice(0, 3).join(', ')}`
          }
          if (aiUserMemory.masteredTopics.length > 0) {
            userContext += `\nNote: User has mastered: ${aiUserMemory.masteredTopics.slice(0, 3).join(', ')}`
          }
          if (aiUserMemory.preferredLearningStyle) {
            userContext += `\nLearning style: ${aiUserMemory.preferredLearningStyle}`
          }
        }
      } catch (err) {
        console.warn('[Guide Me API] Error loading user context:', err)
        // Continue without user context
      }
    }

    // Determine action type if auto
    const determinedActionType = actionType === 'auto'
      ? determineActionType(question, struggleType)
      : actionType

    // Check cache for common queries (speeds up repeated questions)
    // Don't cache if analyzed input is provided (personalized content)
    const cacheKey = analyzedInput ? null : getCacheKey(question, determinedActionType, struggleType)
    let action: MicroAction
    let fromCache = false

    if (cacheKey) {
      const cachedAction = getCachedResponse(cacheKey)
      if (cachedAction) {
        action = cachedAction
        fromCache = true
        log.debug('Cache hit', { cacheKey: cacheKey.slice(0, 50) })
      } else {
        // Generate the micro-action with full memory context
        action = await generateMicroAction(
          question,
          subject,
          struggleType,
          determinedActionType,
          userContext,
          memoryContext,
          analyzedInput
        )
        // Cache the response for future use
        cacheResponse(cacheKey, action)
      }
    } else {
      // Long or personalized query or has analyzed input - don't cache
      action = await generateMicroAction(
        question,
        subject,
        struggleType,
        determinedActionType,
        userContext,
        memoryContext,
        analyzedInput
      )
    }

    // Analyze if secondary action would help (lightweight, no extra AI call)
    const secondaryAction = analyzeForSecondaryAction(
      question,
      struggleType,
      determinedActionType,
      action
    )

    // Award XP (only for authenticated users, non-blocking)
    let xpEarned = 0
    let streakUpdated = false

    if (!isGuest && user) {
      try {
        const result = await awardXPAndUpdateStreak(user.id)
        xpEarned = result.xpEarned
        streakUpdated = result.streakUpdated
      } catch (error) {
        log.error('Error awarding XP', error instanceof Error ? error : { error })
        // Continue - XP failure shouldn't block the response
      }
    }

    // LEARN from this interaction - store in AI memory (only for authenticated users, non-blocking)
    if (!isGuest && user) {
      trackUserBehavior(user.id, question, struggleType, action.type, subject).catch((err: unknown) => {
        console.warn('[Guide Me API] Failed to track behavior:', err)
      })
    }

    const response: GuideResponse & { isGuest?: boolean; trialsRemaining?: number } = {
      success: true,
      action,
      secondaryAction,
      xpEarned,
      streakUpdated,
      encouragement: getEncouragement(action.type),
    }

    // Add guest-specific info to response
    if (isGuest) {
      response.isGuest = true
      // Note: Actual trials remaining is tracked client-side via localStorage
      // Server just enforces the limit via rate limiting
    }

    // Log performance
    const duration = Date.now() - startTime
    if (duration > 3000 && !fromCache) {
      console.warn(`[Guide Me API] Slow response: ${duration}ms`)
    }
    if (fromCache && duration < 100) {
      log.debug('Fast cache response', { durationMs: duration })
    }

    return NextResponse.json(response, {
      headers: {
        'x-correlation-id': correlationId,
      },
    })

  } catch (error) {
    log.error('Request failed', error instanceof Error ? error : { error })

    // Return error response with fallback action for graceful degradation
    return NextResponse.json({
      success: false,
      error: 'Unable to process your request. Please try again.',
      fallbackAction: createFallbackExplanation(),
      xpEarned: 0,
      streakUpdated: false,
      encouragement: "Let's work through this together!",
    }, { 
      status: 500,
      headers: {
        'x-correlation-id': correlationId,
      },
    })
  }
}

/**
 * Analyze if a secondary action would help the user
 *
 * Rules based on product vision:
 * - Explain Pack: Suggest flashcards if multi-concept, roadmap if overwhelmed
 * - Test Prep: Suggest explanation if a concept seems weak
 * - Guide Me: Suggest explanation if stuck on a complex step
 *
 * This is lightweight analysis (no AI call) to avoid latency
 */
function analyzeForSecondaryAction(
  question: string,
  struggleType: StruggleType,
  primaryActionType: MicroActionType,
  action: MicroAction
): SecondaryActionSuggestion | undefined {
  const q = question.toLowerCase()
  const questionLength = question.length

  // Indicators for different secondary needs
  const multiConceptIndicators = [
    'and', 'also', 'both', 'multiple', 'several', 'different',
    'compare', 'contrast', 'relationship', 'between', 'versus', 'vs'
  ]
  const overwhelmedIndicators = [
    'confused', 'lost', 'overwhelmed', 'don\'t know where to start',
    'too much', 'complex', 'complicated', 'hard', 'difficult',
    'no idea', 'completely', 'totally'
  ]
  const weakConceptIndicators = [
    'still don\'t', 'still confused', 'doesn\'t make sense',
    'why does', 'how does', 'what does', 'meaning of'
  ]

  const hasMultiConcept = multiConceptIndicators.some(ind => q.includes(ind))
  const isOverwhelmed = overwhelmedIndicators.some(ind => q.includes(ind))
  const hasWeakConcept = weakConceptIndicators.some(ind => q.includes(ind))
  const isLongQuestion = questionLength > 200

  // EXPLAIN PACK (explanation) secondary suggestions
  if (primaryActionType === 'explanation') {
    // If multi-concept, suggest flashcards to test understanding
    if (hasMultiConcept || (action.type === 'explanation' && action.core?.keyPoints && action.core.keyPoints.length >= 4)) {
      return {
        type: 'flashcards',
        reason: 'Test your understanding of these concepts',
        prompt: `Create flashcards to test: ${question.slice(0, 100)}`,
      }
    }

    // If overwhelmed or long question, suggest roadmap
    if (isOverwhelmed || isLongQuestion) {
      return {
        type: 'roadmap',
        reason: 'Break this down into manageable steps',
        prompt: `Create a step-by-step plan for: ${question.slice(0, 100)}`,
      }
    }
  }

  // TEST PREP (flashcards) secondary suggestions
  if (primaryActionType === 'flashcards') {
    // If weak concept indicators, suggest explanation
    if (hasWeakConcept) {
      return {
        type: 'explanation',
        reason: 'Strengthen your understanding first',
        prompt: `Explain the concept: ${question.slice(0, 100)}`,
      }
    }

    // If cards seem to cover a lot, suggest roadmap for structured review
    if (action.type === 'flashcards' && action.cards && action.cards.length >= 3 && isLongQuestion) {
      return {
        type: 'roadmap',
        reason: 'Create a study plan for this topic',
        prompt: `Create a study plan for my test on: ${question.slice(0, 100)}`,
      }
    }
  }

  // GUIDE ME (roadmap) secondary suggestions
  if (primaryActionType === 'roadmap') {
    // If question suggests conceptual confusion, suggest explanation
    if (hasWeakConcept || q.includes('understand')) {
      return {
        type: 'explanation',
        reason: 'Understand the concept before following steps',
        prompt: `Explain the concept behind: ${question.slice(0, 100)}`,
      }
    }

    // If many steps and complex topic, suggest flashcards for key terms
    if (action.type === 'roadmap' && action.steps && action.steps.length >= 4) {
      return {
        type: 'flashcards',
        reason: 'Review key terms as you work through steps',
        prompt: `Create flashcards for key terms in: ${question.slice(0, 100)}`,
      }
    }
  }

  // No secondary action needed
  return undefined
}

/**
 * Determine the best action type based on the question and struggle type
 */
function determineActionType(question: string, struggleType: StruggleType): MicroActionType {
  const q = question.toLowerCase()

  // Keywords that suggest specific action types
  const explanationKeywords = ['what is', 'what are', 'explain', 'understand', 'why', 'how does', 'meaning', 'define', 'concept']
  const flashcardKeywords = ['memorize', 'remember', 'quiz', 'test me', 'flashcard', 'review', 'terms', 'vocabulary']
  const roadmapKeywords = ['how to', 'steps', 'solve', 'approach', 'plan', 'strategy', 'start', 'where do i begin']

  // Check for keywords
  if (explanationKeywords.some(kw => q.includes(kw))) {
    return 'explanation'
  }
  if (flashcardKeywords.some(kw => q.includes(kw))) {
    return 'flashcards'
  }
  if (roadmapKeywords.some(kw => q.includes(kw))) {
    return 'roadmap'
  }

  // Base on struggle type
  switch (struggleType) {
    case 'dont_understand':
      return 'explanation'
    case 'test_coming':
      return 'flashcards'
    case 'homework_help':
      return 'roadmap'
    default:
      return 'explanation' // Default to explanation
  }
}

/**
 * Preprocess input for optimal AI analysis
 * - Cleans and structures input
 * - Handles large inputs intelligently
 * - Returns processed question and recommended token count
 */
function preprocessInput(rawQuestion: string): { question: string; maxTokens: number; isLarge: boolean } {
  let question = rawQuestion.trim()
  const originalLength = question.length

  // Determine input size category
  const isSmall = originalLength < INPUT_SIZE.SMALL
  const isMedium = originalLength >= INPUT_SIZE.SMALL && originalLength < INPUT_SIZE.MEDIUM
  const isLarge = originalLength >= INPUT_SIZE.MEDIUM

  // For very large inputs, intelligently truncate while preserving key content
  if (originalLength > INPUT_SIZE.MAX) {
    // Try to keep the beginning (usually the question) and end (usually context)
    const keepStart = Math.floor(INPUT_SIZE.MAX * 0.6) // 60% from start
    const keepEnd = Math.floor(INPUT_SIZE.MAX * 0.35) // 35% from end
    const startPart = question.slice(0, keepStart)
    const endPart = question.slice(-keepEnd)
    question = `${startPart}\n\n[... content summarized for processing ...]\n\n${endPart}`
  }

  // Clean up extracted content markers for better AI understanding
  question = question
    .replace(/\[From document:.*?\]/g, '') // Remove document markers
    .replace(/\[PDF content.*?\]/g, '') // Remove PDF warnings
    .replace(/TOPIC:|CONTENT:|KEY ELEMENTS:|CONTEXT:/g, '\n') // Clean extraction headers
    .replace(/\n{3,}/g, '\n\n') // Normalize newlines
    .trim()

  // Adaptive token allocation based on input size
  let maxTokens: number
  if (isSmall) {
    maxTokens = 600 // Quick, focused response
  } else if (isMedium) {
    maxTokens = 800 // Standard comprehensive response
  } else {
    maxTokens = 1000 // Full detailed response for complex inputs
  }

  return { question, maxTokens, isLarge }
}

/**
 * Generate a micro-action using AI - now with full memory context!
 * Optimized for fast, high-quality responses across all input sizes
 *
 * Enhanced: Now supports analyzed input (URLs, videos, PDFs, images) for
 * richer roadmap generation. The input is used to understand WHAT the user
 * wants to learn - NOT to summarize or explain the content.
 */
async function generateMicroAction(
  question: string,
  subject: string | undefined,
  struggleType: StruggleType,
  actionType: MicroActionType,
  userContext: string,
  memoryContext: string = '',
  analyzedInput?: AnalyzedInput
): Promise<MicroAction> {
  // Preprocess input for optimal handling
  const { question: processedQuestion, maxTokens, isLarge } = preprocessInput(question)

  const subjectContext = subject ? `Subject: ${subject}\n` : ''
  const userContextLine = userContext ? `Student context: ${userContext}\n` : ''
  // Memory context includes past sessions, struggles, successes, preferences
  const memorySection = memoryContext ? `\n${memoryContext}\n` : ''

  // Format analyzed input context for roadmap generation
  const inputMaterialContext = analyzedInput?.success
    ? formatInputForRoadmap(analyzedInput)
    : ''

  // Add hint for large inputs to help AI focus
  const largeInputHint = isLarge
    ? '\nNote: This is a detailed input. Focus on the CORE question/problem and provide a thorough but focused response.\n'
    : ''

  const struggleDescription = {
    dont_understand: "The student doesn't understand this concept and needs to build understanding",
    test_coming: "The student has a test coming up and needs to TEST their understanding (not just memorize)",
    homework_help: "The student needs a roadmap/plan to approach this educational goal (could be homework, a project, learning a new skill, or any educational challenge)",
    general: "The student is stuck and needs guidance to discover the answer themselves",
  }[struggleType]

  // Build the prompt based on action type
  let systemPrompt = ''
  let responseFormat = ''

  // Universal spelling correction instruction - added to ALL prompts
  const spellingInstruction = `
=== SPELLING & UNDERSTANDING ===
IMPORTANT: Users often make typos and spelling mistakes. You MUST:
1. AUTOMATICALLY understand what they mean even with misspellings (e.g., "engglis" = "English", "mathmatics" = "mathematics", "fizics" = "physics")
2. ALWAYS use CORRECT spelling in your response - never repeat their typos
3. Interpret their intent intelligently - focus on what they're trying to ask, not how they spelled it
4. Never mention or correct their spelling errors - just understand and respond correctly
5. This applies to ALL words - subjects, concepts, questions, everything

`

  if (actionType === 'explanation') {
    systemPrompt = `You are a Socratic tutor creating a LEARNING PACK. Your job is to guide the student to DISCOVER understanding themselves - NEVER hand them answers.
${spellingInstruction}

${subjectContext}${userContextLine}
Situation: ${struggleDescription}
${memorySection}${largeInputHint}

Create a structured Learning Pack with these components:

1. CORE IDEA: One clear sentence explaining the CONCEPT (not the answer)
2. KEY POINTS: 2-4 supporting ideas that BUILD understanding step by step
3. STEPS (if applicable): Break down how to THINK about this, each with a "why"
4. EXAMPLE (if helpful): A SIMILAR worked example - NOT the exact problem they asked about
5. CHECK QUESTION: A question that makes them APPLY what they learned

=== CRITICAL RULES - READ CAREFULLY ===

🚫 NEVER DO THESE:
- NEVER give the direct answer to their homework/test question
- NEVER solve their specific problem for them
- NEVER provide text they can copy-paste as an answer
- NEVER complete their assignment, even partially
- NEVER give "the answer is X" or "this equals Y"

✅ ALWAYS DO THESE:
- Teach the CONCEPT so they can find the answer themselves
- Use DIFFERENT examples from what they asked (similar but not identical)
- Ask questions that make them think
- Show the PROCESS of thinking, not the result
- If they ask "what is 2+2", teach addition - don't say "4"
- If they ask about a book, teach analysis skills - don't summarize the book

WHY: Clerva exists to make students LEARN, not to do their work for them. A student who copies an answer learns nothing. A student who discovers the answer learns forever.

ACKNOWLEDGMENT (optional - only if earned):
- Only add if the question shows depth or the concept is genuinely difficult
- Examples: "Good question — this trips up most students." or "You're approaching this the right way."
- If basic, set to null. Be genuine, never cheesy.

NEXT SUGGESTION (always include):
- Guide them toward applying what they learned
- Examples: "Try solving your problem using this approach - stuck on any step?" or "Now apply this to your question. What do you get?"

Be concise. Teach concepts, not answers.`

    responseFormat = `{
  "title": "Understanding [topic]",
  "core": {
    "idea": "The main concept in one clear sentence",
    "keyPoints": [
      "Key supporting point 1",
      "Key supporting point 2",
      "Key supporting point 3 (optional)",
      "Key supporting point 4 (optional)"
    ]
  },
  "steps": [
    { "step": "First step or concept piece", "why": "Why this matters" },
    { "step": "Second step", "why": "Why this matters" }
  ],
  "example": {
    "problem": "A concrete example problem (or null if not applicable)",
    "solution": "The worked solution showing the concept"
  },
  "checkQuestion": {
    "question": "A question to verify understanding",
    "hint": "A subtle hint to guide their thinking"
  },
  "acknowledgment": "Only if earned - recognition of good thinking (or null if not earned)",
  "nextSuggestion": "Natural offer for what to do next"
}`
  } else if (actionType === 'flashcards') {
    systemPrompt = `You are a Socratic tutor creating flashcards that TEST UNDERSTANDING - not memory recall.
${spellingInstruction}
${subjectContext}${userContextLine}
Situation: ${struggleDescription}
${memorySection}

=== CRITICAL RULES - READ CAREFULLY ===

🚫 NEVER CREATE CARDS THAT:
- Ask for direct definitions they can memorize
- Have answers that are copy-paste solutions
- Test recall of facts without understanding
- Give away answers to their actual homework/test
- Ask "What is X?" with answer "X is Y" format

✅ ALWAYS CREATE CARDS THAT:
- Ask "WHY" and "HOW" questions that require thinking
- Test if they can APPLY the concept to new situations
- Make them EXPLAIN in their own words
- Challenge them to find connections between ideas
- Use scenarios: "If X happens, what would you expect and why?"

EXAMPLE OF BAD VS GOOD:
❌ BAD: Q: "What is photosynthesis?" A: "The process plants use to convert sunlight to energy"
✅ GOOD: Q: "A plant is kept in complete darkness for a week. What happens to its glucose production and why?" A: (Hint guides them to connect sunlight → photosynthesis → glucose)

WHY: Flashcards that test memory create students who forget. Flashcards that test understanding create students who can think.

CARD STRUCTURE:
1. Create 2-3 cards that require THINKING
2. Questions should be scenarios or "why/how" questions
3. Answers should explain the REASONING (1-2 sentences)
4. Hints should guide their thinking process, not reveal the answer
5. If they've struggled with this before, reinforce the weak concept

ACKNOWLEDGMENT (optional - only if earned):
- Only add if they're being proactive about studying
- Examples: "Smart move preparing early." or "Most students skip review — you're ahead."
- If basic, set to null. Be genuine.

NEXT SUGGESTION (always include):
- Examples: "Try these without peeking at hints first. How many can you explain?" or "After these, want to try applying this to your actual problem?"

Test thinking, not memory.`

    responseFormat = `{
  "cards": [
    {
      "question": "A question that tests understanding...",
      "answer": "Brief, clear answer",
      "hint": "A subtle hint to guide thinking"
    }
  ],
  "acknowledgment": "Only if earned - recognition of good effort (or null if not earned)",
  "nextSuggestion": "Natural offer for what to do next"
}`
  } else if (actionType === 'roadmap') {
    // CLERVA ROADMAP ENGINE - System-controlled, professional output
    // Philosophy: The SYSTEM decides structure. The AI ONLY fills in content.
    // This prompt is "boring and strict" by design - that's what makes it reliable.
    //
    // Enhanced: Now supports analyzed input (URLs, videos, PDFs, images) for context.
    // The roadmap guides HOW to learn from the material - it does NOT summarize it.
    systemPrompt = `You are Clerva, a Learning Operating System. Create PROFESSIONAL roadmaps.
${spellingInstruction}
${subjectContext}${userContextLine}
Goal: ${struggleDescription}
${memorySection}
${inputMaterialContext ? `
=== INPUT MATERIAL PROVIDED ===
The user has provided learning material (URL, video, PDF, or image).
Your roadmap should guide them on HOW TO EFFECTIVELY LEARN from this material.

CRITICAL RULES FOR INPUT MATERIAL:
- DO NOT summarize the content
- DO NOT explain what the material says
- DO teach HOW to extract value from it
- DO guide which parts to focus on vs. skip
- DO warn about common mistakes when using this type of material
- The roadmap teaches the PATH to understanding, not the content itself

${inputMaterialContext}
` : ''}
=== SYSTEM RULES (NON-NEGOTIABLE) ===

The SYSTEM decides structure. You ONLY fill in content within strict boundaries.

OUTPUT REQUIREMENTS:
1. TITLE: Clear, specific goal (e.g., "Master English Vocabulary in 30 Days")
2. OVERVIEW: 1-2 sentences on the approach and expected outcome
3. STEPS: 3-5 specific, time-boxed steps. Each step MUST have:
   - TIMEFRAME: Specific period (Days 1-3, Week 1, Hour 1-2)
   - TITLE: Action-oriented (e.g., "Master Core Vocabulary", not "Set Goals")
   - DESCRIPTION: Exact what to do
   - METHOD: Specific how (technique, resource, tool)
   - AVOID: Common mistake NOT to make
   - DONE_WHEN: Clear success criterion
4. PITFALLS: 2-3 things to avoid overall
5. SUCCESS: What completion looks like

=== CORRECT vs WRONG OUTPUT ===

WRONG (generic, vague, question-based):
- "Set Clear Goals" with "What do you want to achieve?"
- "Create a Study Schedule" with vague suggestions
- "Practice Regularly" without specific actions
- "Stay Motivated" - meaningless advice

CORRECT (specific, actionable, professional):
{
  "title": "Master English Vocabulary: 500 Words in 30 Days",
  "overview": "Build vocabulary through spaced repetition and active usage.",
  "steps": [
    {
      "order": 1,
      "timeframe": "Days 1-7",
      "title": "Foundation: 100 Most Common Words",
      "description": "Learn the 100 most frequently used English words",
      "method": "Use Anki flashcards. Add 15 words daily. Review 20 min each morning.",
      "avoid": "Don't learn more than 15 new words per day - retention drops sharply.",
      "doneWhen": "Recognize and use all 100 words in sentences without hints.",
      "duration": 7
    }
  ],
  "pitfalls": [
    "Cramming too many words at once - leads to poor retention",
    "Skipping daily reviews - spaced repetition requires consistency"
  ],
  "successLooksLike": "Read English articles understanding 95% of vocabulary."
}

=== TONE ===

- Professional, authoritative - like a senior professor's study plan
- Direct statements, NOT questions ("Do X" not "Have you considered X?")
- Specific timeframes ("Days 1-3" not "start by...")
- Include WHAT TO AVOID at each step - this is crucial
- No emojis, no fluff, no excessive encouragement
- Mature, calm, premium feel

The user should read this and know EXACTLY what to do next.`

    responseFormat = `{
  "title": "Specific Goal Statement",
  "overview": "1-2 sentence approach and outcome summary",
  "steps": [
    {
      "order": 1,
      "timeframe": "Days 1-3",
      "title": "Action-oriented step title",
      "description": "Exact what to do",
      "method": "Specific how to do it",
      "avoid": "Common mistake NOT to make",
      "doneWhen": "Clear success criterion",
      "duration": 5
    }
  ],
  "pitfalls": ["Specific thing to avoid 1", "Specific thing to avoid 2"],
  "successLooksLike": "What completion looks like",
  "totalMinutes": 30,
  "acknowledgment": null,
  "nextSuggestion": "What to do after completing this roadmap"
}`
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Fast, smart, cost-effective model
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Student's question: "${processedQuestion}"\n\nRespond in this exact JSON format:\n${responseFormat}` },
      ],
      temperature: 0.7,
      max_tokens: maxTokens, // Adaptive based on input size (600-1000)
      response_format: { type: 'json_object' },
    })

    const responseText = completion.choices[0]?.message?.content || ''
    const parsed = JSON.parse(responseText)

    // Transform and validate the response
    if (actionType === 'explanation') {
      // Build the new Learning Pack structure
      const result: ExplanationAction = {
        type: 'explanation',
        title: parsed.title || `Understanding: ${question.slice(0, 50)}`,
        core: {
          idea: parsed.core?.idea || parsed.points?.[0] || 'Understanding this concept',
          keyPoints: (parsed.core?.keyPoints || parsed.points || []).slice(0, 4).filter((p: string) => p && p.length > 0),
        },
        acknowledgment: parsed.acknowledgment && parsed.acknowledgment !== 'null' ? parsed.acknowledgment : undefined,
        nextSuggestion: parsed.nextSuggestion || "Want to try an example together?",
      }

      // Add optional sections if provided
      if (parsed.steps && Array.isArray(parsed.steps) && parsed.steps.length > 0) {
        result.steps = parsed.steps.slice(0, 4).map((s: { step?: string; why?: string }) => ({
          step: s.step || '',
          why: s.why || '',
        })).filter((s: { step: string; why: string }) => s.step.length > 0)
      }

      if (parsed.example && parsed.example.problem && parsed.example.solution) {
        result.example = {
          problem: parsed.example.problem,
          solution: parsed.example.solution,
        }
      }

      if (parsed.checkQuestion && parsed.checkQuestion.question) {
        result.checkQuestion = {
          question: parsed.checkQuestion.question,
          hint: parsed.checkQuestion.hint || 'Think about the key concepts we covered.',
        }
      }

      // Legacy backwards compatibility
      result.points = result.core.keyPoints
      if (parsed.followUp) result.followUp = parsed.followUp

      return result
    } else if (actionType === 'flashcards') {
      return {
        type: 'flashcards',
        cards: (parsed.cards || []).slice(0, 3).map((card: { question?: string; answer?: string; hint?: string }) => ({
          id: uuidv4(),
          question: card.question || 'Question',
          answer: card.answer || 'Answer',
          hint: card.hint,
        })),
        acknowledgment: parsed.acknowledgment && parsed.acknowledgment !== 'null' ? parsed.acknowledgment : undefined,
        nextSuggestion: parsed.nextSuggestion || "Ready to go through these?",
      }
    } else {
      // roadmap - professional, system-controlled output
      // New format includes: timeframe, method, avoid, doneWhen, pitfalls
      interface RoadmapStepInput {
        order?: number
        duration?: number
        timeframe?: string
        title?: string
        description?: string
        method?: string
        avoid?: string
        doneWhen?: string
        hints?: string[]
      }

      const steps = (parsed.steps || []).slice(0, 5).map((step: RoadmapStepInput, index: number) => ({
        id: uuidv4(),
        order: step.order || index + 1,
        duration: Math.min(Math.max(step.duration || 5, 2), 15),
        timeframe: step.timeframe || `Step ${index + 1}`,
        title: step.title || `Step ${index + 1}`,
        description: step.description || '',
        method: step.method || '',
        avoid: step.avoid || '',
        doneWhen: step.doneWhen || '',
        // Keep hints for backwards compatibility, but prefer new format
        hints: step.hints || (step.avoid ? [`Avoid: ${step.avoid}`] : []),
      }))

      return {
        type: 'roadmap',
        title: parsed.title || `Plan: ${question.slice(0, 40)}`,
        overview: parsed.overview || '',
        encouragement: parsed.encouragement || parsed.overview || '',
        steps: steps.length > 0 ? steps : createFallbackSteps(),
        pitfalls: Array.isArray(parsed.pitfalls) ? parsed.pitfalls : [],
        successLooksLike: parsed.successLooksLike || '',
        totalMinutes: steps.reduce((sum: number, s: { duration: number }) => sum + s.duration, 0),
        acknowledgment: parsed.acknowledgment && parsed.acknowledgment !== 'null' ? parsed.acknowledgment : undefined,
        nextSuggestion: parsed.nextSuggestion || "Complete these steps, then let me know how it went.",
      }
    }
  } catch (error) {
    logger.error('[Guide Me] AI generation error', error instanceof Error ? error : { error })

    // Return appropriate fallback
    if (actionType === 'flashcards') {
      return createFallbackFlashcards(question)
    } else if (actionType === 'roadmap') {
      return createFallbackRoadmap(question)
    } else {
      return createFallbackExplanation(question)
    }
  }
}

/**
 * Award XP and update streak
 * FIX: Uses atomic transaction to prevent race conditions on concurrent requests
 */
async function awardXPAndUpdateStreak(userId: string): Promise<{ xpEarned: number; streakUpdated: boolean }> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  try {
    // FIX: Use transaction with isolation to ensure atomic read-modify-write
    const result = await prisma.$transaction(async (tx) => {
      // Read current state within transaction
      const profile = await tx.profile.findUnique({
        where: { userId },
        select: {
          totalPoints: true,
          quickFocusStreak: true,
          lastQuickFocusDate: true,
        },
      })

      if (!profile) {
        return { xpEarned: 0, streakUpdated: false }
      }

      const lastDate = profile.lastQuickFocusDate ? new Date(profile.lastQuickFocusDate) : null
      lastDate?.setHours(0, 0, 0, 0)

      let newStreak = profile.quickFocusStreak || 0
      let streakUpdated = false

      // Check if we should update the streak
      if (!lastDate || lastDate.getTime() < today.getTime()) {
        // Check if it's consecutive (yesterday or first time)
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)

        if (!lastDate || lastDate.getTime() === yesterday.getTime()) {
          // Consecutive day or first time
          newStreak += 1
          streakUpdated = true
        } else if (lastDate.getTime() < yesterday.getTime()) {
          // Streak broken, reset to 1
          newStreak = 1
          streakUpdated = true
        }
      }

      // Update profile atomically within the same transaction
      await tx.profile.update({
        where: { userId },
        data: {
          totalPoints: { increment: XP_PER_ACTION },
          quickFocusStreak: newStreak,
          lastQuickFocusDate: today,
        },
      })

      return { xpEarned: XP_PER_ACTION, streakUpdated }
    }, {
      // FIX: Use serializable isolation for streak updates to prevent race conditions
      isolationLevel: 'Serializable',
    })

    return result
  } catch (error) {
    // Log error but don't fail the request - XP award is not critical
    logger.error('[Guide Me] XP/Streak update error', error instanceof Error ? error : { error })
    return { xpEarned: 0, streakUpdated: false }
  }
}

/**
 * Get encouragement message based on action type
 */
function getEncouragement(actionType: MicroAction['type']): string {
  const messages = {
    explanation: [
      "Nice! Understanding is the first step to mastery.",
      "Great question! Keep that curiosity going.",
      "You're building a solid foundation!",
    ],
    flashcards: [
      "Practice makes progress!",
      "You're preparing smart!",
      "Keep reviewing - you've got this!",
    ],
    roadmap: [
      "One step at a time - you're on your way!",
      "Great plan! Now let's do it.",
      "Breaking it down is the smart approach!",
    ],
  }

  const typeMessages = messages[actionType]
  return typeMessages[Math.floor(Math.random() * typeMessages.length)]
}

// Fallback creators
function createFallbackExplanation(question?: string): ExplanationAction {
  return {
    type: 'explanation',
    title: question ? `Understanding: ${question.slice(0, 50)}` : 'Quick Explanation',
    core: {
      idea: 'Breaking down complex concepts into understandable pieces helps build real understanding.',
      keyPoints: [
        'Start by identifying the key terms and what they mean',
        'Look for patterns or relationships between concepts',
        'Try to explain it in your own words - this tests your understanding',
        'If stuck, break the problem into smaller parts',
      ],
    },
    steps: [
      { step: 'Identify key terms', why: 'Understanding vocabulary is the foundation' },
      { step: 'Look for patterns', why: 'Patterns reveal deeper structure' },
      { step: 'Explain in your own words', why: 'Teaching tests true understanding' },
    ],
    checkQuestion: {
      question: 'What part of this still feels unclear?',
      hint: 'Focus on the part that makes you hesitate the most.',
    },
    points: [
      'Start by identifying the key terms and what they mean',
      'Look for patterns or relationships between concepts',
      'Try to explain it in your own words - this tests your understanding',
      'If stuck, break the problem into smaller parts',
    ],
    followUp: 'What part of this still feels unclear?',
    nextSuggestion: 'Want to try working through an example together?',
  }
}

function createFallbackFlashcards(question?: string): FlashcardAction {
  return {
    type: 'flashcards',
    cards: [
      {
        id: uuidv4(),
        question: question ? `What is the main concept behind ${question.slice(0, 30)}?` : 'What is the key concept here?',
        answer: 'Think about the core idea and how it connects to what you already know.',
        hint: 'Focus on the fundamentals first.',
      },
      {
        id: uuidv4(),
        question: 'How would you explain this to someone who has never seen it?',
        answer: 'Use simple language and real-world examples.',
        hint: 'Teaching others is the best way to learn.',
      },
    ],
  }
}

function createFallbackRoadmap(question?: string): RoadmapAction {
  return {
    type: 'roadmap',
    title: question ? `Study Plan: ${question.slice(0, 40)}` : 'Quick Study Plan',
    overview: 'A structured approach to master this topic step by step.',
    encouragement: 'Follow these steps in order for best results.',
    steps: createFallbackSteps(),
    pitfalls: [
      'Skipping steps - each builds on the previous',
      'Moving on before understanding - take your time',
    ],
    successLooksLike: 'You can explain the concept and apply it independently.',
    totalMinutes: 15,
    nextSuggestion: 'Complete these steps, then let me know how it went.',
  }
}

function createFallbackSteps() {
  return [
    {
      id: uuidv4(),
      order: 1,
      duration: 5,
      timeframe: 'First 5 minutes',
      title: 'Identify What You Need to Learn',
      description: 'Write down exactly what confuses you in 1-2 sentences',
      method: 'Take out paper or open a notes app. Write "I am confused about..." and complete the sentence.',
      avoid: 'Being vague. "I don\'t get it" is not specific enough.',
      doneWhen: 'You have written a specific confusion point you can point to.',
      hints: ['Be specific about where you get lost'],
    },
    {
      id: uuidv4(),
      order: 2,
      duration: 5,
      timeframe: 'Minutes 5-10',
      title: 'Study One Worked Example',
      description: 'Find and trace through one complete example',
      method: 'Look in your textbook, notes, or reliable online source. Follow each step and ask "why" at each point.',
      avoid: 'Skimming. Actually trace through every step.',
      doneWhen: 'You can explain why each step in the example was done.',
      hints: ['Cover the solution and predict before revealing'],
    },
    {
      id: uuidv4(),
      order: 3,
      duration: 5,
      timeframe: 'Minutes 10-15',
      title: 'Apply It Yourself',
      description: 'Attempt a similar problem without looking at the example',
      method: 'Find a practice problem. Work through it step by step. Only check your work after completing.',
      avoid: 'Looking at the solution too early. Struggle is part of learning.',
      doneWhen: 'You solved a problem independently, even if it took multiple attempts.',
      hints: ['If stuck, go back to the example - which step matches?'],
    },
  ]
}

/**
 * Track user behavior to make AI smarter over time
 * Stores what topics users ask about, their struggle patterns, and preferences
 */
async function trackUserBehavior(
  userId: string,
  question: string,
  struggleType: StruggleType,
  actionType: MicroAction['type'],
  subject?: string
): Promise<void> {
  try {
    // Extract topic from question for memory
    const topic = extractTopic(question, subject)

    // Get or create user memory
    const userMemory = await getOrCreateUserMemory(userId)
    if (!userMemory) return

    // Track the topic they're struggling with
    if (topic && struggleType === 'dont_understand') {
      // Add to struggling topics if they don't understand
      await addToUserMemoryArray(userId, 'strugglingTopics', topic)
    }

    // Track subject as current subject they're studying
    if (subject) {
      await addToUserMemoryArray(userId, 'currentSubjects', subject)
    }

    // Infer learning style based on action preferences
    // If user consistently chooses certain action types, update their preferred style
    const actionStyleMap: Record<string, string> = {
      'explanation': 'conceptual - prefers understanding concepts first',
      'flashcards': 'repetition-based - learns through practice and review',
      'roadmap': 'step-by-step - prefers structured approaches',
    }

    // Track action preference in pending questions for pattern detection
    const actionNote = `prefers:${actionType}`
    if (!userMemory.pendingQuestions.includes(actionNote)) {
      await addToUserMemoryArray(userId, 'pendingQuestions', actionNote)
    }

    // Check pending questions for action preferences and infer learning style
    const actionPreferences = userMemory.pendingQuestions.filter(q => q.startsWith('prefers:'))
    if (actionPreferences.length >= 3) {
      const actionCounts: Record<string, number> = {}
      actionPreferences.forEach(pref => {
        const type = pref.replace('prefers:', '')
        actionCounts[type] = (actionCounts[type] || 0) + 1
      })

      const mostCommon = Object.entries(actionCounts)
        .sort((a, b) => b[1] - a[1])[0]

      if (mostCommon && mostCommon[1] >= 2) {
        const inferredStyle = actionStyleMap[mostCommon[0]]
        if (inferredStyle && inferredStyle !== userMemory.preferredLearningStyle) {
          await updateUserMemoryField(userId, 'preferredLearningStyle', inferredStyle)
        }
      }
    }

    // Save memories for AI context using proper ExtractedMemory format
    const sessionId = `guide-me-${Date.now()}` // Generate a session ID for tracking
    const memories: ExtractedMemory[] = []

    if (topic) {
      memories.push({
        category: 'ACADEMIC',
        content: `Asked about: ${topic}`,
        importance: 5,
        context: subject ? `While studying ${subject}` : undefined,
      })
    }

    if (struggleType === 'dont_understand') {
      memories.push({
        category: 'STRUGGLE',
        content: `Had difficulty understanding ${topic || question.slice(0, 50)}`,
        importance: 7,
        context: subject ? `In ${subject}` : undefined,
      })
    }

    if (struggleType === 'test_coming') {
      memories.push({
        category: 'ACADEMIC',
        content: `Preparing for test on ${topic || subject || question.slice(0, 50)}`,
        importance: 8,
        context: 'Upcoming test preparation',
      })
    }

    if (memories.length > 0) {
      await saveMemories({
        userId,
        sessionId,
        memories,
      })
    }

  } catch (error) {
    // Log but don't throw - tracking should never block the main flow
    console.warn('[Guide Me API] trackUserBehavior error:', error)
  }
}

/**
 * Extract the main topic from a question
 */
function extractTopic(question: string, _subject?: string): string | null {
  const q = question.toLowerCase().trim()

  // Common patterns to extract topics
  const patterns = [
    /what is (?:a |an |the )?(.+?)[\?\.]?$/i,
    /how (?:do|does|to) (.+?)[\?\.]?$/i,
    /explain (.+?)[\?\.]?$/i,
    /understand (.+?)[\?\.]?$/i,
    /help (?:me )?(?:with )?(.+?)[\?\.]?$/i,
    /stuck on (.+?)[\?\.]?$/i,
    /learn(?:ing)? (.+?)[\?\.]?$/i,
  ]

  for (const pattern of patterns) {
    const match = q.match(pattern)
    if (match && match[1]) {
      // Clean up the topic
      let topic = match[1].trim()
      // Limit length
      if (topic.length > 50) {
        topic = topic.slice(0, 50)
      }
      return topic
    }
  }

  // If no pattern matches, use first few words as topic (if short enough)
  if (q.length <= 50) {
    return q
  }

  // Extract first meaningful phrase
  const words = q.split(' ').slice(0, 6)
  return words.join(' ')
}
