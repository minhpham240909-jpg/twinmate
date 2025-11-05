/**
 * SM-2 Spaced Repetition Algorithm
 *
 * This implements the SuperMemo SM-2 algorithm for spaced repetition learning.
 *
 * @see https://www.supermemo.com/en/archives1990-2015/english/ol/sm2
 */

export interface ReviewResult {
  quality: number // 0-5, where 0 = complete blackout, 5 = perfect response
}

export interface SpacedRepetitionData {
  easeFactor: number // Current ease factor (default 2.5)
  intervalDays: number // Days until next review
  repetitions: number // Number of consecutive successful reviews
  nextReviewDate: Date // When to review next
}

/**
 * Calculate the next review based on SM-2 algorithm
 *
 * Quality scale:
 * - 5: Perfect response
 * - 4: Correct response after hesitation
 * - 3: Correct response with difficulty (minimum passing grade)
 * - 2: Incorrect response but remembered upon seeing answer
 * - 1: Incorrect response with bits of correct answer
 * - 0: Complete blackout
 *
 * @param currentData Current spaced repetition data
 * @param quality Quality of recall (0-5)
 * @returns Updated spaced repetition data
 */
export function calculateNextReview(
  currentData: SpacedRepetitionData,
  quality: number
): SpacedRepetitionData {
  // Ensure quality is in valid range
  if (quality < 0 || quality > 5) {
    throw new Error('Quality must be between 0 and 5')
  }

  let { easeFactor, intervalDays, repetitions } = currentData

  // Calculate new ease factor
  // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  const newEaseFactor = Math.max(
    1.3, // Minimum ease factor
    easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  )

  let newIntervalDays: number
  let newRepetitions: number

  if (quality < 3) {
    // Incorrect response - reset repetitions and interval
    newRepetitions = 0
    newIntervalDays = 1
  } else {
    // Correct response - increase interval based on repetition count
    newRepetitions = repetitions + 1

    if (newRepetitions === 1) {
      newIntervalDays = 1
    } else if (newRepetitions === 2) {
      newIntervalDays = 6
    } else {
      // For subsequent reviews, multiply previous interval by ease factor
      newIntervalDays = Math.round(intervalDays * newEaseFactor)
    }
  }

  // Calculate next review date
  const nextReviewDate = new Date()
  nextReviewDate.setDate(nextReviewDate.getDate() + newIntervalDays)
  // Set to start of day for cleaner scheduling
  nextReviewDate.setHours(0, 0, 0, 0)

  return {
    easeFactor: newEaseFactor,
    intervalDays: newIntervalDays,
    repetitions: newRepetitions,
    nextReviewDate,
  }
}

/**
 * Get initial spaced repetition data for a new flashcard
 */
export function getInitialSpacedRepetitionData(): SpacedRepetitionData {
  const nextReviewDate = new Date()
  nextReviewDate.setDate(nextReviewDate.getDate() + 1)
  nextReviewDate.setHours(0, 0, 0, 0)

  return {
    easeFactor: 2.5,
    intervalDays: 1,
    repetitions: 0,
    nextReviewDate,
  }
}

/**
 * Check if a flashcard is due for review
 */
export function isDueForReview(nextReviewDate: Date): boolean {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return nextReviewDate <= now
}

/**
 * Get cards that are due for review from a list of flashcards
 */
export function getDueCards<T extends { nextReviewDate: Date | null }>(
  cards: T[]
): T[] {
  const now = new Date()
  now.setHours(0, 0, 0, 0)

  return cards.filter(card => {
    if (!card.nextReviewDate) return true // Never reviewed = due
    return card.nextReviewDate <= now
  })
}

/**
 * Convert quality from a simplified scale (easy/medium/hard/again) to SM-2 scale (0-5)
 */
export function simplifiedQualityToSM2(quality: 'easy' | 'medium' | 'hard' | 'again'): number {
  const qualityMap = {
    easy: 5,    // Perfect response
    medium: 4,  // Correct with slight hesitation
    hard: 3,    // Correct with difficulty (minimum passing)
    again: 0,   // Need to review again
  }
  return qualityMap[quality]
}
