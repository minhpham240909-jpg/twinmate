'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'react-hot-toast'
import {
  X,
  Play,
  ArrowRight,
  Loader2,
  MessageSquare,
  Sparkles,
  Trash2,
  ChevronUp,
  BookOpen,
  History,
  Plus,
  Brain,
} from 'lucide-react'

interface CurrentSession {
  id: string
  subject: string | null
  status: 'ACTIVE' | 'PAUSED'
  messageCount: number
  startedAt: string
}

interface DashboardStats {
  totalSessions: number
  totalDuration: number
  totalMessages: number
}

interface LastCompletedSession {
  id: string
  subject: string | null
  endedAt: string | null
  messageCount: number
}

interface DashboardAIWidgetProps {
  onHidden?: () => void
}

// Cache keys for localStorage
const CACHE_KEY_SHOW_WIDGET = 'aipartner_showWidget'
const CACHE_KEY_SESSION = 'aipartner_currentSession'
const CACHE_KEY_STATS = 'aipartner_stats'
const CACHE_KEY_LAST_SESSION = 'aipartner_lastSession'
const CACHE_EXPIRY = 5 * 60 * 1000 // 5 minutes

// Helper to get cached value with expiry check
function getCachedValue<T>(key: string): T | null {
  if (typeof window === 'undefined') return null
  try {
    const cached = localStorage.getItem(key)
    if (!cached) return null
    const { value, timestamp } = JSON.parse(cached)
    // Check if cache is expired
    if (Date.now() - timestamp > CACHE_EXPIRY) {
      localStorage.removeItem(key)
      return null
    }
    return value as T
  } catch {
    return null
  }
}

// Helper to set cached value with timestamp
function setCachedValue<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify({ value, timestamp: Date.now() }))
  } catch {
    // Ignore storage errors
  }
}

export default function DashboardAIWidget({ onHidden }: DashboardAIWidgetProps) {
  const router = useRouter()
  // Initialize from cache to prevent flicker on navigation
  const [isLoading, setIsLoading] = useState(() => {
    // If we have cached showWidget, don't show loading state
    return getCachedValue<boolean>(CACHE_KEY_SHOW_WIDGET) === null
  })
  const [showWidget, setShowWidget] = useState(() => getCachedValue<boolean>(CACHE_KEY_SHOW_WIDGET) ?? false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [currentSession, setCurrentSession] = useState<CurrentSession | null>(() => getCachedValue<CurrentSession>(CACHE_KEY_SESSION))
  const [stats, setStats] = useState<DashboardStats | null>(() => getCachedValue<DashboardStats>(CACHE_KEY_STATS))
  const [lastCompletedSession, setLastCompletedSession] = useState<LastCompletedSession | null>(() => getCachedValue<LastCompletedSession>(CACHE_KEY_LAST_SESSION))
  const [isResuming, setIsResuming] = useState(false)
  const [isHiding, setIsHiding] = useState(false)
  const [showConfirmHide, setShowConfirmHide] = useState(false)
  const [showStudyOptions, setShowStudyOptions] = useState(false)
  const [isStartingSession, setIsStartingSession] = useState(false)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      const res = await fetch('/api/ai-partner/dashboard')
      const data = await res.json()

      if (data.success) {
        // Update state
        setShowWidget(data.showWidget)
        setCurrentSession(data.currentSession || null)
        setStats(data.stats || null)
        setLastCompletedSession(data.lastCompletedSession || null)

        // Cache the values for next navigation
        setCachedValue(CACHE_KEY_SHOW_WIDGET, data.showWidget)
        setCachedValue(CACHE_KEY_SESSION, data.currentSession || null)
        setCachedValue(CACHE_KEY_STATS, data.stats || null)
        setCachedValue(CACHE_KEY_LAST_SESSION, data.lastCompletedSession || null)
      } else {
        // If API says don't show, update cache
        setCachedValue(CACHE_KEY_SHOW_WIDGET, false)
        setShowWidget(false)
      }
    } catch (error) {
      console.error('Failed to fetch AI Partner dashboard data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Handle quick start - shows modal with options
  const handleQuickStart = () => {
    setShowStudyOptions(true)
  }

  // Start new session with selected mode
  const handleStartSession = async (mode: 'continue' | 'new') => {
    setIsStartingSession(true)
    try {
      const res = await fetch('/api/ai-partner/quick-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      })
      const data = await res.json()

      if (data.success) {
        toast.success(mode === 'continue' ? 'Continuing your study session!' : 'Starting new session!')
        router.push(data.redirectUrl)
      } else if (data.existingSessionId) {
        // User already has an active session
        toast.error('You already have an active session')
        router.push(`/ai-partner/${data.existingSessionId}`)
      } else {
        toast.error(data.error || 'Failed to start session')
      }
    } catch (error) {
      console.error('Failed to start session:', error)
      toast.error('Failed to start session')
    } finally {
      setIsStartingSession(false)
      setShowStudyOptions(false)
    }
  }

  const handleResumeSession = async () => {
    if (!currentSession) return

    setIsResuming(true)
    try {
      const res = await fetch(`/api/ai-partner/session/${currentSession.id}/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()

      if (data.success) {
        toast.success('Session resumed!')
        router.push(`/ai-partner/${currentSession.id}`)
      } else {
        toast.error(data.error || 'Failed to resume session')
      }
    } catch (error) {
      console.error('Failed to resume session:', error)
      toast.error('Failed to resume session')
    } finally {
      setIsResuming(false)
    }
  }

  const handleHideWidget = async () => {
    setIsHiding(true)
    try {
      const res = await fetch('/api/ai-partner/hide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()

      if (data.success) {
        toast.success('AI Partner removed from dashboard', {
          icon: '👋',
        })
        // Clear cache when hiding
        setCachedValue(CACHE_KEY_SHOW_WIDGET, false)
        setShowWidget(false)
        setShowConfirmHide(false)
        setIsExpanded(false)
        if (onHidden) onHidden()
      } else {
        toast.error(data.error || 'Failed to hide AI Partner')
      }
    } catch (error) {
      console.error('Failed to hide AI Partner:', error)
      toast.error('Failed to hide AI Partner')
    } finally {
      setIsHiding(false)
    }
  }

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    if (hours > 0) return `${hours}h ${mins}m`
    return `${mins}m`
  }

  // Don't render if loading or widget should not be shown
  if (isLoading || !showWidget) {
    return null
  }

  // Floating Icon (collapsed state)
  if (!isExpanded) {
    return (
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setIsExpanded(true)}
        className="relative group"
      >
        {/* Main button */}
        <div className="relative flex items-center gap-3 px-4 py-3 bg-neutral-900 dark:bg-neutral-800 rounded-2xl border border-neutral-800 dark:border-neutral-700 shadow-lg cursor-pointer hover:border-blue-600 transition-all">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center overflow-hidden">
            <Image src="/logo.png" alt="AI Partner" width={28} height={28} className="object-contain" />
          </div>
          <div className="text-left">
            <p className="text-white font-semibold text-sm">AI Partner</p>
            <p className="text-neutral-400 text-xs">
              {currentSession
                ? currentSession.status === 'ACTIVE'
                  ? 'Active session'
                  : 'Paused session'
                : 'Start studying'}
            </p>
          </div>

          {/* Status indicator */}
          {currentSession && (
            <div className={`w-2.5 h-2.5 rounded-full ${
              currentSession.status === 'ACTIVE'
                ? 'bg-blue-500 animate-pulse'
                : 'bg-neutral-400'
            }`} />
          )}
        </div>
      </motion.button>
    )
  }

  // Expanded panel
  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        className="relative w-full max-w-sm"
      >
        {/* Main card */}
        <div className="relative bg-neutral-900 dark:bg-neutral-800 rounded-2xl border border-neutral-800 dark:border-neutral-700 shadow-xl overflow-hidden">
          {/* Header */}
          <div className="p-5 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center overflow-hidden">
                  <Image src="/logo.png" alt="AI Partner" width={32} height={32} className="object-contain" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg">AI Study Partner</h3>
                  <p className="text-neutral-400 text-xs flex items-center gap-1">
                    <Brain className="w-3 h-3 text-blue-400" />
                    Your personal study assistant
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsExpanded(false)}
                className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 dark:hover:bg-neutral-700 rounded-xl transition-all"
              >
                <ChevronUp className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Current Session */}
          {currentSession && (
            <div className="px-5 pb-4">
              <div
                className={`rounded-xl p-4 ${
                  currentSession.status === 'ACTIVE'
                    ? 'bg-blue-600/10 border border-blue-600/20'
                    : 'bg-neutral-800 dark:bg-neutral-700 border border-neutral-700 dark:border-neutral-600'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span
                    className={`text-xs font-semibold px-3 py-1 rounded-full ${
                      currentSession.status === 'ACTIVE'
                        ? 'bg-blue-600/20 text-blue-400'
                        : 'bg-neutral-700 dark:bg-neutral-600 text-neutral-300'
                    }`}
                  >
                    {currentSession.status === 'ACTIVE' ? '● Active' : '◐ Paused'}
                  </span>
                  <span className="text-xs text-neutral-400 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5" />
                    {currentSession.messageCount}
                  </span>
                </div>

                <p className="text-white font-semibold mb-4 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-neutral-400" />
                  {currentSession.subject || 'General Study'}
                </p>

                {currentSession.status === 'ACTIVE' ? (
                  <button
                    onClick={() => router.push(`/ai-partner/${currentSession.id}`)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors font-semibold"
                  >
                    Continue Session
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={handleResumeSession}
                    disabled={isResuming}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white hover:bg-neutral-100 text-neutral-900 rounded-xl transition-colors font-semibold disabled:opacity-50"
                  >
                    {isResuming ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        Resume Session
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Stats */}
          {stats && stats.totalSessions > 0 && (
            <div className="px-5 pb-4">
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-3 bg-neutral-800 dark:bg-neutral-700 rounded-xl">
                  <p className="text-xl font-bold text-white">{stats.totalSessions}</p>
                  <p className="text-xs text-neutral-400">Sessions</p>
                </div>
                <div className="text-center p-3 bg-neutral-800 dark:bg-neutral-700 rounded-xl">
                  <p className="text-xl font-bold text-white">{formatDuration(stats.totalDuration)}</p>
                  <p className="text-xs text-neutral-400">Time</p>
                </div>
                <div className="text-center p-3 bg-neutral-800 dark:bg-neutral-700 rounded-xl">
                  <p className="text-xl font-bold text-white">{stats.totalMessages}</p>
                  <p className="text-xs text-neutral-400">Messages</p>
                </div>
              </div>
            </div>
          )}

          {/* No Session - Quick Start */}
          {!currentSession && (
            <div className="px-5 pb-4">
              <button
                onClick={handleQuickStart}
                className="w-full flex items-center justify-center gap-3 px-4 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors font-semibold"
              >
                <Sparkles className="w-5 h-5" />
                Start Studying with AI
              </button>
            </div>
          )}

          {/* Footer actions */}
          <div className="px-5 pb-5 flex items-center justify-between">
            <button
              onClick={() => router.push('/ai-partner')}
              className="text-sm text-neutral-400 hover:text-white transition-colors flex items-center gap-1"
            >
              View all sessions
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setShowConfirmHide(true)}
              className="text-sm text-neutral-500 hover:text-neutral-300 transition-colors flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              Remove
            </button>
          </div>
        </div>
      </motion.div>

      {/* Confirm Hide Modal */}
      <AnimatePresence>
        {showConfirmHide && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowConfirmHide(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-neutral-900 rounded-2xl p-6 max-w-sm w-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-4 mb-5">
                <div className="w-12 h-12 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                  <Trash2 className="w-6 h-6 text-neutral-600 dark:text-neutral-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-neutral-900 dark:text-white">Remove Widget?</h3>
                  <p className="text-sm text-neutral-500">From your dashboard</p>
                </div>
              </div>

              <div className="space-y-2 mb-6">
                <p className="text-neutral-600 dark:text-neutral-300 text-sm flex items-center gap-2">
                  <span className="text-blue-600">✓</span>
                  Chat history will be saved
                </p>
                <p className="text-neutral-600 dark:text-neutral-300 text-sm flex items-center gap-2">
                  <span className="text-blue-600">✓</span>
                  Access via /ai-partner anytime
                </p>
                <p className="text-neutral-600 dark:text-neutral-300 text-sm flex items-center gap-2">
                  <span className="text-neutral-400">!</span>
                  Active sessions will end
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmHide(false)}
                  className="flex-1 px-4 py-3 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white rounded-xl hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleHideWidget}
                  disabled={isHiding}
                  className="flex-1 px-4 py-3 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-xl hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isHiding ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Remove'
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Study Options Modal */}
      <AnimatePresence>
        {showStudyOptions && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => !isStartingSession && setShowStudyOptions(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-neutral-900 rounded-2xl p-6 max-w-md w-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-xl bg-blue-600 flex items-center justify-center overflow-hidden">
                  <Image src="/logo.png" alt="AI Partner" width={38} height={38} className="object-contain" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-neutral-900 dark:text-white">Start Studying</h3>
                  <p className="text-sm text-neutral-500">Choose how you want to begin</p>
                </div>
              </div>

              {/* Options */}
              <div className="space-y-3">
                {/* Continue Previous Topic - Always show, disabled if no previous topic */}
                <button
                  onClick={() => handleStartSession('continue')}
                  disabled={isStartingSession || !lastCompletedSession?.subject}
                  className={`w-full p-4 rounded-xl transition-all text-left group disabled:opacity-50 ${
                    lastCompletedSession?.subject
                      ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 hover:border-blue-400 dark:hover:border-blue-600'
                      : 'bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                      lastCompletedSession?.subject
                        ? 'bg-blue-100 dark:bg-blue-900/30'
                        : 'bg-neutral-200 dark:bg-neutral-700'
                    }`}>
                      <History className={`w-6 h-6 ${lastCompletedSession?.subject ? 'text-blue-600 dark:text-blue-400' : 'text-neutral-400'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-semibold mb-1 ${lastCompletedSession?.subject ? 'text-neutral-900 dark:text-white' : 'text-neutral-400'}`}>
                        Continue Previous Topic
                      </p>
                      {lastCompletedSession?.subject ? (
                        <>
                          <p className="text-sm text-neutral-500 dark:text-neutral-400 truncate">
                            Resume studying: <span className="text-blue-600 dark:text-blue-400">{lastCompletedSession.subject}</span>
                          </p>
                          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
                            AI will remember your progress and build on it
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-neutral-400 dark:text-neutral-500">
                          No previous topic available
                        </p>
                      )}
                    </div>
                    {isStartingSession && lastCompletedSession?.subject && (
                      <Loader2 className="w-5 h-5 text-blue-600 animate-spin flex-shrink-0" />
                    )}
                  </div>
                </button>

                {/* Start New Topic */}
                <button
                  onClick={() => handleStartSession('new')}
                  disabled={isStartingSession}
                  className="w-full p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl hover:border-blue-400 dark:hover:border-blue-600 transition-all text-left group disabled:opacity-50"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                      <Plus className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-neutral-900 dark:text-white mb-1">Start New Topic</p>
                      <p className="text-sm text-neutral-500 dark:text-neutral-400">
                        Begin a fresh study session on any subject
                      </p>
                      <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
                        AI will ask what you&apos;d like to learn today
                      </p>
                    </div>
                    {isStartingSession && (
                      <Loader2 className="w-5 h-5 text-blue-600 animate-spin flex-shrink-0" />
                    )}
                  </div>
                </button>
              </div>

              {/* Memory indicator */}
              {stats && stats.totalSessions > 0 && (
                <div className="mt-5 p-3 bg-neutral-100 dark:bg-neutral-800 rounded-xl">
                  <div className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
                    <Brain className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>
                      AI remembers your <span className="text-neutral-900 dark:text-white font-medium">{stats.totalSessions}</span> previous sessions
                    </span>
                  </div>
                </div>
              )}

              {/* Cancel button */}
              <button
                onClick={() => setShowStudyOptions(false)}
                disabled={isStartingSession}
                className="w-full mt-4 px-4 py-3 text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors text-sm disabled:opacity-50"
              >
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
