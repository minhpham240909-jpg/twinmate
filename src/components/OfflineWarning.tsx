'use client'

import { useNetwork } from '@/contexts/NetworkContext'

interface OfflineWarningProps {
  message?: string
  className?: string
  showWhenSlow?: boolean
}

/**
 * Inline warning component to show when offline or on slow connection
 * Use this within specific features to warn about stale data or disabled functionality
 */
export default function OfflineWarning({
  message = 'You are offline. Some features may not work.',
  className = '',
  showWhenSlow = false,
}: OfflineWarningProps) {
  const { isOnline, isSlowConnection } = useNetwork()

  // Show warning if offline, or if slow and showWhenSlow is true
  const shouldShow = !isOnline || (showWhenSlow && isSlowConnection)

  if (!shouldShow) return null

  return (
    <div className={`bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 dark:border-yellow-600 p-3 ${className}`}>
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg
            className="h-5 w-5 text-yellow-400 dark:text-yellow-500"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="ml-3">
          <p className="text-sm text-yellow-700 dark:text-yellow-400">
            {!isOnline ? (
              <>
                <span className="font-semibold">Offline:</span> {message}
              </>
            ) : (
              <>
                <span className="font-semibold">Slow Connection:</span> You may experience delays.
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}
