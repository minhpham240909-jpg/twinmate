'use client'

/**
 * CLERVA - Learning Operating System Dashboard
 *
 * DESIGN PHILOSOPHY (Different from ChatGPT):
 * - ChatGPT: "Respond to whatever user asks"
 * - Clerva: "Decide what user needs next"
 *
 * CORE PRINCIPLES:
 * 1. NO BLANK CHAT - Mission first, always
 * 2. OPINIONATED - We decide, user executes
 * 3. STEP LOCKING - Progress requires proof
 * 4. ACTION-BASED - Complete/Submit/Review, not messages
 * 5. PERSISTENT MEMORY - Weak spots, failures, wins
 * 6. AUTHORITY TONE - Direct, not hedging
 * 7. FAILURE HANDLING - Micro-remediation, not reset
 * 8. IDENTITY LOCK-IN - "You're becoming X"
 *
 * User opens app → sees ONE mission → no decisions needed
 */

import { useAuth } from '@/lib/auth/context'
import { useEffect, useState, useCallback, memo, useRef } from 'react'
import { useUserSync } from '@/hooks/useUserSync'
import { useDashboardStats } from '@/hooks/useUserStats'
import { useGuestTrial } from '@/hooks/useGuestTrial'
import { useActiveRoadmap } from '@/hooks/useActiveRoadmap'
import { MissionEngine, type Mission, type UserProgress } from '@/lib/mission-engine'
import MissionChat from '@/components/MissionChat'
import { SectionErrorBoundary } from '@/components/SectionErrorBoundary'
import BottomNav from '@/components/BottomNav'
import TrialLimitModal from '@/components/TrialLimitModal'
import TrialBanner from '@/components/TrialBanner'
import PWAInstallBanner from '@/components/PWAInstallBanner'
import NotificationPanel from '@/components/NotificationPanel'
import Image from 'next/image'
import {
  Loader2,
  ArrowRight,
  ChevronLeft,
  Bell,
  CheckCircle2,
  Circle,
  Lock,
  AlertTriangle,
  Target,
  Clock,
  Zap,
  Trophy,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Send,
} from 'lucide-react'

// ============================================
// TYPES
// ============================================

type ViewState = 'mission' | 'roadmap' | 'proof' | 'loading' | 'onboarding'

interface RoadmapStep {
  id: string
  order: number
  title: string
  description: string
  status: 'locked' | 'current' | 'completed'
  duration?: number
  timeframe?: string
  method?: string
  avoid?: string
  doneWhen?: string
}

interface Roadmap {
  id: string
  title: string
  overview?: string
  goal: string
  steps: RoadmapStep[]
  currentStepIndex: number
  totalSteps: number
  completedSteps: number
  estimatedMinutes: number
  pitfalls?: string[]
  successLooksLike?: string
}

// ============================================
// MEMOIZED COMPONENTS
// ============================================

// Minimal Header - Authority feel
const Header = memo(function Header({
  isGuest,
  stats,
  identity,
  onNotificationClick,
  unreadCount,
}: {
  isGuest: boolean
  stats: { streak: number; points: number } | null
  identity?: { archetype?: string; strengths: string[] }
  onNotificationClick: () => void
  unreadCount: number
}) {
  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-neutral-950/95 backdrop-blur-xl border-b border-neutral-100 dark:border-neutral-900">
      <div className="max-w-lg mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="Clerva"
              width={32}
              height={32}
              className="rounded-lg"
              priority
            />
            {identity?.archetype && !isGuest && (
              <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                {identity.archetype}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!isGuest && stats && (
              <>
                {stats.streak > 0 && (
                  <div className="flex items-center gap-1 px-2 py-1 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                      {stats.streak}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-1 px-2 py-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
                  <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    {stats.points} XP
                  </span>
                </div>
              </>
            )}

            {!isGuest && (
              <button
                onClick={onNotificationClick}
                className="relative p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
                aria-label="Notifications"
              >
                <Bell className="w-5 h-5 text-neutral-500 dark:text-neutral-400" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  )
})

// TODAY'S MISSION - The core component (NOT a chat box)
const TodaysMission = memo(function TodaysMission({
  mission,
  roadmap,
  onStartMission,
  onViewRoadmap,
  isLoading,
}: {
  mission: Mission | null
  roadmap: Roadmap | null
  onStartMission: () => void
  onViewRoadmap: () => void
  isLoading: boolean
}) {
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

  return (
    <div className={`rounded-2xl border p-6 ${
      isRemediation
        ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/50'
        : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800'
    }`}>
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

        {mission.estimatedMinutes && (
          <div className="flex items-center gap-1 text-neutral-400">
            <Clock className="w-3.5 h-3.5" />
            <span className="text-xs">{mission.estimatedMinutes} min</span>
          </div>
        )}
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
      <div className="flex gap-3">
        <button
          onClick={onStartMission}
          className={`flex-1 flex items-center justify-center gap-2 py-3.5 font-semibold rounded-xl transition-colors ${
            isRemediation
              ? 'bg-amber-600 hover:bg-amber-700 text-white'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          <span>{isRemediation ? 'Begin Remediation' : 'Start Mission'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>

        {hasRoadmap && (
          <button
            onClick={onViewRoadmap}
            className="px-4 py-3.5 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-medium rounded-xl transition-colors"
          >
            View Plan
          </button>
        )}
      </div>
    </div>
  )
})

// ONBOARDING - When user has no roadmap (NOT a blank chat)
const OnboardingPrompt = memo(function OnboardingPrompt({
  onSubmitGoal,
  isLoading,
}: {
  onSubmitGoal: (goal: string) => void
  isLoading: boolean
}) {
  const [goal, setGoal] = useState('')

  const handleSubmit = () => {
    if (goal.trim().length >= 10) {
      onSubmitGoal(goal.trim())
    }
  }

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6">
      {/* Header - Directive, not question */}
      <div className="text-center mb-6">
        <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <Target className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        </div>
        <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">
          Define Your Learning Goal
        </h2>
        <p className="text-neutral-500 dark:text-neutral-400">
          Be specific. Vague goals create vague results.
        </p>
      </div>

      {/* Examples - Show what good looks like */}
      <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-xl p-4 mb-4">
        <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-2">
          Good examples
        </p>
        <ul className="space-y-1.5 text-sm text-neutral-600 dark:text-neutral-400">
          <li>"Master React hooks in 2 weeks"</li>
          <li>"Pass my calculus exam on Friday"</li>
          <li>"Learn conversational Spanish basics"</li>
        </ul>
      </div>

      {/* Input - Structured, not blank chat */}
      <div className="space-y-3">
        <textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="I want to learn..."
          disabled={isLoading}
          rows={3}
          className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl px-4 py-3 text-neutral-900 dark:text-white placeholder-neutral-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
        />

        <button
          onClick={handleSubmit}
          disabled={goal.trim().length < 10 || isLoading}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-300 dark:disabled:bg-neutral-700 text-white font-semibold rounded-xl transition-colors disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <span>Create My Roadmap</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>

        {goal.trim().length > 0 && goal.trim().length < 10 && (
          <p className="text-xs text-amber-600 dark:text-amber-400 text-center">
            Be more specific. Good goals are at least a sentence.
          </p>
        )}
      </div>
    </div>
  )
})

// PROOF SUBMISSION - For completing missions
const ProofSubmission = memo(function ProofSubmission({
  mission,
  onSubmit,
  onBack,
  isLoading,
}: {
  mission: Mission
  onSubmit: (proof: { type: string; content: string; score?: number }) => void
  onBack: () => void
  isLoading: boolean
}) {
  const [content, setContent] = useState('')
  const [selfScore, setSelfScore] = useState<number | null>(null)

  const handleSubmit = () => {
    onSubmit({
      type: mission.proofRequired,
      content: content.trim(),
      score: selfScore || undefined,
    })
  }

  const isValid = content.trim().length >= 20 || mission.proofRequired === 'self_report'

  return (
    <div className="space-y-4">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        <span className="text-sm">Back to mission</span>
      </button>

      <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6">
        <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">
          Submit Your Proof
        </h3>
        <p className="text-neutral-500 dark:text-neutral-400 mb-4">
          {mission.criteria.description}
        </p>

        {/* Different proof types */}
        {mission.proofRequired === 'explanation' && (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Explain in your own words
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Without looking at notes, explain the concept..."
              rows={5}
              disabled={isLoading}
              className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl px-4 py-3 text-neutral-900 dark:text-white placeholder-neutral-400 outline-none focus:border-blue-500 resize-none"
            />
            <p className="text-xs text-neutral-400">
              {content.length}/20 characters minimum
            </p>
          </div>
        )}

        {mission.proofRequired === 'self_report' && (
          <div className="space-y-4">
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Did you complete the mission requirements?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setContent('completed')}
                className={`flex-1 py-3 rounded-xl font-medium transition-colors ${
                  content === 'completed'
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-2 border-green-500'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border-2 border-transparent'
                }`}
              >
                <CheckCircle2 className="w-5 h-5 mx-auto mb-1" />
                Yes, completed
              </button>
              <button
                onClick={() => setContent('struggled')}
                className={`flex-1 py-3 rounded-xl font-medium transition-colors ${
                  content === 'struggled'
                    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-2 border-amber-500'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border-2 border-transparent'
                }`}
              >
                <AlertTriangle className="w-5 h-5 mx-auto mb-1" />
                I struggled
              </button>
            </div>
          </div>
        )}

        {mission.proofRequired === 'quiz' && (
          <div className="space-y-4">
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              What was your quiz score?
            </p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="100"
                value={selfScore || ''}
                onChange={(e) => {
                  setSelfScore(Number(e.target.value))
                  setContent(`Score: ${e.target.value}%`)
                }}
                placeholder="0"
                className="w-20 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-center text-lg font-semibold"
              />
              <span className="text-lg font-semibold text-neutral-600 dark:text-neutral-400">%</span>
            </div>
            {mission.criteria.threshold && (
              <p className="text-xs text-neutral-500">
                Required: {mission.criteria.threshold}% or higher
              </p>
            )}
          </div>
        )}

        {mission.proofRequired === 'submission' && (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Submit your work
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Describe what you completed or paste your work..."
              rows={5}
              disabled={isLoading}
              className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl px-4 py-3 text-neutral-900 dark:text-white placeholder-neutral-400 outline-none focus:border-blue-500 resize-none"
            />
          </div>
        )}

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={!isValid || isLoading}
          className="w-full mt-6 flex items-center justify-center gap-2 py-3.5 bg-green-600 hover:bg-green-700 disabled:bg-neutral-300 dark:disabled:bg-neutral-700 text-white font-semibold rounded-xl transition-colors disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Send className="w-4 h-4" />
              <span>Submit Proof</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
})

// ROADMAP VIEW - Full roadmap display
const RoadmapView = memo(function RoadmapView({
  roadmap,
  onBack,
}: {
  roadmap: Roadmap
  onBack: () => void
}) {
  const [expandedStep, setExpandedStep] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        <span className="text-sm">Back</span>
      </button>

      {/* Roadmap Header */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6">
        <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">
          {roadmap.title}
        </h2>
        {roadmap.overview && (
          <p className="text-neutral-500 dark:text-neutral-400 mb-4">
            {roadmap.overview}
          </p>
        )}

        {/* Progress */}
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-neutral-500">Progress</span>
          <span className="font-semibold text-neutral-900 dark:text-white">
            {roadmap.completedSteps}/{roadmap.totalSteps} steps
          </span>
        </div>
        <div className="h-2 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all duration-500"
            style={{ width: `${(roadmap.completedSteps / roadmap.totalSteps) * 100}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-2">
        {roadmap.steps.map((step) => {
          const isExpanded = expandedStep === step.id
          const isCurrent = step.status === 'current'
          const isCompleted = step.status === 'completed'
          const isLocked = step.status === 'locked'

          return (
            <div
              key={step.id}
              className={`rounded-xl border transition-all ${
                isCurrent
                  ? 'border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-950/20'
                  : isCompleted
                  ? 'border-green-200 dark:border-green-800/50 bg-green-50/30 dark:bg-green-950/10'
                  : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 opacity-60'
              }`}
            >
              <button
                onClick={() => !isLocked && setExpandedStep(isExpanded ? null : step.id)}
                disabled={isLocked}
                className="w-full flex items-start gap-3 p-4 text-left"
              >
                {/* Status Icon */}
                <div className={`mt-0.5 flex-shrink-0 ${
                  isCompleted ? 'text-green-500' : isCurrent ? 'text-blue-500' : 'text-neutral-300'
                }`}>
                  {isCompleted ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : isLocked ? (
                    <Lock className="w-5 h-5" />
                  ) : (
                    <Circle className="w-5 h-5" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {step.timeframe && (
                    <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                      {step.timeframe}
                    </span>
                  )}
                  <h4 className={`font-medium ${
                    isLocked ? 'text-neutral-400' : 'text-neutral-900 dark:text-white'
                  }`}>
                    {step.title}
                  </h4>
                  <p className="text-sm text-neutral-500 line-clamp-1">
                    {step.description}
                  </p>
                </div>

                {/* Expand Icon */}
                {!isLocked && (
                  <div className="text-neutral-400">
                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </div>
                )}
              </button>

              {/* Expanded Content */}
              {isExpanded && !isLocked && (
                <div className="px-4 pb-4 border-t border-neutral-100 dark:border-neutral-800">
                  <div className="pt-3 space-y-3">
                    {step.method && (
                      <div>
                        <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-1">How</p>
                        <p className="text-sm text-neutral-700 dark:text-neutral-300">{step.method}</p>
                      </div>
                    )}
                    {step.avoid && (
                      <div>
                        <p className="text-xs font-medium text-red-500 uppercase tracking-wide mb-1">Avoid</p>
                        <p className="text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/30 px-3 py-2 rounded-lg">
                          {step.avoid}
                        </p>
                      </div>
                    )}
                    {step.doneWhen && (
                      <div>
                        <p className="text-xs font-medium text-green-600 uppercase tracking-wide mb-1">Done When</p>
                        <p className="text-sm text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950/30 px-3 py-2 rounded-lg">
                          {step.doneWhen}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Pitfalls */}
      {roadmap.pitfalls && roadmap.pitfalls.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-800/50 p-4">
          <p className="text-xs font-medium text-amber-700 dark:text-amber-300 uppercase tracking-wide mb-2">
            Watch Out For
          </p>
          <ul className="space-y-1">
            {roadmap.pitfalls.map((pitfall, i) => (
              <li key={i} className="text-sm text-amber-800 dark:text-amber-200 flex items-start gap-2">
                <span className="text-amber-500">•</span>
                {pitfall}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Success */}
      {roadmap.successLooksLike && (
        <div className="bg-green-50 dark:bg-green-950/20 rounded-xl border border-green-200 dark:border-green-800/50 p-4">
          <p className="text-xs font-medium text-green-700 dark:text-green-300 uppercase tracking-wide mb-1">
            Success Looks Like
          </p>
          <p className="text-sm text-green-800 dark:text-green-200">
            {roadmap.successLooksLike}
          </p>
        </div>
      )}
    </div>
  )
})

// IDENTITY CARD - Shows user's learning identity (lock-in)
const IdentityCard = memo(function IdentityCard({
  identity,
  stats,
}: {
  identity: { archetype?: string; strengths: string[]; growthAreas: string[] }
  stats: { streak: number; points: number } | null
}) {
  if (!identity.archetype && identity.strengths.length === 0) {
    return null
  }

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          {identity.archetype && (
            <h3 className="text-lg font-bold text-indigo-900 dark:text-indigo-100">
              {identity.archetype}
            </h3>
          )}
          <p className="text-sm text-indigo-600 dark:text-indigo-400">
            Your learning identity
          </p>
        </div>
        <Trophy className="w-8 h-8 text-indigo-400" />
      </div>

      {identity.strengths.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300 uppercase tracking-wide mb-1.5">
            Your Strengths
          </p>
          <div className="flex flex-wrap gap-1.5">
            {identity.strengths.map((strength, i) => (
              <span
                key={i}
                className="text-xs bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 px-2 py-1 rounded-full"
              >
                {strength}
              </span>
            ))}
          </div>
        </div>
      )}

      {stats && stats.streak > 0 && (
        <div className="flex items-center gap-2 pt-2 border-t border-indigo-100 dark:border-indigo-800/50">
          <TrendingUp className="w-4 h-4 text-indigo-500" />
          <span className="text-sm text-indigo-700 dark:text-indigo-300">
            {stats.streak} day streak. Consistency builds mastery.
          </span>
        </div>
      )}
    </div>
  )
})

// ============================================
// MAIN COMPONENT
// ============================================

export default function DashboardPage() {
  const { user, loading } = useAuth()

  // Guest trial
  const { trialsRemaining, totalTrials, hasTrials, consumeTrial } = useGuestTrial()
  const [showTrialLimitModal, setShowTrialLimitModal] = useState(false)

  const isGuest = !user && !loading

  // View state
  const [viewState, setViewState] = useState<ViewState>('mission')
  const [isProcessing, setIsProcessing] = useState(false)
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)

  // Mission state
  const [currentMission, setCurrentMission] = useState<Mission | null>(null)

  // User progress (would come from database in production)
  const [userProgress, setUserProgress] = useState<UserProgress>({
    userId: user?.id || 'guest',
    weakSpots: [],
    patterns: {
      averageSessionMinutes: 15,
      preferredTime: 'morning',
      streakDays: 0,
      longestStreak: 0,
    },
    identity: {
      strengths: [],
      growthAreas: [],
      archetype: undefined,
    },
    recentMissions: [],
    lastActiveAt: new Date(),
  })

  // Active roadmap
  const {
    activeRoadmap: persistedRoadmap,
    isLoading: isRoadmapLoading,
    saveRoadmap,
    completeStep,
    refresh: refreshRoadmap,
  } = useActiveRoadmap()

  // Convert to UI format
  const activeRoadmap: Roadmap | null = persistedRoadmap ? {
    id: persistedRoadmap.id,
    title: persistedRoadmap.title,
    overview: persistedRoadmap.overview,
    goal: persistedRoadmap.goal,
    steps: persistedRoadmap.steps.map((step) => ({
      id: step.id,
      order: step.order,
      title: step.title,
      description: step.description,
      status: step.status === 'completed' ? 'completed' : step.status === 'current' ? 'current' : 'locked',
      duration: step.duration,
      timeframe: step.timeframe,
      method: step.method,
      avoid: step.avoid,
      doneWhen: step.doneWhen,
    })),
    currentStepIndex: persistedRoadmap.currentStepIndex,
    totalSteps: persistedRoadmap.totalSteps,
    completedSteps: persistedRoadmap.completedSteps,
    estimatedMinutes: persistedRoadmap.estimatedMinutes,
    pitfalls: persistedRoadmap.pitfalls,
    successLooksLike: persistedRoadmap.successLooksLike,
  } : null

  // Notifications
  const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false)
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0)

  // Ref for feedback timeout cleanup (prevents memory leaks)
  const feedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Cleanup feedback timeout on unmount
  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current)
      }
    }
  }, [])

  // Stats
  const { stats } = useDashboardStats()

  useUserSync()

  // ============================================
  // MISSION ENGINE INTEGRATION
  // ============================================

  // Decide mission when roadmap loads
  useEffect(() => {
    if (!isRoadmapLoading) {
      const currentStep = activeRoadmap?.steps.find(s => s.status === 'current') || null
      const roadmapForEngine = activeRoadmap ? {
        id: activeRoadmap.id,
        currentStep: currentStep ? {
          id: currentStep.id,
          order: currentStep.order,
          title: currentStep.title,
          description: currentStep.description,
          method: currentStep.method,
          avoid: currentStep.avoid,
          doneWhen: currentStep.doneWhen,
          duration: currentStep.duration || 10,
        } : null,
        totalSteps: activeRoadmap.totalSteps,
        completedSteps: activeRoadmap.completedSteps,
      } : null

      const decision = MissionEngine.decideNextMission(userProgress, roadmapForEngine)
      setCurrentMission(decision.mission)

      // Determine initial view
      if (!activeRoadmap && !isGuest) {
        setViewState('onboarding')
      } else {
        setViewState('mission')
      }
    }
  }, [isRoadmapLoading, activeRoadmap, userProgress, isGuest])

  // ============================================
  // HANDLERS
  // ============================================

  const handleStartMission = useCallback(() => {
    setViewState('proof')
  }, [])

  const handleViewRoadmap = useCallback(() => {
    setViewState('roadmap')
  }, [])

  const handleNotificationClick = useCallback(() => {
    setIsNotificationPanelOpen(true)
  }, [])

  const handleSubmitGoal = useCallback(async (goal: string) => {
    if (isGuest && !hasTrials) {
      setShowTrialLimitModal(true)
      return
    }

    setIsProcessing(true)

    try {
      const response = await fetch('/api/guide-me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: goal,
          struggleType: 'homework_help',
          actionType: 'roadmap',
        }),
      })

      const data = await response.json()

      if (response.status === 403 && data.trialExhausted) {
        setShowTrialLimitModal(true)
        return
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create roadmap')
      }

      // Save roadmap
      if (data.action?.type === 'roadmap' && data.action.steps?.length > 0) {
        await saveRoadmap({
          goal,
          title: data.action.title || 'Study Plan',
          overview: data.action.overview || data.action.encouragement,
          pitfalls: data.action.pitfalls || [],
          successLooksLike: data.action.successLooksLike,
          estimatedMinutes: data.action.totalMinutes,
          steps: data.action.steps.map((step: { order?: number; title?: string; description?: string; timeframe?: string; method?: string; avoid?: string; doneWhen?: string; duration?: number }, index: number) => ({
            order: step.order || index + 1,
            title: step.title || `Step ${index + 1}`,
            description: step.description || '',
            timeframe: step.timeframe,
            method: step.method,
            avoid: step.avoid,
            doneWhen: step.doneWhen,
            duration: step.duration || 5,
          })),
        })

        await refreshRoadmap()

        if (isGuest) {
          consumeTrial(goal, 'roadmap')
        }

        setViewState('mission')
        setFeedbackMessage('Roadmap created. Your journey begins now.')
        if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current)
        feedbackTimeoutRef.current = setTimeout(() => setFeedbackMessage(null), 3000)
      }

    } catch (err) {
      console.error('Error creating roadmap:', err)
      setFeedbackMessage('Failed to create roadmap. Try again.')
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current)
      feedbackTimeoutRef.current = setTimeout(() => setFeedbackMessage(null), 3000)
    } finally {
      setIsProcessing(false)
    }
  }, [isGuest, hasTrials, saveRoadmap, refreshRoadmap, consumeTrial])

  const handleSubmitProof = useCallback(async (proof: { type: string; content: string; score?: number }) => {
    if (!currentMission) return

    setIsProcessing(true)

    try {
      // Evaluate proof
      const result = MissionEngine.evaluateProof(currentMission, {
        type: proof.type as 'explanation' | 'quiz' | 'submission' | 'practice_set' | 'self_report',
        content: proof.content,
        score: proof.score,
      })

      // If linked to a roadmap step, complete it
      if (result.passed && currentMission.linkedStep) {
        await completeStep(currentMission.linkedStep.stepId)
        await refreshRoadmap()
      }

      // Update user progress
      const metadata = currentMission.metadata
      if (!result.passed && metadata?.relatedWeakSpot) {
        // Track failure
        setUserProgress(prev => ({
          ...prev,
          weakSpots: [
            ...prev.weakSpots.filter(ws => ws.topic !== metadata.relatedWeakSpot),
            {
              topic: metadata.relatedWeakSpot!,
              failCount: (metadata.failedAttempts || 0) + 1,
              lastAttempt: new Date(),
              resolved: false,
            },
          ],
        }))
      }

      // Show authority feedback
      setFeedbackMessage(result.feedback)
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current)
      feedbackTimeoutRef.current = setTimeout(() => setFeedbackMessage(null), 4000)

      // Return to mission view
      setViewState('mission')

    } catch (err) {
      console.error('Error submitting proof:', err)
      setFeedbackMessage('Submission failed. Try again.')
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current)
      feedbackTimeoutRef.current = setTimeout(() => setFeedbackMessage(null), 3000)
    } finally {
      setIsProcessing(false)
    }
  }, [currentMission, completeStep, refreshRoadmap])

  // ============================================
  // RENDER
  // ============================================

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-neutral-950">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 pb-24">
      {/* Modals */}
      <TrialLimitModal
        isOpen={showTrialLimitModal}
        onClose={() => setShowTrialLimitModal(false)}
      />

      {!isGuest && (
        <NotificationPanel
          isOpen={isNotificationPanelOpen}
          onClose={() => setIsNotificationPanelOpen(false)}
          onUnreadCountChange={setUnreadNotificationCount}
        />
      )}

      {/* Banners */}
      {isGuest && <TrialBanner trialsRemaining={trialsRemaining} totalTrials={totalTrials} />}
      <PWAInstallBanner variant="banner" />

      {/* Header */}
      <Header
        isGuest={isGuest}
        stats={stats}
        identity={userProgress.identity}
        onNotificationClick={handleNotificationClick}
        unreadCount={unreadNotificationCount}
      />

      {/* Feedback Toast */}
      {feedbackMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 px-4 py-2 rounded-xl shadow-lg text-sm font-medium animate-in slide-in-from-top-2 fade-in duration-200">
          {feedbackMessage}
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* MISSION VIEW - Default, shows today's mission */}
        {viewState === 'mission' && (
          <>
            {/* Identity Card - only for users with established identity */}
            {!isGuest && userProgress.identity.archetype && (
              <IdentityCard identity={userProgress.identity} stats={stats} />
            )}

            {/* Today's Mission - THE CORE */}
            <TodaysMission
              mission={currentMission}
              roadmap={activeRoadmap}
              onStartMission={handleStartMission}
              onViewRoadmap={handleViewRoadmap}
              isLoading={isRoadmapLoading}
            />

            {/* Mission Chat - Contextual help, clickable suggestions */}
            {currentMission && (
              <SectionErrorBoundary section="chat" fallbackMessage="Chat assistance is temporarily unavailable.">
                <MissionChat
                  missionTitle={currentMission.title}
                  missionContext={currentMission.directive}
                  isGuest={isGuest}
                  onTrialExhausted={() => setShowTrialLimitModal(true)}
                />
              </SectionErrorBoundary>
            )}
          </>
        )}

        {/* ONBOARDING VIEW - No blank chat, structured goal input */}
        {viewState === 'onboarding' && (
          <OnboardingPrompt
            onSubmitGoal={handleSubmitGoal}
            isLoading={isProcessing}
          />
        )}

        {/* PROOF VIEW - Submit proof for mission */}
        {viewState === 'proof' && currentMission && (
          <ProofSubmission
            mission={currentMission}
            onSubmit={handleSubmitProof}
            onBack={() => setViewState('mission')}
            isLoading={isProcessing}
          />
        )}

        {/* ROADMAP VIEW - Full roadmap display */}
        {viewState === 'roadmap' && activeRoadmap && (
          <RoadmapView
            roadmap={activeRoadmap}
            onBack={() => setViewState('mission')}
          />
        )}
      </main>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  )
}
