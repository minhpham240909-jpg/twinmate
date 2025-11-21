'use client'

import { useState, useEffect } from 'react'
import { useNetwork } from '@/contexts/NetworkContext'

export default function OfflineIndicator() {
  const { isOnline, isSlowConnection, effectiveType } = useNetwork()
  const [isDismissed, setIsDismissed] = useState(false)
  const [showReconnecting, setShowReconnecting] = useState(false)

  // Reset dismissed state when going offline
  useEffect(() => {
    if (!isOnline) {
      setIsDismissed(false)
      setShowReconnecting(false)
    }
  }, [isOnline])

  // Show "reconnecting" animation after a few seconds offline
  useEffect(() => {
    if (!isOnline) {
      const timer = setTimeout(() => {
        setShowReconnecting(true)
      }, 3000)
      return () => clearTimeout(timer)
    } else {
      setShowReconnecting(false)
    }
  }, [isOnline])

  // Don't show if online and no slow connection
  if (isOnline && !isSlowConnection) return null

  // Don't show if dismissed and online
  if (isDismissed && isOnline) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999]">
      {/* Offline Banner */}
      {!isOnline && !isDismissed && (
        <div className="bg-red-600 text-white px-4 py-3 shadow-lg">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              <div className="flex-shrink-0">
                {showReconnecting ? (
                  <div className="relative">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3" />
                  </svg>
                )}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm">
                  {showReconnecting ? 'Attempting to reconnect...' : 'You are offline'}
                </p>
                <p className="text-xs text-white/90 mt-0.5">
                  Some features may not work. Please check your internet connection.
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsDismissed(true)}
              className="ml-4 p-1 hover:bg-red-700 rounded transition-colors flex-shrink-0"
              aria-label="Dismiss"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Slow Connection Warning */}
      {isOnline && isSlowConnection && !isDismissed && (
        <div className="bg-yellow-500 text-gray-900 px-4 py-3 shadow-lg">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm">
                  Slow connection detected
                  {effectiveType && effectiveType !== '4g' && (
                    <span className="ml-1 text-xs">({effectiveType.toUpperCase()})</span>
                  )}
                </p>
                <p className="text-xs text-gray-800 mt-0.5">
                  You may experience delays. Consider disabling video in calls.
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsDismissed(true)}
              className="ml-4 p-1 hover:bg-yellow-600 rounded transition-colors flex-shrink-0"
              aria-label="Dismiss"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
