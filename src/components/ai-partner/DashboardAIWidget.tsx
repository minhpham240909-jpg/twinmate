'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'react-hot-toast'
import {
  Bot,
  X,
  Play,
  ArrowRight,
  Loader2,
  MessageSquare,
  Clock,
  Sparkles,
  Trash2,
  ChevronUp,
  Zap,
  BookOpen,
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

interface DashboardAIWidgetProps {
  onHidden?: () => void
}

export default function DashboardAIWidget({ onHidden }: DashboardAIWidgetProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [showWidget, setShowWidget] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [currentSession, setCurrentSession] = useState<CurrentSession | null>(null)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [isResuming, setIsResuming] = useState(false)
  const [isHiding, setIsHiding] = useState(false)
  const [showConfirmHide, setShowConfirmHide] = useState(false)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      const res = await fetch('/api/ai-partner/dashboard')
      const data = await res.json()

      if (data.success) {
        setShowWidget(data.showWidget)
        setCurrentSession(data.currentSession || null)
        setStats(data.stats || null)
      }
    } catch (error) {
      console.error('Failed to fetch AI Partner dashboard data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleResumeSession = async () => {
    if (!currentSession) return

    setIsResuming(true)
    try {
      const res = await fetch(`/api/ai-partner/session/${currentSession.id}/resume`, {
        method: 'POST',
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
      })
      const data = await res.json()

      if (data.success) {
        toast.success('AI Partner removed from dashboard', {
          icon: '👋',
        })
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
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsExpanded(true)}
        className="relative group"
      >
        {/* Glow effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl blur-lg opacity-40 group-hover:opacity-60 transition-opacity" />

        {/* Main button */}
        <div className="relative flex items-center gap-3 px-4 py-3 bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl border border-slate-700/50 shadow-xl cursor-pointer hover:border-blue-500/50 transition-all">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div className="text-left">
            <p className="text-white font-semibold text-sm">AI Partner</p>
            <p className="text-slate-400 text-xs">
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
                ? 'bg-green-400 animate-pulse'
                : 'bg-amber-400'
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
        {/* Glow effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-3xl blur-xl" />

        {/* Main card */}
        <div className="relative bg-gradient-to-br from-slate-800/95 to-slate-900/95 backdrop-blur-xl rounded-3xl border border-slate-700/50 shadow-2xl overflow-hidden">
          {/* Header with gradient */}
          <div className="relative p-5 pb-4">
            {/* Background pattern */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-purple-600/10 to-transparent" />
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-blue-500/20 to-transparent rounded-full blur-2xl" />

            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl blur-md opacity-50" />
                  <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                    <Bot className="w-6 h-6 text-white" />
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg">AI Study Partner</h3>
                  <p className="text-slate-400 text-xs flex items-center gap-1">
                    <Zap className="w-3 h-3 text-yellow-400" />
                    Powered by GPT-4
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsExpanded(false)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-xl transition-all"
              >
                <ChevronUp className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Current Session */}
          {currentSession && (
            <div className="px-5 pb-4">
              <div
                className={`rounded-2xl p-4 ${
                  currentSession.status === 'ACTIVE'
                    ? 'bg-gradient-to-br from-green-500/10 to-emerald-500/5 border border-green-500/20'
                    : 'bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/20'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span
                    className={`text-xs font-semibold px-3 py-1 rounded-full ${
                      currentSession.status === 'ACTIVE'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-amber-500/20 text-amber-400'
                    }`}
                  >
                    {currentSession.status === 'ACTIVE' ? '● Active' : '◐ Paused'}
                  </span>
                  <span className="text-xs text-slate-400 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5" />
                    {currentSession.messageCount}
                  </span>
                </div>

                <p className="text-white font-semibold mb-4 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-slate-400" />
                  {currentSession.subject || 'General Study'}
                </p>

                {currentSession.status === 'ACTIVE' ? (
                  <button
                    onClick={() => router.push(`/ai-partner/${currentSession.id}`)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl hover:from-green-600 hover:to-emerald-600 transition-all font-semibold shadow-lg shadow-green-500/25"
                  >
                    Continue Session
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={handleResumeSession}
                    disabled={isResuming}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl hover:from-amber-600 hover:to-orange-600 transition-all font-semibold shadow-lg shadow-amber-500/25 disabled:opacity-50"
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
                <div className="text-center p-3 bg-slate-700/30 rounded-xl">
                  <p className="text-xl font-bold text-white">{stats.totalSessions}</p>
                  <p className="text-xs text-slate-400">Sessions</p>
                </div>
                <div className="text-center p-3 bg-slate-700/30 rounded-xl">
                  <p className="text-xl font-bold text-white">{formatDuration(stats.totalDuration)}</p>
                  <p className="text-xs text-slate-400">Time</p>
                </div>
                <div className="text-center p-3 bg-slate-700/30 rounded-xl">
                  <p className="text-xl font-bold text-white">{stats.totalMessages}</p>
                  <p className="text-xs text-slate-400">Messages</p>
                </div>
              </div>
            </div>
          )}

          {/* No Session - Quick Start */}
          {!currentSession && (
            <div className="px-5 pb-4">
              <button
                onClick={() => router.push('/ai-partner')}
                className="w-full flex items-center justify-center gap-3 px-4 py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all font-semibold shadow-lg shadow-blue-500/25"
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
              className="text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-1"
            >
              View all sessions
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setShowConfirmHide(true)}
              className="text-sm text-slate-500 hover:text-red-400 transition-colors flex items-center gap-1"
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
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowConfirmHide(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-800 rounded-3xl p-6 max-w-sm w-full border border-slate-700 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-4 mb-5">
                <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center">
                  <Trash2 className="w-6 h-6 text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Remove Widget?</h3>
                  <p className="text-sm text-slate-400">From your dashboard</p>
                </div>
              </div>

              <div className="space-y-2 mb-6">
                <p className="text-slate-300 text-sm flex items-center gap-2">
                  <span className="text-green-400">✓</span>
                  Chat history will be saved
                </p>
                <p className="text-slate-300 text-sm flex items-center gap-2">
                  <span className="text-green-400">✓</span>
                  Access via /ai-partner anytime
                </p>
                <p className="text-slate-300 text-sm flex items-center gap-2">
                  <span className="text-amber-400">!</span>
                  Active sessions will end
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmHide(false)}
                  className="flex-1 px-4 py-3 bg-slate-700 text-white rounded-xl hover:bg-slate-600 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleHideWidget}
                  disabled={isHiding}
                  className="flex-1 px-4 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
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
    </>
  )
}
