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
  Link2,
  Image as ImageIcon,
  FileText,
  Video,
  X,
  Upload,
  Trash2,
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
type InputMaterial = {
  type: 'url' | 'image' | 'none'
  value: string
  preview?: string
}

// ONBOARDING - When user has no roadmap (NOT a blank chat)
const OnboardingPrompt = memo(function OnboardingPrompt({
  onSubmitGoal,
  isLoading,
}: {
  onSubmitGoal: (goal: string, inputUrl?: string, inputImage?: string) => void
  isLoading: boolean
}) {
  const [goal, setGoal] = useState('')
  const [inputMaterial, setInputMaterial] = useState<InputMaterial>({ type: 'none', value: '' })
  const [showInputOptions, setShowInputOptions] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = () => {
    if (goal.trim().length >= 10) {
      const inputUrl = inputMaterial.type === 'url' ? inputMaterial.value : undefined
      const inputImage = inputMaterial.type === 'image' ? inputMaterial.value : undefined
      onSubmitGoal(goal.trim(), inputUrl, inputImage)
    }
  }

  const handleUrlAdd = () => {
    if (urlInput.trim()) {
      // Detect input type from URL
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

  // Detect if URL is YouTube, PDF, etc for display
  const getInputTypeLabel = (url: string): string => {
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'YouTube Video'
    if (url.endsWith('.pdf')) return 'PDF Document'
    return 'Web Page'
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
          <li>&quot;Master React hooks in 2 weeks&quot;</li>
          <li>&quot;Pass my calculus exam on Friday&quot;</li>
          <li>&quot;Learn conversational Spanish basics&quot;</li>
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

        {/* Input Material Section */}
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
        ) : (
          <>
            {/* Add Input Button */}
            {!showInputOptions && (
              <button
                onClick={() => setShowInputOptions(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-neutral-300 dark:border-neutral-700 rounded-xl text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 hover:border-neutral-400 dark:hover:border-neutral-600 transition-colors text-sm"
              >
                <Upload className="w-4 h-4" />
                <span>Add learning material (optional)</span>
              </button>
            )}

            {/* Input Options */}
            {showInputOptions && (
              <div className="border border-neutral-200 dark:border-neutral-700 rounded-xl p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
                    Add Learning Material
                  </p>
                  <button
                    onClick={() => setShowInputOptions(false)}
                    className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full"
                  >
                    <X className="w-4 h-4 text-neutral-400" />
                  </button>
                </div>

                {/* URL Input */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="Paste URL, YouTube link, or PDF link..."
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

                {/* Divider */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-700" />
                  <span className="text-xs text-neutral-400">or</span>
                  <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-700" />
                </div>

                {/* Image Upload */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg text-neutral-700 dark:text-neutral-300 text-sm font-medium transition-colors"
                >
                  <ImageIcon className="w-4 h-4" />
                  <span>Upload Image (homework, worksheet)</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />

                <p className="text-xs text-neutral-400 text-center">
                  Clerva analyzes your material to build a better roadmap
                </p>
              </div>
            )}
          </>
        )}

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

// ROADMAP VIEW - Clerva GPS Style
// Philosophy: Show only what matters NOW. Future steps hidden until earned.
const RoadmapView = memo(function RoadmapView({
  roadmap,
  onBack,
  onDelete,
  isDeleting,
}: {
  roadmap: Roadmap
  onBack: () => void
  onDelete: () => void
  isDeleting: boolean
}) {
  const [showAllSteps, setShowAllSteps] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Find current step
  const currentStep = roadmap.steps.find(s => s.status === 'current')
  const completedSteps = roadmap.steps.filter(s => s.status === 'completed')
  const lockedSteps = roadmap.steps.filter(s => s.status === 'locked')

  return (
    <div className="space-y-4">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        <span className="text-sm">Back to Mission</span>
      </button>

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

          {/* Duration */}
          {currentStep.duration && (
            <div className="flex items-center gap-2 mt-4 text-sm text-neutral-500">
              <Clock className="w-4 h-4" />
              <span>Estimated: {currentStep.duration} minutes</span>
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

  const handleDeleteRoadmap = useCallback(async () => {
    setIsDeleting(true)
    try {
      const success = await deleteRoadmap()
      if (success) {
        setViewState('onboarding')
        setFeedbackMessage('Roadmap deleted. Start a new learning journey.')
        if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current)
        feedbackTimeoutRef.current = setTimeout(() => setFeedbackMessage(null), 3000)
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

  const handleSubmitGoal = useCallback(async (goal: string, inputUrl?: string, inputImage?: string) => {
    if (isGuest && !hasTrials) {
      setShowTrialLimitModal(true)
      return
    }

    setIsProcessing(true)

    try {
      // Build request body with optional input materials
      const requestBody: {
        question: string
        struggleType: string
        actionType: string
        inputUrl?: string
        inputImage?: string
      } = {
        question: goal,
        struggleType: 'homework_help',
        actionType: 'roadmap',
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

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  )
}
