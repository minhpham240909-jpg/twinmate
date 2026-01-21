/**
 * AI Partner Intelligence System - Intent Classifier
 *
 * Two-tier intent classification:
 * 1. Fast path: Regex + keyword matching (no API call)
 * 2. Fallback path: AI-powered classification (cheap, fast model)
 */

import OpenAI from 'openai'
import type { UserIntent, IntentResult, ProcessedInput } from './types'
import { VALID_INTENTS } from './types'
import {
  INTENT_PATTERNS,
  extractTopic,
  matchesPattern,
  CONFUSION_PATTERNS,
  COMPLETION_PATTERNS,
  DISENGAGEMENT_PATTERNS,
} from './intent-patterns'
import { processInput, normalizeForMatching, isShortReply } from './input-processor'

// SCALE: OpenAI request timeout (30 seconds) for 2000-3000 concurrent users
const OPENAI_REQUEST_TIMEOUT = 30000

// OpenAI client for fallback classification with timeout
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: OPENAI_REQUEST_TIMEOUT,
  maxRetries: 2,
})

// Cache for recently classified intents (to avoid redundant calls)
const intentCache = new Map<string, { result: IntentResult; timestamp: number }>()
const CACHE_TTL_MS = 60000 // 1 minute cache

/**
 * Main intent classification function
 * Uses fast path first, falls back to AI if needed
 */
export async function classifyIntent(
  content: string,
  recentContext: string[] = [],
  options: { allowFallback?: boolean; timeout?: number } = {}
): Promise<IntentResult> {
  const startTime = Date.now()
  const { allowFallback = true, timeout = 2000 } = options

  // Check cache first
  const cacheKey = normalizeForMatching(content).substring(0, 100)
  const cached = intentCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return {
      ...cached.result,
      processingTimeMs: Date.now() - startTime,
    }
  }

  // Process input
  const processed = processInput(content)

  // Try fast path first
  const fastResult = classifyIntentFast(processed)

  if (fastResult && fastResult.confidence !== 'low') {
    const result = {
      ...fastResult,
      processingTimeMs: Date.now() - startTime,
    }
    intentCache.set(cacheKey, { result, timestamp: Date.now() })
    return result
  }

  // If fast path failed or low confidence, try fallback if allowed
  if (allowFallback) {
    try {
      const fallbackResult = await classifyIntentWithAI(processed, recentContext, timeout)
      const result = {
        ...fallbackResult,
        processingTimeMs: Date.now() - startTime,
      }
      intentCache.set(cacheKey, { result, timestamp: Date.now() })
      return result
    } catch (error) {
      console.error('[Intent Classifier] Fallback failed:', error)
      // Return best guess from fast path or UNCLEAR
      return {
        intent: fastResult?.intent || 'UNCLEAR',
        confidence: 'low',
        extracted: fastResult?.extracted || {},
        usedFallback: false,
        processingTimeMs: Date.now() - startTime,
      }
    }
  }

  // No fallback, return fast path result or UNCLEAR
  return {
    intent: fastResult?.intent || 'UNCLEAR',
    confidence: fastResult?.confidence || 'low',
    extracted: fastResult?.extracted || {},
    usedFallback: false,
    processingTimeMs: Date.now() - startTime,
  }
}

/**
 * Fast path classification using regex patterns
 */
function classifyIntentFast(processed: ProcessedInput): IntentResult | null {
  const content = processed.cleaned
  const normalized = normalizeForMatching(content)

  // Check for special patterns first (confusion, completion, disengagement)
  if (matchesPattern(normalized, CONFUSION_PATTERNS)) {
    return {
      intent: 'CONFUSED',
      confidence: 'high',
      extracted: { topic: processed.extracted.topics[0] },
      usedFallback: false,
    }
  }

  if (matchesPattern(normalized, COMPLETION_PATTERNS)) {
    return {
      intent: 'CASUAL_CHAT',
      confidence: 'high',
      extracted: {},
      usedFallback: false,
    }
  }

  if (matchesPattern(normalized, DISENGAGEMENT_PATTERNS)) {
    // Short acknowledgments - could be casual or follow-up
    if (isShortReply(content)) {
      return {
        intent: 'CASUAL_CHAT',
        confidence: 'medium',
        extracted: {},
        usedFallback: false,
      }
    }
  }

  // Check each intent pattern
  for (const [intentKey, patterns] of Object.entries(INTENT_PATTERNS)) {
    const intent = intentKey as UserIntent
    if (intent === 'UNCLEAR' || intent === 'OFF_TOPIC') continue // Skip these

    if (matchesPattern(normalized, patterns)) {
      const topic = extractTopic(content) || processed.extracted.topics[0]
      const question = processed.extracted.questions[0]
      const mathExpression = processed.extracted.mathExpressions[0]

      return {
        intent,
        confidence: 'high',
        extracted: {
          topic: topic || undefined,
          question: question || undefined,
          mathExpression: mathExpression || undefined,
        },
        usedFallback: false,
      }
    }
  }

  // Heuristic fallbacks for medium confidence

  // If it ends with a question mark, likely a question
  if (normalized.endsWith('?')) {
    // Short question -> follow-up
    if (processed.wordCount < 5) {
      return {
        intent: 'FOLLOW_UP',
        confidence: 'medium',
        extracted: {},
        usedFallback: false,
      }
    }
    // Longer question -> likely EXPLAIN
    return {
      intent: 'EXPLAIN',
      confidence: 'medium',
      extracted: {
        question: content,
        topic: processed.extracted.topics[0],
      },
      usedFallback: false,
    }
  }

  // If it has math expressions, likely SOLVE
  if (processed.extracted.mathExpressions.length > 0) {
    return {
      intent: 'SOLVE',
      confidence: 'medium',
      extracted: {
        mathExpression: processed.extracted.mathExpressions[0],
      },
      usedFallback: false,
    }
  }

  // Very short input (1-3 words)
  if (processed.wordCount <= 3) {
    // Could be acknowledgment or fragment
    return {
      intent: 'FOLLOW_UP',
      confidence: 'low',
      extracted: {},
      usedFallback: false,
    }
  }

  // Cannot determine with confidence
  return null
}

/**
 * Fallback classification using AI (cheap, fast model)
 */
async function classifyIntentWithAI(
  processed: ProcessedInput,
  recentContext: string[],
  timeout: number
): Promise<IntentResult> {
  const prompt = buildClassificationPrompt(processed, recentContext)

  // Create abort controller for timeout
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Cheap and fast
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 30,
      temperature: 0, // Deterministic
    }, {
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    const intentRaw = response.choices[0]?.message?.content?.trim().toUpperCase()

    // Parse the response
    let intent: UserIntent = 'UNCLEAR'
    let topic: string | undefined

    if (intentRaw) {
      // Check if response is just the intent
      if (VALID_INTENTS.includes(intentRaw as UserIntent)) {
        intent = intentRaw as UserIntent
      } else {
        // Try to extract intent from response
        for (const validIntent of VALID_INTENTS) {
          if (intentRaw.includes(validIntent)) {
            intent = validIntent
            break
          }
        }
      }
    }

    // Use extracted topic if available
    topic = processed.extracted.topics[0]

    return {
      intent,
      confidence: 'medium',
      extracted: {
        topic,
        question: processed.extracted.questions[0],
        mathExpression: processed.extracted.mathExpressions[0],
      },
      usedFallback: true,
    }
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}

/**
 * Build the classification prompt for AI fallback
 */
function buildClassificationPrompt(processed: ProcessedInput, recentContext: string[]): string {
  const contextStr = recentContext.length > 0
    ? `\nRecent conversation:\n${recentContext.slice(-3).map((m, i) => `${i + 1}. ${m.substring(0, 100)}`).join('\n')}`
    : ''

  return `Classify the student's intent. Return ONLY the intent label, nothing else.

INTENTS:
- EXPLAIN: Wants something explained or defined
- SOLVE: Wants a math problem or equation solved
- SUMMARIZE: Wants a summary of content
- COMPARE: Wants comparison between things
- QUIZ_ME: Wants to be quizzed or tested
- CHECK_ANSWER: Wants their answer verified
- CONFUSED: Expresses confusion, needs re-explanation
- FOLLOW_UP: Continuing the previous topic
- ELABORATE: Wants more details on current topic
- PRACTICE: Wants practice problems
- PLAN_STUDY: Wants help planning their study
- FLASHCARDS: Wants flashcards created
- GENERATE_IMAGE: Wants a diagram/image created
- CASUAL_CHAT: Greetings, thanks, or small talk
- UNCLEAR: Cannot determine
${contextStr}

Student message: "${processed.cleaned}"

Intent:`
}

/**
 * Detect user signals from a message
 * Used for adaptive behavior tracking
 */
export function detectUserSignals(content: string): {
  isShort: boolean
  isConfused: boolean
  isCompleted: boolean
  isQuestion: boolean
  isDisengaged: boolean
  isEngaged: boolean
} {
  const normalized = normalizeForMatching(content)
  const wordCount = content.split(/\s+/).filter(w => w.length > 0).length

  return {
    isShort: wordCount <= 3,
    isConfused: matchesPattern(normalized, CONFUSION_PATTERNS),
    isCompleted: matchesPattern(normalized, COMPLETION_PATTERNS),
    isQuestion: content.trim().endsWith('?'),
    isDisengaged: matchesPattern(normalized, DISENGAGEMENT_PATTERNS),
    isEngaged: wordCount > 10 || (wordCount > 5 && content.includes('?')),
  }
}

/**
 * Check if intent should trigger image generation
 */
export function isImageGenerationIntent(intent: UserIntent): boolean {
  return intent === 'GENERATE_IMAGE'
}

/**
 * Check if intent is study-related
 */
export function isStudyRelatedIntent(intent: UserIntent): boolean {
  const studyIntents: UserIntent[] = [
    'EXPLAIN', 'SOLVE', 'SUMMARIZE', 'COMPARE',
    'QUIZ_ME', 'CHECK_ANSWER', 'PRACTICE',
    'CONFUSED', 'FOLLOW_UP', 'ELABORATE',
    'FLASHCARDS', 'PLAN_STUDY', 'GENERATE_IMAGE',
  ]
  return studyIntents.includes(intent)
}

/**
 * Get a human-readable description of an intent
 */
export function getIntentDescription(intent: UserIntent): string {
  const descriptions: Record<UserIntent, string> = {
    EXPLAIN: 'asking for an explanation',
    SOLVE: 'requesting a problem solution',
    SUMMARIZE: 'requesting a summary',
    COMPARE: 'requesting a comparison',
    QUIZ_ME: 'wanting to be quizzed',
    CHECK_ANSWER: 'checking their answer',
    PRACTICE: 'wanting practice problems',
    CONFUSED: 'expressing confusion',
    FOLLOW_UP: 'following up on the topic',
    ELABORATE: 'asking for more details',
    GENERATE_IMAGE: 'requesting an image',
    FLASHCARDS: 'requesting flashcards',
    PLAN_STUDY: 'planning their study',
    CASUAL_CHAT: 'casual conversation',
    OFF_TOPIC: 'off-topic message',
    UNCLEAR: 'unclear intent',
  }
  return descriptions[intent] || 'unknown intent'
}

/**
 * Clear the intent cache (for testing or memory management)
 */
export function clearIntentCache(): void {
  intentCache.clear()
}
