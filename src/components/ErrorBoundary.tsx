'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'

// Dynamically import Sentry to prevent module resolution issues
let Sentry: typeof import('@sentry/nextjs') | null = null
if (typeof window !== 'undefined') {
  import('@sentry/nextjs').then((mod) => {
    Sentry = mod
  }).catch(() => {
    // Sentry not available, continue without it
  })
}

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * Error Boundary Component
 * Catches JavaScript errors anywhere in the child component tree
 *
 * Usage:
 * ```tsx
 * <ErrorBoundary>
 *   <YourComponent />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo)
    }

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo)

    // Send error to Sentry monitoring service (if available)
    if (Sentry) {
      Sentry.captureException(error, {
        contexts: {
          react: {
            componentStack: errorInfo.componentStack,
          },
        },
      })
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
    // Optionally reload the page
    // window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI if provided
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default fallback UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-neutral-950 px-4" role="alert" aria-live="assertive">
          <div className="max-w-md w-full bg-white dark:bg-neutral-900 rounded-lg shadow-lg dark:shadow-none dark:border dark:border-neutral-800 p-8 text-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-red-600 dark:text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>

            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Oops! Something went wrong
            </h1>

            <p className="text-gray-600 dark:text-gray-400 mb-6">
              We encountered an unexpected error. This has been logged and we&apos;ll look into it.
            </p>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="mb-6 p-4 bg-gray-100 dark:bg-neutral-800 rounded-lg text-left">
                <p className="text-sm font-mono text-red-600 dark:text-red-400 break-all">
                  {this.state.error.message}
                </p>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <button
                onClick={this.handleReset}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
                aria-label="Try again to recover from error"
              >
                Try Again
              </button>

              <button
                onClick={() => window.location.href = '/dashboard'}
                className="w-full px-6 py-3 bg-white dark:bg-neutral-800 text-blue-600 dark:text-blue-400 border-2 border-blue-600 dark:border-blue-500 rounded-lg font-semibold hover:bg-blue-50 dark:hover:bg-neutral-700 transition"
                aria-label="Navigate to dashboard"
              >
                Go to Dashboard
              </button>

              <button
                onClick={() => window.location.reload()}
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                aria-label="Reload the page"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * Lightweight error boundary for non-critical sections
 */
export function SoftErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      fallback={
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg" role="alert">
          <p className="text-yellow-800 dark:text-yellow-200 text-sm">
            This section failed to load. Please refresh the page.
          </p>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  )
}
