'use client'

/**
 * PWA Update Notification
 *
 * Displays a notification banner when a new service worker update is available.
 * Allows users to apply the update or dismiss it.
 */

import { usePWA } from '@/hooks/usePWA'
import { RefreshCw, X } from 'lucide-react'

export default function PWAUpdateNotification() {
  const { hasUpdate, isUpdating, applyUpdate, dismissUpdate } = usePWA()

  if (!hasUpdate) return null

  return (
    <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-blue-600 dark:bg-blue-700 text-white rounded-xl shadow-lg p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 bg-blue-500 dark:bg-blue-600 rounded-lg flex items-center justify-center">
            <RefreshCw className={`w-5 h-5 ${isUpdating ? 'animate-spin' : ''}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm">Update Available</h3>
            <p className="text-blue-100 text-xs mt-0.5">
              A new version of Clerva is ready. Refresh to get the latest features.
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={applyUpdate}
                disabled={isUpdating}
                className="px-3 py-1.5 bg-white dark:bg-neutral-900 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-semibold hover:bg-blue-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUpdating ? 'Updating...' : 'Refresh Now'}
              </button>
              <button
                onClick={dismissUpdate}
                disabled={isUpdating}
                className="px-3 py-1.5 bg-blue-500 dark:bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-400 dark:hover:bg-blue-500 transition-colors disabled:opacity-50"
              >
                Later
              </button>
            </div>
          </div>
          <button
            onClick={dismissUpdate}
            disabled={isUpdating}
            className="flex-shrink-0 p-1 hover:bg-blue-500 dark:hover:bg-blue-600 rounded-lg transition-colors disabled:opacity-50"
            aria-label="Dismiss update notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
