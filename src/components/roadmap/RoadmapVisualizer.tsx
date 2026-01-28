'use client'

/**
 * ROADMAP VISUALIZER
 *
 * Smart component that automatically switches between Timeline and Flow views
 * based on the roadmap characteristics.
 *
 * View Selection Logic:
 * - Flow (horizontal): 3-4 steps, simple roadmap
 * - Timeline (vertical): 5+ steps, complex roadmap, or mobile
 *
 * Features:
 * - Auto-selects best view
 * - Manual view toggle
 * - XP tracking integration
 * - Resource click tracking
 */

import { useState, useEffect } from 'react'
import { LayoutGrid, List, Sparkles } from 'lucide-react'
import { RoadmapTimeline } from './RoadmapTimeline'
import { RoadmapFlow } from './RoadmapFlow'
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

type ViewMode = 'timeline' | 'flow' | 'auto'

interface CriticalWarning {
  warning: string
  consequence: string
  severity: 'CRITICAL'
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
  // NEW: Vision & Strategy fields
  vision?: string
  targetUser?: string
  successMetrics?: string[]
  outOfScope?: string[]
  criticalWarning?: CriticalWarning
  // Handlers
  onStepClick?: (stepId: string) => void
  onStepComplete?: (stepId: string, xpEarned: number) => void
  onResourceClick?: (resource: StepResource, stepId: string) => void
  defaultView?: ViewMode
  showViewToggle?: boolean
  showVisionBanner?: boolean
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Determine the best view mode based on roadmap characteristics
 *
 * Updated: Changed threshold from 4 to 3 steps for flow view
 * Most roadmaps have 3-4 steps, so this ensures timeline is shown more often
 */
function determineOptimalView(
  steps: EnhancedStep[],
  isMobile: boolean
): 'timeline' | 'flow' {
  // Always use timeline on mobile for better UX
  if (isMobile) return 'timeline'

  // Use flow only for very short roadmaps (2-3 steps)
  if (steps.length <= 3) return 'flow'

  // Use timeline for 4+ steps (most roadmaps)
  return 'timeline'
}

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

// ============================================
// XP TOAST COMPONENT
// ============================================

function XPToast({
  xp,
  message,
  onComplete,
}: {
  xp: number
  message: string
  onComplete: () => void
}) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 3000)
    return () => clearTimeout(timer)
  }, [onComplete])

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 animate-bounce-in">
      <div className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full shadow-lg shadow-orange-500/30">
        <Sparkles className="w-6 h-6 text-white animate-pulse" />
        <div className="text-white">
          <div className="font-bold text-lg">+{xp} XP</div>
          <div className="text-xs text-white/80">{message}</div>
        </div>
      </div>
    </div>
  )
}

// ============================================
// VIEW TOGGLE COMPONENT
// ============================================

function ViewToggle({
  currentView,
  onViewChange,
}: {
  currentView: 'timeline' | 'flow'
  onViewChange: (view: 'timeline' | 'flow') => void
}) {
  return (
    <div className="flex items-center gap-1 p-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
      <button
        onClick={() => onViewChange('flow')}
        className={`
          flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all
          ${currentView === 'flow'
            ? 'bg-white dark:bg-neutral-700 text-neutral-800 dark:text-neutral-100 shadow-sm'
            : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
          }
        `}
      >
        <LayoutGrid className="w-3.5 h-3.5" />
        <span>Flow</span>
      </button>
      <button
        onClick={() => onViewChange('timeline')}
        className={`
          flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all
          ${currentView === 'timeline'
            ? 'bg-white dark:bg-neutral-700 text-neutral-800 dark:text-neutral-100 shadow-sm'
            : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
          }
        `}
      >
        <List className="w-3.5 h-3.5" />
        <span>Timeline</span>
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
  // NEW: Vision & Strategy fields
  vision,
  targetUser,
  successMetrics,
  outOfScope,
  criticalWarning,
  // Handlers
  onStepClick,
  onStepComplete: _onStepComplete,
  onResourceClick,
  defaultView = 'auto',
  showViewToggle = true,
  showVisionBanner = true,
}: RoadmapVisualizerProps) {
  // Note: _onStepComplete is available for future XP integration
  const isMobile = useIsMobile()
  const optimalView = determineOptimalView(steps, isMobile)

  const [currentView, setCurrentView] = useState<'timeline' | 'flow'>(
    defaultView === 'auto' ? optimalView : defaultView
  )

  const [xpToast, setXpToast] = useState<{ xp: number; message: string } | null>(null)

  // Update view when optimal changes (e.g., window resize)
  useEffect(() => {
    if (defaultView === 'auto') {
      setCurrentView(optimalView)
    }
  }, [optimalView, defaultView])

  // Handle step click with XP tracking
  const handleStepClick = (stepId: string) => {
    onStepClick?.(stepId)
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

  // Show XP toast (available for future step completion integration)
  const _showXPToast = (xp: number, message: string) => {
    setXpToast({ xp, message })
  }

  const commonProps = {
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
    onStepClick: handleStepClick,
    onResourceClick: handleResourceClick,
  }

  return (
    <div className="relative space-y-4">
      {/* Vision Banner - Shows transformation narrative */}
      {showVisionBanner && (vision || targetUser || successMetrics?.length) && (
        <VisionBanner
          vision={vision}
          targetUser={targetUser}
          successMetrics={successMetrics}
          outOfScope={outOfScope}
          estimatedDays={estimatedDays}
          dailyCommitment={dailyCommitment}
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
      {showViewToggle && !isMobile && steps.length <= 6 && (
        <div className="flex justify-end">
          <ViewToggle currentView={currentView} onViewChange={setCurrentView} />
        </div>
      )}

      {/* Render appropriate view */}
      {currentView === 'flow' ? (
        <RoadmapFlow {...commonProps} />
      ) : (
        <RoadmapTimeline {...commonProps} />
      )}

      {/* XP Toast */}
      {xpToast && (
        <XPToast
          xp={xpToast.xp}
          message={xpToast.message}
          onComplete={() => setXpToast(null)}
        />
      )}
    </div>
  )
}

export default RoadmapVisualizer

// Export individual components for direct use
export { RoadmapTimeline } from './RoadmapTimeline'
export { RoadmapFlow } from './RoadmapFlow'
