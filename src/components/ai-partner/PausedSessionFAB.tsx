'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { X, Play, Square, Loader2 } from 'lucide-react'

interface PausedSession {
  id: string
  subject: string | null
  startedAt: string
  duration: number
  messageCount: number
}

export default function PausedSessionFAB() {
  const router = useRouter()
  const pathname = usePathname()
  const t = useTranslations('aiPartner')

  const [pausedSession, setPausedSession] = useState<PausedSession | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isEnding, setIsEnding] = useState(false)

  // Check for paused session on mount and periodically
  const checkPausedSession = useCallback(async () => {
    try {
      const res = await fetch('/api/ai-partner/paused-session')

      if (!res.ok) {
        // User not logged in or other auth issue - silently ignore
        return
      }

      const data = await res.json()

      if (data.success && data.hasPausedSession) {
        console.log('[PausedSessionFAB] Found paused session:', data.session)
        setPausedSession(data.session)
      } else {
        setPausedSession(null)
      }
    } catch (err) {
      // Silently ignore errors (e.g., user not logged in)
      console.error('Failed to check paused session:', err)
    }
  }, [])

  // Check on initial mount
  useEffect(() => {
    console.log('[PausedSessionFAB] Component mounted, initial check')
    checkPausedSession()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Re-check when pathname changes (navigating between pages)
  useEffect(() => {
    console.log('[PausedSessionFAB] Pathname changed to:', pathname)
    checkPausedSession()
  }, [pathname, checkPausedSession])

  useEffect(() => {
    // Check every 30 seconds
    const interval = setInterval(checkPausedSession, 30000)

    // Also check when window regains focus (e.g., after navigating back)
    const handleFocus = () => {
      console.log('[PausedSessionFAB] Window focused, checking for paused session')
      checkPausedSession()
    }
    window.addEventListener('focus', handleFocus)

    // Also check on visibility change (when tab becomes visible)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[PausedSessionFAB] Tab visible, checking for paused session')
        checkPausedSession()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Listen for custom event when session is paused
    const handleSessionPaused = () => {
      console.log('[PausedSessionFAB] Session paused event received, checking for paused session')
      // Small delay to ensure database is updated
      setTimeout(checkPausedSession, 200)
    }
    window.addEventListener('ai-partner-session-paused', handleSessionPaused)

    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('ai-partner-session-paused', handleSessionPaused)
    }
  }, [checkPausedSession])

  // Handle continue session
  const handleContinue = async () => {
    if (!pausedSession) return

    setIsLoading(true)
    try {
      const res = await fetch(`/api/ai-partner/session/${pausedSession.id}/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await res.json()

      if (data.success) {
        setShowModal(false)
        router.push(`/ai-partner/${pausedSession.id}`)
      } else {
        console.error('Failed to resume session:', data.error)
      }
    } catch (err) {
      console.error('Failed to resume session:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // Handle end session
  const handleEndSession = async () => {
    if (!pausedSession) return

    setIsEnding(true)
    try {
      const res = await fetch(`/api/ai-partner/session/${pausedSession.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      const data = await res.json()

      if (data.success) {
        setPausedSession(null)
        setShowModal(false)
      } else {
        console.error('Failed to end session:', data.error)
      }
    } catch (err) {
      console.error('Failed to end session:', err)
    } finally {
      setIsEnding(false)
    }
  }

  // Only show on dashboard page, not on other pages
  const isDashboard = pathname === '/dashboard'

  // Don't render if no paused session or not on dashboard
  if (!pausedSession || !isDashboard) return null

  return (
    <>
      {/* Floating Action Button */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        onClick={() => setShowModal(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-blue-500/30 flex items-center justify-center overflow-hidden hover:shadow-xl hover:shadow-blue-500/40 transition-shadow"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        {/* Pulse animation ring */}
        <span className="absolute inset-0 rounded-full bg-blue-400 animate-ping opacity-30" />
        <span className="absolute inset-1 rounded-full bg-gradient-to-br from-blue-500 to-purple-600" />

        {/* Logo */}
        <Image
          src="/logo.png"
          alt="AI Partner"
          width={32}
          height={32}
          className="relative z-10 object-contain"
        />
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
              <div className="relative bg-gradient-to-r from-blue-600/20 to-purple-600/20 p-5 border-b border-slate-700/50">
                <button
                  onClick={() => setShowModal(false)}
                  className="absolute top-3 right-3 text-slate-400 hover:text-white transition-colors p-1"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center overflow-hidden">
                    <Image src="/logo.png" alt="AI Partner" width={32} height={32} className="object-contain" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">
                      {t('pausedSession.title')}
                    </h2>
                    <p className="text-sm text-slate-400">
                      {pausedSession.subject || t('pausedSession.studySession')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-5">
                <p className="text-slate-300 text-sm mb-5">
                  {t('pausedSession.message')}
                </p>

                {/* Session info */}
                <div className="bg-slate-800/50 rounded-xl p-3 mb-5 flex items-center justify-between text-sm">
                  <span className="text-slate-400">{t('pausedSession.messages')}</span>
                  <span className="text-white font-medium">{pausedSession.messageCount}</span>
                </div>

                {/* Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={handleEndSession}
                    disabled={isEnding || isLoading}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-700 text-white rounded-xl hover:bg-slate-600 transition-colors disabled:opacity-50"
                  >
                    {isEnding ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                    {t('pausedSession.endSession')}
                  </button>
                  <button
                    onClick={handleContinue}
                    disabled={isLoading || isEnding}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl hover:from-blue-600 hover:to-purple-600 transition-all disabled:opacity-50"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                    {t('pausedSession.continue')}
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
