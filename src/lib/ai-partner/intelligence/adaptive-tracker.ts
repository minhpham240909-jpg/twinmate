/**
 * AI Partner Intelligence System - Adaptive Tracker
 *
 * Tracks user signals across messages and maintains adaptive state.
 * This allows the AI to adapt its behavior based on user patterns.
 *
 * Performance optimized:
 * - Lightweight state object (serializable to JSON)
 * - No external API calls
 * - O(1) state updates
 */

import type { AdaptiveState, UserSignals } from './types'
import { INITIAL_ADAPTIVE_STATE } from './types'
import { detectUserSignals } from './intent-classifier'

/**
 * Adaptive Tracker class
 * Maintains state across messages and calculates behavioral adjustments
 */
export class AdaptiveTracker {
  private state: AdaptiveState

  constructor(initialState?: Partial<AdaptiveState>) {
    this.state = {
      ...INITIAL_ADAPTIVE_STATE,
      ...initialState,
    }
  }

  /**
   * Process a new message and update adaptive state
   * Call this for every user message to track patterns
   */
  processUserMessage(content: string, timestamp: number = Date.now()): UserSignals {
    const signals = detectUserSignals(content)

    // Update confusion tracking
    if (signals.isConfused) {
      this.state.confusionCount++
      this.state.understandingConfirmed = false
    } else if (signals.isCompleted) {
      // Reset confusion on understanding confirmed
      this.state.confusionCount = 0
      this.state.understandingConfirmed = true
    }

    // Update engagement tracking
    if (signals.isShort || signals.isDisengaged) {
      this.state.shortReplyCount++
      this.state.disengagementCount++
    } else if (signals.isEngaged) {
      // Reset disengagement counters on engagement
      this.state.shortReplyCount = 0
      this.state.disengagementCount = Math.max(0, this.state.disengagementCount - 1)
    } else if (signals.isQuestion) {
      // Questions are engagement
      this.state.shortReplyCount = 0
      this.state.questionsAnsweredByUser++ // They responded with a question
    }

    // Calculate engagement level
    this.state.engagementLevel = this.calculateEngagementLevel()

    // Update preferred response length based on user's message patterns
    this.state.preferredResponseLength = this.inferPreferredLength(content)

    // Update timing
    this.state.lastMessageTimestamp = timestamp
    this.state.messageCount++

    return signals
  }

  /**
   * Process an AI message (track questions asked by AI)
   */
  processAIMessage(content: string): void {
    // Check if AI asked a question
    if (content.trim().endsWith('?')) {
      this.state.questionsAskedByAI++
    }
  }

  /**
   * Update current topic
   */
  updateTopic(topic: string | null): void {
    if (topic && topic !== this.state.currentTopic) {
      if (this.state.currentTopic) {
        this.state.topicChanges++
      }
      this.state.currentTopic = topic
      this.state.topicDepth = 1
    } else if (topic === this.state.currentTopic) {
      // Same topic, going deeper
      this.state.topicDepth++
    }
  }

  /**
   * Get current adaptive state
   */
  getState(): AdaptiveState {
    return { ...this.state }
  }

  /**
   * Get serializable state for database storage
   */
  toJSON(): string {
    return JSON.stringify(this.state)
  }

  /**
   * Create tracker from serialized state
   */
  static fromJSON(json: string): AdaptiveTracker {
    try {
      const state = JSON.parse(json)
      return new AdaptiveTracker(state)
    } catch {
      return new AdaptiveTracker()
    }
  }

  /**
   * Check if AI should ask a question
   */
  shouldAskQuestion(): boolean {
    // Don't ask if we've asked too many unanswered questions
    if (this.state.questionsAskedByAI > this.state.questionsAnsweredByUser + 1) {
      return false
    }

    // Ask if disengaged (try to re-engage)
    if (this.state.engagementLevel === 'low' && this.state.shortReplyCount >= 2) {
      return true
    }

    // Don't ask if they're highly engaged and understanding
    if (this.state.engagementLevel === 'high' && this.state.understandingConfirmed) {
      return false
    }

    // Ask if confused (check understanding)
    if (this.state.confusionCount >= 2) {
      return true
    }

    return false
  }

  /**
   * Check if AI should offer a visual
   */
  shouldOfferVisual(): boolean {
    // Offer if confused and we're deep enough in a topic
    if (this.state.confusionCount >= 1 && this.state.topicDepth >= 2) {
      return true
    }

    // Offer if topic depth is high (complex topic)
    if (this.state.topicDepth >= 3) {
      return true
    }

    return false
  }

  /**
   * Check if user seems stuck
   */
  isUserStuck(): boolean {
    return (
      this.state.confusionCount >= 2 ||
      (this.state.shortReplyCount >= 3 && this.state.engagementLevel === 'low')
    )
  }

  /**
   * Check if it's time for a progress check
   * (Should be called with session duration)
   */
  shouldCheckProgress(sessionDurationMinutes: number): boolean {
    // Check every ~10 minutes
    const checkIntervalMinutes = 10
    const checkCount = Math.floor(sessionDurationMinutes / checkIntervalMinutes)

    // Only suggest if we haven't asked too many questions
    if (this.state.questionsAskedByAI > this.state.questionsAnsweredByUser + 2) {
      return false
    }

    // Suggest at 10, 20, 30 minute marks approximately
    return checkCount > 0 && this.state.messageCount % 20 === 0
  }

  /**
   * Reset counters (call on topic change or positive signal)
   */
  resetCounters(): void {
    this.state.confusionCount = 0
    this.state.shortReplyCount = 0
    this.state.disengagementCount = 0
    this.state.understandingConfirmed = false
  }

  /**
   * Calculate engagement level based on counters
   */
  private calculateEngagementLevel(): 'low' | 'medium' | 'high' {
    if (this.state.disengagementCount >= 3 || this.state.shortReplyCount >= 4) {
      return 'low'
    }
    if (this.state.shortReplyCount >= 2 || this.state.disengagementCount >= 2) {
      return 'medium'
    }
    return 'high'
  }

  /**
   * Infer preferred response length from user's message length
   */
  private inferPreferredLength(content: string): 'short' | 'medium' | 'long' {
    const wordCount = content.split(/\s+/).filter(w => w.length > 0).length

    if (wordCount <= 5) return 'short'
    if (wordCount <= 20) return 'medium'
    return 'long'
  }
}

/**
 * Create a new adaptive tracker with default state
 */
export function createAdaptiveTracker(): AdaptiveTracker {
  return new AdaptiveTracker()
}

/**
 * Restore adaptive tracker from database JSON
 */
export function restoreAdaptiveTracker(json: string | null): AdaptiveTracker {
  if (!json) {
    return new AdaptiveTracker()
  }
  return AdaptiveTracker.fromJSON(json)
}

/**
 * Determine session state based on adaptive state and timing
 */
export function determineSessionState(
  adaptiveState: AdaptiveState,
  sessionDurationMinutes: number
): 'START' | 'WORKING' | 'STUCK' | 'PROGRESS_CHECK' | 'WRAP_UP' {
  // First few messages - START state
  if (adaptiveState.messageCount <= 4) {
    return 'START'
  }

  // Session over 45 minutes - consider wrap up
  if (sessionDurationMinutes >= 45) {
    return 'WRAP_UP'
  }

  // User seems stuck
  if (
    adaptiveState.confusionCount >= 2 ||
    (adaptiveState.shortReplyCount >= 3 && adaptiveState.engagementLevel === 'low')
  ) {
    return 'STUCK'
  }

  // Progress check time (~10 minute intervals, but not if disengaged)
  if (
    sessionDurationMinutes >= 10 &&
    sessionDurationMinutes % 10 < 2 && // Within 2 minutes of check interval
    adaptiveState.engagementLevel !== 'low'
  ) {
    return 'PROGRESS_CHECK'
  }

  // Default working state
  return 'WORKING'
}

/**
 * Quick check for user signals without full tracker
 * Use for one-off checks where you don't need persistent state
 */
export function quickDetectSignals(content: string): UserSignals {
  return detectUserSignals(content)
}
