/**
 * Milestone Definitions for CLERVA
 *
 * Milestones are achievements users earn through learning activity.
 * They provide validation and motivation without distracting from learning.
 *
 * Categories:
 * - STREAK: Consecutive days of activity
 * - XP: Total points earned
 * - SESSIONS: Number of help sessions completed
 * - MASTERY: Learning-specific achievements
 */

export type MilestoneCategory = 'streak' | 'xp' | 'sessions' | 'mastery'

export interface MilestoneDefinition {
  id: string
  name: string
  description: string
  category: MilestoneCategory
  requirement: number
  icon: string // emoji for simple display
  xpBonus: number // bonus XP awarded when milestone is reached
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
}

export interface UserMilestone {
  id: string
  definitionId: string
  earnedAt: Date
  definition: MilestoneDefinition
}

// All milestone definitions - ordered by requirement within category
export const MILESTONES: MilestoneDefinition[] = [
  // ========== STREAK MILESTONES ==========
  {
    id: 'streak_3',
    name: 'Getting Started',
    description: '3-day study streak',
    category: 'streak',
    requirement: 3,
    icon: '🔥',
    xpBonus: 15,
    rarity: 'common',
  },
  {
    id: 'streak_7',
    name: 'Week Warrior',
    description: '7-day study streak',
    category: 'streak',
    requirement: 7,
    icon: '🔥',
    xpBonus: 50,
    rarity: 'rare',
  },
  {
    id: 'streak_14',
    name: 'Habit Builder',
    description: '14-day study streak',
    category: 'streak',
    requirement: 14,
    icon: '💪',
    xpBonus: 100,
    rarity: 'rare',
  },
  {
    id: 'streak_30',
    name: 'Monthly Master',
    description: '30-day study streak',
    category: 'streak',
    requirement: 30,
    icon: '🏆',
    xpBonus: 200,
    rarity: 'epic',
  },
  {
    id: 'streak_100',
    name: 'Century Club',
    description: '100-day study streak',
    category: 'streak',
    requirement: 100,
    icon: '👑',
    xpBonus: 500,
    rarity: 'legendary',
  },

  // ========== XP MILESTONES ==========
  {
    id: 'xp_50',
    name: 'First Steps',
    description: 'Earn 50 XP',
    category: 'xp',
    requirement: 50,
    icon: '⭐',
    xpBonus: 10,
    rarity: 'common',
  },
  {
    id: 'xp_100',
    name: 'Rising Star',
    description: 'Earn 100 XP',
    category: 'xp',
    requirement: 100,
    icon: '⭐',
    xpBonus: 20,
    rarity: 'common',
  },
  {
    id: 'xp_250',
    name: 'Knowledge Seeker',
    description: 'Earn 250 XP',
    category: 'xp',
    requirement: 250,
    icon: '🌟',
    xpBonus: 50,
    rarity: 'rare',
  },
  {
    id: 'xp_500',
    name: 'Dedicated Learner',
    description: 'Earn 500 XP',
    category: 'xp',
    requirement: 500,
    icon: '🌟',
    xpBonus: 100,
    rarity: 'rare',
  },
  {
    id: 'xp_1000',
    name: 'Scholar',
    description: 'Earn 1,000 XP',
    category: 'xp',
    requirement: 1000,
    icon: '🎓',
    xpBonus: 200,
    rarity: 'epic',
  },
  {
    id: 'xp_2500',
    name: 'Academic',
    description: 'Earn 2,500 XP',
    category: 'xp',
    requirement: 2500,
    icon: '🎓',
    xpBonus: 400,
    rarity: 'epic',
  },
  {
    id: 'xp_5000',
    name: 'Grandmaster',
    description: 'Earn 5,000 XP',
    category: 'xp',
    requirement: 5000,
    icon: '👑',
    xpBonus: 750,
    rarity: 'legendary',
  },

  // ========== SESSION MILESTONES ==========
  {
    id: 'sessions_5',
    name: 'Curious Mind',
    description: 'Complete 5 help sessions',
    category: 'sessions',
    requirement: 5,
    icon: '💡',
    xpBonus: 15,
    rarity: 'common',
  },
  {
    id: 'sessions_25',
    name: 'Question Asker',
    description: 'Complete 25 help sessions',
    category: 'sessions',
    requirement: 25,
    icon: '💡',
    xpBonus: 50,
    rarity: 'rare',
  },
  {
    id: 'sessions_100',
    name: 'Knowledge Hunter',
    description: 'Complete 100 help sessions',
    category: 'sessions',
    requirement: 100,
    icon: '🧠',
    xpBonus: 150,
    rarity: 'epic',
  },
  {
    id: 'sessions_500',
    name: 'Learning Legend',
    description: 'Complete 500 help sessions',
    category: 'sessions',
    requirement: 500,
    icon: '🏅',
    xpBonus: 500,
    rarity: 'legendary',
  },

  // ========== MASTERY MILESTONES ==========
  {
    id: 'mastery_first_explain',
    name: 'First Light',
    description: 'Complete your first Explain Pack',
    category: 'mastery',
    requirement: 1,
    icon: '💡',
    xpBonus: 5,
    rarity: 'common',
  },
  {
    id: 'mastery_first_flashcard',
    name: 'Card Starter',
    description: 'Complete your first Test Prep',
    category: 'mastery',
    requirement: 1,
    icon: '🎴',
    xpBonus: 5,
    rarity: 'common',
  },
  {
    id: 'mastery_first_guide',
    name: 'Path Finder',
    description: 'Complete your first Guide Me',
    category: 'mastery',
    requirement: 1,
    icon: '🗺️',
    xpBonus: 5,
    rarity: 'common',
  },
]

// Helper: Get milestone by ID
export function getMilestoneById(id: string): MilestoneDefinition | undefined {
  return MILESTONES.find(m => m.id === id)
}

// Helper: Get milestones by category
export function getMilestonesByCategory(category: MilestoneCategory): MilestoneDefinition[] {
  return MILESTONES.filter(m => m.category === category)
}

// Helper: Get next milestone for a category given current value
export function getNextMilestone(
  category: MilestoneCategory,
  currentValue: number,
  earnedMilestoneIds: string[]
): MilestoneDefinition | null {
  const categoryMilestones = getMilestonesByCategory(category)
    .filter(m => !earnedMilestoneIds.includes(m.id))
    .sort((a, b) => a.requirement - b.requirement)

  return categoryMilestones.find(m => m.requirement > currentValue) || null
}

// Helper: Check which milestones are newly earned
export function checkNewMilestones(
  stats: {
    streak: number
    totalXp: number
    totalSessions: number
    hasExplainPack: boolean
    hasFlashcard: boolean
    hasGuide: boolean
  },
  alreadyEarnedIds: string[]
): MilestoneDefinition[] {
  const newlyEarned: MilestoneDefinition[] = []

  for (const milestone of MILESTONES) {
    // Skip if already earned
    if (alreadyEarnedIds.includes(milestone.id)) continue

    let earned = false

    switch (milestone.category) {
      case 'streak':
        earned = stats.streak >= milestone.requirement
        break
      case 'xp':
        earned = stats.totalXp >= milestone.requirement
        break
      case 'sessions':
        earned = stats.totalSessions >= milestone.requirement
        break
      case 'mastery':
        if (milestone.id === 'mastery_first_explain') {
          earned = stats.hasExplainPack
        } else if (milestone.id === 'mastery_first_flashcard') {
          earned = stats.hasFlashcard
        } else if (milestone.id === 'mastery_first_guide') {
          earned = stats.hasGuide
        }
        break
    }

    if (earned) {
      newlyEarned.push(milestone)
    }
  }

  return newlyEarned
}

// Helper: Calculate XP progress to next level
export function calculateXpProgress(currentXp: number): {
  currentLevel: number
  xpForCurrentLevel: number
  xpForNextLevel: number
  progressPercent: number
  xpNeeded: number
} {
  // Simple level formula: Level = floor(sqrt(XP / 25))
  // Level 1: 25 XP, Level 2: 100 XP, Level 3: 225 XP, etc.
  const currentLevel = Math.max(1, Math.floor(Math.sqrt(currentXp / 25)))
  const xpForCurrentLevel = currentLevel * currentLevel * 25
  const xpForNextLevel = (currentLevel + 1) * (currentLevel + 1) * 25

  const xpIntoLevel = currentXp - xpForCurrentLevel
  const xpNeededForLevel = xpForNextLevel - xpForCurrentLevel
  const progressPercent = Math.min(100, Math.floor((xpIntoLevel / xpNeededForLevel) * 100))
  const xpNeeded = xpForNextLevel - currentXp

  return {
    currentLevel,
    xpForCurrentLevel,
    xpForNextLevel,
    progressPercent,
    xpNeeded,
  }
}

// Rarity colors for UI
export const RARITY_COLORS = {
  common: {
    bg: 'bg-neutral-100 dark:bg-neutral-800',
    border: 'border-neutral-300 dark:border-neutral-600',
    text: 'text-neutral-700 dark:text-neutral-300',
  },
  rare: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-300 dark:border-blue-700',
    text: 'text-blue-700 dark:text-blue-300',
  },
  epic: {
    bg: 'bg-purple-50 dark:bg-purple-900/20',
    border: 'border-purple-300 dark:border-purple-700',
    text: 'text-purple-700 dark:text-purple-300',
  },
  legendary: {
    bg: 'bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20',
    border: 'border-yellow-400 dark:border-yellow-600',
    text: 'text-yellow-700 dark:text-yellow-300',
  },
}
