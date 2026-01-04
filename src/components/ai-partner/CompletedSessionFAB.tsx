'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { X, Play, Sparkles, Clock, MessageSquare, CheckCircle } from 'lucide-react'

interface CompletedSession {
  id: string
  subject: string | null
  skillLevel: string | null
  studyGoal: string | null
  startedAt: string
  endedAt: string
  duration: number
  messageCount: number
}

// Local storage key for dismissed sessions
const DISMISSED_SESSIONS_KEY = 'clerva_dismissed_completed_sessions'

export default function CompletedSessionFAB() {
  const router = useRouter()
  const pathname = usePathname()
  const t = useTranslations('aiPartner')

  const [completedSession, setCompletedSession] = useState<CompletedSession | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Get dismissed session IDs from localStorage
  const getDismissedSessions = useCallback((): string[] => {
    if (typeof window === 'undefined') return []
    try {
      const stored = localStorage.getItem(DISMISSED_SESSIONS_KEY)
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  }, [])

  // Add session ID to dismissed list
  const dismissSession = useCallback((sessionId: string) => {
    if (typeof window === 'undefined') return
    try {
      const dismissed = getDismissedSessions()
      if (!dismissed.includes(sessionId)) {
        // Keep only last 50 dismissed sessions to prevent localStorage bloat
        const updated = [...dismissed, sessionId].slice(-50)
        localStorage.setItem(DISMISSED_SESSIONS_KEY, JSON.stringify(updated))
      }
    } catch (err) {
      console.error('Failed to save dismissed session:', err)
    }
  }, [getDismissedSessions])

  // Check for completed session
  const checkCompletedSession = useCallback(async () => {
    try {
      const res = await fetch('/api/ai-partner/completed-session')

      if (!res.ok) {
        return
      }

      const data = await res.json()

      if (data.success && data.hasCompletedSession) {
        // Check if this session was dismissed
        const dismissed = getDismissedSessions()
        if (!dismissed.includes(data.session.id)) {
          console.log('[CompletedSessionFAB] Found completed session:', data.session)
          setCompletedSession(data.session)
        } else {
          setCompletedSession(null)
        }
      } else {
        setCompletedSession(null)
      }
    } catch (err) {
      console.error('Failed to check completed session:', err)
    }
  }, [getDismissedSessions])

  // Check on initial mount
  useEffect(() => {
    checkCompletedSession()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Re-check when pathname changes
  useEffect(() => {
    checkCompletedSession()
  }, [pathname, checkCompletedSession])

  // Listen for session ended event
  useEffect(() => {
    const handleSessionEnded = () => {
      console.log('[CompletedSessionFAB] Session ended event received')
      // Delay to ensure database is updated
      setTimeout(checkCompletedSession, 300)
    }
    window.addEventListener('ai-partner-session-ended', handleSessionEnded)

    return () => {
      window.removeEventListener('ai-partner-session-ended', handleSessionEnded)
    }
  }, [checkCompletedSession])

  // Handle dismiss
  const handleDismiss = () => {
    if (completedSession) {
      dismissSession(completedSession.id)
      setCompletedSession(null)
      setShowModal(false)
    }
  }

  // Handle continue with same topic/context
  const handleContinueWithContext = () => {
    if (!completedSession) return
    setIsLoading(true)

    // Navigate to AI partner with previous session context
    const params = new URLSearchParams()
    if (completedSession.subject) {
      params.set('subject', completedSession.subject)
    }
    if (completedSession.skillLevel) {
      params.set('skillLevel', completedSession.skillLevel)
    }
    if (completedSession.studyGoal) {
      params.set('studyGoal', completedSession.studyGoal)
    }
    params.set('continueFrom', completedSession.id)

    // Dismiss this session so it doesn't show again
    dismissSession(completedSession.id)
    setCompletedSession(null)
    setShowModal(false)

    router.push(`/ai-partner?${params.toString()}`)
  }

  // Handle start fresh
  const handleStartFresh = () => {
    setIsLoading(true)

    // Dismiss this session
    if (completedSession) {
      dismissSession(completedSession.id)
      setCompletedSession(null)
    }
    setShowModal(false)

    router.push('/ai-partner')
  }

  // Format duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    return mins
  }

  // Only show on dashboard page, not on other pages
  const isDashboard = pathname === '/dashboard'

  // Don't render if no completed session or not on dashboard
  if (!completedSession || !isDashboard) return null

  return (
    <>
      {/* Floating Action Button */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        onClick={() => setShowModal(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 shadow-lg shadow-green-500/30 hover:shadow-xl hover:shadow-green-500/40 transition-shadow"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        {/* Success icon */}
        <div className="relative">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <Image
              src="/logo.png"
              alt="AI Partner"
              width={20}
              height={20}
              className="object-contain"
            />
          </div>
          <CheckCircle className="w-4 h-4 text-white absolute -bottom-1 -right-1 bg-green-600 rounded-full" />
        </div>

        {/* Text */}
        <span className="text-white font-medium text-sm">
          {t('completedSession.studyAgain')}
        </span>

        {/* Dismiss button */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleDismiss()
          }}
          className="ml-1 p-1 hover:bg-white/20 rounded-full transition-colors"
        >
          <X className="w-4 h-4 text-white/80" />
        </button>
      </motion.button>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-slate-900 rounded-2xl max-w-sm w-full border border-slate-700/50 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="relative bg-gradient-to-r from-green-600/20 to-emerald-600/20 p-5 border-b border-slate-700/50">
                <button
                  onClick={() => setShowModal(false)}
                  className="absolute top-3 right-3 text-slate-400 hover:text-white transition-colors p-1"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center overflow-hidden">
                    <Image src="/logo.png" alt="AI Partner" width={32} height={32} className="object-contain" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                      {t('completedSession.title')}
                      <CheckCircle className="w-5 h-5 text-green-400" />
                    </h2>
                    <p className="text-sm text-slate-400">
                      {completedSession.subject || t('completedSession.studySession')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-5">
                <p className="text-slate-300 text-sm mb-5">
                  {t('completedSession.message')}
                </p>

                {/* Session stats */}
                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div className="bg-slate-800/50 rounded-xl p-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <Clock className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">{t('completedSession.duration')}</p>
                      <p className="text-sm text-white font-medium">
                        {formatDuration(completedSession.duration)} {t('completedSession.minutes')}
                      </p>
                    </div>
                  </div>
                  <div className="bg-slate-800/50 rounded-xl p-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <MessageSquare className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">{t('completedSession.messages')}</p>
                      <p className="text-sm text-white font-medium">{completedSession.messageCount}</p>
                    </div>
                  </div>
                </div>

                {/* Buttons */}
                <div className="space-y-3">
                  {/* Continue with context - only show if there was a subject */}
                  {completedSession.subject && (
                    <button
                      onClick={handleContinueWithContext}
                      disabled={isLoading}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl hover:from-green-600 hover:to-emerald-600 transition-all disabled:opacity-50"
                    >
                      <Play className="w-4 h-4" />
                      {t('completedSession.continueWithContext')}
                      <span className="text-white/70 text-xs ml-1">({completedSession.subject})</span>
                    </button>
                  )}

                  {/* Start fresh */}
                  <button
                    onClick={handleStartFresh}
                    disabled={isLoading}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl transition-all disabled:opacity-50 ${
                      completedSession.subject
                        ? 'bg-slate-700 text-white hover:bg-slate-600'
                        : 'bg-gradient-to-r from-blue-500 to-blue-500 text-white hover:from-blue-600 hover:to-blue-600'
                    }`}
                  >
                    <Sparkles className="w-4 h-4" />
                    {t('completedSession.startFresh')}
                  </button>

                  {/* Dismiss */}
                  <button
                    onClick={handleDismiss}
                    className="w-full text-center text-sm text-slate-400 hover:text-white transition-colors py-2"
                  >
                    {t('completedSession.dismiss')}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
