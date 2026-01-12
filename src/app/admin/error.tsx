'use client'

/**
 * Admin Dashboard Error Boundary
 *
 * Catches errors in admin pages and provides recovery options.
 */

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'
import Link from 'next/link'

interface ErrorPageProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function AdminError({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    Sentry.captureException(error, {
      tags: {
        errorBoundary: 'admin',
        severity: 'high',
      },
    })
    console.error('[Admin Error]', error)
  }, [error])

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-6">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
            <svg
              className="w-7 h-7 text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">
            Admin Panel Error
          </h2>
          <p className="text-gray-400 text-sm">
            An error occurred in the admin panel. This has been logged for review.
          </p>
        </div>

        <div className="space-y-2">
          <button
            onClick={() => reset()}
            className="w-full px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors text-sm"
          >
            Reload Panel
          </button>
          <Link
            href="/admin"
            className="block w-full px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors text-sm"
          >
            Go to Admin Home
          </Link>
          <Link
            href="/dashboard"
            className="block w-full px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium rounded-lg transition-colors text-sm"
          >
            Exit Admin
          </Link>
        </div>

        {process.env.NODE_ENV === 'development' && error?.message && (
          <div className="mt-6 p-3 bg-gray-800 rounded-lg text-left">
            <pre className="text-xs text-red-400 overflow-auto max-h-32">
              {error.message}
            </pre>
            {error.digest && (
              <p className="text-xs text-gray-500 mt-2">
                Error ID: {error.digest}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
