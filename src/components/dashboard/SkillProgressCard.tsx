'use client'

/**
 * Skill Progress Card Component
 *
 * Shows VISCERAL progress - what the user CAN DO NOW that they couldn't before.
 * Not just numbers, but actual abilities gained.
 *
 * Philosophy:
 * - "Step 2/5 complete" tells nothing about growth
 * - "You can now write basic loops" tells everything about growth
 *
 * This component shows:
 * 1. Abilities unlocked from completed steps
 * 2. Current ability in progress
 * 3. What's coming next (motivation)
 */

import { memo, useMemo } from 'react'
import {
  CheckCircle2,
  Zap,
  Lock,
  TrendingUp,
  Sparkles,
  ChevronRight,
} from 'lucide-react'

// ============================================
// TYPES
// ============================================

interface Ability {
  text: string
  unlockedAt: Date | null
  stepTitle: string
  isNew?: boolean // Unlocked in last 24 hours
}

interface SkillProgressCardProps {
  // Unlocked abilities from completed steps
  unlockedAbilities: Ability[]
  // Current ability being learned
  currentAbility?: {
    text: string
    progress: number // 0-100
    stepTitle: string
  }
  // Preview of next ability
  nextAbility?: {
    text: string
    stepTitle: string
  }
  // Roadmap title for context
  roadmapTitle: string
  // Total progress
  completedSteps: number
  totalSteps: number
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function isWithinLast24Hours(date: Date | null): boolean {
  if (!date) return false
  const now = new Date()
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  return new Date(date) > yesterday
}

// ============================================
// SUB-COMPONENTS
// ============================================

const UnlockedAbility = memo(function UnlockedAbility({
  ability,
  index,
}: {
  ability: Ability
  index: number
}) {
  const isRecent = ability.isNew || isWithinLast24Hours(ability.unlockedAt)

  return (
    <div
      className={`
        flex items-start gap-3 p-3 rounded-lg
        ${isRecent
          ? 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border border-green-200 dark:border-green-800'
          : 'bg-neutral-50 dark:bg-neutral-800/50'
        }
      `}
    >
      <div
        className={`
          flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center
          ${isRecent ? 'bg-green-500' : 'bg-green-400'}
        `}
      >
        <CheckCircle2 className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${isRecent ? 'text-green-800 dark:text-green-200' : 'text-neutral-700 dark:text-neutral-300'}`}>
          {ability.text}
        </p>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
          From: {ability.stepTitle}
        </p>
      </div>
      {isRecent && (
        <span className="flex-shrink-0 px-2 py-0.5 bg-green-500 text-white text-[10px] font-bold rounded-full uppercase">
          New!
        </span>
      )}
    </div>
  )
})

const CurrentAbility = memo(function CurrentAbility({
  ability,
}: {
  ability: SkillProgressCardProps['currentAbility']
}) {
  if (!ability) return null

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
          <Zap className="w-4 h-4 text-white animate-pulse" />
        </div>
        <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide">
          Learning Now
        </span>
      </div>
      <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
        {ability.text}
      </p>
      {/* Progress bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-blue-200 dark:bg-blue-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-500"
            style={{ width: `${ability.progress}%` }}
          />
        </div>
        <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
          {ability.progress}%
        </span>
      </div>
      <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
        {ability.stepTitle}
      </p>
    </div>
  )
})

const NextAbility = memo(function NextAbility({
  ability,
}: {
  ability: SkillProgressCardProps['nextAbility']
}) {
  if (!ability) return null

  return (
    <div className="bg-neutral-100 dark:bg-neutral-800/80 rounded-lg p-3 border border-neutral-200 dark:border-neutral-700 opacity-70">
      <div className="flex items-center gap-2 mb-1">
        <Lock className="w-4 h-4 text-neutral-400" />
        <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
          Coming Up
        </span>
      </div>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        {ability.text}
      </p>
      <p className="text-xs text-neutral-500 mt-1">
        After: {ability.stepTitle}
      </p>
    </div>
  )
})

// ============================================
// MAIN COMPONENT
// ============================================

export const SkillProgressCard = memo(function SkillProgressCard({
  unlockedAbilities,
  currentAbility,
  nextAbility,
  roadmapTitle,
  completedSteps,
  totalSteps,
}: SkillProgressCardProps) {
  // Calculate summary stats
  const summaryText = useMemo(() => {
    const count = unlockedAbilities.length
    if (count === 0) return 'Start your journey to unlock abilities'
    if (count === 1) return 'You\'ve unlocked your first ability!'
    if (count < 5) return `You can now do ${count} things you couldn\'t before`
    return `${count} abilities unlocked - you're growing fast!`
  }, [unlockedAbilities.length])

  // Only show if there's progress to display
  if (unlockedAbilities.length === 0 && !currentAbility) {
    return null
  }

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-neutral-100 dark:border-neutral-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900 dark:text-white text-sm">
                Your Progress
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {roadmapTitle}
              </p>
            </div>
          </div>
          <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded-full">
            {completedSteps}/{totalSteps} steps
          </span>
        </div>

        {/* Summary text */}
        <div className="mt-3 flex items-center gap-2 text-sm text-purple-600 dark:text-purple-400">
          <Sparkles className="w-4 h-4" />
          <span className="font-medium">{summaryText}</span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Current ability in progress */}
        <CurrentAbility ability={currentAbility} />

        {/* Unlocked abilities */}
        {unlockedAbilities.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              What You Can Do Now
            </h4>
            <div className="space-y-2">
              {/* Show last 3 abilities, newest first */}
              {unlockedAbilities.slice(-3).reverse().map((ability, index) => (
                <UnlockedAbility key={index} ability={ability} index={index} />
              ))}
              {/* Show "more" button if there are hidden abilities */}
              {unlockedAbilities.length > 3 && (
                <button className="w-full flex items-center justify-center gap-1 py-2 text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors">
                  <span>+{unlockedAbilities.length - 3} more abilities</span>
                  <ChevronRight className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Next ability preview */}
        <NextAbility ability={nextAbility} />
      </div>
    </div>
  )
})

export default SkillProgressCard
