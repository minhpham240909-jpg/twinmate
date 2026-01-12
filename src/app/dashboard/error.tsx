'use client'

/**
 * Dashboard Error Boundary
 *
 * Catches errors in the dashboard and provides recovery options.
 */

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'
import Link from 'next/link'

interface ErrorPageProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function DashboardError({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    Sentry.captureException(error, {
      tags: {
        errorBoundary: 'dashboard',
      },
    })
    console.error('[Dashboard Error]', error)
  }, [error])

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-6">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-yellow-500/20 flex items-center justify-center">
            <svg
              className="w-7 h-7 text-yellow-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">
            Dashboard Error
          </h2>
          <p className="text-gray-400 text-sm">
            There was a problem loading your dashboard. This might be temporary.
          </p>
        </div>

        <div className="space-y-2">
          <button
            onClick={() => reset()}
            className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors text-sm"
          >
            Reload Dashboard
          </button>
          <Link
            href="/"
            className="block w-full px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors text-sm"
          >
            Go Home
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
