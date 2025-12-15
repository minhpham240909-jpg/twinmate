/**
 * AI Partner Intelligence System - Response Mapper
 *
 * Maps intents to appropriate response configurations.
 * Dynamically adjusts response style, tone, and length based on context.
 */

import type {
  UserIntent,
  ResponseConfig,
  ResponseStyle,
  ResponseTone,
  ResponseLength,
  AdaptiveState,
  MemoryContext,
  SessionState,
} from './types'
import { DEFAULT_RESPONSE_CONFIG } from './types'

/**
 * Base response configuration for each intent
 */
const INTENT_RESPONSE_MAP: Record<UserIntent, Partial<ResponseConfig>> = {
  // Learning intents - prioritize clarity and helpfulness
  EXPLAIN: {
    style: 'detailed',
    tone: 'neutral',
    length: 'medium',
    includeQuestion: false,
    includeExample: true,
    maxTokens: 800,
  },

  SOLVE: {
    style: 'step_by_step',
    tone: 'direct',
    length: 'medium',
    includeQuestion: false,
    includeExample: false,
    maxTokens: 600,
  },

  SUMMARIZE: {
    style: 'concise',
    tone: 'direct',
    length: 'short',
    includeQuestion: false,
    includeExample: false,
    maxTokens: 400,
  },

  COMPARE: {
    style: 'comparison',
    tone: 'neutral',
    length: 'medium',
    includeQuestion: false,
    includeExample: false,
    maxTokens: 600,
  },

  // Interactive intents - encourage engagement
  QUIZ_ME: {
    style: 'socratic',
    tone: 'encouraging',
    length: 'short',
    includeQuestion: true, // Quiz IS a question
    includeExample: false,
    maxTokens: 300,
  },

  CHECK_ANSWER: {
    style: 'detailed',
    tone: 'encouraging',
    length: 'medium',
    includeQuestion: false,
    includeExample: true, // Show correct approach
    maxTokens: 500,
  },

  PRACTICE: {
    style: 'step_by_step',
    tone: 'encouraging',
    length: 'medium',
    includeQuestion: true, // Give them a problem
    includeExample: false,
    maxTokens: 400,
  },

  // Clarification intents - be patient and supportive
  CONFUSED: {
    style: 'example_first',
    tone: 'patient',
    length: 'medium',
    includeQuestion: true, // Check understanding
    includeExample: true,
    maxTokens: 700,
  },

  FOLLOW_UP: {
    style: 'concise',
    tone: 'neutral',
    length: 'adaptive',
    includeQuestion: false,
    includeExample: false,
    maxTokens: 500,
  },

  ELABORATE: {
    style: 'detailed',
    tone: 'enthusiastic',
    length: 'long',
    includeQuestion: false,
    includeExample: true,
    maxTokens: 1000,
  },

  // Special intents
  GENERATE_IMAGE: {
    style: 'concise',
    tone: 'encouraging',
    length: 'short',
    includeQuestion: false,
    includeExample: false,
    maxTokens: 200,
  },

  FLASHCARDS: {
    style: 'concise',
    tone: 'encouraging',
    length: 'short',
    includeQuestion: false,
    includeExample: false,
    maxTokens: 200,
  },

  PLAN_STUDY: {
    style: 'step_by_step',
    tone: 'encouraging',
    length: 'medium',
    includeQuestion: true, // Clarify goals
    includeExample: false,
    maxTokens: 600,
  },

  // Other intents
  CASUAL_CHAT: {
    style: 'concise',
    tone: 'encouraging',
    length: 'short',
    includeQuestion: true, // Redirect to study
    includeExample: false,
    maxTokens: 150,
  },

  OFF_TOPIC: {
    style: 'concise',
    tone: 'patient',
    length: 'short',
    includeQuestion: true, // Redirect
    includeExample: false,
    maxTokens: 150,
  },

  UNCLEAR: {
    style: 'concise',
    tone: 'patient',
    length: 'short',
    includeQuestion: true, // Ask for clarification
    includeExample: false,
    maxTokens: 200,
  },
}

/**
 * Build response configuration based on intent, adaptive state, and memory
 */
export function buildResponseConfig(
  intent: UserIntent,
  adaptiveState: AdaptiveState,
  memoryContext: MemoryContext,
  sessionState: SessionState
): ResponseConfig {
  // Start with default config
  const config: ResponseConfig = {
    ...DEFAULT_RESPONSE_CONFIG,
    ...INTENT_RESPONSE_MAP[intent],
  }

  // Apply adaptive adjustments
  applyAdaptiveAdjustments(config, adaptiveState)

  // Apply memory adjustments
  applyMemoryAdjustments(config, memoryContext)

  // Apply session state adjustments
  applySessionStateAdjustments(config, sessionState, intent)

  return config
}

/**
 * Apply adjustments based on adaptive user signals
 */
function applyAdaptiveAdjustments(config: ResponseConfig, state: AdaptiveState): void {
  // Confusion handling - be extra patient and use examples
  if (state.confusionCount >= 2) {
    config.style = 'example_first'
    config.tone = 'patient'
    config.includeExample = true
    config.maxTokens = Math.min(config.maxTokens + 200, 1000)
  } else if (state.confusionCount === 1) {
    // Mild confusion - add example
    config.includeExample = true
  }

  // Disengagement handling - shorter responses, try to re-engage
  if (state.shortReplyCount >= 3 || state.engagementLevel === 'low') {
    config.length = 'short'
    config.includeQuestion = true // Try to re-engage
    config.maxTokens = Math.min(config.maxTokens, 300)
  }

  // High engagement - give them what they want
  if (state.engagementLevel === 'high' && state.understandingConfirmed) {
    config.includeQuestion = false // Don't interrupt their flow
  }

  // Match their preferred response length
  if (state.preferredResponseLength === 'short' && config.length !== 'long') {
    config.length = 'short'
    config.maxTokens = Math.min(config.maxTokens, 400)
  }

  // If they've asked questions but we haven't answered yet
  if (state.questionsAskedByAI > state.questionsAnsweredByUser + 1) {
    config.includeQuestion = false // Stop asking, they haven't answered
  }
}

/**
 * Apply adjustments based on user memory
 */
function applyMemoryAdjustments(config: ResponseConfig, memory: MemoryContext): void {
  // Learning style preferences
  if (memory.preferredLearningStyle === 'visual') {
    config.includeVisualOffer = true
  } else if (memory.preferredLearningStyle === 'hands-on') {
    config.includeExample = true
    if (config.style === 'detailed') {
      config.style = 'example_first'
    }
  }

  // Difficulty preferences
  if (memory.preferredDifficulty === 'easy') {
    config.length = config.length === 'short' ? 'short' : 'medium'
    config.includeExample = true
    config.tone = 'patient'
    config.maxTokens = Math.min(config.maxTokens + 100, 1000)
  } else if (memory.preferredDifficulty === 'hard') {
    // Advanced users don't need hand-holding
    if (config.length === 'long') {
      config.length = 'medium'
    }
    config.tone = 'direct'
    config.maxTokens = Math.max(config.maxTokens - 100, 300)
  }

  // Pace preferences
  if (memory.preferredPace === 'slow') {
    config.maxTokens = Math.min(config.maxTokens * 1.2, 1200)
  } else if (memory.preferredPace === 'fast') {
    config.maxTokens = Math.max(config.maxTokens * 0.8, 200)
    config.length = config.length === 'long' ? 'medium' : config.length
  }

  // Communication style
  if (memory.communicationStyle === 'formal') {
    config.tone = 'neutral'
  } else if (memory.communicationStyle === 'casual') {
    if (config.tone === 'neutral') {
      config.tone = 'encouraging'
    }
  }
}

/**
 * Apply adjustments based on session state
 */
function applySessionStateAdjustments(
  config: ResponseConfig,
  sessionState: SessionState,
  intent: UserIntent
): void {
  switch (sessionState) {
    case 'START':
      // Beginning of session - ask questions to understand goals
      if (intent !== 'QUIZ_ME' && intent !== 'PRACTICE') {
        config.includeQuestion = true
      }
      config.tone = 'encouraging'
      break

    case 'WORKING':
      // Default working state - don't over-question
      // Only ask if already configured to (like for CONFUSED intent)
      break

    case 'STUCK':
      // User seems stuck - be supportive
      config.tone = 'patient'
      config.includeQuestion = true // Offer alternative approach
      config.includeExample = true
      break

    case 'PROGRESS_CHECK':
      // Time for a progress check
      config.includeQuestion = true
      config.length = 'short'
      break

    case 'WRAP_UP':
      // Session winding down
      config.length = 'short'
      config.includeQuestion = true // Offer next steps
      config.style = 'concise'
      break
  }
}

/**
 * Get style instruction text for prompt injection
 */
export function getStyleInstruction(style: ResponseStyle): string {
  const instructions: Record<ResponseStyle, string> = {
    concise: 'Be brief and direct. Get to the point quickly without unnecessary elaboration.',
    detailed: 'Provide a thorough explanation with context and depth.',
    step_by_step: 'Break down your response into clear, numbered steps.',
    example_first: 'Start with a concrete example, then explain the underlying concept.',
    analogy: 'Use an analogy or metaphor to make the concept relatable.',
    socratic: 'Guide understanding through thoughtful questions rather than direct answers.',
    comparison: 'Structure as a clear comparison with distinct points of similarity and difference.',
    visual_desc: 'Describe concepts in a way that helps visualize them mentally.',
  }
  return instructions[style]
}

/**
 * Get tone instruction text for prompt injection
 */
export function getToneInstruction(tone: ResponseTone): string {
  const instructions: Record<ResponseTone, string> = {
    encouraging: 'Be warm, supportive, and positive.',
    direct: 'Be straightforward and efficient, without extra pleasantries.',
    patient: 'Be very patient and understanding. Take time to ensure clarity.',
    enthusiastic: 'Show genuine interest and energy about the topic.',
    neutral: '', // No specific tone instruction
  }
  return instructions[tone]
}

/**
 * Get length instruction text for prompt injection
 */
export function getLengthInstruction(length: ResponseLength): string {
  const instructions: Record<ResponseLength, string> = {
    short: 'Keep your response brief - 1-2 sentences only.',
    medium: 'Keep your response focused - 1-2 short paragraphs.',
    long: 'Provide a comprehensive response, but stay focused and organized.',
    adaptive: "Match the length and energy of the student's message.",
  }
  return instructions[length]
}

/**
 * Check if response should include a question based on config
 */
export function shouldIncludeQuestion(config: ResponseConfig): boolean {
  return config.includeQuestion
}

/**
 * Check if response should suggest visual based on config
 */
export function shouldOfferVisual(config: ResponseConfig): boolean {
  return config.includeVisualOffer
}

/**
 * Get recommended max tokens for a configuration
 */
export function getMaxTokens(config: ResponseConfig): number {
  return config.maxTokens
}
