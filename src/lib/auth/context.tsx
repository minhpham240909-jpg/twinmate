'use client'

// Auth Context for Client-Side Authentication State
import { createContext, useContext, useEffect, useState } from 'react'
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
const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeoutMs = 8000): Promise<Response> => {
  const controller = new AbortController()
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
  const supabase = createClient()

  // Note: Presence heartbeat is handled by PresenceProvider in root layout

  const fetchProfile = async (userId: string) => {
    setProfileError(null)
    try {
      // Add cache: 'no-store' to bypass any caching and get fresh profile data
      // Use fetchWithTimeout to prevent infinite loading in production
      const response = await fetchWithTimeout(`/api/users/${userId}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      }, 8000) // 8 second timeout (reduced from 15s)
      if (response.ok) {
        const data = await response.json()

        // Merge user data with profile data
        // Ensure we have at least basic user info even if profile is null
        if (data.user) {
          // Extract Profile.role as profileRole (user position like 'Student', 'Professional')
          // This is separate from User.role which is subscription type ('FREE'/'PREMIUM')
          const profileRole = data.profile?.role || null

          const mergedProfile = {
            ...data.user,
            ...(data.profile || {}), // Use empty object if profile is null
            // Ensure subscription role is preserved from user data
            role: data.user.role,
            // Map Profile.role to profileRole to avoid confusion
            profileRole,
          }

          setProfile(mergedProfile)
        }
      } else {
        // Log error but don't throw - let the UI handle it
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        if (!isProduction) {
          console.error('Error fetching profile:', response.status, errorData)
        }
        setProfileError(`Failed to load profile: ${errorData.error || 'Server error'}`)
      }
    } catch (error) {
      if (!isProduction) {
        console.error('Error fetching profile:', error)
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      if (errorMessage.includes('timed out')) {
        setProfileError('Connection timed out. Please check your internet connection.')
      } else {
        setProfileError(`Failed to load profile: ${errorMessage}`)
      }
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
      const maxRetries = isFromAuthCallback ? 5 : 2
      const retryDelay = isFromAuthCallback ? 500 : 300

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
      const timeoutMs = isFromAuthCallback ? 8000 : 5000
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
          await fetchProfile(session.user.id)
        } else {
          setProfile(null)
        }
        setLoading(false)

        // Refresh router on sign in/out
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
          router.refresh()
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [router, supabase])

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