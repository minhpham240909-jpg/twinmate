'use client'

import { useState, useEffect } from 'react'
import { Bell, BellOff, X, ArrowRight } from 'lucide-react'

interface FocusSessionReminderProps {
  /** Whether notification permission is granted */
  hasPermission: boolean
  /** Request notification permission */
  onRequestPermission: () => Promise<boolean>
  /** Whether session is active */
  isSessionActive: boolean
  /** Whether session is paused */
  isPaused: boolean
  /** Callback to resume session */
  onResume?: () => void
}

/**
 * Component that shows notification permission prompt and welcome-back message
 * Follows the "design for return, not containment" philosophy
 */
export default function FocusSessionReminder({
  hasPermission,
  onRequestPermission,
  isSessionActive,
  isPaused,
  onResume,
}: FocusSessionReminderProps) {
  const [showPermissionPrompt, setShowPermissionPrompt] = useState(false)
  const [showWelcomeBack, setShowWelcomeBack] = useState(false)
  const [hasAskedPermission, setHasAskedPermission] = useState(false)

  // Check if we should show permission prompt (only once per session)
  useEffect(() => {
    if (isSessionActive && !hasPermission && !hasAskedPermission) {
      // Show prompt after 5 seconds of active session
      const timer = setTimeout(() => {
        setShowPermissionPrompt(true)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [isSessionActive, hasPermission, hasAskedPermission])

  // Show welcome back when user returns to paused session
  useEffect(() => {
    if (isSessionActive && isPaused) {
      // Check if this is a return (not initial load)
      const wasHidden = document.visibilityState === 'visible'
      if (wasHidden) {
        setShowWelcomeBack(true)
        // Auto-hide after 5 seconds
        const timer = setTimeout(() => setShowWelcomeBack(false), 5000)
        return () => clearTimeout(timer)
      }
    } else {
      setShowWelcomeBack(false)
    }
  }, [isSessionActive, isPaused])

  const handleRequestPermission = async () => {
    setHasAskedPermission(true)
    await onRequestPermission()
    setShowPermissionPrompt(false)
  }

  const handleDismissPermission = () => {
    setHasAskedPermission(true)
    setShowPermissionPrompt(false)
  }

  const handleResumeClick = () => {
    setShowWelcomeBack(false)
    onResume?.()
  }

  // Notification permission prompt
  if (showPermissionPrompt && !hasPermission) {
    return (
      <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top duration-300">
        <div className="bg-neutral-900/95 backdrop-blur-sm border border-neutral-700 rounded-2xl shadow-xl p-4 max-w-sm">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-500/20 rounded-xl">
              <Bell className="w-5 h-5 text-blue-400" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-white mb-1">
                Enable gentle reminders?
              </h4>
              <p className="text-xs text-neutral-400 mb-3">
                Get a friendly notification if you leave during your session.
                We&apos;ll only send 1-2 reminders max.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleRequestPermission}
                  className="flex-1 py-2 px-3 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium rounded-lg transition-colors"
                >
                  Enable
                </button>
                <button
                  onClick={handleDismissPermission}
                  className="py-2 px-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium rounded-lg transition-colors"
                >
                  Not now
                </button>
              </div>
            </div>
            <button
              onClick={handleDismissPermission}
              className="p-1 hover:bg-neutral-800 rounded-lg transition-colors"
            >
              <X className="w-4 h-4 text-neutral-500" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Welcome back message with resume button
  if (showWelcomeBack && isSessionActive && isPaused) {
    return (
      <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top duration-300">
        <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 backdrop-blur-sm border border-green-500/30 rounded-2xl shadow-xl p-4 max-w-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/30 rounded-xl">
              <ArrowRight className="w-5 h-5 text-green-400" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-white mb-0.5">
                Welcome back!
              </h4>
              <p className="text-xs text-green-200/80">
                Your session is paused and ready to continue.
              </p>
            </div>
            <button
              onClick={handleResumeClick}
              className="py-2 px-4 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-xl transition-colors flex items-center gap-1.5"
            >
              Resume
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}

/**
 * Small indicator showing notification status
 * Can be placed in the header/toolbar
 */
export function NotificationStatusIndicator({
  hasPermission,
  onRequestPermission,
}: {
  hasPermission: boolean
  onRequestPermission: () => Promise<boolean>
}) {
  const [isRequesting, setIsRequesting] = useState(false)

  const handleClick = async () => {
    if (hasPermission) return
    setIsRequesting(true)
    await onRequestPermission()
    setIsRequesting(false)
  }

  return (
    <button
      onClick={handleClick}
      disabled={hasPermission || isRequesting}
      className={`p-2.5 rounded-xl transition-all ${
        hasPermission
          ? 'bg-green-500/20 text-green-400 cursor-default'
          : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
      }`}
      title={hasPermission ? 'Notifications enabled' : 'Enable notifications'}
    >
      {hasPermission ? (
        <Bell className="w-5 h-5" />
      ) : (
        <BellOff className="w-5 h-5" />
      )}
    </button>
  )
}
