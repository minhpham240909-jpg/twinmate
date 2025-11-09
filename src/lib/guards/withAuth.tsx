'use client'

import { useAuth } from '@/lib/auth/context'
import { useRouter } from 'next/navigation'
import { useEffect, useState, ComponentType } from 'react'

/**
 * Higher-Order Component that protects routes requiring authentication
 *
 * Features:
 * - Uses router.replace() to prevent history pollution
 * - Shows loading state during auth check
 * - Prevents redirect loops by checking auth state only once
 * - Prevents flash of unauthenticated content
 *
 * Usage:
 * ```tsx
 * export default withAuth(YourPage)
 * ```
 */
export function withAuth<P extends object>(
  Component: ComponentType<P>,
  options: {
    redirectTo?: string
    loadingComponent?: ComponentType
  } = {}
) {
  const {
    redirectTo = '/auth/signin',
    loadingComponent: LoadingComponent
  } = options

  return function ProtectedRoute(props: P) {
    const { user, loading } = useAuth()
    const router = useRouter()
    const [isRedirecting, setIsRedirecting] = useState(false)

    useEffect(() => {
      // Only check auth once when loading is complete
      if (!loading && !user && !isRedirecting) {
        setIsRedirecting(true)
        // Use replace() instead of push() to prevent adding to browser history
        // This prevents redirect loops and back button issues
        router.replace(redirectTo)
      }
    }, [user, loading, router, isRedirecting])

    // Show loading state while checking auth or redirecting
    if (loading || isRedirecting || !user) {
      if (LoadingComponent) {
        return <LoadingComponent />
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      )
    }

    // User is authenticated, render the protected component
    return <Component {...props} />
  }
}

/**
 * Default loading component for withAuth
 */
export function DefaultAuthLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-gray-600">Verifying authentication...</p>
      </div>
    </div>
  )
}
