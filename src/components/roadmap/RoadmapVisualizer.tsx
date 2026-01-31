'use client'

/**
 * ROADMAP VISUALIZER
 *
 * Smart component that uses the Gated Phase Stack as the primary view.
 * This reflects the Clerva philosophy: Gates > Progress, Standards > Time.
 *
 * View Selection:
 * - Gated (default): Gated vertical phase stack with training loops
 * - Structure: Timeline/Flow for overview purposes only
 *
 * Philosophy:
 * - Gates communicate: "You haven't earned access yet"
 * - Standards communicate: "Here's how you prove readiness"
 * - No progress bars, day counters, or checkmarks
 * - Identity progression, not task completion
 */

import { useState, useEffect } from 'react'
import { Layers, LayoutGrid } from 'lucide-react'
import { RoadmapTimeline } from './RoadmapTimeline'
import { RoadmapFlow } from './RoadmapFlow'
import { GatedPhaseStack, GateStep } from './GatedPhaseStack'
import { VisionBanner } from './VisionBanner'
import { RiskWarning } from './RiskWarning'

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

interface CommonMistake {
  trap: string
  consequence: string
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
  commonMistakes?: CommonMistake[] | string[]
  selfTest?: { challenge: string; passCriteria: string; failCriteria?: string }
  abilities?: string[]
  whyAfterPrevious?: string
  previewAbilities?: string[]
  phase?: string

  // LESSON SECTION (Understanding - 40%)
  lesson?: {
    title: string
    subtitle?: string
    duration: number
    slides: {
      order: number
      title: string
      concept: string
      explanation: string
      whyItMatters: string
      whatHappensWithout: string
      realWorldExample: string
      analogyOrMetaphor?: string
      visualHint?: string
      keyTakeaway: string
    }[]
    resources?: {
      type: string
      title: string
      description?: string
      searchQuery?: string
      priority?: number
    }[]
    understandingCheck?: {
      question: string
      correctAnswer: string
      hint?: string
    }
    bridgeToActions: string
  }
  lessonCompleted?: boolean

  // ACTION SECTION (Doing - 60%)
  todaysFocus?: {
    action: string
    where: string
    duration: string
    output: string
  }
  whyThisMattersForYou?: string
  exitConditions?: string[]
  commonTrap?: {
    temptation: string
    whyItFeelsRight: string
    whyItFails: string
    betterApproach: string
  }
  successSignals?: {
    feelsLike: string
    youllKnow?: string
    behaviorChange?: string
    confidenceMarker?: string
  }
  encouragement?: string
  teaser?: string
}

// Phase type matching RoadmapTimeline expectations
type RoadmapPhase = 'NOW' | 'NEXT' | 'LATER'

// Legacy step type for Timeline/Flow views (string-only commonMistakes, typed phase)
interface LegacyEnhancedStep extends Omit<EnhancedStep, 'commonMistakes' | 'phase'> {
  commonMistakes?: string[]
  phase?: RoadmapPhase
}

type ViewMode = 'gated' | 'structure'

interface CriticalWarning {
  warning: string
  consequence: string
  severity: 'CRITICAL'
}

// Vision details structure
interface VisionDetails {
  destination?: string
  transformation?: string
  timeframe?: string
  phases?: {
    name: string
    description: string
    stepsIncluded: number[]
  }[]
  outOfScope?: string[]
  successPreview?: string
}

interface RoadmapVisualizerProps {
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
  // Vision & Strategy fields
  vision?: string
  visionDetails?: VisionDetails  // NEW: Detailed vision
  targetUser?: string
  successMetrics?: string[]
  outOfScope?: string[]
  criticalWarning?: CriticalWarning
  // Handlers
  onStepClick?: (stepId: string) => void
  onStepComplete?: (stepId: string) => void
  onResourceClick?: (resource: StepResource, stepId: string) => void
  defaultView?: ViewMode
  showViewToggle?: boolean
  showVisionBanner?: boolean
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if viewport is mobile
 */
function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  return isMobile
}

/**
 * Convert EnhancedStep to GateStep format
 * Maps the existing step structure to the gated training system format
 */
function convertToGateSteps(
  steps: EnhancedStep[],
  currentStepIndex: number,
  completedStepIds: string[]
): GateStep[] {
  return steps.map((step, index) => {
    const isCompleted = completedStepIds.includes(step.id)
    const isCurrent = index === currentStepIndex
    const isLocked = !isCompleted && index > currentStepIndex

    // Convert common mistakes to fail conditions
    const failConditions = step.commonMistakes?.map(mistake => {
      if (typeof mistake === 'string') {
        return { condition: mistake }
      }
      return {
        condition: mistake.trap,
        consequence: mistake.consequence,
      }
    })

    // Build identity progression from abilities
    const identityBefore = index === 0
      ? 'Someone who wants to learn but hasn\'t started'
      : `Someone who has completed Gate ${index}`

    const identityAfter = step.abilities?.[0]
      ? `Someone who can ${step.abilities[0].toLowerCase()}`
      : `Someone who has mastered this gate`

    return {
      id: step.id,
      order: step.order,
      title: step.title,
      description: step.description,
      isLocked,
      isCompleted,
      isCurrent,
      phase: step.phase,

      // LESSON SECTION (Understanding - 40%)
      lesson: step.lesson,
      lessonCompleted: step.lessonCompleted,

      // ACTION SECTION (Doing - 60%)
      todaysFocus: step.todaysFocus,
      whyThisMattersForYou: step.whyThisMattersForYou,
      exitConditions: step.exitConditions,
      commonTrap: step.commonTrap,
      encouragement: step.encouragement,
      successSignals: step.successSignals,
      teaser: step.teaser,

      // Gate-specific fields
      failureToEliminate: step.avoid || step.risk?.warning,
      capability: step.abilities?.[0],
      identityBefore,
      identityAfter,

      // Standards
      passCondition: step.selfTest?.passCriteria || step.doneWhen,
      failConditions,
      repeatInstruction: step.selfTest?.failCriteria
        ? `If you ${step.selfTest.failCriteria.toLowerCase()}, repeat this gate.`
        : 'If you cannot pass the standard, repeat this gate until you can.',

      // Training protocol
      method: step.method,
      trainingLoop: {
        input: step.method || step.description,
        output: step.selfTest?.challenge || 'Complete the training protocol',
        constraint: step.avoid || 'Follow the method exactly',
        validation: step.selfTest?.passCriteria || step.doneWhen || 'Self-assess your output',
      },

      // Common mistakes and self test
      commonMistakes: step.commonMistakes,
      selfTest: step.selfTest,

      // Additional fields
      whyFirst: step.whyFirst || step.whyAfterPrevious,
      abilities: step.abilities,
      previewAbilities: step.previewAbilities,
      resources: step.resources,
      risk: step.risk,
      duration: step.duration,
    }
  })
}

// ============================================
// VIEW TOGGLE COMPONENT
// ============================================

function ViewToggle({
  currentView,
  onViewChange,
}: {
  currentView: ViewMode
  onViewChange: (view: ViewMode) => void
}) {
  return (
    <div className="flex items-center gap-1 p-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
      <button
        onClick={() => onViewChange('gated')}
        className={`
          flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all
          ${currentView === 'gated'
            ? 'bg-white dark:bg-neutral-700 text-neutral-800 dark:text-neutral-100 shadow-sm'
            : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
          }
        `}
      >
        <Layers className="w-3.5 h-3.5" />
        <span>Training</span>
      </button>
      <button
        onClick={() => onViewChange('structure')}
        className={`
          flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all
          ${currentView === 'structure'
            ? 'bg-white dark:bg-neutral-700 text-neutral-800 dark:text-neutral-100 shadow-sm'
            : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
          }
        `}
      >
        <LayoutGrid className="w-3.5 h-3.5" />
        <span>Structure</span>
      </button>
    </div>
  )
}

// ============================================
// MAIN COMPONENT
// ============================================

export function RoadmapVisualizer({
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
  // Vision & Strategy fields
  vision,
  visionDetails,
  targetUser,
  successMetrics,
  outOfScope,
  criticalWarning,
  // Handlers
  onStepClick,
  onStepComplete,
  onResourceClick,
  defaultView = 'gated',
  showViewToggle = true,
  showVisionBanner = true,
}: RoadmapVisualizerProps) {
  const isMobile = useIsMobile()
  const [currentView, setCurrentView] = useState<ViewMode>(defaultView)

  // Convert steps to gate format
  const gateSteps = convertToGateSteps(steps, currentStepIndex, completedStepIds)

  // Handle gate click
  const handleGateClick = (gateId: string) => {
    onStepClick?.(gateId)
  }

  // Handle resource click with tracking
  const handleResourceClick = (resource: StepResource) => {
    const step = steps.find(s => s.resources?.some(r => r.title === resource.title))
    if (step) {
      onResourceClick?.(resource, step.id)

      // Track resource click for analytics
      fetch('/api/resource/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'click',
          resourceType: resource.type,
          resourceTitle: resource.title,
          platformId: resource.platformId,
          searchQuery: resource.searchQuery,
          stepTitle: step.title,
        }),
      }).catch(() => {
        // Silently fail - tracking shouldn't break UX
      })
    }
  }

  // Convert steps to legacy format (string-only commonMistakes, typed phase)
  const legacySteps: LegacyEnhancedStep[] = steps.map(step => ({
    ...step,
    commonMistakes: step.commonMistakes?.map(m =>
      typeof m === 'string' ? m : m.trap
    ),
    phase: step.phase as RoadmapPhase | undefined,
  }))

  // Props for legacy views
  const legacyProps = {
    roadmapId,
    steps: legacySteps,
    currentStepIndex,
    completedStepIds,
    title,
    overview,
    estimatedDays,
    dailyCommitment,
    totalMinutes,
    successLooksLike,
    onStepClick: handleGateClick,
    onResourceClick: handleResourceClick,
  }

  return (
    <div className="relative space-y-4">
      {/* Vision Banner - Shows transformation narrative */}
      {showVisionBanner && (vision || visionDetails || targetUser || successMetrics?.length) && (
        <VisionBanner
          vision={vision}
          visionDetails={visionDetails}
          targetUser={targetUser}
          successMetrics={successMetrics}
          outOfScope={outOfScope}
          estimatedDays={estimatedDays}
          dailyCommitment={dailyCommitment}
          totalSteps={steps.length}
          defaultExpanded={false}
        />
      )}

      {/* Critical Warning - Shows major risk */}
      {criticalWarning && (
        <RiskWarning
          criticalWarning={criticalWarning}
          variant="critical"
          defaultExpanded={false}
        />
      )}

      {/* View toggle */}
      {showViewToggle && (
        <div className="flex justify-end">
          <ViewToggle currentView={currentView} onViewChange={setCurrentView} />
        </div>
      )}

      {/* Render appropriate view */}
      {currentView === 'gated' ? (
        <GatedPhaseStack
          roadmapId={roadmapId}
          gates={gateSteps}
          currentGateIndex={currentStepIndex}
          completedGateIds={completedStepIds}
          title={title}
          onGateClick={handleGateClick}
          onComplete={onStepComplete}
        />
      ) : (
        // Structure view - use timeline for longer roadmaps, flow for shorter
        steps.length <= 3 && !isMobile ? (
          <RoadmapFlow {...legacyProps} />
        ) : (
          <RoadmapTimeline {...legacyProps} />
        )
      )}
    </div>
  )
}

export default RoadmapVisualizer

// Export individual components for direct use
export { RoadmapTimeline } from './RoadmapTimeline'
export { RoadmapFlow } from './RoadmapFlow'
export { GatedPhaseStack } from './GatedPhaseStack'
