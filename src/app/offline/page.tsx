'use client'

import { WifiOff, RefreshCw } from 'lucide-react'

export default function OfflinePage() {
  const handleRefresh = () => {
    window.location.reload()
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-200 dark:bg-gray-800 mb-4">
            <WifiOff className="w-10 h-10 text-gray-500 dark:text-gray-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            You&apos;re Offline
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            It looks like you&apos;ve lost your internet connection.
            Some features may not be available until you&apos;re back online.
          </p>
        </div>

        <div className="space-y-4">
          <button
            onClick={handleRefresh}
            className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>

          <div className="text-sm text-gray-500 dark:text-gray-400">
            <p className="mb-2">While offline, you can still:</p>
            <ul className="text-left space-y-1 inline-block">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Review cached flashcards
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                View your study history
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                See your progress stats
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
