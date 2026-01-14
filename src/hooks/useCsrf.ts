'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

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
  const lastRefreshRef = useRef<number>(0)

  // Function to fetch/refresh token
  const fetchToken = useCallback(async () => {
    try {
      const response = await fetch('/api/csrf')
      // Check if response is JSON before parsing
      const contentType = response.headers.get('content-type')
      if (!contentType?.includes('application/json')) {
        // Response is not JSON (likely HTML redirect), user not authenticated
        setCsrfToken(null)
        return null
      }
      if (response.ok) {
        const data = await response.json()
        setCsrfToken(data.csrfToken)
        lastRefreshRef.current = Date.now()
        return data.csrfToken
      } else if (response.status === 401) {
        // User not authenticated, no token needed
        setCsrfToken(null)
        return null
      } else {
        setError('Failed to fetch CSRF token')
        return null
      }
    } catch (err) {
      // Silently handle - user likely not authenticated
      setCsrfToken(null)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch CSRF token on mount
  useEffect(() => {
    fetchToken()
  }, [fetchToken])

  // Refresh token (call after auth state changes)
  const refreshToken = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/csrf')
      const contentType = response.headers.get('content-type')
      if (!contentType?.includes('application/json')) {
        setCsrfToken(null)
        return
      }
      if (response.ok) {
        const data = await response.json()
        setCsrfToken(data.csrfToken)
        setError(null)
      }
    } catch (err) {
      // Silently handle
      setCsrfToken(null)
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch wrapper that automatically includes CSRF token with auto-retry on failure
  const csrfFetch = useCallback(async (
    url: string,
    options: RequestInit = {}
  ): Promise<Response> => {
    const headers = new Headers(options.headers)

    // Ensure JSON content type if body is provided
    if (options.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }

    // Add CSRF token for state-changing requests
    const method = options.method?.toUpperCase() || 'GET'
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      // Refresh token if it's been more than 5 minutes since last refresh
      let tokenToUse = csrfToken
      const timeSinceRefresh = Date.now() - lastRefreshRef.current
      if (!tokenToUse || timeSinceRefresh > 5 * 60 * 1000) {
        // Refresh token before making the request
        tokenToUse = await fetchToken()
      }

      if (tokenToUse) {
        headers.set('X-CSRF-Token', tokenToUse)
      }
    }

    const response = await fetch(url, {
      ...options,
      headers,
    })

    // If CSRF validation failed, refresh token and retry once
    if (response.status === 403) {
      const clonedResponse = response.clone()
      const errorData = await clonedResponse.json().catch(() => ({}))
      if (errorData.error?.toLowerCase().includes('csrf')) {
        console.log('[CSRF] Token invalid, refreshing and retrying...')
        // Refresh token
        const newToken = await fetchToken()
        if (newToken) {
          headers.set('X-CSRF-Token', newToken)
          // Retry the request
          return fetch(url, { ...options, headers })
        }
      }
    }

    return response
  }, [csrfToken, fetchToken])

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
      const contentType = response.headers.get('content-type')
      if (response.ok && contentType?.includes('application/json')) {
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
