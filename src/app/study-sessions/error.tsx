'use client'

/**
 * Study Sessions Error Boundary
 *
 * Catches errors in study session pages and provides recovery options.
 */

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'
import Link from 'next/link'

interface ErrorPageProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function StudySessionsError({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    Sentry.captureException(error, {
      tags: {
        errorBoundary: 'study-sessions',
      },
    })
    console.error('[Study Sessions Error]', error)
  }, [error])

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-6">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-purple-500/20 flex items-center justify-center">
            <svg
              className="w-7 h-7 text-purple-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">
            Session Loading Error
          </h2>
          <p className="text-gray-400 text-sm">
            We couldn&apos;t load the study session. Please try again or start a new session.
          </p>
        </div>

        <div className="space-y-2">
          <button
            onClick={() => reset()}
            className="w-full px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors text-sm"
          >
            Try Again
          </button>
          <Link
            href="/study-sessions"
            className="block w-full px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors text-sm"
          >
            Browse Sessions
          </Link>
          <Link
            href="/dashboard"
            className="block w-full px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium rounded-lg transition-colors text-sm"
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
