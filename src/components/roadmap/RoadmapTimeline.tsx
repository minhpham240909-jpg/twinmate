'use client'

/**
 * ROADMAP TIMELINE COMPONENT
 *
 * A beautiful vertical timeline visualization of the learning roadmap.
 * Shows progress, step status, and key information at a glance.
 *
 * Features:
 * - Visual progress line
 * - Step status indicators (done/current/locked)
 * - Expandable step details
 * - Time estimates and abilities preview
 * - Responsive design
 * - Phase support (NOW/NEXT/LATER)
 * - Milestone banners
 */

import React, { useState } from 'react'
import {
  CheckCircle,
  Circle,
  Lock,
  ChevronDown,
  ChevronUp,
  Clock,
  Target,
  AlertTriangle,
  Zap,
  BookOpen,
  ExternalLink,
} from 'lucide-react'
import { StepMicroActions } from './StepMicroActions'

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

// Phase types for roadmap organization
type RoadmapPhase = 'NOW' | 'NEXT' | 'LATER'

interface EnhancedStep {
  id: string
  order: number
  duration?: number
  timeframe?: string
  title: string
  description: string
  method?: string
  avoid?: string
  doneWhen?: string
  isLocked: boolean
  resources?: StepResource[]
  risk?: { warning: string; consequence: string; severity: string }
  // Enhanced fields
  whyFirst?: string
  timeBreakdown?: { daily: string; total: string; flexible: string }
  commonMistakes?: string[]
  selfTest?: { challenge: string; passCriteria: string }
  abilities?: string[]
  whyAfterPrevious?: string
  previewAbilities?: string[]
  // Phase and milestone support
  phase?: RoadmapPhase
  milestone?: string
}

interface RoadmapTimelineProps {
  roadmapId: string
  steps: EnhancedStep[]
  currentStepIndex: number
  completedStepIds: string[]
  title: string
  overview?: string
  estimatedDays?: number
  dailyCommitment?: string
  totalMinutes?: number
  successLooksLike?: string
  // New: vision and meta fields
  vision?: string
  successMetrics?: string[]
  onStepClick?: (stepId: string) => void
  onResourceClick?: (resource: StepResource) => void
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getStepStatus(
  step: EnhancedStep,
  index: number,
  currentIndex: number,
  completedIds: string[]
): 'completed' | 'current' | 'locked' {
  if (completedIds.includes(step.id)) return 'completed'
  if (index === currentIndex) return 'current'
  return 'locked'
}

function getStatusColor(status: 'completed' | 'current' | 'locked'): string {
  switch (status) {
    case 'completed':
      return 'bg-green-500'
    case 'current':
      return 'bg-blue-500'
    case 'locked':
      return 'bg-neutral-300 dark:bg-neutral-600'
  }
}

function getStatusIcon(status: 'completed' | 'current' | 'locked') {
  switch (status) {
    case 'completed':
      return <CheckCircle className="w-5 h-5 text-white" />
    case 'current':
      return <Circle className="w-5 h-5 text-white fill-white" />
    case 'locked':
      return <Lock className="w-4 h-4 text-neutral-500" />
  }
}

// Phase styling helpers
function getPhaseConfig(phase: RoadmapPhase) {
  switch (phase) {
    case 'NOW':
      return {
        label: 'NOW',
        description: 'Foundation Phase',
        bgColor: 'bg-blue-100 dark:bg-blue-900/30',
        borderColor: 'border-blue-300 dark:border-blue-700',
        textColor: 'text-blue-700 dark:text-blue-300',
        badgeColor: 'bg-blue-500',
      }
    case 'NEXT':
      return {
        label: 'NEXT',
        description: 'Growth Phase',
        bgColor: 'bg-purple-100 dark:bg-purple-900/30',
        borderColor: 'border-purple-300 dark:border-purple-700',
        textColor: 'text-purple-700 dark:text-purple-300',
        badgeColor: 'bg-purple-500',
      }
    case 'LATER':
      return {
        label: 'LATER',
        description: 'Mastery Phase',
        bgColor: 'bg-amber-100 dark:bg-amber-900/30',
        borderColor: 'border-amber-300 dark:border-amber-700',
        textColor: 'text-amber-700 dark:text-amber-300',
        badgeColor: 'bg-amber-500',
      }
  }
}

// Group steps by phase
function groupStepsByPhase(steps: EnhancedStep[]): Map<RoadmapPhase | 'default', EnhancedStep[]> {
  const groups = new Map<RoadmapPhase | 'default', EnhancedStep[]>()

  steps.forEach(step => {
    const phase = step.phase || 'default'
    if (!groups.has(phase)) {
      groups.set(phase, [])
    }
    groups.get(phase)!.push(step)
  })

  return groups
}

// ============================================
// PHASE HEADER COMPONENT
// ============================================

function PhaseHeader({ phase, stepCount, completedCount }: {
  phase: RoadmapPhase
  stepCount: number
  completedCount: number
}) {
  const config = getPhaseConfig(phase)
  const isComplete = completedCount === stepCount

  return (
    <div className={`
      mb-4 p-3 rounded-lg border-2 ${config.bgColor} ${config.borderColor}
      flex items-center justify-between
    `}>
      <div className="flex items-center gap-3">
        <div className={`
          px-3 py-1 rounded-full text-xs font-bold text-white ${config.badgeColor}
        `}>
          {config.label}
        </div>
        <div>
          <span className={`text-sm font-medium ${config.textColor}`}>
            {config.description}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {isComplete ? (
          <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-medium">
            <CheckCircle className="w-4 h-4" />
            Complete
          </span>
        ) : (
          <span className="text-xs text-neutral-500">
            {completedCount}/{stepCount} steps
          </span>
        )}
      </div>
    </div>
  )
}

// ============================================
// MILESTONE BANNER COMPONENT
// ============================================

function MilestoneBanner({ milestone, isReached }: {
  milestone: string
  isReached: boolean
}) {
  return (
    <div className={`
      relative my-4 py-3 px-4 rounded-lg border-2 border-dashed
      ${isReached
        ? 'bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border-yellow-400'
        : 'bg-neutral-50 dark:bg-neutral-800 border-neutral-300 dark:border-neutral-600'
      }
    `}>
      <div className="flex items-center gap-3">
        <div className={`
          w-8 h-8 rounded-full flex items-center justify-center
          ${isReached
            ? 'bg-yellow-400 text-yellow-900'
            : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-500'
          }
        `}>
          {isReached ? '🏆' : '🎯'}
        </div>
        <div>
          <div className={`
            text-xs font-semibold uppercase tracking-wider
            ${isReached ? 'text-yellow-700 dark:text-yellow-400' : 'text-neutral-500'}
          `}>
            {isReached ? 'Milestone Reached!' : 'Milestone'}
          </div>
          <div className={`
            text-sm font-medium
            ${isReached ? 'text-yellow-800 dark:text-yellow-300' : 'text-neutral-700 dark:text-neutral-300'}
          `}>
            {milestone}
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================
// STEP CARD COMPONENT
// ============================================

function TimelineStepCard({
  step,
  status,
  isExpanded,
  roadmapId,
  onToggle,
  onResourceClick,
}: {
  step: EnhancedStep
  status: 'completed' | 'current' | 'locked'
  isExpanded: boolean
  roadmapId: string
  onToggle: () => void
  onResourceClick?: (resource: StepResource) => void
}) {
  const isCurrent = status === 'current'
  const isCompleted = status === 'completed'
  const isLocked = status === 'locked'

  return (
    <div
      className={`
        relative rounded-xl border-2 transition-all duration-300
        ${isCurrent
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 shadow-lg shadow-blue-500/10'
          : isCompleted
          ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20'
          : 'border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 opacity-60'
        }
      `}
    >
      {/* Header - Always visible */}
      <button
        onClick={onToggle}
        disabled={isLocked}
        className={`
          w-full p-4 text-left flex items-start gap-3
          ${isLocked ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-black/5 dark:hover:bg-white/5'}
          rounded-xl transition-colors
        `}
      >
        {/* Step number badge */}
        <div
          className={`
            flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
            ${isCurrent
              ? 'bg-blue-500 text-white'
              : isCompleted
              ? 'bg-green-500 text-white'
              : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-500'
            }
          `}
        >
          {isCompleted ? '✓' : step.order}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {isCurrent && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/50 px-2 py-0.5 rounded-full">
                Current
              </span>
            )}
            {isCompleted && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/50 px-2 py-0.5 rounded-full">
                Done
              </span>
            )}
            {step.timeframe && !isLocked && (
              <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                {step.timeframe}
              </span>
            )}
          </div>

          <h4
            className={`
              font-semibold text-sm
              ${isCompleted ? 'line-through text-neutral-500' : 'text-neutral-800 dark:text-neutral-100'}
            `}
          >
            {step.title}
          </h4>

          {/* Preview for locked steps */}
          {isLocked && step.previewAbilities && step.previewAbilities.length > 0 && (
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
              You'll learn: {step.previewAbilities[0]}
            </p>
          )}

          {/* Duration for unlocked steps */}
          {!isLocked && step.duration && step.duration > 0 && (
            <div className="flex items-center gap-1 mt-1 text-xs text-neutral-500">
              <Clock className="w-3 h-3" />
              <span>{step.duration} min/day</span>
            </div>
          )}
        </div>

        {/* Expand icon */}
        {!isLocked && (
          <div className="flex-shrink-0 text-neutral-400">
            {isExpanded ? (
              <ChevronUp className="w-5 h-5" />
            ) : (
              <ChevronDown className="w-5 h-5" />
            )}
          </div>
        )}
      </button>

      {/* Expanded content */}
      {isExpanded && !isLocked && (
        <div className="px-4 pb-4 space-y-4 border-t border-neutral-200 dark:border-neutral-700 pt-4 ml-11">
          {/* Micro-actions for AI assistance */}
          <StepMicroActions
            stepId={step.id}
            roadmapId={roadmapId}
            stepTitle={step.title}
            isLocked={isLocked}
          />

          {/* Why this step */}
          {step.whyFirst && (
            <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3 border border-amber-200 dark:border-amber-800">
              <div className="flex items-center gap-2 mb-1">
                <Target className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase">
                  Why This Step First
                </span>
              </div>
              <p className="text-sm text-amber-800 dark:text-amber-200">{step.whyFirst}</p>
            </div>
          )}

          {/* Method */}
          {step.method && (
            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase">
                  Method
                </span>
              </div>
              <p className="text-sm text-blue-800 dark:text-blue-200">{step.method}</p>
            </div>
          )}

          {/* Time Breakdown */}
          {step.timeBreakdown && (
            <div className="bg-neutral-100 dark:bg-neutral-800 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-neutral-600" />
                <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase">
                  Time Commitment
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="text-center p-2 bg-white dark:bg-neutral-700 rounded">
                  <div className="font-bold text-neutral-800 dark:text-neutral-100">
                    {step.timeBreakdown.daily}
                  </div>
                  <div className="text-neutral-500">Daily</div>
                </div>
                <div className="text-center p-2 bg-white dark:bg-neutral-700 rounded">
                  <div className="font-bold text-neutral-800 dark:text-neutral-100">
                    {step.timeBreakdown.total}
                  </div>
                  <div className="text-neutral-500">Total</div>
                </div>
                <div className="text-center p-2 bg-white dark:bg-neutral-700 rounded">
                  <div className="font-bold text-neutral-800 dark:text-neutral-100">
                    {step.timeBreakdown.flexible}
                  </div>
                  <div className="text-neutral-500">Flexible</div>
                </div>
              </div>
            </div>
          )}

          {/* Common Mistakes */}
          {step.commonMistakes && step.commonMistakes.length > 0 && (
            <div className="bg-red-50 dark:bg-red-950/30 rounded-lg p-3 border border-red-200 dark:border-red-800">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <span className="text-xs font-semibold text-red-700 dark:text-red-400 uppercase">
                  Common Mistakes to Avoid
                </span>
              </div>
              <ul className="space-y-1">
                {step.commonMistakes.map((mistake, i) => (
                  <li key={i} className="text-sm text-red-800 dark:text-red-200 flex items-start gap-2">
                    <span className="text-red-500">✕</span>
                    {mistake}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Self Test */}
          {step.selfTest && (
            <div className="bg-purple-50 dark:bg-purple-950/30 rounded-lg p-3 border border-purple-200 dark:border-purple-800">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-purple-600" />
                <span className="text-xs font-semibold text-purple-700 dark:text-purple-400 uppercase">
                  Ready Check
                </span>
              </div>
              <p className="text-sm text-purple-800 dark:text-purple-200 font-medium mb-1">
                {step.selfTest.challenge}
              </p>
              <p className="text-xs text-purple-600 dark:text-purple-400">
                ✓ Pass: {step.selfTest.passCriteria}
              </p>
            </div>
          )}

          {/* Abilities Preview */}
          {step.abilities && step.abilities.length > 0 && (
            <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-3 border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-green-600" />
                <span className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase">
                  After This Step, You Can
                </span>
              </div>
              <ul className="space-y-1">
                {step.abilities.map((ability, i) => (
                  <li key={i} className="text-sm text-green-800 dark:text-green-200 flex items-start gap-2">
                    <span className="text-green-500">✓</span>
                    {ability}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Resources */}
          {step.resources && step.resources.length > 0 && (
            <div className="bg-indigo-50 dark:bg-indigo-950/30 rounded-lg p-3 border border-indigo-200 dark:border-indigo-800">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 uppercase">
                  Learning Resources
                </span>
              </div>
              <div className="space-y-2">
                {step.resources.map((resource, i) => (
                  <a
                    key={i}
                    href={resource.directUrl || `https://www.google.com/search?q=${encodeURIComponent(resource.searchQuery || resource.title)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => onResourceClick?.(resource)}
                    className="flex items-center gap-2 p-2 bg-white dark:bg-neutral-800 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors group"
                  >
                    <span className="text-lg">
                      {resource.type === 'video' ? '📺' : resource.type === 'exercise' ? '💪' : resource.type === 'tool' ? '🛠️' : '📄'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-neutral-800 dark:text-neutral-100 truncate">
                        {resource.title}
                      </div>
                      {resource.platformName && (
                        <div className="text-xs text-neutral-500">
                          on {resource.platformName}
                        </div>
                      )}
                    </div>
                    <ExternalLink className="w-4 h-4 text-neutral-400 group-hover:text-indigo-500 transition-colors" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Done When */}
          {step.doneWhen && (
            <div className="bg-neutral-100 dark:bg-neutral-800 rounded-lg p-3 border-2 border-dashed border-neutral-300 dark:border-neutral-600">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-neutral-600" />
                <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase">
                  Done When
                </span>
              </div>
              <p className="text-sm text-neutral-700 dark:text-neutral-300 mt-1">{step.doneWhen}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================
// MAIN COMPONENT
// ============================================

export function RoadmapTimeline({
  roadmapId,
  steps,
  currentStepIndex,
  completedStepIds,
  title,
  overview,
  estimatedDays,
  dailyCommitment,
  totalMinutes,
  successLooksLike,
  vision,
  successMetrics,
  onStepClick,
  onResourceClick,
}: RoadmapTimelineProps) {
  const [expandedStepId, setExpandedStepId] = useState<string | null>(
    steps[currentStepIndex]?.id || null
  )

  const completedCount = completedStepIds.length
  const progressPercent = (completedCount / steps.length) * 100

  // Group steps by phase
  const hasPhases = steps.some(s => s.phase)
  const phaseGroups = hasPhases ? groupStepsByPhase(steps) : null

  // Track milestones and their completion status
  const getMilestoneStatus = (stepIndex: number): boolean => {
    return stepIndex < currentStepIndex || completedStepIds.includes(steps[stepIndex]?.id)
  }

  // Render steps with phase headers and milestones
  const renderStepsWithPhases = () => {
    if (!phaseGroups) {
      // No phases - render flat list
      return renderStepsList(steps, 0)
    }

    const phaseOrder: (RoadmapPhase | 'default')[] = ['NOW', 'NEXT', 'LATER', 'default']
    let globalIndex = 0
    const elements: React.ReactNode[] = []

    phaseOrder.forEach(phase => {
      const phaseSteps = phaseGroups.get(phase)
      if (!phaseSteps || phaseSteps.length === 0) return

      if (phase !== 'default') {
        const phaseCompletedCount = phaseSteps.filter(s => completedStepIds.includes(s.id)).length
        elements.push(
          <PhaseHeader
            key={`phase-${phase}`}
            phase={phase as RoadmapPhase}
            stepCount={phaseSteps.length}
            completedCount={phaseCompletedCount}
          />
        )
      }

      elements.push(
        <div key={`steps-${phase}`} className="mb-6">
          {renderStepsList(phaseSteps, globalIndex)}
        </div>
      )

      globalIndex += phaseSteps.length
    })

    return elements
  }

  // Render a list of steps
  const renderStepsList = (stepsToRender: EnhancedStep[], startIndex: number) => {
    return (
      <div className="space-y-4">
        {stepsToRender.map((step, localIndex) => {
          const globalIndex = startIndex + localIndex
          const status = getStepStatus(step, globalIndex, currentStepIndex, completedStepIds)
          const isExpanded = expandedStepId === step.id

          // Check if this step has a milestone and if it's been reached
          const showMilestone = step.milestone && status === 'completed'
          const previousStep = localIndex > 0 ? stepsToRender[localIndex - 1] : null
          const showMilestoneBefore = previousStep?.milestone && getMilestoneStatus(startIndex + localIndex - 1)

          return (
            <div key={step.id}>
              {/* Show milestone banner before step if previous step had one and is complete */}
              {showMilestoneBefore && previousStep?.milestone && (
                <MilestoneBanner
                  milestone={previousStep.milestone}
                  isReached={true}
                />
              )}

              <div className="relative flex gap-4">
                {/* Timeline node */}
                <div
                  className={`
                    relative z-10 flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center
                    ${getStatusColor(status)}
                    ${status === 'current' ? 'ring-4 ring-blue-200 dark:ring-blue-800' : ''}
                    transition-all duration-300
                  `}
                >
                  {getStatusIcon(status)}
                </div>

                {/* Step card */}
                <div className="flex-1 pb-2">
                  <TimelineStepCard
                    step={step}
                    status={status}
                    isExpanded={isExpanded}
                    roadmapId={roadmapId}
                    onToggle={() => {
                      setExpandedStepId(isExpanded ? null : step.id)
                      onStepClick?.(step.id)
                    }}
                    onResourceClick={onResourceClick}
                  />
                </div>
              </div>

              {/* Show milestone at end of last step if it has one */}
              {showMilestone && localIndex === stepsToRender.length - 1 && (
                <MilestoneBanner
                  milestone={step.milestone!}
                  isReached={true}
                />
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-neutral-800 dark:text-neutral-100 mb-1">
          {title}
        </h2>
        {overview && (
          <p className="text-sm text-neutral-600 dark:text-neutral-400">{overview}</p>
        )}

        {/* Vision banner - shows WHY this journey matters */}
        {vision && (
          <div className="mt-3 p-3 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 rounded-lg border border-indigo-200 dark:border-indigo-800">
            <div className="flex items-start gap-2">
              <span className="text-lg">💡</span>
              <div>
                <div className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider mb-1">
                  Your Vision
                </div>
                <p className="text-sm text-indigo-800 dark:text-indigo-200">{vision}</p>
              </div>
            </div>
          </div>
        )}

        {/* Stats bar */}
        <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-neutral-500">
          <div className="flex items-center gap-1">
            <Target className="w-4 h-4" />
            <span>{steps.length} steps</span>
          </div>
          {estimatedDays && (
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>~{estimatedDays} days</span>
            </div>
          )}
          {dailyCommitment && (
            <div className="flex items-center gap-1">
              <Zap className="w-4 h-4" />
              <span>{dailyCommitment}</span>
            </div>
          )}
          {totalMinutes && (
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>{Math.round(totalMinutes / 60)}h total</span>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-neutral-500">Progress</span>
            <span className="font-medium text-neutral-700 dark:text-neutral-300">
              {completedCount}/{steps.length} steps
            </span>
          </div>
          <div className="h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Success metrics preview */}
        {successMetrics && successMetrics.length > 0 && (
          <div className="mt-4 p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg border border-neutral-200 dark:border-neutral-700">
            <div className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider mb-2">
              Success Metrics
            </div>
            <div className="flex flex-wrap gap-2">
              {successMetrics.map((metric, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-white dark:bg-neutral-700 rounded-full border border-neutral-200 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300"
                >
                  <CheckCircle className="w-3 h-3 text-green-500" />
                  {metric}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-[18px] top-0 bottom-0 w-0.5 bg-neutral-200 dark:bg-neutral-700" />

        {/* Progress overlay on line */}
        <div
          className="absolute left-[18px] top-0 w-0.5 bg-gradient-to-b from-green-500 to-blue-500 transition-all duration-500"
          style={{
            height: `${Math.min(100, ((currentStepIndex + 0.5) / steps.length) * 100)}%`,
          }}
        />

        {/* Steps with phases */}
        {renderStepsWithPhases()}
      </div>

      {/* Success preview */}
      {successLooksLike && (
        <div className="mt-6 p-4 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-950/30 dark:to-blue-950/30 rounded-xl border border-green-200 dark:border-green-800">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-5 h-5 text-green-600" />
            <span className="text-sm font-semibold text-green-700 dark:text-green-400">
              Success Looks Like
            </span>
          </div>
          <p className="text-sm text-green-800 dark:text-green-200">{successLooksLike}</p>
        </div>
      )}
    </div>
  )
}

export default RoadmapTimeline
