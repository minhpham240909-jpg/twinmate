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
import { useMissionReminder } from '@/hooks/useMissionReminder'
import { MissionEngine, type Mission, type UserProgress } from '@/lib/mission-engine'
import MissionChat from '@/components/MissionChat'
import { SectionErrorBoundary } from '@/components/SectionErrorBoundary'
import BottomNav from '@/components/BottomNav'
import TrialLimitModal from '@/components/TrialLimitModal'
import TrialBanner from '@/components/TrialBanner'
import PWAInstallBanner from '@/components/PWAInstallBanner'
import NotificationPanel from '@/components/NotificationPanel'
import ProgressToast from '@/components/ProgressToast'
import { useProgressFeedback } from '@/hooks/useProgressFeedback'
import ResourceCard from '@/components/ResourceCard'
import { RoadmapVisualizer } from '@/components/roadmap'
// Extracted dashboard components
import {
  DashboardHeader,
  TodaysMission,
  IdentityCard,
  SkillProgressCard,
  StruggleNudge,
  DashboardCelebrationModal,
  OnboardingPrompt,
  ProofSubmission,
  IdentityDiscovery,
  IdentityReveal,
  type ViewState,
  type StepResource,
  type RoadmapStep,
  type RecommendedPlatform,
  type Roadmap,
  type AdaptiveFeedback,
  getDaysRemaining,
  calculateLevel,
} from '@/components/dashboard'
// Hooks for skill progress and struggle detection
import { useSkillProgress } from '@/hooks/useSkillProgress'
import { useStruggleDetection } from '@/hooks/useStruggleDetection'
import Image from 'next/image'
import {
  Loader2,
  ChevronLeft,
  CheckCircle2,
  Lock,
  AlertTriangle,
  Target,
  Clock,
  Zap,
  Trophy,
  ChevronDown,
  ChevronUp,
  Trash2,
  ExternalLink,
  BookOpen,
  HelpCircle,
  Lightbulb,
  MessageCircle,
  X,
  Bell,
  Calendar,
  ArrowRight,
  Video,
  FileText,
  Link2,
  Image as ImageIcon,
  Upload,
  Send,
  TrendingUp,
} from 'lucide-react'

// ============================================
// MEMOIZED COMPONENTS
// ============================================

// NOTE: The following components have been extracted to @/components/dashboard:
// - DashboardHeader (Header)
// - TodaysMission
// - OnboardingPrompt
// - ProofSubmission
// - IdentityCard
// - DashboardCelebrationModal (CelebrationModal)
// Types and utils also moved to @/components/dashboard/types.ts and utils.ts

// ============================================
// INLINE COMPONENTS (RoadmapView kept here due to complexity)
// ============================================

// Placeholder to maintain file structure - remove old Header
const _Header_REMOVED = memo(function Header({
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
  // Calculate level data
  const levelData = stats ? calculateLevel(stats.points) : null

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
            {!isGuest && stats && levelData && (
              <>
                {/* Streak badge */}
                {stats.streak > 0 && (
                  <div
                    className="relative group flex items-center gap-1 px-2 py-1 bg-amber-50 dark:bg-amber-950/30 rounded-lg cursor-help"
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                      {stats.streak}
                    </span>
                    {/* Tooltip */}
                    <div className="absolute top-full right-0 mt-1 px-3 py-2 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50">
                      Daily streak: {stats.streak} day{stats.streak > 1 ? 's' : ''} in a row
                      <div className="absolute -top-1 right-3 w-2 h-2 bg-neutral-900 dark:bg-white rotate-45" />
                    </div>
                  </div>
                )}

                {/* Level badge with progress bar */}
                <div
                  className="relative group flex items-center gap-1.5 px-2 py-1 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-lg cursor-help border border-blue-100 dark:border-blue-900/50"
                >
                  {/* Level number with ring */}
                  <div className="relative">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-white">
                        {levelData.level}
                      </span>
                    </div>
                    {/* Progress ring (simplified) */}
                    <svg className="absolute -inset-0.5 w-6 h-6 -rotate-90">
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="text-blue-200 dark:text-blue-900/50"
                      />
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeDasharray={`${levelData.progress * 0.628} 100`}
                        className="text-blue-500"
                      />
                    </svg>
                  </div>

                  <div className="flex flex-col">
                    <span className="text-[10px] font-semibold text-blue-700 dark:text-blue-300 leading-tight">
                      Level {levelData.level}
                    </span>
                    <span className="text-[9px] text-blue-500 dark:text-blue-400 leading-tight">
                      {levelData.currentXP}/{levelData.xpForNextLevel} XP
                    </span>
                  </div>

                  {/* Detailed tooltip */}
                  <div className="absolute top-full right-0 mt-1 px-3 py-2.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 min-w-[160px]">
                    <div className="font-semibold mb-1">Level {levelData.level}</div>
                    <div className="text-neutral-400 dark:text-neutral-600 text-[11px] mb-2">
                      {stats.points} total XP earned
                    </div>
                    {/* Mini progress bar */}
                    <div className="h-1.5 bg-neutral-700 dark:bg-neutral-200 rounded-full overflow-hidden mb-1">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all duration-500"
                        style={{ width: `${levelData.progress}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-neutral-500 dark:text-neutral-500">
                      {levelData.xpForNextLevel - levelData.currentXP} XP to Level {levelData.level + 1}
                    </div>
                    <div className="absolute -top-1 right-3 w-2 h-2 bg-neutral-900 dark:bg-white rotate-45" />
                  </div>
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
// OLD - Now imported from @/components/dashboard
const _OLD_TodaysMission = memo(function _OLD_TodaysMission({
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

// Input type for learning materials
// OLD - InputMaterial now imported from @/components/dashboard
type _OLD_InputMaterial = {
  type: 'url' | 'image' | 'none'
  value: string
  preview?: string
}

// OLD - QUICK_SUGGESTIONS now imported from @/components/dashboard
const _OLD_QUICK_SUGGESTIONS = [
  { label: 'Learn a new skill', goal: 'Learn ' },
  { label: 'Pass an exam', goal: 'Pass my ' },
  { label: 'Master a topic', goal: 'Master ' },
  { label: 'Build something', goal: 'Build a ' },
]

// ONBOARDING - Guidance first, no configuration
// OLD - Now imported from @/components/dashboard
const _OLD_OnboardingPrompt = memo(function _OLD_OnboardingPrompt({
  onSubmitGoal,
  isLoading,
  suggestedGoal,
}: {
  onSubmitGoal: (goal: string, inputUrl?: string, inputImage?: string) => void
  isLoading: boolean
  suggestedGoal?: string | null
}) {
  const [goal, setGoal] = useState('')
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [inputMaterial, setInputMaterial] = useState<_OLD_InputMaterial>({ type: 'none', value: '' })
  const [showInputOptions, setShowInputOptions] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = () => {
    if (goal.trim().length >= 10) {
      const inputUrl = inputMaterial.type === 'url' ? inputMaterial.value : undefined
      const inputImage = inputMaterial.type === 'image' ? inputMaterial.value : undefined
      // Enhancement happens silently on the backend - no user choice
      onSubmitGoal(goal.trim(), inputUrl, inputImage)
    }
  }

  const handleSuggestionClick = (suggestion: string) => {
    setGoal(suggestion)
    setShowCustomInput(true)
    // Focus the input after state updates
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const handleStartSuggested = () => {
    if (suggestedGoal) {
      onSubmitGoal(suggestedGoal)
    }
  }

  const handleUrlAdd = () => {
    if (urlInput.trim()) {
      const url = urlInput.trim()
      setInputMaterial({
        type: 'url',
        value: url,
        preview: url.length > 50 ? url.slice(0, 50) + '...' : url,
      })
      setUrlInput('')
      setShowInputOptions(false)
    }
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64 = reader.result as string
        setInputMaterial({
          type: 'image',
          value: base64,
          preview: file.name,
        })
        setShowInputOptions(false)
      }
      reader.readAsDataURL(file)
    }
  }

  const clearInput = () => {
    setInputMaterial({ type: 'none', value: '' })
  }

  const getInputTypeLabel = (url: string): string => {
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'YouTube Video'
    if (url.endsWith('.pdf')) return 'PDF Document'
    return 'Web Page'
  }

  // If we have a suggested goal (returning user), show recommendation first
  if (suggestedGoal && !showCustomInput) {
    return (
      <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6">
        {/* Recommendation Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <Zap className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">
            Ready to Continue?
          </h2>
          <p className="text-neutral-500 dark:text-neutral-400">
            We recommend picking up where you left off.
          </p>
        </div>

        {/* Suggested Goal Card */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-4">
          <p className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-1">
            Suggested Goal
          </p>
          <p className="text-neutral-800 dark:text-neutral-200 font-medium">
            {suggestedGoal}
          </p>
        </div>

        {/* Action Buttons - Primary action is clear */}
        <div className="space-y-3">
          <button
            onClick={handleStartSuggested}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-300 dark:disabled:bg-neutral-700 text-white font-semibold rounded-xl transition-colors"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <span>Start</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          {/* Secondary - Less prominent */}
          <button
            onClick={() => setShowCustomInput(true)}
            className="w-full py-2.5 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 text-sm transition-colors"
          >
            Something else
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6">
      {/* Header - Guidance focused */}
      <div className="text-center mb-6">
        <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <Target className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        </div>
        <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">
          What do you want to learn?
        </h2>
        <p className="text-neutral-500 dark:text-neutral-400">
          Tell us your goal. We&apos;ll handle the rest.
        </p>
      </div>

      {/* Quick Start Suggestions - Clickable chips */}
      {!showCustomInput && goal.length === 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-2">
            Quick Start
          </p>
          <div className="flex flex-wrap gap-2">
            {_OLD_QUICK_SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion.label}
                onClick={() => handleSuggestionClick(suggestion.goal)}
                className="px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-neutral-700 dark:text-neutral-300 hover:text-blue-700 dark:hover:text-blue-300 text-sm rounded-full transition-colors"
              >
                {suggestion.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input - Simple, no magic wand */}
      <div className="space-y-3">
        <textarea
          ref={inputRef}
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          onFocus={() => setShowCustomInput(true)}
          placeholder="I want to learn..."
          disabled={isLoading}
          rows={3}
          className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl px-4 py-3 text-neutral-900 dark:text-white placeholder-neutral-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
        />

        {/* Input Material Section - Simplified */}
        {inputMaterial.type !== 'none' ? (
          <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl">
            {inputMaterial.type === 'url' && (
              <>
                {inputMaterial.value.includes('youtube') || inputMaterial.value.includes('youtu.be') ? (
                  <Video className="w-4 h-4 text-red-500 flex-shrink-0" />
                ) : inputMaterial.value.endsWith('.pdf') ? (
                  <FileText className="w-4 h-4 text-orange-500 flex-shrink-0" />
                ) : (
                  <Link2 className="w-4 h-4 text-blue-500 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
                    {getInputTypeLabel(inputMaterial.value)}
                  </p>
                  <p className="text-xs text-neutral-500 truncate">{inputMaterial.preview}</p>
                </div>
              </>
            )}
            {inputMaterial.type === 'image' && (
              <>
                <ImageIcon className="w-4 h-4 text-purple-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-purple-600 dark:text-purple-400">Image</p>
                  <p className="text-xs text-neutral-500 truncate">{inputMaterial.preview}</p>
                </div>
              </>
            )}
            <button
              onClick={clearInput}
              className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-full transition-colors"
            >
              <X className="w-4 h-4 text-neutral-500" />
            </button>
          </div>
        ) : showCustomInput && (
          <>
            {!showInputOptions && (
              <button
                onClick={() => setShowInputOptions(true)}
                className="w-full flex items-center justify-center gap-2 py-2 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 text-sm transition-colors"
              >
                <Upload className="w-4 h-4" />
                <span>Add material (optional)</span>
              </button>
            )}

            {showInputOptions && (
              <div className="border border-neutral-200 dark:border-neutral-700 rounded-xl p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
                    Add Material
                  </p>
                  <button
                    onClick={() => setShowInputOptions(false)}
                    className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full"
                  >
                    <X className="w-4 h-4 text-neutral-400" />
                  </button>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="Paste URL or YouTube link..."
                    className="flex-1 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-900 dark:text-white placeholder-neutral-400 outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={handleUrlAdd}
                    disabled={!urlInput.trim()}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-300 dark:disabled:bg-neutral-700 text-white text-sm font-medium rounded-lg transition-colors disabled:cursor-not-allowed"
                  >
                    Add
                  </button>
                </div>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg text-neutral-700 dark:text-neutral-300 text-sm transition-colors"
                >
                  <ImageIcon className="w-4 h-4" />
                  <span>Upload Image</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </div>
            )}
          </>
        )}

        {/* Primary Action - Single clear button */}
        <button
          onClick={handleSubmit}
          disabled={goal.trim().length < 10 || isLoading}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-300 dark:disabled:bg-neutral-700 text-white font-semibold rounded-xl transition-colors disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <span>Create Roadmap</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>

        {goal.trim().length > 0 && goal.trim().length < 10 && (
          <p className="text-xs text-amber-600 dark:text-amber-400 text-center">
            Add a bit more detail
          </p>
        )}
      </div>
    </div>
  )
})

// PROOF SUBMISSION - For completing missions
// OLD - Now imported from @/components/dashboard
const _OLD_ProofSubmission = memo(function _OLD_ProofSubmission({
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

// ROADMAP VIEW - Clerva GPS Style
// Philosophy: Show only what matters NOW. Future steps hidden until earned.
// AdaptiveFeedback type is imported from @/components/dashboard

const RoadmapView = memo(function RoadmapView({
  roadmap,
  onBack,
  onDelete,
  isDeleting,
  onRefine,
  onStepComplete,
}: {
  roadmap: Roadmap
  onBack: () => void
  onDelete: () => void
  isDeleting: boolean
  onRefine?: (type: 'faster_pace' | 'more_depth' | 'different_focus') => Promise<void>
  onStepComplete?: (stepId: string) => Promise<void>
}) {
  const [showAllSteps, setShowAllSteps] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showHelpPanel, setShowHelpPanel] = useState(false)
  const [isLoadingHelp, setIsLoadingHelp] = useState(false)
  const [adaptiveFeedback, setAdaptiveFeedback] = useState<AdaptiveFeedback | null>(null)
  const [isRefining, setIsRefining] = useState(false)
  const [refiningType, setRefiningType] = useState<string | null>(null)

  // Handle refinement
  const handleRefine = async (type: 'faster_pace' | 'more_depth' | 'different_focus') => {
    if (!onRefine || isRefining) return
    setIsRefining(true)
    setRefiningType(type)
    try {
      await onRefine(type)
    } finally {
      setIsRefining(false)
      setRefiningType(null)
    }
  }

  // Find current step
  const currentStep = roadmap.steps.find(s => s.status === 'current')
  const completedSteps = roadmap.steps.filter(s => s.status === 'completed')
  const lockedSteps = roadmap.steps.filter(s => s.status === 'locked')

  // Transform steps for visual component
  const visualSteps = roadmap.steps.map(step => ({
    ...step,
    isLocked: step.status === 'locked',
  }))
  const completedStepIds = completedSteps.map(s => s.id)
  const currentStepIndex = roadmap.steps.findIndex(s => s.status === 'current')

  // AI auto-selects view based on roadmap size - no user choice needed
  // Use visual view (Timeline/Flow) for 4+ steps for better navigation
  const viewMode = roadmap.steps.length >= 4 ? 'visual' : 'detail'

  // Request adaptive feedback
  const requestHelp = async (struggleType: 'confused' | 'stuck' | 'overwhelmed' | 'too_hard') => {
    if (!currentStep) return

    setIsLoadingHelp(true)
    setShowHelpPanel(true)

    try {
      const response = await fetch('/api/roadmap/step/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stepId: currentStep.id,
          roadmapId: roadmap.id,
          struggleType,
        }),
      })

      const data = await response.json()

      if (response.ok && data.feedback) {
        setAdaptiveFeedback(data.feedback)
      }
    } catch (err) {
      console.error('Error getting help:', err)
    } finally {
      setIsLoadingHelp(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Back Button - Simple, no toggles */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        <span className="text-sm">Back to Mission</span>
      </button>

      {/* VISUAL VIEW - New Timeline/Flow visualization */}
      {viewMode === 'visual' ? (
        <>
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6">
            <RoadmapVisualizer
              roadmapId={roadmap.id}
              steps={visualSteps}
              currentStepIndex={currentStepIndex >= 0 ? currentStepIndex : 0}
              completedStepIds={completedStepIds}
              title={roadmap.title}
              overview={roadmap.overview}
              estimatedDays={roadmap.estimatedDays}
              dailyCommitment={roadmap.dailyCommitment}
              totalMinutes={roadmap.estimatedMinutes}
              successLooksLike={roadmap.successLooksLike}
              // Vision & Strategy fields
              vision={roadmap.vision}
              targetUser={roadmap.targetUser}
              successMetrics={roadmap.successMetrics}
              outOfScope={roadmap.outOfScope}
              criticalWarning={roadmap.criticalWarning}
              showVisionBanner={true}
              onStepClick={(stepId) => {
                // Could add step selection logic here
                console.log('Step clicked:', stepId)
              }}
              onResourceClick={(resource, stepId) => {
                // Track resource click
                console.log('Resource clicked:', resource.title, 'in step:', stepId)
              }}
              onStepComplete={onStepComplete}
              showViewToggle={false}
            />
          </div>

          {/* Delete Roadmap Section - Visual View */}
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4">
            {!showDeleteConfirm ? (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full flex items-center justify-center gap-2 py-3 text-sm text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete this roadmap</span>
              </button>
            ) : (
              <div className="bg-red-50 dark:bg-red-950/30 rounded-xl p-4 border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-700 dark:text-red-300 mb-3">
                  Are you sure you want to delete this roadmap? This action cannot be undone.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={isDeleting}
                    className="flex-1 py-2 px-3 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onDelete()
                      setShowDeleteConfirm(false)
                    }}
                    disabled={isDeleting}
                    className="flex-1 py-2 px-3 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isDeleting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        <span>Delete</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
      {/* POST-ACTION REFINEMENT BAR - Appears after roadmap is created */}
      <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-xl p-3 mb-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            {isRefining ? 'Refining roadmap...' : 'Refine this roadmap'}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleRefine('faster_pace')}
              disabled={isRefining}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                isRefining
                  ? 'text-neutral-400 dark:text-neutral-600 cursor-not-allowed'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
              }`}
            >
              {refiningType === 'faster_pace' ? (
                <span className="flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Speeding up...
                </span>
              ) : (
                'Faster pace'
              )}
            </button>
            <button
              onClick={() => handleRefine('more_depth')}
              disabled={isRefining}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                isRefining
                  ? 'text-neutral-400 dark:text-neutral-600 cursor-not-allowed'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
              }`}
            >
              {refiningType === 'more_depth' ? (
                <span className="flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Adding depth...
                </span>
              ) : (
                'More depth'
              )}
            </button>
            <button
              onClick={() => handleRefine('different_focus')}
              disabled={isRefining}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                isRefining
                  ? 'text-neutral-400 dark:text-neutral-600 cursor-not-allowed'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
              }`}
            >
              {refiningType === 'different_focus' ? (
                <span className="flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Changing focus...
                </span>
              ) : (
                'Different focus'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Roadmap Header - Authority Style */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
            <Target className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-neutral-900 dark:text-white">
              {roadmap.title}
            </h2>
            {roadmap.overview && (
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                {roadmap.overview}
              </p>
            )}
          </div>
        </div>

        {/* Progress Bar - Minimal */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-500"
              style={{ width: `${(roadmap.completedSteps / roadmap.totalSteps) * 100}%` }}
            />
          </div>
          <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
            {roadmap.completedSteps}/{roadmap.totalSteps}
          </span>
        </div>

        {/* Recommended Platforms */}
        {roadmap.recommendedPlatforms && roadmap.recommendedPlatforms.length > 0 && (
          <div className="mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-800">
            <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-3">
              Recommended Learning Platforms
            </p>
            <div className="grid grid-cols-3 gap-2">
              {roadmap.recommendedPlatforms.slice(0, 3).map((platform) => (
                <a
                  key={platform.id}
                  href={platform.searchUrl || platform.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex flex-col items-center p-3 bg-neutral-50 dark:bg-neutral-800 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-xl mb-2 shadow-sm"
                    style={{ backgroundColor: `${platform.color}15` }}
                  >
                    {platform.icon}
                  </div>
                  <span className="text-xs font-medium text-neutral-800 dark:text-neutral-200 text-center line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {platform.name}
                  </span>
                  <ExternalLink className="w-3 h-3 text-neutral-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* CURRENT STEP - Prominent Focus */}
      {currentStep && (
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border-2 border-blue-400 dark:border-blue-600 p-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-bold">{currentStep.order}</span>
            </div>
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
              Current Step
            </span>
            {currentStep.timeframe && (
              <span className="text-xs text-neutral-500 ml-auto">{currentStep.timeframe}</span>
            )}
          </div>

          <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">
            {currentStep.title}
          </h3>
          <p className="text-neutral-600 dark:text-neutral-400 mb-4">
            {currentStep.description}
          </p>

          {/* Method - How to do it */}
          {currentStep.method && (
            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-4 mb-3">
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide mb-1">
                Method
              </p>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                {currentStep.method}
              </p>
            </div>
          )}

          {/* RISK Warning - Prominent */}
          {currentStep.avoid && (
            <div className="bg-red-50 dark:bg-red-950/30 rounded-xl p-4 mb-3 border border-red-200 dark:border-red-800">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <p className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide">
                  Risk - Avoid This
                </p>
              </div>
              <p className="text-sm text-red-700 dark:text-red-300">
                {currentStep.avoid}
              </p>
            </div>
          )}

          {/* Done When - Success Criterion */}
          {currentStep.doneWhen && (
            <div className="bg-green-50 dark:bg-green-950/30 rounded-xl p-4 border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <p className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wide">
                  Done When
                </p>
              </div>
              <p className="text-sm text-green-700 dark:text-green-300">
                {currentStep.doneWhen}
              </p>
            </div>
          )}

          {/* Resources - Suggested learning materials with tracking */}
          {currentStep.resources && currentStep.resources.length > 0 && (
            <div className="bg-indigo-50 dark:bg-indigo-950/30 rounded-xl p-4 mt-3 border border-indigo-200 dark:border-indigo-800">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="w-4 h-4 text-indigo-500" />
                <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">
                  Suggested Resources
                </p>
              </div>
              <div className="space-y-2">
                {currentStep.resources.map((resource, idx) => (
                  <ResourceCard
                    key={idx}
                    resource={resource}
                    subject={roadmap?.goal}
                    stepTitle={currentStep.title}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Duration */}
          {currentStep.duration && (
            <div className="flex items-center gap-2 mt-4 text-sm text-neutral-500">
              <Clock className="w-4 h-4" />
              <span>Estimated: {currentStep.duration} minutes</span>
            </div>
          )}

          {/* Mark as Complete Button */}
          {onStepComplete && (
            <button
              onClick={() => onStepComplete(currentStep.id)}
              className="w-full mt-4 py-3 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 font-medium text-sm hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors rounded-xl"
            >
              I have completed this step
            </button>
          )}

          {/* Need Help Button */}
          {!showHelpPanel && (
            <button
              onClick={() => setShowHelpPanel(true)}
              className="flex items-center gap-2 mt-4 px-3 py-2 text-sm text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-lg transition-colors"
            >
              <HelpCircle className="w-4 h-4" />
              <span>Struggling with this step?</span>
            </button>
          )}

          {/* Help Panel - Adaptive Feedback */}
          {showHelpPanel && (
            <div className="mt-4 bg-amber-50 dark:bg-amber-950/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
              {!adaptiveFeedback && !isLoadingHelp && (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <MessageCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                        What&apos;s blocking you?
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setShowHelpPanel(false)
                        setAdaptiveFeedback(null)
                      }}
                      className="p-1 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded-full"
                    >
                      <X className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => requestHelp('confused')}
                      className="p-3 text-left bg-white dark:bg-neutral-900 rounded-lg border border-amber-200 dark:border-amber-800 hover:border-amber-400 dark:hover:border-amber-600 transition-colors"
                    >
                      <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">I&apos;m confused</p>
                      <p className="text-xs text-neutral-500 mt-0.5">Don&apos;t understand what to do</p>
                    </button>
                    <button
                      onClick={() => requestHelp('stuck')}
                      className="p-3 text-left bg-white dark:bg-neutral-900 rounded-lg border border-amber-200 dark:border-amber-800 hover:border-amber-400 dark:hover:border-amber-600 transition-colors"
                    >
                      <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">I&apos;m stuck</p>
                      <p className="text-xs text-neutral-500 mt-0.5">Know what to do, can&apos;t progress</p>
                    </button>
                    <button
                      onClick={() => requestHelp('overwhelmed')}
                      className="p-3 text-left bg-white dark:bg-neutral-900 rounded-lg border border-amber-200 dark:border-amber-800 hover:border-amber-400 dark:hover:border-amber-600 transition-colors"
                    >
                      <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">It&apos;s too much</p>
                      <p className="text-xs text-neutral-500 mt-0.5">Feels overwhelming</p>
                    </button>
                    <button
                      onClick={() => requestHelp('too_hard')}
                      className="p-3 text-left bg-white dark:bg-neutral-900 rounded-lg border border-amber-200 dark:border-amber-800 hover:border-amber-400 dark:hover:border-amber-600 transition-colors"
                    >
                      <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">It&apos;s too hard</p>
                      <p className="text-xs text-neutral-500 mt-0.5">Beyond my current level</p>
                    </button>
                  </div>
                </>
              )}

              {isLoadingHelp && (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
                </div>
              )}

              {adaptiveFeedback && !isLoadingHelp && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Lightbulb className="w-4 h-4 text-amber-500" />
                      <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                        Here&apos;s some help
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setShowHelpPanel(false)
                        setAdaptiveFeedback(null)
                      }}
                      className="p-1 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded-full"
                    >
                      <X className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    </button>
                  </div>

                  {/* Encouragement */}
                  <p className="text-sm text-amber-800 dark:text-amber-200 italic">
                    &quot;{adaptiveFeedback.encouragement}&quot;
                  </p>

                  {/* Tips */}
                  {adaptiveFeedback.tips.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wide mb-2">
                        Try this
                      </p>
                      <ul className="space-y-1.5">
                        {adaptiveFeedback.tips.map((tip, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-amber-900 dark:text-amber-100">
                            <span className="text-amber-500 font-bold mt-0.5">•</span>
                            <span>{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Alternative Approach */}
                  {adaptiveFeedback.alternativeApproach && (
                    <div className="bg-white dark:bg-neutral-900 rounded-lg p-3 border border-amber-200 dark:border-amber-800">
                      <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wide mb-1">
                        Alternative Approach
                      </p>
                      <p className="text-sm text-neutral-700 dark:text-neutral-300">
                        {adaptiveFeedback.alternativeApproach}
                      </p>
                    </div>
                  )}

                  {/* Breakdown Preview */}
                  {adaptiveFeedback.breakdownSuggested && adaptiveFeedback.breakdownPreview && (
                    <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                      <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide mb-2">
                        Suggested Breakdown
                      </p>
                      <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                        {adaptiveFeedback.breakdownPreview.title}
                      </p>
                      <ol className="space-y-1">
                        {adaptiveFeedback.breakdownPreview.substeps.map((substep, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-blue-700 dark:text-blue-300">
                            <span className="font-semibold text-blue-500">{idx + 1}.</span>
                            <span>{substep}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {/* Resources */}
                  {adaptiveFeedback.resources && adaptiveFeedback.resources.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wide mb-2">
                        Helpful Resources
                      </p>
                      <div className="space-y-2">
                        {adaptiveFeedback.resources.map((resource, idx) => (
                          <a
                            key={idx}
                            href={`https://www.google.com/search?q=${encodeURIComponent(resource.searchQuery)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 p-2 bg-white dark:bg-neutral-900 rounded-lg border border-amber-200 dark:border-amber-800 hover:border-amber-400 dark:hover:border-amber-600 transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-amber-500" />
                            <span className="text-sm text-neutral-700 dark:text-neutral-300">
                              {resource.title}
                            </span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Ask Again Button */}
                  <button
                    onClick={() => setAdaptiveFeedback(null)}
                    className="w-full py-2 text-sm text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded-lg transition-colors"
                  >
                    Still stuck? Try a different approach
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Completed Steps - Collapsed by default */}
      {completedSteps.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wide px-1">
            Completed ({completedSteps.length})
          </p>
          {completedSteps.map((step) => (
            <div
              key={step.id}
              className="flex items-center gap-3 p-3 bg-green-50/50 dark:bg-green-950/10 rounded-xl border border-green-200/50 dark:border-green-800/30"
            >
              <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
              <span className="text-sm text-green-700 dark:text-green-300 line-through opacity-70">
                {step.title}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Locked Steps - Hidden by default (Clerva GPS style) */}
      {lockedSteps.length > 0 && (
        <div>
          <button
            onClick={() => setShowAllSteps(!showAllSteps)}
            className="w-full flex items-center justify-center gap-2 py-3 text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
          >
            <Lock className="w-4 h-4" />
            <span>{showAllSteps ? 'Hide' : 'Show'} {lockedSteps.length} upcoming steps</span>
            {showAllSteps ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showAllSteps && (
            <div className="space-y-2 mt-2">
              {lockedSteps.map((step) => (
                <div
                  key={step.id}
                  className="flex items-center gap-3 p-3 bg-neutral-50 dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 opacity-50"
                >
                  <Lock className="w-5 h-5 text-neutral-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-neutral-500">Step {step.order}</span>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 truncate">
                      {step.title}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Global Pitfalls - RISK Section */}
      {roadmap.pitfalls && roadmap.pitfalls.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/20 rounded-2xl border border-amber-300 dark:border-amber-800 p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            <p className="font-semibold text-amber-800 dark:text-amber-200">
              Critical Warnings
            </p>
          </div>
          <ul className="space-y-2">
            {roadmap.pitfalls.map((pitfall, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-200">
                <span className="text-amber-500 font-bold">•</span>
                <span>{pitfall}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Success - What completion looks like */}
      {roadmap.successLooksLike && (
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/20 rounded-2xl border border-green-300 dark:border-green-800 p-5">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-5 h-5 text-green-600 dark:text-green-400" />
            <p className="font-semibold text-green-800 dark:text-green-200">
              Success Looks Like
            </p>
          </div>
          <p className="text-sm text-green-700 dark:text-green-300">
            {roadmap.successLooksLike}
          </p>
        </div>
      )}

      {/* Delete Roadmap Section */}
      <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800">
        {!showDeleteConfirm ? (
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full flex items-center justify-center gap-2 py-3 text-sm text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete this roadmap</span>
          </button>
        ) : (
          <div className="bg-red-50 dark:bg-red-950/30 rounded-xl p-4 border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-700 dark:text-red-300 mb-3">
              Are you sure you want to delete this roadmap? This action cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="flex-1 py-2 px-3 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDelete()
                  setShowDeleteConfirm(false)
                }}
                disabled={isDeleting}
                className="flex-1 py-2 px-3 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
      </>
      )}
    </div>
  )
})

// IDENTITY CARD - Shows user's learning identity (lock-in)
// OLD - Now imported from @/components/dashboard
const _OLD_IdentityCard = memo(function _OLD_IdentityCard({
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

// CELEBRATION MODAL - Shows when mission is completed
// OLD - Now imported from @/components/dashboard as DashboardCelebrationModal
const _OLD_CelebrationModal = memo(function _OLD_CelebrationModal({
  isOpen,
  onClose,
  xpEarned,
  stepCompleted,
  isRoadmapComplete,
}: {
  isOpen: boolean
  onClose: () => void
  xpEarned: number
  stepCompleted: string
  isRoadmapComplete: boolean
}) {
  useEffect(() => {
    if (isOpen) {
      // Auto-close after 4 seconds
      const timer = setTimeout(onClose, 4000)
      return () => clearTimeout(timer)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-neutral-900 rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
        {/* Confetti-like decorations */}
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-16 h-16 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center shadow-lg animate-bounce">
          <CheckCircle2 className="w-8 h-8 text-white" />
        </div>

        {/* Decorative particles */}
        <div className="absolute top-8 left-8 w-3 h-3 bg-yellow-400 rounded-full animate-ping" />
        <div className="absolute top-12 right-10 w-2 h-2 bg-blue-400 rounded-full animate-ping delay-100" />
        <div className="absolute top-6 right-6 w-2.5 h-2.5 bg-purple-400 rounded-full animate-ping delay-200" />

        <div className="text-center pt-8">
          {/* Title */}
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">
            {isRoadmapComplete ? 'Roadmap Complete!' : 'Step Complete!'}
          </h2>

          {/* Step name */}
          <p className="text-neutral-500 dark:text-neutral-400 mb-6">
            {stepCompleted}
          </p>

          {/* XP Earned */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30 border border-amber-200 dark:border-amber-800 rounded-full mb-6">
            <Zap className="w-5 h-5 text-amber-500" />
            <span className="text-lg font-bold text-amber-600 dark:text-amber-400">
              +{xpEarned} XP
            </span>
          </div>

          {/* Motivational message */}
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
            {isRoadmapComplete
              ? "You've completed your learning journey. Time for a new challenge!"
              : "Keep going! Each step brings you closer to mastery."}
          </p>

          {/* Progress indicator */}
          {!isRoadmapComplete && (
            <div className="flex items-center justify-center gap-1 text-xs text-green-600 dark:text-green-400">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Progress saved</span>
            </div>
          )}

          {/* Close button */}
          <button
            onClick={onClose}
            className="mt-4 px-6 py-2.5 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-medium rounded-xl transition-colors"
          >
            Continue
          </button>
        </div>
      </div>
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

  // Chat control state - for triggering chat from nudges
  const [shouldExpandChat, setShouldExpandChat] = useState(false)
  const [chatHintMessage, setChatHintMessage] = useState<string | null>(null)

  // Celebration state for completed missions
  const [showCelebration, setShowCelebration] = useState(false)
  const [celebrationData, setCelebrationData] = useState<{
    xpEarned: number
    stepCompleted: string
    isRoadmapComplete: boolean
  } | null>(null)

  // Note: Goal clarification removed - AI picks best interpretation automatically
  // Refinement options appear AFTER roadmap is created (Guidance first principle)

  // Mission state - Initialize with a default mission immediately
  const [currentMission, setCurrentMission] = useState<Mission | null>(() => {
    // Create a default "start" mission so buttons always work
    return {
      id: `start-${Date.now()}`,
      type: 'learn',
      title: 'Begin Your Learning Journey',
      directive: 'Tell me one thing you want to learn. Be specific.',
      context: 'Clerva will create a personalized roadmap and guide you step by step.',
      estimatedMinutes: 5,
      proofRequired: 'submission',
      criteria: {
        type: 'completion',
        description: 'Submit a specific learning goal',
      },
    }
  })

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

  // Identity state - tracks if user has completed identity discovery
  const [hasIdentity, setHasIdentity] = useState<boolean | null>(null) // null = loading
  const [identityResult, setIdentityResult] = useState<{
    archetype: string
    strengths: string[]
    preferredTime: 'morning' | 'afternoon' | 'evening' | 'night'
    learningStyle: string
  } | null>(null)

  // Fetch identity on mount
  useEffect(() => {
    async function fetchIdentity() {
      if (!user) {
        // Guest users skip identity for now (can do it after signup)
        setHasIdentity(true)
        return
      }

      try {
        const response = await fetch('/api/user/identity')
        if (response.ok) {
          const data = await response.json()
          setHasIdentity(data.hasIdentity)

          // Update userProgress with real identity data
          if (data.identity) {
            setUserProgress(prev => ({
              ...prev,
              identity: {
                archetype: data.identity.archetype,
                strengths: data.identity.strengths || [],
                growthAreas: data.identity.growthAreas || [],
              },
              patterns: {
                ...prev.patterns,
                preferredTime: data.identity.preferredStudyTime || prev.patterns.preferredTime,
                streakDays: data.identity.currentStreak || 0,
                longestStreak: data.identity.longestStreak || 0,
              },
            }))
          }
        }
      } catch (error) {
        console.error('Failed to fetch identity:', error)
        // Don't block the app, assume no identity
        setHasIdentity(false)
      }
    }

    if (!loading) {
      fetchIdentity()
    }
  }, [user, loading])

  // Handle identity discovery completion
  const handleIdentityComplete = useCallback(async (identity: {
    archetype: string
    strengths: string[]
    preferredTime: 'morning' | 'afternoon' | 'evening' | 'night'
    learningStyle: string
  }) => {
    setIdentityResult(identity)
    setViewState('identity-reveal')

    // Save to database if logged in
    if (user) {
      try {
        await fetch('/api/user/identity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            archetype: identity.archetype,
            strengths: identity.strengths,
            preferredStudyTime: identity.preferredTime,
            learningStyle: identity.learningStyle,
          }),
        })
      } catch (error) {
        console.error('Failed to save identity:', error)
      }
    }

    // Update local state
    setUserProgress(prev => ({
      ...prev,
      identity: {
        archetype: identity.archetype,
        strengths: identity.strengths,
        growthAreas: [],
      },
      patterns: {
        ...prev.patterns,
        preferredTime: identity.preferredTime,
      },
    }))
  }, [user])

  // Handle continuing after identity reveal
  const handleIdentityRevealContinue = useCallback(() => {
    setHasIdentity(true)
    setViewState('onboarding')
  }, [])

  // Active roadmap
  const {
    activeRoadmap: persistedRoadmap,
    isLoading: isRoadmapLoading,
    saveRoadmap,
    completeStep,
    refresh: refreshRoadmap,
    deleteRoadmap,
  } = useActiveRoadmap()

  // State for delete operation
  const [isDeleting, setIsDeleting] = useState(false)

  // Debug logging for production issues
  if (persistedRoadmap && !persistedRoadmap.steps) {
    console.error('[Dashboard] CRITICAL: persistedRoadmap exists but steps is missing!', {
      roadmapId: persistedRoadmap.id,
      hasSteps: !!persistedRoadmap.steps,
      stepsType: typeof persistedRoadmap.steps,
    })
  }

  // Convert to UI format - with defensive null checks
  const activeRoadmap: Roadmap | null = persistedRoadmap && persistedRoadmap.steps ? {
    id: persistedRoadmap.id,
    title: persistedRoadmap.title,
    overview: persistedRoadmap.overview,
    goal: persistedRoadmap.goal,
    steps: (persistedRoadmap.steps || []).map((step) => ({
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
      resources: step.resources as StepResource[] | undefined,
      // Include abilities for skill progress tracking
      abilities: step.abilities,
      previewAbilities: step.previewAbilities,
      completedAt: step.completedAt,
    })),
    currentStepIndex: persistedRoadmap.currentStepIndex,
    totalSteps: persistedRoadmap.totalSteps,
    completedSteps: persistedRoadmap.completedSteps,
    estimatedMinutes: persistedRoadmap.estimatedMinutes,
    pitfalls: persistedRoadmap.pitfalls,
    successLooksLike: persistedRoadmap.successLooksLike,
    recommendedPlatforms: persistedRoadmap.recommendedPlatforms as RecommendedPlatform[] | undefined,
    targetDate: persistedRoadmap.targetDate,
  } : null

  // Extract skill progress from roadmap steps for visceral progress indicators
  const skillProgress = useSkillProgress(persistedRoadmap?.steps)

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

  // Trigger mission reminder notifications when user returns
  useMissionReminder()

  // ============================================
  // PROGRESS FEEDBACK (Celebrations & Struggle Detection)
  // ============================================

  // Get current step for progress tracking
  const currentStep = activeRoadmap?.steps.find(s => s.status === 'current')

  const {
    activeFeedback,
    dismissFeedback,
    triggerStepComplete,
    handleNudgeAction,
  } = useProgressFeedback({
    currentStepId: currentStep?.id || null,
    estimatedMinutes: currentStep?.duration || 10,
    roadmapProgress: activeRoadmap
      ? Math.round((activeRoadmap.completedSteps / activeRoadmap.totalSteps) * 100)
      : 0,
    completedSteps: activeRoadmap?.completedSteps || 0,
    totalSteps: activeRoadmap?.totalSteps || 0,
    currentStreak: userProgress.patterns.streakDays,
    totalMinutesLearned: stats?.weekMinutes || 0,
    lastActiveDate: userProgress.lastActiveAt,
    onShowHint: () => {
      // Expand chat and pre-fill with hint request
      setShouldExpandChat(true)
      setChatHintMessage('I need a hint for this step')
      // Provide feedback to user
      setFeedbackMessage('Opening chat for assistance...')
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current)
      feedbackTimeoutRef.current = setTimeout(() => setFeedbackMessage(null), 2000)
    },
    onSimplifyStep: () => {
      // Navigate to roadmap view where breakdown is shown
      setViewState('roadmap')
      setFeedbackMessage('Showing step breakdown...')
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current)
      feedbackTimeoutRef.current = setTimeout(() => setFeedbackMessage(null), 2000)
    },
    onOpenChat: () => {
      // Expand chat panel
      setShouldExpandChat(true)
      setFeedbackMessage('Chat opened')
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current)
      feedbackTimeoutRef.current = setTimeout(() => setFeedbackMessage(null), 2000)
    },
  })

  // ============================================
  // MISSION ENGINE INTEGRATION
  // ============================================

  // Track if initial view has been set (use ref to persist across effect runs)
  const initialViewSetRef = useRef(false)

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

      // Only set initial view ONCE on first load, don't override user navigation
      if (!initialViewSetRef.current && hasIdentity !== null) {
        initialViewSetRef.current = true

        // Priority order for initial view:
        // 1. If logged-in user has no identity -> identity discovery
        // 2. If no roadmap -> onboarding (goal input)
        // 3. Otherwise -> mission view
        if (!isGuest && hasIdentity === false) {
          setViewState('identity-discovery')
        } else if (!activeRoadmap && !isGuest) {
          setViewState('onboarding')
        } else {
          setViewState('mission')
        }
      }
    }
  }, [isRoadmapLoading, activeRoadmap, userProgress, isGuest, hasIdentity])

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

  const handleDeleteRoadmap = useCallback(async () => {
    setIsDeleting(true)
    try {
      const success = await deleteRoadmap()
      if (success) {
        setViewState('onboarding')
        setFeedbackMessage('Roadmap deleted. Start a new learning journey.')
        if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current)
        feedbackTimeoutRef.current = setTimeout(() => setFeedbackMessage(null), 3000)
      } else {
        // deleteRoadmap returns false on failure (doesn't throw)
        setFeedbackMessage('Failed to delete roadmap. Please refresh and try again.')
        if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current)
        feedbackTimeoutRef.current = setTimeout(() => setFeedbackMessage(null), 4000)
      }
    } catch (err) {
      console.error('Error deleting roadmap:', err)
      setFeedbackMessage('Failed to delete roadmap. Try again.')
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current)
      feedbackTimeoutRef.current = setTimeout(() => setFeedbackMessage(null), 3000)
    } finally {
      setIsDeleting(false)
    }
  }, [deleteRoadmap])

  // Internal function to create roadmap (used after clarification or directly)
  const createRoadmapFromGoal = useCallback(async (
    goal: string,
    inputUrl?: string,
    inputImage?: string,
    skipEnhance = false
  ) => {
    setIsProcessing(true)

    try {
      // Auto-enhance the goal for better roadmap quality (unless skipped)
      let enhancedGoal = goal
      let wasEnhanced = false

      if (!skipEnhance) {
        try {
          const enhanceResponse = await fetch('/api/roadmap/enhance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ goal: goal.trim(), mode: 'quick' }),
          })

          if (enhanceResponse.ok) {
            const enhanceData = await enhanceResponse.json()
            if (enhanceData.success && enhanceData.enhanced && enhanceData.enhanced !== goal) {
              enhancedGoal = enhanceData.enhanced
              wasEnhanced = true
            }
          }
        } catch {
          // Enhancement failed, continue with original goal
          console.warn('Goal enhancement failed, using original')
        }
      }

      // Build request body with optional input materials
      const requestBody: {
        question: string
        struggleType: string
        actionType: string
        inputUrl?: string
        inputImage?: string
        originalGoal?: string
      } = {
        question: enhancedGoal,
        struggleType: 'homework_help',
        actionType: 'roadmap',
        originalGoal: wasEnhanced ? goal : undefined,
      }

      // Add input materials if provided
      if (inputUrl) {
        requestBody.inputUrl = inputUrl
      }
      if (inputImage) {
        requestBody.inputImage = inputImage
      }

      const response = await fetch('/api/guide-me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
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
        const savedRoadmap = await saveRoadmap({
          goal,
          title: data.action.title || 'Study Plan',
          overview: data.action.overview || data.action.encouragement,
          pitfalls: data.action.pitfalls || [],
          successLooksLike: data.action.successLooksLike,
          estimatedMinutes: data.action.totalMinutes,
          recommendedPlatforms: data.action.recommendedPlatforms,
          steps: data.action.steps.map((step: { order?: number; title?: string; description?: string; timeframe?: string; method?: string; avoid?: string; doneWhen?: string; duration?: number; resources?: StepResource[] }, index: number) => ({
            order: step.order || index + 1,
            title: step.title || `Step ${index + 1}`,
            description: step.description || '',
            timeframe: step.timeframe,
            method: step.method,
            avoid: step.avoid,
            doneWhen: step.doneWhen,
            duration: step.duration || 5,
            resources: step.resources,
          })),
        })

        // Check if save was successful
        if (!savedRoadmap) {
          throw new Error('Failed to save roadmap. Please try again.')
        }

        await refreshRoadmap()

        if (isGuest) {
          consumeTrial(goal, 'roadmap')
        }

        setViewState('mission')
        setFeedbackMessage(wasEnhanced
          ? '✨ Goal optimized & roadmap created. Your journey begins now.'
          : 'Roadmap created. Your journey begins now.'
        )
        if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current)
        feedbackTimeoutRef.current = setTimeout(() => setFeedbackMessage(null), 4000)
      } else {
        // Roadmap generation returned unexpected format
        console.error('Roadmap creation failed: unexpected response format', {
          actionType: data.action?.type,
          hasSteps: !!data.action?.steps,
          stepsLength: data.action?.steps?.length,
        })
        throw new Error('Failed to generate study plan. Please try again with a different goal.')
      }

    } catch (err) {
      console.error('Error creating roadmap:', err)
      setFeedbackMessage('Failed to create roadmap. Try again.')
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current)
      feedbackTimeoutRef.current = setTimeout(() => setFeedbackMessage(null), 3000)
    } finally {
      setIsProcessing(false)
    }
  }, [isGuest, saveRoadmap, refreshRoadmap, consumeTrial])

  const handleSubmitGoal = useCallback(async (goal: string, inputUrl?: string, inputImage?: string) => {
    if (isGuest && !hasTrials) {
      setShowTrialLimitModal(true)
      return
    }

    // Guidance first: AI handles everything, no clarification dialogs
    // The AI will pick the best interpretation and enhancement happens silently
    await createRoadmapFromGoal(goal, inputUrl, inputImage)
  }, [isGuest, hasTrials, createRoadmapFromGoal])


  const handleSubmitProof = useCallback(async (proof: { type: string; content: string; score?: number }) => {
    console.log('[handleSubmitProof] Called with:', { proof, currentMission: currentMission?.id, hasActiveRoadmap: !!activeRoadmap })
    
    if (!currentMission) {
      console.error('[handleSubmitProof] No current mission!')
      return
    }

    setIsProcessing(true)

    try {
      // Special case: First "start" mission - user is submitting their learning goal
      // This should create a roadmap, not just evaluate proof
      const isStartMission = currentMission.id.startsWith('start-') && !activeRoadmap

      if (isStartMission && proof.content.trim()) {
        // Treat this as a goal submission - create a roadmap
        await createRoadmapFromGoal(proof.content.trim())
        return // createRoadmapFromGoal handles its own state management
      }

      // Evaluate proof
      const result = MissionEngine.evaluateProof(currentMission, {
        type: proof.type as 'explanation' | 'quiz' | 'submission' | 'practice_set' | 'self_report',
        content: proof.content,
        score: proof.score,
      })
      
      console.log('[handleSubmitProof] Evaluation result:', { passed: result.passed, feedback: result.feedback })

      // If linked to a roadmap step, complete it
      // Also check activeRoadmap directly in case linkedStep is not set (fallback)
      const currentStepFromRoadmap = activeRoadmap?.steps.find(s => s.status === 'current')
      const stepIdToComplete = currentMission.linkedStep?.stepId || currentStepFromRoadmap?.id
      
      console.log('[handleSubmitProof] Step completion check:', { 
        stepIdToComplete, 
        linkedStepId: currentMission.linkedStep?.stepId,
        currentStepId: currentStepFromRoadmap?.id 
      })

      if (result.passed && stepIdToComplete) {
        const success = await completeStep(stepIdToComplete)
        if (success) {
          await refreshRoadmap()

          // Trigger micro-progress celebrations
          const minutesSpent = currentStepFromRoadmap?.duration || 10
          triggerStepComplete(minutesSpent)

          // Show celebration modal
          const stepTitle = currentStepFromRoadmap?.title || currentMission.title
          const isLastStep = activeRoadmap
            ? activeRoadmap.completedSteps + 1 >= activeRoadmap.totalSteps
            : false

          setCelebrationData({
            xpEarned: 25, // XP per step completion
            stepCompleted: stepTitle,
            isRoadmapComplete: isLastStep,
          })
          setShowCelebration(true)

          // Note: The useEffect will update currentMission when activeRoadmap changes
          // from the refreshRoadmap() call above
          return // Exit early - celebration modal will handle the transition
        }
      } else if (result.passed && !stepIdToComplete) {
        // Mission passed but no roadmap step to complete (standalone mission or no active roadmap)
        // Decide the next mission based on current progress
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

        // Get next mission
        const decision = MissionEngine.decideNextMission(userProgress, roadmapForEngine)
        setCurrentMission(decision.mission)

        // Small celebration for completing standalone mission
        triggerStepComplete(10)
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

      // If user struggled, navigate to roadmap view where they can get help
      if (!result.passed) {
        setViewState('roadmap')
        return
      }

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
  }, [currentMission, activeRoadmap, completeStep, refreshRoadmap, createRoadmapFromGoal, userProgress, triggerStepComplete])

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

      {/* Celebration Modal */}
      <DashboardCelebrationModal
        isOpen={showCelebration}
        onClose={() => {
          setShowCelebration(false)
          // Ensure we return to mission view after celebrating
          setViewState('mission')
        }}
        xpEarned={celebrationData?.xpEarned || 25}
        stepCompleted={celebrationData?.stepCompleted || ''}
        isRoadmapComplete={celebrationData?.isRoadmapComplete || false}
      />


      {/* Banners */}
      {isGuest && <TrialBanner trialsRemaining={trialsRemaining} totalTrials={totalTrials} />}
      <PWAInstallBanner variant="banner" />

      {/* Header */}
      <DashboardHeader
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

            {/* Skill Progress - Show what abilities user has unlocked */}
            {!isGuest && activeRoadmap && skillProgress.totalAbilitiesUnlocked > 0 && (
              <SkillProgressCard
                unlockedAbilities={skillProgress.unlockedAbilities}
                currentAbility={skillProgress.currentAbility}
                nextAbility={skillProgress.nextAbility}
                roadmapTitle={activeRoadmap.title}
                completedSteps={activeRoadmap.completedSteps}
                totalSteps={activeRoadmap.totalSteps}
              />
            )}

            {/* Mission Chat - Contextual help, clickable suggestions */}
            {currentMission && (
              <SectionErrorBoundary section="chat" fallbackMessage="Chat assistance is temporarily unavailable.">
                <MissionChat
                  missionTitle={currentMission.title}
                  missionContext={currentMission.directive}
                  isGuest={isGuest}
                  onTrialExhausted={() => setShowTrialLimitModal(true)}
                  shouldExpand={shouldExpandChat}
                  initialMessage={chatHintMessage}
                  onExpandChange={(expanded) => {
                    if (!expanded) {
                      // Reset state when chat closes
                      setShouldExpandChat(false)
                      setChatHintMessage(null)
                    }
                  }}
                />
              </SectionErrorBoundary>
            )}
          </>
        )}

        {/* IDENTITY DISCOVERY VIEW - First-time users discover their learning identity */}
        {viewState === 'identity-discovery' && (
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6">
            <IdentityDiscovery
              onComplete={handleIdentityComplete}
              onSkip={() => {
                setHasIdentity(true)
                setViewState('onboarding')
              }}
            />
          </div>
        )}

        {/* IDENTITY REVEAL VIEW - Show "You're becoming X" after discovery */}
        {viewState === 'identity-reveal' && identityResult && (
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6">
            <IdentityReveal
              identity={identityResult}
              onContinue={handleIdentityRevealContinue}
            />
          </div>
        )}

        {/* ONBOARDING VIEW - Guidance first, with smart suggestions */}
        {viewState === 'onboarding' && (
          <OnboardingPrompt
            onSubmitGoal={handleSubmitGoal}
            isLoading={isProcessing}
            suggestedGoal={
              // Smart default for returning users based on previous activity
              userProgress.recentMissions.length > 0 && userProgress.identity.growthAreas.length > 0
                ? `Improve my ${userProgress.identity.growthAreas[0]}`
                : userProgress.weakSpots.length > 0
                ? `Master ${userProgress.weakSpots[0].topic}`
                : null
            }
          />
        )}

        {/* PROOF VIEW - Submit proof for mission */}
        {viewState === 'proof' && (
          currentMission ? (
            <ProofSubmission
              mission={currentMission}
              onSubmit={handleSubmitProof}
              onBack={() => setViewState('mission')}
              isLoading={isProcessing}
            />
          ) : (
            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6 text-center">
              <p className="text-neutral-500 dark:text-neutral-400 mb-4">No active mission found.</p>
              <button
                onClick={() => setViewState('mission')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
              >
                Go Back
              </button>
            </div>
          )
        )}

        {/* ROADMAP VIEW - Full roadmap display */}
        {viewState === 'roadmap' && (
          activeRoadmap ? (
            <RoadmapView
              roadmap={activeRoadmap}
              onBack={() => setViewState('mission')}
              onDelete={handleDeleteRoadmap}
              isDeleting={isDeleting}
              onRefine={async (type) => {
                try {
                  const response = await fetch('/api/roadmap/refine', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      roadmapId: activeRoadmap.id,
                      refinementType: type,
                    }),
                  })
                  if (!response.ok) {
                    throw new Error('Failed to refine roadmap')
                  }
                  // Refresh the roadmap to get updated data
                  await refreshRoadmap()
                  setFeedbackMessage(
                    type === 'faster_pace' ? 'Roadmap optimized for speed.' :
                    type === 'more_depth' ? 'Roadmap expanded with more depth.' :
                    'Roadmap refocused with new approach.'
                  )
                  if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current)
                  feedbackTimeoutRef.current = setTimeout(() => setFeedbackMessage(null), 3000)
                } catch (error) {
                  console.error('Failed to refine roadmap:', error)
                  setFeedbackMessage('Failed to refine roadmap. Please try again.')
                  if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current)
                  feedbackTimeoutRef.current = setTimeout(() => setFeedbackMessage(null), 3000)
                }
              }}
              onStepComplete={async (stepId) => {
                const success = await completeStep(stepId)
                if (success) {
                  await refreshRoadmap()

                  // Get step info for celebration
                  const step = activeRoadmap?.steps.find(s => s.id === stepId)
                  const minutesSpent = step?.duration || 10
                  triggerStepComplete(minutesSpent)

                  // Show celebration
                  const isLastStep = activeRoadmap
                    ? activeRoadmap.completedSteps + 1 >= activeRoadmap.totalSteps
                    : false

                  setCelebrationData({
                    xpEarned: 25,
                    stepCompleted: step?.title || 'Gate',
                    isRoadmapComplete: isLastStep,
                  })
                  setShowCelebration(true)

                  // Celebration modal onClose will navigate to mission view
                }
              }}
            />
          ) : (
            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6 text-center">
              <p className="text-neutral-500 dark:text-neutral-400 mb-4">No roadmap found. Create one first.</p>
              <button
                onClick={() => setViewState('onboarding')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
              >
                Create Roadmap
              </button>
            </div>
          )
        )}
      </main>

      {/* Progress Feedback Toast (Celebrations & Nudges) */}
      <ProgressToast
        feedback={activeFeedback}
        onDismiss={dismissFeedback}
        onAction={handleNudgeAction}
      />

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  )
}
