'use client'

// Auth Context for Client-Side Authentication State
import { createContext, useContext, useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

// Check if Supabase is properly configured
const isSupabaseConfigured = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return url && key && !url.includes('placeholder') && url.startsWith('https://')
}

// Check if we're in production (disable verbose logging)
const isProduction = process.env.NODE_ENV === 'production'

// Fetch with timeout to prevent infinite loading
// Returns AbortController for cleanup
const fetchWithTimeout = async (
  url: string,
  options: RequestInit = {},
  timeoutMs = 8000,
  externalController?: AbortController
): Promise<Response> => {
  const controller = externalController || new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request to ${url} timed out after ${timeoutMs}ms`)
    }
    throw error
  }
}

export interface UserProfile {
  id: string
  email: string
  name: string
  role: 'FREE' | 'PREMIUM'
  // Profile role/position (e.g., 'Student', 'Professional', 'Teacher')
  // Separate from subscription role ('FREE'/'PREMIUM')
  profileRole?: string | null
  isAdmin?: boolean
  avatarUrl?: string | null
  bio?: string | null
  subjects?: string[]
  interests?: string[]
  goals?: string[]
  skillLevel?: string
  skillLevelCustomDescription?: string | null
  studyStyle?: string
  studyStyleCustomDescription?: string | null
  availableDays?: string[]
  availableHours?: string[]
  availabilityCustomDescription?: string | null
  subjectCustomDescription?: string | null
  interestsCustomDescription?: string | null
  // Gamification fields from Profile
  studyStreak?: number
  totalStudyHours?: number
  lastStudyDate?: Date | string | null
  // Other profile fields
  age?: number | null
  // Strengths and Weaknesses from LearningProfile
  strengths?: string[]
  weaknesses?: string[]
}

interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  configError: boolean
  profileError: string | null
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [configError, setConfigError] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const router = useRouter()

  // Memoize supabase client to prevent recreation on every render
  const supabase = useMemo(() => createClient(), [])

  // Debounce refs for profile fetch - prevents thundering herd on rapid auth changes
  const fetchProfileTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastFetchedUserIdRef = useRef<string | null>(null)
  const isFetchingRef = useRef(false)
  // AbortController for canceling in-flight profile requests on unmount
  const fetchAbortControllerRef = useRef<AbortController | null>(null)
  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true)

  // Note: Presence heartbeat is handled by PresenceProvider in root layout

  // Debounced profile fetch - prevents multiple fetches on rapid auth state changes
  const debouncedFetchProfile = useCallback((userId: string, immediate = false) => {
    // Skip if already fetching this user's profile
    if (isFetchingRef.current && lastFetchedUserIdRef.current === userId) {
      return
    }

    // Clear any pending fetch
    if (fetchProfileTimeoutRef.current) {
      clearTimeout(fetchProfileTimeoutRef.current)
      fetchProfileTimeoutRef.current = null
    }

    // If immediate (initial load), fetch right away
    if (immediate) {
      fetchProfile(userId)
      return
    }

    // Otherwise debounce for 500ms to coalesce rapid auth state changes
    fetchProfileTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        fetchProfile(userId)
      }
    }, 500)
  }, [])

  const fetchProfile = async (userId: string) => {
    // Track fetch state to prevent duplicate requests
    isFetchingRef.current = true
    lastFetchedUserIdRef.current = userId

    // Cancel any previous in-flight request
    if (fetchAbortControllerRef.current) {
      fetchAbortControllerRef.current.abort()
    }

    // Create new AbortController for this request
    const abortController = new AbortController()
    fetchAbortControllerRef.current = abortController

    if (isMountedRef.current) {
      setProfileError(null)
    }

    // Retry logic with exponential backoff for better reliability
    const maxRetries = 3
    let lastError: Error | null = null

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      // Check if aborted before each attempt
      if (!isMountedRef.current || abortController.signal.aborted) {
        isFetchingRef.current = false
        return
      }

      try {
        const response = await fetchWithTimeout(
          `/api/users/${userId}`,
          {
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache',
            },
          },
          15000, // 15 second timeout (increased for reliability on slow networks)
          abortController
        )

        // Check again after fetch
        if (!isMountedRef.current || abortController.signal.aborted) {
          isFetchingRef.current = false
          return
        }

        if (response.ok) {
          const data = await response.json()

          if (data.user && isMountedRef.current) {
            const profileRole = data.profile?.role || null

            const mergedProfile = {
              ...data.user,
              ...(data.profile || {}),
              role: data.user.role,
              profileRole,
            }

            setProfile(mergedProfile)
          }
          // Success - clear fetching state and exit
          isFetchingRef.current = false
          if (fetchAbortControllerRef.current === abortController) {
            fetchAbortControllerRef.current = null
          }
          return
        } else {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
          if (!isProduction) {
            console.error('Error fetching profile:', response.status, errorData)
          }
          lastError = new Error(errorData.error || 'Server error')

          // Don't retry on 4xx client errors (except 408 Request Timeout, 429 Too Many Requests)
          if (response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 429) {
            break
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          isFetchingRef.current = false
          return
        }
        lastError = error instanceof Error ? error : new Error('Unknown error')
        if (!isProduction) {
          console.log(`[AuthContext] Profile fetch attempt ${attempt + 1}/${maxRetries} failed:`, lastError.message)
        }
      }

      // Wait before retry with exponential backoff (1s, 2s, 4s)
      if (attempt < maxRetries - 1 && isMountedRef.current && !abortController.signal.aborted) {
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)))
      }
    }

    // All retries failed - set error
    if (isMountedRef.current && lastError) {
      const errorMessage = lastError.message
      if (errorMessage.includes('timed out')) {
        setProfileError('Connection timed out. Please check your internet connection and try again.')
      } else {
        setProfileError(`Connection failed. Please refresh the page.`)
      }
    }

    // Clear fetching state
    isFetchingRef.current = false
    if (fetchAbortControllerRef.current === abortController) {
      fetchAbortControllerRef.current = null
    }
  }

  const refreshUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)
    if (user) {
      await fetchProfile(user.id)
    } else {
      setProfile(null)
    }
  }

  useEffect(() => {
    // Get initial session with timeout and retry logic to prevent infinite loading
    const initAuth = async () => {
      // Check if Supabase is properly configured
      if (!isSupabaseConfigured()) {
        if (!isProduction) {
          console.error('[AuthContext] Supabase is not configured. Check environment variables.')
        }
        setConfigError(true)
        setLoading(false)
        return
      }

      // Helper function to get user with retry logic
      // This helps handle race conditions after OAuth callback
      // Check if we're coming from auth callback - need more retries
      const urlParams = new URLSearchParams(window.location.search)
      const isFromAuthCallback = urlParams.get('auth_callback') === 'true'

      // Use more retries and longer delay if coming from auth callback
      const maxRetries = isFromAuthCallback ? 6 : 3
      const retryDelay = isFromAuthCallback ? 800 : 500

      const getUserWithRetry = async (retries = maxRetries, delayMs = retryDelay): Promise<{ user: any; error: any }> => {
        for (let attempt = 0; attempt < retries; attempt++) {
          try {
            const { data: { user }, error } = await supabase.auth.getUser()

            // If we got a user or a definitive "no session" response, return
            if (user || (!error && !user)) {
              return { user, error: null }
            }

            // If there's an error but we have cookies, retry after a short delay
            // This handles the cookie sync race condition
            const hasCookies = document.cookie.includes('-auth-token')
            if (error && hasCookies && attempt < retries - 1) {
              if (!isProduction) {
                console.log(`[AuthContext] Retry ${attempt + 1}/${retries} - waiting for cookie sync...`)
              }
              await new Promise(resolve => setTimeout(resolve, delayMs))
              continue
            }

            // If from auth callback and no user yet, keep trying
            if (isFromAuthCallback && !user && attempt < retries - 1) {
              await new Promise(resolve => setTimeout(resolve, delayMs))
              continue
            }

            return { user: null, error }
          } catch (err) {
            if (attempt < retries - 1) {
              await new Promise(resolve => setTimeout(resolve, delayMs))
              continue
            }
            return { user: null, error: err }
          }
        }
        return { user: null, error: new Error('Max retries exceeded') }
      }

      // Create a timeout promise - longer timeout for auth callback
      const timeoutMs = isFromAuthCallback ? 15000 : 10000
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Auth initialization timed out')), timeoutMs)
      })

      try {
        // Race between auth check (with retry) and timeout
        const result = await Promise.race([
          getUserWithRetry(),
          timeoutPromise
        ]) as { user: any, error: any }

        const { user, error } = result
        if (error && !isProduction) {
          console.error('[AuthContext] Error getting user:', error.message || error)
        }
        setUser(user)
        if (user) {
          await fetchProfile(user.id)
        }
      } catch (err) {
        if (!isProduction) {
          console.error('[AuthContext] Failed to initialize auth:', err)
        }
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        if (errorMessage.includes('timed out')) {
          setProfileError('Connection timed out. Please refresh the page.')
        }
      }
      setLoading(false)
    }

    initAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null)
        if (session?.user) {
          // Use debounced fetch for auth state changes to prevent thundering herd
          // Only fetch immediately on SIGNED_IN, debounce for TOKEN_REFRESHED etc.
          const isSignIn = event === 'SIGNED_IN'
          debouncedFetchProfile(session.user.id, isSignIn)
        } else {
          setProfile(null)
          // Clear any pending profile fetch
          if (fetchProfileTimeoutRef.current) {
            clearTimeout(fetchProfileTimeoutRef.current)
            fetchProfileTimeoutRef.current = null
          }
        }
        setLoading(false)

        // Refresh router on sign in/out
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
          router.refresh()
        }
      }
    )

    return () => {
      // Mark component as unmounted to prevent state updates
      isMountedRef.current = false

      // Unsubscribe from auth state changes
      subscription.unsubscribe()

      // Clear pending fetch timeout
      if (fetchProfileTimeoutRef.current) {
        clearTimeout(fetchProfileTimeoutRef.current)
        fetchProfileTimeoutRef.current = null
      }

      // Cancel any in-flight fetch requests
      if (fetchAbortControllerRef.current) {
        fetchAbortControllerRef.current.abort()
        fetchAbortControllerRef.current = null
      }
    }
  }, [router, supabase, debouncedFetchProfile])

  const signOut = async () => {
    // Confirm before signing out
    if (!confirm('Are you sure you want to log out?')) {
      return
    }

    try {
      // Sign out via API (this will mark presence as offline)
      await fetch('/api/auth/signout', { method: 'POST' })

      // Also sign out from client-side Supabase to clear cookies properly
      await supabase.auth.signOut()

      // Clear local state
      setUser(null)
      setProfile(null)

      // Use window.location for a full page reload to ensure clean state
      // This ensures all cached auth state is cleared
      window.location.href = '/auth'
    } catch (error) {
      if (!isProduction) {
        console.error('Error signing out:', error)
      }
      // Still try to redirect even if there's an error
      window.location.href = '/auth'
    }
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, configError, profileError, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}