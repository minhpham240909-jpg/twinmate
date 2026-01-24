'use client'

/**
 * CLERVA 2.0 Dashboard
 *
 * Three distinct TOOLS, not chat:
 * 1. Explain Pack - "I don't understand something"
 * 2. Test Prep Sprint - "Test coming up"
 * 3. Guide Me - "Guide me"
 *
 * Design principles:
 * - Tool-first, not chat
 * - One action per screen
 * - Calm, clean design
 * - Fast, low friction
 * - AI is invisible, UI is the product
 */

import { useAuth } from '@/lib/auth/context'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef, useCallback, memo } from 'react'
import { useUserSync } from '@/hooks/useUserSync'
import { useDashboardStats } from '@/hooks/useUserStats'
import { useMission } from '@/hooks/useMission'
import { useMilestones } from '@/hooks/useMilestones'
import { useGuestTrial } from '@/hooks/useGuestTrial'
import BottomNav from '@/components/BottomNav'
import CelebrationModal from '@/components/CelebrationModal'
import TrialLimitModal from '@/components/TrialLimitModal'
import TrialBanner from '@/components/TrialBanner'
import Image from 'next/image'
import {
  Lightbulb,
  Loader2,
  ArrowRight,
  Check,
  BookOpen,
  Brain,
  Map,
  Flame,
  Star,
  ChevronLeft,
  Sparkles,
  HelpCircle,
  ClipboardList,
  Camera,
  Image as ImageIcon,
  Upload,
  Trash2,
  ChevronDown,
  ChevronUp,
  Target,
  X,
  ThumbsDown,
  ThumbsUp,
  RotateCcw,
  Zap,
} from 'lucide-react'

// ============================================
// TYPES
// ============================================

type FlowStep = 'home' | 'input' | 'loading' | 'result'
type StruggleType = 'dont_understand' | 'test_coming' | 'homework_help'
type InputMode = 'text' | 'photo'

// Learning Pack structure for Explain Pack
interface LearningPack {
  type: 'learning_pack'
  title: string
  acknowledgment?: string
  core: {
    idea: string
    keyPoints: string[]
  }
  steps?: {
    step: string
    why: string
  }[]
  example?: {
    problem: string
    solution: string
  }
  checkQuestion?: {
    question: string
    hint: string
  }
  nextSuggestion: string
}

// Flashcards for Test Prep
interface FlashcardPack {
  type: 'flashcards'
  title: string
  acknowledgment?: string
  cards: {
    id: string
    question: string
    answer: string
    hint?: string
  }[]
  nextSuggestion: string
}

// Roadmap for Homework Help
interface HomeworkPlan {
  type: 'homework_plan'
  title: string
  acknowledgment?: string
  encouragement: string
  steps: {
    id: string
    order: number
    title: string
    description: string
    hints: string[]
  }[]
  totalMinutes: number
  nextSuggestion: string
}

type ActionResult = LearningPack | FlashcardPack | HomeworkPlan

interface GuideResponse {
  success: boolean
  action: ActionResult
  xpEarned: number
  streakUpdated: boolean
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function DashboardPage() {
  const { user, profile, loading } = useAuth()
  const router = useRouter()

  // Guest trial system
  const {
    trialsRemaining,
    totalTrials,
    hasTrials,
    consumeTrial,
    isLoading: isTrialLoading,
  } = useGuestTrial()
  const [showTrialLimitModal, setShowTrialLimitModal] = useState(false)

  // Determine if user is a guest (not logged in)
  const isGuest = !user && !loading

  // Flow state
  const [flowStep, setFlowStep] = useState<FlowStep>('home')
  const [question, setQuestion] = useState('')
  const [struggleType, setStruggleType] = useState<StruggleType | null>(null)
  const [result, setResult] = useState<GuideResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [responseTimeMs, setResponseTimeMs] = useState<number | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Input mode state - photo-first like food scanner apps
  const [inputMode, setInputMode] = useState<InputMode>('photo')
  const [uploadedImage, setUploadedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isProcessingImage, setIsProcessingImage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Collapsible sections in result
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['core', 'steps'])
  )

  // Flashcard state
  const [flippedCards, setFlippedCards] = useState<Set<string>>(new Set())
  const [revealedHints, setRevealedHints] = useState<Set<string>>(new Set())
  const [markedWeakCards, setMarkedWeakCards] = useState<Set<string>>(new Set())

  // Stats
  const { stats } = useDashboardStats()

  // Milestones and celebrations
  const {
    milestoneData,
    celebrationMilestone,
    celebrationXp,
    dismissCelebration,
    checkMilestones,
  } = useMilestones()

  // Mission system for weak spots
  const {
    missionItems,
    addWeakFlashcard,
    addConfusedConcept,
    addStuckStep,
    completeMissionItem,
    removeMissionItem,
    hasMission,
  } = useMission()

  // Track hint usage per step (for detecting stuck steps)
  const [hintUsageCount, setHintUsageCount] = useState<Record<string, number>>({})

  useUserSync()

  // Auto-focus input when entering input step
  useEffect(() => {
    if (flowStep === 'input' && inputRef.current && inputMode === 'text') {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [flowStep, inputMode])

  // Allow guests to use dashboard (with trial limits)
  // No redirect - guests can use the app with limited trials
  useEffect(() => {
    // Only redirect if loading is done and we need to (currently we allow guests)
    // This is intentionally empty now to allow guest access
  }, [user, loading, router])

  // Cleanup image preview on unmount
  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview)
      }
    }
  }, [imagePreview])

  // ============================================
  // HANDLERS
  // ============================================

  // Reset flow
  const resetFlow = useCallback(() => {
    setFlowStep('home')
    setQuestion('')
    setStruggleType(null)
    setResult(null)
    setError(null)
    setResponseTimeMs(null)
    setInputMode('photo') // Reset to photo-first
    setUploadedImage(null)
    setExpandedSections(new Set(['core', 'steps']))
    setFlippedCards(new Set())
    setRevealedHints(new Set())
    setMarkedWeakCards(new Set())
    setHintUsageCount({})
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview)
    }
    setImagePreview(null)
  }, [imagePreview])

  // Handle struggle type selection
  const handleStruggleSelect = (type: StruggleType) => {
    setStruggleType(type)
    setFlowStep('input')
  }

  // Handle image selection
  const handleImageSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return

      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file (JPG, PNG, etc.)')
        return
      }

      // Validate file size (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        setError('Image too large. Maximum size is 10MB.')
        return
      }

      setError(null)
      setUploadedImage(file)

      // Create preview
      const preview = URL.createObjectURL(file)
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview)
      }
      setImagePreview(preview)
    },
    [imagePreview]
  )

  // Remove uploaded image
  const removeImage = useCallback(() => {
    setUploadedImage(null)
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview)
    }
    setImagePreview(null)
    setInputMode('text')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [imagePreview])

  // Process uploaded image
  const processImage = useCallback(async () => {
    if (!uploadedImage || !struggleType) return

    setIsProcessingImage(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', uploadedImage)
      formData.append('struggleType', struggleType)

      const response = await fetch('/api/study/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process image')
      }

      // Add extracted content to question
      if (data.extractedContent) {
        setQuestion(
          (prev) =>
            prev
              ? `${prev}\n\n[From image]:\n${data.extractedContent}`
              : `[From image]:\n${data.extractedContent}`
        )
      }

      setInputMode('text')
    } catch (err) {
      console.error('Image processing error:', err)
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to process image. Please try again.'
      )
    } finally {
      setIsProcessingImage(false)
    }
  }, [uploadedImage, struggleType])

  // Submit question to AI
  const handleSubmit = async () => {
    if (!question.trim()) return

    // Check if guest has trials remaining (client-side check)
    if (isGuest && !hasTrials) {
      setShowTrialLimitModal(true)
      return
    }

    setFlowStep('loading')
    setError(null)
    setResponseTimeMs(null)

    const startTime = Date.now()

    try {
      const response = await fetch('/api/guide-me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: question.trim(),
          struggleType: struggleType || 'general',
          actionType: 'auto',
        }),
      })

      const data = await response.json()

      // Check if trial limit reached (server-side enforcement)
      if (response.status === 403 && data.trialExhausted) {
        setShowTrialLimitModal(true)
        setFlowStep('home')
        return
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get help')
      }

      const elapsedMs = Date.now() - startTime
      setResponseTimeMs(elapsedMs)

      // Transform the response to our new structure
      const transformedResult = transformApiResponse(data, struggleType)
      setResult(transformedResult)
      setFlowStep('result')

      // Consume trial for guests (client-side tracking)
      if (isGuest) {
        const actionType = struggleType === 'dont_understand' ? 'explanation' :
                          struggleType === 'test_coming' ? 'flashcards' : 'roadmap'
        consumeTrial(question.trim(), actionType)
      }

      // Check for new milestones (only for authenticated users, non-blocking)
      if (!isGuest) {
        const actionType = struggleType === 'dont_understand' ? 'explain' :
                          struggleType === 'test_coming' ? 'flashcard' : 'guide'
        checkMilestones(actionType).catch(() => {
          // Silently fail - milestone check is not critical
        })
      }
    } catch (err) {
      console.error('Error:', err)
      // Provide more specific error messages based on error type
      if (err instanceof Error) {
        if (err.message.includes('network') || err.message.includes('fetch')) {
          setError('Unable to connect. Please check your internet connection and try again.')
        } else if (err.message.includes('timeout')) {
          setError('Request took too long. Please try again with a shorter question.')
        } else if (err.message) {
          setError(err.message)
        } else {
          setError('Unable to process your request. Please try again.')
        }
      } else {
        setError('Unable to process your request. Please try again.')
      }
      setFlowStep('input')
    }
  }

  // Transform API response to our Learning Pack structure
  const transformApiResponse = (data: any, type: StruggleType | null): GuideResponse => {
    const action = data.action

    if (type === 'dont_understand' || action.type === 'explanation') {
      // Transform to Learning Pack - now uses new API format with core, steps, example, checkQuestion
      return {
        success: true,
        action: {
          type: 'learning_pack',
          title: action.title || 'Understanding the concept',
          acknowledgment: action.acknowledgment,
          core: {
            // Use new structure if available, fallback to legacy points
            idea: action.core?.idea || action.points?.[0] || 'Let me help you understand this.',
            keyPoints: action.core?.keyPoints || action.points?.slice(1) || [],
          },
          // Use new steps format if available
          steps: action.steps && action.steps.length > 0
            ? action.steps.map((s: any) => ({ step: s.step, why: s.why }))
            : action.points?.slice(1, 4).map((point: string) => ({
                step: point,
                why: 'This builds on the previous concept.',
              })),
          // Use new example format if available
          example: action.example?.problem && action.example?.solution
            ? { problem: action.example.problem, solution: action.example.solution }
            : undefined,
          // Use new checkQuestion format, fallback to followUp
          checkQuestion: action.checkQuestion?.question
            ? { question: action.checkQuestion.question, hint: action.checkQuestion.hint || 'Think about what we just covered.' }
            : action.followUp
            ? { question: action.followUp, hint: 'Think about what we just covered.' }
            : undefined,
          nextSuggestion: action.nextSuggestion || 'Want to explore this further?',
        },
        xpEarned: data.xpEarned || 0,
        streakUpdated: data.streakUpdated || false,
      }
    } else if (type === 'test_coming' || action.type === 'flashcards') {
      // Transform to Flashcard Pack
      return {
        success: true,
        action: {
          type: 'flashcards',
          title: 'Quick Review Cards',
          acknowledgment: action.acknowledgment,
          cards: action.cards || [],
          nextSuggestion: action.nextSuggestion || 'Ready for more practice?',
        },
        xpEarned: data.xpEarned || 0,
        streakUpdated: data.streakUpdated || false,
      }
    } else {
      // Transform to Homework Plan - now includes hints from API
      return {
        success: true,
        action: {
          type: 'homework_plan',
          title: action.title || 'Step-by-step plan',
          acknowledgment: action.acknowledgment,
          encouragement: action.encouragement || "You've got this!",
          steps: (action.steps || []).map((step: any) => ({
            ...step,
            // Use hints from API if available, otherwise generate fallback
            hints: step.hints && step.hints.length > 0
              ? step.hints
              : [
                  'Start by identifying what you know.',
                  'Think about similar problems you\'ve solved.',
                  step.description,
                ],
          })),
          totalMinutes: action.totalMinutes || 15,
          nextSuggestion: action.nextSuggestion || 'Let me know how it goes!',
        },
        xpEarned: data.xpEarned || 0,
        streakUpdated: data.streakUpdated || false,
      }
    }
  }

  // Toggle section expansion
  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(section)) {
        newSet.delete(section)
      } else {
        newSet.add(section)
      }
      return newSet
    })
  }

  // Flip flashcard
  const toggleCardFlip = (cardId: string) => {
    setFlippedCards((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(cardId)) {
        newSet.delete(cardId)
      } else {
        newSet.add(cardId)
      }
      return newSet
    })
  }

  // Reveal hint
  const revealHint = (hintId: string) => {
    setRevealedHints((prev) => new Set([...prev, hintId]))
  }

  // ============================================
  // LOADING STATE
  // ============================================

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    )
  }

  // Allow guests to use the app (with trial limits)
  // Only block if auth is loading
  if (!isGuest && !user) {
    return null
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-50 to-neutral-100 dark:from-neutral-950 dark:to-neutral-900 pb-20">
      {/* Trial Limit Modal for Guests */}
      <TrialLimitModal
        isOpen={showTrialLimitModal}
        onClose={() => setShowTrialLimitModal(false)}
      />

      {/* Celebration Modal */}
      <CelebrationModal
        milestone={celebrationMilestone}
        xpAwarded={celebrationXp}
        onClose={dismissCelebration}
      />

      {/* Trial Banner for Guests */}
      {isGuest && (
        <TrialBanner
          trialsRemaining={trialsRemaining}
          totalTrials={totalTrials}
        />
      )}

      {/* Header - Only show on home */}
      {flowStep === 'home' && (
        <header className="sticky top-0 z-40 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-lg border-b border-neutral-200 dark:border-neutral-800">
          <div className="max-w-lg mx-auto px-4 py-3">
            {/* Top row: Logo + Stats */}
            <div className="flex items-center justify-between mb-2">
              <Image
                src="/logo.png"
                alt="Clerva"
                width={32}
                height={32}
                className="rounded-lg"
              />
              {!isGuest && stats && (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                    <Flame className="w-4 h-4 text-orange-500" />
                    <span className="text-sm font-bold text-orange-600 dark:text-orange-400">
                      {stats.streak}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <Star className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                      {stats.points}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* XP Progress Bar - Only for authenticated users */}
            {!isGuest && milestoneData?.xpProgress && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 w-10">
                  Lv.{milestoneData.xpProgress.currentLevel}
                </span>
                <div className="flex-1 h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-500"
                    style={{ width: `${milestoneData.xpProgress.progressPercent}%` }}
                  />
                </div>
                <span className="text-xs text-neutral-400 dark:text-neutral-500 w-16 text-right">
                  {milestoneData.xpProgress.xpNeeded} to go
                </span>
              </div>
            )}
          </div>
        </header>
      )}

      {/* Main Content */}
      <main className="max-w-lg mx-auto px-4 py-6">
        {/* ============================================ */}
        {/* HOME - Today's Mission + Three Tool Cards */}
        {/* ============================================ */}
        {flowStep === 'home' && (
          <div className="space-y-6">
            {/* Greeting */}
            <div className="text-center py-4">
              <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">
                Good {getTimeOfDay()}, {profile?.name?.split(' ')[0] || 'there'}
              </h2>
              <p className="text-neutral-500 dark:text-neutral-400 mt-1">
                {isGuest
                  ? "Try Clerva free - no signup required"
                  : hasMission
                    ? "Here's your mission for today"
                    : "What do you need help with?"}
              </p>
            </div>

            {/* Today's Mission Section - Only for authenticated users */}
            {!isGuest && hasMission && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-orange-500" />
                    <h3 className="font-semibold text-neutral-900 dark:text-white">
                      Today's Mission
                    </h3>
                    <span className="px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-xs font-medium rounded-full">
                      {missionItems.length}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  {missionItems.map((item) => (
                    <MissionItemCard
                      key={item.id}
                      item={item}
                      onComplete={() => completeMissionItem(item.id)}
                      onDismiss={() => removeMissionItem(item.id)}
                      onTap={() => {
                        // Jump to appropriate tool based on source
                        if (item.source === 'explain_pack') {
                          setQuestion(item.description)
                          handleStruggleSelect('dont_understand')
                        } else if (item.source === 'test_prep') {
                          setQuestion(item.description)
                          handleStruggleSelect('test_coming')
                        } else {
                          setQuestion(item.description)
                          handleStruggleSelect('homework_help')
                        }
                      }}
                    />
                  ))}
                </div>

                <div className="border-t border-neutral-200 dark:border-neutral-800 pt-4 mt-4">
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center">
                    Or start something new
                  </p>
                </div>
              </div>
            )}

            {/* Three Tool Cards */}
            <div className="space-y-3">
              {/* Explain Pack */}
              <ToolCard
                title="I don't understand something"
                description="Get a clear explanation in 5 minutes"
                icon={Lightbulb}
                color="blue"
                onClick={() => handleStruggleSelect('dont_understand')}
              />

              {/* Test Prep Sprint */}
              <ToolCard
                title="Test coming up"
                description="Quick review with smart flashcards"
                icon={Brain}
                color="purple"
                onClick={() => handleStruggleSelect('test_coming')}
              />

              {/* Guide Me */}
              <ToolCard
                title="Guide me"
                description="Step-by-step guidance without answers"
                icon={ClipboardList}
                color="green"
                onClick={() => handleStruggleSelect('homework_help')}
              />
            </div>
          </div>
        )}

        {/* ============================================ */}
        {/* INPUT - Capture the problem */}
        {/* ============================================ */}
        {flowStep === 'input' && (
          <div className="space-y-6">
            {/* Back button */}
            <button
              onClick={resetFlow}
              className="flex items-center gap-2 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="text-sm">Back</span>
            </button>

            {/* Header */}
            <div className="text-center">
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg ${
                  struggleType === 'dont_understand'
                    ? 'bg-gradient-to-br from-blue-500 to-blue-600 shadow-blue-500/25'
                    : struggleType === 'test_coming'
                    ? 'bg-gradient-to-br from-purple-500 to-purple-600 shadow-purple-500/25'
                    : 'bg-gradient-to-br from-green-500 to-green-600 shadow-green-500/25'
                }`}
              >
                {struggleType === 'dont_understand' && (
                  <Lightbulb className="w-7 h-7 text-white" />
                )}
                {struggleType === 'test_coming' && (
                  <Brain className="w-7 h-7 text-white" />
                )}
                {struggleType === 'homework_help' && (
                  <ClipboardList className="w-7 h-7 text-white" />
                )}
              </div>
              <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-1">
                {struggleType === 'dont_understand' &&
                  "What don't you understand?"}
                {struggleType === 'test_coming' && "What's your test about?"}
                {struggleType === 'homework_help' &&
                  'What do you need help with?'}
              </h2>
              <p className="text-neutral-500 text-sm">
                Paste, type, or snap a photo
              </p>
            </div>

            {/* Input Mode Tabs */}
            <div className="flex justify-center gap-2 p-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-xl">
              <button
                onClick={() => setInputMode('text')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all ${
                  inputMode === 'text'
                    ? 'bg-white dark:bg-neutral-700 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-neutral-600 dark:text-neutral-400'
                }`}
              >
                <span>Type / Paste</span>
              </button>
              <button
                onClick={() => setInputMode('photo')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all ${
                  inputMode === 'photo'
                    ? 'bg-white dark:bg-neutral-700 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-neutral-600 dark:text-neutral-400'
                }`}
              >
                <Camera className="w-4 h-4" />
                <span>Photo</span>
              </button>
            </div>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleImageSelect}
              className="hidden"
            />

            {/* Input Area */}
            <div className="space-y-4">
              {/* Text Input */}
              {inputMode === 'text' && (
                <div>
                  <label htmlFor="question-input" className="sr-only">
                    {struggleType === 'dont_understand'
                      ? 'Describe what you don\'t understand'
                      : struggleType === 'test_coming'
                      ? 'Describe your test topic'
                      : 'Describe what you need help with'}
                  </label>
                  <textarea
                    id="question-input"
                    ref={inputRef}
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder={
                      struggleType === 'dont_understand'
                        ? "e.g., I don't understand how photosynthesis works..."
                        : struggleType === 'test_coming'
                        ? 'e.g., Chemistry test on acids and bases...'
                        : 'e.g., I need to solve this quadratic equation...'
                    }
                    className="w-full h-36 px-4 py-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-neutral-900 dark:text-white placeholder-neutral-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                    aria-describedby={error ? 'error-message' : undefined}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.metaKey && question.trim()) {
                        handleSubmit()
                      }
                    }}
                  />
                </div>
              )}

              {/* Photo Input / Preview */}
              {inputMode === 'photo' && (
                <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
                  {imagePreview ? (
                    <div className="relative">
                      <img
                        src={imagePreview}
                        alt="Uploaded"
                        className="w-full max-h-64 object-contain bg-neutral-100 dark:bg-neutral-800"
                      />
                      <button
                        onClick={removeImage}
                        className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <div className="p-4 border-t border-neutral-200 dark:border-neutral-800">
                        {isProcessingImage ? (
                          <div className="flex items-center justify-center gap-2 py-2">
                            <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                            <span className="text-neutral-600 dark:text-neutral-400">
                              Analyzing image...
                            </span>
                          </div>
                        ) : (
                          <button
                            onClick={processImage}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                          >
                            <Upload className="w-4 h-4" />
                            <span>Extract content</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-16 flex flex-col items-center justify-center hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
                    >
                      <div className="w-16 h-16 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center mb-4">
                        <ImageIcon className="w-8 h-8 text-neutral-400" />
                      </div>
                      <p className="text-neutral-600 dark:text-neutral-400 font-medium">
                        Tap to upload a photo
                      </p>
                      <p className="text-xs text-neutral-400 mt-1">
                        Homework, notes, textbook pages
                      </p>
                    </button>
                  )}
                </div>
              )}

              {/* Show extracted content */}
              {inputMode === 'photo' && question && (
                <div className="space-y-2">
                  <label className="text-sm text-neutral-500">
                    Extracted content:
                  </label>
                  <textarea
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    className="w-full h-24 px-4 py-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-neutral-900 dark:text-white text-sm outline-none resize-none"
                  />
                </div>
              )}

              {/* Error message - with aria-live for screen readers */}
              <div aria-live="polite" aria-atomic="true">
                {error && (
                  <p id="error-message" className="text-red-500 text-sm" role="alert">
                    {error}
                  </p>
                )}
              </div>

              {/* Submit button */}
              <button
                onClick={handleSubmit}
                disabled={!question.trim() || isProcessingImage}
                className={`w-full py-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 shadow-lg ${
                  !question.trim() || isProcessingImage
                    ? 'bg-neutral-200 dark:bg-neutral-700 text-neutral-500 shadow-none'
                    : struggleType === 'dont_understand'
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-blue-500/25'
                    : struggleType === 'test_coming'
                    ? 'bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white shadow-purple-500/25'
                    : 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-green-500/25'
                }`}
              >
                <span>Get Help</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* ============================================ */}
        {/* LOADING */}
        {/* ============================================ */}
        {flowStep === 'loading' && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mb-6 animate-pulse">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-4" />
            <p className="text-neutral-600 dark:text-neutral-400 font-medium">
              Creating your help...
            </p>
          </div>
        )}

        {/* ============================================ */}
        {/* RESULT - Learning Pack / Flashcards / Homework Plan */}
        {/* ============================================ */}
        {flowStep === 'result' && result && (
          <div className="space-y-4">
            {/* Back button + Instant badge */}
            <div className="flex items-center justify-between">
              <button
                onClick={resetFlow}
                className="flex items-center gap-2 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="text-sm">Start over</span>
              </button>

              {/* Instant badge - shows for fast responses (under 2 seconds) */}
              {responseTimeMs !== null && responseTimeMs < 2000 && (
                <div className="flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-yellow-100 to-orange-100 dark:from-yellow-900/30 dark:to-orange-900/30 border border-yellow-200 dark:border-yellow-800/50 rounded-full">
                  <Zap className="w-3 h-3 text-yellow-600 dark:text-yellow-400" />
                  <span className="text-xs font-medium text-yellow-700 dark:text-yellow-400">
                    Instant!
                  </span>
                </div>
              )}
            </div>

            {/* Acknowledgment */}
            {result.action.acknowledgment && (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30 rounded-xl">
                <p className="text-blue-800 dark:text-blue-200 text-sm">
                  {result.action.acknowledgment}
                </p>
              </div>
            )}

            {/* Learning Pack Result */}
            {result.action.type === 'learning_pack' && (
              <LearningPackResult
                pack={result.action}
                expandedSections={expandedSections}
                toggleSection={toggleSection}
              />
            )}

            {/* Flashcard Result */}
            {result.action.type === 'flashcards' && (
              <FlashcardResult
                pack={result.action}
                flippedCards={flippedCards}
                toggleCardFlip={toggleCardFlip}
                markedWeak={markedWeakCards}
                onMarkWeak={(question: string) => {
                  // Find the card id from question
                  const card = result.action.type === 'flashcards'
                    ? result.action.cards.find(c => c.question === question)
                    : null
                  if (card) {
                    setMarkedWeakCards(prev => new Set([...prev, card.id]))
                    addWeakFlashcard(question, question.slice(0, 30))
                  }
                }}
              />
            )}

            {/* Homework Plan Result */}
            {result.action.type === 'homework_plan' && (
              <HomeworkPlanResult
                plan={result.action}
                revealedHints={revealedHints}
                revealHint={(hintId: string) => {
                  revealHint(hintId)
                  // Track hint usage per step
                  const stepId = hintId.split('-hint-')[0]
                  setHintUsageCount(prev => {
                    const newCount = (prev[stepId] || 0) + 1
                    // If 2+ hints used, add to mission
                    if (newCount === 2 && result.action.type === 'homework_plan') {
                      const step = result.action.steps.find(s => s.id === stepId)
                      if (step) {
                        addStuckStep(step.title, step.description)
                      }
                    }
                    return { ...prev, [stepId]: newCount }
                  })
                }}
              />
            )}

            {/* Next Suggestion */}
            <div className="p-4 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-xl">
              <p className="text-neutral-600 dark:text-neutral-300 text-sm text-center">
                {result.action.nextSuggestion}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              {/* Still Confused button for Explain Pack */}
              {result.action.type === 'learning_pack' && (
                <button
                  onClick={() => {
                    addConfusedConcept(question, result.action.title)
                    resetFlow()
                  }}
                  className="flex-1 py-4 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-5 h-5" />
                  <span>Still confused</span>
                </button>
              )}
              <button
                onClick={resetFlow}
                className="flex-1 py-4 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-500/25"
              >
                <Check className="w-5 h-5" />
                <span>Got it!</span>
              </button>
            </div>

            {/* Quiet XP indicator */}
            {result.xpEarned > 0 && (
              <div className="flex justify-center">
                <span className="text-sm text-neutral-400">
                  +{result.xpEarned} XP
                </span>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  )
}

// ============================================
// HELPER COMPONENTS
// ============================================

interface ToolCardProps {
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  color: 'blue' | 'purple' | 'green'
  onClick: () => void
}

const ToolCard = memo(function ToolCard({
  title,
  description,
  icon: Icon,
  color,
  onClick,
}: ToolCardProps) {
  const colorClasses = {
    blue: {
      bg: 'bg-blue-100 dark:bg-blue-900/30',
      icon: 'text-blue-600 dark:text-blue-400',
      hover: 'hover:border-blue-300 dark:hover:border-blue-700',
    },
    purple: {
      bg: 'bg-purple-100 dark:bg-purple-900/30',
      icon: 'text-purple-600 dark:text-purple-400',
      hover: 'hover:border-purple-300 dark:hover:border-purple-700',
    },
    green: {
      bg: 'bg-green-100 dark:bg-green-900/30',
      icon: 'text-green-600 dark:text-green-400',
      hover: 'hover:border-green-300 dark:hover:border-green-700',
    },
  }

  const classes = colorClasses[color]

  return (
    <button
      onClick={onClick}
      className={`group w-full flex items-center gap-4 p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl ${classes.hover} hover:shadow-lg transition-all text-left`}
    >
      <div
        className={`w-12 h-12 ${classes.bg} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform`}
      >
        <Icon className={`w-6 h-6 ${classes.icon}`} />
      </div>
      <div className="flex-1">
        <h3 className="font-semibold text-neutral-900 dark:text-white">
          {title}
        </h3>
        <p className="text-sm text-neutral-500">{description}</p>
      </div>
      <ArrowRight className="w-5 h-5 text-neutral-400 group-hover:translate-x-1 transition-transform" />
    </button>
  )
})

// Learning Pack Result Component
interface LearningPackResultProps {
  pack: LearningPack
  expandedSections: Set<string>
  toggleSection: (section: string) => void
}

const LearningPackResult = memo(function LearningPackResult({
  pack,
  expandedSections,
  toggleSection,
}: LearningPackResultProps) {
  return (
    <div className="space-y-3">
      {/* Title */}
      <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
        {pack.title}
      </h2>

      {/* Core Idea - Always visible */}
      <CollapsibleSection
        title="Core Idea"
        icon={Lightbulb}
        isExpanded={expandedSections.has('core')}
        onToggle={() => toggleSection('core')}
        color="blue"
      >
        <p className="text-neutral-700 dark:text-neutral-300 mb-3">
          {pack.core.idea}
        </p>
        {pack.core.keyPoints.length > 0 && (
          <ul className="space-y-2">
            {pack.core.keyPoints.map((point, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="w-5 h-5 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                    {i + 1}
                  </span>
                </span>
                <span className="text-neutral-600 dark:text-neutral-400 text-sm">
                  {point}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CollapsibleSection>

      {/* Steps */}
      {pack.steps && pack.steps.length > 0 && (
        <CollapsibleSection
          title="Step by Step"
          icon={Map}
          isExpanded={expandedSections.has('steps')}
          onToggle={() => toggleSection('steps')}
          color="green"
        >
          <div className="space-y-3">
            {pack.steps.map((step, i) => (
              <div
                key={i}
                className="p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg"
              >
                <p className="font-medium text-neutral-900 dark:text-white text-sm">
                  {step.step}
                </p>
                <p className="text-xs text-neutral-500 mt-1">{step.why}</p>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Example */}
      {pack.example && (
        <CollapsibleSection
          title="Example"
          icon={BookOpen}
          isExpanded={expandedSections.has('example')}
          onToggle={() => toggleSection('example')}
          color="purple"
        >
          <div className="space-y-2">
            <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <p className="text-sm text-neutral-700 dark:text-neutral-300">
                <strong>Problem:</strong> {pack.example.problem}
              </p>
            </div>
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <p className="text-sm text-neutral-700 dark:text-neutral-300">
                <strong>Solution:</strong> {pack.example.solution}
              </p>
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/* Check Understanding */}
      {pack.checkQuestion && (
        <CollapsibleSection
          title="Check Understanding"
          icon={HelpCircle}
          isExpanded={expandedSections.has('check')}
          onToggle={() => toggleSection('check')}
          color="amber"
        >
          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
            <p className="font-medium text-neutral-900 dark:text-white text-sm mb-2">
              {pack.checkQuestion.question}
            </p>
            <p className="text-xs text-neutral-500">
              💡 Hint: {pack.checkQuestion.hint}
            </p>
          </div>
        </CollapsibleSection>
      )}
    </div>
  )
})

// Flashcard Result Component with weak-spot tracking
interface FlashcardResultProps {
  pack: FlashcardPack
  flippedCards: Set<string>
  toggleCardFlip: (id: string) => void
  onMarkWeak: (question: string) => void
  markedWeak: Set<string>
}

const FlashcardResult = memo(function FlashcardResult({
  pack,
  flippedCards,
  toggleCardFlip,
  onMarkWeak,
  markedWeak,
}: FlashcardResultProps) {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
        {pack.title}
      </h2>
      <p className="text-sm text-neutral-500">Tap cards to flip, then rate yourself</p>
      <div className="space-y-3">
        {pack.cards.map((card) => (
          <div
            key={card.id}
            className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden"
          >
            <button
              onClick={() => toggleCardFlip(card.id)}
              className="w-full p-5 text-left transition-all hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
            >
              {!flippedCards.has(card.id) ? (
                <>
                  <p className="text-xs text-purple-500 font-medium mb-2">
                    Question
                  </p>
                  <p className="text-neutral-900 dark:text-white font-medium">
                    {card.question}
                  </p>
                  {card.hint && (
                    <p className="text-xs text-neutral-400 mt-2">
                      💡 {card.hint}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p className="text-xs text-green-500 font-medium mb-2">
                    Answer
                  </p>
                  <p className="text-neutral-900 dark:text-white font-medium">
                    {card.answer}
                  </p>
                </>
              )}
            </button>

            {/* Self-rating buttons - only show after flip */}
            {flippedCards.has(card.id) && (
              <div className="px-5 pb-4 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                <p className="text-xs text-neutral-500 mb-2">Did you get it?</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (!markedWeak.has(card.id)) {
                        onMarkWeak(card.question)
                      }
                    }}
                    disabled={markedWeak.has(card.id)}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${
                      markedWeak.has(card.id)
                        ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                        : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400'
                    }`}
                  >
                    <ThumbsDown className="w-4 h-4" />
                    {markedWeak.has(card.id) ? 'Added to mission' : 'Not quite'}
                  </button>
                  <button
                    className="flex-1 py-2 px-3 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5"
                  >
                    <ThumbsUp className="w-4 h-4" />
                    Got it!
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
})

// Homework Plan Result Component
interface HomeworkPlanResultProps {
  plan: HomeworkPlan
  revealedHints: Set<string>
  revealHint: (id: string) => void
}

const HomeworkPlanResult = memo(function HomeworkPlanResult({
  plan,
  revealedHints,
  revealHint,
}: HomeworkPlanResultProps) {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
        {plan.title}
      </h2>
      <p className="text-sm text-green-600 dark:text-green-400">
        {plan.encouragement}
      </p>
      <div className="space-y-3">
        {plan.steps.map((step, index) => (
          <div
            key={step.id}
            className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl"
          >
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-green-600 dark:text-green-400">
                  {step.order}
                </span>
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-neutral-900 dark:text-white">
                  {step.title}
                </h4>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                  {step.description}
                </p>

                {/* Hint Ladder */}
                <div className="mt-3 space-y-2">
                  {step.hints.map((hint, hintIndex) => {
                    const hintId = `${step.id}-hint-${hintIndex}`
                    const isRevealed = revealedHints.has(hintId) || hintIndex === 0

                    if (!isRevealed) {
                      return (
                        <button
                          key={hintId}
                          onClick={() => revealHint(hintId)}
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          Need a hint?
                        </button>
                      )
                    }

                    return (
                      <p
                        key={hintId}
                        className="text-xs text-neutral-500 p-2 bg-neutral-50 dark:bg-neutral-800 rounded"
                      >
                        💡 {hint}
                      </p>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="text-center text-sm text-neutral-500">
        Total: ~{plan.totalMinutes} minutes
      </p>
    </div>
  )
})

// Collapsible Section Component
interface CollapsibleSectionProps {
  title: string
  icon: React.ComponentType<{ className?: string }>
  isExpanded: boolean
  onToggle: () => void
  color: 'blue' | 'green' | 'purple' | 'amber'
  children: React.ReactNode
}

const CollapsibleSection = memo(function CollapsibleSection({
  title,
  icon: Icon,
  isExpanded,
  onToggle,
  color,
  children,
}: CollapsibleSectionProps) {
  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
    amber: 'bg-amber-500',
  }

  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-8 h-8 ${colorClasses[color]} rounded-lg flex items-center justify-center`}
          >
            <Icon className="w-4 h-4 text-white" />
          </div>
          <span className="font-medium text-neutral-900 dark:text-white">
            {title}
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-neutral-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-neutral-400" />
        )}
      </button>
      {isExpanded && <div className="px-4 pb-4">{children}</div>}
    </div>
  )
})

// Mission Item Card Component
interface MissionItemCardProps {
  item: {
    id: string
    type: 'flashcard' | 'concept' | 'step'
    source: 'test_prep' | 'explain_pack' | 'guide_me'
    title: string
    description: string
    priority: 'high' | 'medium' | 'low'
  }
  onComplete: () => void
  onDismiss: () => void
  onTap: () => void
}

const MissionItemCard = memo(function MissionItemCard({
  item,
  onComplete,
  onDismiss,
  onTap,
}: MissionItemCardProps) {
  const typeConfig = {
    flashcard: {
      icon: Brain,
      color: 'purple',
      bgClass: 'bg-purple-100 dark:bg-purple-900/30',
      iconClass: 'text-purple-600 dark:text-purple-400',
    },
    concept: {
      icon: Lightbulb,
      color: 'blue',
      bgClass: 'bg-blue-100 dark:bg-blue-900/30',
      iconClass: 'text-blue-600 dark:text-blue-400',
    },
    step: {
      icon: ClipboardList,
      color: 'green',
      bgClass: 'bg-green-100 dark:bg-green-900/30',
      iconClass: 'text-green-600 dark:text-green-400',
    },
  }

  const config = typeConfig[item.type]
  const Icon = config.icon

  return (
    <div className="flex items-center gap-3 p-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl group">
      {/* Icon */}
      <div className={`w-10 h-10 ${config.bgClass} rounded-lg flex items-center justify-center flex-shrink-0`}>
        <Icon className={`w-5 h-5 ${config.iconClass}`} />
      </div>

      {/* Content - Tappable */}
      <button
        onClick={onTap}
        className="flex-1 text-left min-w-0"
      >
        <p className="font-medium text-neutral-900 dark:text-white text-sm truncate">
          {item.title}
        </p>
        <p className="text-xs text-neutral-500 truncate">
          {item.description}
        </p>
      </button>

      {/* Priority indicator */}
      {item.priority === 'high' && (
        <span className="px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-medium rounded">
          Weak
        </span>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onComplete()
          }}
          className="p-1.5 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg transition-colors"
          title="Mark as done"
        >
          <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDismiss()
          }}
          className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
          title="Dismiss"
        >
          <X className="w-4 h-4 text-neutral-400" />
        </button>
      </div>
    </div>
  )
})

// Helper function
function getTimeOfDay(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  return 'evening'
}
