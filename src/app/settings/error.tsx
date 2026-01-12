'use client'

/**
 * Settings Error Boundary
 *
 * Catches errors in settings pages and provides recovery options.
 */

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'
import Link from 'next/link'

interface ErrorPageProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function SettingsError({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    Sentry.captureException(error, {
      tags: {
        errorBoundary: 'settings',
      },
    })
    console.error('[Settings Error]', error)
  }, [error])

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-6">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-gray-500/20 flex items-center justify-center">
            <svg
              className="w-7 h-7 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">
            Settings Loading Error
          </h2>
          <p className="text-gray-400 text-sm">
            We couldn&apos;t load your settings. Please try again.
          </p>
        </div>

        <div className="space-y-2">
          <button
            onClick={() => reset()}
            className="w-full px-4 py-2.5 bg-gray-600 hover:bg-gray-500 text-white font-medium rounded-lg transition-colors text-sm"
          >
            Reload Settings
          </button>
          <Link
            href="/dashboard"
            className="block w-full px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors text-sm"
          >
            Go to Dashboard
          </Link>
        </div>

        {process.env.NODE_ENV === 'development' && error?.message && (
          <div className="mt-6 p-3 bg-gray-800 rounded-lg text-left">
            <pre className="text-xs text-red-400 overflow-auto max-h-32">
              {error.message}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}
