'use client'

/**
 * Today's Mission Component
 * Displays the current mission with deadline, progress, and action buttons
 */

import { memo } from 'react'
import {
  Loader2,
  ArrowRight,
  Target,
  Clock,
  Calendar,
  AlertTriangle,
} from 'lucide-react'
import type { Mission } from '@/lib/mission-engine'
import type { Roadmap } from './types'
import { getDaysRemaining } from './utils'

interface TodaysMissionProps {
  mission: Mission | null
  roadmap: Roadmap | null
  onStartMission: () => void
  onViewRoadmap: () => void
  isLoading: boolean
}

export const TodaysMission = memo(function TodaysMission({
  mission,
  roadmap,
  onStartMission,
  onViewRoadmap,
  isLoading,
}: TodaysMissionProps) {
  if (isLoading) {
    return (
      <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
        </div>
      </div>
    )
  }

  if (!mission) {
    return null
  }

  const isRemediation = mission.metadata?.isRemediation
  const hasRoadmap = roadmap !== null
  const deadline = getDaysRemaining(roadmap?.targetDate)

  return (
    <div className={`rounded-2xl border p-6 ${
      isRemediation
        ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/50'
        : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800'
    }`}>
      {/* Deadline Warning Banner */}
      {deadline && deadline.isUrgent && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg mb-4 ${
          deadline.days === 0
            ? 'bg-red-100 dark:bg-red-950/30 border border-red-200 dark:border-red-800'
            : 'bg-amber-100 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800'
        }`}>
          <Calendar className={`w-4 h-4 ${
            deadline.days === 0
              ? 'text-red-600 dark:text-red-400'
              : 'text-amber-600 dark:text-amber-400'
          }`} />
          <span className={`text-sm font-medium ${
            deadline.days === 0
              ? 'text-red-700 dark:text-red-300'
              : 'text-amber-700 dark:text-amber-300'
          }`}>
            {deadline.display}
          </span>
        </div>
      )}

      {/* Mission Type Badge */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${
            isRemediation
              ? 'bg-amber-100 dark:bg-amber-900/30'
              : 'bg-blue-100 dark:bg-blue-900/30'
          }`}>
            {isRemediation ? (
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            ) : (
              <Target className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            )}
          </div>
          <span className={`text-xs font-semibold uppercase tracking-wide ${
            isRemediation
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-blue-600 dark:text-blue-400'
          }`}>
            {isRemediation ? 'Fix Required' : "Today's Mission"}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Deadline indicator (non-urgent) */}
          {deadline && !deadline.isUrgent && (
            <div className="flex items-center gap-1 text-neutral-400">
              <Calendar className="w-3.5 h-3.5" />
              <span className="text-xs">{deadline.display}</span>
            </div>
          )}

          {mission.estimatedMinutes && (
            <div className="flex items-center gap-1 text-neutral-400">
              <Clock className="w-3.5 h-3.5" />
              <span className="text-xs">{mission.estimatedMinutes} min</span>
            </div>
          )}
        </div>
      </div>

      {/* Mission Title - Authoritative, not question */}
      <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">
        {mission.title}
      </h2>

      {/* Directive - Clear command */}
      <p className="text-neutral-600 dark:text-neutral-400 mb-4">
        {mission.directive}
      </p>

      {/* Context if provided */}
      {mission.context && (
        <p className="text-sm text-neutral-500 dark:text-neutral-500 mb-4 italic">
          {mission.context}
        </p>
      )}

      {/* Progress indicator if linked to roadmap */}
      {hasRoadmap && mission.linkedStep && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs text-neutral-500 mb-1.5">
            <span>Step {mission.linkedStep.stepOrder} of {roadmap.totalSteps}</span>
            <span>{Math.round((roadmap.completedSteps / roadmap.totalSteps) * 100)}%</span>
          </div>
          <div className="h-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${(roadmap.completedSteps / roadmap.totalSteps) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Success Criterion */}
      <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-xl p-3 mb-4">
        <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-1">
          Done when
        </p>
        <p className="text-sm text-neutral-700 dark:text-neutral-300">
          {mission.criteria.description}
        </p>
      </div>

      {/* Action Buttons - ACTION-BASED, not message-based */}
      <div className="flex gap-3 relative z-10">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onStartMission()
          }}
          className={`flex-1 flex items-center justify-center gap-2 py-3.5 font-semibold rounded-xl transition-colors cursor-pointer select-none active:scale-[0.98] ${
            isRemediation
              ? 'bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white'
              : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white'
          }`}
        >
          <span>{isRemediation ? 'Begin Remediation' : 'Start Mission'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>

        {hasRoadmap && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onViewRoadmap()
            }}
            className="px-4 py-3.5 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 active:bg-neutral-300 dark:active:bg-neutral-600 text-neutral-700 dark:text-neutral-300 font-medium rounded-xl transition-colors cursor-pointer select-none active:scale-[0.98]"
          >
            View Plan
          </button>
        )}
      </div>
    </div>
  )
})
