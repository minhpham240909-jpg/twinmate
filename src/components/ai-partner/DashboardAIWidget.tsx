'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'react-hot-toast'
import {
  Bot,
  X,
  Play,
  Pause,
  ArrowRight,
  Loader2,
  MessageSquare,
  Clock,
  Sparkles,
  Trash2,
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl border border-slate-700/50 overflow-hidden"
    >
      {/* Header */}
      <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-white">AI Study Partner</h3>
            <p className="text-xs text-slate-400">Your study companion</p>
          </div>
        </div>
        <button
          onClick={() => setShowConfirmHide(true)}
          className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
          title="Remove from dashboard"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Current Session */}
      {currentSession && (
        <div className="p-4 border-b border-slate-700/50">
          <div
            className={`rounded-xl p-4 ${
              currentSession.status === 'ACTIVE'
                ? 'bg-green-500/10 border border-green-500/30'
                : 'bg-amber-500/10 border border-amber-500/30'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  currentSession.status === 'ACTIVE'
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-amber-500/20 text-amber-400'
                }`}
              >
                {currentSession.status === 'ACTIVE' ? 'Active Session' : 'Paused Session'}
              </span>
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                {currentSession.messageCount} msgs
              </span>
            </div>

            <p className="text-white font-medium mb-3">
              {currentSession.subject || 'General Study'}
            </p>

            {currentSession.status === 'ACTIVE' ? (
              <button
                onClick={() => router.push(`/ai-partner/${currentSession.id}`)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors text-sm font-medium"
              >
                Continue
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleResumeSession}
                disabled={isResuming}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 transition-colors text-sm font-medium disabled:opacity-50"
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
        <div className="p-4 grid grid-cols-3 gap-3">
          <div className="text-center">
            <p className="text-lg font-semibold text-white">{stats.totalSessions}</p>
            <p className="text-xs text-slate-400">Sessions</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold text-white">{formatDuration(stats.totalDuration)}</p>
            <p className="text-xs text-slate-400">Study Time</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold text-white">{stats.totalMessages}</p>
            <p className="text-xs text-slate-400">Messages</p>
          </div>
        </div>
      )}

      {/* No Session - Quick Start */}
      {!currentSession && (
        <div className="p-4">
          <button
            onClick={() => router.push('/ai-partner')}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-white rounded-xl hover:from-blue-500/30 hover:to-purple-500/30 transition-colors font-medium border border-slate-600/50"
          >
            <Sparkles className="w-4 h-4 text-purple-400" />
            View AI Partner
          </button>
        </div>
      )}

      {/* Confirm Hide Modal */}
      <AnimatePresence>
        {showConfirmHide && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowConfirmHide(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-800 rounded-2xl p-6 max-w-sm w-full border border-slate-700"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Remove AI Partner?</h3>
                </div>
              </div>

              <p className="text-slate-400 text-sm mb-2">
                This will remove the AI Partner widget from your dashboard.
              </p>
              <ul className="text-slate-400 text-sm mb-6 space-y-1">
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span> Your chat history will be saved
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span> You can access it from /ai-partner
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-amber-400">!</span> Active sessions will be ended
                </li>
              </ul>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmHide(false)}
                  className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-xl hover:bg-slate-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleHideWidget}
                  disabled={isHiding}
                  className="flex-1 px-4 py-2 bg-red-500/20 text-red-400 rounded-xl hover:bg-red-500/30 transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
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
    </motion.div>
  )
}
