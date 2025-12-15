/**
 * AI Partner Intelligence System - Decision Controller
 *
 * The brain of the intelligence system. Orchestrates all components
 * to make decisions about how the AI should respond.
 *
 * Performance optimized:
 * - Fast path for most cases (no API calls)
 * - Parallel processing where possible
 * - Efficient caching
 * - Guardrails to prevent overuse
 */

import type {
  AIDecision,
  AIAction,
  ResponseConfig,
  PromptInjections,
  PostActions,
  UserIntent,
  SessionContext,
  MemoryContext,
  AdaptiveState,
  SessionState,
} from './types'
import { DEFAULT_RESPONSE_CONFIG, DEFAULT_MEMORY_CONTEXT, INITIAL_ADAPTIVE_STATE } from './types'
import { processInput } from './input-processor'
import { classifyIntent, isImageGenerationIntent } from './intent-classifier'
import { buildResponseConfig, getStyleInstruction, getToneInstruction, getLengthInstruction } from './response-mapper'
import { AdaptiveTracker, determineSessionState } from './adaptive-tracker'
import { shouldUseFallback, enforceTokenLimit, enforceGuardrails } from './guardrails'

/**
 * Main decision function
 * Takes user input and context, returns a complete decision
 */
export async function makeDecision(
  input: string,
  sessionContext: SessionContext,
  memoryContext: MemoryContext = DEFAULT_MEMORY_CONTEXT,
  adaptiveState: AdaptiveState = INITIAL_ADAPTIVE_STATE
): Promise<AIDecision> {
  const startTime = Date.now()

  // Step 1: Process input (fast, no API call)
  const processed = processInput(input)

  // Step 2: Determine session state (fast, no API call)
  const sessionDurationMinutes = Math.floor(
    (Date.now() - sessionContext.startedAt.getTime()) / 60000
  )
  const sessionState = determineSessionState(adaptiveState, sessionDurationMinutes)

  // Step 3: Classify intent (may use API fallback if unclear)
  const allowFallback = shouldUseFallback(sessionContext)
  const intentResult = await classifyIntent(
    processed.cleaned,
    sessionContext.recentMessages.map(m => m.content),
    { allowFallback, timeout: 2000 }
  )

  // Track if we used fallback
  if (intentResult.usedFallback) {
    sessionContext.fallbackCallCount++
  }

  // Step 4: Handle special intents that don't need response config
  if (isImageGenerationIntent(intentResult.intent)) {
    return buildImageGenerationDecision(intentResult, startTime)
  }

  if (intentResult.intent === 'FLASHCARDS') {
    return buildFlashcardsDecision(intentResult, startTime)
  }

  if (intentResult.intent === 'QUIZ_ME') {
    return buildQuizDecision(intentResult, sessionContext, memoryContext, adaptiveState, sessionState, startTime)
  }

  // Step 5: Build response configuration
  let responseConfig = buildResponseConfig(
    intentResult.intent,
    adaptiveState,
    memoryContext,
    sessionState
  )

  // Step 6: Apply guardrails
  responseConfig = enforceTokenLimit(responseConfig, sessionContext)
  responseConfig = enforceGuardrails(responseConfig)

  // Step 7: Build prompt injections
  const promptInjections = buildPromptInjections(responseConfig, intentResult.intent, adaptiveState)

  // Step 8: Determine post-actions
  const postActions = buildPostActions(sessionContext, adaptiveState)

  return {
    action: 'respond',
    responseConfig,
    promptInjections,
    postActions,
    meta: {
      intent: intentResult.intent,
      confidence: intentResult.confidence,
      usedAIFallback: intentResult.usedFallback,
      processingTimeMs: Date.now() - startTime,
    },
  }
}

/**
 * Build decision for image generation
 */
function buildImageGenerationDecision(
  intentResult: { intent: UserIntent; confidence: 'high' | 'medium' | 'low'; usedFallback: boolean },
  startTime: number
): AIDecision {
  return {
    action: 'generate_image',
    responseConfig: DEFAULT_RESPONSE_CONFIG,
    promptInjections: {
      styleInstruction: '',
      toneInstruction: '',
      lengthInstruction: '',
      specialInstructions: [],
    },
    postActions: {
      extractMemories: false,
      updateSignals: true,
      checkForVisualOffer: false,
    },
    meta: {
      intent: intentResult.intent,
      confidence: intentResult.confidence,
      usedAIFallback: intentResult.usedFallback,
      processingTimeMs: Date.now() - startTime,
    },
  }
}

/**
 * Build decision for flashcards creation
 */
function buildFlashcardsDecision(
  intentResult: { intent: UserIntent; confidence: 'high' | 'medium' | 'low'; usedFallback: boolean },
  startTime: number
): AIDecision {
  return {
    action: 'create_flashcards',
    responseConfig: DEFAULT_RESPONSE_CONFIG,
    promptInjections: {
      styleInstruction: '',
      toneInstruction: '',
      lengthInstruction: '',
      specialInstructions: [],
    },
    postActions: {
      extractMemories: false,
      updateSignals: true,
      checkForVisualOffer: false,
    },
    meta: {
      intent: intentResult.intent,
      confidence: intentResult.confidence,
      usedAIFallback: intentResult.usedFallback,
      processingTimeMs: Date.now() - startTime,
    },
  }
}

/**
 * Build decision for quiz
 */
function buildQuizDecision(
  intentResult: { intent: UserIntent; confidence: 'high' | 'medium' | 'low'; usedFallback: boolean },
  sessionContext: SessionContext,
  memoryContext: MemoryContext,
  adaptiveState: AdaptiveState,
  sessionState: SessionState,
  startTime: number
): AIDecision {
  // For quiz, we still build response config but mark action as create_quiz
  const responseConfig = buildResponseConfig(
    intentResult.intent,
    adaptiveState,
    memoryContext,
    sessionState
  )

  return {
    action: 'create_quiz',
    responseConfig,
    promptInjections: {
      styleInstruction: 'Ask a clear, well-structured question.',
      toneInstruction: 'Be encouraging and supportive.',
      lengthInstruction: 'Keep the question concise but complete.',
      specialInstructions: ['Include 4 answer options (A, B, C, D)'],
    },
    postActions: {
      extractMemories: false,
      updateSignals: true,
      checkForVisualOffer: false,
    },
    meta: {
      intent: intentResult.intent,
      confidence: intentResult.confidence,
      usedAIFallback: intentResult.usedFallback,
      processingTimeMs: Date.now() - startTime,
    },
  }
}

/**
 * Build prompt injections based on response config and context
 */
function buildPromptInjections(
  config: ResponseConfig,
  intent: UserIntent,
  adaptiveState: AdaptiveState
): PromptInjections {
  const specialInstructions: string[] = []

  // Question instruction
  if (!config.includeQuestion) {
    specialInstructions.push('Do NOT end with a question. End your response naturally.')
  } else if (adaptiveState.engagementLevel === 'low') {
    specialInstructions.push('End with a gentle, re-engaging question to help the student.')
  }

  // Example instruction
  if (config.includeExample) {
    specialInstructions.push('Include a concrete, relatable example.')
  }

  // Visual offer instruction
  if (config.includeVisualOffer) {
    specialInstructions.push('If this topic would benefit from a visual diagram, briefly offer to generate one.')
  }

  // Intent-specific instructions
  switch (intent) {
    case 'CONFUSED':
      specialInstructions.push('The student is confused. Explain differently using simpler terms or a new approach.')
      break
    case 'CHECK_ANSWER':
      specialInstructions.push('First state if the answer is correct or incorrect, then explain why.')
      break
    case 'SOLVE':
      specialInstructions.push('Show the solution step by step. Explain each step briefly.')
      break
    case 'COMPARE':
      specialInstructions.push('Structure the comparison clearly, highlighting key differences and similarities.')
      break
    case 'CASUAL_CHAT':
      specialInstructions.push('Be friendly but gently redirect toward studying.')
      break
    case 'UNCLEAR':
      specialInstructions.push('The request is unclear. Politely ask for clarification.')
      break
  }

  // Engagement-based instructions
  if (adaptiveState.shortReplyCount >= 3) {
    specialInstructions.push('Keep your response shorter than usual - the student seems to prefer brief answers.')
  }

  if (adaptiveState.confusionCount >= 2) {
    specialInstructions.push('The student has expressed confusion multiple times. Be extra patient and clear.')
  }

  return {
    styleInstruction: getStyleInstruction(config.style),
    toneInstruction: getToneInstruction(config.tone),
    lengthInstruction: getLengthInstruction(config.length),
    specialInstructions,
  }
}

/**
 * Build post-response actions
 */
function buildPostActions(
  sessionContext: SessionContext,
  adaptiveState: AdaptiveState
): PostActions {
  return {
    // Extract memories every 5 messages
    extractMemories: sessionContext.messageCount > 0 && sessionContext.messageCount % 5 === 0,
    // Always update signals
    updateSignals: true,
    // Check for visual offer if topic is deep enough
    checkForVisualOffer: adaptiveState.topicDepth >= 2,
  }
}

/**
 * Quick decision for simple cases (no async, no API)
 * Use when you need a fast response and don't need full classification
 */
export function makeQuickDecision(
  input: string,
  sessionState: SessionState = 'WORKING'
): Partial<AIDecision> {
  const processed = processInput(input)

  // Simple heuristics for common cases
  if (processed.wordCount <= 3) {
    return {
      action: 'respond',
      responseConfig: {
        ...DEFAULT_RESPONSE_CONFIG,
        length: 'short',
        includeQuestion: true,
      },
    }
  }

  if (processed.extracted.mathExpressions.length > 0) {
    return {
      action: 'respond',
      responseConfig: {
        ...DEFAULT_RESPONSE_CONFIG,
        style: 'step_by_step',
        includeExample: false,
      },
    }
  }

  return {
    action: 'respond',
    responseConfig: DEFAULT_RESPONSE_CONFIG,
  }
}

/**
 * Update session context with decision metadata
 * Call this after making a decision to track usage
 */
export function updateSessionContext(
  context: SessionContext,
  decision: AIDecision
): SessionContext {
  return {
    ...context,
    fallbackCallCount: decision.meta.usedAIFallback
      ? context.fallbackCallCount + 1
      : context.fallbackCallCount,
    messageCount: context.messageCount + 1,
  }
}

/**
 * Create a decision-aware adaptive tracker
 * Combines tracker with decision context
 */
export function createDecisionTracker(
  existingState?: AdaptiveState
): AdaptiveTracker {
  return new AdaptiveTracker(existingState)
}
