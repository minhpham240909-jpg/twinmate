/**
 * CLERVA STRUGGLE DETECTOR
 *
 * Proactively detects when users are struggling and offers help
 * BEFORE they get frustrated and abandon.
 *
 * PHILOSOPHY:
 * - Don't wait for users to ask for help
 * - Detect subtle signals of struggle
 * - Offer gentle nudges, not interruptions
 * - Track patterns to improve detection
 */

// ============================================
// TYPES
// ============================================

export type StruggleLevel = 'none' | 'mild' | 'moderate' | 'severe'

export type StruggleSignal =
  | 'time_exceeded'       // Viewing step for >2x estimated time
  | 'multiple_views'      // Viewing same step multiple times
  | 'no_progress'         // Long time with no completion
  | 'quick_abandon'       // Started but quickly left
  | 'repeated_attempts'   // Multiple failed attempts
  | 'help_seeking'        // Looking at hints/help resources

export interface StruggleIndicator {
  signal: StruggleSignal
  severity: StruggleLevel
  timestamp: number
  details?: string
}

export interface StruggleState {
  level: StruggleLevel
  indicators: StruggleIndicator[]
  shouldShowNudge: boolean
  nudgeType: NudgeType | null
  nudgeMessage: string | null
  lastNudgeAt: number | null
}

export type NudgeType =
  | 'hint'               // Offer a hint
  | 'break_suggestion'   // Suggest taking a break
  | 'simplify'           // Suggest breaking down the problem
  | 'resource'           // Suggest external resource
  | 'encouragement'      // Just encouragement
  | 'ask_help'           // Suggest asking for help

export interface Nudge {
  type: NudgeType
  title: string
  message: string
  icon: string
  action?: {
    label: string
    handler: string // Function name to call
  }
}

export interface StepActivity {
  stepId: string
  startedAt: number
  estimatedMinutes: number
  viewCount: number
  totalTimeSpent: number // accumulated minutes
  lastViewedAt: number
  attempts: number
  lastAttemptSuccess: boolean | null
}

// ============================================
// CONFIGURATION
// ============================================

const STRUGGLE_THRESHOLDS = {
  // Time-based (multiplier of estimated time)
  mildTimeExceeded: 1.5,      // 1.5x estimated time
  moderateTimeExceeded: 2.0,  // 2x estimated time
  severeTimeExceeded: 3.0,    // 3x estimated time

  // View-based
  multipleViewsThreshold: 3,  // Same step viewed 3+ times
  
  // Attempt-based
  failedAttemptsModerate: 2,  // 2 failed attempts
  failedAttemptsSevere: 4,    // 4+ failed attempts

  // Nudge cooldown (ms)
  nudgeCooldown: 5 * 60 * 1000, // 5 minutes between nudges
}

// ============================================
// NUDGE DEFINITIONS
// ============================================

const NUDGES: Record<NudgeType, Nudge[]> = {
  hint: [
    {
      type: 'hint',
      title: 'Hint Available',
      message: 'Step is taking longer than estimated. A hint may help.',
      icon: '💡',
      action: { label: 'Show Hint', handler: 'showHint' },
    },
    {
      type: 'hint',
      title: 'Assistance Available',
      message: 'View a hint for this step.',
      icon: '💡',
      action: { label: 'Get Hint', handler: 'showHint' },
    },
  ],
  break_suggestion: [
    {
      type: 'break_suggestion',
      title: 'Extended Session Detected',
      message: 'Research shows short breaks improve retention. Consider a 5-minute pause.',
      icon: '⏸️',
    },
    {
      type: 'break_suggestion',
      title: 'Session Duration Notice',
      message: 'Extended focus periods benefit from periodic breaks.',
      icon: '⏸️',
    },
  ],
  simplify: [
    {
      type: 'simplify',
      title: 'Breakdown Available',
      message: 'This step can be divided into smaller sub-steps.',
      icon: '📋',
      action: { label: 'Show Breakdown', handler: 'simplifyStep' },
    },
  ],
  resource: [
    {
      type: 'resource',
      title: 'Additional Resources',
      message: 'Supplementary materials available for this topic.',
      icon: '📚',
      action: { label: 'View Resources', handler: 'showResources' },
    },
  ],
  encouragement: [
    {
      type: 'encouragement',
      title: 'Difficulty Expected',
      message: 'This step typically requires multiple attempts.',
      icon: '📊',
    },
    {
      type: 'encouragement',
      title: 'Normal Progress',
      message: 'Time spent on challenging material is productive.',
      icon: '📊',
    },
  ],
  ask_help: [
    {
      type: 'ask_help',
      title: 'AI Assistance',
      message: 'Discuss this topic with the AI study partner.',
      icon: '💬',
      action: { label: 'Open Chat', handler: 'openChat' },
    },
  ],
}

// ============================================
// STRUGGLE DETECTION
// ============================================

/**
 * Analyze step activity and detect struggle level
 */
export function detectStruggle(activity: StepActivity): StruggleState {
  const indicators: StruggleIndicator[] = []
  const now = Date.now()

  // Calculate time spent ratio
  const timeSpentMinutes = activity.totalTimeSpent + 
    ((now - activity.lastViewedAt) / (1000 * 60))
  const timeRatio = timeSpentMinutes / Math.max(1, activity.estimatedMinutes)

  // 1. Check time exceeded
  if (timeRatio >= STRUGGLE_THRESHOLDS.severeTimeExceeded) {
    indicators.push({
      signal: 'time_exceeded',
      severity: 'severe',
      timestamp: now,
      details: `${Math.round(timeRatio)}x estimated time`,
    })
  } else if (timeRatio >= STRUGGLE_THRESHOLDS.moderateTimeExceeded) {
    indicators.push({
      signal: 'time_exceeded',
      severity: 'moderate',
      timestamp: now,
      details: `${Math.round(timeRatio * 10) / 10}x estimated time`,
    })
  } else if (timeRatio >= STRUGGLE_THRESHOLDS.mildTimeExceeded) {
    indicators.push({
      signal: 'time_exceeded',
      severity: 'mild',
      timestamp: now,
      details: `${Math.round(timeRatio * 10) / 10}x estimated time`,
    })
  }

  // 2. Check multiple views
  if (activity.viewCount >= STRUGGLE_THRESHOLDS.multipleViewsThreshold) {
    indicators.push({
      signal: 'multiple_views',
      severity: activity.viewCount >= 5 ? 'moderate' : 'mild',
      timestamp: now,
      details: `Viewed ${activity.viewCount} times`,
    })
  }

  // 3. Check failed attempts
  if (activity.attempts >= STRUGGLE_THRESHOLDS.failedAttemptsSevere && !activity.lastAttemptSuccess) {
    indicators.push({
      signal: 'repeated_attempts',
      severity: 'severe',
      timestamp: now,
      details: `${activity.attempts} attempts without success`,
    })
  } else if (activity.attempts >= STRUGGLE_THRESHOLDS.failedAttemptsModerate && !activity.lastAttemptSuccess) {
    indicators.push({
      signal: 'repeated_attempts',
      severity: 'moderate',
      timestamp: now,
      details: `${activity.attempts} attempts`,
    })
  }

  // Determine overall struggle level
  const level = determineStruggleLevel(indicators)
  
  // Determine if should show nudge
  const { shouldShowNudge, nudgeType, nudgeMessage } = determineNudge(level, indicators, activity)

  return {
    level,
    indicators,
    shouldShowNudge,
    nudgeType,
    nudgeMessage,
    lastNudgeAt: null, // Will be set by the hook
  }
}

/**
 * Determine overall struggle level from indicators
 */
function determineStruggleLevel(indicators: StruggleIndicator[]): StruggleLevel {
  if (indicators.length === 0) return 'none'

  const severities = indicators.map(i => i.severity)
  
  if (severities.includes('severe')) return 'severe'
  if (severities.filter(s => s === 'moderate').length >= 2) return 'severe'
  if (severities.includes('moderate')) return 'moderate'
  if (severities.includes('mild')) return 'mild'
  
  return 'none'
}

/**
 * Determine which nudge to show based on struggle state
 */
function determineNudge(
  level: StruggleLevel,
  indicators: StruggleIndicator[],
  activity: StepActivity
): { shouldShowNudge: boolean; nudgeType: NudgeType | null; nudgeMessage: string | null } {
  if (level === 'none') {
    return { shouldShowNudge: false, nudgeType: null, nudgeMessage: null }
  }

  // Determine nudge type based on signals
  const signals = indicators.map(i => i.signal)
  let nudgeType: NudgeType

  if (level === 'severe') {
    // Severe struggle - suggest asking for help
    nudgeType = signals.includes('repeated_attempts') ? 'ask_help' : 'break_suggestion'
  } else if (level === 'moderate') {
    // Moderate struggle - offer hint or simplify
    nudgeType = signals.includes('time_exceeded') ? 'hint' : 'simplify'
  } else {
    // Mild struggle - encouragement or gentle hint
    nudgeType = activity.attempts > 0 ? 'hint' : 'encouragement'
  }

  // Get random nudge of this type
  const nudgeOptions = NUDGES[nudgeType]
  const nudge = nudgeOptions[Math.floor(Math.random() * nudgeOptions.length)]

  return {
    shouldShowNudge: true,
    nudgeType,
    nudgeMessage: nudge.message,
  }
}

/**
 * Get the nudge to display
 */
export function getNudge(nudgeType: NudgeType): Nudge {
  const nudgeOptions = NUDGES[nudgeType]
  return nudgeOptions[Math.floor(Math.random() * nudgeOptions.length)]
}

// ============================================
// ACTIVITY TRACKING
// ============================================

const ACTIVITY_STORAGE_KEY = 'clerva_step_activity'

/**
 * Get or create step activity tracking
 */
export function getStepActivity(stepId: string, estimatedMinutes: number): StepActivity {
  if (typeof window === 'undefined') {
    return createNewActivity(stepId, estimatedMinutes)
  }

  try {
    const stored = localStorage.getItem(ACTIVITY_STORAGE_KEY)
    if (!stored) {
      return createNewActivity(stepId, estimatedMinutes)
    }

    const activities: Record<string, StepActivity> = JSON.parse(stored)
    const existing = activities[stepId]

    if (existing) {
      // Update view count and last viewed
      existing.viewCount += 1
      existing.lastViewedAt = Date.now()
      saveStepActivity(existing)
      return existing
    }

    return createNewActivity(stepId, estimatedMinutes)
  } catch {
    return createNewActivity(stepId, estimatedMinutes)
  }
}

function createNewActivity(stepId: string, estimatedMinutes: number): StepActivity {
  const activity: StepActivity = {
    stepId,
    startedAt: Date.now(),
    estimatedMinutes,
    viewCount: 1,
    totalTimeSpent: 0,
    lastViewedAt: Date.now(),
    attempts: 0,
    lastAttemptSuccess: null,
  }
  saveStepActivity(activity)
  return activity
}

/**
 * Save step activity
 */
export function saveStepActivity(activity: StepActivity): void {
  if (typeof window === 'undefined') return

  try {
    const stored = localStorage.getItem(ACTIVITY_STORAGE_KEY)
    const activities: Record<string, StepActivity> = stored ? JSON.parse(stored) : {}
    activities[activity.stepId] = activity
    localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(activities))
  } catch {
    // Ignore storage errors
  }
}

/**
 * Update activity when user leaves a step (to track time spent)
 */
export function updateActivityTimeSpent(stepId: string): void {
  if (typeof window === 'undefined') return

  try {
    const stored = localStorage.getItem(ACTIVITY_STORAGE_KEY)
    if (!stored) return

    const activities: Record<string, StepActivity> = JSON.parse(stored)
    const activity = activities[stepId]
    if (!activity) return

    // Add time since last viewed
    const additionalMinutes = (Date.now() - activity.lastViewedAt) / (1000 * 60)
    activity.totalTimeSpent += additionalMinutes

    saveStepActivity(activity)
  } catch {
    // Ignore errors
  }
}

/**
 * Record an attempt on a step
 */
export function recordAttempt(stepId: string, success: boolean): void {
  if (typeof window === 'undefined') return

  try {
    const stored = localStorage.getItem(ACTIVITY_STORAGE_KEY)
    if (!stored) return

    const activities: Record<string, StepActivity> = JSON.parse(stored)
    const activity = activities[stepId]
    if (!activity) return

    activity.attempts += 1
    activity.lastAttemptSuccess = success

    saveStepActivity(activity)
  } catch {
    // Ignore errors
  }
}

/**
 * Clear activity for a completed step
 */
export function clearStepActivity(stepId: string): void {
  if (typeof window === 'undefined') return

  try {
    const stored = localStorage.getItem(ACTIVITY_STORAGE_KEY)
    if (!stored) return

    const activities: Record<string, StepActivity> = JSON.parse(stored)
    delete activities[stepId]
    localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(activities))
  } catch {
    // Ignore errors
  }
}

/**
 * Check if enough time has passed since last nudge
 */
export function canShowNudge(lastNudgeAt: number | null): boolean {
  if (!lastNudgeAt) return true
  return Date.now() - lastNudgeAt >= STRUGGLE_THRESHOLDS.nudgeCooldown
}
