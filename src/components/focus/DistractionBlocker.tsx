'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Shield, ShieldOff, X } from 'lucide-react'
import { STORAGE_KEYS } from '@/lib/focus/constants'

interface DistractionBlockerProps {
  isSessionActive: boolean
}

export default function DistractionBlocker({ isSessionActive }: DistractionBlockerProps) {
  const [isEnabled, setIsEnabled] = useState(false)
  const [showWarning, setShowWarning] = useState(false)
  const [timeAway, setTimeAway] = useState(0)
  const leftAtRef = useRef<number | null>(null)

  // Load preference
  useEffect(() => {
    const enabled = localStorage.getItem(STORAGE_KEYS.DISTRACTION_BLOCK) === 'true'
    setIsEnabled(enabled)
  }, [])

  // Track tab visibility
  useEffect(() => {
    if (!isEnabled || !isSessionActive) return

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // User left the tab
        leftAtRef.current = Date.now()
      } else {
        // User returned
        if (leftAtRef.current) {
          const awayTime = Math.round((Date.now() - leftAtRef.current) / 1000)
          if (awayTime >= 3) { // Only show if away for 3+ seconds
            setTimeAway(awayTime)
            setShowWarning(true)
          }
          leftAtRef.current = null
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isEnabled, isSessionActive])

  const toggleEnabled = useCallback(() => {
    const newEnabled = !isEnabled
    setIsEnabled(newEnabled)
    localStorage.setItem(STORAGE_KEYS.DISTRACTION_BLOCK, newEnabled.toString())
  }, [isEnabled])

  const dismissWarning = useCallback(() => {
    setShowWarning(false)
    setTimeAway(0)
  }, [])

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds} second${seconds === 1 ? '' : 's'}`
    const mins = Math.floor(seconds / 60)
    return `${mins} minute${mins === 1 ? '' : 's'}`
  }

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={toggleEnabled}
        className={`p-2.5 rounded-xl transition-all ${
          isEnabled
            ? 'bg-emerald-500/20 text-emerald-400'
            : 'bg-neutral-800/50 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-300'
        }`}
        title={isEnabled ? 'Focus mode enabled (click to disable)' : 'Enable focus mode'}
      >
        {isEnabled ? (
          <Shield className="w-5 h-5" />
        ) : (
          <ShieldOff className="w-5 h-5" />
        )}
      </button>

      {/* Warning Overlay */}
      {showWarning && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl max-w-md w-full p-6 text-center">
            {/* Icon */}
            <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>

            {/* Message */}
            <h3 className="text-xl font-bold text-white mb-2">
              Welcome back!
            </h3>
            <p className="text-neutral-400 mb-6">
              You left your study session for {formatTime(timeAway)}.
              <br />
              Ready to focus again?
            </p>

            {/* Actions */}
            <button
              onClick={dismissWarning}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
            >
              <Shield className="w-5 h-5" />
              <span>Back to studying</span>
            </button>

            {/* Option to disable */}
            <button
              onClick={() => {
                toggleEnabled()
                dismissWarning()
              }}
              className="mt-3 text-sm text-neutral-500 hover:text-neutral-400 transition-colors"
            >
              Disable focus mode
            </button>
          </div>
        </div>
      )}
    </>
  )
}
