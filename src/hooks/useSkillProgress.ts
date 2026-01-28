/**
 * SKILL PROGRESS HOOK
 *
 * Extracts visceral progress data from the active roadmap.
 * Converts step completion data into "abilities unlocked" format
 * that shows users what they CAN DO NOW that they couldn't before.
 *
 * Philosophy:
 * - "Step 2/5 complete" = Numbers that mean nothing
 * - "You can now write basic loops" = Actual progress they can feel
 */

import { useMemo } from 'react'
import type { RoadmapStep } from './useActiveRoadmap'

// ============================================
// TYPES
// ============================================

export interface UnlockedAbility {
  text: string
  unlockedAt: Date | null
  stepTitle: string
  isNew: boolean
}

export interface CurrentAbility {
  text: string
  progress: number // 0-100
  stepTitle: string
}

export interface NextAbility {
  text: string
  stepTitle: string
}

export interface SkillProgress {
  // All abilities unlocked from completed steps
  unlockedAbilities: UnlockedAbility[]
  // Current ability being learned (from current step)
  currentAbility: CurrentAbility | undefined
  // Preview of next ability (from locked steps)
  nextAbility: NextAbility | undefined
  // Summary stats
  totalAbilitiesUnlocked: number
  totalAbilitiesPossible: number
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if a date is within the last 24 hours
 */
function isWithinLast24Hours(date: Date | string | null): boolean {
  if (!date) return false
  const dateObj = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  return dateObj > yesterday
}

/**
 * Calculate task completion progress for a step
 */
function calculateStepProgress(step: RoadmapStep): number {
  if (!step.microTasks || step.microTasks.length === 0) {
    // No micro-tasks - use binary complete/not complete
    return step.status === 'completed' ? 100 : 0
  }

  const completedTasks = step.microTasks.filter(
    t => t.status === 'COMPLETED' || t.status === 'SKIPPED'
  ).length
  return Math.round((completedTasks / step.microTasks.length) * 100)
}

/**
 * Extract primary ability from a step
 * Uses abilities array if available, otherwise generates from title
 */
function extractPrimaryAbility(step: RoadmapStep): string {
  if (step.abilities && step.abilities.length > 0) {
    return step.abilities[0]
  }
  // Fallback: Generate from title
  // "Master JavaScript Variables" -> "Can work with JavaScript Variables"
  const title = step.title.replace(/^(Master|Learn|Understand|Study)\s+/i, '')
  return `Can work with ${title}`
}

/**
 * Extract preview ability from a locked step
 */
function extractPreviewAbility(step: RoadmapStep): string {
  if (step.previewAbilities && step.previewAbilities.length > 0) {
    return step.previewAbilities[0]
  }
  if (step.abilities && step.abilities.length > 0) {
    return step.abilities[0]
  }
  // Fallback
  return `Master ${step.title}`
}

// ============================================
// MAIN HOOK
// ============================================

export function useSkillProgress(steps: RoadmapStep[] | undefined): SkillProgress {
  return useMemo(() => {
    const emptyResult: SkillProgress = {
      unlockedAbilities: [],
      currentAbility: undefined,
      nextAbility: undefined,
      totalAbilitiesUnlocked: 0,
      totalAbilitiesPossible: 0,
    }

    if (!steps || steps.length === 0) {
      return emptyResult
    }

    const unlockedAbilities: UnlockedAbility[] = []
    let currentAbility: CurrentAbility | undefined
    let nextAbility: NextAbility | undefined
    let totalAbilitiesPossible = 0

    // Sort steps by order
    const sortedSteps = [...steps].sort((a, b) => a.order - b.order)

    sortedSteps.forEach((step, index) => {
      // Count total possible abilities
      const stepAbilityCount = step.abilities?.length || 1
      totalAbilitiesPossible += stepAbilityCount

      if (step.status === 'completed') {
        // Extract all abilities from completed steps
        const abilities = step.abilities && step.abilities.length > 0
          ? step.abilities
          : [extractPrimaryAbility(step)]

        abilities.forEach(abilityText => {
          unlockedAbilities.push({
            text: abilityText,
            unlockedAt: step.completedAt ? new Date(step.completedAt) : null,
            stepTitle: step.title,
            isNew: isWithinLast24Hours(step.completedAt || null),
          })
        })
      } else if (step.status === 'current' && !currentAbility) {
        // Current step - show what they're learning
        const progress = calculateStepProgress(step)
        const abilityText = extractPrimaryAbility(step)
        currentAbility = {
          text: abilityText,
          progress,
          stepTitle: step.title,
        }
      } else if (step.status === 'locked' && !nextAbility) {
        // First locked step - preview what's coming
        const abilityText = extractPreviewAbility(step)
        nextAbility = {
          text: abilityText,
          stepTitle: step.title,
        }
      }
    })

    return {
      unlockedAbilities,
      currentAbility,
      nextAbility,
      totalAbilitiesUnlocked: unlockedAbilities.length,
      totalAbilitiesPossible,
    }
  }, [steps])
}

export default useSkillProgress
