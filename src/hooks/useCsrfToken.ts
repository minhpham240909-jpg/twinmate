import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth/context'

/**
 * Hook to manage CSRF tokens on the client side
 * Automatically fetches and refreshes tokens when user session changes
 */
export function useCsrfToken() {
  const { user } = useAuth()
  const [csrfToken, setCsrfToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function fetchToken() {
      if (!user) {
        setCsrfToken(null)
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)
        
        const response = await fetch('/api/csrf')
        
        if (!response.ok) {
          throw new Error('Failed to fetch CSRF token')
        }
        
        const data = await response.json()
        
        if (mounted) {
          setCsrfToken(data.csrfToken)
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Unknown error')
          setCsrfToken(null)
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    fetchToken()

    return () => {
      mounted = false
    }
  }, [user]) // Re-fetch when user changes (login/logout)

  return { csrfToken, loading, error }
}

/**
 * Helper to add CSRF token to fetch headers
 */
export function addCsrfHeader(headers: HeadersInit = {}, csrfToken: string | null): HeadersInit {
  if (!csrfToken) {
    return headers
  }

  const headersObj = headers instanceof Headers 
    ? Object.fromEntries(headers.entries())
    : Array.isArray(headers)
    ? Object.fromEntries(headers)
    : headers

  return {
    ...headersObj,
    'x-csrf-token': csrfToken,
  }
}
