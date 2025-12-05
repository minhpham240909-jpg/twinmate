'use client'

import { useState, useEffect, useCallback } from 'react'

/**
 * Hook to manage CSRF token for secure API requests
 *
 * Usage:
 * ```tsx
 * const { csrfToken, csrfFetch } = useCsrf()
 *
 * // Option 1: Use csrfFetch (automatically includes CSRF token)
 * const response = await csrfFetch('/api/posts', {
 *   method: 'POST',
 *   body: JSON.stringify({ content: 'Hello' })
 * })
 *
 * // Option 2: Use csrfToken manually
 * fetch('/api/posts', {
 *   method: 'POST',
 *   headers: { 'X-CSRF-Token': csrfToken },
 *   body: JSON.stringify({ content: 'Hello' })
 * })
 * ```
 */
export function useCsrf() {
  const [csrfToken, setCsrfToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch CSRF token on mount
  useEffect(() => {
    const fetchToken = async () => {
      try {
        const response = await fetch('/api/csrf')
        if (response.ok) {
          const data = await response.json()
          setCsrfToken(data.csrfToken)
        } else if (response.status === 401) {
          // User not authenticated, no token needed
          setCsrfToken(null)
        } else {
          setError('Failed to fetch CSRF token')
        }
      } catch (err) {
        setError('Failed to fetch CSRF token')
      } finally {
        setLoading(false)
      }
    }

    fetchToken()
  }, [])

  // Refresh token (call after auth state changes)
  const refreshToken = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/csrf')
      if (response.ok) {
        const data = await response.json()
        setCsrfToken(data.csrfToken)
        setError(null)
      }
    } catch (err) {
      setError('Failed to refresh CSRF token')
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch wrapper that automatically includes CSRF token
  const csrfFetch = useCallback(async (
    url: string,
    options: RequestInit = {}
  ): Promise<Response> => {
    const headers = new Headers(options.headers)

    // Add CSRF token for state-changing requests
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(options.method?.toUpperCase() || '')) {
      if (csrfToken) {
        headers.set('X-CSRF-Token', csrfToken)
      }
    }

    // Ensure JSON content type if body is provided
    if (options.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }

    return fetch(url, {
      ...options,
      headers,
    })
  }, [csrfToken])

  return {
    csrfToken,
    loading,
    error,
    refreshToken,
    csrfFetch,
  }
}

/**
 * Global CSRF-protected fetch function
 * Use this for one-off requests without needing the hook
 */
let cachedCsrfToken: string | null = null

export async function fetchWithCsrf(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  // Fetch token if not cached
  if (!cachedCsrfToken) {
    try {
      const response = await fetch('/api/csrf')
      if (response.ok) {
        const data = await response.json()
        cachedCsrfToken = data.csrfToken
      }
    } catch {
      // Continue without CSRF token
    }
  }

  const headers = new Headers(options.headers)

  // Add CSRF token for state-changing requests
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(options.method?.toUpperCase() || '')) {
    if (cachedCsrfToken) {
      headers.set('X-CSRF-Token', cachedCsrfToken)
    }
  }

  // Ensure JSON content type if body is provided
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(url, {
    ...options,
    headers,
  })

  // If CSRF validation failed, refresh token and retry once
  if (response.status === 403) {
    const errorData = await response.clone().json().catch(() => ({}))
    if (errorData.error?.includes('CSRF')) {
      // Refresh token
      try {
        const tokenResponse = await fetch('/api/csrf')
        if (tokenResponse.ok) {
          const data = await tokenResponse.json()
          cachedCsrfToken = data.csrfToken
          headers.set('X-CSRF-Token', cachedCsrfToken!)

          // Retry the request
          return fetch(url, { ...options, headers })
        }
      } catch {
        // Return original response if retry fails
      }
    }
  }

  return response
}

/**
 * Clear cached CSRF token (call on logout)
 */
export function clearCsrfToken() {
  cachedCsrfToken = null
}
