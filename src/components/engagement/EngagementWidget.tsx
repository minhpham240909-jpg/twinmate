'use client'

/**
 * ENGAGEMENT WIDGET
 *
 * Unified engagement dashboard component.
 * Integrates:
 * - Daily progress tracking
 * - Streak display
 * - Quick capture FAB
 * - Goal celebration modal
 * - Calendar link
 */

import { memo, useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useEngagement } from '@/hooks/useEngagement'
import { useCaptures, type CreateCaptureInput } from '@/hooks/useCaptures'
import { TodayProgress } from './TodayProgress'
import { CommitmentSetup } from './CommitmentSetup'
import { QuickCapture, QuickCaptureFAB } from './QuickCapture'
import { GoalCelebration } from './GoalCelebration'
import { CalendarWeek } from './CalendarWeek'
import {
  Calendar,
  ChevronRight,
  BookOpen,
} from 'lucide-react'

interface EngagementWidgetProps {
  showCommitmentSetup?: boolean
  compact?: boolean
  roadmapId?: string
  stepId?: string
  subject?: string
}

export const EngagementWidget = memo(function EngagementWidget({
  showCommitmentSetup = false,
  compact = false,
  roadmapId,
  stepId,
  subject,
}: EngagementWidgetProps) {
  const router = useRouter()
  const {
    commitment,
    todayProgress,
    weekProgress,
    streak,
    streakStats,
    isLoading,
    setCommitment,
    recordCapture,
  } = useEngagement()

  const { createCapture } = useCaptures()

  // Local state
  const [showSetup, setShowSetup] = useState(showCommitmentSetup)
  const [showCaptureModal, setShowCaptureModal] = useState(false)
  const [showCelebration, setShowCelebration] = useState(false)
  const [celebrationShownForGoal, setCelebrationShownForGoal] = useState<string | null>(null)

  // Check if we should show commitment setup
  useEffect(() => {
    if (!isLoading && !commitment && !showSetup) {
      setShowSetup(true)
    }
  }, [isLoading, commitment, showSetup])

  // Show celebration when goal is met (only once per day)
  useEffect(() => {
    const todayKey = new Date().toISOString().split('T')[0]
    if (
      todayProgress?.goalMet &&
      celebrationShownForGoal !== todayKey &&
      !isLoading
    ) {
      setShowCelebration(true)
      setCelebrationShownForGoal(todayKey)
    }
  }, [todayProgress?.goalMet, celebrationShownForGoal, isLoading])

  // Handlers
  const handleSetCommitment = useCallback(async (minutes: number): Promise<boolean> => {
    const success = await setCommitment(minutes)
    if (success) {
      setShowSetup(false)
    }
    return success
  }, [setCommitment])

  const handleCaptureCreate = useCallback(async (input: CreateCaptureInput): Promise<boolean> => {
    const capture = await createCapture({
      ...input,
      roadmapId: input.roadmapId || roadmapId,
      stepId: input.stepId || stepId,
      subject: input.subject || subject,
    })

    if (capture) {
      // Record in engagement progress
      await recordCapture()
      setShowCaptureModal(false)
      return true
    }
    return false
  }, [createCapture, recordCapture, roadmapId, stepId, subject])

  const handleCalendarClick = useCallback(() => {
    router.push('/calendar')
  }, [router])

  const handleKnowledgeClick = useCallback(() => {
    router.push('/progress?tab=knowledge')
  }, [router])

  // Calculate streak bonus XP
  const calculateBonusXp = () => {
    if (!streak) return 0
    return Math.min(streak.current * 5, 50) // Cap at 50 XP
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-32 bg-neutral-200 dark:bg-neutral-800 rounded-2xl" />
        <div className="h-24 bg-neutral-200 dark:bg-neutral-800 rounded-2xl" />
      </div>
    )
  }

  // Commitment setup modal
  if (showSetup && !commitment) {
    return (
      <CommitmentSetup
        isModal={true}
        onClose={() => setShowSetup(false)}
        onConfirm={handleSetCommitment}
      />
    )
  }

  // Compact view (just progress indicator)
  if (compact) {
    return (
      <>
        <TodayProgress
          progress={todayProgress}
          streak={streak}
          streakStats={streakStats}
          isLoading={false}
        />

        {/* FAB */}
        <QuickCaptureFAB onClick={() => setShowCaptureModal(true)} />

        {/* Quick Capture */}
        {showCaptureModal && (
          <QuickCapture
            onCapture={handleCaptureCreate}
            activeRoadmapId={roadmapId}
            activeStepId={stepId}
            subject={subject}
          />
        )}
      </>
    )
  }

  // Full view
  return (
    <>
      {/* Today's Progress Card */}
      <TodayProgress
        progress={todayProgress}
        streak={streak}
        streakStats={streakStats}
        isLoading={false}
      />

      {/* Week Calendar */}
      <div className="mt-4">
        <CalendarWeek
          weekProgress={weekProgress}
          isLoading={false}
        />
      </div>

      {/* Quick Actions */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          onClick={handleCalendarClick}
          className="flex items-center gap-3 p-4 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
        >
          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
            <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-left">
            <div className="text-sm font-medium text-neutral-900 dark:text-white">
              Calendar
            </div>
            <div className="text-xs text-neutral-500">View all</div>
          </div>
          <ChevronRight className="w-4 h-4 text-neutral-400 ml-auto" />
        </button>

        <button
          onClick={handleKnowledgeClick}
          className="flex items-center gap-3 p-4 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 hover:border-purple-300 dark:hover:border-purple-700 transition-colors"
        >
          <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="text-left">
            <div className="text-sm font-medium text-neutral-900 dark:text-white">
              Knowledge
            </div>
            <div className="text-xs text-neutral-500">
              {todayProgress?.capturesCreated || 0} notes
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-neutral-400 ml-auto" />
        </button>
      </div>

      {/* FAB */}
      <QuickCaptureFAB onClick={() => setShowCaptureModal(true)} />

      {/* Quick Capture */}
      {showCaptureModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowCaptureModal(false)}
          />
          <div className="relative w-full max-w-lg">
            <QuickCapture
              onCapture={handleCaptureCreate}
              activeRoadmapId={roadmapId}
              activeStepId={stepId}
              subject={subject}
            />
          </div>
        </div>
      )}

      {/* Goal Celebration */}
      <GoalCelebration
        isOpen={showCelebration}
        onClose={() => setShowCelebration(false)}
        onKeepGoing={() => setShowCelebration(false)}
        targetMinutes={todayProgress?.goalMinutes || commitment?.dailyMinutes || 15}
        actualMinutes={todayProgress?.minutesLearned || 0}
        currentStreak={streak?.current || 0}
        weekDaysCompleted={streakStats?.thisWeek?.daysCompleted || 0}
        xpEarned={todayProgress?.xpEarned || 10}
        bonusXp={calculateBonusXp()}
      />
    </>
  )
})

export default EngagementWidget
