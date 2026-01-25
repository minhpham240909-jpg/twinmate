'use client'

import { WifiOff, RefreshCw } from 'lucide-react'

export default function OfflinePage() {
  const handleRetry = () => {
    window.location.reload()
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex items-center justify-center p-6">
      <div className="max-w-sm w-full text-center">
        {/* Icon */}
        <div className="w-20 h-20 bg-neutral-200 dark:bg-neutral-800 rounded-full flex items-center justify-center mx-auto mb-6">
          <WifiOff className="w-10 h-10 text-neutral-400 dark:text-neutral-500" />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">
          You're offline
        </h1>

        {/* Description */}
        <p className="text-neutral-500 dark:text-neutral-400 mb-8">
          Check your internet connection and try again.
        </p>

        {/* Retry Button */}
        <button
          onClick={handleRetry}
          className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold transition-colors"
        >
          <RefreshCw className="w-5 h-5" />
          Try again
        </button>

        {/* Branding */}
        <div className="mt-12">
          <p className="text-xs text-neutral-400 dark:text-neutral-600">
            Clerva · Your AI Study Partner
          </p>
        </div>
      </div>
    </div>
  )
}
