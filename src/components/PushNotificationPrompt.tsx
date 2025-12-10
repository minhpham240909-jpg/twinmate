'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePushNotifications } from '@/hooks/usePushNotifications'

interface PushNotificationPromptProps {
  delay?: number // Delay before showing prompt (ms)
}

/**
 * Floating prompt to enable push notifications
 * Shows after user has been on the app for a while
 */
export default function PushNotificationPrompt({ delay = 30000 }: PushNotificationPromptProps) {
  const [showPrompt, setShowPrompt] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const {
    isSupported,
    isSubscribed,
    permission,
    isLoading,
    subscribe,
    shouldPrompt,
  } = usePushNotifications()

  // Show prompt after delay if appropriate
  useEffect(() => {
    // Debug logging for production troubleshooting
    console.log('[PushPrompt] Checking conditions:', {
      supported: isSupported,
      subscribed: isSubscribed,
      permission,
      loading: isLoading,
      dismissed,
      shouldPrompt: shouldPrompt()
    })

    if (!shouldPrompt() || dismissed) {
      return
    }

    // Check if user dismissed in this session (sessionStorage resets on browser close/logout)
    const sessionDismissed = sessionStorage.getItem('push_prompt_dismissed_session')
    if (sessionDismissed === 'true') {
      return
    }

    const timer = setTimeout(() => {
      setShowPrompt(true)
    }, delay)

    return () => clearTimeout(timer)
  }, [shouldPrompt, dismissed, delay])

  const handleEnable = async () => {
    const success = await subscribe()
    if (success) {
      setShowPrompt(false)
    }
  }

  const handleDismiss = () => {
    setDismissed(true)
    setShowPrompt(false)
    // Use sessionStorage so it only persists for this session (resets on browser close/logout)
    sessionStorage.setItem('push_prompt_dismissed_session', 'true')
  }

  const handleNotNow = () => {
    setDismissed(true)
    setShowPrompt(false)
    // Use sessionStorage so it only persists for this session (resets on browser close/logout)
    sessionStorage.setItem('push_prompt_dismissed_session', 'true')
  }

  // Don't render anything if not supported or already subscribed
  if (!isSupported || isSubscribed || permission === 'denied') {
    console.log('[PushPrompt] Not rendering because:', {
      notSupported: !isSupported,
      alreadySubscribed: isSubscribed,
      permissionDenied: permission === 'denied'
    })
    return null
  }

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed bottom-4 right-4 z-50 max-w-sm"
        >
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-500 to-purple-500 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-white font-semibold">Stay Connected</h3>
                  <p className="text-white/80 text-sm">Never miss important updates</p>
                </div>
                <button
                  onClick={handleDismiss}
                  className="ml-auto p-1 text-white/70 hover:text-white transition"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-4">
              <p className="text-gray-600 dark:text-slate-300 text-sm mb-4">
                Get notified about new messages, calls, and activity even when you're not on the app.
              </p>

              <ul className="space-y-2 mb-4">
                <li className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-400">
                  <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Incoming calls & messages
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-400">
                  <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Connection requests
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-400">
                  <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Likes & comments on posts
                </li>
              </ul>

              <div className="flex gap-2">
                <button
                  onClick={handleNotNow}
                  className="flex-1 px-4 py-2 text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition text-sm font-medium"
                >
                  Not Now
                </button>
                <button
                  onClick={handleEnable}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 transition text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Enabling...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                      Enable
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
