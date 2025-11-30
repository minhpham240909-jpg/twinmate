'use client'

// Global error component for catching React rendering errors
// This is required for Sentry to capture errors in the App Router
// https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/#react-render-errors-in-app-router

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to Sentry
    Sentry.captureException(error)
  }, [error])

  return (
    <html>
      <body>
        <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
          <div className="max-w-md w-full text-center">
            <div className="mb-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-red-400"
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
              <h1 className="text-2xl font-bold text-white mb-2">
                Something went wrong!
              </h1>
              <p className="text-gray-400 mb-6">
                We apologize for the inconvenience. Our team has been notified and is working on a fix.
              </p>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => reset()}
                className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                Try again
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="w-full px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors"
              >
                Go to Homepage
              </button>
            </div>
            {process.env.NODE_ENV === 'development' && error?.message && (
              <div className="mt-8 p-4 bg-gray-800 rounded-lg text-left">
                <p className="text-sm text-gray-400 mb-2">Error details (dev only):</p>
                <pre className="text-xs text-red-400 overflow-auto">
                  {error.message}
                </pre>
              </div>
            )}
          </div>
        </div>
      </body>
    </html>
  )
}
