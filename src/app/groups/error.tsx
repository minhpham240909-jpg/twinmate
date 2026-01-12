'use client'

/**
 * Groups Error Boundary
 *
 * Catches errors in group pages and provides recovery options.
 */

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'
import Link from 'next/link'

interface ErrorPageProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GroupsError({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    Sentry.captureException(error, {
      tags: {
        errorBoundary: 'groups',
      },
    })
    console.error('[Groups Error]', error)
  }, [error])

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-6">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
            <svg
              className="w-7 h-7 text-green-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">
            Groups Loading Error
          </h2>
          <p className="text-gray-400 text-sm">
            We had trouble loading groups. Please try again.
          </p>
        </div>

        <div className="space-y-2">
          <button
            onClick={() => reset()}
            className="w-full px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors text-sm"
          >
            Try Again
          </button>
          <Link
            href="/groups"
            className="block w-full px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors text-sm"
          >
            Browse Groups
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
