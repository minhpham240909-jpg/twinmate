'use client'

/**
 * ROADMAP FLOW COMPONENT
 *
 * A horizontal flow diagram visualization of the learning roadmap.
 * Best for shorter roadmaps (3-4 steps) where everything fits on screen.
 *
 * Features:
 * - Horizontal connected nodes
 * - Visual progress animation
 * - Click to expand step details
 * - Mobile-responsive (scrollable)
 */

import { useState } from 'react'
import {
  CheckCircle,
  Circle,
  Lock,
  ArrowRight,
  Target,
  Zap,
  X,
  BookOpen,
  AlertTriangle,
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
  whyFirst?: string
  timeBreakdown?: { daily: string; total: string; flexible: string }
  commonMistakes?: string[]
  selfTest?: { challenge: string; passCriteria: string }
  abilities?: string[]
  whyAfterPrevious?: string
  previewAbilities?: string[]
}

interface RoadmapFlowProps {
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

// ============================================
// FLOW NODE COMPONENT
// ============================================

function FlowNode({
  step,
  status,
  isLast,
  onClick,
}: {
  step: EnhancedStep
  status: 'completed' | 'current' | 'locked'
  isLast: boolean
  onClick: () => void
}) {
  const isCurrent = status === 'current'
  const isCompleted = status === 'completed'
  const isLocked = status === 'locked'

  return (
    <div className="flex items-center">
      {/* Node */}
      <button
        onClick={onClick}
        disabled={isLocked}
        className={`
          relative flex flex-col items-center p-4 rounded-2xl transition-all duration-300
          min-w-[140px] max-w-[160px]
          ${isCurrent
            ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30 scale-105'
            : isCompleted
            ? 'bg-green-500 text-white hover:bg-green-600'
            : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-400 cursor-not-allowed'
          }
          ${!isLocked ? 'hover:scale-105 cursor-pointer' : ''}
        `}
      >
        {/* Status icon */}
        <div
          className={`
            w-10 h-10 rounded-full flex items-center justify-center mb-2
            ${isCurrent
              ? 'bg-white/20'
              : isCompleted
              ? 'bg-white/20'
              : 'bg-neutral-300 dark:bg-neutral-600'
            }
          `}
        >
          {isCompleted ? (
            <CheckCircle className="w-6 h-6" />
          ) : isCurrent ? (
            <Circle className="w-6 h-6 fill-current" />
          ) : (
            <Lock className="w-5 h-5" />
          )}
        </div>

        {/* Step number */}
        <span
          className={`
            text-xs font-bold uppercase tracking-wider mb-1
            ${isCurrent || isCompleted ? 'opacity-80' : 'opacity-50'}
          `}
        >
          Step {step.order}
        </span>

        {/* Title */}
        <span
          className={`
            text-sm font-semibold text-center line-clamp-2
            ${isCompleted ? 'opacity-80' : ''}
          `}
        >
          {step.title}
        </span>

        {/* Current indicator pulse */}
        {isCurrent && (
          <div className="absolute -inset-1 bg-blue-500 rounded-2xl animate-pulse opacity-30 -z-10" />
        )}
      </button>

      {/* Arrow connector */}
      {!isLast && (
        <div className="flex items-center mx-2">
          <div
            className={`
              h-1 w-8 rounded-full transition-colors duration-300
              ${isCompleted ? 'bg-green-500' : 'bg-neutral-300 dark:bg-neutral-600'}
            `}
          />
          <ArrowRight
            className={`
              w-5 h-5 -ml-1 transition-colors duration-300
              ${isCompleted ? 'text-green-500' : 'text-neutral-300 dark:text-neutral-600'}
            `}
          />
        </div>
      )}
    </div>
  )
}

// ============================================
// STEP DETAIL MODAL
// ============================================

function StepDetailModal({
  step,
  status,
  roadmapId,
  onClose,
  onResourceClick,
}: {
  step: EnhancedStep
  status: 'completed' | 'current' | 'locked'
  roadmapId: string
  onClose: () => void
  onResourceClick?: (resource: StepResource) => void
}) {
  const isCurrent = status === 'current'
  const isLocked = status === 'locked'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div
        className={`
          relative w-full max-w-lg max-h-[80vh] overflow-y-auto
          bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl
          border-2 ${isCurrent ? 'border-blue-500' : 'border-neutral-200 dark:border-neutral-700'}
        `}
      >
        {/* Header */}
        <div
          className={`
            sticky top-0 p-4 border-b border-neutral-200 dark:border-neutral-700
            ${isCurrent ? 'bg-blue-50 dark:bg-blue-950/30' : 'bg-neutral-50 dark:bg-neutral-800'}
          `}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1 rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div
              className={`
                w-10 h-10 rounded-full flex items-center justify-center text-white font-bold
                ${isCurrent ? 'bg-blue-500' : status === 'completed' ? 'bg-green-500' : 'bg-neutral-400'}
              `}
            >
              {step.order}
            </div>
            <div>
              <span
                className={`
                  text-xs font-bold uppercase tracking-wider
                  ${isCurrent ? 'text-blue-600' : 'text-neutral-500'}
                `}
              >
                {isCurrent ? 'Current Step' : status === 'completed' ? 'Completed' : `Step ${step.order}`}
              </span>
              <h3 className="text-lg font-bold text-neutral-800 dark:text-neutral-100">
                {step.title}
              </h3>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Description */}
          {step.description && (
            <p className="text-sm text-neutral-600 dark:text-neutral-300">{step.description}</p>
          )}

          {/* Micro-actions for AI assistance */}
          {!isLocked && (
            <StepMicroActions
              stepId={step.id}
              roadmapId={roadmapId}
              stepTitle={step.title}
              isLocked={isLocked}
              className="pt-2"
            />
          )}

          {/* Why First */}
          {step.whyFirst && (
            <div className="bg-amber-50 dark:bg-amber-950/30 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase">
                  Why This Step
                </span>
              </div>
              <p className="text-sm text-amber-800 dark:text-amber-200">{step.whyFirst}</p>
            </div>
          )}

          {/* Method */}
          {step.method && (
            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase">
                  Method
                </span>
              </div>
              <p className="text-sm text-blue-800 dark:text-blue-200">{step.method}</p>
            </div>
          )}

          {/* Common Mistakes */}
          {step.commonMistakes && step.commonMistakes.length > 0 && (
            <div className="bg-red-50 dark:bg-red-950/30 rounded-xl p-4 border border-red-200 dark:border-red-800">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <span className="text-xs font-bold text-red-700 dark:text-red-400 uppercase">
                  Avoid These Mistakes
                </span>
              </div>
              <ul className="space-y-2">
                {step.commonMistakes.map((mistake, i) => (
                  <li key={i} className="text-sm text-red-800 dark:text-red-200 flex items-start gap-2">
                    <span className="text-red-500 font-bold">✕</span>
                    {mistake}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Self Test */}
          {step.selfTest && (
            <div className="bg-purple-50 dark:bg-purple-950/30 rounded-xl p-4 border border-purple-200 dark:border-purple-800">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-purple-600" />
                <span className="text-xs font-bold text-purple-700 dark:text-purple-400 uppercase">
                  Ready Check
                </span>
              </div>
              <p className="text-sm text-purple-800 dark:text-purple-200 font-medium">
                {step.selfTest.challenge}
              </p>
              <p className="text-xs text-purple-600 dark:text-purple-400 mt-2">
                ✓ Pass criteria: {step.selfTest.passCriteria}
              </p>
            </div>
          )}

          {/* Abilities */}
          {step.abilities && step.abilities.length > 0 && (
            <div className="bg-green-50 dark:bg-green-950/30 rounded-xl p-4 border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-green-600" />
                <span className="text-xs font-bold text-green-700 dark:text-green-400 uppercase">
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
            <div className="bg-indigo-50 dark:bg-indigo-950/30 rounded-xl p-4 border border-indigo-200 dark:border-indigo-800">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase">
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
                    className="flex items-center gap-3 p-3 bg-white dark:bg-neutral-800 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors group"
                  >
                    <span className="text-2xl">
                      {resource.type === 'video' ? '📺' : resource.type === 'exercise' ? '💪' : resource.type === 'tool' ? '🛠️' : '📄'}
                    </span>
                    <div className="flex-1">
                      <div className="font-medium text-neutral-800 dark:text-neutral-100">
                        {resource.title}
                      </div>
                      {resource.platformName && (
                        <div className="text-xs text-neutral-500">
                          Open on {resource.platformName}
                        </div>
                      )}
                    </div>
                    <ExternalLink className="w-5 h-5 text-neutral-400 group-hover:text-indigo-500" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Done When */}
          {step.doneWhen && (
            <div className="bg-neutral-100 dark:bg-neutral-800 rounded-xl p-4 border-2 border-dashed border-neutral-300 dark:border-neutral-600">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="w-4 h-4 text-neutral-600" />
                <span className="text-xs font-bold text-neutral-600 dark:text-neutral-400 uppercase">
                  Done When
                </span>
              </div>
              <p className="text-sm text-neutral-700 dark:text-neutral-300">{step.doneWhen}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================
// MAIN COMPONENT
// ============================================

export function RoadmapFlow({
  roadmapId,
  steps,
  currentStepIndex,
  completedStepIds,
  title,
  overview,
  successLooksLike,
  onStepClick,
  onResourceClick,
}: RoadmapFlowProps) {
  const [selectedStep, setSelectedStep] = useState<EnhancedStep | null>(null)

  // Handle empty steps case
  if (steps.length === 0) {
    return (
      <div className="w-full">
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <Target className="w-8 h-8 text-neutral-400" />
          </div>
          <h3 className="text-lg font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
            No steps yet
          </h3>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-md mx-auto">
            This roadmap is being set up. Steps will appear here once the learning path is defined.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-6 text-center">
        <h2 className="text-xl font-bold text-neutral-800 dark:text-neutral-100 mb-1">
          {title}
        </h2>
        {overview && (
          <p className="text-sm text-neutral-600 dark:text-neutral-400">{overview}</p>
        )}

        {/* Gate count - simple, not gamified */}
        <div className="mt-3 text-xs text-neutral-500">
          <span>{steps.length} gates in this training program</span>
        </div>
      </div>

      {/* Flow diagram */}
      <div className="overflow-x-auto pb-4">
        <div className="flex items-center justify-center min-w-max px-4">
          {steps.map((step, index) => {
            const status = getStepStatus(step, index, currentStepIndex, completedStepIds)

            return (
              <FlowNode
                key={step.id}
                step={step}
                status={status}
                isLast={index === steps.length - 1}
                onClick={() => {
                  if (status !== 'locked') {
                    setSelectedStep(step)
                    onStepClick?.(step.id)
                  }
                }}
              />
            )
          })}
        </div>
      </div>

      {/* Success preview */}
      {successLooksLike && (
        <div className="mt-6 p-4 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-950/30 dark:to-blue-950/30 rounded-xl border border-green-200 dark:border-green-800 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Target className="w-5 h-5 text-green-600" />
            <span className="text-sm font-semibold text-green-700 dark:text-green-400">
              Your Goal
            </span>
          </div>
          <p className="text-sm text-green-800 dark:text-green-200">{successLooksLike}</p>
        </div>
      )}

      {/* Step detail modal */}
      {selectedStep && (
        <StepDetailModal
          step={selectedStep}
          status={getStepStatus(
            selectedStep,
            steps.findIndex(s => s.id === selectedStep.id),
            currentStepIndex,
            completedStepIds
          )}
          roadmapId={roadmapId}
          onClose={() => setSelectedStep(null)}
          onResourceClick={onResourceClick}
        />
      )}
    </div>
  )
}

export default RoadmapFlow
