/**
 * Dashboard Utility Functions
 * Helper functions used across dashboard components
 */

import type { DaysRemaining, LevelData } from './types'

/**
 * Calculate days remaining until deadline
 */
export function getDaysRemaining(targetDate: string | undefined): DaysRemaining | null {
  if (!targetDate) return null

  const target = new Date(targetDate)
  const now = new Date()
  const diffTime = target.getTime() - now.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays < 0) {
    return { days: 0, isUrgent: true, display: 'Overdue' }
  }

  if (diffDays === 0) {
    return { days: 0, isUrgent: true, display: 'Due today' }
  }

  if (diffDays === 1) {
    return { days: 1, isUrgent: true, display: 'Due tomorrow' }
  }

  return {
    days: diffDays,
    isUrgent: diffDays <= 3,
    display: `${diffDays} days left`,
  }
}

/**
 * Calculate level from XP (100 XP per level, increasing by 50 each level)
 */
export function calculateLevel(xp: number): LevelData {
  let level = 1
  let remainingXP = xp
  let xpNeeded = 100

  while (remainingXP >= xpNeeded) {
    remainingXP -= xpNeeded
    level++
    xpNeeded = 100 + (level - 1) * 50 // Each level requires 50 more XP
  }

  return {
    level,
    currentXP: remainingXP,
    xpForNextLevel: xpNeeded,
    progress: (remainingXP / xpNeeded) * 100,
  }
}

/**
 * Get label for input type based on URL
 */
export function getInputTypeLabel(url: string): string {
  if (url.includes('youtube') || url.includes('youtu.be')) {
    return 'YouTube Video'
  }
  if (url.endsWith('.pdf')) {
    return 'PDF Document'
  }
  return 'Web Link'
}

// Quick suggestions for new users
export const QUICK_SUGGESTIONS = [
  { label: 'Learn a new skill', goal: 'Learn ' },
  { label: 'Pass an exam', goal: 'Pass my ' },
  { label: 'Master a topic', goal: 'Master ' },
  { label: 'Build something', goal: 'Build a ' },
]
