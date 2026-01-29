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
import {
  getPlatformsForSubject,
  getPlatformSearchUrl,
  detectCategory,
  type Platform,
} from '@/lib/platforms/platform-database'
import { runPipeline, type PipelineOutput } from '@/lib/roadmap-engine/pipeline'
import { getDomainContext } from '@/lib/roadmap-engine/domains'

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

// Resource suggestion for a step
interface StepResourceSuggestion {
  type: 'video' | 'article' | 'exercise' | 'tool' | 'book'
  title: string
  description?: string
  url?: string
  searchQuery?: string // What to search for
}

// Recommended platform for the roadmap
interface RecommendedPlatform {
  id: string
  name: string
  description: string
  url: string
  icon: string
  color: string
  searchUrl?: string // Direct search URL for this topic
}

// Enhanced resource with platform info from pipeline
interface EnhancedResource {
  type: string
  title: string
  searchQuery?: string
  platformId?: string
  platformName?: string
  directUrl?: string
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
    resources?: StepResourceSuggestion[] | EnhancedResource[] // Suggested resources
    isLocked?: boolean
    // Professor-level fields
    phase?: 'NOW' | 'NEXT' | 'LATER'
    whyFirst?: string
    whyAfterPrevious?: string
    timeBreakdown?: { daily: string; total: string; flexible: string }
    commonMistakes?: string[]
    selfTest?: { challenge: string; passCriteria: string }
    abilities?: string[]
    previewAbilities?: string[]
    milestone?: string
    risk?: { warning: string; consequence: string; severity: string }
    microTasks?: { id?: string; order: number; title: string; description: string; taskType: string; duration: number; verificationMethod?: string; proofRequired?: boolean }[]
  }[]
  pitfalls?: string[] // Overall things to avoid
  successLooksLike?: string // What completion looks like
  totalMinutes: number
  recommendedPlatforms?: RecommendedPlatform[] // Top 2-3 platforms for this learning goal
  acknowledgment?: string // Natural recognition of their effort (only when earned)
  nextSuggestion?: string // Automatic "what's next" in tutor voice
  // Professor-level roadmap fields
  estimatedDays?: number // Total estimated days to complete
  dailyCommitment?: string // e.g., "30-45 minutes"
  totalSteps?: number // Total number of steps
  vision?: string // WHY this journey matters
  targetUser?: string // Who this roadmap is for
  successMetrics?: string[] // Measurable KPIs
  outOfScope?: string[] // What NOT to focus on yet
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

    // Smart Goal Detection: For roadmaps, check if goal is too vague
    // If vague, return clarifying questions instead of generating
    if (determinedActionType === 'roadmap') {
      const domainInfo = getDomainContext(question)

      // If goal is vague and has clarifying questions, return them
      if (domainInfo.isVague && domainInfo.clarifyingQuestions.length > 0) {
        log.info('Goal is vague, returning clarifying questions', {
          domain: domainInfo.domain,
          questionCount: domainInfo.clarifyingQuestions.length,
        })

        return NextResponse.json({
          success: true,
          needsClarification: true,
          clarifyingQuestions: domainInfo.clarifyingQuestions,
          domain: domainInfo.domain,
          subdomain: domainInfo.subdomain,
          message: 'To create the best roadmap for you, I need a bit more context.',
          xpEarned: 0,
          streakUpdated: false,
          encouragement: 'Let me understand your goal better.',
        }, {
          headers: {
            'x-correlation-id': correlationId,
          },
        })
      }

      // ============================================
      // ROADMAP-SPECIFIC RATE LIMITING
      // Roadmaps are expensive (3 API calls each), so we need stricter limits
      // This is IN ADDITION to the general AI rate limit above
      // ============================================
      if (!isGuest && user) {
        // Check hourly limit (10 roadmaps/hour)
        const roadmapRateLimit = await rateLimit(request, RateLimitPresets.roadmap)
        if (!roadmapRateLimit.success) {
          log.warn('Roadmap hourly rate limit exceeded', { userId: user.id })
          return NextResponse.json(
            {
              error: 'You\'ve generated too many roadmaps this hour. Please wait before creating more.',
              retryAfter: roadmapRateLimit.headers['Retry-After'],
            },
            { status: 429, headers: roadmapRateLimit.headers }
          )
        }

        // Check burst limit (3 roadmaps/5 minutes)
        const burstRateLimit = await rateLimit(request, RateLimitPresets.roadmapBurst)
        if (!burstRateLimit.success) {
          log.warn('Roadmap burst rate limit exceeded', { userId: user.id })
          return NextResponse.json(
            {
              error: 'Please slow down. Wait a few minutes before generating another roadmap.',
              retryAfter: burstRateLimit.headers['Retry-After'],
            },
            { status: 429, headers: burstRateLimit.headers }
          )
        }
      }
    }

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
      encouragement: 'Request processing failed.',
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
 *
 * ROADMAP PIPELINE: Uses multi-phase AI pipeline for roadmaps (3 API calls)
 * for professor-level quality instead of single monolithic prompt.
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
  // ============================================
  // ROADMAP: Use multi-phase pipeline
  // ============================================
  if (actionType === 'roadmap') {
    return generateRoadmapWithPipeline(question, subject, userContext, memoryContext)
  }

  // ============================================
  // EXPLANATION & FLASHCARDS: Use original single-prompt approach
  // ============================================

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
  }
  // Note: Roadmap is handled via early return at the top of this function using the pipeline

  try {
    // Optimize token usage for different action types
    // Note: Roadmaps now use the pipeline and don't reach this code
    const optimizedTokens = maxTokens
    const optimizedTemp = 0.7

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Fast, smart, cost-effective model
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Goal: "${processedQuestion}"\n\nJSON format:\n${responseFormat}` },
      ],
      temperature: optimizedTemp,
      max_tokens: optimizedTokens,
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
      // roadmap - GPS-STYLE output with currentStep + lockedSteps
      // New format: Only current step has full detail, locked steps have titles only

      // Resource type definition
      interface ParsedResource {
        type?: string
        title?: string
        description?: string
        url?: string
        searchQuery?: string
      }

      // Enhanced step interface with professor-level quality improvements
      interface EnhancedStep {
        id: string
        order: number
        duration: number
        timeframe: string
        title: string
        description: string
        method: string
        avoid: string
        doneWhen: string
        hints: string[]
        isLocked: boolean
        resources?: Array<{ type: string; title: string; description?: string; url?: string; searchQuery?: string; platformId?: string; platformName?: string; directUrl?: string; priority?: number }>
        risk?: { warning: string; consequence: string; severity: string }
        // Enhanced fields for professor-level quality
        phase?: 'NOW' | 'NEXT' | 'LATER'
        whyFirst?: string
        timeBreakdown?: { daily: string; total: string; flexible: string }
        commonMistakes?: string[]
        selfTest?: { challenge: string; passCriteria: string }
        abilities?: string[]
        milestone?: string
        whyAfterPrevious?: string
        previewAbilities?: string[]
      }

      const steps: EnhancedStep[] = []

      // Import smart resources for direct platform links
      const { createSmartResource } = await import('@/lib/roadmap-engine/smart-resources')
      const detectedSubject = subject || detectCategory(question) || question

      // Add current step (full detail with enhanced fields)
      if (parsed.currentStep) {
        const cs = parsed.currentStep

        // Transform resources to smart resources with direct platform links
        const smartResources = cs.resources?.map((r: ParsedResource) => {
          const smart = createSmartResource({
            type: r.type || 'article',
            title: r.title || 'Resource',
            description: r.description,
            searchQuery: r.searchQuery,
          }, detectedSubject)
          return {
            type: smart.type,
            title: smart.title,
            description: smart.description,
            searchQuery: smart.searchQuery,
            platformId: smart.platformId,
            platformName: smart.platformName,
            directUrl: smart.directUrl,
          }
        })

        steps.push({
          id: uuidv4(),
          order: cs.order || 1,
          duration: cs.duration || 15,
          timeframe: cs.timeframe || 'Start now',
          title: cs.title || 'Current Step',
          description: cs.description || '',
          method: cs.method || '',
          avoid: cs.risk?.warning || '',
          doneWhen: cs.doneWhen || '',
          hints: cs.risk ? [`RISK: ${cs.risk.warning}`, `Consequence: ${cs.risk.consequence}`] : [],
          isLocked: false,
          resources: smartResources,
          risk: cs.risk,
          // Professor-level enhanced fields
          phase: cs.phase || 'NOW',
          whyFirst: cs.whyFirst,
          timeBreakdown: cs.timeBreakdown,
          commonMistakes: cs.commonMistakes,
          selfTest: cs.selfTest,
          abilities: cs.abilities,
          milestone: cs.milestone,
        })
      }

      // Add locked steps with preview info
      if (parsed.lockedSteps && Array.isArray(parsed.lockedSteps)) {
        parsed.lockedSteps.forEach((ls: {
          order?: number
          title?: string
          phase?: 'NOW' | 'NEXT' | 'LATER'
          milestone?: string
          resources?: ParsedResource[]
          whyAfterPrevious?: string
          previewAbilities?: string[]
        }, index: number) => {
          // Transform resources to smart resources
          const smartResources = ls.resources?.map((r: ParsedResource) => {
            const smart = createSmartResource({
              type: r.type || 'article',
              title: r.title || 'Resource',
              description: r.description,
              searchQuery: r.searchQuery,
            }, detectedSubject)
            return {
              type: smart.type,
              title: smart.title,
              description: smart.description,
              searchQuery: smart.searchQuery,
              platformId: smart.platformId,
              platformName: smart.platformName,
              directUrl: smart.directUrl,
            }
          })

          steps.push({
            id: uuidv4(),
            order: ls.order || index + 2,
            duration: 0, // Unknown - locked
            timeframe: 'Locked',
            title: ls.title || `Step ${index + 2}`,
            description: 'Complete previous step to unlock',
            method: '',
            avoid: '',
            doneWhen: '',
            hints: [],
            isLocked: true,
            resources: smartResources,
            // Professor-level preview info for locked steps
            phase: ls.phase || (index === 0 ? 'NEXT' : 'LATER'),
            milestone: ls.milestone,
            whyAfterPrevious: ls.whyAfterPrevious,
            previewAbilities: ls.previewAbilities,
          })
        })
      }

      // Build pitfalls from criticalWarning
      const pitfalls: string[] = []
      if (parsed.criticalWarning?.warning) {
        pitfalls.push(`RISK: ${parsed.criticalWarning.warning} - ${parsed.criticalWarning.consequence}`)
      }

      // Get recommended platforms based on the goal/subject (reuse detectedSubject from above)
      const platforms = getPlatformsForSubject(detectedSubject, 3)
      const recommendedPlatforms: RecommendedPlatform[] = platforms.map((p: Platform) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        url: p.url,
        icon: p.icon,
        color: p.color,
        searchUrl: p.searchUrl ? getPlatformSearchUrl(p, question.slice(0, 50)) : undefined,
      }))

      return {
        type: 'roadmap',
        title: parsed.title || `Plan: ${question.slice(0, 40)}`,
        overview: parsed.overview || '',
        encouragement: parsed.overview || '',
        steps: steps.length > 0 ? steps : createFallbackSteps(),
        pitfalls,
        successLooksLike: parsed.successLooksLike || '',
        totalMinutes: parsed.totalMinutes || parsed.currentStep?.duration * (parsed.totalSteps || 3) || 60,
        recommendedPlatforms: recommendedPlatforms.length > 0 ? recommendedPlatforms : undefined,
        acknowledgment: undefined, // GPS style doesn't use acknowledgment
        nextSuggestion: "Focus on the current step. Complete it before moving on.",
        // Professor-level roadmap fields
        estimatedDays: parsed.estimatedDays,
        dailyCommitment: parsed.dailyCommitment,
        totalSteps: parsed.totalSteps || steps.length,
        // NEW: Vision and strategic fields
        vision: parsed.vision,
        targetUser: parsed.targetUser,
        successMetrics: parsed.successMetrics,
        outOfScope: parsed.outOfScope,
      }
    }
  } catch (error) {
    logger.error('[Guide Me] AI generation error', error instanceof Error ? error : { error })

    // Return appropriate fallback
    // Note: Roadmaps are handled via early return and use their own fallback in the pipeline
    if (actionType === 'flashcards') {
      return createFallbackFlashcards(question)
    } else {
      return createFallbackExplanation(question)
    }
  }
}

/**
 * Generate roadmap using multi-phase AI pipeline
 *
 * Uses 3 API calls with specialized prompts:
 * 1. Diagnostic: Understand goal and knowledge gaps
 * 2. Strategy: Design transformation and assess risks
 * 3. Execution: Create detailed steps with GPS-style navigation
 *
 * This produces professor-level quality roadmaps instead of generic ones.
 */
async function generateRoadmapWithPipeline(
  question: string,
  subject: string | undefined,
  userContext: string,
  memoryContext: string
): Promise<RoadmapAction> {
  try {
    logger.info('[Guide Me] Using multi-phase pipeline for roadmap', { goal: question.slice(0, 50) })

    // Run the multi-phase pipeline
    const pipelineOutput = await runPipeline({
      goal: question,
      subject,
      userContext,
      memoryContext,
    })

    // Transform pipeline output to RoadmapAction format
    return transformPipelineToRoadmapAction(pipelineOutput, question)
  } catch (error) {
    logger.error('[Guide Me] Pipeline failed, falling back to legacy', error instanceof Error ? error : { error })
    // If pipeline fails, fall back to the default roadmap generator
    return createFallbackRoadmap(question)
  }
}

/**
 * Transform pipeline output to RoadmapAction format for API response
 */
function transformPipelineToRoadmapAction(output: PipelineOutput, question: string): RoadmapAction {
  // Build steps array combining current and locked steps
  const steps = [
    // Current step (fully detailed)
    {
      id: output.currentStep.id,
      order: output.currentStep.order,
      duration: output.currentStep.duration,
      timeframe: output.currentStep.timeframe,
      title: output.currentStep.title,
      description: output.currentStep.description,
      method: output.currentStep.method,
      avoid: output.currentStep.risk?.warning || '',
      doneWhen: output.currentStep.doneWhen,
      hints: output.currentStep.commonMistakes || [],
      isLocked: false,
      resources: output.currentStep.resources,
      risk: output.currentStep.risk,
      // Professor-level enhanced fields
      phase: output.currentStep.phase,
      whyFirst: output.currentStep.whyFirst,
      timeBreakdown: output.currentStep.timeBreakdown,
      commonMistakes: output.currentStep.commonMistakes,
      selfTest: output.currentStep.selfTest,
      abilities: output.currentStep.abilities,
      milestone: output.currentStep.milestone,
      // Micro-tasks for task-based progression
      microTasks: output.currentStep.microTasks,
    },
    // Locked steps (previews only)
    ...output.lockedSteps.map(ls => ({
      id: ls.id,
      order: ls.order,
      duration: ls.estimatedDuration || 0,
      timeframe: 'Locked',
      title: ls.title,
      description: 'Complete previous step to unlock',
      method: '',
      avoid: '',
      doneWhen: '',
      hints: [] as string[],
      isLocked: true,
      resources: ls.resources,
      // Professor-level preview info
      phase: ls.phase,
      whyAfterPrevious: ls.whyAfterPrevious,
      previewAbilities: ls.previewAbilities,
      milestone: ls.milestone,
    })),
  ]

  return {
    type: 'roadmap',
    title: output.title,
    overview: output.overview,
    encouragement: output.vision,
    steps,
    pitfalls: output.pitfalls,
    successLooksLike: output.successLooksLike,
    totalMinutes: output.totalMinutes,
    recommendedPlatforms: output.recommendedPlatforms,
    acknowledgment: undefined,
    nextSuggestion: 'Focus on the current step. Complete it before moving on.',
    // Professor-level roadmap fields
    estimatedDays: output.estimatedDays,
    dailyCommitment: output.dailyCommitment,
    totalSteps: output.totalSteps,
    // Vision and strategic fields
    vision: output.vision,
    targetUser: output.targetUser,
    successMetrics: output.successMetrics,
    outOfScope: output.outOfScope,
  }
}

/**
 * Award XP and update streak
 * FIX: Uses atomic transaction to prevent race conditions on concurrent requests
 * NOTE: Profile.totalPoints update is kept in transaction for atomicity with streak,
 *       but we also log to GamificationEvent and DailyProgress for audit trail
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

      return { xpEarned: XP_PER_ACTION, streakUpdated, newStreak }
    }, {
      // FIX: Use serializable isolation for streak updates to prevent race conditions
      isolationLevel: 'Serializable',
    })

    // Log XP to GamificationEvent and DailyProgress (non-blocking, for audit trail)
    if (result.xpEarned > 0) {
      Promise.all([
        // Log to DailyProgress
        prisma.dailyProgress.upsert({
          where: { userId_date: { userId, date: today } },
          update: { xpEarned: { increment: result.xpEarned } },
          create: {
            userId,
            date: today,
            xpEarned: result.xpEarned,
            targetMinutes: 15,
            actualMinutes: 0,
            stepsCompleted: 0,
          },
        }),
        // Log to GamificationEvent
        prisma.gamificationEvent.create({
          data: {
            userId,
            eventType: 'xp_earned',
            eventData: {
              source: 'other',
              action: 'guide_me_action',
              streakUpdated: result.streakUpdated,
            },
            xpEarned: result.xpEarned,
            wasVisible: true,
          },
        }),
      ]).catch(err => {
        logger.warn('[Guide Me] Failed to log XP event', { error: err })
      })
    }

    return { xpEarned: result.xpEarned, streakUpdated: result.streakUpdated }
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
      'Explanation generated.',
      'Concept breakdown ready.',
      'Analysis complete.',
    ],
    flashcards: [
      'Flashcards generated.',
      'Review cards ready.',
      'Practice set created.',
    ],
    roadmap: [
      'Roadmap generated.',
      'Study plan ready.',
      'Step-by-step plan created.',
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
