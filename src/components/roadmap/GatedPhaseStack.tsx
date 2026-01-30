'use client'

/**
 * GATED PHASE STACK
 *
 * A training system visualization that communicates:
 * - Gates (you earn access, not scroll to it)
 * - Standards (pass/fail criteria are real)
 * - Focus (one gate at a time)
 * - Identity progression (who you become, not what you finish)
 *
 * Design principles:
 * - No progress bars
 * - No day counters
 * - No checkmarks per task
 * - No "estimated time to finish"
 * - Time is secondary, readiness is primary
 *
 * Visual language:
 * - Typography > color
 * - Neutral colors (gray, black, subtle accent)
 * - Space is authority
 * - Fewer elements than expected
 */

import { useState } from 'react'
import { Lock, ChevronDown, AlertTriangle } from 'lucide-react'
import { CurrentGateDetail } from './CurrentGateDetail'
import { LockedGatePreview } from './LockedGatePreview'

// ============================================
// TYPES
// ============================================

interface StepResource {
  type: string
  title: string
  description?: string
  searchQuery?: string
  platformId?: string
  platformName?: string
  directUrl?: string
}

interface FailureCondition {
  condition: string
  consequence?: string
}

interface TrainingLoop {
  input: string
  output: string
  constraint: string
  validation: string
}

export interface GateStep {
  id: string
  order: number
  title: string
  description: string
  isLocked: boolean
  isCompleted?: boolean
  isCurrent?: boolean
  phase?: string

  // NEW: Today's Focus (primary action)
  todaysFocus?: {
    action: string
    where: string
    duration: string
    output: string
  }

  // NEW: Personalized why
  whyThisMattersForYou?: string

  // NEW: Exit conditions (checkboxes)
  exitConditions?: string[]

  // NEW: Common trap (warm mentor voice)
  commonTrap?: {
    temptation: string
    whyItFeelsRight: string
    whyItFails: string
    betterApproach: string
  }

  // NEW: Encouragement
  encouragement?: string

  // Gate-specific fields
  failureToEliminate?: string // What failure mode this gate removes
  capability?: string // What you CAN DO after passing
  identityBefore?: string // Who you are before
  identityAfter?: string // Who you become after

  // Standards
  passCondition?: string
  failConditions?: FailureCondition[] | string[]
  repeatInstruction?: string

  // ELITE: Enhanced Standards & Bars
  standards?: {
    passBar: string
    failConditions: string[]
    repeatRule: string
    qualityCheck: string
  }

  // Training loop
  trainingLoop?: TrainingLoop
  method?: string

  // Common mistakes with consequences
  commonMistakes?: { trap: string; consequence: string }[] | string[]

  // ELITE: Fake Progress Warnings
  fakeProgressWarnings?: string[]

  // Self test
  selfTest?: { challenge: string; passCriteria: string; failCriteria?: string }

  // ELITE: What Success Feels Like
  successSignals?: {
    feelsLike: string
    youllKnow?: string
    behaviorChange?: string
    confidenceMarker?: string
  }

  // Abilities unlocked
  abilities?: string[]
  previewAbilities?: string[]

  // Why this gate
  whyFirst?: string
  whyAfterPrevious?: string

  // Resources (curated, opinionated)
  resources?: StepResource[]

  // Risk warning
  risk?: { warning: string; consequence: string; severity: string }

  // Duration (secondary, not prominent)
  duration?: number
  timeframe?: string

  // Teaser for locked gates
  teaser?: string
}

interface GatedPhaseStackProps {
  roadmapId: string
  gates: GateStep[]
  currentGateIndex: number
  completedGateIds: string[]
  title: string
  // Identity goal
  identityGoal?: string // Who user becomes after completing all gates
  // Critical warning
  criticalWarning?: { warning: string; consequence: string }
  // Handlers
  onGateClick?: (gateId: string) => void
  onComplete?: (gateId: string) => void
  onResourceClick?: (resource: StepResource, gateId: string) => void
}

// ============================================
// MAIN COMPONENT
// ============================================

export function GatedPhaseStack({
  roadmapId,
  gates,
  currentGateIndex,
  completedGateIds,
  title,
  identityGoal,
  criticalWarning,
  onGateClick,
  onComplete,
  onResourceClick,
}: GatedPhaseStackProps) {
  const [expandedGateId, setExpandedGateId] = useState<string | null>(
    gates[currentGateIndex]?.id || null
  )

  const currentGate = gates[currentGateIndex]
  const lockedGates = gates.filter((_, i) => i > currentGateIndex)
  const completedGates = gates.filter(g => completedGateIds.includes(g.id))

  const handleGateClick = (gateId: string) => {
    setExpandedGateId(expandedGateId === gateId ? null : gateId)
    onGateClick?.(gateId)
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Identity Goal Header */}
      <div className="mb-8">
        <div className="text-xs font-medium tracking-widest text-neutral-400 uppercase mb-2">
          Training Program
        </div>
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
          {title}
        </h1>
        {identityGoal && (
          <div className="mt-4 py-4 border-t border-b border-neutral-200 dark:border-neutral-800">
            <div className="text-xs font-medium tracking-widest text-neutral-400 uppercase mb-2">
              After completing this program, you become
            </div>
            <p className="text-lg font-medium text-neutral-800 dark:text-neutral-200">
              {identityGoal}
            </p>
          </div>
        )}
      </div>

      {/* Critical Warning */}
      {criticalWarning && (
        <div className="mb-6 p-4 bg-neutral-50 dark:bg-neutral-900 border-l-4 border-neutral-400 dark:border-neutral-600">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-neutral-500 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                {criticalWarning.warning}
              </div>
              <div className="text-xs text-neutral-500">
                {criticalWarning.consequence}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Completed Gates (collapsed) */}
      {completedGates.length > 0 && (
        <div className="mb-6">
          <div className="text-xs font-medium tracking-widest text-neutral-400 uppercase mb-3">
            Passed ({completedGates.length})
          </div>
          <div className="space-y-2">
            {completedGates.map((gate) => (
              <div
                key={gate.id}
                className="p-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-neutral-400 uppercase tracking-wider mb-0.5">
                      Gate {gate.order}
                    </div>
                    <div className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                      {gate.title}
                    </div>
                  </div>
                  {gate.identityAfter && (
                    <div className="text-xs text-neutral-400 italic">
                      → {gate.identityAfter}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Current Gate (expanded, full detail) */}
      {currentGate && (
        <div className="mb-8">
          <div className="text-xs font-medium tracking-widest text-neutral-400 uppercase mb-3">
            Current Gate
          </div>
          <CurrentGateDetail
            gate={currentGate}
            roadmapId={roadmapId}
            isExpanded={expandedGateId === currentGate.id}
            onToggle={() => handleGateClick(currentGate.id)}
            onComplete={() => onComplete?.(currentGate.id)}
            onResourceClick={(resource) => onResourceClick?.(resource, currentGate.id)}
          />
        </div>
      )}

      {/* Locked Gates (previews only) */}
      {lockedGates.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Lock className="w-4 h-4 text-neutral-400" />
            <div className="text-xs font-medium tracking-widest text-neutral-400 uppercase">
              Locked ({lockedGates.length} remaining)
            </div>
          </div>
          <div className="space-y-3">
            {lockedGates.map((gate, index) => (
              <LockedGatePreview
                key={gate.id}
                gate={gate}
                gateNumber={currentGateIndex + index + 2}
                previousGateTitle={index === 0 ? currentGate?.title : lockedGates[index - 1]?.title}
              />
            ))}
          </div>
        </div>
      )}

      {/* System View Toggle (optional, read-only) */}
      <div className="mt-8 pt-6 border-t border-neutral-200 dark:border-neutral-800">
        <button
          onClick={() => {/* Toggle system view */}}
          className="flex items-center gap-2 text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
        >
          <ChevronDown className="w-4 h-4" />
          <span>View full training structure</span>
        </button>
      </div>
    </div>
  )
}

export default GatedPhaseStack
