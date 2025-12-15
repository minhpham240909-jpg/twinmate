/**
 * AI Partner Intelligence System - Type Definitions
 *
 * Core types for the intelligent response system that makes AI feel smart.
 * This module defines all interfaces and types used across the intelligence layer.
 */

// =============================================================================
// INTENT TYPES
// =============================================================================

/**
 * User intent categories
 * These represent what the user is trying to accomplish with their message
 */
export type UserIntent =
  // Learning intents
  | 'EXPLAIN'        // "What is photosynthesis?"
  | 'SOLVE'          // "Solve this equation: 2x + 5 = 15"
  | 'SUMMARIZE'      // "Summarize chapter 3"
  | 'COMPARE'        // "What's the difference between X and Y?"

  // Interactive intents
  | 'QUIZ_ME'        // "Quiz me on biology"
  | 'CHECK_ANSWER'   // "Is my answer correct?"
  | 'PRACTICE'       // "Give me practice problems"

  // Clarification intents
  | 'CONFUSED'       // "I still don't get it"
  | 'FOLLOW_UP'      // "What about..." (continuing topic)
  | 'ELABORATE'      // "Tell me more"

  // Special intents
  | 'GENERATE_IMAGE' // "Draw a cell diagram"
  | 'FLASHCARDS'     // "Make flashcards"
  | 'PLAN_STUDY'     // "Help me plan my study"

  // Other
  | 'CASUAL_CHAT'    // "How are you?"
  | 'OFF_TOPIC'      // Non-study related
  | 'UNCLEAR'        // Cannot determine

/**
 * Valid intents array for validation
 */
export const VALID_INTENTS: UserIntent[] = [
  'EXPLAIN', 'SOLVE', 'SUMMARIZE', 'COMPARE',
  'QUIZ_ME', 'CHECK_ANSWER', 'PRACTICE',
  'CONFUSED', 'FOLLOW_UP', 'ELABORATE',
  'GENERATE_IMAGE', 'FLASHCARDS', 'PLAN_STUDY',
  'CASUAL_CHAT', 'OFF_TOPIC', 'UNCLEAR'
]

/**
 * Result of intent classification
 */
export interface IntentResult {
  intent: UserIntent
  confidence: 'high' | 'medium' | 'low'
  extracted: {
    topic?: string
    question?: string
    context?: string
    mathExpression?: string
  }
  usedFallback: boolean
  processingTimeMs?: number
}

// =============================================================================
// INPUT PROCESSING TYPES
// =============================================================================

/**
 * Format of the user's input
 */
export type InputFormat = 'sentence' | 'bullets' | 'fragment' | 'code' | 'math' | 'mixed'

/**
 * Processed user input with extracted components
 */
export interface ProcessedInput {
  original: string
  cleaned: string
  format: InputFormat
  wordCount: number
  extracted: {
    questions: string[]
    topics: string[]
    mathExpressions: string[]
    codeBlocks: string[]
  }
}

// =============================================================================
// RESPONSE CONFIGURATION TYPES
// =============================================================================

/**
 * How the AI should structure its response
 */
export type ResponseStyle =
  | 'concise'        // Short, direct answer
  | 'detailed'       // Full explanation
  | 'step_by_step'   // Numbered steps
  | 'example_first'  // Start with example, then explain
  | 'analogy'        // Use analogy to explain
  | 'socratic'       // Guide with questions
  | 'comparison'     // Compare/contrast format
  | 'visual_desc'    // Describe for visualization

/**
 * Tone of the AI's response
 */
export type ResponseTone =
  | 'encouraging'    // "Great question! ..."
  | 'direct'         // No fluff, just answer
  | 'patient'        // For confused users
  | 'enthusiastic'   // For engaged users
  | 'neutral'        // Default

/**
 * Length of the AI's response
 */
export type ResponseLength =
  | 'short'          // 1-2 sentences
  | 'medium'         // 1-2 paragraphs
  | 'long'           // Detailed explanation
  | 'adaptive'       // Match user's message length

/**
 * Complete response configuration
 */
export interface ResponseConfig {
  style: ResponseStyle
  tone: ResponseTone
  length: ResponseLength
  includeQuestion: boolean
  includeExample: boolean
  includeVisualOffer: boolean
  maxTokens: number
}

/**
 * Default response configuration
 */
export const DEFAULT_RESPONSE_CONFIG: ResponseConfig = {
  style: 'detailed',
  tone: 'neutral',
  length: 'medium',
  includeQuestion: false,
  includeExample: false,
  includeVisualOffer: false,
  maxTokens: 600,
}

// =============================================================================
// ADAPTIVE BEHAVIOR TYPES
// =============================================================================

/**
 * User signals detected from messages
 */
export interface UserSignals {
  isShort: boolean           // <= 3 words
  isConfused: boolean        // "I don't understand", etc.
  isCompleted: boolean       // "got it", "makes sense"
  isQuestion: boolean        // Ends with ?
  isDisengaged: boolean      // "ok", "idk", "whatever"
  isEngaged: boolean         // Long, detailed message
}

/**
 * Adaptive state tracking user behavior over time
 */
export interface AdaptiveState {
  // Counters (reset on positive signals)
  confusionCount: number
  shortReplyCount: number
  disengagementCount: number

  // Positive signals
  engagementLevel: 'low' | 'medium' | 'high'
  understandingConfirmed: boolean

  // Patterns
  preferredResponseLength: 'short' | 'medium' | 'long'
  questionsAskedByAI: number
  questionsAnsweredByUser: number

  // Topic tracking
  currentTopic: string | null
  topicDepth: number
  topicChanges: number

  // Timing
  lastMessageTimestamp: number
  messageCount: number
}

/**
 * Initial adaptive state
 */
export const INITIAL_ADAPTIVE_STATE: AdaptiveState = {
  confusionCount: 0,
  shortReplyCount: 0,
  disengagementCount: 0,
  engagementLevel: 'medium',
  understandingConfirmed: false,
  preferredResponseLength: 'medium',
  questionsAskedByAI: 0,
  questionsAnsweredByUser: 0,
  currentTopic: null,
  topicDepth: 0,
  topicChanges: 0,
  lastMessageTimestamp: 0,
  messageCount: 0,
}

// =============================================================================
// MEMORY CONTEXT TYPES
// =============================================================================

/**
 * Memory context for decision making
 */
export interface MemoryContext {
  preferredName: string | null
  preferredLearningStyle: 'visual' | 'reading' | 'hands-on' | null
  preferredDifficulty: 'easy' | 'medium' | 'hard' | null
  preferredPace: 'slow' | 'normal' | 'fast' | null
  communicationStyle: 'formal' | 'casual' | null
  currentSubjects: string[]
  strugglingTopics: string[]
  masteredTopics: string[]
  totalSessions: number
  streakDays: number
}

/**
 * Default memory context
 */
export const DEFAULT_MEMORY_CONTEXT: MemoryContext = {
  preferredName: null,
  preferredLearningStyle: null,
  preferredDifficulty: null,
  preferredPace: null,
  communicationStyle: null,
  currentSubjects: [],
  strugglingTopics: [],
  masteredTopics: [],
  totalSessions: 0,
  streakDays: 0,
}

// =============================================================================
// SESSION CONTEXT TYPES
// =============================================================================

/**
 * Session state for decision making
 */
export type SessionState = 'START' | 'WORKING' | 'STUCK' | 'PROGRESS_CHECK' | 'WRAP_UP'

/**
 * Session context for decision making
 */
export interface SessionContext {
  sessionId: string
  userId: string
  subject: string | null
  skillLevel: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT' | null
  sessionState: SessionState
  messageCount: number
  totalTokensUsed: number
  fallbackCallCount: number
  startedAt: Date
  recentMessages: Array<{ role: string; content: string }>
  intelligenceVersion: string | null
}

// =============================================================================
// DECISION TYPES
// =============================================================================

/**
 * Action the AI should take
 */
export type AIAction =
  | 'respond'
  | 'generate_image'
  | 'create_quiz'
  | 'create_flashcards'
  | 'clarify'

/**
 * Prompt injections to guide AI behavior
 */
export interface PromptInjections {
  styleInstruction: string
  toneInstruction: string
  lengthInstruction: string
  specialInstructions: string[]
}

/**
 * Post-response actions
 */
export interface PostActions {
  extractMemories: boolean
  updateSignals: boolean
  checkForVisualOffer: boolean
}

/**
 * Complete AI decision
 */
export interface AIDecision {
  action: AIAction
  responseConfig: ResponseConfig
  promptInjections: PromptInjections
  postActions: PostActions
  meta: {
    intent: UserIntent
    confidence: 'high' | 'medium' | 'low'
    usedAIFallback: boolean
    processingTimeMs: number
  }
}

// =============================================================================
// GUARDRAILS TYPES
// =============================================================================

/**
 * Performance guardrails configuration
 */
export interface Guardrails {
  maxFallbackCallsPerSession: number
  fallbackCallTimeoutMs: number
  maxTokensPerResponse: number
  maxTokensPerSession: number
  memoryExtractionInterval: number
  maxMemoriesPerSession: number
  maxHistorySize: number
}

/**
 * Default guardrails
 */
export const DEFAULT_GUARDRAILS: Guardrails = {
  maxFallbackCallsPerSession: 10,
  fallbackCallTimeoutMs: 2000,
  maxTokensPerResponse: 1200,
  maxTokensPerSession: 50000,
  memoryExtractionInterval: 5,
  maxMemoriesPerSession: 20,
  maxHistorySize: 50,
}
