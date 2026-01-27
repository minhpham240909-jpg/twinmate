/**
 * CLERVA PROGRESS CELEBRATIONS
 *
 * Micro-celebrations to build momentum and engagement.
 *
 * PHILOSOPHY:
 * - Celebrate small wins, not just big achievements
 * - Keep it brief and non-disruptive
 * - Data-driven (comparisons to average, personal bests)
 * - Build identity through recognition
 */

// ============================================
// TYPES
// ============================================

export type CelebrationType =
  | 'milestone_progress'    // "50% through this roadmap!"
  | 'speed_achievement'     // "2x faster than average!"
  | 'streak_update'         // "3 days straight!"
  | 'step_complete'         // Step completed celebration
  | 'roadmap_complete'      // Entire roadmap finished
  | 'comeback'              // Returned after absence
  | 'personal_best'         // Beat personal record
  | 'consistency'           // Regular learning pattern

export interface Celebration {
  id: string
  type: CelebrationType
  title: string
  message: string
  icon: string
  color: 'blue' | 'green' | 'purple' | 'orange' | 'yellow' | 'red'
  priority: 'low' | 'medium' | 'high'
  duration?: number // ms to show (default 4000)
}

export interface ProgressStats {
  // Roadmap progress
  roadmapProgress: number // 0-100
  completedSteps: number
  totalSteps: number
  
  // Time stats
  minutesSpentOnCurrentStep: number
  estimatedMinutesForStep: number
  totalMinutesLearned: number
  averageMinutesPerStep: number
  
  // Streak stats
  currentStreak: number
  longestStreak: number
  
  // Historical
  stepsCompletedToday: number
  stepsCompletedThisWeek: number
  daysActiveThisWeek: number
  lastActiveDate?: Date
  
  // Performance
  averageStepCompletionTime: number // minutes
  personalBestStepTime?: number // fastest step completion
}

// ============================================
// CELEBRATION DEFINITIONS
// ============================================

const MILESTONE_MESSAGES: Record<number, { title: string; message: string; icon: string }> = {
  25: {
    title: '25% Complete',
    message: '25% of roadmap steps completed.',
    icon: '📊',
  },
  50: {
    title: '50% Complete',
    message: 'Halfway through the roadmap.',
    icon: '📊',
  },
  75: {
    title: '75% Complete',
    message: '75% of steps finished. 25% remaining.',
    icon: '📊',
  },
  90: {
    title: '90% Complete',
    message: 'Final steps remaining.',
    icon: '📊',
  },
  100: {
    title: 'Roadmap Complete',
    message: 'All steps completed.',
    icon: '✓',
  },
}

const STREAK_MESSAGES: Record<number, { title: string; message: string; icon: string }> = {
  3: {
    title: '3-Day Streak',
    message: '3 consecutive days of activity.',
    icon: '📅',
  },
  7: {
    title: '7-Day Streak',
    message: '7 consecutive days of activity.',
    icon: '📅',
  },
  14: {
    title: '14-Day Streak',
    message: '14 consecutive days of activity.',
    icon: '📅',
  },
  30: {
    title: '30-Day Streak',
    message: '30 consecutive days of activity.',
    icon: '📅',
  },
}

const SPEED_THRESHOLDS = {
  fast: 0.5,      // 50% of estimated time = very fast
  quick: 0.75,   // 75% of estimated time = quick
}

// ============================================
// CELEBRATION DETECTION
// ============================================

/**
 * Check for celebrations after step completion
 */
export function checkStepCompletionCelebrations(
  stats: ProgressStats,
  previousStats: Partial<ProgressStats>
): Celebration[] {
  const celebrations: Celebration[] = []

  // 1. Check milestone progress
  const milestones = [25, 50, 75, 90, 100]
  for (const milestone of milestones) {
    const previousProgress = previousStats.roadmapProgress || 0
    if (previousProgress < milestone && stats.roadmapProgress >= milestone) {
      const config = MILESTONE_MESSAGES[milestone]
      celebrations.push({
        id: `milestone-${milestone}-${Date.now()}`,
        type: milestone === 100 ? 'roadmap_complete' : 'milestone_progress',
        title: config.title,
        message: config.message,
        icon: config.icon,
        color: milestone === 100 ? 'yellow' : 'blue',
        priority: milestone >= 75 ? 'high' : 'medium',
      })
      break // Only one milestone celebration at a time
    }
  }

  // 2. Check speed achievement
  if (stats.minutesSpentOnCurrentStep > 0 && stats.estimatedMinutesForStep > 0) {
    const speedRatio = stats.minutesSpentOnCurrentStep / stats.estimatedMinutesForStep

    if (speedRatio <= SPEED_THRESHOLDS.fast) {
      const multiplier = Math.round(stats.estimatedMinutesForStep / stats.minutesSpentOnCurrentStep * 10) / 10
      celebrations.push({
        id: `speed-${Date.now()}`,
        type: 'speed_achievement',
        title: 'Completed Early',
        message: `Step completed ${multiplier}x faster than estimated.`,
        icon: '⏱️',
        color: 'purple',
        priority: 'medium',
      })
    } else if (speedRatio <= SPEED_THRESHOLDS.quick) {
      celebrations.push({
        id: `speed-${Date.now()}`,
        type: 'speed_achievement',
        title: 'Ahead of Schedule',
        message: 'Step completed under estimated time.',
        icon: '⏱️',
        color: 'green',
        priority: 'low',
      })
    }
  }

  // 3. Check personal best
  if (
    stats.personalBestStepTime &&
    stats.minutesSpentOnCurrentStep > 0 &&
    stats.minutesSpentOnCurrentStep < stats.personalBestStepTime
  ) {
    celebrations.push({
      id: `pb-${Date.now()}`,
      type: 'personal_best',
      title: 'New Personal Best',
      message: `Fastest step completion: ${stats.minutesSpentOnCurrentStep} min (previous: ${stats.personalBestStepTime} min).`,
      icon: '⏱️',
      color: 'orange',
      priority: 'high',
    })
  }

  // 4. Check streak updates
  const previousStreak = previousStats.currentStreak || 0
  const streakMilestones = [3, 7, 14, 30, 60, 100]
  
  for (const streakMilestone of streakMilestones) {
    if (previousStreak < streakMilestone && stats.currentStreak >= streakMilestone) {
      const config = STREAK_MESSAGES[streakMilestone] || {
        title: `${streakMilestone}-Day Streak!`,
        message: `${streakMilestone} days of consistent learning!`,
        icon: '🔥',
      }
      celebrations.push({
        id: `streak-${streakMilestone}-${Date.now()}`,
        type: 'streak_update',
        title: config.title,
        message: config.message,
        icon: config.icon,
        color: 'red',
        priority: streakMilestone >= 7 ? 'high' : 'medium',
      })
      break
    }
  }

  // 5. Check daily productivity
  if (stats.stepsCompletedToday === 3) {
    celebrations.push({
      id: `daily-3-${Date.now()}`,
      type: 'consistency',
      title: '3 Steps Today',
      message: '3 steps completed in this session.',
      icon: '📊',
      color: 'green',
      priority: 'low',
    })
  } else if (stats.stepsCompletedToday === 5) {
    celebrations.push({
      id: `daily-5-${Date.now()}`,
      type: 'consistency',
      title: '5 Steps Today',
      message: '5 steps completed in this session.',
      icon: '📊',
      color: 'orange',
      priority: 'medium',
    })
  }

  return celebrations
}

/**
 * Check for comeback celebration
 */
export function checkComebackCelebration(
  lastActiveDate: Date | undefined,
  currentStreak: number
): Celebration | null {
  if (!lastActiveDate) return null

  const daysSinceActive = Math.floor(
    (Date.now() - new Date(lastActiveDate).getTime()) / (1000 * 60 * 60 * 24)
  )

  if (daysSinceActive >= 3 && daysSinceActive <= 14) {
    return {
      id: `comeback-${Date.now()}`,
      type: 'comeback',
      title: 'Session Resumed',
      message: `Last activity: ${daysSinceActive} days ago.`,
      icon: '↩️',
      color: 'blue',
      priority: 'medium',
    }
  }

  if (daysSinceActive > 14) {
    return {
      id: `comeback-${Date.now()}`,
      type: 'comeback',
      title: 'Session Resumed',
      message: `Last activity: ${daysSinceActive} days ago. Previous streak reset.`,
      icon: '↩️',
      color: 'purple',
      priority: 'high',
    }
  }

  return null
}

/**
 * Get motivational message for current progress
 */
export function getProgressMotivation(stats: ProgressStats): string {
  // Data-focused progress summary
  if (stats.currentStreak >= 7) {
    return `Current streak: ${stats.currentStreak} days.`
  }

  if (stats.roadmapProgress >= 50 && stats.roadmapProgress < 100) {
    return `Roadmap progress: ${Math.round(stats.roadmapProgress)}%.`
  }

  if (stats.stepsCompletedToday >= 2) {
    return `Steps completed today: ${stats.stepsCompletedToday}.`
  }

  if (stats.totalMinutesLearned >= 60) {
    const hours = Math.floor(stats.totalMinutesLearned / 60)
    return `Total time invested: ${hours}+ hours.`
  }

  return 'Continue to next step.'
}

// ============================================
// STORAGE HELPERS
// ============================================

const CELEBRATION_STORAGE_KEY = 'clerva_shown_celebrations'
const CELEBRATION_EXPIRY_DAYS = 7

/**
 * Track which celebrations have been shown to avoid repeats
 */
export function hasShownCelebration(celebrationId: string): boolean {
  if (typeof window === 'undefined') return false
  
  try {
    const stored = localStorage.getItem(CELEBRATION_STORAGE_KEY)
    if (!stored) return false
    
    const shown: Record<string, number> = JSON.parse(stored)
    const timestamp = shown[celebrationId]
    
    if (!timestamp) return false
    
    // Check if expired
    const expiryMs = CELEBRATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000
    return Date.now() - timestamp < expiryMs
  } catch {
    return false
  }
}

/**
 * Mark a celebration as shown
 */
export function markCelebrationShown(celebrationId: string): void {
  if (typeof window === 'undefined') return
  
  try {
    const stored = localStorage.getItem(CELEBRATION_STORAGE_KEY)
    const shown: Record<string, number> = stored ? JSON.parse(stored) : {}
    
    shown[celebrationId] = Date.now()
    
    // Clean up old entries
    const expiryMs = CELEBRATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000
    for (const [key, timestamp] of Object.entries(shown)) {
      if (Date.now() - timestamp > expiryMs) {
        delete shown[key]
      }
    }
    
    localStorage.setItem(CELEBRATION_STORAGE_KEY, JSON.stringify(shown))
  } catch {
    // Ignore storage errors
  }
}
